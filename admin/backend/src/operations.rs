//! Versioned reporting contracts and admin-owned support workflows. No game crate imports.
use crate::{AppState, control, error, reports, require_permission, token_hash};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use chrono::Utc;
use mysql::{Pool, Row, TxOpts, params, prelude::Queryable};
use rand::RngCore;
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::HashMap;

pub(crate) fn routes() -> Router<AppState> {
    Router::new()
        .route("/admin-api/v1/accounts", get(accounts))
        .route("/admin-api/v1/accounts/{id}", get(account))
        .route("/admin-api/v1/accounts/{id}/notes", post(add_note))
        .route(
            "/admin-api/v1/accounts/{id}/revoke-sessions",
            post(revoke_sessions),
        )
        .route("/admin-api/v1/analytics", get(analytics))
        .route("/admin-api/v1/alerts", get(alerts))
        .route("/admin-api/v1/moderation", get(moderation))
        .route("/admin-api/v1/moderation/{id}/resolve", post(resolve))
}
pub(crate) fn reporting_ready(pool: &Pool) -> mysql::Result<()> {
    let mut conn = pool.get_conn()?;
    for view in [
        "admin_reporting_account_progress_v1",
        "admin_reporting_case_history_v1",
        "admin_reporting_activity_v1",
        "admin_reporting_moderation_v1",
        "admin_reporting_security_events_v1",
        "admin_reporting_email_health_v1",
    ] {
        conn.query_drop(format!("SELECT 1 FROM {view} LIMIT 0"))?;
    }
    conn.query_drop("SHOW CREATE PROCEDURE admin_revoke_player_sessions_v1")?;
    Ok(())
}
pub(crate) fn control_ready(pool: &Pool) -> control::Result<()> {
    let mut conn = pool.get_conn()?;
    for table in [
        "admin_account_notes",
        "admin_support_actions",
        "admin_moderation_decisions",
        "admin_alert_samples",
    ] {
        conn.query_drop(format!("SELECT 1 FROM {table} LIMIT 0"))?;
    }
    Ok(())
}
fn unavailable() -> Response {
    error(
        StatusCode::SERVICE_UNAVAILABLE,
        "The required reporting or admin database is unavailable",
    )
}
fn control_error(err: control::Error) -> Response {
    match err {
        control::Error::Unauthorized => error(StatusCode::UNAUTHORIZED, "Admin session required"),
        control::Error::Forbidden => error(
            StatusCode::FORBIDDEN,
            "Your role does not allow this action",
        ),
        control::Error::Conflict(message) => error(StatusCode::CONFLICT, message),
        control::Error::Invalid(message) => error(StatusCode::BAD_REQUEST, message),
        control::Error::NotFound => error(StatusCode::NOT_FOUND, "Record not found"),
        control::Error::Database => unavailable(),
    }
}
async fn audit_read(
    state: &AppState,
    headers: &HeaderMap,
    permission: &'static str,
    action: &'static str,
    target: &'static str,
) -> Result<(), Response> {
    let digest = token_hash(state, headers)
        .ok_or_else(|| error(StatusCode::UNAUTHORIZED, "Admin session required"))?;
    state
        .control(move |pool| {
            let mut conn = pool.get_conn()?;
            let mut tx = conn.start_transaction(TxOpts::default())?;
            tx.query_drop("SELECT id FROM admin_security_state WHERE id=1 FOR UPDATE")?;
            let actor = control::require_session(&mut tx, &digest, permission)?;
            control::audit(
                &mut tx,
                &actor,
                action,
                target,
                "requested",
                "Sensitive reporting access requested",
            )?;
            tx.commit()?;
            Ok(())
        })
        .await
        .map_err(control_error)
}
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
}
fn valid_reason(reason: &str) -> bool {
    !reason.trim().is_empty() && reason.chars().count() <= 500
}
fn pagination(page: Option<u64>, size: Option<u64>) -> Option<(u64, u64)> {
    let page = page.unwrap_or(1);
    let size = size.unwrap_or(25);
    ((1..=10_000).contains(&page) && (1..=100).contains(&size)).then_some((page, size))
}
fn prefix_search(search: &str) -> String {
    format!(
        "{}%",
        search
            .replace('=', "==")
            .replace('%', "=%")
            .replace('_', "=_")
    )
}
fn text(row: &Row, name: &str) -> Option<String> {
    row.get::<Option<String>, _>(name).flatten()
}
fn number(row: &Row, name: &str) -> u64 {
    row.get(name).unwrap_or(0)
}
const ACCOUNT_SELECT: &str = "SELECT player_id,email,username,display_name,home_base,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS created_at,DATE_FORMAT(email_verified_at,'%Y-%m-%dT%H:%i:%sZ') AS email_verified_at,DATE_FORMAT(last_seen_at,'%Y-%m-%dT%H:%i:%sZ') AS last_seen_at,points,active_sessions,completed_cases,solved_cases FROM admin_reporting_account_progress_v1";
fn account_json(row: Row) -> Value {
    json!({"player_id":text(&row,"player_id"),"email":text(&row,"email"),"username":text(&row,"username"),"display_name":text(&row,"display_name"),"home_base":text(&row,"home_base"),"created_at":text(&row,"created_at"),"email_verified_at":text(&row,"email_verified_at"),"last_seen_at":text(&row,"last_seen_at"),"points":number(&row,"points"),"active_sessions":number(&row,"active_sessions"),"completed_cases":number(&row,"completed_cases"),"solved_cases":number(&row,"solved_cases")})
}
#[derive(Deserialize, Default)]
#[serde(deny_unknown_fields)]
struct AccountQuery {
    search: Option<String>,
    page: Option<u64>,
    page_size: Option<u64>,
}
async fn accounts(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AccountQuery>,
) -> Response {
    if let Err(response) = require_permission(&state, &headers, "accounts:read").await {
        return response;
    }
    let search = query.search.unwrap_or_default().trim().to_owned();
    if search.len() > 320 {
        return error(StatusCode::BAD_REQUEST, "Search must be at most 320 bytes");
    }
    let Some((page, size)) = pagination(query.page, query.page_size) else {
        return error(StatusCode::BAD_REQUEST, "Invalid pagination");
    };
    if let Err(r) = audit_read(
        &state,
        &headers,
        "accounts:read",
        "accounts.searched",
        "accounts",
    )
    .await
    {
        return r;
    }
    match state.database(move |pool| {
        let mut conn=pool.get_conn()?;
        let filter=" WHERE (:empty=1 OR player_id=:exact OR email LIKE :search ESCAPE '=' OR username LIKE :search ESCAPE '=' OR display_name LIKE :search ESCAPE '=')";
        let args=params!{"empty"=>search.is_empty(),"exact"=>&search,"search"=>prefix_search(&search)};
        let total: Option<u64>=conn.exec_first(format!("SELECT COUNT(*) FROM admin_reporting_account_progress_v1{filter}"),args)?;
        let rows: Vec<Row>=conn.exec(format!("{ACCOUNT_SELECT}{filter} ORDER BY created_at DESC,player_id LIMIT :size OFFSET :offset"),params!{"empty"=>search.is_empty(),"exact"=>&search,"search"=>prefix_search(&search),"size"=>size,"offset"=>(page-1)*size})?;
        Ok(json!({"generated_at":reports::now(),"page":page,"page_size":size,"total":total,"items":rows.into_iter().map(account_json).collect::<Vec<_>>() }))
    }).await { Some(data)=>Json(data).into_response(),None=>unavailable() }
}
fn read_account(pool: &Pool, id: &str) -> mysql::Result<Option<Value>> {
    let mut conn = pool.get_conn()?;
    let row: Option<Row> = conn.exec_first(
        format!("{ACCOUNT_SELECT} WHERE player_id=:id"),
        params! {"id"=>id},
    )?;
    let Some(row) = row else { return Ok(None) };
    let cases:Vec<(String,Option<String>,Option<String>,Option<String>,Option<String>,String)>=conn.exec("SELECT case_id,mission_id,DATE_FORMAT(started_at,'%Y-%m-%dT%H:%i:%sZ'),DATE_FORMAT(completed_at,'%Y-%m-%dT%H:%i:%sZ'),outcome,attempt_kind FROM admin_reporting_case_history_v1 WHERE player_id=:id ORDER BY COALESCE(completed_at,started_at) DESC LIMIT 25",params!{"id"=>id})?;
    let events:Vec<(u64,String,String,String)>=conn.exec("SELECT event_id,event_type,outcome,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') FROM admin_reporting_security_events_v1 WHERE player_id=:id ORDER BY event_id DESC LIMIT 25",params!{"id"=>id})?;
    Ok(Some(
        json!({"account":account_json(row),"cases":cases.into_iter().map(|(case_id,mission_id,started_at,completed_at,outcome,attempt_kind)|json!({"case_id":case_id,"mission_id":mission_id,"started_at":started_at,"completed_at":completed_at,"outcome":outcome,"attempt_kind":attempt_kind})).collect::<Vec<_>>(),"security_events":events.into_iter().map(|(id,event_type,outcome,created_at)|json!({"id":id,"event_type":event_type,"outcome":outcome,"created_at":created_at})).collect::<Vec<_>>() }),
    ))
}
async fn account(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    if let Err(r) = require_permission(&state, &headers, "accounts:read").await {
        return r;
    };
    let Some(digest) = token_hash(&state, &headers) else {
        return error(StatusCode::UNAUTHORIZED, "Admin session required");
    };
    if !valid_id(&id) {
        return error(StatusCode::BAD_REQUEST, "Invalid account ID");
    }
    let report_id = id.clone();
    let mut data = match state
        .database(move |pool| read_account(pool, &report_id))
        .await
    {
        Some(Some(data)) => data,
        Some(None) => return error(StatusCode::NOT_FOUND, "Account not found"),
        None => return unavailable(),
    };
    match state.control(move|pool|{
        let mut conn=pool.get_conn()?;
        let mut tx=conn.start_transaction(TxOpts::default())?;
        tx.query_drop("SELECT id FROM admin_security_state WHERE id=1 FOR UPDATE")?;
        let actor=control::require_session(&mut tx,&digest,"accounts:read")?;
        control::audit(&mut tx,&actor,"account.viewed",&id,"success","Account support lookup")?;
        let notes:Vec<(u64,String,String,String)>=tx.exec("SELECT note_id,staff_username,reason,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') FROM admin_account_notes WHERE player_id=:id ORDER BY note_id DESC LIMIT 50",params!{"id"=>&id})?;
        let actions:Vec<(String,String,String,String,Option<String>)>=tx.exec("SELECT action_id,action,status,reason,DATE_FORMAT(completed_at,'%Y-%m-%dT%H:%i:%sZ') FROM admin_support_actions WHERE player_id=:id ORDER BY created_at DESC LIMIT 25",params!{"id"=>&id})?;
        tx.commit()?;
        Ok((notes,actions))
    }).await{
        Ok((notes,actions))=>{data["notes"]=json!(notes.into_iter().map(|(id,staff,reason,created_at)|json!({"id":id,"staff":staff,"reason":reason,"created_at":created_at})).collect::<Vec<_>>());data["support_actions"]=json!(actions.into_iter().map(|(id,action,status,reason,completed_at)|json!({"id":id,"action":action,"status":status,"reason":reason,"completed_at":completed_at})).collect::<Vec<_>>());Json(data).into_response()},Err(err)=>control_error(err)
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Reason {
    reason: String,
}
async fn add_note(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Reason>,
) -> Response {
    if let Err(r) = require_permission(&state, &headers, "accounts:support").await {
        return r;
    }
    if !valid_id(&id) || !valid_reason(&body.reason) {
        return error(
            StatusCode::BAD_REQUEST,
            "An account ID and reason of 1–500 characters are required",
        );
    }
    let Some(digest) = token_hash(&state, &headers) else {
        return error(StatusCode::UNAUTHORIZED, "Admin session required");
    };
    let account_id = id.clone();
    match state
        .database(move |pool| read_account(pool, &account_id))
        .await
    {
        Some(Some(_)) => (),
        Some(None) => return error(StatusCode::NOT_FOUND, "Account not found"),
        None => return unavailable(),
    }
    match state.control(move|pool|{
        let mut conn=pool.get_conn()?;let mut tx=conn.start_transaction(TxOpts::default())?;
        tx.query_drop("SELECT id FROM admin_security_state WHERE id=1 FOR UPDATE")?;
        let actor=control::require_session(&mut tx,&digest,"accounts:support")?;
        let reason=body.reason.trim();
        tx.exec_drop("INSERT INTO admin_account_notes(player_id,staff_id,staff_username,reason) VALUES(:id,:staff,:username,:reason)",params!{"id"=>&id,"staff"=>actor.account_id,"username"=>&actor.username,"reason"=>reason})?;
        control::audit(&mut tx,&actor,"account.note_added",&id,"success",reason)?;tx.commit()?;Ok(())
    }).await{Ok(())=>Json(json!({"status":"saved"})).into_response(),Err(err)=>control_error(err)}
}
async fn revoke_sessions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Reason>,
) -> Response {
    if let Err(r) = require_permission(&state, &headers, "accounts:support").await {
        return r;
    }
    if !valid_id(&id) || !valid_reason(&body.reason) {
        return error(
            StatusCode::BAD_REQUEST,
            "An account ID and reason of 1–500 characters are required",
        );
    }
    let Some(digest) = token_hash(&state, &headers) else {
        return error(StatusCode::UNAUTHORIZED, "Admin session required");
    };
    let account_id = id.clone();
    match state
        .database(move |pool| read_account(pool, &account_id))
        .await
    {
        Some(Some(_)) => (),
        Some(None) => return error(StatusCode::NOT_FOUND, "Account not found"),
        None => return unavailable(),
    }
    let mut random = [0u8; 32];
    rand::rng().fill_bytes(&mut random);
    let action_id: String = random.iter().map(|b| format!("{b:02x}")).collect();
    let prepare_id = id.clone();
    let prepare_action = action_id.clone();
    // The intent and audit commit before calling the narrowly privileged game procedure.
    // A crash leaves a visible pending action; this never silently reports success.
    let actor=match state.control(move|pool|{
        let mut conn=pool.get_conn()?;let mut tx=conn.start_transaction(TxOpts::default())?;
        tx.query_drop("SELECT id FROM admin_security_state WHERE id=1 FOR UPDATE")?;
        let actor=control::require_session(&mut tx,&digest,"accounts:support")?;
        tx.exec_drop("INSERT INTO admin_support_actions(action_id,player_id,staff_id,reason,action) VALUES(:action_id,:id,:staff,:reason,'revoke_sessions')",params!{"action_id"=>&prepare_action,"id"=>&prepare_id,"staff"=>actor.account_id,"reason"=>body.reason.trim()})?;
        control::audit(&mut tx,&actor,"account.sessions_revoke_requested",&prepare_id,"pending",body.reason.trim())?;tx.commit()?;Ok(actor)
    }).await{Ok(actor)=>actor,Err(err)=>return control_error(err)};
    let target = id.clone();
    let succeeded = state
        .database(move |pool| {
            let mut conn = pool.get_conn()?;
            conn.exec_drop(
                "CALL admin_revoke_player_sessions_v1(:id)",
                params! {"id"=>&target},
            )?;
            Ok(())
        })
        .await
        .is_some();
    let status = if succeeded { "succeeded" } else { "unknown" };
    match state.control(move|pool|{
        let mut conn=pool.get_conn()?;let mut tx=conn.start_transaction(TxOpts::default())?;
        tx.exec_drop("UPDATE admin_support_actions SET status=:status,completed_at=UTC_TIMESTAMP(3) WHERE action_id=:action_id",params!{"status"=>status,"action_id"=>&action_id})?;
        control::audit(&mut tx,&actor,"account.sessions_revoked",&id,status,if succeeded{"All live sessions at execution time revoked"}else{"Procedure failed or timed out; verify sessions before retrying"})?;tx.commit()?;Ok(())
    }).await{
        Ok(())=>{let code=if succeeded{StatusCode::OK}else{StatusCode::SERVICE_UNAVAILABLE};(code,Json(json!({"status":status,"message":if succeeded{"Live sessions were revoked. The player must sign in again."}else{"The outcome is uncertain. Check the account's active sessions and audit history before retrying."}}))).into_response()},
        Err(_)=>error(StatusCode::SERVICE_UNAVAILABLE,"Action was recorded but its final audit could not be committed. Check the pending support action before retrying"),
    }
}

#[derive(Deserialize, Default)]
#[serde(deny_unknown_fields)]
struct AnalyticsQuery {
    days: Option<u64>,
}
fn days(value: Option<u64>) -> Option<u64> {
    match value.unwrap_or(30) {
        n @ (7 | 30 | 90) => Some(n),
        _ => None,
    }
}
async fn analytics(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AnalyticsQuery>,
) -> Response {
    if let Err(r) = require_permission(&state, &headers, "analytics:read").await {
        return r;
    }
    let Some(days) = days(query.days) else {
        return error(StatusCode::BAD_REQUEST, "days must be 7, 30 or 90");
    };
    match state
        .database(move |pool| analytics_report(pool, days))
        .await
    {
        Some(data) => Json(data).into_response(),
        None => unavailable(),
    }
}
fn analytics_report(pool: &Pool, days: u64) -> mysql::Result<Value> {
    let mut conn = pool.get_conn()?;
    let span = days - 1;
    let (accounts,verified,started,completed,solved):(u64,u64,u64,u64,u64)=conn.exec_first("SELECT COUNT(*),COUNT(email_verified_at),COUNT(CASE WHEN EXISTS(SELECT 1 FROM admin_reporting_case_history_v1 c WHERE c.player_id=a.player_id) THEN 1 END),COUNT(CASE WHEN EXISTS(SELECT 1 FROM admin_reporting_case_history_v1 c WHERE c.player_id=a.player_id AND c.completed_at IS NOT NULL) THEN 1 END),COUNT(CASE WHEN EXISTS(SELECT 1 FROM admin_reporting_case_history_v1 c WHERE c.player_id=a.player_id AND c.outcome='solved') THEN 1 END) FROM admin_reporting_accounts_v1 a WHERE a.created_at>=DATE_SUB(UTC_DATE(),INTERVAL :span DAY)",params!{"span"=>span})?.unwrap();
    let (dau,wau,mau):(u64,u64,u64)=conn.query_first("SELECT COUNT(DISTINCT CASE WHEN activity_date=UTC_DATE() THEN player_id END),COUNT(DISTINCT CASE WHEN activity_date>=DATE_SUB(UTC_DATE(),INTERVAL 6 DAY) THEN player_id END),COUNT(DISTINCT CASE WHEN activity_date>=DATE_SUB(UTC_DATE(),INTERVAL 29 DAY) THEN player_id END) FROM admin_reporting_activity_v1")?.unwrap();
    let outcomes:Vec<(String,u64)>=conn.exec("SELECT outcome,COUNT(*) FROM admin_reporting_case_history_v1 WHERE completed_at>=DATE_SUB(UTC_DATE(),INTERVAL :span DAY) GROUP BY outcome ORDER BY COUNT(*) DESC",params!{"span"=>span})?;
    let case_starts:Option<u64>=conn.exec_first("SELECT COUNT(*) FROM admin_reporting_case_history_v1 WHERE started_at>=DATE_SUB(UTC_DATE(),INTERVAL :span DAY)",params!{"span"=>span})?;
    let daily:Vec<(String,u64)>=conn.exec("SELECT DATE_FORMAT(activity_date,'%Y-%m-%d'),COUNT(DISTINCT player_id) FROM admin_reporting_activity_v1 WHERE activity_date>=DATE_SUB(UTC_DATE(),INTERVAL :span DAY) GROUP BY activity_date ORDER BY activity_date",params!{"span"=>span})?;
    // An eligible denominator consists only of accounts seen on their signup date, with
    // the entire requested day inside retained measurement coverage and already elapsed.
    let coverage:Option<String>=conn.query_first::<Option<String>,_>("SELECT DATE_FORMAT(MIN(DATE(first_seen_at)),'%Y-%m-%d') FROM admin_reporting_visitors_v1")?.flatten();
    let cohorts:Vec<(String,u64,u64,u64,u64,u64,u64)>=conn.exec("SELECT DATE_FORMAT(a.created_at,'%Y-%m-%d'),COUNT(*), COUNT(CASE WHEN DATE_ADD(DATE(a.created_at),INTERVAL 1 DAY)<UTC_DATE() THEN 1 END),COUNT(CASE WHEN DATE_ADD(DATE(a.created_at),INTERVAL 1 DAY)<UTC_DATE() AND EXISTS(SELECT 1 FROM admin_reporting_activity_v1 v WHERE v.player_id=a.player_id AND v.activity_date=DATE_ADD(DATE(a.created_at),INTERVAL 1 DAY)) THEN 1 END),COUNT(CASE WHEN DATE_ADD(DATE(a.created_at),INTERVAL 7 DAY)<UTC_DATE() THEN 1 END),COUNT(CASE WHEN DATE_ADD(DATE(a.created_at),INTERVAL 7 DAY)<UTC_DATE() AND EXISTS(SELECT 1 FROM admin_reporting_activity_v1 v WHERE v.player_id=a.player_id AND v.activity_date=DATE_ADD(DATE(a.created_at),INTERVAL 7 DAY)) THEN 1 END),COUNT(CASE WHEN DATE_ADD(DATE(a.created_at),INTERVAL 30 DAY)<UTC_DATE() THEN 1 END) FROM admin_reporting_accounts_v1 a WHERE a.created_at>=DATE_SUB(UTC_DATE(),INTERVAL :span DAY) AND DATE(a.created_at)>=:coverage AND EXISTS(SELECT 1 FROM admin_reporting_activity_v1 v WHERE v.player_id=a.player_id AND v.activity_date=DATE(a.created_at)) GROUP BY DATE_FORMAT(a.created_at,'%Y-%m-%d') ORDER BY DATE_FORMAT(a.created_at,'%Y-%m-%d') DESC",params!{"span"=>span,"coverage"=>coverage.as_deref().unwrap_or("9999-12-31")})?;
    let d30:Vec<(String,u64)>=conn.exec("SELECT DATE_FORMAT(a.created_at,'%Y-%m-%d'),COUNT(*) FROM admin_reporting_accounts_v1 a WHERE a.created_at>=DATE_SUB(UTC_DATE(),INTERVAL :span DAY) AND DATE(a.created_at)>=:coverage AND DATE_ADD(DATE(a.created_at),INTERVAL 30 DAY)<UTC_DATE() AND EXISTS(SELECT 1 FROM admin_reporting_activity_v1 v WHERE v.player_id=a.player_id AND v.activity_date=DATE(a.created_at)) AND EXISTS(SELECT 1 FROM admin_reporting_activity_v1 v WHERE v.player_id=a.player_id AND v.activity_date=DATE_ADD(DATE(a.created_at),INTERVAL 30 DAY)) GROUP BY DATE_FORMAT(a.created_at,'%Y-%m-%d')",params!{"span"=>span,"coverage"=>coverage.as_deref().unwrap_or("9999-12-31")})?;
    let d30: HashMap<_, _> = d30.into_iter().collect();
    Ok(
        json!({"generated_at":reports::now(),"period_days":days,"activation":{"accounts_created":accounts,"email_verified":verified,"started_case":started,"completed_case":completed,"solved_case":solved},"activity":{"dau":dau,"wau":wau,"mau":mau,"coverage_started_at":coverage,"scope":"Consenting signed-in accounts only; calendar days in UTC; retained for 90 days"},"case_starts":case_starts,"case_outcomes":outcomes.into_iter().map(|(outcome,count)|json!({"outcome":outcome,"count":count})).collect::<Vec<_>>(),"daily_activity":daily.into_iter().map(|(date,accounts)|json!({"date":date,"accounts":accounts})).collect::<Vec<_>>(),"retention":cohorts.into_iter().map(|(date,cohort,d1n,d1,d7n,d7,d30n)|json!({"date":date,"cohort":cohort,"day1_eligible":d1n,"day1_returned":d1,"day7_eligible":d7n,"day7_returned":d7,"day30_eligible":d30n,"day30_returned":d30.get(&date).copied().unwrap_or(0)})).collect::<Vec<_>>(),"definitions":{"activation":"Accounts created in the selected period, followed through all retained case history as of now. Each step counts distinct accounts; steps are not a strict sequence.","case_outcomes":"Cases closed during the selected period, including unsuccessful outcomes. Case starts are counted separately; these are not the same cohort.","retention":"Exact calendar-day return among accounts with a consented visit on signup day; only elapsed complete days are eligible. Declined/withdrawn measurement and retention cleanup reduce coverage."}}),
    )
}

#[derive(Deserialize, Default)]
#[serde(deny_unknown_fields)]
struct ModerationQuery {
    status: Option<String>,
    page: Option<u64>,
    page_size: Option<u64>,
}
async fn moderation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ModerationQuery>,
) -> Response {
    if let Err(r) = require_permission(&state, &headers, "moderation:read").await {
        return r;
    }
    let status = query.status.unwrap_or_else(|| "open".into());
    if !matches!(status.as_str(), "open" | "resolved" | "all") {
        return error(
            StatusCode::BAD_REQUEST,
            "status must be open, resolved or all",
        );
    }
    let Some((page, size)) = pagination(query.page, query.page_size) else {
        return error(StatusCode::BAD_REQUEST, "Invalid pagination");
    };
    if let Err(r) = audit_read(
        &state,
        &headers,
        "moderation:read",
        "moderation.viewed",
        "reports",
    )
    .await
    {
        return r;
    }
    // Bound the compatibility bridge between independently owned schemas. Only IDs
    // and workflow states cross into reporting SQL; reasons are fetched for this page.
    let decisions = match state
        .control(|pool| {
            let mut conn = pool.get_conn()?;
            let rows: Vec<(String, String)> = conn
                .query("SELECT report_id,decision FROM admin_moderation_decisions LIMIT 10001")?;
            Ok(rows)
        })
        .await
    {
        Ok(rows) => rows,
        Err(e) => return control_error(e),
    };
    if decisions.len() > 10_000 {
        return error(
            StatusCode::SERVICE_UNAVAILABLE,
            "The moderation decision index exceeds this release's 10000-record limit. Configure archival or upgrade the reporting index before continuing",
        );
    }
    let decision_json = serde_json::to_string(
        &decisions
            .iter()
            .map(|(id, decision)| json!({"report_id":id,"decision":decision}))
            .collect::<Vec<_>>(),
    )
    .expect("JSON records");
    let decisions: HashMap<_, _> = decisions.into_iter().collect();
    let data=state.database(move|pool|{
        let mut conn=pool.get_conn()?;
        let base="FROM admin_reporting_moderation_v1 r LEFT JOIN JSON_TABLE(:decisions, '$[*]' COLUMNS(report_id VARCHAR(36) PATH '$.report_id', decision VARCHAR(32) PATH '$.decision')) d ON d.report_id=r.report_id";
        let closed="(COALESCE(d.decision,'') IN ('resolved','dismissed') OR r.source_status IN ('resolved','dismissed'))";
        let filter=match status.as_str(){"open"=>format!("WHERE NOT {closed}"),"resolved"=>format!("WHERE {closed}"),_=>String::new()};
        let total:Option<u64>=conn.exec_first(format!("SELECT COUNT(*) {base} {filter}"),params!{"decisions"=>&decision_json})?;
        let rows:Vec<Row>=conn.exec(format!("SELECT r.report_id,r.reporter_id,r.reporter_username,r.reported_id,r.reported_username,r.category,r.details,r.source_status,DATE_FORMAT(r.created_at,'%Y-%m-%dT%H:%i:%sZ') AS created_at {base} {filter} ORDER BY r.created_at DESC,r.report_id LIMIT :size OFFSET :offset"),params!{"decisions"=>&decision_json,"size"=>size,"offset"=>(page-1)*size})?;
        let items:Vec<Value>=rows.into_iter().map(|r|{
            let id=text(&r,"report_id").expect("report ID is non-null");let decision=decisions.get(&id);let source=text(&r,"source_status");
            let closed=decision.is_some_and(|d|matches!(d.as_str(),"resolved"|"dismissed"))||matches!(source.as_deref(),Some("resolved"|"dismissed"));
            let status=if closed{"resolved"}else if decision.is_some(){"escalated"}else{"open"};
            json!({"report_id":id,"reporter_id":text(&r,"reporter_id"),"reporter_username":text(&r,"reporter_username"),"reported_id":text(&r,"reported_id"),"reported_username":text(&r,"reported_username"),"category":text(&r,"category"),"details":text(&r,"details"),"source_status":source,"status":status,"created_at":text(&r,"created_at"),"resolution":null})
        }).collect();
        Ok(json!({"generated_at":reports::now(),"page":page,"page_size":size,"total":total,"items":items}))
    }).await;
    let Some(mut data) = data else {
        return unavailable();
    };
    let ids: Vec<String> = data["items"]
        .as_array()
        .expect("report list")
        .iter()
        .map(|item| item["report_id"].as_str().expect("report ID").to_owned())
        .collect();
    if ids.is_empty() {
        return Json(data).into_response();
    }
    let resolutions=match state.control(move|pool|{
        let mut conn=pool.get_conn()?;let placeholders=vec!["?";ids.len()].join(",");
        let values:Vec<mysql::Value>=ids.iter().map(|id|id.as_str().into()).collect();
        let rows:Vec<(String,String,String,String,String)>=conn.exec(format!("SELECT report_id,decision,reason,staff_username,DATE_FORMAT(updated_at,'%Y-%m-%dT%H:%i:%sZ') FROM admin_moderation_decisions WHERE report_id IN ({placeholders})"),values)?;
        Ok(rows.into_iter().map(|(id,decision,reason,staff,at)|(id.clone(),json!({"report_id":id,"decision":decision,"reason":reason,"staff":staff,"updated_at":at}))).collect::<HashMap<_,_>>())
    }).await{Ok(rows)=>rows,Err(err)=>return control_error(err)};
    for item in data["items"].as_array_mut().expect("report list") {
        if let Some(resolution) = resolutions.get(item["report_id"].as_str().expect("report ID")) {
            item["resolution"] = resolution.clone();
        }
    }
    Json(data).into_response()
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Resolution {
    decision: String,
    reason: String,
}
async fn resolve(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Resolution>,
) -> Response {
    if let Err(r) = require_permission(&state, &headers, "moderation:resolve").await {
        return r;
    }
    if !valid_id(&id)
        || id.len() != 36
        || !matches!(
            body.decision.as_str(),
            "resolved" | "dismissed" | "escalated"
        )
        || !valid_reason(&body.reason)
    {
        return error(
            StatusCode::BAD_REQUEST,
            "A report ID, decision and reason of 1–500 characters are required",
        );
    }
    let check_id = id.clone();
    match state
        .database(move |pool| {
            let mut conn = pool.get_conn()?;
            let status: Option<String> = conn.exec_first(
                "SELECT source_status FROM admin_reporting_moderation_v1 WHERE report_id=:id",
                params! {"id"=>check_id},
            )?;
            Ok(status)
        })
        .await
    {
        Some(Some(status)) if matches!(status.as_str(), "resolved" | "dismissed") => {
            return error(
                StatusCode::CONFLICT,
                "This report already has a final source decision",
            );
        }
        Some(Some(_)) => (),
        Some(None) => return error(StatusCode::NOT_FOUND, "Report not found"),
        None => return unavailable(),
    }
    let Some(digest) = token_hash(&state, &headers) else {
        return error(StatusCode::UNAUTHORIZED, "Admin session required");
    };
    match state.control(move|pool|{
        let mut conn=pool.get_conn()?;let mut tx=conn.start_transaction(TxOpts::default())?;tx.query_drop("SELECT id FROM admin_security_state WHERE id=1 FOR UPDATE")?;let actor=control::require_session(&mut tx,&digest,"moderation:resolve")?;
        let exists:Option<String>=tx.exec_first("SELECT decision FROM admin_moderation_decisions WHERE report_id=:id FOR UPDATE",params!{"id"=>&id})?;
        if exists.as_deref().is_some_and(|decision|decision!="escalated"){return Err(control::Error::Conflict("This report already has a final decision; refresh the queue"))}
        tx.exec_drop("INSERT INTO admin_moderation_decisions(report_id,decision,reason,staff_id,staff_username) VALUES(:id,:decision,:reason,:staff,:username) ON DUPLICATE KEY UPDATE decision=VALUES(decision),reason=VALUES(reason),staff_id=VALUES(staff_id),staff_username=VALUES(staff_username)",params!{"id"=>&id,"decision"=>&body.decision,"reason"=>body.reason.trim(),"staff"=>actor.account_id,"username"=>&actor.username})?;
        control::audit(&mut tx,&actor,"moderation.decided",&id,&body.decision,body.reason.trim())?;tx.commit()?;Ok(())
    }).await{Ok(())=>Json(json!({"status":"saved"})).into_response(),Err(err)=>control_error(err)}
}

#[derive(Clone, Debug)]
struct Sample {
    process_started: f64,
    requests: u64,
    errors: u64,
    duration_seconds: f64,
}
fn parse_metrics(input: &str) -> Option<(Sample, Option<u64>)> {
    let mut values = HashMap::new();
    let mut errors = 0u64;
    let mut durations = 0.;
    let mut responses = 0u64;
    let mut has_responses = false;
    let mut has_durations = false;
    for line in input.lines() {
        let mut parts = line.split_whitespace();
        let Some(name) = parts.next() else { continue };
        let Some(value) = parts
            .next()
            .and_then(|v| v.parse::<f64>().ok())
            .filter(|v| v.is_finite() && *v >= 0.)
        else {
            continue;
        };
        if !name.contains('{') {
            values.insert(name, value);
        }
        if name.starts_with("naijachase_http_responses_total{") {
            responses = responses.saturating_add(value as u64);
            has_responses = true;
            if name.contains("status=\"5") {
                errors = errors.saturating_add(value as u64)
            }
        }
        if name.starts_with("naijachase_http_request_duration_seconds_sum{") {
            durations += value;
            has_durations = true;
        }
    }
    if !has_responses || !has_durations || !durations.is_finite() {
        return None;
    }
    Some((
        Sample {
            process_started: *values.get("process_start_time_seconds")?,
            requests: responses,
            errors,
            duration_seconds: durations,
        },
        values
            .get("naijachase_weekly_job_last_success_unix_seconds")
            .map(|v| *v as u64),
    ))
}
fn alert(key: &str, severity: &str, title: &str, message: String, value: Value) -> Value {
    json!({"key":key,"severity":severity,"title":title,"message":message,"value":value})
}
fn sample_alerts(
    current: &Sample,
    previous: Option<(f64, u64, u64, f64)>,
    elapsed: Option<u64>,
) -> Vec<Value> {
    let Some((started, requests, errors, duration)) = previous else {
        return vec![alert(
            "api_errors",
            "unknown",
            "API errors and latency",
            "Collecting a second sample; counters reset whenever the game API restarts.".into(),
            Value::Null,
        )];
    };
    if started != current.process_started
        || requests > current.requests
        || errors > current.errors
        || duration > current.duration_seconds
    {
        return vec![alert(
            "api_errors",
            "unknown",
            "API errors and latency",
            "The API restarted or its counters reset; collecting a new baseline.".into(),
            Value::Null,
        )];
    }
    let requests = current.requests - requests;
    let errors = current.errors - errors;
    let mean = if requests > 0 {
        Some((current.duration_seconds - duration) / (requests as f64))
    } else {
        None
    };
    let rate = if requests > 0 {
        errors as f64 / requests as f64
    } else {
        0.
    };
    vec![
        alert(
            "api_errors",
            if errors >= 5 && rate >= 0.05 {
                "critical"
            } else if errors > 0 {
                "warning"
            } else {
                "healthy"
            },
            "API server errors",
            format!(
                "{errors} server errors in {requests} responses over {} seconds; critical at ≥5 errors and ≥5% of responses.",
                elapsed.unwrap_or(0)
            ),
            json!({"errors":errors,"responses":requests,"error_rate":rate,"window_seconds":elapsed}),
        ),
        alert(
            "api_latency",
            if mean.is_some_and(|v| v >= 2.) {
                "warning"
            } else {
                "healthy"
            },
            "API response time",
            mean.map(|v| {
                format!(
                    "Mean response time {v:.3}s; warning at 2s. This is a mean, not a percentile."
                )
            })
            .unwrap_or_else(|| "No completed responses in this sample window.".into()),
            json!({"mean_seconds":mean}),
        ),
    ]
}
fn weekly_alert(sample: &Sample, last_success: Option<u64>, now: i64) -> Value {
    let uptime = now.saturating_sub(sample.process_started as i64);
    let age = last_success
        .filter(|v| *v > 0)
        .map(|v| now.saturating_sub(v as i64));
    let severity = match (last_success, age) {
        (_, Some(age)) if age < -300 => "unknown",
        (_, Some(age)) if age > 600 => "critical",
        (_, Some(_)) => "healthy",
        (Some(0), None) if uptime > 600 => "critical",
        _ => "unknown",
    };
    let message = match age {
        Some(age) if age < -300 => {
            "The job success time is in the future; check the API host clock.".to_owned()
        }
        Some(age) => format!(
            "Last successful run {age} seconds ago; critical after 10 minutes. Scheduler metrics restart with the API process."
        ),
        None if last_success == Some(0) => format!(
            "No successful run has been reported since this API process started {uptime} seconds ago; critical after 10 minutes."
        ),
        None => {
            "The API did not report the scheduled job's last success metric. Job health is unknown."
                .to_owned()
        }
    };
    alert(
        "weekly_job",
        severity,
        "Weekly expiry job",
        message,
        json!({"age_seconds":age,"api_uptime_seconds":uptime.max(0)}),
    )
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct BackupStatus {
    last_success_at: String,
}
fn backup_alert(path: Option<&std::path::Path>, max_age: u64) -> Value {
    let Some(path) = path else {
        return alert(
            "backups",
            "not_configured",
            "Backup freshness",
            "Set ADMIN_BACKUP_STATUS_PATH to a backup job's local success record.".into(),
            Value::Null,
        );
    };
    let metadata = std::fs::metadata(path)
        .ok()
        .filter(|m| m.is_file() && m.len() <= 16_384);
    if metadata.is_none() {
        return alert("backups","critical","Backup freshness","The configured backup success record must be a readable regular JSON file no larger than 16 KiB.".into(),Value::Null);
    }
    let content = std::fs::File::open(path).and_then(|file| {
        use std::io::Read;
        let mut bytes = Vec::new();
        file.take(16_385).read_to_end(&mut bytes)?;
        Ok(bytes)
    });
    let at = content
        .ok()
        .filter(|bytes| bytes.len() <= 16_384)
        .and_then(|bytes| serde_json::from_slice::<BackupStatus>(&bytes).ok())
        .and_then(|status| chrono::DateTime::parse_from_rfc3339(&status.last_success_at).ok());
    let Some(at) = at else {
        return alert(
            "backups",
            "critical",
            "Backup freshness",
            "The configured backup success record is missing, unreadable or invalid.".into(),
            Value::Null,
        );
    };
    let age = Utc::now().timestamp() - at.timestamp();
    if age < -300 {
        return alert(
            "backups",
            "critical",
            "Backup freshness",
            "Backup success time is in the future; check the record and host clocks.".into(),
            Value::Null,
        );
    }
    alert(
        "backups",
        if age > max_age as i64 * 3600 {
            "critical"
        } else {
            "healthy"
        },
        "Backup freshness",
        format!(
            "Last reported successful backup: {}. Maximum age: {max_age} hours. This checks the job's record; restore testing remains separate.",
            at.to_rfc3339()
        ),
        json!({"last_success_at":at.to_rfc3339(),"age_seconds":age.max(0),"max_age_hours":max_age}),
    )
}
async fn alerts(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = require_permission(&state, &headers, "alerts:read").await {
        return r;
    }
    let mut items = vec![];
    let email=state.database(|pool|{
        let mut conn=pool.get_conn()?;
        let row:Option<(u64,u64,u64,Option<u64>)>=conn.query_first("SELECT COUNT(CASE WHEN status IN ('dead','failed') THEN 1 END),COUNT(CASE WHEN status='queued' THEN 1 END),COUNT(CASE WHEN status='sending' AND (locked_at IS NULL OR locked_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 10 MINUTE)) THEN 1 END),MAX(CASE WHEN status IN ('queued','sending') THEN TIMESTAMPDIFF(SECOND,created_at,UTC_TIMESTAMP()) END) FROM admin_reporting_email_health_v1")?;Ok(row.unwrap())
    }).await;
    match email {
        Some((failed, queued, stuck, oldest)) => {
            items.push(alert("email_failures",if failed>0{"warning"}else{"healthy"},"Email delivery failures",format!("{failed} permanently failed messages are retained in the outbox. Review delivery provider logs before retrying."),json!(failed)));
            items.push(alert("email_backlog",if stuck>0||oldest.is_some_and(|s|s>3600){"critical"}else if oldest.is_some_and(|s|s>900){"warning"}else{"healthy"},"Email queue progress",format!("{queued} queued; {stuck} sending for over 10 minutes. Oldest pending: {} seconds; warning at 15 minutes, critical at 1 hour.",oldest.unwrap_or(0)),json!({"queued":queued,"stalled":stuck,"oldest_pending_seconds":oldest})))
        }
        None => items.push(alert(
            "email_queue",
            "unknown",
            "Email delivery",
            "The reporting database could not provide email queue health.".into(),
            Value::Null,
        )),
    }
    if state.config.game_health_enabled {
        let metrics = async {
            let mut response = state
                .client
                .get("http://127.0.0.1:8080/metrics")
                .send()
                .await
                .ok()?;
            if !response.status().is_success() {
                return None;
            }
            let mut bytes = Vec::new();
            while let Some(chunk) = response.chunk().await.ok()? {
                if bytes.len() + chunk.len() > 262_144 {
                    return None;
                }
                bytes.extend_from_slice(&chunk)
            }
            parse_metrics(std::str::from_utf8(&bytes).ok()?)
        }
        .await;
        if let Some((sample, weekly)) = metrics {
            let copy = sample.clone();
            let comparison=state.control(move|pool|{
                let mut conn=pool.get_conn()?;let mut tx=conn.start_transaction(TxOpts::default())?;
                let previous:Option<(f64,u64,u64,f64,u64)>=tx.query_first("SELECT process_started,requests,errors,duration_seconds,TIMESTAMPDIFF(SECOND,collected_at,UTC_TIMESTAMP(3)) FROM admin_alert_samples WHERE collected_at<=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 10 SECOND) ORDER BY sample_id DESC LIMIT 1")?;
                tx.exec_drop("INSERT INTO admin_alert_samples(process_started,requests,errors,duration_seconds) SELECT :started,:requests,:errors,:duration WHERE NOT EXISTS(SELECT 1 FROM admin_alert_samples WHERE collected_at>=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 10 SECOND))",params!{"started"=>copy.process_started,"requests"=>copy.requests,"errors"=>copy.errors,"duration"=>copy.duration_seconds})?;
                tx.query_drop("DELETE FROM admin_alert_samples WHERE collected_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 DAY)")?;tx.commit()?;Ok(previous)
            }).await;
            match comparison {
                Ok(previous) => {
                    let age = previous.as_ref().map(|p| p.4);
                    items.extend(sample_alerts(
                        &sample,
                        previous.map(|p| (p.0, p.1, p.2, p.3)),
                        age,
                    ));
                }
                Err(_) => items.push(alert(
                    "api_errors",
                    "unknown",
                    "API errors and latency",
                    "The admin database could not store or compare metric samples.".into(),
                    Value::Null,
                )),
            }
            items.push(weekly_alert(&sample, weekly, Utc::now().timestamp()));
        } else {
            items.push(alert("game_metrics","critical","Application metrics","The fixed local API metrics endpoint is unreachable or returned incomplete metrics.".into(),Value::Null))
        }
    } else {
        items.push(alert("game_metrics","not_configured","Application metrics","Enable ADMIN_GAME_HEALTH_ENABLED on the host running the game API to measure server errors, latency and scheduled job progress.".into(),Value::Null))
    }
    items.push(backup_alert(
        state.config.backup_status_path.as_deref(),
        state.config.backup_max_age_hours,
    ));
    let host = crate::system::collect(&state.config.disk_path);
    for (key, title, total, free) in [
        (
            "disk",
            "Disk capacity",
            host.disk_total_bytes,
            host.disk_available_bytes,
        ),
        (
            "memory",
            "Available memory",
            host.memory_total_bytes,
            host.memory_available_bytes,
        ),
    ] {
        let fraction = total
            .zip(free)
            .filter(|(t, _)| *t > 0)
            .map(|(t, f)| f as f64 / t as f64);
        items.push(alert(
            key,
            match fraction {
                Some(f) if f < 0.05 => "critical",
                Some(f) if f < 0.10 => "warning",
                Some(_) => "healthy",
                None => "unknown",
            },
            title,
            "Warning below 10% available; critical below 5% available on the admin host.".into(),
            json!({"available_fraction":fraction}),
        ))
    }
    Json(json!({"generated_at":reports::now(),"scope":"Live checks on the admin host; evaluated when this page refreshes. No external notification delivery is configured.","items":items})).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn literal_search_and_input_bounds() {
        assert_eq!(prefix_search("a%_=b"), "a=%=_==b%");
        assert!(!valid_id("../a"));
        assert!(!valid_id("a'b"));
        assert!(valid_id("player-123_test"));
        assert!(!valid_reason(" \n"));
        assert!(!valid_reason(&"a".repeat(501)));
        assert!(pagination(Some(0), None).is_none());
        assert_eq!(days(Some(90)), Some(90));
        assert_eq!(days(Some(365)), None);
    }
    #[test]
    fn metrics_parse_status_labels_and_counter_resets() {
        let metrics = "process_start_time_seconds 100\nnaijachase_http_responses_total{method=\"GET\",route=\"/\",status=\"200\"} 90\nnaijachase_http_responses_total{status=\"500\"} 10\nnaijachase_http_request_duration_seconds_sum{status=\"200\"} 10.5\nnaijachase_weekly_job_last_success_unix_seconds 123\n";
        let (s, w) = parse_metrics(metrics).unwrap();
        assert_eq!(s.requests, 100);
        assert_eq!(s.errors, 10);
        assert_eq!(w, Some(123));
        assert_eq!(
            sample_alerts(&s, Some((100., 0, 0, 0.)), Some(30))[0]["severity"],
            "critical"
        );
        assert_eq!(
            sample_alerts(&s, Some((99., 0, 0, 0.)), Some(30))[0]["severity"],
            "unknown"
        );
        assert!(parse_metrics("process_start_time_seconds NaN").is_none());
    }
    #[test]
    fn backup_unknown_and_missing_are_never_healthy() {
        assert_eq!(backup_alert(None, 24)["severity"], "not_configured");
        assert_eq!(
            backup_alert(
                Some(std::path::Path::new("/nonexistent/admin-backup.json")),
                24
            )["severity"],
            "critical"
        );
    }
    #[test]
    fn backup_fresh_stale_future_and_malformed_records() {
        let path = std::env::temp_dir().join(format!(
            "nc-admin-backup-{}-{}.json",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap()
        ));
        for (offset, severity) in [(0, "healthy"), (-26 * 3600, "critical"), (600, "critical")] {
            let timestamp = (Utc::now() + chrono::Duration::seconds(offset)).to_rfc3339();
            std::fs::write(
                &path,
                serde_json::to_vec(&json!({"last_success_at":timestamp})).unwrap(),
            )
            .unwrap();
            assert_eq!(backup_alert(Some(&path), 24)["severity"], severity);
        }
        std::fs::write(&path, b"{broken").unwrap();
        assert_eq!(backup_alert(Some(&path), 24)["severity"], "critical");
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    #[ignore = "read-only queries require ADMIN_TEST_REPORTING_URL on an explicit local test schema"]
    fn mysql_reporting_queries_use_versioned_contracts() {
        let url = std::env::var("ADMIN_TEST_REPORTING_URL").expect("explicit test URL");
        let opts = mysql::Opts::from_url(&url).expect("test URL");
        assert!(matches!(
            opts.get_ip_or_hostname().as_ref(),
            "127.0.0.1" | "localhost" | "::1"
        ));
        assert!(
            opts.get_db_name()
                .is_some_and(|name| name.ends_with("_test") || name.starts_with("nc_admin_test_"))
        );
        let pool = Pool::new(opts).expect("test reporting pool");
        reporting_ready(&pool).expect("all operation views and procedure accessible");
        for period in [7, 30, 90] {
            let data =
                analytics_report(&pool, period).expect("activation/activity/outcome/retention SQL");
            for step in [
                "email_verified",
                "started_case",
                "completed_case",
                "solved_case",
            ] {
                assert!(
                    data["activation"][step].as_u64().unwrap()
                        <= data["activation"]["accounts_created"].as_u64().unwrap()
                );
            }
            for row in data["retention"].as_array().unwrap() {
                for day in [1, 7, 30] {
                    assert!(
                        row[format!("day{day}_returned")].as_u64().unwrap()
                            <= row[format!("day{day}_eligible")].as_u64().unwrap()
                    );
                }
            }
        }
        let mut conn = pool.get_conn().unwrap();
        let id: Option<String> = conn
            .query_first("SELECT player_id FROM admin_reporting_account_progress_v1 LIMIT 1")
            .unwrap();
        if let Some(id) = id {
            let details = read_account(&pool, &id)
                .expect("support lookup SQL")
                .expect("existing account");
            assert_eq!(details["account"]["player_id"], id);
            assert!(details["cases"].as_array().unwrap().len() <= 25);
        }
        assert!(
            read_account(&pool, "missing-account-in-operation-test")
                .unwrap()
                .is_none()
        );
    }
    #[test]
    fn jobs_never_succeeding_become_critical_and_missing_metrics_stay_unknown() {
        let sample = Sample {
            process_started: 100.,
            requests: 1,
            errors: 0,
            duration_seconds: 0.,
        };
        assert_eq!(weekly_alert(&sample, Some(0), 200)["severity"], "unknown");
        assert_eq!(weekly_alert(&sample, Some(0), 1000)["severity"], "critical");
        assert_eq!(weekly_alert(&sample, None, 1000)["severity"], "unknown");
        assert_eq!(
            weekly_alert(&sample, Some(990), 1000)["severity"],
            "healthy"
        );
        assert_eq!(
            weekly_alert(&sample, Some(110), 1000)["severity"],
            "critical"
        );
        assert_eq!(
            weekly_alert(&sample, Some(1400), 1000)["severity"],
            "unknown"
        );
    }
}
