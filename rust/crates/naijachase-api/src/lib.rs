mod email_templates;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::SaltString};
use axum::{
    BoxError, Json, Router,
    error_handling::HandleErrorLayer,
    extract::{DefaultBodyLimit, Path, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use naijachase_content::{Catalogue, Mission};
use naijachase_contracts::{Command, Event, GameState};
use naijachase_storage::{
    Achievement, BirthDate, CaseArchiveEntry, CaseCommandResult, CatalogueHealth,
    CatalogueProgress, EmailMessage, MissionValidation, MysqlStore, PlayerAccount, PlayerSession,
    ProgressionSummary, ReleaseNotification, StorageError,
};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    env,
    path::Path as FsPath,
    sync::Arc,
    time::Duration,
};
use tower::ServiceBuilder;
use tower_http::{catch_panic::CatchPanicLayer, trace::TraceLayer};

pub const API_VERSION: &str = "v1";

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientCommand {
    HireAssistant,
    VisitVenue {
        venue_id: String,
        #[serde(default = "default_drive")]
        mode: String,
    },
    Wait {
        minutes: u32,
    },
    RecordTrait {
        trait_name: String,
        value: String,
    },
    Travel {
        destination: String,
        #[serde(default = "default_fly")]
        mode: String,
    },
    RequestWarrant {
        suspect_id: String,
    },
    SearchHideout {
        venue_id: String,
        #[serde(default = "default_drive")]
        mode: String,
    },
}
fn default_drive() -> String {
    "drive".into()
}
fn default_fly() -> String {
    "fly".into()
}

#[derive(Debug, Default, Deserialize)]
pub struct AssignCaseRequest {}

#[derive(Debug, Deserialize)]
pub struct ReplayCaseRequest {
    pub mission_id: String,
}

#[derive(Debug, Deserialize)]
pub struct AbandonCaseRequest {
    pub expected_version: u64,
}

#[derive(Debug, Deserialize)]
pub struct MissionTransitionRequest {
    pub target_status: String,
    pub scheduled_for: Option<String>,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct TransportQuote {
    pub scope: String,
    pub destination_id: String,
    pub label: String,
    pub mode: String,
    pub cost: u32,
    pub travel_minutes: u32,
    pub wait_minutes: u32,
    /// Time spent questioning the witness or searching once there; the case clock advances by this as well.
    pub interview_minutes: u32,
    pub affordable: bool,
    pub rules_version: u16,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct DossierOptionField {
    pub field: String,
    pub label: String,
    pub options: Vec<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct DossierOptionsResponse {
    pub catalogue_version: u16,
    pub fields: Vec<DossierOptionField>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct AssistantRoutesResponse {
    pub suggestions: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteRequest {
    pub command_id: String,
    pub expected_version: u64,
    pub command: ClientCommand,
}
#[derive(Debug, Deserialize)]
pub struct PressureWitnessRequest {
    pub command_id: String,
    pub expected_version: u64,
    pub venue_id: String,
    pub method: String,
}
#[derive(Debug, Deserialize)]
pub struct CooperationPreferencesRequest {
    enabled: bool,
    #[serde(default)]
    email_enabled: bool,
}
#[derive(Debug, Deserialize)]
pub struct CooperationCreateRequest {
    command_id: String,
    case_id: String,
    venue_id: String,
    helper_username: String,
}
#[derive(Debug, Deserialize)]
pub struct CooperationCompleteRequest {
    recommendation: String,
}
#[derive(Debug, Deserialize)]
pub struct CooperationUsernameRequest {
    username: String,
}
#[derive(Debug, Deserialize)]
pub struct CooperationReportRequest {
    username: String,
    category: String,
    details: Option<String>,
}
#[derive(Debug, Deserialize)]
pub struct CreateGroupRequest {
    name: String,
    capacity: Option<u16>,
}
#[derive(Debug, Deserialize)]
pub struct InviteGroupRequest {
    username: String,
}
#[derive(Debug, Deserialize)]
pub struct InvitationResponseRequest {
    accept: bool,
}
#[derive(Debug, Deserialize)]
pub struct TransferOwnerRequest {
    player_id: String,
}
#[derive(Debug, Deserialize)]
pub struct ManageMemberRequest {
    player_id: String,
    role: Option<String>,
}
#[derive(Debug, Deserialize)]
pub struct WeeklyNotificationRequest {
    web: bool,
    email: bool,
}
#[derive(Debug, Deserialize)]
pub struct CancelChallengeRequest {
    reason: String,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    email: String,
    password: String,
    confirm_password: String,
    username: String,
    home_base: String,
    dob_day: u32,
    dob_month: u32,
    dob_year: u32,
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
pub struct ResendConfirmationRequest {
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
#[derive(Debug, Deserialize)]
pub struct AvatarSelectionRequest {
    avatar_id: String,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
pub struct AvatarPreset {
    pub avatar_id: &'static str,
    pub label: &'static str,
    pub presentation: &'static str,
    pub skin_tone: &'static str,
    pub skin_color: &'static str,
    pub hair_style: &'static str,
    pub hair_color: &'static str,
    pub uniform_primary: &'static str,
    pub uniform_secondary: &'static str,
    pub uniform_accent: &'static str,
}

#[derive(Debug, Serialize)]
pub struct AvatarCatalogueResponse {
    catalogue_version: u16,
    renderer: &'static str,
    options: &'static [AvatarPreset],
}

#[derive(Debug, Serialize)]
pub struct AvatarProfileResponse {
    catalogue_version: u16,
    setup_complete: bool,
    selected_avatar_id: Option<String>,
    selected: Option<AvatarPreset>,
}

const AVATAR_PRESETS: [AvatarPreset; 10] = [
    AvatarPreset {
        avatar_id: "avatar-01",
        label: "Emerald Braids",
        presentation: "feminine",
        skin_tone: "deep",
        skin_color: "#4A2B20",
        hair_style: "braided_bun",
        hair_color: "#18120F",
        uniform_primary: "#176B4D",
        uniform_secondary: "#F4E8C1",
        uniform_accent: "#E5B94B",
    },
    AvatarPreset {
        avatar_id: "avatar-02",
        label: "Midnight Low Cut",
        presentation: "masculine",
        skin_tone: "rich_deep",
        skin_color: "#5A3325",
        hair_style: "low_cut",
        hair_color: "#17120F",
        uniform_primary: "#172B4D",
        uniform_secondary: "#E8EDF2",
        uniform_accent: "#D8A83D",
    },
    AvatarPreset {
        avatar_id: "avatar-03",
        label: "Burgundy Wrap",
        presentation: "feminine",
        skin_tone: "medium_deep",
        skin_color: "#704735",
        hair_style: "head_wrap",
        hair_color: "#241815",
        uniform_primary: "#762A45",
        uniform_secondary: "#F4E6D4",
        uniform_accent: "#DCA94A",
    },
    AvatarPreset {
        avatar_id: "avatar-04",
        label: "Forest Coils",
        presentation: "masculine",
        skin_tone: "deep",
        skin_color: "#3E251D",
        hair_style: "short_coils",
        hair_color: "#15110F",
        uniform_primary: "#244B36",
        uniform_secondary: "#E8DFC9",
        uniform_accent: "#CB8E3B",
    },
    AvatarPreset {
        avatar_id: "avatar-05",
        label: "Cobalt Bob",
        presentation: "feminine",
        skin_tone: "medium",
        skin_color: "#8B5A43",
        hair_style: "bob",
        hair_color: "#211714",
        uniform_primary: "#2457A6",
        uniform_secondary: "#F2E9D8",
        uniform_accent: "#F0B84B",
    },
    AvatarPreset {
        avatar_id: "avatar-06",
        label: "Copper Fade",
        presentation: "masculine",
        skin_tone: "medium_light",
        skin_color: "#A96F50",
        hair_style: "fade",
        hair_color: "#2A1D18",
        uniform_primary: "#A64B2A",
        uniform_secondary: "#F3E7D1",
        uniform_accent: "#243B53",
    },
    AvatarPreset {
        avatar_id: "avatar-07",
        label: "Teal Twists",
        presentation: "feminine",
        skin_tone: "rich_deep",
        skin_color: "#593426",
        hair_style: "shoulder_twists",
        hair_color: "#191310",
        uniform_primary: "#167A7A",
        uniform_secondary: "#E9F1E8",
        uniform_accent: "#D7A83E",
    },
    AvatarPreset {
        avatar_id: "avatar-08",
        label: "Gold Crop",
        presentation: "masculine",
        skin_tone: "light",
        skin_color: "#C88968",
        hair_style: "close_crop",
        hair_color: "#33231D",
        uniform_primary: "#A87916",
        uniform_secondary: "#FFF1CE",
        uniform_accent: "#283B62",
    },
    AvatarPreset {
        avatar_id: "avatar-09",
        label: "Plum Locs",
        presentation: "feminine",
        skin_tone: "medium_deep",
        skin_color: "#704632",
        hair_style: "short_locs",
        hair_color: "#1D1512",
        uniform_primary: "#65345F",
        uniform_secondary: "#F1E5EC",
        uniform_accent: "#D7A33F",
    },
    AvatarPreset {
        avatar_id: "avatar-10",
        label: "Slate Waves",
        presentation: "masculine",
        skin_tone: "medium",
        skin_color: "#8C5B43",
        hair_style: "short_waves",
        hair_color: "#211713",
        uniform_primary: "#465568",
        uniform_secondary: "#E8EDF0",
        uniform_accent: "#B88A35",
    },
];

fn avatar_preset(avatar_id: &str) -> Option<AvatarPreset> {
    AVATAR_PRESETS
        .iter()
        .copied()
        .find(|preset| preset.avatar_id == avatar_id)
}
#[derive(Serialize)]
pub struct AuthResponse {
    player: PlayerAccount,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct CaseDossier {
    pub title: String,
    pub stolen_item: String,
    pub premise: String,
    pub opening_briefing: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct SuspectPortrait {
    pub skin_color: String,
    pub hair_style: String,
    pub hair_color: String,
    pub background_color: String,
    pub presentation: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct SuspectFile {
    pub suspect_id: String,
    pub name: String,
    pub alias: String,
    pub dossier: BTreeMap<String, String>,
    pub summary: String,
    pub portrait: SuspectPortrait,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct PublicGameState {
    pub mission_id: String,
    pub case_dossier: CaseDossier,
    pub difficulty: u8,
    pub stage: u8,
    pub current_state: String,
    pub trail_status: String,
    pub elapsed: u32,
    pub score: u32,
    pub career_points: u32,
    pub dossier: BTreeMap<String, String>,
    pub visited_venues: Vec<String>,
    pub searched_hideouts: Vec<String>,
    pub warrant_suspect: Option<String>,
    pub suspect_files: Vec<SuspectFile>,
    pub resolved_thief_name: Option<String>,
    pub outcome: Option<String>,
    pub opening_budget: u32,
    pub balance: u32,
    pub transport_rules_version: u16,
    pub assistant_hired: bool,
    pub assistant_available: bool,
    pub assistant_cost: u32,
}

fn public_game_state(
    state: &GameState,
    catalogue: &Catalogue,
) -> Result<PublicGameState, ApiError> {
    let narrative = catalogue
        .narratives
        .get(&state.mission_id)
        .ok_or_else(|| bad_request("case dossier unavailable"))?;
    Ok(PublicGameState {
        mission_id: state.mission_id.clone(),
        case_dossier: CaseDossier {
            title: narrative.title.clone(),
            stolen_item: narrative.stolen_item.clone(),
            premise: narrative.premise.clone(),
            opening_briefing: narrative.opening_briefing.clone(),
        },
        difficulty: state.difficulty,
        stage: state.stage,
        current_state: state.state.clone(),
        trail_status: if is_on_trail(state) { "hot" } else { "cold" }.into(),
        elapsed: state.elapsed,
        score: state.score,
        career_points: state.career_points,
        dossier: state.dossier.clone(),
        visited_venues: state.visited_venues.clone(),
        searched_hideouts: state.searched_hideouts.clone(),
        warrant_suspect: state.warrant_suspect.clone(),
        suspect_files: suspect_files(state, catalogue),
        resolved_thief_name: state
            .outcome
            .as_ref()
            .and_then(|_| catalogue.thieves.get(&state.thief_id))
            .map(|thief| thief.name.clone()),
        outcome: state.outcome.clone(),
        opening_budget: state.economy.opening_budget,
        balance: state.economy.balance,
        transport_rules_version: state.economy.rules_version,
        assistant_hired: state.economy.assistant_hired,
        assistant_available: state.outcome.is_none()
            && !state.economy.assistant_hired
            && state.visited_venues.is_empty()
            && naijachase_core::rank(state.career_points) != "Rookie",
        assistant_cost: state.economy.opening_budget.div_ceil(3),
    })
}

fn suspect_files(state: &GameState, catalogue: &Catalogue) -> Vec<SuspectFile> {
    if state.stage as usize != state.route.len().saturating_sub(1) || state.dossier.len() < 8 {
        return vec![];
    }
    let Some(target) = catalogue.profiles.get(&state.thief_id) else {
        return vec![];
    };
    let target_traits = target.traits();
    let mut candidates = catalogue
        .profiles
        .values()
        .filter(|profile| profile.thief_id != state.thief_id)
        .map(|profile| {
            let distance = target_traits
                .iter()
                .zip(profile.traits())
                .filter(|((_, expected), (_, candidate))| expected != candidate)
                .count();
            let tie = Sha256::digest(
                format!("suspect-file|{}|{}", state.mission_id, profile.thief_id).as_bytes(),
            );
            (distance, tie.to_vec(), profile)
        })
        .filter(|(distance, _, _)| (1..=2).contains(distance))
        .collect::<Vec<_>>();
    candidates.sort_by(|a, b| (a.0, &a.1).cmp(&(b.0, &b.1)));
    let mut selected = vec![target];
    selected.extend(
        candidates
            .into_iter()
            .take(2)
            .map(|(_, _, profile)| profile),
    );
    selected.sort_by_key(|profile| {
        Sha256::digest(
            format!("suspect-position|{}|{}", state.mission_id, profile.thief_id).as_bytes(),
        )
        .to_vec()
    });
    selected
        .into_iter()
        .filter_map(|profile| {
            let thief = catalogue.thieves.get(&profile.thief_id)?;
            let dossier = profile
                .traits()
                .into_iter()
                .map(|(field, value)| (field.to_owned(), value.to_owned()))
                .collect();
            let digest = Sha256::digest(profile.thief_id.as_bytes());
            let skin_color = match profile.skin_tone.as_str() {
                "light-skinned" => "#9b5f3f",
                _ => "#57351f",
            };
            let backgrounds = ["#315f6b", "#65513a", "#4f416b", "#365c48", "#6b3f46"];
            Some(SuspectFile {
                suspect_id: profile.thief_id.clone(),
                name: thief.name.clone(),
                alias: thief.alias.clone(),
                dossier,
                summary: format!(
                    "{}, known as {}, is {}, {}, and {}. Records associate this suspect with {}, {}, {}, {}, and a person who {}.",
                    thief.name,
                    thief.alias,
                    profile.sex,
                    profile.height,
                    profile.skin_tone,
                    profile.hair,
                    profile.hobby,
                    profile.vehicle,
                    profile.accessory,
                    profile.feature
                ),
                portrait: SuspectPortrait {
                    skin_color: skin_color.into(),
                    hair_style: profile.hair.clone(),
                    hair_color: if digest[0] % 4 == 0 { "#33241d" } else { "#15120f" }.into(),
                    background_color: backgrounds[usize::from(digest[1]) % backgrounds.len()].into(),
                    presentation: profile.sex.clone(),
                },
            })
        })
        .collect()
}

#[derive(Debug, Serialize)]
pub struct CaseResponse {
    pub api_version: &'static str,
    pub case_id: String,
    pub state_version: u64,
    pub duplicate: bool,
    pub attempt_kind: String,
    pub state: PublicGameState,
    pub events: Vec<Event>,
}

#[derive(Debug, Serialize)]
pub struct CurrentCaseResponse {
    pub has_ongoing_case: bool,
    pub case: Option<CaseResponse>,
}

#[derive(Debug, Serialize)]
pub struct PublicWeeklyAttempt {
    pub attempt_id: String,
    pub challenge_id: String,
    pub status: String,
    pub state_version: u64,
    pub state: PublicGameState,
    pub starts_at: String,
    pub ends_at: String,
    pub winner: bool,
    pub transit: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct CurrentActivityResponse {
    pub has_ongoing_activity: bool,
    pub ordinary_case: Option<CaseResponse>,
    pub replay_cases: Vec<CaseResponse>,
    pub weekly_attempts: Vec<PublicWeeklyAttempt>,
}

fn public_weekly_attempt(
    attempt: naijachase_storage::WeeklyAttemptView,
    catalogue: &Catalogue,
) -> Result<PublicWeeklyAttempt, ApiError> {
    Ok(PublicWeeklyAttempt {
        attempt_id: attempt.attempt_id,
        challenge_id: attempt.challenge_id,
        status: attempt.status,
        state_version: attempt.state_version,
        state: public_game_state(&attempt.state, catalogue)?,
        starts_at: attempt.starts_at,
        ends_at: attempt.ends_at,
        winner: attempt.winner,
        transit: attempt.transit,
    })
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
            StorageError::MissionAlreadyCompleted => Self::new(
                StatusCode::CONFLICT,
                "mission_already_completed",
                "this mission is available from the case archive as a replay",
            ),
            StorageError::ReplayNotAvailable => Self::new(
                StatusCode::CONFLICT,
                "replay_not_available",
                "only successfully completed missions can be replayed",
            ),
            StorageError::CatalogueExhausted => Self::new(
                StatusCode::CONFLICT,
                "catalogue_exhausted",
                "all currently published missions are complete; replay an archived case or return when new cases publish",
            ),
            StorageError::CaseNotAbandonable => Self::new(
                StatusCode::CONFLICT,
                "case_not_abandonable",
                "only an ongoing ordinary case can be abandoned",
            ),
            StorageError::OrdinaryCaseExists(_) => Self::new(
                StatusCode::CONFLICT,
                "ordinary_case_exists",
                "resume or abandon your ongoing ordinary case before starting another",
            ),
            StorageError::PoolTimeout => Self::new(
                StatusCode::SERVICE_UNAVAILABLE,
                "database_busy",
                "the service is busy; please try again shortly",
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
    pub request_timeout: Duration,
    pub max_concurrent_requests: usize,
    pub email_worker_count: usize,
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
        let request_timeout_seconds = bounded_setting(
            "NAIJACHASE_REQUEST_TIMEOUT_SECONDS",
            env::var("NAIJACHASE_REQUEST_TIMEOUT_SECONDS").ok(),
            25,
            1,
            120,
        )?;
        let max_concurrent_requests = bounded_setting(
            "NAIJACHASE_MAX_CONCURRENT_REQUESTS",
            env::var("NAIJACHASE_MAX_CONCURRENT_REQUESTS").ok(),
            128,
            1,
            4096,
        )?;
        let email_worker_count = bounded_setting(
            "NAIJACHASE_EMAIL_WORKERS",
            env::var("NAIJACHASE_EMAIL_WORKERS").ok(),
            4,
            1,
            32,
        )?;
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
        let cloudflare_email_api_url = env::var("CLOUDFLARE_ACCOUNT_ID")
            .map(|id| {
                format!("https://api.cloudflare.com/client/v4/accounts/{id}/email/sending/send")
            })
            .unwrap_or_default();
        let cloudflare_api_token = env::var("CLOUDFLARE_EMAIL_API_TOKEN").unwrap_or_default();
        let email_from = env::var("NAIJACHASE_EMAIL_FROM").unwrap_or_default();
        if environment != Environment::Development
            && (cloudflare_email_api_url.is_empty()
                || cloudflare_api_token.is_empty()
                || email_from.is_empty())
        {
            return Err("Cloudflare email configuration is required outside development".into());
        }
        Ok(Self {
            environment,
            bind,
            rate_limit_per_minute,
            request_timeout: Duration::from_secs(request_timeout_seconds as u64),
            max_concurrent_requests,
            email_worker_count,
            cloudflare_email_api_url,
            cloudflare_api_token,
            email_from,
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
            request_timeout: Duration::from_secs(5),
            max_concurrent_requests: 16,
            email_worker_count: 1,
            cloudflare_email_api_url: String::new(),
            cloudflare_api_token: String::new(),
            email_from: String::new(),
            public_web_url: "http://127.0.0.1:4173".into(),
            allowed_origins: Arc::new(vec!["http://127.0.0.1:4173".into()]),
        }
    }
}

fn bounded_setting(
    key: &str,
    raw: Option<String>,
    default: usize,
    minimum: usize,
    maximum: usize,
) -> Result<usize, String> {
    let Some(raw) = raw else {
        return Ok(default);
    };
    let value = raw
        .parse::<usize>()
        .map_err(|_| format!("{key} must be an integer"))?;
    if !(minimum..=maximum).contains(&value) {
        return Err(format!("{key} must be between {minimum} and {maximum}"));
    }
    Ok(value)
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
    emails_sent: std::sync::atomic::AtomicU64,
    email_failures: std::sync::atomic::AtomicU64,
}

pub struct AppState {
    pub store: Arc<MysqlStore>,
    pub catalogue: Arc<Catalogue>,
    pub config: ServiceConfig,
    metrics: Metrics,
    email_client: reqwest::Client,
}

/// Delivers durable outbox rows. Database claiming is safe across multiple API
/// instances; failed messages are returned to the queue with bounded backoff.
pub async fn email_delivery_loop(state: Arc<AppState>) {
    loop {
        let store = state.store.clone();
        let queued = match tokio::task::spawn_blocking(move || store.claim_email()).await {
            Ok(Ok(value)) => value,
            Ok(Err(error)) => {
                tracing::error!(%error, "email outbox claim failed");
                continue;
            }
            Err(error) => {
                tracing::error!(%error, "email outbox task failed");
                continue;
            }
        };
        let Some(email) = queued else {
            tokio::time::sleep(Duration::from_secs(1)).await;
            continue;
        };
        let result = send_email(
            &state.email_client,
            &state.config,
            &email.recipient,
            &email.subject,
            &email.text,
            &email.html,
        )
        .await;
        let store = state.store.clone();
        if let Err(error) = result {
            state
                .metrics
                .email_failures
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let detail = format!("{}: {}", error.code, error.message);
            tracing::error!(email_id=email.email_id, kind=%email.message_kind, attempts=email.attempts, "email delivery failed; retry scheduled");
            match tokio::task::spawn_blocking(move || {
                store.retry_email(email.email_id, email.attempts, &detail)
            })
            .await
            {
                Ok(Ok(())) => {}
                Ok(Err(error)) => tracing::error!(%error, "could not return email to outbox"),
                Err(error) => tracing::error!(%error, "email retry acknowledgement task failed"),
            }
        } else {
            state
                .metrics
                .emails_sent
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            match tokio::task::spawn_blocking(move || store.mark_email_sent(email.email_id)).await {
                Ok(Ok(())) => {}
                Ok(Err(error)) => {
                    tracing::error!(%error, email_id=email.email_id, "email was sent but outbox acknowledgement failed")
                }
                Err(error) => {
                    tracing::error!(%error, email_id=email.email_id, "email acknowledgement task failed")
                }
            }
        }
    }
}

/// Keeps persisted weekly status aligned with the authoritative wall clock even
/// when nobody opens the weekly-challenge screens after a deadline.
pub async fn weekly_expiration_loop(store: Arc<MysqlStore>) {
    let mut interval = tokio::time::interval(Duration::from_secs(60));
    loop {
        interval.tick().await;
        let store = store.clone();
        match tokio::task::spawn_blocking(move || store.expire_weekly_challenges()).await {
            Ok(Ok(expired)) if expired > 0 => {
                tracing::info!(expired, "expired weekly challenges")
            }
            Ok(Ok(_)) => {}
            Ok(Err(error)) => tracing::error!(%error, "weekly challenge expiry failed"),
            Err(error) => tracing::error!(%error, "weekly challenge expiry task failed"),
        }
    }
}

pub fn router(state: Arc<AppState>) -> Router {
    let limits = ServiceBuilder::new()
        .layer(HandleErrorLayer::new(handle_capacity_error))
        .load_shed()
        .concurrency_limit(state.config.max_concurrent_requests)
        .timeout(state.config.request_timeout);
    let application = Router::new()
        .route("/v1/auth/register", post(register))
        .route("/v1/auth/confirm", post(confirm_email))
        .route("/v1/auth/confirmation/resend", post(resend_confirmation))
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
        .route("/v1/avatar/options", get(avatar_options))
        .route("/v1/profile/avatar", get(get_avatar).put(select_avatar))
        .route("/v1/dossier/options", get(dossier_options))
        .route("/v1/progression/archive", get(case_archive))
        .route("/v1/progression/achievements", get(achievements))
        .route("/v1/progression/summary", get(progression_summary))
        .route(
            "/v1/cooperation/preferences",
            get(cooperation_preferences).put(update_cooperation_preferences),
        )
        .route(
            "/v1/cooperation/requests",
            get(cooperation_requests).post(create_cooperation_request),
        )
        .route(
            "/v1/cooperation/requests/{request_id}/accept",
            post(accept_cooperation_request),
        )
        .route(
            "/v1/cooperation/requests/{request_id}/decline",
            post(decline_cooperation_request),
        )
        .route(
            "/v1/cooperation/requests/{request_id}/complete",
            post(complete_cooperation_request),
        )
        .route(
            "/v1/cooperation/requests/{request_id}/acknowledge",
            post(acknowledge_cooperation_request),
        )
        .route(
            "/v1/cooperation/blocks",
            get(cooperation_blocks).post(cooperation_block),
        )
        .route(
            "/v1/cooperation/blocks/{player_id}",
            axum::routing::delete(cooperation_unblock),
        )
        .route("/v1/cooperation/reports", post(cooperation_report))
        .route("/v1/cooperation/reputation", get(cooperation_reputation))
        .route("/v1/groups", post(create_group))
        .route("/v1/groups/{group_id}", get(group_details))
        .route("/v1/groups/{group_id}/delete", post(delete_group))
        .route("/v1/groups/{group_id}/members", post(manage_group_member))
        .route(
            "/v1/groups/{group_id}/invitations",
            post(invite_group_member),
        )
        .route(
            "/v1/groups/invitations/{invitation_id}",
            post(respond_group_invitation),
        )
        .route("/v1/group-invitations", get(group_invitations))
        .route("/v1/groups/{group_id}/leave", post(leave_group))
        .route(
            "/v1/groups/{group_id}/transfer-ownership",
            post(transfer_group_ownership),
        )
        .route(
            "/v1/groups/{group_id}/weekly/current",
            get(current_weekly_challenge),
        )
        .route(
            "/v1/weekly/{challenge_id}/attempt",
            post(start_weekly_attempt),
        )
        .route("/v1/weekly/attempts/{attempt_id}", get(get_weekly_attempt))
        .route(
            "/v1/weekly/attempts/{attempt_id}/commands",
            post(execute_weekly_command),
        )
        .route(
            "/v1/weekly/attempts/{attempt_id}/transport-quotes",
            get(weekly_transport_quotes),
        )
        .route(
            "/v1/weekly/attempts/{attempt_id}/accounts",
            get(weekly_accounts),
        )
        .route("/v1/weekly/{challenge_id}", get(weekly_challenge_details))
        .route("/v1/weekly/{challenge_id}/events", get(weekly_events))
        .route(
            "/v1/weekly/{challenge_id}/cancel",
            post(cancel_weekly_challenge),
        )
        .route("/v1/weekly/history", get(weekly_history))
        .route(
            "/v1/weekly/notifications",
            get(weekly_notifications).put(update_weekly_notifications),
        )
        .route(
            "/v1/progression/achievement-catalog",
            get(achievement_catalog),
        )
        .route("/v1/cases", post(assign_case))
        .route("/v1/activity/current", get(current_activity))
        .route("/v1/cases/current", get(current_case))
        .route("/v1/cases/replay", post(replay_case))
        .route("/v1/cases/catalogue-status", get(catalogue_status))
        .route(
            "/v1/cases/catalogue-notifications",
            get(catalogue_notifications),
        )
        .route(
            "/v1/cases/catalogue-notifications/{notification_id}/read",
            post(read_catalogue_notification),
        )
        .route("/v1/admin/catalogue/health", get(admin_catalogue_health))
        .route("/v1/admin/catalogue/me", get(admin_catalogue_me))
        .route(
            "/v1/admin/catalogue/missions/{mission_id}",
            get(admin_mission_details),
        )
        .route(
            "/v1/admin/catalogue/missions/{mission_id}/validation",
            get(admin_validate_mission),
        )
        .route(
            "/v1/admin/catalogue/missions/{mission_id}/transition",
            post(admin_transition_mission),
        )
        .route("/v1/cases/{case_id}", get(get_case))
        .route("/v1/cases/{case_id}/abandon", post(abandon_case))
        .route(
            "/v1/cases/{case_id}/transport-quotes",
            get(transport_quotes),
        )
        .route("/v1/cases/{case_id}/ledger", get(transport_ledger))
        .route(
            "/v1/cases/{case_id}/assistant/routes",
            get(assistant_routes),
        )
        .route("/v1/cases/{case_id}/pressure", post(pressure_witness))
        .route(
            "/v1/cases/{case_id}/pressure-attempts",
            get(pressure_attempts),
        )
        .route("/v1/economy/bribe-tokens", get(bribe_token_balance))
        .route("/v1/economy/bribe-tokens/ledger", get(bribe_token_history))
        .route("/v1/discipline", get(disciplinary_history))
        .route("/v1/discipline/jail", get(jail_status))
        .route(
            "/v1/discipline/{disciplinary_case_id}/acknowledge",
            post(acknowledge_disciplinary_case),
        )
        .route("/v1/cases/{case_id}/commands", post(execute_command))
        .with_state(state.clone())
        .layer(DefaultBodyLimit::max(32 * 1024))
        .layer(limits);
    // Liveness must still answer while the gameplay service is shedding load;
    // readiness has its own bounded MySQL pool wait.
    Router::new()
        .route("/health/live", get(live))
        .route("/health/ready", get(ready))
        .route("/metrics", get(metrics))
        .with_state(state)
        .merge(application)
        .layer(CatchPanicLayer::new())
        .layer(TraceLayer::new_for_http())
}

async fn handle_capacity_error(error: BoxError) -> Response {
    if error.is::<tower::timeout::error::Elapsed>() {
        return ApiError::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "request_timed_out",
            "the service took too long to respond; please try again",
        )
        .into_response();
    }
    if error.is::<tower::load_shed::error::Overloaded>() {
        return ApiError::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "service_busy",
            "the service is busy; please try again shortly",
        )
        .into_response();
    }
    tracing::error!(%error, "unhandled middleware failure");
    ApiError::new(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        "the service could not process the request",
    )
    .into_response()
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
    let store = state.store.clone();
    let limit = state.config.rate_limit_per_minute as u32;
    let allowed = tokio::task::spawn_blocking(move || store.allow_general_request(&player, limit))
        .await
        .map_err(task_error)??;
    if !allowed {
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
        "naijachase_http_requests_total {}\nnaijachase_http_rejected_total {}\nnaijachase_commands_total {}\nnaijachase_duplicate_commands_total {}\nnaijachase_emails_sent_total {}\nnaijachase_email_failures_total {}\n",
        state.metrics.requests.load(Relaxed),
        state.metrics.rejected.load(Relaxed),
        state.metrics.commands.load(Relaxed),
        state.metrics.duplicates.load(Relaxed),
        state.metrics.emails_sent.load(Relaxed),
        state.metrics.email_failures.load(Relaxed)
    )
}

async fn register(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    ensure_origin(&headers, &state.config)?;
    let birth_date = BirthDate::new(request.dob_day, request.dob_month, request.dob_year)
        .map_err(bad_request)?;
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
    let link = format!(
        "{}/?confirm={}",
        state.config.public_web_url.trim_end_matches('/'),
        verification
    );
    let content = email_templates::confirmation(&link);
    let message = EmailMessage {
        recipient: email.clone(),
        subject: content.subject.into(),
        text: content.text,
        html: content.html,
    };
    tokio::task::spawn_blocking(move || {
        store.register_player_with_email(
            &values.0, &values.1, &values.2, &values.3, &values.4, &values.5, birth_date, &message,
        )
    })
    .await
    .map_err(task_error)??;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({"message":"Account created. Confirmation email has been queued."})),
    ))
}

async fn resend_confirmation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<ResendConfirmationRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    ensure_origin(&headers, &state.config)?;
    let email = request.email.trim().to_lowercase();
    if !email.contains('@') || email.len() > 320 {
        return Err(bad_request("enter a valid email address"));
    }
    enforce_auth_limit(&state, &email, "resend_confirmation", 3).await?;
    let token = random_token();
    let link = format!(
        "{}/?confirm={}",
        state.config.public_web_url.trim_end_matches('/'),
        token
    );
    let content = email_templates::confirmation(&link);
    let message = EmailMessage {
        recipient: email.clone(),
        subject: content.subject.into(),
        text: content.text,
        html: content.html,
    };
    let store = state.store.clone();
    let token_hash = hash_token(&token);
    let queued = tokio::task::spawn_blocking(move || {
        store.resend_confirmation(&email, &token_hash, &message)
    })
    .await
    .map_err(task_error)??;
    if queued {
        tracing::info!("replacement confirmation email queued");
    }
    Ok((
        StatusCode::ACCEPTED,
        Json(serde_json::json!({
            "message":"If that account is awaiting confirmation, a new link has been queued."
        })),
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
    let link = format!(
        "{}/?reset={}",
        state.config.public_web_url.trim_end_matches('/'),
        token
    );
    let content = email_templates::password_reset(&link);
    let message = EmailMessage {
        recipient: email.clone(),
        subject: content.subject.into(),
        text: content.text,
        html: content.html,
    };
    let store = state.store.clone();
    let lookup = email.clone();
    let player = tokio::task::spawn_blocking(move || {
        store.create_password_reset_with_email(&lookup, &token_hash, &message)
    })
    .await
    .map_err(task_error)??;
    if let Some(player_id) = player {
        let store = state.store.clone();
        let _ = tokio::task::spawn_blocking(move || {
            store.security_event(Some(&player_id), "password_recovery", "requested")
        })
        .await;
    }
    Ok(Json(
        serde_json::json!({"message":"If that account exists, a recovery email has been queued."}),
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
    for value in [&request.display_name, &request.pronouns, &request.sex]
        .into_iter()
        .flatten()
    {
        if value.trim().is_empty() || value.len() > 64 {
            return Err(bad_request("profile values must be 1 to 64 characters"));
        }
    }
    if request.avatar_id.is_some() || request.uniform_id.is_some() {
        return Err(bad_request(
            "use /v1/profile/avatar to choose an avatar preset",
        ));
    }
    let store = state.store.clone();
    let player = account.player_id.clone();
    let current_avatar = account.avatar_id.clone();
    let current_uniform = account.uniform_id.clone();
    tokio::task::spawn_blocking(move || {
        store.update_profile(
            &player,
            request.display_name.as_deref(),
            request.pronouns.as_deref(),
            request.sex.as_deref(),
            current_avatar.as_deref(),
            current_uniform.as_deref(),
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

async fn avatar_options(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<AvatarCatalogueResponse>, ApiError> {
    authenticate(&headers, &state).await?;
    Ok(Json(AvatarCatalogueResponse {
        catalogue_version: 1,
        renderer: "babylon_procedural_v1",
        options: &AVATAR_PRESETS,
    }))
}

async fn dossier_options(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<DossierOptionsResponse>, ApiError> {
    authorize(&headers, &state).await?;
    Ok(Json(build_dossier_options(&state.catalogue)))
}

fn dossier_option_values(catalogue: &Catalogue, field: &str) -> Vec<String> {
    catalogue
        .profiles
        .values()
        .map(|profile| match field {
            "sex" => profile.sex.as_str(),
            "height" => profile.height.as_str(),
            "skin_tone" => profile.skin_tone.as_str(),
            "hair" => profile.hair.as_str(),
            "hobby" => profile.hobby.as_str(),
            "vehicle" => profile.vehicle.as_str(),
            "accessory" => profile.accessory.as_str(),
            "feature" => profile.feature.as_str(),
            _ => "",
        })
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn build_dossier_options(catalogue: &Catalogue) -> DossierOptionsResponse {
    let fields = [
        ("sex", "Sex"),
        ("height", "Height"),
        ("skin_tone", "Skin tone"),
        ("hair", "Hair"),
        ("hobby", "Hobby"),
        ("vehicle", "Vehicle"),
        ("accessory", "Accessory"),
        ("feature", "Distinguishing feature"),
    ]
    .into_iter()
    .map(|(field, label)| DossierOptionField {
        field: field.into(),
        label: label.into(),
        options: dossier_option_values(catalogue, field),
    })
    .collect();
    DossierOptionsResponse {
        catalogue_version: 1,
        fields,
    }
}

fn avatar_profile(account: &PlayerAccount) -> AvatarProfileResponse {
    AvatarProfileResponse {
        catalogue_version: 1,
        setup_complete: account.avatar_setup_complete,
        selected_avatar_id: account.avatar_id.clone(),
        selected: account.avatar_id.as_deref().and_then(avatar_preset),
    }
}

async fn get_avatar(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<AvatarProfileResponse>, ApiError> {
    let account = authenticate(&headers, &state).await?;
    Ok(Json(avatar_profile(&account)))
}

async fn select_avatar(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<AvatarSelectionRequest>,
) -> Result<Json<AvatarProfileResponse>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let account = authenticate(&headers, &state).await?;
    if avatar_preset(&request.avatar_id).is_none() {
        return Err(bad_request("choose one of the current avatar presets"));
    }
    let store = state.store.clone();
    let player_id = account.player_id;
    let avatar_id = request.avatar_id;
    tokio::task::spawn_blocking(move || store.select_avatar(&player_id, &avatar_id))
        .await
        .map_err(task_error)??;
    let updated = authenticate(&headers, &state).await?;
    Ok(Json(avatar_profile(&updated)))
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

async fn cooperation_preferences(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<naijachase_storage::CooperationPreferences>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.cooperation_preferences(&player))
            .await
            .map_err(task_error)??,
    ))
}
async fn update_cooperation_preferences(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<CooperationPreferencesRequest>,
) -> Result<Json<naijachase_storage::CooperationPreferences>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || {
            store.set_cooperation_preferences(&player, body.enabled, body.email_enabled)
        })
        .await
        .map_err(task_error)??,
    ))
}
async fn cooperation_requests(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<naijachase_storage::CooperationRequest>>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.cooperation_requests(&player))
            .await
            .map_err(task_error)??,
    ))
}
async fn create_cooperation_request(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<CooperationCreateRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    ensure_origin(&headers, &state.config)?;
    validate_id(&body.command_id, "command_id").map_err(bad_request)?;
    validate_id(&body.case_id, "case_id").map_err(bad_request)?;
    validate_id(&body.venue_id, "venue_id").map_err(bad_request)?;
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    let case_store = state.store.clone();
    let case_id = body.case_id.clone();
    let owner = player.clone();
    let (_, game) =
        tokio::task::spawn_blocking(move || case_store.load_owned_case(&case_id, &owner))
            .await
            .map_err(task_error)??;
    if !available_venue_ids(&state.catalogue, &game).contains(&body.venue_id)
        || game
            .visited_venues
            .iter()
            .any(|v| v.ends_with(&format!("|{}", body.venue_id)))
    {
        return Err(bad_request("venue is not available for assistance"));
    }
    let scene =
        serde_json::json!({"venue_id":body.venue_id,"jurisdiction":game.state,"stage":game.stage});
    let id = tokio::task::spawn_blocking(move || {
        store.create_cooperation_request(
            &player,
            &body.helper_username,
            &body.case_id,
            &body.venue_id,
            &body.command_id,
            &scene,
        )
    })
    .await
    .map_err(task_error)??;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({"request_id":id,"status":"pending","expires_in_seconds":43200})),
    ))
}
async fn cooperation_transition(
    state: Arc<AppState>,
    headers: HeaderMap,
    id: String,
    action: &'static str,
    recommendation: Option<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    validate_id(&id, "request_id").map_err(bad_request)?;
    if recommendation
        .as_ref()
        .is_some_and(|v| v.trim().is_empty() || v.len() > 240)
    {
        return Err(bad_request("recommendation must be 1 to 240 characters"));
    }
    let player = authorize(&headers, &state).await?.player_id;
    let value = recommendation.map(|text| serde_json::json!({"text":text}));
    let store = state.store.clone();
    tokio::task::spawn_blocking(move || {
        store.transition_cooperation_request(&player, &id, action, value.as_ref())
    })
    .await
    .map_err(task_error)??;
    Ok(Json(serde_json::json!({"status":action})))
}
async fn accept_cooperation_request(
    State(s): State<Arc<AppState>>,
    Path(id): Path<String>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    cooperation_transition(s, h, id, "accept", None).await
}
async fn decline_cooperation_request(
    State(s): State<Arc<AppState>>,
    Path(id): Path<String>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    cooperation_transition(s, h, id, "decline", None).await
}
async fn complete_cooperation_request(
    State(s): State<Arc<AppState>>,
    Path(id): Path<String>,
    h: HeaderMap,
    Json(b): Json<CooperationCompleteRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    cooperation_transition(s, h, id, "complete", Some(b.recommendation)).await
}
async fn acknowledge_cooperation_request(
    State(s): State<Arc<AppState>>,
    Path(id): Path<String>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    cooperation_transition(s, h, id, "acknowledge", None).await
}
async fn cooperation_block(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Json(b): Json<CooperationUsernameRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    tokio::task::spawn_blocking(move || store.cooperation_block(&p, &b.username))
        .await
        .map_err(task_error)??;
    Ok(Json(serde_json::json!({"blocked":true})))
}
async fn cooperation_unblock(
    State(s): State<Arc<AppState>>,
    Path(id): Path<String>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    tokio::task::spawn_blocking(move || store.cooperation_unblock(&p, &id))
        .await
        .map_err(task_error)??;
    Ok(Json(serde_json::json!({"blocked":false})))
}
async fn cooperation_blocks(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
) -> Result<Json<Vec<(String, String)>>, ApiError> {
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.cooperation_blocks(&p))
            .await
            .map_err(task_error)??,
    ))
}
async fn cooperation_report(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Json(b): Json<CooperationReportRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    let id = tokio::task::spawn_blocking(move || {
        store.cooperation_report(&p, &b.username, &b.category, b.details.as_deref())
    })
    .await
    .map_err(task_error)??;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({"report_id":id})),
    ))
}
async fn cooperation_reputation(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    let reputation = tokio::task::spawn_blocking(move || store.cooperation_reputation(&p))
        .await
        .map_err(task_error)??;
    Ok(Json(serde_json::json!({"reputation":reputation})))
}

async fn create_group(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Json(b): Json<CreateGroupRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    let id = tokio::task::spawn_blocking(move || {
        store.create_group(&p, b.name.trim(), b.capacity.unwrap_or(20))
    })
    .await
    .map_err(task_error)??;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({"group_id":id})),
    ))
}
async fn group_details(
    State(s): State<Arc<AppState>>,
    Path(id): Path<String>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.group_details(&p, &id))
            .await
            .map_err(task_error)??,
    ))
}
async fn invite_group_member(
    State(s): State<Arc<AppState>>,
    Path(group): Path<String>,
    h: HeaderMap,
    Json(b): Json<InviteGroupRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    let id =
        tokio::task::spawn_blocking(move || store.invite_group_member(&p, &group, &b.username))
            .await
            .map_err(task_error)??;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({"invitation_id":id,"expires_in_seconds":604800})),
    ))
}
async fn respond_group_invitation(
    State(s): State<Arc<AppState>>,
    Path(id): Path<String>,
    h: HeaderMap,
    Json(b): Json<InvitationResponseRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    tokio::task::spawn_blocking(move || store.respond_group_invitation(&p, &id, b.accept))
        .await
        .map_err(task_error)??;
    Ok(Json(serde_json::json!({"accepted":b.accept})))
}
async fn leave_group(
    State(s): State<Arc<AppState>>,
    Path(group): Path<String>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    tokio::task::spawn_blocking(move || store.leave_group(&p, &group))
        .await
        .map_err(task_error)??;
    Ok(Json(serde_json::json!({"left":true})))
}
async fn transfer_group_ownership(
    State(s): State<Arc<AppState>>,
    Path(group): Path<String>,
    h: HeaderMap,
    Json(b): Json<TransferOwnerRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    tokio::task::spawn_blocking(move || store.transfer_group_ownership(&p, &group, &b.player_id))
        .await
        .map_err(task_error)??;
    Ok(Json(serde_json::json!({"transferred":true})))
}
fn weekly_window(now: u64) -> (u64, u64) {
    let local = now + 3600;
    let days = local / 86400;
    let weekday = (days + 3) % 7;
    let mut start = (days - weekday) * 86400 + 7 * 3600 - 3600;
    if now < start {
        start -= 604800
    }
    (start, start + 604800)
}
async fn current_weekly_challenge(
    State(s): State<Arc<AppState>>,
    Path(group): Path<String>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    let sg = group.clone();
    tokio::task::spawn_blocking(move || store.group_details(&p, &sg))
        .await
        .map_err(task_error)??;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let (start, end) = weekly_window(now);
    let mut missions = s.catalogue.missions.values().collect::<Vec<_>>();
    missions.sort_by(|a, b| a.mission_id.cmp(&b.mission_id));
    let hash = group
        .bytes()
        .fold(start, |a, b| a.wrapping_mul(31).wrapping_add(b as u64));
    let mission = missions[(hash as usize) % missions.len()];
    let game = build_game_from_mission(&s.catalogue, mission, hash, 0)?;
    let store = s.store.clone();
    let mission_id = mission.mission_id.clone();
    let id = tokio::task::spawn_blocking(move || {
        store.schedule_weekly_challenge(&group, start, end, &mission_id, 1, hash, &game)
    })
    .await
    .map_err(task_error)??;
    Ok(Json(
        serde_json::json!({"challenge_id":id,"starts_at_unix":start,"ends_at_unix":end,"timezone":"Africa/Lagos","schedule_version":1,"rules_version":1}),
    ))
}
async fn start_weekly_attempt(
    State(s): State<Arc<AppState>>,
    Path(challenge): Path<String>,
    h: HeaderMap,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    let id = tokio::task::spawn_blocking(move || store.start_weekly_attempt(&p, &challenge))
        .await
        .map_err(task_error)??;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({"attempt_id":id})),
    ))
}
async fn get_weekly_attempt(
    State(s): State<Arc<AppState>>,
    Path(attempt): Path<String>,
    h: HeaderMap,
) -> Result<Json<PublicWeeklyAttempt>, ApiError> {
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    let a = attempt.clone();
    let _ = tokio::task::spawn_blocking(move || store.complete_weekly_arrival(&p, &a))
        .await
        .map_err(task_error)??;
    let p = authenticate(&h, &s).await?.player_id;
    let store = s.store.clone();
    let view = tokio::task::spawn_blocking(move || store.weekly_attempt(&p, &attempt))
        .await
        .map_err(task_error)??;
    Ok(Json(public_weekly_attempt(view, &s.catalogue)?))
}
async fn execute_weekly_command(
    State(s): State<Arc<AppState>>,
    Path(attempt): Path<String>,
    h: HeaderMap,
    Json(request): Json<ExecuteRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&h, &s.config)?;
    if matches!(&request.command, ClientCommand::HireAssistant) {
        return Err(bad_request(
            "assistants are not available in weekly challenges",
        ));
    }
    let account = authorize(&h, &s).await?;
    let p = account.player_id.clone();
    let store = s.store.clone();
    let a = attempt.clone();
    let _ = tokio::task::spawn_blocking(move || store.complete_weekly_arrival(&p, &a))
        .await
        .map_err(task_error)??;
    let store = s.store.clone();
    let p = account.player_id.clone();
    let a = attempt.clone();
    let view = tokio::task::spawn_blocking(move || store.weekly_attempt(&p, &a))
        .await
        .map_err(task_error)??;
    if view.state_version != request.expected_version {
        return Err(StorageError::VersionConflict(attempt).into());
    }
    let (command, public_event) = translate_command(
        &s.catalogue,
        &view.state,
        request.command,
        &account.home_base,
    )
    .map_err(bad_request)?;
    let movement = matches!(
        command,
        Command::TravelBy { .. } | Command::VisitVenueBy { .. } | Command::SearchHideoutBy { .. }
    );
    if movement {
        let event_json = public_event.map(|mut event| {
            event.data.insert("stop".into(), view.state.state.clone());
            serde_json::to_value(event).expect("event serializes")
        });
        let (next, _) = naijachase_core::apply(view.state.clone(), command.clone())
            .map_err(|e| bad_request(e.to_string()))?;
        let ledger = next
            .economy
            .ledger
            .last()
            .ok_or_else(|| bad_request("movement ledger missing"))?;
        let duration = ledger.minutes.saturating_mul(60);
        let destination = ledger.destination.clone();
        let mode = ledger.mode.clone();
        let fare = ledger.cost;
        let store = s.store.clone();
        let p = account.player_id;
        let command_id = request.command_id;
        let transit = tokio::task::spawn_blocking(move || {
            store.depart_weekly(
                &p,
                &view.attempt_id,
                &command_id,
                &destination,
                &mode,
                fare,
                duration,
                &next,
                event_json.as_ref(),
            )
        })
        .await
        .map_err(task_error)??;
        Ok(Json(
            serde_json::json!({"status":"in_transit","transit_id":transit,"duration_seconds":duration}),
        ))
    } else {
        let store = s.store.clone();
        let p = account.player_id;
        let a = view.attempt_id;
        let updated = tokio::task::spawn_blocking(move || {
            store.execute_weekly(&p, &a, request.expected_version, |state| {
                naijachase_core::apply(state, command)
                    .map(|v| v.0)
                    .map_err(|e| e.to_string())
            })
        })
        .await
        .map_err(task_error)??;
        Ok(Json(
            serde_json::to_value(public_weekly_attempt(updated, &s.catalogue)?)
                .expect("public weekly attempt serializes"),
        ))
    }
}
async fn delete_group(
    State(s): State<Arc<AppState>>,
    Path(group): Path<String>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    tokio::task::spawn_blocking(move || store.delete_group(&p, &group))
        .await
        .map_err(task_error)??;
    Ok(Json(serde_json::json!({"deleted":true})))
}
async fn manage_group_member(
    State(s): State<Arc<AppState>>,
    Path(group): Path<String>,
    h: HeaderMap,
    Json(b): Json<ManageMemberRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    tokio::task::spawn_blocking(move || {
        store.manage_group_member(&p, &group, &b.player_id, b.role.as_deref())
    })
    .await
    .map_err(task_error)??;
    Ok(Json(serde_json::json!({"updated":true})))
}
async fn weekly_challenge_details(
    State(s): State<Arc<AppState>>,
    Path(id): Path<String>,
    h: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.weekly_challenge_details(&p, &id))
            .await
            .map_err(task_error)??,
    ))
}
async fn weekly_history(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.weekly_history(&p))
            .await
            .map_err(task_error)??,
    ))
}
async fn weekly_notifications(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.weekly_notifications(&p))
            .await
            .map_err(task_error)??,
    ))
}
async fn update_weekly_notifications(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Json(b): Json<WeeklyNotificationRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    tokio::task::spawn_blocking(move || store.set_weekly_notifications(&p, b.web, b.email))
        .await
        .map_err(task_error)??;
    Ok(Json(serde_json::json!({"updated":true})))
}
async fn group_invitations(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.group_invitations(&p))
            .await
            .map_err(task_error)??,
    ))
}
async fn weekly_events(
    State(s): State<Arc<AppState>>,
    Path(id): Path<String>,
    h: HeaderMap,
) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.weekly_events(&p, &id, 0))
            .await
            .map_err(task_error)??,
    ))
}
async fn cancel_weekly_challenge(
    State(s): State<Arc<AppState>>,
    Path(id): Path<String>,
    h: HeaderMap,
    Json(b): Json<CancelChallengeRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&h, &s.config)?;
    let p = authorize(&h, &s).await?.player_id;
    let store = s.store.clone();
    tokio::task::spawn_blocking(move || store.cancel_weekly_challenge(&p, &id, &b.reason))
        .await
        .map_err(task_error)??;
    Ok(Json(serde_json::json!({"cancelled":true})))
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

async fn send_email(
    client: &reqwest::Client,
    config: &ServiceConfig,
    to: &str,
    subject: &str,
    text: &str,
    html: &str,
) -> Result<(), ApiError> {
    let response=client.post(&config.cloudflare_email_api_url).bearer_auth(&config.cloudflare_api_token)
        .json(&serde_json::json!({"from":config.email_from,"to":to,"subject":subject,"text":text,"html":html}))
        .send().await.map_err(|error|{tracing::error!(%error,"email delivery request failed");ApiError::new(StatusCode::BAD_GATEWAY,"email_failed","email could not be sent")})?;
    if !response.status().is_success() {
        let status = response.status();
        let request_id = response
            .headers()
            .get("cf-ray")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("unavailable")
            .to_owned();
        let provider_body = response
            .text()
            .await
            .unwrap_or_else(|_| "response body unavailable".into());
        let provider_body = provider_body.chars().take(2_000).collect::<String>();
        tracing::error!(%status,%request_id,%provider_body,"Cloudflare rejected email delivery");
        return Err(ApiError::new(
            StatusCode::BAD_GATEWAY,
            "email_failed",
            "email could not be sent",
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

async fn assign_case(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(_request): Json<AssignCaseRequest>,
) -> Result<(StatusCode, Json<CaseResponse>), ApiError> {
    ensure_origin(&headers, &state.config)?;
    let account = authorize(&headers, &state).await?;
    let player = account.player_id.clone();
    let store = state.store.clone();
    let current_player = player.clone();
    if let Some((case_id, version, game)) =
        tokio::task::spawn_blocking(move || store.current_ordinary_case(&current_player))
            .await
            .map_err(task_error)??
    {
        return Ok((
            StatusCode::OK,
            Json(CaseResponse {
                api_version: API_VERSION,
                case_id,
                state_version: version,
                duplicate: true,
                attempt_kind: "ordinary".into(),
                state: public_game_state(&game, &state.catalogue)?,
                events: vec![],
            }),
        ));
    }
    let store = state.store.clone();
    let lookup_player = player.clone();
    let unseen =
        tokio::task::spawn_blocking(move || store.unseen_published_missions(&lookup_player))
            .await
            .map_err(task_error)??;
    if unseen.is_empty() {
        return Err(StorageError::CatalogueExhausted.into());
    }
    let (mission_id, seed) = {
        let mut entropy = rand::rng();
        let newest_pool = (unseen.len() / 5).max(1);
        let selection_pool = if entropy.next_u64() % 10 < 7 {
            newest_pool
        } else {
            unseen.len()
        };
        (
            unseen[(entropy.next_u64() as usize) % selection_pool].clone(),
            entropy.next_u64(),
        )
    };
    let case_id = format!("case-{}", uuid::Uuid::new_v4());
    let store = state.store.clone();
    let career_player = player.clone();
    let career_points = tokio::task::spawn_blocking(move || store.career_points(&career_player))
        .await
        .map_err(task_error)??;
    let store = state.store.clone();
    let runtime_id = mission_id.clone();
    let runtime = tokio::task::spawn_blocking(move || store.runtime_mission(&runtime_id))
        .await
        .map_err(task_error)??;
    let game = build_runtime_game(&state.catalogue, runtime, seed, career_points)?;
    let store = state.store.clone();
    let saved_case_id = case_id.clone();
    let saved = game.clone();
    let assignment = tokio::task::spawn_blocking(move || {
        store.create_case_with_kind(&saved_case_id, &player, &mission_id, &saved, "ordinary")
    })
    .await
    .map_err(task_error)?;
    let (case_id, duplicate) = match assignment {
        Ok(_) => (case_id, false),
        Err(StorageError::OrdinaryCaseExists(existing)) => (existing, true),
        Err(error) => return Err(error.into()),
    };
    let store = state.store.clone();
    let player = authenticate(&headers, &state).await?.player_id;
    let lookup_id = case_id.clone();
    let (version, stored_game) =
        tokio::task::spawn_blocking(move || store.load_owned_case(&lookup_id, &player))
            .await
            .map_err(task_error)??;
    Ok((
        if duplicate {
            StatusCode::OK
        } else {
            StatusCode::CREATED
        },
        Json(CaseResponse {
            api_version: API_VERSION,
            case_id,
            state_version: version,
            duplicate,
            attempt_kind: "ordinary".into(),
            state: public_game_state(&stored_game, &state.catalogue)?,
            events: vec![],
        }),
    ))
}

async fn current_case(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<CurrentCaseResponse>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    let current = tokio::task::spawn_blocking(move || store.current_ordinary_case(&player))
        .await
        .map_err(task_error)??;
    let case = current
        .map(
            |(case_id, version, game)| -> Result<CaseResponse, ApiError> {
                Ok(CaseResponse {
                    api_version: API_VERSION,
                    case_id,
                    state_version: version,
                    duplicate: false,
                    attempt_kind: "ordinary".into(),
                    state: public_game_state(&game, &state.catalogue)?,
                    events: vec![],
                })
            },
        )
        .transpose()?;
    Ok(Json(CurrentCaseResponse {
        has_ongoing_case: case.is_some(),
        case,
    }))
}

async fn current_activity(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<CurrentActivityResponse>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    let lookup_player = player.clone();
    let (ordinary_cases, replay_cases) = tokio::task::spawn_blocking(move || {
        Ok::<_, StorageError>((
            store.ongoing_cases_by_kind(&lookup_player, "ordinary")?,
            store.ongoing_cases_by_kind(&lookup_player, "replay")?,
        ))
    })
    .await
    .map_err(task_error)??;

    let store = state.store.clone();
    let weekly_attempts =
        tokio::task::spawn_blocking(move || store.ongoing_weekly_attempts(&player))
            .await
            .map_err(task_error)??;

    let to_case = |attempt_kind: &str,
                   (case_id, version, game): (String, u64, GameState)|
     -> Result<CaseResponse, ApiError> {
        Ok(CaseResponse {
            api_version: API_VERSION,
            case_id,
            state_version: version,
            duplicate: false,
            attempt_kind: attempt_kind.into(),
            state: public_game_state(&game, &state.catalogue)?,
            events: vec![],
        })
    };
    let ordinary_case = ordinary_cases
        .into_iter()
        .next()
        .map(|case| to_case("ordinary", case))
        .transpose()?;
    let replay_cases = replay_cases
        .into_iter()
        .map(|case| to_case("replay", case))
        .collect::<Result<Vec<_>, _>>()?;
    let weekly_attempts = weekly_attempts
        .into_iter()
        .map(|attempt| public_weekly_attempt(attempt, &state.catalogue))
        .collect::<Result<Vec<_>, _>>()?;
    let has_ongoing_activity =
        ordinary_case.is_some() || !replay_cases.is_empty() || !weekly_attempts.is_empty();

    Ok(Json(CurrentActivityResponse {
        has_ongoing_activity,
        ordinary_case,
        replay_cases,
        weekly_attempts,
    }))
}

async fn replay_case(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<ReplayCaseRequest>,
) -> Result<(StatusCode, Json<CaseResponse>), ApiError> {
    ensure_origin(&headers, &state.config)?;
    let player = authorize(&headers, &state).await?.player_id;
    validate_id(&request.mission_id, "mission_id").map_err(bad_request)?;
    let seed = rand::rng().next_u64();
    let case_id = format!("replay-{}", uuid::Uuid::new_v4());
    let store = state.store.clone();
    let career_player = player.clone();
    let career_points = tokio::task::spawn_blocking(move || store.career_points(&career_player))
        .await
        .map_err(task_error)??;
    let store = state.store.clone();
    let runtime_id = request.mission_id.clone();
    let runtime = tokio::task::spawn_blocking(move || store.runtime_mission(&runtime_id))
        .await
        .map_err(task_error)??;
    let game = build_runtime_game(&state.catalogue, runtime, seed, career_points)?;
    let store = state.store.clone();
    let saved_case_id = case_id.clone();
    let mission_id = request.mission_id.clone();
    let saved = game.clone();
    tokio::task::spawn_blocking(move || {
        store.create_case_with_kind(&saved_case_id, &player, &mission_id, &saved, "replay")
    })
    .await
    .map_err(task_error)??;
    Ok((
        StatusCode::CREATED,
        Json(CaseResponse {
            api_version: API_VERSION,
            case_id,
            state_version: 1,
            duplicate: false,
            attempt_kind: "replay".into(),
            state: public_game_state(&game, &state.catalogue)?,
            events: vec![],
        }),
    ))
}

async fn catalogue_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<CatalogueProgress>, ApiError> {
    let player = authenticate(&headers, &state).await?.player_id;
    let store = state.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.catalogue_progress(&player))
            .await
            .map_err(task_error)??,
    ))
}

async fn catalogue_notifications(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<ReleaseNotification>>, ApiError> {
    let player = authenticate(&headers, &state).await?.player_id;
    let store = state.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.release_notifications(&player))
            .await
            .map_err(task_error)??,
    ))
}

async fn read_catalogue_notification(
    State(state): State<Arc<AppState>>,
    Path(notification_id): Path<u64>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    tokio::task::spawn_blocking(move || store.read_release_notification(&player, notification_id))
        .await
        .map_err(task_error)??;
    Ok(Json(serde_json::json!({"message":"notification read"})))
}

async fn admin_catalogue_health(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<CatalogueHealth>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    let role_store = state.store.clone();
    let role = tokio::task::spawn_blocking(move || role_store.content_role(&player))
        .await
        .map_err(task_error)??;
    if !matches!(role.as_str(), "editor" | "publisher" | "admin") {
        return Err(StorageError::Forbidden.into());
    }
    Ok(Json(
        tokio::task::spawn_blocking(move || store.catalogue_health(50))
            .await
            .map_err(task_error)??,
    ))
}

async fn admin_catalogue_me(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    let role = tokio::task::spawn_blocking(move || store.content_role(&player))
        .await
        .map_err(task_error)??;
    if role == "player" {
        return Err(StorageError::Forbidden.into());
    }
    Ok(Json(serde_json::json!({"content_role":role})))
}

async fn admin_transition_mission(
    State(state): State<Arc<AppState>>,
    Path(mission_id): Path<String>,
    headers: HeaderMap,
    Json(request): Json<MissionTransitionRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let player = authorize(&headers, &state).await?.player_id;
    validate_id(&mission_id, "mission_id").map_err(bad_request)?;
    if request.reason.trim().is_empty() || request.reason.len() > 500 {
        return Err(bad_request("reason must be 1 to 500 characters"));
    }
    if !matches!(
        request.target_status.as_str(),
        "draft" | "editorial_review" | "validated" | "scheduled" | "published" | "retired"
    ) {
        return Err(bad_request("invalid target_status"));
    }
    let store = state.store.clone();
    tokio::task::spawn_blocking(move || {
        store.transition_mission(
            &player,
            &mission_id,
            &request.target_status,
            request.scheduled_for.as_deref(),
            &request.reason,
        )
    })
    .await
    .map_err(task_error)??;
    Ok(Json(
        serde_json::json!({"message":"mission lifecycle updated"}),
    ))
}

async fn admin_validate_mission(
    State(state): State<Arc<AppState>>,
    Path(mission_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<MissionValidation>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    validate_id(&mission_id, "mission_id").map_err(bad_request)?;
    let role_store = state.store.clone();
    let role = tokio::task::spawn_blocking(move || role_store.content_role(&player))
        .await
        .map_err(task_error)??;
    if !matches!(role.as_str(), "editor" | "publisher" | "admin") {
        return Err(StorageError::Forbidden.into());
    }
    let store = state.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.validate_mission(&mission_id))
            .await
            .map_err(task_error)??,
    ))
}

async fn admin_mission_details(
    State(state): State<Arc<AppState>>,
    Path(mission_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    validate_id(&mission_id, "mission_id").map_err(bad_request)?;
    let role_store = state.store.clone();
    let role = tokio::task::spawn_blocking(move || role_store.content_role(&player))
        .await
        .map_err(task_error)??;
    if !matches!(role.as_str(), "editor" | "publisher" | "admin") {
        return Err(StorageError::Forbidden.into());
    }
    let store = state.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.mission_admin_details(&mission_id))
            .await
            .map_err(task_error)??,
    ))
}

fn build_runtime_game(
    catalogue: &Catalogue,
    runtime: naijachase_storage::RuntimeMission,
    seed: u64,
    career_points: u64,
) -> Result<GameState, ApiError> {
    let mission = Mission {
        mission_id: runtime.mission_id,
        difficulty: runtime.difficulty,
        thief_id: runtime.thief_id,
        start_location_id: runtime.start_location_id,
        stop_2_location_id: runtime.stop_2_location_id,
        stop_3_location_id: runtime.stop_3_location_id,
        capture_location_id: runtime.capture_location_id,
    };
    build_game_from_mission(catalogue, &mission, seed, career_points)
}

fn build_game_from_mission(
    catalogue: &Catalogue,
    mission: &Mission,
    seed: u64,
    career_points: u64,
) -> Result<GameState, ApiError> {
    let route = catalogue
        .route(mission)
        .map_err(|_| bad_request("mission route unavailable"))?;
    let opening_budget = opening_budget_for(catalogue, mission)?;
    let capture_state = route
        .last()
        .cloned()
        .ok_or_else(|| bad_request("mission route unavailable"))?;
    Ok(GameState {
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
        hideout_venue: choose_hideout(&mission.mission_id, seed, &capture_state, catalogue),
        searched_hideouts: vec![],
        replay: vec![],
        outcome: None,
        economy: naijachase_contracts::CaseEconomy {
            rules_version: naijachase_core::TRANSPORT_RULES_VERSION,
            opening_budget,
            balance: opening_budget,
            ledger: vec![naijachase_contracts::TransportLedgerEntry {
                sequence: 1,
                kind: "opening_allocation".into(),
                origin: String::new(),
                destination: String::new(),
                mode: "allocation".into(),
                cost: 0,
                minutes: 0,
                balance_after: opening_budget,
            }],
            assistant_hired: false,
            assistant_cost: 0,
        },
    })
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
    let lookup_player = player.clone();
    let (version, game) =
        tokio::task::spawn_blocking(move || store.load_owned_case(&lookup_id, &lookup_player))
            .await
            .map_err(task_error)??;
    let store = state.store.clone();
    let kind_case = case_id.clone();
    let attempt_kind =
        tokio::task::spawn_blocking(move || store.case_attempt_kind(&kind_case, &player))
            .await
            .map_err(task_error)??;
    Ok(Json(CaseResponse {
        api_version: API_VERSION,
        case_id,
        state_version: version,
        duplicate: false,
        attempt_kind,
        state: public_game_state(&game, &state.catalogue)?,
        events: vec![],
    }))
}

async fn abandon_case(
    State(state): State<Arc<AppState>>,
    Path(case_id): Path<String>,
    headers: HeaderMap,
    Json(request): Json<AbandonCaseRequest>,
) -> Result<Json<naijachase_storage::AbandonCaseResult>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let player = authorize(&headers, &state).await?.player_id;
    validate_id(&case_id, "case_id").map_err(bad_request)?;
    if request.expected_version == 0 {
        return Err(bad_request("expected_version must be at least 1"));
    }
    let store = state.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || {
            store.abandon_ordinary_case(&case_id, &player, request.expected_version)
        })
        .await
        .map_err(task_error)??,
    ))
}

async fn transport_ledger(
    State(state): State<Arc<AppState>>,
    Path(case_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Vec<naijachase_contracts::TransportLedgerEntry>>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    validate_id(&case_id, "case_id").map_err(bad_request)?;
    let store = state.store.clone();
    let (_, game) = tokio::task::spawn_blocking(move || store.load_owned_case(&case_id, &player))
        .await
        .map_err(task_error)??;
    Ok(Json(game.economy.ledger))
}

async fn assistant_routes(
    State(state): State<Arc<AppState>>,
    Path(case_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<AssistantRoutesResponse>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    validate_id(&case_id, "case_id").map_err(bad_request)?;
    let store = state.store.clone();
    let (_, game) = tokio::task::spawn_blocking(move || store.load_owned_case(&case_id, &player))
        .await
        .map_err(task_error)??;
    if !game.economy.assistant_hired {
        return Err(StorageError::Forbidden.into());
    }
    if game.outcome.is_some() {
        return Ok(Json(AssistantRoutesResponse {
            suggestions: vec![],
        }));
    }
    Ok(Json(AssistantRoutesResponse {
        suggestions: assistant_route_suggestions(&state.catalogue, &game),
    }))
}

fn assistant_route_suggestions(catalogue: &Catalogue, state: &GameState) -> Vec<String> {
    let Some(correct) = state.route.get(state.stage as usize + 1).cloned() else {
        return vec![];
    };
    let mut choices = vec![correct.clone()];
    if is_on_trail(state) {
        for atom in witness_clue_plan(catalogue, state)
            .into_iter()
            .filter(|atom| atom.dimension != "landmark")
        {
            for candidate in atom.candidate_states.split('|') {
                if candidate != correct
                    && candidate != state.state
                    && !choices.iter().any(|x| x == candidate)
                {
                    choices.push(candidate.to_owned());
                }
            }
        }
    }
    let mut hubs = catalogue.hubs.keys().cloned().collect::<Vec<_>>();
    hubs.sort_by_key(|candidate| {
        Sha256::digest(
            format!(
                "assistant-route|{}|{}|{candidate}",
                state.mission_id, state.stage
            )
            .as_bytes(),
        )
        .to_vec()
    });
    for candidate in hubs {
        if candidate != state.state && !choices.contains(&candidate) {
            choices.push(candidate);
        }
        if choices.len() == 3 {
            break;
        }
    }
    choices.truncate(3);
    choices.sort_by_key(|candidate| {
        Sha256::digest(
            format!(
                "assistant-position|{}|{}|{candidate}",
                state.mission_id, state.stage
            )
            .as_bytes(),
        )
        .to_vec()
    });
    choices
}

async fn transport_quotes(
    State(state): State<Arc<AppState>>,
    Path(case_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Vec<TransportQuote>>, ApiError> {
    let account = authorize(&headers, &state).await?;
    let player = account.player_id.clone();
    validate_id(&case_id, "case_id").map_err(bad_request)?;
    let store = state.store.clone();
    let (_, game) = tokio::task::spawn_blocking(move || store.load_owned_case(&case_id, &player))
        .await
        .map_err(task_error)??;
    Ok(Json(build_transport_quotes(
        &state,
        &game,
        &account.home_base,
    )?))
}

async fn weekly_transport_quotes(
    State(state): State<Arc<AppState>>,
    Path(attempt): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Vec<TransportQuote>>, ApiError> {
    let account = authorize(&headers, &state).await?;
    let player = account.player_id.clone();
    validate_id(&attempt, "attempt_id").map_err(bad_request)?;
    let store = state.store.clone();
    let view = tokio::task::spawn_blocking(move || store.weekly_attempt(&player, &attempt))
        .await
        .map_err(task_error)??;
    if view.status != "active" {
        return Ok(Json(vec![]));
    }
    Ok(Json(build_transport_quotes(
        &state,
        &view.state,
        &account.home_base,
    )?))
}

async fn weekly_accounts(
    State(state): State<Arc<AppState>>,
    Path(attempt): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let account = authorize(&headers, &state).await?;
    let player = account.player_id.clone();
    validate_id(&attempt, "attempt_id").map_err(bad_request)?;
    let store = state.store.clone();
    let accounts = tokio::task::spawn_blocking(move || store.weekly_accounts(&player, &attempt))
        .await
        .map_err(task_error)??;
    Ok(Json(accounts))
}

fn build_transport_quotes(
    state: &AppState,
    game: &GameState,
    home_base: &str,
) -> Result<Vec<TransportQuote>, ApiError> {
    if game.outcome.is_some() {
        return Ok(vec![]);
    }
    let mut quotes = Vec::new();
    let mut destinations = state
        .catalogue
        .travel
        .iter()
        .filter(|((origin, _), _)| origin == &game.state)
        .map(|((_, destination), edge)| (destination.clone(), edge.travel_minutes))
        .collect::<Vec<_>>();
    destinations.sort_by(|a, b| a.0.cmp(&b.0));
    for (destination, base) in destinations {
        for mode in ["fly", "drive", "hitch_ride"] {
            let (minutes, cost) = naijachase_core::interstate_quote(base, mode)
                .map_err(|e| bad_request(e.to_string()))?;
            quotes.push(TransportQuote {
                scope: "interstate".into(),
                destination_id: destination.clone(),
                label: destination.clone(),
                mode: mode.into(),
                cost,
                travel_minutes: minutes,
                wait_minutes: 0,
                interview_minutes: 0,
                affordable: cost <= game.economy.balance,
                rules_version: game.economy.rules_version,
            })
        }
    }
    for venue_id in unquestioned_venue_ids(&state.catalogue, &game) {
        let venue = &state.catalogue.venues[&venue_id];
        let base = placement_minutes(
            &state.catalogue,
            &game.state,
            &venue_id,
            &game.mission_id,
            game.stage,
        )
        .map_err(bad_request)?;
        for mode in ["drive", "hitch_ride"] {
            let (minutes, cost) =
                naijachase_core::local_quote(base, mode).map_err(|e| bad_request(e.to_string()))?;
            let minutes = assistant_witness_minutes(minutes, game.economy.assistant_hired);
            let wait = wait_until_open(
                game.elapsed.saturating_add(minutes),
                venue.opens_hour,
                venue.closes_hour,
            );
            quotes.push(TransportQuote {
                scope: "local".into(),
                destination_id: venue_id.clone(),
                label: venue.venue_name.clone(),
                mode: mode.into(),
                cost,
                travel_minutes: minutes,
                wait_minutes: wait,
                interview_minutes: naijachase_core::investigation_minutes(
                    venue.interview_minutes,
                    game.state == home_base,
                ),
                affordable: cost <= game.economy.balance,
                rules_version: game.economy.rules_version,
            })
        }
    }
    if game.stage as usize == game.route.len().saturating_sub(1) {
        let ids = hideout_options(&state.catalogue, &game);
        for venue_id in ids {
            let venue = &state.catalogue.venues[&venue_id];
            let base = placement_minutes(
                &state.catalogue,
                &game.state,
                &venue_id,
                &game.mission_id,
                game.stage,
            )
            .map_err(bad_request)?;
            for mode in ["drive", "hitch_ride"] {
                let (minutes, cost) = naijachase_core::local_quote(base, mode)
                    .map_err(|e| bad_request(e.to_string()))?;
                quotes.push(TransportQuote {
                    scope: "apprehension".into(),
                    destination_id: venue_id.clone(),
                    label: venue.venue_name.clone(),
                    mode: mode.into(),
                    cost,
                    travel_minutes: minutes,
                    wait_minutes: 0,
                    interview_minutes: venue.interview_minutes,
                    affordable: cost <= game.economy.balance,
                    rules_version: game.economy.rules_version,
                })
            }
        }
    }
    Ok(quotes)
}

fn pressure_assignment(case_id: &str, game: &GameState, venues: &[String]) -> Option<String> {
    if venues.is_empty() {
        return None;
    }
    let seed = format!("pressure|{case_id}|{}|{}", game.mission_id, game.stage);
    let digest = Sha256::digest(seed.as_bytes());
    if digest[0] as u16 * 100 / 256 >= 65 {
        return None;
    }
    Some(venues[usize::from(digest[1]) % venues.len()].clone())
}

fn supplemental_clue(catalogue: &Catalogue, game: &GameState, venue_id: &str) -> Option<String> {
    let destination = game.route.get(game.stage as usize + 1)?;
    let atoms = catalogue.atoms.get(destination)?;
    let mut candidates = atoms
        .iter()
        .filter(|atom| atom.venue_id == venue_id)
        .collect::<Vec<_>>();
    if candidates.is_empty() {
        candidates = atoms.iter().collect();
    }
    let key = game.mission_id.bytes().map(usize::from).sum::<usize>()
        + game.stage as usize * 17
        + venue_id.bytes().map(usize::from).sum::<usize>();
    candidates
        .get((key + 1) % candidates.len().max(1))
        .map(|atom| atom.dialogue.trim().to_owned())
}

async fn pressure_witness(
    State(state): State<Arc<AppState>>,
    Path(case_id): Path<String>,
    headers: HeaderMap,
    Json(request): Json<PressureWitnessRequest>,
) -> Result<Json<naijachase_storage::PressureResult>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let player = authorize(&headers, &state).await?.player_id;
    validate_id(&case_id, "case_id").map_err(bad_request)?;
    validate_id(&request.command_id, "command_id").map_err(bad_request)?;
    validate_id(&request.venue_id, "venue_id").map_err(bad_request)?;
    if !matches!(request.method.as_str(), "bribe" | "intimidate") {
        return Err(bad_request("method must be bribe or intimidate"));
    }
    let store = state.store.clone();
    let lookup_case = case_id.clone();
    let lookup_player = player.clone();
    let (_, game) =
        tokio::task::spawn_blocking(move || store.load_owned_case(&lookup_case, &lookup_player))
            .await
            .map_err(task_error)??;
    let mut venues = available_venue_ids(&state.catalogue, &game);
    venues.sort();
    if !venues.contains(&request.venue_id) {
        return Err(bad_request("venue is not available at this stop"));
    }
    let assigned = is_on_trail(&game)
        .then(|| pressure_assignment(&case_id, &game, &venues))
        .flatten();
    let has_extra = assigned.as_deref() == Some(request.venue_id.as_str());
    let clue = if has_extra {
        supplemental_clue(&state.catalogue, &game, &request.venue_id)
    } else {
        None
    };
    let store = state.store.clone();
    let result = tokio::task::spawn_blocking(move || {
        store.pressure_witness(
            &player,
            &case_id,
            &request.command_id,
            request.expected_version,
            &request.venue_id,
            &request.method,
            has_extra,
            clue.as_deref(),
        )
    })
    .await
    .map_err(task_error)??;
    Ok(Json(result))
}

async fn pressure_attempts(
    State(state): State<Arc<AppState>>,
    Path(case_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Vec<naijachase_storage::PressureAttemptRecord>>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    validate_id(&case_id, "case_id").map_err(bad_request)?;
    let store = state.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.pressure_attempts(&player, &case_id))
            .await
            .map_err(task_error)??,
    ))
}

async fn bribe_token_balance(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<naijachase_storage::TokenBalance>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.bribe_token_balance(&player))
            .await
            .map_err(task_error)??,
    ))
}
async fn bribe_token_history(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<naijachase_storage::TokenLedgerEntry>>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.bribe_token_history(&player))
            .await
            .map_err(task_error)??,
    ))
}
async fn disciplinary_history(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<naijachase_storage::DisciplinaryCase>>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    Ok(Json(
        tokio::task::spawn_blocking(move || store.disciplinary_history(&player))
            .await
            .map_err(task_error)??,
    ))
}
async fn jail_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let player = authorize(&headers, &state).await?.player_id;
    let store = state.store.clone();
    let until = tokio::task::spawn_blocking(move || store.jail_status(&player))
        .await
        .map_err(task_error)??;
    Ok(Json(
        serde_json::json!({"jailed":until.is_some(),"jailed_until":until}),
    ))
}
async fn acknowledge_disciplinary_case(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_origin(&headers, &state.config)?;
    let player = authorize(&headers, &state).await?.player_id;
    validate_id(&id, "disciplinary_case_id").map_err(bad_request)?;
    let store = state.store.clone();
    tokio::task::spawn_blocking(move || store.acknowledge_disciplinary_case(&player, &id))
        .await
        .map_err(task_error)??;
    Ok(Json(serde_json::json!({"acknowledged":true})))
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
            if next.outcome.as_deref() == Some("escaped") {
                if let Some(thief) = catalogue.thieves.get(&next.thief_id) {
                    for event in &mut events {
                        if event.event_type == "wrong_warrant" {
                            event.data.insert("thief_name".into(), thief.name.clone());
                            event.data.insert("thief_alias".into(), thief.alias.clone());
                        }
                    }
                }
            }
            if next.outcome.as_deref() != Some("deadline")
                && let Some(event) = public_event
            {
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
    let (version, game, mut events, duplicate) = match result {
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
        let awards = tokio::task::spawn_blocking(move || {
            store.record_case_completion(&archive_player, &archive_case, &archive_state)
        })
        .await
        .map_err(task_error)??;
        for award in awards {
            let mut data = BTreeMap::new();
            data.insert("currency".into(), "earned_bribe_token".into());
            data.insert("reason".into(), award.reason);
            data.insert("amount".into(), award.amount.to_string());
            data.insert("balance_after".into(), award.balance_after.to_string());
            data.insert("components".into(), award.components.join(","));
            events.push(Event {
                event_type: "token_awarded".into(),
                data,
            });
        }
    }
    let store = state.store.clone();
    let kind_case = case_id.clone();
    let kind_player = player.clone();
    let attempt_kind =
        tokio::task::spawn_blocking(move || store.case_attempt_kind(&kind_case, &kind_player))
            .await
            .map_err(task_error)??;
    Ok(Json(CaseResponse {
        api_version: API_VERSION,
        case_id,
        state_version: version,
        duplicate,
        attempt_kind,
        state: public_game_state(&game, &state.catalogue)?,
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
        ClientCommand::HireAssistant => Ok((
            Command::HireAssistant {
                cost: state.economy.opening_budget.div_ceil(3),
            },
            None,
        )),
        ClientCommand::VisitVenue { venue_id, mode } => {
            validate_id(&venue_id, "venue_id")?;
            if !available_venue_ids(catalogue, state).contains(&venue_id) {
                return Err("venue is not available at this stop".into());
            }
            let venue = catalogue.venues.get(&venue_id).ok_or("unknown venue_id")?;
            let on_trail = is_on_trail(state);
            let key_witness_venue = on_trail
                .then(|| dossier_witness_venue(catalogue, state))
                .flatten();
            let (trait_name, trait_value) = if key_witness_venue.as_deref() == Some(&venue_id) {
                let profile = catalogue
                    .profiles
                    .get(&state.thief_id)
                    .ok_or("profile unavailable")?;
                let traits = profile.traits();
                let (field, value) = traits
                    .get(dossier_trait_index(state, state.stage as usize))
                    .ok_or("invalid case stage")?;
                ((*field).to_owned(), (*value).to_owned())
            } else {
                (String::new(), String::new())
            };
            let clue_key = state
                .mission_id
                .bytes()
                .chain(state.state.bytes())
                .chain(venue_id.bytes())
                .map(usize::from)
                .sum::<usize>()
                + state.stage as usize;
            let (dialogue, atom_roles) = if on_trail {
                let atom = witness_clue_plan(catalogue, state)
                    .into_iter()
                    .find(|atom| atom.venue_id == venue_id)
                    .ok_or("witness clue unavailable")?;
                let difficulty = match state.difficulty {
                    1 | 2 => "easy",
                    3 => "medium",
                    _ => "hard",
                };
                let variants = catalogue
                    .dialogue_variants
                    .get(&atom.atom_id)
                    .into_iter()
                    .flatten()
                    .filter(|variant| {
                        variant.difficulty == difficulty && variant.speech_register == "English"
                    })
                    .collect::<Vec<_>>();
                let dialogue = variants
                    .get(clue_key % variants.len().max(1))
                    .map(|variant| variant.dialogue.as_str())
                    .unwrap_or(&atom.dialogue);
                (dialogue.to_owned(), atom.witness_roles.as_str())
            } else {
                const COLD_RESPONSES: [&str; 8] = [
                    "I am sorry, but I have not seen anyone matching that description.",
                    "I have not heard anything that could help you.",
                    "No one matching that description has passed through here today.",
                    "I do not know anything about the person you are looking for.",
                    "Nothing unusual has happened here today.",
                    "I cannot help you; I have not seen the suspect.",
                    "Nobody here remembers seeing anyone matching that description.",
                    "I think you may be following the wrong trail.",
                ];
                (
                    COLD_RESPONSES[clue_key % COLD_RESPONSES.len()].to_owned(),
                    venue.witness_roles.as_str(),
                )
            };
            let roles = atom_roles.split('|').collect::<Vec<_>>();
            let witness_role = roles[clue_key % roles.len()];
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
            data.insert(
                "trail_status".into(),
                if on_trail { "hot" } else { "cold" }.into(),
            );
            data.insert("venue_name".into(), venue.venue_name.clone());
            data.insert("witness_role".into(), witness_role.into());
            data.insert("venue_id".into(), venue_id.clone());
            let minutes = naijachase_core::investigation_minutes(
                venue.interview_minutes,
                state.state == home_base,
            );
            let placement = picked_placement(
                catalogue,
                &state.state,
                &venue_id,
                &state.mission_id,
                state.stage,
            )?;
            let base_travel = placement.hub_travel_minutes.max(5);
            data.insert("local_venue_name".into(), placement.venue_name.clone());
            data.insert("location_name".into(), placement.location_name.clone());
            let (travel_minutes, cost) =
                naijachase_core::local_quote(base_travel, &mode).map_err(|e| e.to_string())?;
            let travel_minutes =
                assistant_witness_minutes(travel_minutes, state.economy.assistant_hired);
            let wait_minutes = wait_until_open(
                state.elapsed.saturating_add(travel_minutes),
                venue.opens_hour,
                venue.closes_hour,
            );
            data.insert("transport_mode".into(), mode.clone());
            data.insert("transport_cost".into(), cost.to_string());
            data.insert("travel_minutes".into(), travel_minutes.to_string());
            data.insert("wait_minutes".into(), wait_minutes.to_string());
            if minutes < venue.interview_minutes {
                data.insert(
                    "home_base_discount_minutes".into(),
                    (venue.interview_minutes - minutes).to_string(),
                );
            }
            Ok((
                Command::VisitVenueBy {
                    venue_id,
                    trait_name,
                    trait_value,
                    mode,
                    travel_minutes,
                    wait_minutes,
                    interview_minutes: minutes,
                    cost,
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
                || !dossier_option_values(catalogue, &trait_name).contains(&value)
            {
                return Err("invalid dossier entry".into());
            }
            Ok((Command::RecordTrait { trait_name, value }, None))
        }
        ClientCommand::Travel { destination, mode } => {
            let travel = catalogue
                .travel
                .get(&(state.state.clone(), destination.clone()))
                .ok_or("unavailable destination")?;
            Ok((
                Command::TravelBy {
                    destination,
                    mode: mode.clone(),
                    minutes: naijachase_core::interstate_quote(travel.travel_minutes, &mode)
                        .map_err(|e| e.to_string())?
                        .0,
                    cost: naijachase_core::interstate_quote(travel.travel_minutes, &mode)
                        .map_err(|e| e.to_string())?
                        .1,
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
        ClientCommand::SearchHideout { venue_id, mode } => {
            validate_id(&venue_id, "venue_id")?;
            if !hideout_options(catalogue, state).contains(&venue_id) {
                return Err("hideout is not one of the five active search locations".into());
            }
            let venue = catalogue.venues.get(&venue_id).ok_or("unknown venue_id")?;
            Ok((
                Command::SearchHideoutBy {
                    venue_id,
                    mode: mode.clone(),
                    travel_minutes: naijachase_core::local_quote(
                        placement_minutes(
                            catalogue,
                            &state.state,
                            &venue.venue_id,
                            &state.mission_id,
                            state.stage,
                        )?,
                        &mode,
                    )
                    .map_err(|e| e.to_string())?
                    .0,
                    search_minutes: venue.interview_minutes,
                    cost: naijachase_core::local_quote(
                        placement_minutes(
                            catalogue,
                            &state.state,
                            &venue.venue_id,
                            &state.mission_id,
                            state.stage,
                        )?,
                        &mode,
                    )
                    .map_err(|e| e.to_string())?
                    .1,
                },
                None,
            ))
        }
    }
}

fn natural_trait(field: &str, value: &str) -> String {
    naijachase_content::natural_trait_clause("the suspect", field, value)
}

fn choose_hideout(mission_id: &str, seed: u64, state: &str, catalogue: &Catalogue) -> String {
    let mut ids = catalogue
        .location_venues
        .keys()
        .filter(|(candidate, _)| candidate == state)
        .map(|(_, venue)| venue.clone())
        .collect::<Vec<_>>();
    ids.sort();
    ids.dedup();
    if ids.is_empty() {
        ids = catalogue.venues.keys().cloned().collect()
    }
    ids.sort();
    let offset = mission_id
        .bytes()
        .map(u64::from)
        .sum::<u64>()
        .wrapping_add(seed) as usize
        % ids.len();
    ids[offset].clone()
}

fn hideout_options(catalogue: &Catalogue, state: &GameState) -> Vec<String> {
    let mut ids = catalogue
        .location_venues
        .keys()
        .filter(|(candidate, _)| candidate == &state.state)
        .map(|(_, venue)| venue.clone())
        .collect::<Vec<_>>();
    ids.sort();
    ids.dedup();
    ids.retain(|venue| venue != &state.hideout_venue);
    ids.sort_by_key(|venue| {
        Sha256::digest(format!("hideout-option|{}|{}", state.mission_id, venue).as_bytes()).to_vec()
    });
    ids.truncate(4);
    ids.push(state.hideout_venue.clone());
    ids.sort_by_key(|venue| {
        Sha256::digest(format!("hideout-position|{}|{}", state.mission_id, venue).as_bytes())
            .to_vec()
    });
    ids
}

/// The one placement (a real location's version of the venue, such as "Aba Community Market") a visit uses.
/// Travel time and the name shown to the player come from the same pick, so they always agree.
fn picked_placement<'a>(
    catalogue: &'a Catalogue,
    state: &str,
    venue_id: &str,
    mission_id: &str,
    stage: u8,
) -> Result<&'a naijachase_content::LocationVenue, String> {
    let placements = catalogue
        .location_venues
        .get(&(state.to_owned(), venue_id.to_owned()))
        .ok_or("venue is not available in this jurisdiction")?;
    let pick =
        (mission_id.bytes().map(usize::from).sum::<usize>() + stage as usize) % placements.len();
    Ok(&placements[pick])
}

fn placement_minutes(
    catalogue: &Catalogue,
    state: &str,
    venue_id: &str,
    mission_id: &str,
    stage: u8,
) -> Result<u32, String> {
    Ok(
        picked_placement(catalogue, state, venue_id, mission_id, stage)?
            .hub_travel_minutes
            .max(5),
    )
}

fn available_venue_ids(catalogue: &Catalogue, state: &GameState) -> Vec<String> {
    available_venue_ids_for(
        catalogue,
        &state.route,
        &state.mission_id,
        state.stage as usize,
        &state.state,
    )
}

fn is_on_trail(state: &GameState) -> bool {
    state.route.get(state.stage as usize) == Some(&state.state)
}

fn unquestioned_venue_ids(catalogue: &Catalogue, state: &GameState) -> Vec<String> {
    available_venue_ids(catalogue, state)
        .into_iter()
        .filter(|venue_id| {
            !state
                .visited_venues
                .contains(&format!("{}|{}|{}", state.stage, state.state, venue_id))
        })
        .collect()
}

fn dossier_random_byte(state: &GameState, scope: &str, position: usize) -> u8 {
    let material = format!(
        "{scope}|{}|{}|{}|{position}",
        state.mission_id, state.thief_id, state.hideout_venue
    );
    Sha256::digest(material.as_bytes())[position % 32]
}

fn dossier_trait_order(state: &GameState) -> [usize; 8] {
    let mut order = [0, 1, 2, 3, 4, 5, 6, 7];
    for position in (1..order.len()).rev() {
        let swap = dossier_random_byte(state, "dossier-trait", position) as usize % (position + 1);
        order.swap(position, swap);
    }
    order
}

fn dossier_trait_index(state: &GameState, stage: usize) -> usize {
    dossier_trait_order(state)[stage % 8]
}

fn dossier_witness_venue(catalogue: &Catalogue, state: &GameState) -> Option<String> {
    if !is_on_trail(state) {
        return None;
    }
    let venues = witness_clue_plan(catalogue, state)
        .into_iter()
        .filter(|atom| atom.dimension != "landmark")
        .map(|atom| atom.venue_id.clone())
        .collect::<Vec<_>>();
    (!venues.is_empty()).then(|| {
        let index = dossier_random_byte(state, "dossier-witness", state.stage as usize) as usize
            % venues.len();
        venues[index].clone()
    })
}

/// Builds one deliberately decisive clue and two multi-state clues. The
/// decisive clue is always the curated landmark atom and can never carry the
/// dossier evidence that marks the key witness.
fn witness_clue_plan<'a>(
    catalogue: &'a Catalogue,
    state: &GameState,
) -> Vec<&'a naijachase_content::ClueAtom> {
    if !is_on_trail(state) {
        return vec![];
    }
    witness_clue_plan_for(
        catalogue,
        &state.route,
        &state.mission_id,
        state.stage as usize,
        &state.state,
    )
}

#[cfg(test)]
fn candidate_states(atom: &naijachase_content::ClueAtom) -> BTreeSet<&str> {
    atom.candidate_states.split('|').collect()
}

fn witness_clue_plan_for<'a>(
    catalogue: &'a Catalogue,
    route: &[String],
    mission_id: &str,
    stage: usize,
    actual_state: &str,
) -> Vec<&'a naijachase_content::ClueAtom> {
    catalogue.clue_plan(route, mission_id, stage, actual_state)
}

fn available_venue_ids_for(
    catalogue: &Catalogue,
    route: &[String],
    mission_id: &str,
    stage: usize,
    actual_state: &str,
) -> Vec<String> {
    catalogue.available_venues(route, mission_id, stage, actual_state)
}

fn wait_until_open(elapsed: u32, opens: u32, closes: u32) -> u32 {
    let minute = (420 + elapsed) % 1440;
    let open = opens * 60;
    let close = closes * 60;
    let is_open = if open < close {
        minute >= open && minute < close
    } else {
        minute >= open || minute < close
    };
    if is_open {
        0
    } else if minute < open {
        open - minute
    } else {
        1440 - minute + open
    }
}

fn assistant_witness_minutes(minutes: u32, hired: bool) -> u32 {
    if hired {
        minutes.saturating_mul(975).div_ceil(1_000).max(1)
    } else {
        minutes
    }
}

#[cfg(test)]
fn mission_budget_baseline(catalogue: &Catalogue, mission: &Mission) -> Result<u32, ApiError> {
    catalogue.budget_baseline(mission).map_err(bad_request)
}

fn opening_budget_for(catalogue: &Catalogue, mission: &Mission) -> Result<u32, ApiError> {
    catalogue
        .opening_budget(mission)
        .ok_or_else(|| bad_request("mission budget unavailable"))
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
        email_client: reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|error| error.to_string())?,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use std::collections::BTreeMap;
    use tower::ServiceExt;

    #[test]
    fn service_limits_have_safe_defaults_and_reject_bad_values() {
        assert_eq!(bounded_setting("LIMIT", None, 128, 1, 4096).unwrap(), 128);
        assert_eq!(
            bounded_setting("LIMIT", Some("64".into()), 128, 1, 4096).unwrap(),
            64
        );
        assert!(bounded_setting("LIMIT", Some("0".into()), 128, 1, 4096).is_err());
        assert!(bounded_setting("LIMIT", Some("many".into()), 128, 1, 4096).is_err());
    }

    #[tokio::test]
    async fn request_deadline_returns_a_retryable_json_error() {
        let app = Router::new()
            .route(
                "/slow",
                get(|| async {
                    tokio::time::sleep(Duration::from_millis(25)).await;
                    "late"
                }),
            )
            .layer(
                ServiceBuilder::new()
                    .layer(HandleErrorLayer::new(handle_capacity_error))
                    .timeout(Duration::from_millis(1)),
            );
        let response = app
            .oneshot(Request::builder().uri("/slow").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = axum::body::to_bytes(response.into_body(), 1024)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["error"], "request_timed_out");
    }

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
            searched_hideouts: vec![],
            replay: vec![],
            outcome: None,
            economy: Default::default(),
        }
    }

    #[test]
    fn a_visit_names_the_placement_it_uses_and_agrees_with_its_travel_time() {
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        for ((state, venue_id), placements) in catalogue.location_venues.iter().take(200) {
            let placement = picked_placement(&catalogue, state, venue_id, "NG-M0001", 0).unwrap();
            assert!(
                placements
                    .iter()
                    .any(|candidate| candidate.location_id == placement.location_id)
            );
            assert!(!placement.venue_name.is_empty() && !placement.location_name.is_empty());
            assert_eq!(
                placement_minutes(&catalogue, state, venue_id, "NG-M0001", 0).unwrap(),
                placement.hub_travel_minutes.max(5)
            );
        }
    }

    #[test]
    fn local_quotes_exclude_questioned_witnesses_without_changing_dossier_assignment() {
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        let mission = catalogue.missions.values().next().unwrap();
        let mut game = state();
        game.mission_id = mission.mission_id.clone();
        game.route = catalogue.route(mission).unwrap();
        game.state = game.route[0].clone();
        let venues = unquestioned_venue_ids(&catalogue, &game);
        assert!(!venues.is_empty());
        let witness = dossier_witness_venue(&catalogue, &game);
        let visited = venues[0].clone();
        game.visited_venues
            .push(format!("0|{}|{}", game.state, visited));
        assert!(!unquestioned_venue_ids(&catalogue, &game).contains(&visited));
        assert_eq!(dossier_witness_venue(&catalogue, &game), witness);
        game.visited_venues = vec![format!("1|{}|{}", game.state, visited)];
        assert!(unquestioned_venue_ids(&catalogue, &game).contains(&visited));
    }

    #[test]
    fn public_state_never_contains_hidden_route_thief_or_observations() {
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        let mission = catalogue.missions.values().next().unwrap();
        let route = catalogue.route(mission).unwrap();
        let mut game = state();
        game.mission_id = mission.mission_id.clone();
        game.thief_id = mission.thief_id.clone();
        game.state = route[0].clone();
        game.route = route;
        let public = public_game_state(&game, &catalogue).unwrap();
        let json = serde_json::to_value(&public).unwrap();
        let fields = json.as_object().unwrap();
        assert!(!fields.contains_key("thief_id"));
        assert!(!fields.contains_key("route"));
        assert!(!fields.contains_key("observations"));
        assert!(!fields.contains_key("hideout_venue"));
        assert!(!public.case_dossier.title.is_empty());
        assert!(!public.case_dossier.stolen_item.is_empty());
        assert!(!public.case_dossier.premise.is_empty());
        assert!(!public.case_dossier.opening_briefing.is_empty());
    }

    #[test]
    fn final_stop_exposes_three_close_suspect_files_only_after_dossier_is_complete() {
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        for mission in catalogue.missions.values() {
            let mut game = state();
            game.mission_id = mission.mission_id.clone();
            game.thief_id = mission.thief_id.clone();
            game.route = catalogue.route(mission).unwrap();
            game.stage = (game.route.len() - 1) as u8;
            game.state = game.route.last().unwrap().clone();
            assert!(suspect_files(&game, &catalogue).is_empty());

            let target = catalogue.profiles.get(&game.thief_id).unwrap();
            game.dossier = target
                .traits()
                .into_iter()
                .map(|(key, value)| (key.to_owned(), value.to_owned()))
                .collect();
            let files = suspect_files(&game, &catalogue);
            assert_eq!(files.len(), 3, "{}", mission.mission_id);
            assert!(files.iter().any(|file| file.suspect_id == game.thief_id));
            for file in &files {
                assert!(!file.name.is_empty());
                assert!(!file.alias.is_empty());
                assert_eq!(file.dossier.len(), 8);
                assert!(!file.summary.is_empty());
                if file.suspect_id != game.thief_id {
                    let distance = target
                        .traits()
                        .iter()
                        .zip(catalogue.profiles[&file.suspect_id].traits())
                        .filter(|((_, expected), (_, candidate))| expected != candidate)
                        .count();
                    assert!((1..=2).contains(&distance));
                }
            }
            assert_eq!(files, suspect_files(&game, &catalogue));
        }
    }

    #[test]
    fn every_final_stop_offers_exactly_five_hideouts_including_the_real_one() {
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        for mission in catalogue.missions.values() {
            let mut game = state();
            game.mission_id = mission.mission_id.clone();
            game.route = catalogue.route(mission).unwrap();
            game.stage = (game.route.len() - 1) as u8;
            game.state = game.route.last().unwrap().clone();
            game.hideout_venue = catalogue
                .location_venues
                .keys()
                .find(|(jurisdiction, _)| jurisdiction == &game.state)
                .map(|(_, venue)| venue.clone())
                .unwrap();
            let options = hideout_options(&catalogue, &game);
            assert_eq!(options.len(), 5, "{} in {}", mission.mission_id, game.state);
            assert!(options.contains(&game.hideout_venue));
            let mut unique = options.clone();
            unique.sort();
            unique.dedup();
            assert_eq!(unique.len(), 5);
        }
    }
    #[test]
    fn validates_untrusted_identifiers_and_wait_bounds() {
        assert!(validate_id("../secret", "case_id").is_err());
        assert!(matches!(
            translate_command_stub(ClientCommand::Wait { minutes: 0 }),
            Err(_)
        ));
    }

    #[test]
    fn dossier_options_are_canonical_sorted_and_complete() {
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        let response = build_dossier_options(&catalogue);
        assert_eq!(response.catalogue_version, 1);
        assert_eq!(response.fields.len(), 8);
        let vehicles = response
            .fields
            .iter()
            .find(|field| field.field == "vehicle")
            .unwrap();
        assert_eq!(
            vehicles.options,
            vec![
                "a black motorcycle",
                "a blue minibus",
                "a dark luxury sedan",
                "a green sports car",
                "a grey hatchback",
                "a red convertible",
                "a silver saloon",
                "a vintage coupe",
                "a white pickup",
                "a yellow SUV",
            ]
        );
        for field in &response.fields {
            assert!(!field.options.is_empty());
            assert!(field.options.windows(2).all(|pair| pair[0] < pair[1]));
        }
    }
    #[test]
    fn weekly_schedule_uses_monday_seven_wat_boundaries() {
        let (start, end) = weekly_window(1_767_592_800);
        assert_eq!(start, 1_767_592_800);
        assert_eq!(end, 1_768_197_600);
        let (previous, _) = weekly_window(start - 1);
        assert_eq!(previous, start - 604_800);
    }
    fn translate_command_stub(command: ClientCommand) -> Result<(), String> {
        match command {
            ClientCommand::Wait { minutes } if (1..=720).contains(&minutes) => Ok(()),
            ClientCommand::Wait { .. } => Err("invalid".into()),
            _ => Ok(()),
        }
    }
    #[test]
    fn authentication_uses_random_session_hashes_and_secure_cookies() {
        let config = ServiceConfig::test();
        let first = random_token();
        let second = random_token();
        assert_ne!(first, second);
        assert_eq!(hash_token(&first).len(), 64);
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
    fn registration_requires_integer_birth_date_fields() {
        let valid = serde_json::json!({
            "email": "adult@example.invalid", "password": "a-long-password",
            "confirm_password": "a-long-password", "username": "adult", "home_base": "Lagos",
            "dob_day": 29, "dob_month": 2, "dob_year": 2000
        });
        let request: RegisterRequest = serde_json::from_value(valid.clone()).unwrap();
        assert!(BirthDate::new(request.dob_day, request.dob_month, request.dob_year).is_ok());
        for field in ["dob_day", "dob_month", "dob_year"] {
            let mut missing = valid.clone();
            missing.as_object_mut().unwrap().remove(field);
            assert!(serde_json::from_value::<RegisterRequest>(missing).is_err());
            for value in [
                serde_json::json!("1"),
                serde_json::json!(null),
                serde_json::json!(-1),
                serde_json::json!(1.5),
            ] {
                let mut invalid = valid.clone();
                invalid[field] = value;
                assert!(serde_json::from_value::<RegisterRequest>(invalid).is_err());
            }
        }
    }

    #[tokio::test]
    async fn live_mysql_registration_enforces_birth_date_before_creating_account() {
        if env::var("NAIJACHASE_MYSQL_TEST").ok().as_deref() != Some("1") {
            return;
        }
        use axum::body::{Body, to_bytes};
        use axum::http::Request;
        use tower::ServiceExt;

        let store = Arc::new(MysqlStore::connect_from_env().unwrap());
        store.migrate().unwrap();
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let app = router(Arc::new(AppState {
            store: store.clone(),
            catalogue: Arc::new(Catalogue::load(&root).unwrap()),
            config: ServiceConfig::test(),
            metrics: Metrics::default(),
            email_client: reqwest::Client::new(),
        }));
        let id = uuid::Uuid::new_v4().simple().to_string();
        let email = format!("dob-{id}@example.invalid");
        let mut body = serde_json::json!({
            "email": email, "password": "a-long-password",
            "confirm_password": "a-long-password", "username": &id[..24], "home_base": "Lagos",
            "dob_day": 31, "dob_month": 4, "dob_year": 2000
        });
        for (day, month, year, message) in [
            (31, 4, 2000, "Enter a valid date of birth."),
            (1, 1, 9999, "Date of birth cannot be in the future."),
            (1, 1, 2020, "You must be 18 years or older."),
        ] {
            body["dob_day"] = day.into();
            body["dob_month"] = month.into();
            body["dob_year"] = year.into();
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/v1/auth/register")
                        .header(header::CONTENT_TYPE, "application/json")
                        .body(Body::from(body.to_string()))
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
            let error: serde_json::Value =
                serde_json::from_slice(&to_bytes(response.into_body(), 4096).await.unwrap())
                    .unwrap();
            assert_eq!(error["message"], message);
            assert!(store.login_record(&email).unwrap().is_none());
        }
        for invalid in [
            serde_json::json!(null),
            serde_json::json!("29"),
            serde_json::json!(1.5),
        ] {
            body["dob_day"] = invalid;
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/v1/auth/register")
                        .header(header::CONTENT_TYPE, "application/json")
                        .body(Body::from(body.to_string()))
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
            assert!(store.login_record(&email).unwrap().is_none());
        }
        body["dob_day"] = 29.into();
        body["dob_month"] = 2.into();
        body["dob_year"] = 2000.into();
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/auth/register")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);
        let (account, _) = store.login_record(&email).unwrap().unwrap();
        assert!(!account.email_verified);
        store.delete_unverified_player(&account.player_id).unwrap();
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
            matches!(request.command, ClientCommand::Travel { destination, .. } if destination == "Kano")
        );
    }

    #[test]
    fn all_catalogue_missions_pass_budget_and_transport_strategy_simulation() {
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        let mut tier_usage = std::collections::BTreeMap::<u32, usize>::new();
        let mut budgets_by_difficulty = std::collections::BTreeMap::<u8, u32>::new();
        let mut least_minutes_remaining = naijachase_core::CASE_DEADLINE_MINUTES;
        let mut least_cash_remaining = u32::MAX;
        let mut deadline_exhausted_orders = 0usize;
        let witness_orders = [
            [0, 1, 2],
            [0, 2, 1],
            [1, 0, 2],
            [1, 2, 0],
            [2, 0, 1],
            [2, 1, 0],
        ];
        assert_eq!(catalogue.missions.len(), 1_000);
        for mission in catalogue.missions.values() {
            let baseline = mission_budget_baseline(&catalogue, mission).unwrap();
            let budget = *budgets_by_difficulty
                .entry(mission.difficulty)
                .or_insert_with(|| opening_budget_for(&catalogue, mission).unwrap());
            assert!(budget >= baseline.saturating_mul(120).div_ceil(100));
            assert_eq!(budget % 5_000, 0);
            *tier_usage.entry(budget).or_default() += 1;

            let route = catalogue.route(mission).unwrap();
            let mut mixed_cost = 0u32;
            for pair in route.windows(2) {
                let base = catalogue.travel[&(pair[0].clone(), pair[1].clone())].travel_minutes;
                mixed_cost = mixed_cost
                    .saturating_add(naijachase_core::interstate_quote(base, "drive").unwrap().1);
                assert_eq!(
                    naijachase_core::interstate_quote(base, "hitch_ride")
                        .unwrap()
                        .1,
                    0
                );
            }
            assert!(mixed_cost <= budget);

            let stage_venues = route
                .iter()
                .enumerate()
                .map(|(stage, state)| {
                    available_venue_ids_for(&catalogue, &route, &mission.mission_id, stage, state)
                })
                .collect::<Vec<_>>();

            // Exercise the actual API-to-engine path for all three witnesses at
            // every stop, paid local driving, the fastest interstate travel,
            // dossier completion, warrant and paid apprehension. Run every
            // possible witness order because venue opening hours can change the
            // wait incurred by the following interview. A case passes when at
            // least one complete three-witness itinerary fits the week; slower
            // choices remain a deliberate way for a player to lose on time.
            let mut mission_has_complete_itinerary = false;
            for order in witness_orders {
                let mut game = build_game_from_mission(&catalogue, mission, 0, 0).unwrap();
                for stage in 0..game.route.len() {
                    let venues = &stage_venues[stage];
                    assert_eq!(venues.len(), 3, "{} stage {stage}", mission.mission_id);
                    let profile = &catalogue.profiles[&mission.thief_id];
                    let (field, value) = profile.traits()[dossier_trait_index(&game, stage)];
                    for (position, index) in order.into_iter().enumerate() {
                        let venue_id = &venues[index];
                        let venue = &catalogue.venues[venue_id];
                        let base_travel = placement_minutes(
                            &catalogue,
                            &game.state,
                            venue_id,
                            &game.mission_id,
                            game.stage,
                        )
                        .unwrap();
                        let (travel_minutes, cost) =
                            naijachase_core::local_quote(base_travel, "drive").unwrap();
                        let wait_minutes = wait_until_open(
                            game.elapsed.saturating_add(travel_minutes),
                            venue.opens_hour,
                            venue.closes_hour,
                        );
                        game = naijachase_core::apply(
                            game,
                            Command::VisitVenueBy {
                                venue_id: venue_id.clone(),
                                trait_name: if position == 0 {
                                    field.into()
                                } else {
                                    String::new()
                                },
                                trait_value: if position == 0 {
                                    value.into()
                                } else {
                                    String::new()
                                },
                                mode: "drive".into(),
                                travel_minutes,
                                wait_minutes,
                                interview_minutes: venue.interview_minutes,
                                cost,
                            },
                        )
                        .unwrap()
                        .0;
                    }
                    game = naijachase_core::apply(
                        game,
                        Command::RecordTrait {
                            trait_name: field.into(),
                            value: value.into(),
                        },
                    )
                    .unwrap()
                    .0;
                    if stage + 1 < game.route.len() {
                        let destination = game.route[stage + 1].clone();
                        let base = catalogue.travel[&(game.state.clone(), destination.clone())]
                            .travel_minutes;
                        let (minutes, cost) =
                            naijachase_core::interstate_quote(base, "fly").unwrap();
                        game = naijachase_core::apply(
                            game,
                            Command::TravelBy {
                                destination,
                                mode: "fly".into(),
                                minutes,
                                cost,
                            },
                        )
                        .unwrap()
                        .0;
                    }
                }
                game = naijachase_core::apply(
                    game,
                    Command::RequestWarrant {
                        suspect_id: Some(mission.thief_id.clone()),
                    },
                )
                .unwrap()
                .0;
                let hideout = game.hideout_venue.clone();
                let venue = &catalogue.venues[&hideout];
                let base_travel = placement_minutes(
                    &catalogue,
                    &game.state,
                    &hideout,
                    &game.mission_id,
                    game.stage,
                )
                .unwrap();
                let (travel_minutes, cost) =
                    naijachase_core::local_quote(base_travel, "drive").unwrap();
                game = naijachase_core::apply(
                    game,
                    Command::SearchHideoutBy {
                        venue_id: hideout,
                        mode: "drive".into(),
                        travel_minutes,
                        search_minutes: venue.interview_minutes,
                        cost,
                    },
                )
                .unwrap()
                .0;
                if game.outcome.as_deref() != Some("solved") {
                    deadline_exhausted_orders += 1;
                    continue;
                }
                mission_has_complete_itinerary = true;
                assert!(
                    game.economy.balance > 0,
                    "{} exhausted its opening budget",
                    mission.mission_id
                );
                least_minutes_remaining = least_minutes_remaining
                    .min(naijachase_core::CASE_DEADLINE_MINUTES.saturating_sub(game.elapsed));
                least_cash_remaining = least_cash_remaining.min(game.economy.balance);
            }
            assert!(
                mission_has_complete_itinerary,
                "{} has no complete three-witness itinerary within seven days",
                mission.mission_id
            );

            let origin = &route[0];
            if let Some((_, edge)) = catalogue
                .travel
                .iter()
                .find(|((from, destination), _)| from == origin && destination != &route[1])
            {
                let wrong_turn_cost = naijachase_core::interstate_quote(edge.travel_minutes, "fly")
                    .unwrap()
                    .1;
                assert!(wrong_turn_cost > 0 && wrong_turn_cost < budget);
            }
        }
        assert!(tier_usage.values().all(|uses| *uses > 1));
        assert!(tier_usage.len() <= 5);
        eprintln!(
            "catalogue audit: 1000 missions passed; minimum remaining time={least_minutes_remaining} minutes; minimum remaining cash=₦{least_cash_remaining}; deliberately slow witness orders that exhausted the deadline={deadline_exhausted_orders}"
        );
    }

    #[test]
    fn complete_catalogue_pressure_assignment_is_deterministic_and_optional() {
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        let mut assigned = 0usize;
        for mission in catalogue.missions.values() {
            let route = catalogue.route(mission).unwrap();
            let game = GameState {
                version: 1,
                mission_id: mission.mission_id.clone(),
                thief_id: mission.thief_id.clone(),
                difficulty: mission.difficulty,
                stage: 0,
                state: route[0].clone(),
                route,
                elapsed: 0,
                score: 0,
                career_points: 0,
                dossier: Default::default(),
                observations: Default::default(),
                visited_venues: vec![],
                warrant_suspect: None,
                hideout_venue: String::new(),
                searched_hideouts: vec![],
                replay: vec![],
                outcome: None,
                economy: Default::default(),
            };
            let mut venues = available_venue_ids(&catalogue, &game);
            venues.sort();
            assert_eq!(venues.len(), 3);
            let first = pressure_assignment(&mission.mission_id, &game, &venues);
            let second = pressure_assignment(&mission.mission_id, &game, &venues);
            assert_eq!(first, second);
            if let Some(venue) = first {
                assert!(venues.contains(&venue));
                assigned += 1;
            }
        }
        assert!(
            (580..=720).contains(&assigned),
            "65% assignment drifted to {assigned}/1000"
        );
    }

    #[test]
    fn dossier_witnesses_and_trait_sequence_are_deterministic_but_not_fixed() {
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        let mut witness_positions = [0usize; 3];
        let mut opening_traits = [0usize; 8];
        for mission in catalogue.missions.values() {
            let route = catalogue.route(mission).unwrap();
            let game = GameState {
                version: 1,
                mission_id: mission.mission_id.clone(),
                thief_id: mission.thief_id.clone(),
                difficulty: mission.difficulty,
                stage: 0,
                state: route[0].clone(),
                route,
                elapsed: 0,
                score: 0,
                career_points: 0,
                dossier: Default::default(),
                observations: Default::default(),
                visited_venues: vec![],
                warrant_suspect: None,
                hideout_venue: format!("hideout-{}", mission.mission_id),
                searched_hideouts: vec![],
                replay: vec![],
                outcome: None,
                economy: Default::default(),
            };
            let venues = available_venue_ids(&catalogue, &game);
            let key = dossier_witness_venue(&catalogue, &game).unwrap();
            let position = venues.iter().position(|venue| venue == &key).unwrap();
            witness_positions[position] += 1;

            let order = dossier_trait_order(&game);
            assert_eq!(
                order
                    .iter()
                    .copied()
                    .collect::<std::collections::BTreeSet<_>>()
                    .len(),
                8
            );
            assert_eq!(order, dossier_trait_order(&game));
            opening_traits[order[0]] += 1;
        }
        assert!(
            witness_positions.iter().all(|count| *count > 200),
            "{witness_positions:?}"
        );
        assert!(
            opening_traits.iter().all(|count| *count > 50),
            "{opening_traits:?}"
        );
    }

    #[test]
    fn every_mission_stop_has_two_ambiguous_clues_and_a_non_key_decisive_clue() {
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        let mut decisive_positions = [0usize; 3];
        let mut key_positions = [0usize; 3];
        for mission in catalogue.missions.values() {
            let route = catalogue.route(mission).unwrap();
            for stage in 0..route.len() {
                let game = GameState {
                    version: 1,
                    mission_id: mission.mission_id.clone(),
                    thief_id: mission.thief_id.clone(),
                    difficulty: mission.difficulty,
                    stage: stage as u8,
                    state: route[stage].clone(),
                    route: route.clone(),
                    elapsed: 0,
                    score: 0,
                    career_points: 0,
                    dossier: Default::default(),
                    observations: Default::default(),
                    visited_venues: vec![],
                    warrant_suspect: None,
                    hideout_venue: format!("hideout-{}", mission.mission_id),
                    searched_hideouts: vec![],
                    replay: vec![],
                    outcome: None,
                    economy: Default::default(),
                };
                let plan = witness_clue_plan(&catalogue, &game);
                assert_eq!(plan.len(), 3, "{} stage {stage}", mission.mission_id);
                let venues = plan
                    .iter()
                    .map(|atom| atom.venue_id.as_str())
                    .collect::<BTreeSet<_>>();
                assert_eq!(venues.len(), 3);
                let decisive = plan
                    .iter()
                    .enumerate()
                    .filter(|(_, atom)| atom.dimension == "landmark")
                    .collect::<Vec<_>>();
                assert_eq!(decisive.len(), 1);
                decisive_positions[decisive[0].0] += 1;
                let ambiguous = plan
                    .iter()
                    .filter(|atom| atom.dimension != "landmark")
                    .collect::<Vec<_>>();
                assert_eq!(ambiguous.len(), 2);
                assert!(
                    ambiguous
                        .iter()
                        .all(|atom| candidate_states(atom).len() > 1)
                );
                let combined = candidate_states(ambiguous[0])
                    .intersection(&candidate_states(ambiguous[1]))
                    .copied()
                    .collect::<BTreeSet<_>>();
                assert!(combined.contains(route.get(stage + 1).unwrap_or(&route[stage]).as_str()));
                assert!(
                    combined.len() < candidate_states(ambiguous[0]).len()
                        || combined.len() < candidate_states(ambiguous[1]).len(),
                    "ambiguous clues do not narrow {} stage {stage}",
                    mission.mission_id
                );
                let key = dossier_witness_venue(&catalogue, &game).unwrap();
                let key_position = plan.iter().position(|atom| atom.venue_id == key).unwrap();
                key_positions[key_position] += 1;
                assert_ne!(plan[key_position].dimension, "landmark");
                assert_eq!(
                    available_venue_ids(&catalogue, &game),
                    plan.iter()
                        .map(|atom| atom.venue_id.clone())
                        .collect::<Vec<_>>()
                );
            }
        }
        assert!(decisive_positions.iter().all(|count| *count > 500));
        assert!(key_positions.iter().all(|count| *count > 500));
    }

    #[test]
    fn hired_assistant_suggests_three_routes_and_reduces_only_witness_travel_time() {
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        for mission in catalogue.missions.values() {
            let route = catalogue.route(mission).unwrap();
            let mut game = state();
            game.mission_id = mission.mission_id.clone();
            game.thief_id = mission.thief_id.clone();
            game.route = route.clone();
            game.state = route[0].clone();
            game.economy.assistant_hired = true;
            let suggestions = assistant_route_suggestions(&catalogue, &game);
            assert_eq!(suggestions.len(), 3);
            assert!(suggestions.contains(&route[1]));
            assert_eq!(suggestions, assistant_route_suggestions(&catalogue, &game));
        }
        assert_eq!(assistant_witness_minutes(100, false), 100);
        assert_eq!(assistant_witness_minutes(100, true), 98);
        assert_eq!(assistant_witness_minutes(40, true), 39);
    }

    #[test]
    fn wrong_jurisdictions_are_cold_and_never_replay_route_clues() {
        let root = FsPath::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        let mission = catalogue.missions.values().next().unwrap();
        let route = catalogue.route(mission).unwrap();
        let wrong_state = catalogue
            .atoms
            .keys()
            .find(|candidate| {
                !route.contains(candidate)
                    && catalogue
                        .location_venues
                        .keys()
                        .filter(|(state, _)| state == *candidate)
                        .count()
                        >= 3
            })
            .unwrap()
            .clone();
        let game = GameState {
            version: 1,
            mission_id: mission.mission_id.clone(),
            thief_id: mission.thief_id.clone(),
            difficulty: mission.difficulty,
            stage: 0,
            state: wrong_state,
            route,
            elapsed: 0,
            score: 500,
            career_points: 0,
            dossier: Default::default(),
            observations: Default::default(),
            visited_venues: vec![],
            warrant_suspect: None,
            hideout_venue: "hideout".into(),
            searched_hideouts: vec![],
            replay: vec![],
            outcome: None,
            economy: Default::default(),
        };

        assert!(!is_on_trail(&game));
        assert_eq!(
            public_game_state(&game, &catalogue).unwrap().trail_status,
            "cold"
        );
        assert!(dossier_witness_venue(&catalogue, &game).is_none());
        let venues = available_venue_ids(&catalogue, &game);
        assert_eq!(venues.len(), 3);
        for venue_id in venues {
            let (command, event) = translate_command(
                &catalogue,
                &game,
                ClientCommand::VisitVenue {
                    venue_id,
                    mode: "drive".into(),
                },
                "Lagos",
            )
            .unwrap();
            match command {
                Command::VisitVenueBy {
                    trait_name,
                    trait_value,
                    ..
                } => {
                    assert!(trait_name.is_empty());
                    assert!(trait_value.is_empty());
                }
                _ => panic!("expected a local witness visit"),
            }
            let event = event.unwrap();
            assert_eq!(event.event_type, "witness_account");
            assert_eq!(
                event.data.get("trail_status").map(String::as_str),
                Some("cold")
            );
            assert!(!event.data["message"].contains("I also noticed"));
        }
    }

    #[test]
    fn procedural_avatar_catalogue_is_stable_complete_and_renderer_safe() {
        let ids = AVATAR_PRESETS
            .iter()
            .map(|preset| preset.avatar_id)
            .collect::<std::collections::BTreeSet<_>>();
        assert_eq!(AVATAR_PRESETS.len(), 10);
        assert_eq!(ids.len(), 10);
        assert_eq!(
            AVATAR_PRESETS
                .iter()
                .filter(|p| p.presentation == "feminine")
                .count(),
            5
        );
        assert_eq!(
            AVATAR_PRESETS
                .iter()
                .filter(|p| p.presentation == "masculine")
                .count(),
            5
        );
        for preset in AVATAR_PRESETS {
            for colour in [
                preset.skin_color,
                preset.hair_color,
                preset.uniform_primary,
                preset.uniform_secondary,
                preset.uniform_accent,
            ] {
                assert_eq!(colour.len(), 7);
                assert!(colour.starts_with('#'));
                assert!(
                    colour[1..]
                        .chars()
                        .all(|character| character.is_ascii_hexdigit())
                );
            }
            assert_eq!(avatar_preset(preset.avatar_id), Some(preset));
        }
        assert_eq!(avatar_preset("client-invented-avatar"), None);
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
            "/v1/avatar/options",
            "/v1/profile/avatar",
            "/v1/progression/summary",
            "/v1/progression/archive",
            "/v1/progression/achievements",
            "/v1/cooperation/preferences",
            "/v1/cooperation/requests",
            "/v1/cooperation/requests/{request_id}/accept",
            "/v1/cooperation/requests/{request_id}/decline",
            "/v1/cooperation/requests/{request_id}/complete",
            "/v1/cooperation/requests/{request_id}/acknowledge",
            "/v1/cooperation/blocks",
            "/v1/cooperation/blocks/{player_id}",
            "/v1/cooperation/reports",
            "/v1/cooperation/reputation",
            "/v1/groups",
            "/v1/groups/{group_id}",
            "/v1/groups/{group_id}/delete",
            "/v1/groups/{group_id}/members",
            "/v1/groups/{group_id}/invitations",
            "/v1/groups/invitations/{invitation_id}",
            "/v1/group-invitations",
            "/v1/groups/{group_id}/leave",
            "/v1/groups/{group_id}/transfer-ownership",
            "/v1/groups/{group_id}/weekly/current",
            "/v1/weekly/{challenge_id}/attempt",
            "/v1/weekly/attempts/{attempt_id}",
            "/v1/weekly/attempts/{attempt_id}/commands",
            "/v1/weekly/attempts/{attempt_id}/transport-quotes",
            "/v1/weekly/attempts/{attempt_id}/accounts",
            "/v1/weekly/{challenge_id}",
            "/v1/weekly/{challenge_id}/events",
            "/v1/weekly/{challenge_id}/cancel",
            "/v1/weekly/history",
            "/v1/weekly/notifications",
            "/v1/cases",
            "/v1/activity/current",
            "/v1/cases/current",
            "/v1/cases/{case_id}/abandon",
            "/v1/cases/catalogue-status",
            "/v1/cases/catalogue-notifications",
            "/v1/cases/{case_id}/transport-quotes",
            "/v1/cases/{case_id}/ledger",
            "/v1/cases/{case_id}/assistant/routes",
            "/v1/cases/{case_id}/pressure",
            "/v1/cases/{case_id}/pressure-attempts",
            "/v1/economy/bribe-tokens",
            "/v1/economy/bribe-tokens/ledger",
            "/v1/discipline",
            "/v1/discipline/jail",
            "/v1/discipline/{disciplinary_case_id}/acknowledge",
            "/v1/admin/catalogue/health",
            "/v1/admin/catalogue/me",
            "/v1/admin/catalogue/missions/{mission_id}",
            "/v1/admin/catalogue/missions/{mission_id}/validation",
            "/v1/admin/catalogue/missions/{mission_id}/transition",
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
            "CatalogueHealth",
            "MissionValidation",
            "MissionTransitionRequest",
            "CooperationPreferences",
            "CooperationRequest",
            "PressureWitnessRequest",
            "PressureResult",
            "PressureAttemptRecord",
            "DisciplinaryCase",
            "TokenBalance",
            "TokenLedgerEntry",
            "JailStatus",
            "AbandonCaseRequest",
            "AbandonCaseResponse",
            "AssistantRoutesResponse",
        ] {
            assert!(
                generated.contains(&format!("type {type_name}=")),
                "generated TypeScript missing {type_name}"
            );
        }
    }
}
