//! First-party anonymous ad measurements. A visit is an outbound redirect, not proof
//! that an advertiser's page loaded. Public events never accept player identifiers.
use crate::{AppState, control, control_error, require_permission, token_hash};
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{HeaderMap, Method, StatusCode, header},
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
};
use mysql::{TxOpts, params, prelude::Queryable};
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Mutex;

pub(crate) fn routes() -> Router<AppState> {
    Router::new()
        .route("/ads-api/v1/events", post(collect))
        .layer(DefaultBodyLimit::max(4096))
        .route("/ads-api/v1/out/{creative}/{event}", get(visit))
        .route("/admin-api/v1/ads/analytics", get(report))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Event {
    event_id: String,
    creative_id: u64,
    kind: String,
    source: String,
}
fn valid_id(id: &str) -> bool {
    id.len() == 36
        && id.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
}
fn validate(e: &Event, outbound: bool) -> control::Result<()> {
    if !valid_id(&e.event_id)
        || e.creative_id == 0
        || !(matches!(e.kind.as_str(), "impression" | "click") || outbound && e.kind == "visit")
        || !matches!(e.source.as_str(), "scene_3d" | "scene_2d" | "details")
    {
        return Err(control::Error::Invalid("Invalid ad event"));
    }
    Ok(())
}
// A hard process-wide ceiling bounds unauthenticated database writes. These are
// descriptive browser measurements, not fraud-proof billing or unique-person counts.
static RATE: Mutex<(i64, u32)> = Mutex::new((0, 0));
fn allow_event() -> bool {
    let now = chrono::Utc::now().timestamp();
    let mut rate = RATE.lock().unwrap_or_else(|e| e.into_inner());
    if rate.0 != now {
        *rate = (now, 0);
    }
    rate.1 += 1;
    rate.1 <= 100
}
fn record(pool: &mysql::Pool, e: Event) -> control::Result<String> {
    let mut db = pool.get_conn()?;
    let row: Option<(u64, String, String)> = db.exec_first("SELECT b.campaign_id,b.placement_id,r.destination FROM ad_bookings b JOIN ad_campaigns c ON c.id=b.campaign_id JOIN ad_creatives r ON r.id=b.creative_id WHERE r.id=? AND c.status='live' AND b.starts_at<=UNIX_TIMESTAMP() AND b.ends_at>UNIX_TIMESTAMP()", (e.creative_id,))?;
    let (campaign, placement, destination) = row.ok_or(control::Error::NotFound)?;
    let result = db.exec_drop("INSERT INTO ad_events (event_id,campaign_id,creative_id,placement_id,kind,source,occurred_at) VALUES (?,?,?,?,?,?,?)", (&e.event_id,campaign,e.creative_id,placement,e.kind,e.source,chrono::Utc::now().timestamp_millis()));
    match result {
        Ok(()) => {}
        Err(mysql::Error::MySqlError(error)) if error.code == 1062 => {} // retried event ID
        Err(error) => return Err(error.into()),
    }
    Ok(destination)
}
async fn collect(State(state): State<AppState>, Json(event): Json<Event>) -> Response {
    if !state.config.ads_enabled {
        return StatusCode::NOT_FOUND.into_response();
    }
    if let Err(e) = validate(&event, false) {
        return control_error(e);
    }
    if !allow_event() {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    }
    match state.control(move |pool| record(pool, event)).await {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => control_error(e),
    }
}
async fn visit(
    State(state): State<AppState>,
    method: Method,
    headers: HeaderMap,
    Path((creative, event)): Path<(u64, String)>,
) -> Response {
    // HEAD probes and browser prefetches are not visits.
    if method != Method::GET
        || headers.contains_key("purpose")
        || headers.contains_key("sec-purpose")
    {
        return StatusCode::NO_CONTENT.into_response();
    }
    if !state.config.ads_enabled {
        return StatusCode::NOT_FOUND.into_response();
    }
    let event = Event {
        event_id: event,
        creative_id: creative,
        kind: "visit".into(),
        source: "details".into(),
    };
    if let Err(e) = validate(&event, true) {
        return control_error(e);
    }
    if !allow_event() {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    }
    match state.control(move |pool| record(pool, event)).await {
        Ok(destination) => {
            let mut response = Redirect::to(&destination).into_response();
            response.headers_mut().insert(
                header::REFERRER_POLICY,
                axum::http::HeaderValue::from_static("no-referrer"),
            );
            response
        }
        Err(e) => control_error(e),
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Filters {
    start: i64,
    end: i64,
    #[serde(default)]
    campaign: u64,
    #[serde(default)]
    before: u64,
    snapshot: Option<u64>,
    #[serde(default)]
    kind: String,
    #[serde(default)]
    export: String,
}
fn validate_filters(f: &Filters) -> control::Result<()> {
    if f.start < 0
        || f.end <= f.start
        || f.end - f.start > 366 * 86400 * 1000
        || !matches!(f.kind.as_str(), "" | "impression" | "click" | "visit")
        || !matches!(f.export.as_str(), "" | "events" | "summary")
    {
        return Err(control::Error::Invalid(
            "Choose a date range of at most 366 days and a valid event type",
        ));
    }
    Ok(())
}
const FILTER: &str = "e.occurred_at>=:start AND e.occurred_at<:end AND (:campaign=0 OR e.campaign_id=:campaign) AND (:kind='' OR e.kind=:kind) AND e.id<=:snapshot";
fn csv_cell(value: &str) -> String {
    // Protect spreadsheet users from formula injection, including whitespace prefixes.
    let safe = if value.trim_start().starts_with(['=', '+', '-', '@'])
        || value.starts_with(['\t', '\r', '\n'])
    {
        format!("'{value}")
    } else {
        value.to_owned()
    };
    format!("\"{}\"", safe.replace('"', "\"\""))
}
fn csv(rows: &[Value], fields: &[&str]) -> String {
    let mut text = format!("\u{feff}{}\r\n", fields.join(","));
    for row in rows {
        text.push_str(
            &fields
                .iter()
                .map(|field| {
                    let value = &row[*field];
                    csv_cell(
                        &value
                            .as_str()
                            .map(str::to_owned)
                            .unwrap_or_else(|| value.to_string()),
                    )
                })
                .collect::<Vec<_>>()
                .join(","),
        );
        text.push_str("\r\n");
    }
    text
}
async fn report(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(filters): Query<Filters>,
) -> Response {
    if let Err(response) = require_permission(&state, &headers, "ads:manage").await {
        return response;
    }
    if let Err(e) = validate_filters(&filters) {
        return control_error(e);
    }
    let digest = token_hash(&state, &headers).unwrap();
    let export = filters.export.clone();
    let result=state.control(move |pool| {
        let mut conn=pool.get_conn()?;
        let mut db=conn.start_transaction(TxOpts::default())?;
        control::require_session(&mut db,&digest,"ads:manage")?;
        let max: u64=db.query_first("SELECT COALESCE(MAX(id),0) FROM ad_events")?.unwrap_or(0);
        let snapshot=filters.snapshot.unwrap_or(max).min(max);
        let p=params! {"start"=>filters.start,"end"=>filters.end,"campaign"=>filters.campaign,"kind"=>&filters.kind,"snapshot"=>snapshot};
        let rows:Vec<mysql::Row>=db.exec(format!("SELECT e.campaign_id,c.name,a.name,e.placement_id,COUNT(*),CAST(SUM(e.kind='impression') AS UNSIGNED),CAST(SUM(e.kind='click') AS UNSIGNED),CAST(SUM(e.kind='visit') AS UNSIGNED) FROM ad_events e JOIN ad_campaigns c ON c.id=e.campaign_id JOIN ad_advertisers a ON a.id=c.advertiser_id WHERE {FILTER} GROUP BY e.campaign_id,c.name,a.name,e.placement_id ORDER BY e.campaign_id DESC,e.placement_id"),p.clone())?;
        let mut totals=[0u64;3];
        let summaries:Vec<Value>=rows.into_iter().map(|r| {
            let shown=r.get::<u64,_>(5).unwrap_or(0); let clicks=r.get::<u64,_>(6).unwrap_or(0); let visits=r.get::<u64,_>(7).unwrap_or(0);
            totals[0]+=shown;totals[1]+=clicks;totals[2]+=visits;
            json!({"campaign_id":r.get::<u64,_>(0),"campaign":r.get::<String,_>(1),"advertiser":r.get::<String,_>(2),"placement":r.get::<String,_>(3),"shown":shown,"clicks":clicks,"visits":visits})
        }).collect();
        let total=totals.iter().sum::<u64>();
        if filters.export=="events" && total>50000 { return Err(control::Error::Invalid("Over 50,000 events. Narrow the dates or campaign before exporting")); }
        let limit=if filters.export=="events" {50001} else {101};
        let cursor=if filters.export.is_empty() && filters.before>0 {format!(" AND e.id<{}",filters.before)} else {String::new()};
        let rows:Vec<mysql::Row>=if filters.export=="summary" {vec![]} else {db.exec(format!("SELECT e.id,e.event_id,e.campaign_id,c.name,a.name,e.creative_id,e.placement_id,e.kind,e.source,e.occurred_at,r.destination FROM ad_events e JOIN ad_campaigns c ON c.id=e.campaign_id JOIN ad_advertisers a ON a.id=c.advertiser_id JOIN ad_creatives r ON r.id=e.creative_id WHERE {FILTER}{cursor} ORDER BY e.id DESC LIMIT {limit}"),p)?};
        let mut events:Vec<Value>=rows.into_iter().map(|r| {
            let timestamp=r.get::<i64,_>(9).unwrap();
            json!({"id":r.get::<u64,_>(0),"event_id":r.get::<String,_>(1),"campaign_id":r.get::<u64,_>(2),"campaign":r.get::<String,_>(3),"advertiser":r.get::<String,_>(4),"creative_id":r.get::<u64,_>(5),"placement":r.get::<String,_>(6),"kind":r.get::<String,_>(7),"source":r.get::<String,_>(8),"occurred_at":timestamp,"time_utc":chrono::DateTime::from_timestamp_millis(timestamp).unwrap().to_rfc3339(),"destination":r.get::<String,_>(10)})
        }).collect();
        let more=filters.export.is_empty() && events.len()>100;
        if more {events.truncate(100);}
        let next=if more {events.last().and_then(|v| v["id"].as_u64())} else {None};
        db.commit()?;
        Ok(json!({"snapshot":snapshot,"start":filters.start,"end":filters.end,"summaries":summaries,"events":events,"shown":totals[0],"clicks":totals[1],"visits":totals[2],"total":total,"next":next}))
    }).await;
    match result {
        Err(e) => control_error(e),
        Ok(value) if !export.is_empty() => {
            let (key, fields) = if export == "events" {
                (
                    "events",
                    vec![
                        "id",
                        "event_id",
                        "time_utc",
                        "campaign_id",
                        "campaign",
                        "advertiser",
                        "creative_id",
                        "placement",
                        "kind",
                        "source",
                        "destination",
                    ],
                )
            } else {
                (
                    "summaries",
                    vec![
                        "campaign_id",
                        "campaign",
                        "advertiser",
                        "placement",
                        "shown",
                        "clicks",
                        "visits",
                    ],
                )
            };
            (
                [
                    (header::CONTENT_TYPE, "text/csv; charset=utf-8".to_owned()),
                    (
                        header::CONTENT_DISPOSITION,
                        format!("attachment; filename=\"naijachase-ad-{export}.csv\""),
                    ),
                ],
                csv(value[key].as_array().unwrap(), &fields),
            )
                .into_response()
        }
        Ok(value) => Json(value).into_response(),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "requires ADMIN_TEST_ADS_URL pointing at a fresh local nc_admin_test_* schema"]
    fn mysql_events_are_idempotent_and_keep_history() {
        let url = std::env::var("ADMIN_TEST_ADS_URL").expect("explicit disposable ad database");
        let opts = mysql::Opts::from_url(&url).unwrap();
        assert!(
            opts.get_db_name()
                .is_some_and(|n| n.starts_with("nc_admin_test_"))
        );
        assert!(matches!(
            opts.get_ip_or_hostname().as_ref(),
            "localhost" | "127.0.0.1" | "::1"
        ));
        let pool = mysql::Pool::new(opts).unwrap();
        let mut db = pool.get_conn().unwrap();
        assert_eq!(
            db.query_first::<u64, _>(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()"
            )
            .unwrap(),
            Some(0)
        );
        for sql in [
            include_str!("../migrations/0003_advertising.sql"),
            include_str!("../migrations/0004_ad_analytics.sql"),
        ] {
            let sql = sql
                .lines()
                .filter(|line| !line.trim_start().starts_with("--"))
                .collect::<Vec<_>>()
                .join("\n");
            for statement in sql.split(';').filter(|s| !s.trim().is_empty()) {
                db.query_drop(statement).unwrap();
            }
        }
        db.query_drop("INSERT INTO ad_advertisers (id,name) VALUES (1,'Example')")
            .unwrap();
        db.query_drop("INSERT INTO ad_creatives (id,advertiser_id,alt_text,destination,width,height,image) VALUES (1,1,'Offer','https://example.com/offer',1200,600,'image')").unwrap();
        db.query_drop(
            "INSERT INTO ad_campaigns (id,advertiser_id,name,status) VALUES (1,1,'Launch','live')",
        )
        .unwrap();
        db.query_drop("INSERT INTO ad_bookings VALUES (1,'office-right',1,UNIX_TIMESTAMP()-10,UNIX_TIMESTAMP()+1000)").unwrap();
        let event = |id, kind: &str| Event {
            event_id: format!("550e8400-e29b-41d4-a716-{id:012}"),
            creative_id: 1,
            kind: kind.into(),
            source: "details".into(),
        };
        for (id, kind) in [(1, "impression"), (2, "click"), (3, "visit"), (3, "visit")] {
            assert_eq!(
                record(&pool, event(id, kind)).unwrap(),
                "https://example.com/offer"
            );
        }
        assert_eq!(
            db.query_first::<u64, _>("SELECT COUNT(*) FROM ad_events")
                .unwrap(),
            Some(3)
        );
        let counts:Option<(u64,u64,u64)>=db.query_first("SELECT CAST(SUM(kind='impression') AS UNSIGNED),CAST(SUM(kind='click') AS UNSIGNED),CAST(SUM(kind='visit') AS UNSIGNED) FROM ad_events").unwrap();
        assert_eq!(counts, Some((1, 1, 1)));
        db.query_drop("UPDATE ad_campaigns SET status='paused' WHERE id=1")
            .unwrap();
        assert!(matches!(
            record(&pool, event(4, "click")),
            Err(control::Error::NotFound)
        ));
        db.query_drop("UPDATE ad_campaigns SET status='live' WHERE id=1")
            .unwrap();
        db.query_drop("UPDATE ad_bookings SET ends_at=UNIX_TIMESTAMP()-1 WHERE campaign_id=1")
            .unwrap();
        assert!(matches!(
            record(&pool, event(4, "click")),
            Err(control::Error::NotFound)
        ));
        assert_eq!(
            db.query_first::<u64, _>("SELECT COUNT(*) FROM ad_events")
                .unwrap(),
            Some(3)
        );
    }
    #[test]
    fn event_contract() {
        let mut e = Event {
            event_id: "550e8400-e29b-41d4-a716-446655440000".into(),
            creative_id: 1,
            kind: "impression".into(),
            source: "scene_3d".into(),
        };
        assert!(validate(&e, false).is_ok());
        e.kind = "visit".into();
        assert!(validate(&e, false).is_err());
        assert!(validate(&e, true).is_ok());
        e.event_id = "x".into();
        assert!(validate(&e, true).is_err());
        assert!(serde_json::from_value::<Event>(json!({"event_id":"x","creative_id":1,"kind":"click","source":"details","account_id":3})).is_err());
    }
    #[test]
    fn export_escapes_formulas_and_quotes() {
        assert_eq!(
            csv_cell(" =HYPERLINK(\"evil\")"),
            "\"' =HYPERLINK(\"\"evil\"\")\""
        );
        assert_eq!(csv_cell("Company, Ltd"), "\"Company, Ltd\"");
    }
    #[test]
    fn report_limits() {
        let mut f = Filters {
            start: 0,
            end: 86400000,
            campaign: 0,
            before: 0,
            snapshot: None,
            kind: String::new(),
            export: String::new(),
        };
        assert!(validate_filters(&f).is_ok());
        f.end = 367 * 86400000;
        assert!(validate_filters(&f).is_err());
        f.end = 0;
        assert!(validate_filters(&f).is_err());
    }
}
