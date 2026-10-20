pub mod config;
pub(crate) mod control;
mod operations;
mod reports;
mod system;

use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::SaltString};
use axum::{
    Json, Router,
    extract::{ConnectInfo, DefaultBodyLimit, Path, Query, Request, State},
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use config::Config;
use mysql::Pool;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::Semaphore;

const ATTEMPT_WINDOW: Duration = Duration::from_secs(15 * 60);
const MAX_PEERS: usize = 1024;
// Fixed Argon2id verification work for unknown users; never grants access.
const DUMMY_PASSWORD_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$YWJjZGVmZ2hpamtsbW5vcA$fXVb6z8id8LbrB8yKL+f5Bv9ZnBTtOCxb7CYp9bWQcs";

struct Security {
    attempts: HashMap<std::net::IpAddr, (Instant, u32)>,
    global_window: Instant,
    global_attempts: u32,
}

#[derive(Clone)]
pub struct AppState {
    config: Arc<Config>,
    pool: Option<Pool>,
    control_pool: Option<Pool>,
    security: Arc<Mutex<Security>>,
    verifiers: Arc<Semaphore>,
    db_slots: Arc<Semaphore>,
    client: reqwest::Client,
}

impl AppState {
    pub fn new(config: Config, pool: Option<Pool>) -> Self {
        Self {
            config: Arc::new(config),
            pool,
            control_pool: None,
            security: Arc::new(Mutex::new(Security {
                attempts: HashMap::new(),
                global_window: Instant::now(),
                global_attempts: 0,
            })),
            verifiers: Arc::new(Semaphore::new(2)),
            db_slots: Arc::new(Semaphore::new(4)),
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(3))
                .redirect(reqwest::redirect::Policy::none())
                .no_proxy()
                .build()
                .expect("HTTP client configuration"),
        }
    }

    fn cookie_name(&self) -> &'static str {
        if self.config.production {
            "__Host-nc_admin_session"
        } else {
            "nc_admin_session"
        }
    }

    pub fn with_control_pool(mut self, pool: Pool) -> Self {
        self.control_pool = Some(pool);
        self
    }

    pub(crate) async fn control<T: Send + 'static>(
        &self,
        query: impl FnOnce(&Pool) -> control::Result<T> + Send + 'static,
    ) -> control::Result<T> {
        let pool = self.control_pool.clone().ok_or(control::Error::Database)?;
        let permit = tokio::time::timeout(
            Duration::from_millis(200),
            self.db_slots.clone().acquire_owned(),
        )
        .await
        .map_err(|_| control::Error::Database)?
        .map_err(|_| control::Error::Database)?;
        let operation = tokio::task::spawn_blocking(move || {
            let _permit = permit;
            query(&pool)
        });
        tokio::time::timeout(Duration::from_secs(12), operation)
            .await
            .map_err(|_| control::Error::Database)?
            .map_err(|_| control::Error::Database)?
    }

    async fn database<T: Send + 'static>(
        &self,
        query: impl FnOnce(&Pool) -> mysql::Result<T> + Send + 'static,
    ) -> Option<T> {
        let pool = self.pool.clone()?;
        let permit = tokio::time::timeout(
            Duration::from_millis(200),
            self.db_slots.clone().acquire_owned(),
        )
        .await
        .ok()?
        .ok()?;
        let operation = tokio::task::spawn_blocking(move || {
            let _permit = permit;
            query(&pool).ok()
        });
        tokio::time::timeout(Duration::from_secs(12), operation)
            .await
            .ok()?
            .ok()?
    }
}

pub fn initialize_control(pool: &Pool, config: &Config) -> Result<(), String> {
    control::initialize(pool, &config.username, &config.password_hash).and_then(|()| operations::control_ready(pool)).map_err(|err| match err {
        control::Error::Invalid(message) => message.into(),
        _ => "Unable to initialize admin identity store; apply both admin control migrations and grants first".into(),
    })
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route(
            "/health/live",
            get(|| async { Json(serde_json::json!({"status":"ok"})) }),
        )
        .route("/health/ready", get(ready))
        .route(
            "/admin-api/v1/session",
            post(login).get(session).delete(logout),
        )
        .route("/admin-api/v1/overview", get(overview))
        .route("/admin-api/v1/registrations", get(registrations))
        .route("/admin-api/v1/system", get(system))
        .route("/admin-api/v1/staff", get(list_staff).post(create_staff))
        .route(
            "/admin-api/v1/staff/{id}",
            axum::routing::patch(update_staff),
        )
        .route("/admin-api/v1/audit", get(list_audit))
        .merge(operations::routes())
        .fallback(|| async { error(StatusCode::NOT_FOUND, "Not found") })
        .layer(DefaultBodyLimit::max(4096))
        .layer(middleware::from_fn_with_state(state.clone(), protect))
        .with_state(state)
}

async fn protect(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let mut response = if !matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS
    ) && request
        .headers()
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        != Some(&state.config.origin)
    {
        error(StatusCode::FORBIDDEN, "Admin origin does not match")
    } else {
        next.run(request).await
    };
    let headers = response.headers_mut();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("default-src 'none'; frame-ancestors 'none'"),
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    response
}

fn error(status: StatusCode, message: &'static str) -> Response {
    (status, Json(serde_json::json!({"error":message}))).into_response()
}

fn cookie<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .find_map(|part| {
            let (key, value) = part.trim().split_once('=')?;
            (key == name).then_some(value)
        })
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Credentials {
    username: String,
    password: String,
}

async fn login(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(credentials): Json<Credentials>,
) -> Response {
    if credentials.username.len() > 128 || credentials.password.len() > 1024 {
        return error(StatusCode::UNAUTHORIZED, "Invalid credentials");
    }
    let now = Instant::now();
    {
        let mut security = state.security.lock().unwrap_or_else(|e| e.into_inner());
        security
            .attempts
            .retain(|_, (started, _)| now.duration_since(*started) < ATTEMPT_WINDOW);
        if now.duration_since(security.global_window) >= Duration::from_secs(60) {
            security.global_window = now;
            security.global_attempts = 0;
        }
        if security.global_attempts >= 60
            || (!security.attempts.contains_key(&peer.ip()) && security.attempts.len() >= MAX_PEERS)
        {
            return error(
                StatusCode::TOO_MANY_REQUESTS,
                "Too many login attempts; try again later",
            );
        }
        let entry = security.attempts.entry(peer.ip()).or_insert((now, 0));
        if entry.1 >= 10 {
            return error(
                StatusCode::TOO_MANY_REQUESTS,
                "Too many login attempts; try again later",
            );
        }
        entry.1 += 1;
        security.global_attempts += 1;
    }
    let Ok(permit) = state.verifiers.clone().try_acquire_owned() else {
        return error(
            StatusCode::TOO_MANY_REQUESTS,
            "Login verification busy; try again later",
        );
    };
    let username = credentials.username;
    let found = match state
        .control(move |pool| control::credential(pool, &username))
        .await
    {
        Ok(found) => found,
        Err(err) => return control_error(err),
    };
    // Verify a real hash even for unknown usernames. No attempted names are logged.
    let hash = found
        .as_ref()
        .map(|(_, hash)| hash.clone())
        .unwrap_or_else(|| DUMMY_PASSWORD_HASH.to_owned());
    let verified_hash = hash.clone();
    let valid = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        PasswordHash::new(&hash).ok().is_some_and(|hash| {
            Argon2::default()
                .verify_password(credentials.password.as_bytes(), &hash)
                .is_ok()
        })
    })
    .await
    .unwrap_or(false);
    let Some((id, _)) = found.filter(|_| valid) else {
        return error(StatusCode::UNAUTHORIZED, "Invalid credentials");
    };
    let mut random = [0_u8; 32];
    rand::rng().fill_bytes(&mut random);
    let token: String = random.iter().map(|byte| format!("{byte:02x}")).collect();
    let digest = Sha256::digest(token.as_bytes()).into();
    let actor = match state
        .control(move |pool| control::create_session(pool, id, &verified_hash, digest))
        .await
    {
        Ok(actor) => actor,
        Err(err) => return control_error(err),
    };
    let mut response = Json(actor).into_response();
    let value = format!(
        "{}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800{}",
        state.cookie_name(),
        if state.config.production {
            "; Secure"
        } else {
            ""
        }
    );
    response
        .headers_mut()
        .insert(header::SET_COOKIE, HeaderValue::from_str(&value).unwrap());
    response
}

pub(crate) fn token_hash(state: &AppState, headers: &HeaderMap) -> Option<[u8; 32]> {
    let token = cookie(headers, state.cookie_name())?;
    if token.len() != 64 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    Some(Sha256::digest(token.as_bytes()).into())
}
pub(crate) fn control_error(err: control::Error) -> Response {
    match err {
        control::Error::Database => error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Admin identity database unavailable",
        ),
        control::Error::Unauthorized => error(StatusCode::UNAUTHORIZED, "Admin session required"),
        control::Error::Forbidden => error(
            StatusCode::FORBIDDEN,
            "This staff role does not allow this action",
        ),
        control::Error::Conflict(message) => error(StatusCode::CONFLICT, message),
        control::Error::Invalid(message) => error(StatusCode::BAD_REQUEST, message),
        control::Error::NotFound => error(StatusCode::NOT_FOUND, "Account not found"),
    }
}
pub(crate) async fn require_permission(
    state: &AppState,
    headers: &HeaderMap,
    permission: &str,
) -> Result<control::Actor, Response> {
    let digest = token_hash(state, headers)
        .ok_or_else(|| error(StatusCode::UNAUTHORIZED, "Admin session required"))?;
    let permission = permission.to_owned();
    state
        .control(move |pool| control::authenticate(pool, digest, &permission))
        .await
        .map_err(control_error)
}
async fn session(State(state): State<AppState>, headers: HeaderMap) -> Response {
    match require_permission(&state, &headers, "").await {
        Ok(actor) => Json(actor).into_response(),
        Err(response) => response,
    }
}
async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(digest) = token_hash(&state, &headers) {
        if let Err(err) = state
            .control(move |pool| control::logout(pool, digest))
            .await
        {
            return control_error(err);
        }
    }
    let mut response = StatusCode::NO_CONTENT.into_response();
    let value = format!(
        "{}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0{}",
        state.cookie_name(),
        if state.config.production {
            "; Secure"
        } else {
            ""
        }
    );
    response
        .headers_mut()
        .insert(header::SET_COOKIE, HeaderValue::from_str(&value).unwrap());
    response
}
async fn list_staff(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(response) = require_permission(&state, &headers, "staff:manage").await {
        return response;
    }
    let digest = token_hash(&state, &headers).unwrap();
    match state
        .control(move |pool| control::list_staff(pool, digest))
        .await
    {
        Ok(result) => Json(result).into_response(),
        Err(err) => control_error(err),
    }
}
async fn password_hash(state: &AppState, password: String) -> Result<String, Response> {
    let permit = state.verifiers.clone().try_acquire_owned().map_err(|_| {
        error(
            StatusCode::TOO_MANY_REQUESTS,
            "Password verification busy; try again later",
        )
    })?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        let mut random = [0_u8; 16];
        rand::rng().fill_bytes(&mut random);
        let salt = SaltString::encode_b64(&random).unwrap();
        Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|_| ())
    })
    .await
    .ok()
    .and_then(Result::ok)
    .ok_or_else(|| {
        error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Password verification unavailable",
        )
    })
}
async fn create_staff(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<control::NewStaff>,
) -> Response {
    if let Err(response) = require_permission(&state, &headers, "staff:manage").await {
        return response;
    }
    if let Err(err) = control::validate_new(&input) {
        return control_error(err);
    }
    let hash = match password_hash(&state, input.password.clone()).await {
        Ok(hash) => hash,
        Err(response) => return response,
    };
    let digest = token_hash(&state, &headers).unwrap();
    match state
        .control(move |pool| control::create_staff(pool, digest, input, hash))
        .await
    {
        Ok(result) => (StatusCode::CREATED, Json(result)).into_response(),
        Err(err) => control_error(err),
    }
}
async fn update_staff(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<u64>,
    Json(input): Json<control::StaffUpdate>,
) -> Response {
    if let Err(response) = require_permission(&state, &headers, "staff:manage").await {
        return response;
    }
    if let Err(err) = control::validate_update(&input) {
        return control_error(err);
    }
    let hash = if let Some(password) = input.password.clone() {
        match password_hash(&state, password).await {
            Ok(hash) => Some(hash),
            Err(response) => return response,
        }
    } else {
        None
    };
    let digest = token_hash(&state, &headers).unwrap();
    match state
        .control(move |pool| control::update_staff(pool, digest, id, input, hash))
        .await
    {
        Ok(result) => Json(result).into_response(),
        Err(err) => control_error(err),
    }
}
async fn list_audit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ReportQuery>,
) -> Response {
    if let Err(response) = require_permission(&state, &headers, "audit:read").await {
        return response;
    }
    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(25);
    if !(1..=10_000).contains(&page) || !(1..=100).contains(&page_size) {
        return error(
            StatusCode::BAD_REQUEST,
            "page must be 1..10000 and page_size must be 1..100",
        );
    }
    let digest = token_hash(&state, &headers).unwrap();
    match state
        .control(move |pool| control::list_audit(pool, digest, page, page_size))
        .await
    {
        Ok(result) => Json(result).into_response(),
        Err(err) => control_error(err),
    }
}

#[derive(Deserialize, Default)]
struct ReportQuery {
    days: Option<u64>,
    page: Option<u64>,
    page_size: Option<u64>,
    status: Option<String>,
}

impl ReportQuery {
    fn days(&self) -> Option<u64> {
        match self.days.unwrap_or(30) {
            value @ (7 | 30 | 90) => Some(value),
            _ => None,
        }
    }
}

async fn overview(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ReportQuery>,
) -> Response {
    if let Err(response) = require_permission(&state, &headers, "overview:read").await {
        return response;
    }
    let Some(days) = query.days() else {
        return error(StatusCode::BAD_REQUEST, "days must be 7, 30 or 90");
    };
    match state
        .database(move |pool| reports::overview(pool, days))
        .await
    {
        Some(report) => Json(report).into_response(),
        None => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(reports::Overview::unavailable(days)),
        )
            .into_response(),
    }
}

async fn registrations(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ReportQuery>,
) -> Response {
    if let Err(response) = require_permission(&state, &headers, "registrations:read").await {
        return response;
    }
    let Some(days) = query.days() else {
        return error(StatusCode::BAD_REQUEST, "days must be 7, 30 or 90");
    };
    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(25);
    if !(1..=10_000).contains(&page) || !(1..=100).contains(&page_size) {
        return error(
            StatusCode::BAD_REQUEST,
            "page must be 1..10000 and page_size must be 1..100",
        );
    }
    let status = query.status.unwrap_or_else(|| "abandoned".into());
    if !matches!(status.as_str(), "abandoned" | "pending" | "all") {
        return error(StatusCode::BAD_REQUEST, "Unknown registration status");
    }
    let digest = token_hash(&state, &headers).unwrap();
    if let Err(err) = state
        .control(move |pool| {
            let mut conn = pool.get_conn()?;
            let mut tx = conn.start_transaction(mysql::TxOpts::default())?;
            let actor = control::require_session(&mut tx, &digest, "registrations:read")?;
            control::audit(
                &mut tx,
                &actor,
                "registrations.read",
                "registrations",
                "success",
                "Registration email report accessed",
            )?;
            tx.commit()?;
            Ok(())
        })
        .await
    {
        return control_error(err);
    }
    match state
        .database(move |pool| reports::registrations(pool, days, page, page_size, &status))
        .await
    {
        Some(report) => Json(report).into_response(),
        None => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(reports::Registrations::unavailable(days, page, page_size)),
        )
            .into_response(),
    }
}

async fn ready(State(state): State<AppState>) -> Response {
    if state
        .database(|pool| {
            reports::ready(pool)?;
            operations::reporting_ready(pool)
        })
        .await
        .is_some()
        && state
            .control(|pool| {
                control::ready(pool)?;
                operations::control_ready(pool)
            })
            .await
            .is_ok()
    {
        Json(serde_json::json!({"status":"ok"})).into_response()
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"status":"unavailable"})),
        )
            .into_response()
    }
}

#[derive(Serialize)]
struct Component {
    status: &'static str,
}
#[derive(Serialize)]
struct SystemReport {
    collected_at: String,
    scope: &'static str,
    host: system::Host,
    database: Component,
    application_api: Component,
    email_queue: reports::EmailQueue,
}

async fn system(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(response) = require_permission(&state, &headers, "system:read").await {
        return response;
    }
    let db = state.database(|pool| {
        reports::ready(pool)?;
        reports::email_queue(pool)
    });
    let game = async {
        if !state.config.game_health_enabled {
            return "not_configured";
        }
        // Fixed local endpoint; operator/browser input can never select a request target.
        match state
            .client
            .get("http://127.0.0.1:8080/health/ready")
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => "healthy",
            _ => "unavailable",
        }
    };
    let (queue, api) = tokio::join!(db, game);
    let database = Component {
        status: if queue.is_some() {
            "healthy"
        } else {
            "unavailable"
        },
    };
    Json(SystemReport {
        collected_at: reports::now(),
        scope: "admin_host",
        host: system::collect(&state.config.disk_path),
        database,
        application_api: Component { status: api },
        email_queue: queue.unwrap_or_else(reports::EmailQueue::unavailable),
    })
    .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use tower::ServiceExt;
    async fn request(
        app: Router,
        method: &str,
        path: &str,
        body: &str,
        origin: Option<&str>,
        cookie: Option<&str>,
    ) -> Response {
        let mut builder = axum::http::Request::builder()
            .method(method)
            .uri(path)
            .header(header::CONTENT_TYPE, "application/json")
            .extension(ConnectInfo("127.0.0.1:1234".parse::<SocketAddr>().unwrap()));
        if let Some(origin) = origin {
            builder = builder.header(header::ORIGIN, origin);
        }
        if let Some(cookie) = cookie {
            builder = builder.header(header::COOKIE, cookie);
        }
        app.oneshot(builder.body(Body::from(body.to_owned())).unwrap())
            .await
            .unwrap()
    }
    #[tokio::test]
    async fn missing_identity_store_fails_closed_and_origin_is_enforced() {
        let app = router(AppState::new(config::tests::config(), None));
        for path in [
            "/admin-api/v1/session",
            "/admin-api/v1/overview",
            "/admin-api/v1/registrations",
            "/admin-api/v1/system",
            "/admin-api/v1/staff",
            "/admin-api/v1/audit",
        ] {
            let response = request(app.clone(), "GET", path, "", None, None).await;
            assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
            assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
        }
        let login = r#"{"username":"operator","password":"correct password"}"#;
        assert_eq!(
            request(
                app.clone(),
                "POST",
                "/admin-api/v1/session",
                login,
                Some("http://127.0.0.1:4174"),
                None
            )
            .await
            .status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
        for origin in [None, Some("https://evil.invalid")] {
            assert_eq!(
                request(
                    app.clone(),
                    "POST",
                    "/admin-api/v1/session",
                    login,
                    origin,
                    None
                )
                .await
                .status(),
                StatusCode::FORBIDDEN
            );
        }
        assert_eq!(
            request(
                app,
                "GET",
                "/admin-api/v1/session",
                "",
                None,
                Some(&format!("nc_admin_session={}", "a".repeat(64)))
            )
            .await
            .status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
    }
    #[tokio::test]
    async fn login_throttle_and_readiness_remain_bounded_and_private() {
        let state = AppState::new(config::tests::config(), None);
        state
            .security
            .lock()
            .unwrap()
            .attempts
            .insert("127.0.0.1".parse().unwrap(), (Instant::now(), 10));
        let app = router(state);
        let response = request(
            app.clone(),
            "POST",
            "/admin-api/v1/session",
            r#"{"username":"operator","password":"wrong"}"#,
            Some("http://127.0.0.1:4174"),
            None,
        )
        .await;
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        let response = request(app, "GET", "/health/ready", "", None, None).await;
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            &axum::body::to_bytes(response.into_body(), 4096)
                .await
                .unwrap()[..],
            br#"{"status":"unavailable"}"#
        );
    }
}
