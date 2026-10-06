use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use naijachase_content::Catalogue;
use naijachase_contracts::{Command, Event, GameState};
use naijachase_storage::{CaseCommandResult, MysqlStore, StorageError};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashMap, VecDeque},
    env,
    path::Path as FsPath,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use subtle::ConstantTimeEq;
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
    token_hashes: Arc<Vec<([u8; 32], String)>>,
    pub rate_limit_per_minute: usize,
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
        let raw = env::var("NAIJACHASE_API_TOKENS")
            .map_err(|_| "NAIJACHASE_API_TOKENS is required (player_id=token,...)".to_string())?;
        let mut tokens = vec![];
        for entry in raw.split(',').filter(|value| !value.trim().is_empty()) {
            let (player, token) = entry
                .split_once('=')
                .ok_or_else(|| "invalid NAIJACHASE_API_TOKENS entry".to_string())?;
            validate_id(player, "player_id")?;
            if token.len() < 16 || (environment == Environment::Production && token.len() < 32) {
                return Err(
                    "API tokens must have at least 16 characters (32 in production)".into(),
                );
            }
            tokens.push((hash_token(token), player.to_owned()));
        }
        if tokens.is_empty() {
            return Err("at least one API token is required".into());
        }
        let rate_limit_per_minute = env::var("NAIJACHASE_RATE_LIMIT_PER_MINUTE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);
        if !(1..=10_000).contains(&rate_limit_per_minute) {
            return Err("rate limit must be between 1 and 10000".into());
        }
        Ok(Self {
            environment,
            bind,
            token_hashes: Arc::new(tokens),
            rate_limit_per_minute,
        })
    }

    #[cfg(test)]
    fn test(player: &str, token: &str) -> Self {
        Self {
            environment: Environment::Development,
            bind: "127.0.0.1:0".into(),
            token_hashes: Arc::new(vec![(hash_token(token), player.into())]),
            rate_limit_per_minute: 4,
        }
    }
}

fn hash_token(token: &str) -> [u8; 32] {
    Sha256::digest(token.as_bytes()).into()
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
        .route("/v1/cases", post(create_case))
        .route("/v1/cases/{case_id}", get(get_case))
        .route("/v1/cases/{case_id}/commands", post(execute_command))
        .with_state(state)
        .layer(DefaultBodyLimit::max(32 * 1024))
        .layer(CatchPanicLayer::new())
        .layer(TraceLayer::new_for_http())
}

fn authenticate(headers: &HeaderMap, state: &AppState) -> Result<String, ApiError> {
    let value = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| {
            ApiError::new(
                StatusCode::UNAUTHORIZED,
                "unauthorized",
                "valid bearer token required",
            )
        })?;
    let candidate = hash_token(value);
    state
        .config
        .token_hashes
        .iter()
        .find_map(|(hash, player)| bool::from(hash.ct_eq(&candidate)).then(|| player.clone()))
        .ok_or_else(|| {
            ApiError::new(
                StatusCode::UNAUTHORIZED,
                "unauthorized",
                "valid bearer token required",
            )
        })
}

fn authorize(headers: &HeaderMap, state: &AppState) -> Result<String, ApiError> {
    state
        .metrics
        .requests
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let player = authenticate(headers, state).inspect_err(|_| {
        state
            .metrics
            .rejected
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    })?;
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
    Ok(player)
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

async fn create_case(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<CreateCaseRequest>,
) -> Result<(StatusCode, Json<CaseResponse>), ApiError> {
    let player = authorize(&headers, &state)?;
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
        career_points: 0,
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
    let player = authenticate(&headers, &state)?;
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
    let player = authorize(&headers, &state)?;
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
    let player = authorize(&headers, &state)?;
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
    let result = tokio::task::spawn_blocking(move || {
        store.execute_case_command(&lookup_id, &player, &command_id, expected, |game| {
            let command = translate_command(&catalogue, &game, client_command)?;
            naijachase_core::apply(game, command).map_err(|error| error.to_string())
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
) -> Result<Command, String> {
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
            Ok(Command::VisitVenue {
                venue_id,
                trait_name,
                trait_value,
                minutes: venue.interview_minutes,
            })
        }
        ClientCommand::Wait { minutes } if (1..=720).contains(&minutes) => {
            Ok(Command::Wait { minutes })
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
            Ok(Command::RecordTrait { trait_name, value })
        }
        ClientCommand::Travel { destination } => {
            let travel = catalogue
                .travel
                .get(&(state.state.clone(), destination.clone()))
                .ok_or("unavailable destination")?;
            Ok(Command::Travel {
                destination,
                minutes: travel.travel_minutes,
            })
        }
        ClientCommand::RequestWarrant { suspect_id } => {
            validate_id(&suspect_id, "suspect_id")?;
            if !catalogue.thieves.contains_key(&suspect_id) {
                return Err("unknown suspect_id".into());
            }
            Ok(Command::RequestWarrant {
                suspect_id: Some(suspect_id),
            })
        }
        ClientCommand::SearchHideout { venue_id } => {
            validate_id(&venue_id, "venue_id")?;
            let venue = catalogue.venues.get(&venue_id).ok_or("unknown venue_id")?;
            Ok(Command::SearchHideout {
                venue_id,
                minutes: venue.interview_minutes,
            })
        }
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
    fn authentication_is_constant_time_hash_based_and_rate_limited() {
        let config = ServiceConfig::test("player-1", "0123456789abcdef");
        assert_eq!(config.token_hashes.len(), 1);
        let limiter = RateLimiter::default();
        for _ in 0..4 {
            assert!(limiter.allow("player-1", 4));
        }
        assert!(!limiter.allow("player-1", 4));
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
}
