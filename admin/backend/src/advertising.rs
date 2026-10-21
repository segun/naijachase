//! Contextual scenery advertising. Public output contains only active bookings.
//! Images are decoded with bounded allocation and re-encoded; never fetch advertiser URLs.
use crate::{AppState, control, control_error, require_permission, token_hash};
use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Path, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    routing::get,
};
use base64::{Engine, engine::general_purpose::STANDARD};
use mysql::{Pool, TxOpts, params, prelude::Queryable};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::io::Cursor;

const CATALOGUE: &str = include_str!("../../../shared/ad-placements.json");
const MAX_UPLOAD: usize = 2 * 1024 * 1024;

#[derive(Clone, Deserialize, Serialize)]
pub(crate) struct Placement {
    id: String,
    scene: String,
    label: String,
    surface: String,
    segment: String,
    width: u32,
    height: u32,
}
fn placements() -> Vec<Placement> {
    serde_json::from_str(CATALOGUE).expect("release placement catalogue")
}

pub(crate) fn routes() -> Router<AppState> {
    Router::new()
        .merge(crate::ad_analytics::routes())
        .route("/admin-api/v1/ads", get(list).post(save))
        .route("/admin-api/v1/ads/creatives/{id}", get(preview))
        .layer(DefaultBodyLimit::max(3 * 1024 * 1024))
        .route("/ads-api/v1/manifest", get(manifest))
        .route("/ads-api/v1/images/{id}", get(public_image))
}

pub(crate) fn ready(pool: &Pool) -> control::Result<()> {
    let count: u64 = pool
        .get_conn()?
        .query_first("SELECT COUNT(*) FROM ad_placements")?
        .unwrap_or(0);
    if count != placements().len() as u64 {
        return Err(control::Error::Database);
    }
    pool.get_conn()?
        .query_drop("SELECT id FROM ad_events LIMIT 0")?;
    Ok(())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {
    id: Option<u64>,
    revision: Option<u32>,
    advertiser: String,
    contact: String,
    name: String,
    placement_id: String,
    status: String,
    starts_at: i64,
    ends_at: i64,
    alt_text: String,
    destination: String,
    /// Base64 bytes only, no data-URL prefix. Omit to retain an existing creative.
    image: Option<String>,
}

fn validate(input: &Input) -> control::Result<Placement> {
    let invalid = control::Error::Invalid;
    for (s, limit) in [
        (&input.advertiser, 160),
        (&input.name, 160),
        (&input.alt_text, 240),
    ] {
        if s.trim().is_empty() || s.chars().count() > limit {
            return Err(invalid(
                "Company, campaign and image description are required and must fit their limits",
            ));
        }
    }
    if input.contact.chars().count() > 254 {
        return Err(invalid("Contact is too long"));
    }
    let url = reqwest::Url::parse(&input.destination)
        .map_err(|_| invalid("Enter a valid HTTPS destination"))?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || input.destination.len() > 2048
    {
        return Err(invalid(
            "Use an HTTPS destination without embedded credentials",
        ));
    }
    if !matches!(input.status.as_str(), "draft" | "live" | "paused") {
        return Err(invalid("Unknown campaign status"));
    }
    if input.starts_at < 0
        || input.ends_at <= input.starts_at
        || input.ends_at - input.starts_at > 366 * 86400
        || input.ends_at > 4_102_444_800
    {
        return Err(invalid(
            "Choose a positive schedule of at most 366 days, before 2100",
        ));
    }
    if input.status == "live" && input.ends_at <= chrono::Utc::now().timestamp() {
        return Err(invalid("A live campaign must end in the future"));
    }
    if input.id.is_none() && input.image.is_none() {
        return Err(invalid("Upload an image for the new campaign"));
    }
    placements()
        .into_iter()
        .find(|p| p.id == input.placement_id)
        .ok_or(invalid("Unknown ad placement"))
}

fn decode_image(encoded: &str, placement: &Placement) -> control::Result<(Vec<u8>, u32, u32)> {
    let invalid = control::Error::Invalid;
    if encoded.len() > MAX_UPLOAD * 4 / 3 + 8 {
        return Err(invalid("Upload an image under 2 MB"));
    }
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| invalid("Invalid image encoding"))?;
    if bytes.len() > MAX_UPLOAD {
        return Err(invalid("Upload an image under 2 MB"));
    }
    let mut reader = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| invalid("Unreadable image"))?;
    if !matches!(
        reader.format(),
        Some(image::ImageFormat::Png | image::ImageFormat::Jpeg | image::ImageFormat::WebP)
    ) {
        return Err(invalid("Use PNG, JPEG or WebP"));
    }
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(4096);
    limits.max_image_height = Some(4096);
    limits.max_alloc = Some(64 * 1024 * 1024);
    reader.limits(limits);
    let image = reader
        .decode()
        .map_err(|_| invalid("Image cannot be decoded or exceeds 4096 pixels"))?;
    let (w, h) = (image.width(), image.height());
    if w < 240
        || h < 120
        || ((w as f64 / h as f64) / (placement.width as f64 / placement.height as f64) - 1.0).abs()
            > 0.03
    {
        return Err(invalid(
            "Image must match the placement aspect ratio (within 3%) and be at least 240 × 120",
        ));
    }
    let image = if w > 1600 || h > 1600 {
        image.thumbnail(1600, 1600)
    } else {
        image
    };
    let (w, h) = (image.width(), image.height());
    let mut output = Cursor::new(Vec::new());
    image
        .write_to(&mut output, image::ImageFormat::Png)
        .map_err(|_| invalid("Unable to prepare image"))?;
    if output.get_ref().len() > 8 * 1024 * 1024 {
        return Err(invalid("Prepared image is too large"));
    }
    Ok((output.into_inner(), w, h))
}

fn conflicts(a: &Placement, b: &Placement) -> bool {
    a.surface == b.surface
        && (a.segment == "whole" || b.segment == "whole" || a.segment == b.segment)
}

fn save_campaign(pool: &Pool, digest: [u8; 32], input: Input) -> control::Result<Value> {
    let placement = validate(&input)?;
    let prepared = input
        .image
        .as_deref()
        .map(|data| decode_image(data, &placement))
        .transpose()?;
    let mut conn = pool.get_conn()?;
    let mut tx = conn.start_transaction(TxOpts::default())?;
    let actor = control::require_session(&mut tx, &digest, "ads:manage")?;
    // One lock serializes booking/edit decisions across instances and whole/split slots.
    let lock: Option<u8> =
        tx.query_first("SELECT id FROM ad_inventory_lock WHERE id=1 FOR UPDATE")?;
    if lock.is_none() {
        return Err(control::Error::Database);
    }
    let old: Option<(u64, u32, u64)> = if let Some(id) = input.id {
        tx.exec_first("SELECT c.advertiser_id,c.revision,b.creative_id FROM ad_campaigns c JOIN ad_bookings b ON b.campaign_id=c.id WHERE c.id=? FOR UPDATE",(id,))?
    } else {
        None
    };
    if input.id.is_some() && old.is_none() {
        return Err(control::Error::NotFound);
    }
    if old
        .as_ref()
        .is_some_and(|(_, revision, _)| Some(*revision) != input.revision)
    {
        return Err(control::Error::Conflict(
            "This campaign changed. Refresh before saving",
        ));
    }
    if input.status == "live" {
        // Current read: require_session may have opened a REPEATABLE READ snapshot
        // before waiting for the inventory lock. FOR UPDATE sees the previous writer.
        let booked: Vec<String> = tx.exec("SELECT b.placement_id FROM ad_bookings b JOIN ad_campaigns c ON c.id=b.campaign_id WHERE c.status='live' AND b.starts_at < :end AND b.ends_at > :start AND c.id <> :id FOR UPDATE",params!{"end"=>input.ends_at,"start"=>input.starts_at,"id"=>input.id.unwrap_or(0)})?;
        if placements()
            .iter()
            .any(|p| booked.contains(&p.id) && conflicts(&placement, p))
        {
            return Err(control::Error::Conflict(
                "This wall or slot is already booked during that period",
            ));
        }
    }
    // Keep immutable creatives; replacement never changes an image already in browser caches.
    let (bytes, w, h) = match prepared {
        Some(image) => image,
        None => {
            let creative = old
                .as_ref()
                .ok_or(control::Error::Invalid("Image required"))?
                .2;
            let row: (Vec<u8>, u32, u32) = tx
                .exec_first(
                    "SELECT image,width,height FROM ad_creatives WHERE id=?",
                    (creative,),
                )?
                .ok_or(control::Error::NotFound)?;
            if ((row.1 as f64 / row.2 as f64) / (placement.width as f64 / placement.height as f64)
                - 1.0)
                .abs()
                > 0.03
            {
                return Err(control::Error::Invalid(
                    "Upload a matching image for the new placement",
                ));
            }
            row
        }
    };
    let advertiser = if let Some((id, _, _)) = old {
        tx.exec_drop(
            "UPDATE ad_advertisers SET name=?,contact=? WHERE id=?",
            (&input.advertiser, &input.contact, id),
        )?;
        id
    } else {
        tx.exec_drop(
            "INSERT INTO ad_advertisers (name,contact) VALUES (?,?)",
            (&input.advertiser, &input.contact),
        )?;
        tx.last_insert_id().ok_or(control::Error::Database)?
    };
    tx.exec_drop("INSERT INTO ad_creatives (advertiser_id,alt_text,destination,width,height,image) VALUES (?,?,?,?,?,?)",(advertiser,&input.alt_text,&input.destination,w,h,bytes))?;
    let creative = tx.last_insert_id().ok_or(control::Error::Database)?;
    let id = if let Some(id) = input.id {
        tx.exec_drop(
            "UPDATE ad_campaigns SET name=?,status=?,revision=revision+1 WHERE id=?",
            (&input.name, &input.status, id),
        )?;
        id
    } else {
        tx.exec_drop(
            "INSERT INTO ad_campaigns (advertiser_id,name,status) VALUES (?,?,?)",
            (advertiser, &input.name, &input.status),
        )?;
        tx.last_insert_id().ok_or(control::Error::Database)?
    };
    tx.exec_drop("INSERT INTO ad_bookings (campaign_id,placement_id,creative_id,starts_at,ends_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE placement_id=VALUES(placement_id),creative_id=VALUES(creative_id),starts_at=VALUES(starts_at),ends_at=VALUES(ends_at)",(id,&input.placement_id,creative,input.starts_at,input.ends_at))?;
    control::audit(
        &mut tx,
        &actor,
        "ads.save",
        &id.to_string(),
        "success",
        &format!("{}: {} ({})", input.name, input.status, input.placement_id),
    )?;
    tx.commit()?;
    Ok(json!({"id":id}))
}

async fn save(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<Input>,
) -> Response {
    if let Err(response) = require_permission(&state, &headers, "ads:manage").await {
        return response;
    }
    let digest = token_hash(&state, &headers).unwrap();
    match state
        .control(move |pool| save_campaign(pool, digest, input))
        .await
    {
        Ok(value) => Json(value).into_response(),
        Err(e) => control_error(e),
    }
}

async fn list(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(response) = require_permission(&state, &headers, "ads:manage").await {
        return response;
    }
    let digest = token_hash(&state, &headers).unwrap();
    let enabled = state.config.ads_enabled;
    match state.control(move |pool| {
        let mut db = pool.get_conn()?;
        control::require_session(&mut db,&digest,"ads:manage")?;
        let rows: Vec<mysql::Row> = db.query("SELECT c.id,c.revision,c.name,c.status,a.name,a.contact,b.placement_id,b.starts_at,b.ends_at,r.alt_text,r.destination,r.id FROM ad_campaigns c JOIN ad_advertisers a ON a.id=c.advertiser_id JOIN ad_bookings b ON b.campaign_id=c.id JOIN ad_creatives r ON r.id=b.creative_id ORDER BY c.id DESC LIMIT 1000")?;
        let campaigns: Vec<Value> = rows.into_iter().map(|r| json!({"id":r.get::<u64,_>(0),"revision":r.get::<u32,_>(1),"name":r.get::<String,_>(2),"status":r.get::<String,_>(3),"advertiser":r.get::<String,_>(4),"contact":r.get::<String,_>(5),"placement_id":r.get::<String,_>(6),"starts_at":r.get::<i64,_>(7),"ends_at":r.get::<i64,_>(8),"alt_text":r.get::<String,_>(9),"destination":r.get::<String,_>(10),"creative_id":r.get::<u64,_>(11)})).collect();
        Ok(json!({"placements":serde_json::from_str::<Value>(CATALOGUE).unwrap(),"campaigns":campaigns,"limit":1000,"serving_enabled":enabled}))
    }).await { Ok(value) => Json(value).into_response(), Err(e) => control_error(e) }
}

async fn manifest(State(state): State<AppState>) -> Response {
    if !state.config.ads_enabled {
        return Json(json!({"server_time":chrono::Utc::now().timestamp(),"ads":[]}))
            .into_response();
    }
    match state.control(move |pool| {
        let mut db = pool.get_conn()?;
        let rows: Vec<(String,u64,String,String,i64,i64)> = db.query("SELECT b.placement_id,r.id,r.alt_text,r.destination,b.starts_at,b.ends_at FROM ad_bookings b JOIN ad_campaigns c ON c.id=b.campaign_id JOIN ad_creatives r ON r.id=b.creative_id WHERE c.status='live' AND b.starts_at <= UNIX_TIMESTAMP() AND b.ends_at > UNIX_TIMESTAMP() ORDER BY c.id LIMIT 100")?;
        Ok(json!({"server_time":chrono::Utc::now().timestamp(),"ads":rows.into_iter().map(|(placement,id,alt,destination,start,end)|json!({"placement_id":placement,"creative_id":id,"alt_text":alt,"destination":destination,"starts_at":start,"ends_at":end,"image_url":format!("/ads-api/v1/images/{id}")})).collect::<Vec<_>>()}))
    }).await { Ok(value) => Json(value).into_response(), Err(_) => (StatusCode::SERVICE_UNAVAILABLE,Json(json!({"ads":[]}))).into_response() }
}

async fn public_image(State(state): State<AppState>, Path(id): Path<u64>) -> Response {
    if !state.config.ads_enabled {
        return StatusCode::NOT_FOUND.into_response();
    }
    image_response(&state, id, true).await
}
async fn preview(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<u64>,
) -> Response {
    if let Err(response) = require_permission(&state, &headers, "ads:manage").await {
        return response;
    }
    image_response(&state, id, false).await
}
async fn image_response(state: &AppState, id: u64, public: bool) -> Response {
    match state.control(move |pool| {
        let sql = if public { "SELECT r.image FROM ad_creatives r JOIN ad_bookings b ON b.creative_id=r.id JOIN ad_campaigns c ON c.id=b.campaign_id WHERE r.id=? AND c.status='live' AND b.starts_at <= UNIX_TIMESTAMP() AND b.ends_at > UNIX_TIMESTAMP() LIMIT 1" } else { "SELECT image FROM ad_creatives WHERE id=?" };
        Ok(pool.get_conn()?.exec_first::<Vec<u8>,_,_>(sql,(id,))?)
    }).await {
        Ok(Some(bytes)) => ([(header::CONTENT_TYPE,"image/png")],Bytes::from(bytes)).into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(_) => StatusCode::SERVICE_UNAVAILABLE.into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn input() -> Input {
        Input {
            id: None,
            revision: None,
            advertiser: "Company".into(),
            contact: String::new(),
            name: "Launch".into(),
            placement_id: "office-right".into(),
            status: "draft".into(),
            starts_at: 100,
            ends_at: 200,
            alt_text: "Offer".into(),
            destination: "https://example.com/offer".into(),
            image: Some(String::new()),
        }
    }
    #[test]
    fn validates_links_and_schedule() {
        let mut i = input();
        assert!(validate(&i).is_ok());
        for url in [
            "javascript:alert(1)",
            "http://example.com",
            "https://user:pass@example.com",
        ] {
            i.destination = url.into();
            assert!(validate(&i).is_err());
        }
        i.destination = "https://example.com".into();
        i.ends_at = i.starts_at;
        assert!(validate(&i).is_err());
    }
    #[test]
    fn split_inventory_conflicts_with_whole_wall_only() {
        let p = placements();
        let at = |id: &str| p.iter().find(|p| p.id == id).unwrap();
        assert!(conflicts(at("office-right"), at("office-right-left")));
        assert!(!conflicts(
            at("office-right-left"),
            at("office-right-right")
        ));
        assert!(conflicts(at("office-right-left"), at("office-right-left")));
        assert!(!conflicts(at("office-right"), at("garage-back")));
    }
    #[test]
    fn rejects_fake_images_and_wrong_ratio() {
        let p = placements().remove(0);
        assert!(decode_image(&STANDARD.encode(b"<svg></svg>"), &p).is_err());
        let mut bytes = Cursor::new(Vec::new());
        image::DynamicImage::new_rgb8(400, 400)
            .write_to(&mut bytes, image::ImageFormat::Png)
            .unwrap();
        assert!(decode_image(&STANDARD.encode(bytes.get_ref()), &p).is_err());
        let mut bytes = Cursor::new(Vec::new());
        image::DynamicImage::new_rgb8(600, 300)
            .write_to(&mut bytes, image::ImageFormat::Png)
            .unwrap();
        let (_, w, h) = decode_image(&STANDARD.encode(bytes.get_ref()), &p).unwrap();
        assert_eq!((w, h), (600, 300));
    }
}
