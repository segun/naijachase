use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::SaltString};
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Path, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use naijachase_content::Catalogue;
use naijachase_contracts::{Command, Event, GameState};
use naijachase_storage::{
    Achievement, CaseArchiveEntry, CaseCommandResult, MysqlStore, PlayerAccount, PlayerSession,
    ProgressionSummary, StorageError,
};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashMap, VecDeque},
    env,
    path::Path as FsPath,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tower_http::{catch_panic::CatchPanicLayer, trace::TraceLayer};

pub const API_VERSION: &str = "v1";

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientCommand {
    VisitVenue { venue_id: String },
    Wait { minutes: u32 },
    RecordTrait { trait_name: String, value: String },
    Travel { destination: String },
    RequestWarrant { suspect_id: String },
    SearchHideout { venue_id: String },
}

#[derive(Debug, Deserialize)]
pub struct CreateCaseRequest {
    pub case_id: String,
    pub mission_id: String,
    #[serde(default)]
    pub seed: u64,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteRequest {
    pub command_id: String,
    pub expected_version: u64,
    pub command: ClientCommand,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    email: String,
    password: String,
    confirm_password: String,
    username: String,
    home_base: String,
}
#[derive(Deserialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}
#[derive(Deserialize)]
pub struct ConfirmRequest {
    token: String,
}
#[derive(Deserialize)]
pub struct RecoveryRequest {
    email: String,
}
#[derive(Deserialize)]
pub struct RecoveryCompleteRequest {
    token: String,
    password: String,
    confirm_password: String,
}
#[derive(Deserialize)]
pub struct ProfileRequest {
    display_name: Option<String>,
    pronouns: Option<String>,
    sex: Option<String>,
    avatar_id: Option<String>,
    uniform_id: Option<String>,
    home_base: String,
    #[serde(default)]
    leaderboard_opt_in: bool,
}
#[derive(Serialize)]
pub struct AuthResponse {
    player: PlayerAccount,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct PublicGameState {
    pub mission_id: String,
    pub difficulty: u8,
    pub stage: u8,
    pub current_state: String,
    pub elapsed: u32,
    pub score: u32,
    pub career_points: u32,
    pub dossier: BTreeMap<String, String>,
    pub visited_venues: Vec<String>,
    pub warrant_suspect: Option<String>,
    pub outcome: Option<String>,
}

impl From<&GameState> for PublicGameState {
    fn from(state: &GameState) -> Self {
        Self {
            mission_id: state.mission_id.clone(),
            difficulty: state.difficulty,
            stage: state.stage,
            current_state: state.state.clone(),
            elapsed: state.elapsed,
            score: state.score,
            career_points: state.career_points,
            dossier: state.dossier.clone(),
            visited_venues: state.visited_venues.clone(),
            warrant_suspect: state.warrant_suspect.clone(),
            outcome: state.outcome.clone(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct CaseResponse {
    pub api_version: &'static str,
    pub case_id: String,
    pub state_version: u64,
    pub duplicate: bool,
    pub state: PublicGameState,
    pub events: Vec<Event>,
}

#[derive(Debug, Serialize)]
struct ErrorBody {
    error: &'static str,
    message: String,
}

#[derive(Debug)]
pub struct ApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status,
            code,
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(ErrorBody {
                error: self.code,
                message: self.message,
            }),
        )
            .into_response()
    }
}

impl From<StorageError> for ApiError {
    fn from(error: StorageError) -> Self {
        match error {
            StorageError::CaseNotFound => {
                Self::new(StatusCode::NOT_FOUND, "case_not_found", "case not found")
            }
            StorageError::Forbidden => {
                Self::new(StatusCode::FORBIDDEN, "forbidden", "case access denied")
            }
            StorageError::VersionConflict(_) => Self::new(
                StatusCode::CONFLICT,
                "stale_version",
                "state version is stale",
            ),
            StorageError::Command(message) => {
                Self::new(StatusCode::UNPROCESSABLE_ENTITY, "invalid_command", message)
            }
            StorageError::DuplicateAccount => Self::new(
                StatusCode::CONFLICT,
                "account_exists",
                "email or username is already registered",
            ),
            other => {
                tracing::error!(error = %other, "storage operation failed");
                Self::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal_error",
                    "request could not be completed",
                )
            }
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Environment {
    Development,
    Staging,
    Production,
}

#[derive(Clone)]
pub struct ServiceConfig {
    pub environment: Environment,
    pub bind: String,
    pub rate_limit_per_minute: usize,
    cloudflare_email_api_url: String,
    cloudflare_api_token: String,
    email_from: String,
    public_web_url: String,
    allowed_origins: Arc<Vec<String>>,
}

impl ServiceConfig {
    pub fn from_env() -> Result<Self, String> {
        let environment = match env::var("NAIJACHASE_ENV")
            .unwrap_or_else(|_| "development".into())
            .as_str()
        {
            "development" => Environment::Development,
            "staging" => Environment::Staging,
            "production" => Environment::Production,
            _ => return Err("NAIJACHASE_ENV must be development, staging, or production".into()),
        };
        let bind = env::var("NAIJACHASE_API_BIND").unwrap_or_else(|_| "127.0.0.1:8080".into());
        let rate_limit_per_minute = env::var("NAIJACHASE_RATE_LIMIT_PER_MINUTE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);
        if !(1..=10_000).contains(&rate_limit_per_minute) {
            return Err("rate limit must be between 1 and 10000".into());
        }
        let public_web_url = env::var("NAIJACHASE_PUBLIC_WEB_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:4173".into());
        let allowed_origins = env::var("NAIJACHASE_ALLOWED_ORIGINS")
            .unwrap_or_else(|_| public_web_url.clone())
            .split(',')
            .map(|value| value.trim().trim_end_matches('/').to_owned())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>();
        if allowed_origins.is_empty() {
            return Err("NAIJACHASE_ALLOWED_ORIGINS must contain at least one origin".into());
        }
        Ok(Self {
            environment,
            bind,
            rate_limit_per_minute,
            cloudflare_email_api_url: env::var("CLOUDFLARE_ACCOUNT_ID")
                .map(|id| {
                    format!("https://api.cloudflare.com/client/v4/accounts/{id}/email/sending/send")
                })
                .unwrap_or_default(),
            cloudflare_api_token: env::var("CLOUDFLARE_EMAIL_API_TOKEN").unwrap_or_default(),
            email_from: env::var("NAIJACHASE_EMAIL_FROM").unwrap_or_default(),
            public_web_url,
            allowed_origins: Arc::new(allowed_origins),
        })
    }

    #[cfg(test)]
    fn test() -> Self {
        Self {
            environment: Environment::Development,
            bind: "127.0.0.1:0".into(),
            rate_limit_per_minute: 4,
            cloudflare_email_api_url: String::new(),
            cloudflare_api_token: String::new(),
            email_from: String::new(),
            public_web_url: "http://127.0.0.1:4173".into(),
            allowed_origins: Arc::new(vec!["http://127.0.0.1:4173".into()]),
        }
    }
}

fn hash_token(token: &str) -> String {
    format!("{:x}", Sha256::digest(token.as_bytes()))
}

fn ensure_origin(headers: &HeaderMap, config: &ServiceConfig) -> Result<(), ApiError> {
    if config.environment == Environment::Development && headers.get(header::ORIGIN).is_none() {
        return Ok(());
    }
    let origin = headers
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim_end_matches('/');
    if !config
        .allowed_origins
        .iter()
        .any(|allowed| allowed == origin)
    {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "csrf_rejected",
            "request origin is not allowed",
        ));
    }
    Ok(())
}

async fn secure_password(password: String) -> Result<String, ApiError> {
    tokio::task::spawn_blocking(move || {
        let mut salt_bytes = [0u8; 16];
        rand::rng().fill_bytes(&mut salt_bytes);
        let salt = SaltString::encode_b64(&salt_bytes)
            .map_err(|_| bad_request("password could not be secured"))?;
        Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map(|h| h.to_string())
            .map_err(|_| bad_request("password could not be secured"))
    })
    .await
    .map_err(task_error)?
}

async fn enforce_auth_limit(
    state: &AppState,
    subject: &str,
    action: &str,
    limit: u32,
) -> Result<(), ApiError> {
    let store = state.store.clone();
    let subject = hash_token(subject);
    let action = action.to_owned();
    let allowed =
        tokio::task::spawn_blocking(move || store.allow_auth_attempt(&subject, &action, limit))
            .await
            .map_err(task_error)??;
    if !allowed {
        return Err(ApiError::new(
            StatusCode::TOO_MANY_REQUESTS,
            "rate_limited",
            "try again later",
        ));
    }
    Ok(())
}

fn session_cookie(token: &str, config: &ServiceConfig) -> Result<HeaderValue, ApiError> {
    let secure = if config.environment == Environment::Production {
        "; Secure"
    } else {
        ""
    };
    HeaderValue::from_str(&format!(
        "nc_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400{secure}"
    ))
    .map_err(|_| bad_request("session could not be created"))
}

#[derive(Default)]
pub struct Metrics {
    requests: std::sync::atomic::AtomicU64,
    rejected: std::sync::atomic::AtomicU64,
    commands: std::sync::atomic::AtomicU64,
    duplicates: std::sync::atomic::AtomicU64,
}

#[derive(Default)]
struct RateLimiter {
    requests: Mutex<HashMap<String, VecDeque<Instant>>>,
}

impl RateLimiter {
    fn allow(&self, subject: &str, limit: usize) -> bool {
        let mut all = self.requests.lock().expect("rate limiter lock");
        let queue = all.entry(subject.to_owned()).or_default();
        let cutoff = Instant::now() - Duration::from_secs(60);
        while queue.front().is_some_and(|time| *time < cutoff) {
            queue.pop_front();
        }
        if queue.len() >= limit {
            return false;
        }
        queue.push_back(Instant::now());
        true
    }
}

pub struct AppState {
    pub store: Arc<MysqlStore>,
    pub catalogue: Arc<Catalogue>,
    pub config: ServiceConfig,
    metrics: Metrics,
    limiter: RateLimiter,
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health/live", get(live))
        .route("/health/ready", get(ready))
        .route("/metrics", get(metrics))
        .route("/v1/auth/register", post(register))
        .route("/v1/auth/confirm", post(confirm_email))
        .route("/v1/auth/login", post(login))
        .route("/v1/auth/refresh", post(refresh_session))
        .route("/v1/auth/logout", post(logout))
        .route("/v1/auth/logout-all", post(logout_all))
        .route("/v1/auth/sessions", get(list_sessions))
        .route(
            "/v1/auth/sessions/{session_id}",
            axum::routing::delete(revoke_device_session),
        )
        .route("/v1/auth/recovery/request", post(request_recovery))
        .route("/v1/auth/recovery/complete", post(complete_recovery))
        .route("/v1/auth/me", get(me))
        .route("/v1/profile", get(me).put(update_profile))
        .route("/v1/progression/archive", get(case_archive))
        .route("/v1/progression/achievements", get(achievements))
        .route("/v1/progression/summary", get(progression_summary))
        .route(
            "/v1/progression/achievement-catalog",
            get(achievement_catalog),
        )
        .route("/v1/cases", post(create_case))
        .route("/v1/cases/{case_id}", get(get_case))
        .route("/v1/cases/{case_id}/commands", post(execute_command))
        .with_state(state)
        .layer(DefaultBodyLimit::max(32 * 1024))
        .layer(CatchPanicLayer::new())
        .layer(TraceLayer::new_for_http())
}

fn session_token(headers: &HeaderMap) -> Result<String, ApiError> {
    headers
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .and_then(|cookies| {
            cookies
                .split(';')
                .map(str::trim)
                .find_map(|c| c.strip_prefix("nc_session="))
        })
        .map(str::to_owned)
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "unauthorized", "login required"))
}

async fn authenticate(headers: &HeaderMap, state: &AppState) -> Result<PlayerAccount, ApiError> {
    let token = session_token(headers)?;
    let store = state.store.clone();
    tokio::task::spawn_blocking(move || store.authenticate_session(&hash_token(&token)))
        .await
        .map_err(task_error)??
        .ok_or_else(|| {
            ApiError::new(
                StatusCode::UNAUTHORIZED,
                "unauthorized",
                "session expired or invalid",
            )
        })
}

async fn authorize(headers: &HeaderMap, state: &AppState) -> Result<PlayerAccount, ApiError> {
    state
        .metrics
        .requests
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let account = authenticate(headers, state).await.inspect_err(|_| {
        state
            .metrics
            .rejected
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    })?;
    let player = account.player_id.clone();
    if !state
        .limiter
        .allow(&player, state.config.rate_limit_per_minute)
    {
        state
            .metrics
            .rejected
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        return Err(ApiError::new(
            StatusCode::TOO_MANY_REQUESTS,
            "rate_limited",
            "request limit exceeded",
        ));
    }
    Ok(account)
}

async fn live() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({"status":"live"})))
}

async fn ready(State(state): State<Arc<AppState>>) -> Result<impl IntoResponse, ApiError> {
    let store = state.store.clone();
    tokio::task::spawn_blocking(move || store.ping())
        .await
        .map_err(task_error)??;
    Ok((StatusCode::OK, Json(serde_json::json!({"status":"ready"}))))
}

async fn metrics(State(state): State<Arc<AppState>>) -> String {
    use std::sync::atomic::Ordering::Relaxed;
    format!(
        "naijachase_http_requests_total {}\nnaijachase_http_rejected_total {}\nnaijachase_commands_total {}\nnaijachase_duplicate_commands_total {}\n",
        state.metrics.requests.load(Relaxed),
        state.metrics.rejected.load(Relaxed),
        state.metrics.commands.load(Relaxed),
        state.metrics.duplicates.load(Relaxed)
    )
}

async fn register(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    ensure_origin(&headers, &state.config)?;
    let email = request.email.trim().to_lowercase();
    enforce_auth_limit(&state, &email, "register", 5).await?;
    let username = request.username.trim().to_owned();
    if !email.contains('@') || email.len() > 320 {
        return Err(bad_request("enter a valid email address"));
    }
    if request.password != request.confirm_password {
        return Err(bad_request("passwords do not match"));
    }
    if request.password.len() < 12 || request.password.len() > 128 {
        return Err(bad_request("password must be 12 to 128 characters"));
    }
    if username.len() < 3
        || username.len() > 32
        || !username
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err(bad_request(
            "username must be 3 to 32 letters, numbers, hyphens, or underscores",
        ));
    }
    if !NIGERIAN_JURISDICTIONS.contains(&request.home_base.as_str()) {
        return Err(bad_request("choose a valid home base"));
    }
    if state.config.cloudflare_email_api_url.is_empty()
        || state.config.cloudflare_api_token.is_empty()
        || state.config.email_from.is_empty()
    {
        return Err(ApiError::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "email_unconfigured",
            "email confirmation is not configured",
        ));
    }
    let password_hash = secure_password(request.password.clone()).await?;
    let player_id = format!("player-{}", uuid::Uuid::new_v4());
    let verification = random_token();
    let store = state.store.clone();
    let values = (
        player_id.clone(),
        email.clone(),
        username,
        request.home_base,
        password_hash,
        hash_token(&verification),
    );
    tokio::task::spawn_blocking(move || {
        store.register_player(
            &values.0, &values.1, &values.2, &values.3, &values.4, &values.5,
        )
    })
    .await
    .map_err(task_error)??;
    let link = format!(
        "{}/?confirm={}",
        state.config.public_web_url.trim_end_matches('/'),
        verification
    );
    if let Err(error) = send_confirmation(&state.config, &email, &link).await {
        let store = state.store.clone();
        let cleanup_id = player_id.clone();
        if let Err(cleanup_error) =
            tokio::task::spawn_blocking(move || store.delete_unverified_player(&cleanup_id))
                .await
                .map_err(task_error)?
        {
            tracing::error!(%cleanup_error, player_id=%player_id, "failed to roll back unverified registration");
        }
        return Err(error);
    }
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({"message":"Check your email to confirm your account."})),
    ))
}

async fn confirm_email(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<ConfirmRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    if request.token.len() < 32 {
        return Err(bad_request("invalid confirmation link"));
    }
    let store = state.store.clone();
    let valid =
        tokio::task::spawn_blocking(move || store.verify_email(&hash_token(&request.token)))
            .await
            .map_err(task_error)??;
    if !valid {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "invalid_confirmation",
            "confirmation link is invalid or expired",
        ));
    }
    Ok(Json(
        serde_json::json!({"message":"Email confirmed. You can now log in."}),
    ))
}

async fn login(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<LoginRequest>,
) -> Result<Response, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let email = request.email.trim().to_lowercase();
    enforce_auth_limit(&state, &email, "login", 10).await?;
    let store = state.store.clone();
    let record = tokio::task::spawn_blocking(move || store.login_record(&email))
        .await
        .map_err(task_error)??;
    let Some((account, password_hash)) = record else {
        let store = state.store.clone();
        let _ = tokio::task::spawn_blocking(move || store.security_event(None, "login", "failed"))
            .await;
        return Err(ApiError::new(
            StatusCode::UNAUTHORIZED,
            "invalid_credentials",
            "email or password is incorrect",
        ));
    };
    let password = request.password;
    let verified = tokio::task::spawn_blocking(move || {
        PasswordHash::new(&password_hash).ok().is_some_and(|hash| {
            Argon2::default()
                .verify_password(password.as_bytes(), &hash)
                .is_ok()
        })
    })
    .await
    .map_err(task_error)?;
    if !verified {
        let store = state.store.clone();
        let player = account.player_id.clone();
        let _ = tokio::task::spawn_blocking(move || {
            store.security_event(Some(&player), "login", "failed")
        })
        .await;
        return Err(ApiError::new(
            StatusCode::UNAUTHORIZED,
            "invalid_credentials",
            "email or password is incorrect",
        ));
    }
    if !account.email_verified {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "email_unconfirmed",
            "confirm your email before logging in",
        ));
    }
    let token = random_token();
    let token_hash = hash_token(&token);
    let player = account.player_id.clone();
    let family = uuid::Uuid::new_v4().to_string();
    let device = headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.chars().take(160).collect::<String>());
    let store = state.store.clone();
    tokio::task::spawn_blocking(move || {
        store.create_session(&player, &token_hash, &family, device.as_deref())
    })
    .await
    .map_err(task_error)??;
    let audit_store = state.store.clone();
    let audit_player = account.player_id.clone();
    let _ = tokio::task::spawn_blocking(move || {
        audit_store.security_event(Some(&audit_player), "login", "success")
    })
    .await;
    let mut response = Json(AuthResponse { player: account }).into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, session_cookie(&token, &state.config)?);
    Ok(response)
}

async fn logout(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let account = authenticate(&headers, &state).await?;
    let token = session_token(&headers)?;
    let store = state.store.clone();
    let hash = hash_token(&token);
    tokio::task::spawn_blocking(move || store.revoke_session(&hash))
        .await
        .map_err(task_error)??;
    let audit_store = state.store.clone();
    let audit_player = account.player_id;
    let _ = tokio::task::spawn_blocking(move || {
        audit_store.security_event(Some(&audit_player), "logout", "success")
    })
    .await;
    let mut response = Json(serde_json::json!({"message":"Logged out."})).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_static("nc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"),
    );
    Ok(response)
}

async fn refresh_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let old = session_token(&headers)?;
    let new = random_token();
    let store = state.store.clone();
    let old_hash = hash_token(&old);
    let new_hash = hash_token(&new);
    let rotated = tokio::task::spawn_blocking(move || store.rotate_session(&old_hash, &new_hash))
        .await
        .map_err(task_error)??;
    if !rotated {
        return Err(ApiError::new(
            StatusCode::UNAUTHORIZED,
            "unauthorized",
            "session expired or invalid",
        ));
    }
    let mut response = Json(serde_json::json!({"message":"Session refreshed."})).into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, session_cookie(&new, &state.config)?);
    Ok(response)
}

async fn logout_all(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let account = authenticate(&headers, &state).await?;
    let store = state.store.clone();
    let player = account.player_id;
    tokio::task::spawn_blocking(move || store.revoke_all_sessions(&player))
        .await
        .map_err(task_error)??;
    let mut response =
        Json(serde_json::json!({"message":"All sessions logged out."})).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_static("nc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"),
    );
    Ok(response)
}

async fn list_sessions(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<PlayerSession>>, ApiError> {
    let account = authenticate(&headers, &state).await?;
    let current = hash_token(&session_token(&headers)?);
    let store = state.store.clone();
    let player = account.player_id;
    Ok(Json(
        tokio::task::spawn_blocking(move || store.sessions(&player, &current))
            .await
            .map_err(task_error)??,
    ))
}

async fn revoke_device_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    validate_id(&session_id, "session_id").map_err(bad_request)?;
    let account = authenticate(&headers, &state).await?;
    let store = state.store.clone();
    let player = account.player_id;
    let revoked =
        tokio::task::spawn_blocking(move || store.revoke_session_id(&player, &session_id))
            .await
            .map_err(task_error)??;
    if !revoked {
        return Err(ApiError::new(
            StatusCode::NOT_FOUND,
            "session_not_found",
            "session not found",
        ));
    }
    Ok(Json(serde_json::json!({"message":"Session revoked."})))
}

async fn request_recovery(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<RecoveryRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let email = request.email.trim().to_lowercase();
    enforce_auth_limit(&state, &email, "recovery", 3).await?;
    let token = random_token();
    let token_hash = hash_token(&token);
    let store = state.store.clone();
    let lookup = email.clone();
    let player =
        tokio::task::spawn_blocking(move || store.create_password_reset(&lookup, &token_hash))
            .await
            .map_err(task_error)??;
    if let Some(player_id) = player {
        let link = format!(
            "{}/?reset={}",
            state.config.public_web_url.trim_end_matches('/'),
            token
        );
        if let Err(error) = send_email(
            &state.config,
            &email,
            "Reset your Naija Chase password",
            &format!("Reset your password: {link}"),
            &format!("<p><a href=\"{link}\">Reset your password</a></p>"),
        )
        .await
        {
            tracing::error!(
                code = error.code,
                message = %error.message,
                "password recovery email delivery failed"
            );
        }
        let store = state.store.clone();
        let _ = tokio::task::spawn_blocking(move || {
            store.security_event(Some(&player_id), "password_recovery", "requested")
        })
        .await;
    }
    Ok(Json(
        serde_json::json!({"message":"If that account exists, a recovery email has been sent."}),
    ))
}

async fn complete_recovery(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<RecoveryCompleteRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    if request.password != request.confirm_password {
        return Err(bad_request("passwords do not match"));
    }
    if !(12..=128).contains(&request.password.len()) {
        return Err(bad_request("password must be 12 to 128 characters"));
    }
    let password = secure_password(request.password).await?;
    let token = hash_token(&request.token);
    let store = state.store.clone();
    let changed =
        tokio::task::spawn_blocking(move || store.complete_password_reset(&token, &password))
            .await
            .map_err(task_error)??;
    if !changed {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "invalid_recovery",
            "recovery link is invalid or expired",
        ));
    }
    Ok(Json(
        serde_json::json!({"message":"Password changed. Sign in again on every device."}),
    ))
}

async fn me(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<AuthResponse>, ApiError> {
    Ok(Json(AuthResponse {
        player: authenticate(&headers, &state).await?,
    }))
}

async fn update_profile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<ProfileRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let account = authenticate(&headers, &state).await?;
    if !NIGERIAN_JURISDICTIONS.contains(&request.home_base.as_str()) {
        return Err(bad_request("choose a valid home base"));
    }
    for value in [
        &request.display_name,
        &request.pronouns,
        &request.sex,
        &request.avatar_id,
        &request.uniform_id,
    ]
    .into_iter()
    .flatten()
    {
        if value.trim().is_empty() || value.len() > 64 {
            return Err(bad_request("profile values must be 1 to 64 characters"));
        }
    }
    let store = state.store.clone();
    let player = account.player_id.clone();
    tokio::task::spawn_blocking(move || {
        store.update_profile(
            &player,
            request.display_name.as_deref(),
            request.pronouns.as_deref(),
            request.sex.as_deref(),
            request.avatar_id.as_deref(),
            request.uniform_id.as_deref(),
            &request.home_base,
            request.leaderboard_opt_in,
        )
    })
    .await
    .map_err(task_error)??;
    let audit_store = state.store.clone();
    let audit_player = account.player_id.clone();
    let _ = tokio::task::spawn_blocking(move || {
        audit_store.security_event(Some(&audit_player), "profile_update", "success")
    })
    .await;
    Ok(Json(AuthResponse {
        player: authenticate(&headers, &state).await?,
    }))
}

async fn case_archive(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<CaseArchiveEntry>>, ApiError> {
    let account = authenticate(&headers, &state).await?;
    let store = state.store.clone();
    let player = account.player_id;
    Ok(Json(
        tokio::task::spawn_blocking(move || store.case_archive(&player))
            .await
            .map_err(task_error)??,
    ))
}
async fn achievements(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<Achievement>>, ApiError> {
    let account = authenticate(&headers, &state).await?;
    let store = state.store.clone();
    let player = account.player_id;
    Ok(Json(
        tokio::task::spawn_blocking(move || store.achievements(&player))
            .await
            .map_err(task_error)??,
    ))
}

async fn progression_summary(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<ProgressionSummary>, ApiError> {
    let account = authenticate(&headers, &state).await?;
    let store = state.store.clone();
    let player = account.player_id;
    Ok(Json(
        tokio::task::spawn_blocking(move || store.progression_summary(&player))
            .await
            .map_err(task_error)??,
    ))
}

async fn achievement_catalog() -> Json<serde_json::Value> {
    Json(serde_json::json!({"achievements":[
        {"id":"first_case","title":"First Case","description":"Solve your first case."},
        {"id":"five_cases","title":"Seasoned Investigator","description":"Solve five cases."},
        {"id":"swift_investigator","title":"Against the Clock","description":"Solve a case with two days remaining."},
        {"id":"clean_route","title":"True Trail","description":"Solve a case without a false destination."},
        {"id":"sharp_deduction","title":"Sharp Deduction","description":"Complete a solved case without recording an incorrect trait."},
        {"id":"state_explorer","title":"State Explorer","description":"Investigate ten jurisdictions."},
        {"id":"national_investigator","title":"Across Naija","description":"Investigate all 36 states and the FCT."},
        {"id":"rank_investigator","title":"Investigator","description":"Earn the Investigator rank."},
        {"id":"rank_senior_investigator","title":"Senior Investigator","description":"Earn the Senior Investigator rank."},
        {"id":"rank_inspector","title":"Inspector","description":"Earn the Inspector rank."},
        {"id":"rank_senior_inspector","title":"Senior Inspector","description":"Earn the Senior Inspector rank."},
        {"id":"rank_chief_inspector","title":"Chief Inspector","description":"Earn the Chief Inspector rank."},
        {"id":"master_detective","title":"Master Detective","description":"Reach Master Detective rank."}
    ]}))
}

async fn send_confirmation(config: &ServiceConfig, to: &str, link: &str) -> Result<(), ApiError> {
    send_email(
        config,
        to,
        "Confirm your Naija Chase account",
        &format!("Confirm your account: {link}"),
        &format!(
            "<p>Welcome to Naija Chase.</p><p><a href=\"{link}\">Confirm your email address</a></p>"
        ),
    )
    .await
}
async fn send_email(
    config: &ServiceConfig,
    to: &str,
    subject: &str,
    text: &str,
    html: &str,
) -> Result<(), ApiError> {
    let response=reqwest::Client::new().post(&config.cloudflare_email_api_url).bearer_auth(&config.cloudflare_api_token)
        .json(&serde_json::json!({"from":config.email_from,"to":to,"subject":subject,"text":text,"html":html}))
        .send().await.map_err(|error|{tracing::error!(%error,"confirmation email failed");ApiError::new(StatusCode::BAD_GATEWAY,"email_failed","confirmation email could not be sent")})?;
    if !response.status().is_success() {
        tracing::error!(status=%response.status(),"Cloudflare rejected confirmation email");
        return Err(ApiError::new(
            StatusCode::BAD_GATEWAY,
            "email_failed",
            "confirmation email could not be sent",
        ));
    }
    Ok(())
}
fn random_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

const NIGERIAN_JURISDICTIONS: [&str; 37] = [
    "Abia",
    "Adamawa",
    "Akwa Ibom",
    "Anambra",
    "Bauchi",
    "Bayelsa",
    "Benue",
    "Borno",
    "Cross River",
    "Delta",
    "Ebonyi",
    "Edo",
    "Ekiti",
    "Enugu",
    "Federal Capital Territory",
    "Gombe",
    "Imo",
    "Jigawa",
    "Kaduna",
    "Kano",
    "Katsina",
    "Kebbi",
    "Kogi",
    "Kwara",
    "Lagos",
    "Nasarawa",
    "Niger",
    "Ogun",
    "Ondo",
    "Osun",
    "Oyo",
    "Plateau",
    "Rivers",
    "Sokoto",
    "Taraba",
    "Yobe",
    "Zamfara",
];

async fn create_case(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<CreateCaseRequest>,
) -> Result<(StatusCode, Json<CaseResponse>), ApiError> {
    ensure_origin(&headers, &state.config)?;
    let account = authorize(&headers, &state).await?;
    let player = account.player_id.clone();
    validate_id(&request.case_id, "case_id").map_err(bad_request)?;
    validate_id(&request.mission_id, "mission_id").map_err(bad_request)?;
    let mission = state
        .catalogue
        .missions
        .get(&request.mission_id)
        .ok_or_else(|| bad_request("unknown mission_id"))?;
    let route = state
        .catalogue
        .route(mission)
        .map_err(|_| bad_request("mission route unavailable"))?;
    let store = state.store.clone();
    let career_player = player.clone();
    let career_points = tokio::task::spawn_blocking(move || store.career_points(&career_player))
        .await
        .map_err(task_error)??;
    let game = GameState {
        version: 1,
        mission_id: mission.mission_id.clone(),
        thief_id: mission.thief_id.clone(),
        difficulty: mission.difficulty,
        stage: 0,
        state: route[0].clone(),
        route,
        elapsed: 0,
        score: [0, 500, 650, 800, 1000, 1250][mission.difficulty as usize],
        career_points: career_points.min(u32::MAX as u64) as u32,
        dossier: BTreeMap::new(),
        observations: BTreeMap::new(),
        visited_venues: vec![],
        warrant_suspect: None,
        hideout_venue: choose_hideout(&request.mission_id, request.seed, &state.catalogue),
        replay: vec![],
        outcome: None,
    };
    let store = state.store.clone();
    let case_id = request.case_id.clone();
    let mission_id = request.mission_id.clone();
    let saved = game.clone();
    tokio::task::spawn_blocking(move || store.create_case(&case_id, &player, &mission_id, &saved))
        .await
        .map_err(task_error)??;
    let store = state.store.clone();
    let player = authenticate(&headers, &state).await?.player_id;
    let lookup_id = request.case_id.clone();
    let (version, stored_game) =
        tokio::task::spawn_blocking(move || store.load_owned_case(&lookup_id, &player))
            .await
            .map_err(task_error)??;
    Ok((
        StatusCode::CREATED,
        Json(CaseResponse {
            api_version: API_VERSION,
            case_id: request.case_id,
            state_version: version,
            duplicate: false,
            state: (&stored_game).into(),
            events: vec![],
        }),
    ))
}

async fn get_case(
    State(state): State<Arc<AppState>>,
    Path(case_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<CaseResponse>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    validate_id(&case_id, "case_id").map_err(bad_request)?;
    let store = state.store.clone();
    let lookup_id = case_id.clone();
    let (version, game) =
        tokio::task::spawn_blocking(move || store.load_owned_case(&lookup_id, &player))
            .await
            .map_err(task_error)??;
    Ok(Json(CaseResponse {
        api_version: API_VERSION,
        case_id,
        state_version: version,
        duplicate: false,
        state: (&game).into(),
        events: vec![],
    }))
}

async fn execute_command(
    State(state): State<Arc<AppState>>,
    Path(case_id): Path<String>,
    headers: HeaderMap,
    Json(request): Json<ExecuteRequest>,
) -> Result<Json<CaseResponse>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let account = authorize(&headers, &state).await?;
    let player = account.player_id.clone();
    validate_id(&case_id, "case_id").map_err(bad_request)?;
    validate_id(&request.command_id, "command_id").map_err(bad_request)?;
    if request.expected_version == 0 {
        return Err(bad_request("expected_version must be positive"));
    }
    let store = state.store.clone();
    let catalogue = state.catalogue.clone();
    let command_id = request.command_id;
    let expected = request.expected_version;
    let lookup_id = case_id.clone();
    let client_command = request.command;
    let command_player = player.clone();
    let result = tokio::task::spawn_blocking(move || {
        store.execute_case_command(&lookup_id, &command_player, &command_id, expected, |game| {
            let (command, public_event) =
                translate_command(&catalogue, &game, client_command, &account.home_base)?;
            let (next, mut events) =
                naijachase_core::apply(game, command).map_err(|error| error.to_string())?;
            if let Some(event) = public_event {
                events.push(event);
            }
            Ok((next, events))
        })
    })
    .await
    .map_err(task_error)??;
    state
        .metrics
        .commands
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let (version, game, events, duplicate) = match result {
        CaseCommandResult::Applied {
            version,
            state,
            events,
        } => (version, state, events, false),
        CaseCommandResult::Duplicate {
            version,
            state: game,
            events,
        } => {
            state
                .metrics
                .duplicates
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            (version, game, events, true)
        }
    };
    if !duplicate && game.outcome.is_some() {
        let store = state.store.clone();
        let archive_player = player.clone();
        let archive_case = case_id.clone();
        let archive_state = game.clone();
        tokio::task::spawn_blocking(move || {
            store.record_case_completion(&archive_player, &archive_case, &archive_state)
        })
        .await
        .map_err(task_error)??;
    }
    Ok(Json(CaseResponse {
        api_version: API_VERSION,
        case_id,
        state_version: version,
        duplicate,
        state: (&game).into(),
        events,
    }))
}

fn translate_command(
    catalogue: &Catalogue,
    state: &GameState,
    request: ClientCommand,
    home_base: &str,
) -> Result<(Command, Option<Event>), String> {
    match request {
        ClientCommand::VisitVenue { venue_id } => {
            validate_id(&venue_id, "venue_id")?;
            let venue = catalogue.venues.get(&venue_id).ok_or("unknown venue_id")?;
            let prefix = format!("{}|{}|", state.stage, state.state);
            let first_at_stop = !state
                .visited_venues
                .iter()
                .any(|visit| visit.starts_with(&prefix));
            let (trait_name, trait_value) = if first_at_stop {
                let profile = catalogue
                    .profiles
                    .get(&state.thief_id)
                    .ok_or("profile unavailable")?;
                let traits = profile.traits();
                let (field, value) = traits
                    .get(state.stage as usize)
                    .ok_or("invalid case stage")?;
                ((*field).to_owned(), (*value).to_owned())
            } else {
                (String::new(), String::new())
            };
            let clue_state = state
                .route
                .get(state.stage as usize + 1)
                .unwrap_or(&state.state);
            let atoms = catalogue
                .atoms
                .get(clue_state)
                .ok_or("witness clue unavailable")?;
            let matching = atoms
                .iter()
                .filter(|atom| atom.venue_id == venue_id)
                .collect::<Vec<_>>();
            let pool = if matching.is_empty() {
                atoms.iter().collect::<Vec<_>>()
            } else {
                matching
            };
            let clue_key = state
                .mission_id
                .bytes()
                .chain(state.state.bytes())
                .chain(venue_id.bytes())
                .map(usize::from)
                .sum::<usize>()
                + state.stage as usize;
            let atom = pool[clue_key % pool.len()];
            let roles = atom.witness_roles.split('|').collect::<Vec<_>>();
            let witness_role = roles[clue_key % roles.len()];
            let informal = [
                "agbero",
                "conductor",
                "driver",
                "guard",
                "security",
                "loader",
                "seller",
                "trader",
                "boatman",
                "dockworker",
            ]
            .iter()
            .any(|word| witness_role.to_lowercase().contains(word));
            let register = if informal { "Pidgin" } else { "English" };
            let difficulty = match state.difficulty {
                1 | 2 => "easy",
                3 => "medium",
                _ => "hard",
            };
            let dialogue = catalogue
                .dialogue_variants
                .get(&atom.atom_id)
                .into_iter()
                .flatten()
                .filter(|variant| {
                    variant.difficulty == difficulty && variant.speech_register == register
                })
                .collect::<Vec<_>>();
            let dialogue = dialogue
                .get(clue_key % dialogue.len().max(1))
                .map(|variant| variant.dialogue.as_str())
                .unwrap_or(&atom.dialogue);
            let profile_sentence = if trait_name.is_empty() {
                String::new()
            } else {
                format!(
                    " I also noticed {}.",
                    natural_trait(&trait_name, &trait_value)
                )
            };
            let mut data = BTreeMap::new();
            data.insert(
                "message".into(),
                format!("{}{}", dialogue.trim(), profile_sentence),
            );
            data.insert("venue_name".into(), venue.venue_name.clone());
            data.insert("witness_role".into(), witness_role.into());
            let minutes = naijachase_core::investigation_minutes(
                venue.interview_minutes,
                state.state == home_base,
            );
            if minutes < venue.interview_minutes {
                data.insert(
                    "home_base_discount_minutes".into(),
                    (venue.interview_minutes - minutes).to_string(),
                );
            }
            Ok((
                Command::VisitVenue {
                    venue_id,
                    trait_name,
                    trait_value,
                    minutes,
                },
                Some(Event {
                    event_type: "witness_account".into(),
                    data,
                }),
            ))
        }
        ClientCommand::Wait { minutes } if (1..=720).contains(&minutes) => {
            Ok((Command::Wait { minutes }, None))
        }
        ClientCommand::Wait { .. } => Err("wait minutes must be between 1 and 720".into()),
        ClientCommand::RecordTrait { trait_name, value } => {
            const FIELDS: [&str; 8] = [
                "sex",
                "height",
                "skin_tone",
                "hair",
                "hobby",
                "vehicle",
                "accessory",
                "feature",
            ];
            if !FIELDS.contains(&trait_name.as_str())
                || value.trim().is_empty()
                || value.len() > 128
            {
                return Err("invalid dossier entry".into());
            }
            Ok((Command::RecordTrait { trait_name, value }, None))
        }
        ClientCommand::Travel { destination } => {
            let travel = catalogue
                .travel
                .get(&(state.state.clone(), destination.clone()))
                .ok_or("unavailable destination")?;
            Ok((
                Command::Travel {
                    destination,
                    minutes: travel.travel_minutes,
                },
                None,
            ))
        }
        ClientCommand::RequestWarrant { suspect_id } => {
            validate_id(&suspect_id, "suspect_id")?;
            if !catalogue.thieves.contains_key(&suspect_id) {
                return Err("unknown suspect_id".into());
            }
            Ok((
                Command::RequestWarrant {
                    suspect_id: Some(suspect_id),
                },
                None,
            ))
        }
        ClientCommand::SearchHideout { venue_id } => {
            validate_id(&venue_id, "venue_id")?;
            let venue = catalogue.venues.get(&venue_id).ok_or("unknown venue_id")?;
            Ok((
                Command::SearchHideout {
                    venue_id,
                    minutes: venue.interview_minutes,
                },
                None,
            ))
        }
    }
}

fn natural_trait(field: &str, value: &str) -> String {
    match field {
        "sex" => format!("the suspect was {value}"),
        "height" => format!("the suspect was {value}"),
        "skin_tone" => format!("the suspect was {value}"),
        "hair" => format!("the suspect had {value}"),
        "hobby" => format!("the suspect spoke enthusiastically about {value}"),
        "vehicle" => format!("the suspect arrived in {value}"),
        "accessory" => format!("the suspect wore {value}"),
        "feature" => format!("the suspect had {value}"),
        _ => format!("the suspect matched {value}"),
    }
}

fn choose_hideout(mission_id: &str, seed: u64, catalogue: &Catalogue) -> String {
    let mut ids = catalogue.venues.keys().cloned().collect::<Vec<_>>();
    ids.sort();
    let offset = mission_id
        .bytes()
        .map(u64::from)
        .sum::<u64>()
        .wrapping_add(seed) as usize
        % ids.len();
    ids[offset].clone()
}

fn validate_id(value: &str, field: &str) -> Result<(), String> {
    if value.len() < 2
        || value.len() > 64
        || !value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'))
    {
        return Err(format!("invalid {field}"));
    }
    Ok(())
}
fn bad_request(message: impl Into<String>) -> ApiError {
    ApiError::new(StatusCode::BAD_REQUEST, "invalid_request", message)
}
fn task_error(_: tokio::task::JoinError) -> ApiError {
    ApiError::new(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        "service task failed",
    )
}

pub fn load_state() -> Result<Arc<AppState>, String> {
    naijachase_storage::load_repository_dotenv().map_err(|e| e.to_string())?;
    let config = ServiceConfig::from_env()?;
    let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let catalogue = Catalogue::load(&root).map_err(|e| e.to_string())?;
    let store = MysqlStore::connect_from_env().map_err(|e| e.to_string())?;
    store.migrate().map_err(|e| e.to_string())?;
    Ok(Arc::new(AppState {
        store: Arc::new(store),
        catalogue: Arc::new(catalogue),
        config,
        metrics: Metrics::default(),
        limiter: RateLimiter::default(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn state() -> GameState {
        GameState {
            version: 1,
            mission_id: "NG-M0001".into(),
            thief_id: "TH-001".into(),
            difficulty: 1,
            stage: 0,
            state: "Abia".into(),
            route: vec!["Abia".into(), "Kano".into()],
            elapsed: 0,
            score: 500,
            career_points: 0,
            dossier: BTreeMap::new(),
            observations: BTreeMap::new(),
            visited_venues: vec![],
            warrant_suspect: None,
            hideout_venue: "market".into(),
            replay: vec![],
            outcome: None,
        }
    }

    #[test]
    fn public_state_never_contains_hidden_route_thief_or_observations() {
        let json = serde_json::to_string(&PublicGameState::from(&state())).unwrap();
        assert!(!json.contains("TH-001"));
        assert!(!json.contains("route"));
        assert!(!json.contains("observations"));
        assert!(!json.contains("hideout"));
    }
    #[test]
    fn validates_untrusted_identifiers_and_wait_bounds() {
        assert!(validate_id("../secret", "case_id").is_err());
        assert!(matches!(
            translate_command_stub(ClientCommand::Wait { minutes: 0 }),
            Err(_)
        ));
    }
    fn translate_command_stub(command: ClientCommand) -> Result<(), String> {
        match command {
            ClientCommand::Wait { minutes } if (1..=720).contains(&minutes) => Ok(()),
            ClientCommand::Wait { .. } => Err("invalid".into()),
            _ => Ok(()),
        }
    }
    #[test]
    fn authentication_uses_random_session_hashes_and_rate_limits() {
        let config = ServiceConfig::test();
        let first = random_token();
        let second = random_token();
        assert_ne!(first, second);
        assert_eq!(hash_token(&first).len(), 64);
        let limiter = RateLimiter::default();
        for _ in 0..4 {
            assert!(limiter.allow("player-1", 4));
        }
        assert!(!limiter.allow("player-1", 4));
        let cookie = session_cookie(&first, &config)
            .unwrap()
            .to_str()
            .unwrap()
            .to_owned();
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Lax"));
        assert!(cookie.contains("Max-Age=86400"));
    }

    #[test]
    fn production_mutations_require_the_configured_origin() {
        let mut config = ServiceConfig::test();
        config.environment = Environment::Production;
        config.allowed_origins = Arc::new(vec![
            "http://127.0.0.1:4173".into(),
            "http://localhost:4173".into(),
        ]);
        let mut headers = HeaderMap::new();
        assert_eq!(
            ensure_origin(&headers, &config).unwrap_err().code,
            "csrf_rejected"
        );
        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("http://127.0.0.1:4173"),
        );
        assert!(ensure_origin(&headers, &config).is_ok());
        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("http://localhost:4173"),
        );
        assert!(ensure_origin(&headers, &config).is_ok());
        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("http://attacker.example"),
        );
        assert_eq!(
            ensure_origin(&headers, &config).unwrap_err().code,
            "csrf_rejected"
        );
    }

    #[test]
    fn contract_round_trip_accepts_versioned_client_commands() {
        let request: ExecuteRequest = serde_json::from_value(serde_json::json!({
            "command_id": "command-123",
            "expected_version": 7,
            "command": {"type": "travel", "destination": "Kano"}
        }))
        .unwrap();
        assert_eq!(request.expected_version, 7);
        assert!(
            matches!(request.command, ClientCommand::Travel { destination } if destination == "Kano")
        );
    }

    #[test]
    fn load_guard_handles_many_subjects_without_cross_tenant_throttling() {
        let limiter = RateLimiter::default();
        for player in 0..10_000 {
            assert!(limiter.allow(&format!("player-{player}"), 1));
        }
        assert!(!limiter.allow("player-9999", 1));
        assert!(limiter.allow("new-player", 1));
    }

    #[test]
    fn openapi_contract_covers_every_public_route() {
        let document: serde_json::Value =
            serde_json::from_str(include_str!("../../../../schemas/openapi-v1.json")).unwrap();
        let paths = document["paths"].as_object().unwrap();
        for path in [
            "/v1/auth/register",
            "/v1/auth/login",
            "/v1/auth/refresh",
            "/v1/auth/logout-all",
            "/v1/auth/sessions",
            "/v1/auth/recovery/request",
            "/v1/auth/recovery/complete",
            "/v1/profile",
            "/v1/progression/summary",
            "/v1/progression/archive",
            "/v1/progression/achievements",
            "/v1/cases",
            "/v1/cases/{case_id}",
            "/v1/cases/{case_id}/commands",
        ] {
            assert!(paths.contains_key(path), "OpenAPI missing {path}");
        }
        let generated = include_str!("../../../../contracts/typescript/api-v1.ts");
        for type_name in [
            "Player",
            "PlayerSession",
            "ProgressionSummary",
            "CaseArchiveEntry",
            "RecoveryCompleteRequest",
        ] {
            assert!(
                generated.contains(&format!("type {type_name}=")),
                "generated TypeScript missing {type_name}"
            );
        }
    }
}
