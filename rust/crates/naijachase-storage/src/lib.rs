use mysql::{OptsBuilder, Pool, SslOpts, TxOpts, params, prelude::Queryable};
use naijachase_contracts::{Event, GameState};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    env, fs,
    num::ParseIntError,
    path::{Path, PathBuf},
};
use thiserror::Error;
mod weekly;
pub use weekly::*;
mod pressure;
pub use pressure::*;

const MIGRATION_1: &str = include_str!("../migrations/0001_initial.sql");
const MIGRATION_2: &str = include_str!("../migrations/0002_content_and_terminal.sql");
const MIGRATION_3: &str = include_str!("../migrations/0003_thief_alias_index.sql");
const MIGRATION_4: &str = include_str!("../migrations/0004_api_audit.sql");
const MIGRATION_5: &str = include_str!("../migrations/0005_player_auth.sql");
const MIGRATION_6: &str = include_str!("../migrations/0006_identity_progression.sql");
const MIGRATION_7: &str = include_str!("../migrations/0007_auth_rate_limits.sql");
const MIGRATION_8: &str = include_str!("../migrations/0008_progression_sessions.sql");
const MIGRATION_9: &str = include_str!("../migrations/0009_case_assignment.sql");
const MIGRATION_10: &str = include_str!("../migrations/0010_continuous_catalogue.sql");
const MIGRATION_11: &str = include_str!("../migrations/0011_active_case_content_version.sql");
const MIGRATION_12: &str = include_str!("../migrations/0012_cooperative_investigations.sql");
const MIGRATION_13: &str = include_str!("../migrations/0013_groups_weekly_challenges.sql");
const MIGRATION_14: &str = include_str!("../migrations/0014_witness_pressure.sql");
const MIGRATION_15: &str = include_str!("../migrations/0015_avatar_selection.sql");

#[derive(Clone, Debug, PartialEq)]
pub enum CaseCommandResult {
    Applied {
        version: u64,
        state: GameState,
        events: Vec<Event>,
    },
    Duplicate {
        version: u64,
        state: GameState,
        events: Vec<Event>,
    },
}

#[derive(Serialize, Deserialize)]
struct PersistedCommandResult {
    state: GameState,
    events: Vec<Event>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContentImportSummary {
    pub files: usize,
    pub rows: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct PlayerAccount {
    pub player_id: String,
    pub email: String,
    pub username: String,
    pub home_base: String,
    pub email_verified: bool,
    pub display_name: Option<String>,
    pub pronouns: Option<String>,
    pub sex: Option<String>,
    pub avatar_id: Option<String>,
    pub uniform_id: Option<String>,
    pub avatar_setup_complete: bool,
    pub leaderboard_opt_in: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct CaseArchiveEntry {
    pub case_id: String,
    pub mission_id: String,
    pub thief_id: String,
    pub outcome: String,
    pub score: u32,
    pub elapsed_minutes: u32,
    pub completed_at: String,
    pub states_visited: Vec<String>,
    pub correct_travels: u32,
    pub wrong_travels: u32,
    pub correct_deductions: u32,
    pub wrong_deductions: u32,
    pub attempt_kind: String,
    pub first_completion: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Achievement {
    pub achievement_id: String,
    pub earned_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct PlayerSession {
    pub session_id: String,
    pub device_label: Option<String>,
    pub created_at: String,
    pub last_seen_at: String,
    pub expires_at: String,
    pub current: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct RankHistoryEntry {
    pub old_rank: String,
    pub new_rank: String,
    pub points: u64,
    pub earned_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProgressionSummary {
    pub points: u64,
    pub rank: String,
    pub solved_cases: u64,
    pub visited_states: Vec<String>,
    pub correct_travels: u64,
    pub wrong_travels: u64,
    pub correct_deductions: u64,
    pub wrong_deductions: u64,
    pub achievements: Vec<Achievement>,
    pub rank_history: Vec<RankHistoryEntry>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct CatalogueProgress {
    pub published_cases: u64,
    pub completed_cases: u64,
    pub unseen_cases: u64,
    pub exhausted: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeMission {
    pub mission_id: String,
    pub difficulty: u8,
    pub thief_id: String,
    pub start_location_id: String,
    pub stop_2_location_id: String,
    pub stop_3_location_id: String,
    pub capture_location_id: String,
    pub content_version: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct CatalogueHealth {
    pub draft: u64,
    pub editorial_review: u64,
    pub validated: u64,
    pub scheduled: u64,
    pub published: u64,
    pub retired: u64,
    pub exhausted_players: u64,
    pub minimum_unseen_cases: u64,
    pub reserve_below_target: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReleaseNotification {
    pub notification_id: u64,
    pub mission_id: String,
    pub published_at: String,
    pub read: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct CooperationPreferences {
    pub enabled: bool,
    pub email_enabled: bool,
    pub age_assurance_status: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct CooperationRequest {
    pub request_id: String,
    pub owner_username: String,
    pub helper_username: String,
    pub case_id: String,
    pub venue_id: String,
    pub status: String,
    pub public_scene: serde_json::Value,
    pub recommendation: Option<serde_json::Value>,
    pub reward_granted: bool,
    pub expires_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct MissionValidation {
    pub mission_id: String,
    pub valid: bool,
    pub issues: Vec<String>,
}

type PreparedCsv = (String, String, Vec<String>, Vec<Vec<String>>);

fn rank_name(points: u64) -> &'static str {
    [
        (35000, "Master Detective"),
        (22000, "Chief Inspector"),
        (14000, "Senior Inspector"),
        (8000, "Inspector"),
        (4000, "Senior Investigator"),
        (1500, "Investigator"),
        (0, "Rookie"),
    ]
    .into_iter()
    .find(|(minimum, _)| points >= *minimum)
    .unwrap()
    .1
}
fn rank_achievement(rank: &str) -> Option<&'static str> {
    match rank {
        "Investigator" => Some("rank_investigator"),
        "Senior Investigator" => Some("rank_senior_investigator"),
        "Inspector" => Some("rank_inspector"),
        "Senior Inspector" => Some("rank_senior_inspector"),
        "Chief Inspector" => Some("rank_chief_inspector"),
        "Master Detective" => Some("master_detective"),
        _ => None,
    }
}

fn award_achievement_tokens(
    transaction: &mut mysql::Transaction<'_>,
    player_id: &str,
    achievement_id: &str,
    requested: u32,
    awards: &mut Vec<TokenAward>,
) -> Result<(), StorageError> {
    let balance: u32 = transaction
        .exec_first(
            "SELECT bribe_tokens FROM players WHERE player_id=:player FOR UPDATE",
            params! {"player"=>player_id},
        )?
        .unwrap_or(0);
    let amount = requested
        .min(naijachase_contracts::economy::BRIBE_TOKEN_BALANCE_CAP.saturating_sub(balance));
    if amount == 0 {
        return Ok(());
    }
    let after = balance + amount;
    transaction.exec_drop(
        "UPDATE players SET bribe_tokens=:balance WHERE player_id=:player",
        params! {"balance"=>after,"player"=>player_id},
    )?;
    transaction.exec_drop("INSERT IGNORE INTO bribe_token_ledger(player_id,amount,balance_after,reason,reference_id) VALUES (:player,:amount,:balance,'achievement',:reference)",params!{"player"=>player_id,"amount"=>amount,"balance"=>after,"reference"=>achievement_id})?;
    awards.push(TokenAward {
        reason: "achievement".into(),
        amount,
        balance_after: after,
        components: vec![achievement_id.into()],
    });
    Ok(())
}

fn case_metrics(state: &GameState) -> (Vec<String>, u32, u32, u32, u32) {
    let mut states = BTreeSet::new();
    if let Some(first) = state.route.first() {
        states.insert(first.clone());
    }
    let mut stage = 0usize;
    let mut correct_travels = 0;
    let mut wrong_travels = 0;
    let mut correct_deductions = 0;
    let mut wrong_deductions = 0;
    for command in &state.replay {
        match command {
            naijachase_contracts::Command::Travel { destination, .. } => {
                states.insert(destination.clone());
                if state.route.get(stage + 1) == Some(destination) {
                    stage += 1;
                    correct_travels += 1
                } else {
                    wrong_travels += 1
                }
            }
            naijachase_contracts::Command::RecordTrait { trait_name, value } => {
                if state.observations.get(trait_name) == Some(value) {
                    correct_deductions += 1
                } else {
                    wrong_deductions += 1
                }
            }
            _ => {}
        }
    }
    (
        states.into_iter().collect(),
        correct_travels,
        wrong_travels,
        correct_deductions,
        wrong_deductions,
    )
}

#[derive(Debug, Serialize, Deserialize)]
struct OperationalBackup {
    format_version: u32,
    players: Vec<(String, String)>,
    careers: Vec<(String, u64, String, u64)>,
    terminal_careers: Vec<(String, u64, Vec<u8>)>,
    active_cases: Vec<(String, Option<String>, Option<String>, u64, Vec<u8>)>,
    case_events: Vec<(String, String, u64, String)>,
    #[serde(default)]
    service_audit: Vec<(Option<String>, Option<String>, Option<String>, String)>,
    #[serde(default)]
    auth_players: Vec<(
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    )>,
    #[serde(default)]
    email_verifications: Vec<(String, String, String, Option<String>)>,
    #[serde(default)]
    player_sessions: Vec<(String, String, String, Option<String>)>,
    #[serde(default)]
    player_profiles: Vec<(
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        String,
        bool,
    )>,
    #[serde(default)]
    case_archive: Vec<(String, String, String, String, String, u32, u32, String)>,
    #[serde(default)]
    achievements: Vec<(String, String, String)>,
    #[serde(default)]
    archive_metrics: Vec<(String, Option<String>, u32, u32, u32, u32)>,
    #[serde(default)]
    state_visits: Vec<(String, String, String)>,
    #[serde(default)]
    rank_history: Vec<(String, String, String, u64, String)>,
    #[serde(default)]
    session_details: Vec<(
        String,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    )>,
    #[serde(default)]
    active_case_kinds: Vec<(String, String)>,
    #[serde(default)]
    active_case_content_versions: Vec<(String, u32)>,
    #[serde(default)]
    archive_completion_metadata: Vec<(String, String, bool)>,
    #[serde(default)]
    mission_completions: Vec<(String, String, String, String, u32, u32, u32)>,
    #[serde(default)]
    active_mission_assignments: Vec<(String, String, String)>,
    #[serde(default)]
    content_roles: Vec<(String, String)>,
    #[serde(default)]
    mission_lifecycle: Vec<(
        String,
        String,
        u32,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    )>,
    #[serde(default)]
    mission_lifecycle_audit: Vec<(String, String, Option<String>, String, u32, String, String)>,
    #[serde(default)]
    release_notifications: Vec<(String, String, String, Option<String>)>,
    #[serde(default)]
    avatar_profiles: Vec<(String, Option<String>, Option<String>)>,
}

pub trait StateStore {
    type Error;
    fn load(&self, id: &str) -> Result<Option<Vec<u8>>, Self::Error>;
    fn save(&self, id: &str, version: u64, data: &[u8]) -> Result<(), Self::Error>;
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MysqlConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub database: String,
    pub ssl_mode: String,
}

impl MysqlConfig {
    pub fn from_env() -> Result<Self, StorageError> {
        load_repository_dotenv()?;
        Self::from_lookup(|key| env::var(key).ok())
    }

    fn from_lookup(mut lookup: impl FnMut(&str) -> Option<String>) -> Result<Self, StorageError> {
        let required = |lookup: &mut dyn FnMut(&str) -> Option<String>, key: &'static str| {
            lookup(key).ok_or(StorageError::MissingEnvironment(key))
        };
        let ssl_mode = lookup("MYSQL_SSL_MODE").unwrap_or_else(|| "disabled".into());
        if !matches!(ssl_mode.as_str(), "disabled" | "required") {
            return Err(StorageError::InvalidMysqlSslMode(ssl_mode));
        }
        Ok(Self {
            host: required(&mut lookup, "MYSQL_HOST")?,
            port: required(&mut lookup, "MYSQL_PORT")?.parse()?,
            user: required(&mut lookup, "MYSQL_USER")?,
            password: required(&mut lookup, "MYSQL_PASSWORD")?,
            database: required(&mut lookup, "MYSQL_DATABASE")?,
            ssl_mode,
        })
    }

    fn options(&self) -> OptsBuilder {
        let options = OptsBuilder::new()
            .ip_or_hostname(Some(self.host.clone()))
            .tcp_port(self.port)
            .user(Some(self.user.clone()))
            .pass(Some(self.password.clone()))
            .db_name(Some(self.database.clone()));
        if self.ssl_mode == "required" {
            options.ssl_opts(Some(
                SslOpts::default()
                    .with_danger_accept_invalid_certs(true)
                    .with_danger_skip_domain_validation(true),
            ))
        } else {
            options
        }
    }
}

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("mysql: {0}")]
    Mysql(#[from] mysql::Error),
    #[error("missing required environment variable {0}")]
    MissingEnvironment(&'static str),
    #[error("invalid MYSQL_PORT: {0}")]
    InvalidPort(#[from] ParseIntError),
    #[error("MYSQL_SSL_MODE must be disabled or required, got {0}")]
    InvalidMysqlSslMode(String),
    #[error("could not load .env: {0}")]
    Dotenv(#[from] dotenvy::Error),
    #[error("csv: {0}")]
    Csv(#[from] csv::Error),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid content: {0}")]
    InvalidContent(String),
    #[error("stale state version for {0}")]
    VersionConflict(String),
    #[error("case not found")]
    CaseNotFound,
    #[error("case is owned by another player")]
    Forbidden,
    #[error("command failed: {0}")]
    Command(String),
    #[error("email or username is already registered")]
    DuplicateAccount,
    #[error("mission was already completed")]
    MissionAlreadyCompleted,
    #[error("mission is not completed and cannot be replayed")]
    ReplayNotAvailable,
    #[error("no unseen published missions remain")]
    CatalogueExhausted,
}

pub fn repository_dotenv_path() -> Option<PathBuf> {
    if let Some(explicit) = env::var_os("NAIJACHASE_ENV_FILE").map(PathBuf::from) {
        if explicit.is_file() {
            return Some(explicit);
        }
    }
    let repository = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let repository_candidate = repository.join(".env");
    if repository_candidate.is_file() {
        return Some(repository_candidate);
    }
    let mut current = env::current_dir().ok();
    while let Some(directory) = current {
        let candidate = directory.join(".env");
        if candidate.is_file() {
            return Some(candidate);
        }
        current = directory.parent().map(Path::to_path_buf);
    }
    None
}

pub fn load_repository_dotenv() -> Result<Option<PathBuf>, StorageError> {
    let Some(path) = repository_dotenv_path() else {
        return Ok(None);
    };
    // The repository .env is the application's explicit configuration source.
    // Override stale values inherited from an IDE or parent shell.
    dotenvy::from_path_override(&path)?;
    Ok(Some(path))
}

pub struct MysqlStore {
    pool: Pool,
}

impl MysqlStore {
    pub fn connect(config: &MysqlConfig) -> Result<Self, StorageError> {
        Ok(Self {
            pool: Pool::new(config.options())?,
        })
    }

    pub fn connect_from_env() -> Result<Self, StorageError> {
        Self::connect(&MysqlConfig::from_env()?)
    }

    pub fn migrate(&self) -> Result<(), StorageError> {
        let mut connection = self.pool.get_conn()?;
        apply_migration(&mut connection, MIGRATION_1)?;
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version), 0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 2 {
            apply_migration(&mut connection, MIGRATION_2)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version), 0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 3 {
            apply_migration(&mut connection, MIGRATION_3)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version), 0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 4 {
            apply_migration(&mut connection, MIGRATION_4)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version), 0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 5 {
            apply_migration(&mut connection, MIGRATION_5)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version), 0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 6 {
            apply_migration(&mut connection, MIGRATION_6)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version),0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 7 {
            apply_migration(&mut connection, MIGRATION_7)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version),0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 8 {
            apply_migration(&mut connection, MIGRATION_8)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version),0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 9 {
            apply_migration(&mut connection, MIGRATION_9)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version),0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 10 {
            apply_migration(&mut connection, MIGRATION_10)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version),0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 11 {
            let has_content_version:u64=connection.exec_first("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='active_cases' AND column_name='content_version'",())?.unwrap_or(0);
            if has_content_version == 0 {
                connection.query_drop("ALTER TABLE active_cases ADD COLUMN content_version INT UNSIGNED NOT NULL DEFAULT 1")?;
            }
            apply_migration(&mut connection, MIGRATION_11)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version),0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 12 {
            apply_migration(&mut connection, MIGRATION_12)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version),0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 13 {
            apply_migration(&mut connection, MIGRATION_13)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version),0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 14 {
            apply_migration(&mut connection, MIGRATION_14)?;
        }
        let version: u32 = connection
            .query_first("SELECT COALESCE(MAX(version),0) FROM schema_migrations")?
            .unwrap_or(0);
        if version < 15 {
            apply_migration(&mut connection, MIGRATION_15)?;
        }
        Ok(())
    }

    pub fn ping(&self) -> Result<(), StorageError> {
        let value: Option<u8> = self.pool.get_conn()?.query_first("SELECT 1")?;
        if value == Some(1) {
            Ok(())
        } else {
            Err(StorageError::InvalidContent(
                "database health check failed".into(),
            ))
        }
    }

    pub fn register_player(
        &self,
        player_id: &str,
        email: &str,
        username: &str,
        home_base: &str,
        password_hash: &str,
        verification_hash: &str,
    ) -> Result<(), StorageError> {
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        if let Err(error)=transaction.exec_drop(
            "INSERT INTO players(player_id,display_name,email,username,home_base,password_hash)
             VALUES (:id,:username,:email,:username,:home,:password)",
            params!{"id"=>player_id,"username"=>username,"email"=>email,"home"=>home_base,"password"=>password_hash},
        ) { if matches!(&error,mysql::Error::MySqlError(server) if server.code==1062){return Err(StorageError::DuplicateAccount)} return Err(error.into()) }
        transaction.exec_drop(
            "INSERT INTO email_verifications(token_hash,player_id,expires_at)
             VALUES (:token,:id,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))",
            params! {"token"=>verification_hash,"id"=>player_id},
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn delete_unverified_player(&self, player_id: &str) -> Result<(), StorageError> {
        self.pool.get_conn()?.exec_drop(
            "DELETE FROM players WHERE player_id=:id AND email_verified_at IS NULL",
            params! {"id"=>player_id},
        )?;
        Ok(())
    }

    pub fn verify_email(&self, token_hash: &str) -> Result<bool, StorageError> {
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let player: Option<String> = transaction.exec_first(
            "SELECT player_id FROM email_verifications
             WHERE token_hash=:token AND used_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE",
            params! {"token"=>token_hash},
        )?;
        let Some(player_id) = player else {
            return Ok(false);
        };
        transaction.exec_drop(
            "UPDATE email_verifications SET used_at=UTC_TIMESTAMP() WHERE token_hash=:token",
            params! {"token"=>token_hash},
        )?;
        transaction.exec_drop(
            "UPDATE players SET email_verified_at=UTC_TIMESTAMP() WHERE player_id=:id",
            params! {"id"=>player_id},
        )?;
        transaction.commit()?;
        Ok(true)
    }

    pub fn login_record(
        &self,
        email: &str,
    ) -> Result<Option<(PlayerAccount, String)>, StorageError> {
        type LoginRow = (
            String,
            String,
            String,
            String,
            String,
            bool,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            u8,
        );
        let row: Option<LoginRow> = self.pool.get_conn()?.exec_first(
            "SELECT player_id,email,username,home_base,password_hash,email_verified_at IS NOT NULL,
                        display_name,pronouns,sex,avatar_id,uniform_id,
                        ((avatar_setup_completed_at IS NOT NULL) * 2 + leaderboard_opt_in)
             FROM players WHERE email=:email",
            params! {"email"=>email},
        )?;
        Ok(row.map(
            |(
                player_id,
                email,
                username,
                home_base,
                password_hash,
                verified,
                display_name,
                pronouns,
                sex,
                avatar_id,
                uniform_id,
                profile_flags,
            )| {
                (
                    PlayerAccount {
                        player_id,
                        email,
                        username,
                        home_base,
                        email_verified: verified,
                        display_name: Some(display_name),
                        pronouns,
                        sex,
                        avatar_id,
                        uniform_id,
                        avatar_setup_complete: profile_flags & 2 != 0,
                        leaderboard_opt_in: profile_flags & 1 != 0,
                    },
                    password_hash,
                )
            },
        ))
    }

    pub fn create_session(
        &self,
        player_id: &str,
        token_hash: &str,
        family_id: &str,
        device_label: Option<&str>,
    ) -> Result<(), StorageError> {
        self.pool.get_conn()?.exec_drop(
            "INSERT INTO player_sessions(token_hash,player_id,family_id,session_id,device_label,expires_at)
             VALUES (:token,:player,:family,:session,:device,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))",
            params! {"token"=>token_hash,"player"=>player_id,"family"=>family_id,"session"=>uuid::Uuid::new_v4().to_string(),"device"=>device_label},
        )?;
        Ok(())
    }

    pub fn authenticate_session(
        &self,
        token_hash: &str,
    ) -> Result<Option<PlayerAccount>, StorageError> {
        type AccountRow = (
            String,
            String,
            String,
            String,
            bool,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            bool,
            bool,
        );
        let mut connection = self.pool.get_conn()?;
        let row: Option<AccountRow> = connection.exec_first(
            "SELECT p.player_id,p.email,p.username,p.home_base,TRUE,p.display_name,
                        p.pronouns,p.sex,p.avatar_id,p.uniform_id,p.avatar_setup_completed_at IS NOT NULL,p.leaderboard_opt_in
             FROM player_sessions s JOIN players p ON p.player_id=s.player_id
             WHERE s.token_hash=:token AND s.revoked_at IS NULL
               AND s.expires_at>UTC_TIMESTAMP() AND p.email_verified_at IS NOT NULL",
            params! {"token"=>token_hash},
        )?;
        if row.is_some() {
            connection.exec_drop(
                "UPDATE player_sessions SET last_seen_at=UTC_TIMESTAMP() WHERE token_hash=:token",
                params! {"token"=>token_hash},
            )?;
        }
        Ok(row.map(
            |(
                player_id,
                email,
                username,
                home_base,
                email_verified,
                display_name,
                pronouns,
                sex,
                avatar_id,
                uniform_id,
                avatar_setup_complete,
                leaderboard_opt_in,
            )| PlayerAccount {
                player_id,
                email,
                username,
                home_base,
                email_verified,
                display_name,
                pronouns,
                sex,
                avatar_id,
                uniform_id,
                avatar_setup_complete,
                leaderboard_opt_in,
            },
        ))
    }

    pub fn rotate_session(&self, old_hash: &str, new_hash: &str) -> Result<bool, StorageError> {
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let row:Option<(String,Option<String>,bool,Option<String>)>=transaction.exec_first(
            "SELECT player_id,family_id,(revoked_at IS NOT NULL OR replaced_at IS NOT NULL OR expires_at<=UTC_TIMESTAMP()),device_label FROM player_sessions WHERE token_hash=:token FOR UPDATE",
            params!{"token"=>old_hash})?;
        let Some((player, family, invalid, device)) = row else {
            return Ok(false);
        };
        if invalid {
            if let Some(family) = family {
                transaction.exec_drop("UPDATE player_sessions SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP()) WHERE family_id=:family",params!{"family"=>family})?;
                transaction.commit()?;
            }
            return Ok(false);
        }
        let family = family.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        transaction.exec_drop("UPDATE player_sessions SET replaced_at=UTC_TIMESTAMP(),revoked_at=UTC_TIMESTAMP() WHERE token_hash=:token",params!{"token"=>old_hash})?;
        transaction.exec_drop("INSERT INTO player_sessions(token_hash,player_id,family_id,session_id,device_label,rotated_from,expires_at) VALUES (:new,:player,:family,:session,:device,:old,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR))",params!{"new"=>new_hash,"player"=>player,"family"=>family,"session"=>uuid::Uuid::new_v4().to_string(),"device"=>device,"old"=>old_hash})?;
        transaction.commit()?;
        Ok(true)
    }

    pub fn revoke_all_sessions(&self, player_id: &str) -> Result<(), StorageError> {
        self.pool.get_conn()?.exec_drop("UPDATE player_sessions SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP()) WHERE player_id=:player",params!{"player"=>player_id})?;
        Ok(())
    }

    pub fn sessions(
        &self,
        player_id: &str,
        current_hash: &str,
    ) -> Result<Vec<PlayerSession>, StorageError> {
        self.pool.get_conn()?.exec_map("SELECT session_id,device_label,CAST(created_at AS CHAR),CAST(last_seen_at AS CHAR),CAST(expires_at AS CHAR),token_hash=:current FROM player_sessions WHERE player_id=:player AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP() ORDER BY last_seen_at DESC",params!{"player"=>player_id,"current"=>current_hash},|(session_id,device_label,created_at,last_seen_at,expires_at,current)|PlayerSession{session_id,device_label,created_at,last_seen_at,expires_at,current}).map_err(Into::into)
    }

    pub fn revoke_session_id(
        &self,
        player_id: &str,
        session_id: &str,
    ) -> Result<bool, StorageError> {
        let mut connection = self.pool.get_conn()?;
        connection.exec_drop("UPDATE player_sessions SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP()) WHERE player_id=:player AND session_id=:session",params!{"player"=>player_id,"session"=>session_id})?;
        Ok(connection.affected_rows() > 0)
    }

    pub fn create_password_reset(
        &self,
        email: &str,
        token_hash: &str,
    ) -> Result<Option<String>, StorageError> {
        let mut connection = self.pool.get_conn()?;
        let player: Option<String> = connection.exec_first(
            "SELECT player_id FROM players WHERE email=:email AND email_verified_at IS NOT NULL",
            params! {"email"=>email},
        )?;
        if let Some(id) = &player {
            connection.exec_drop(
                "DELETE FROM password_resets WHERE player_id=:player AND used_at IS NULL",
                params! {"player"=>id},
            )?;
            connection.exec_drop("INSERT INTO password_resets(token_hash,player_id,expires_at) VALUES (:token,:player,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE))",params!{"token"=>token_hash,"player"=>id})?;
        }
        Ok(player)
    }

    pub fn complete_password_reset(
        &self,
        token_hash: &str,
        password_hash: &str,
    ) -> Result<bool, StorageError> {
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let player:Option<String>=transaction.exec_first("SELECT player_id FROM password_resets WHERE token_hash=:token AND used_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE",params!{"token"=>token_hash})?;
        let Some(player) = player else {
            return Ok(false);
        };
        transaction.exec_drop(
            "UPDATE players SET password_hash=:password WHERE player_id=:player",
            params! {"password"=>password_hash,"player"=>&player},
        )?;
        transaction.exec_drop(
            "UPDATE password_resets SET used_at=UTC_TIMESTAMP() WHERE token_hash=:token",
            params! {"token"=>token_hash},
        )?;
        transaction.exec_drop("UPDATE player_sessions SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP()) WHERE player_id=:player",params!{"player"=>&player})?;
        transaction.commit()?;
        Ok(true)
    }

    pub fn security_event(
        &self,
        player_id: Option<&str>,
        event_type: &str,
        outcome: &str,
    ) -> Result<(), StorageError> {
        self.pool.get_conn()?.exec_drop("INSERT INTO security_events(player_id,event_type,outcome) VALUES (:player,:kind,:outcome)",params!{"player"=>player_id,"kind"=>event_type,"outcome"=>outcome})?;
        Ok(())
    }

    pub fn allow_auth_attempt(
        &self,
        subject_hash: &str,
        action: &str,
        limit: u32,
    ) -> Result<bool, StorageError> {
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let row:Option<(u32,bool)>=transaction.exec_first("SELECT attempts,window_started<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) FROM auth_rate_limits WHERE subject_hash=:subject AND action=:action FOR UPDATE",params!{"subject"=>subject_hash,"action"=>action})?;
        let allowed = match row {
            None => {
                transaction.exec_drop("INSERT INTO auth_rate_limits(subject_hash,action,attempts) VALUES (:subject,:action,1)",params!{"subject"=>subject_hash,"action"=>action})?;
                true
            }
            Some((_, true)) => {
                transaction.exec_drop("UPDATE auth_rate_limits SET attempts=1,window_started=UTC_TIMESTAMP() WHERE subject_hash=:subject AND action=:action",params!{"subject"=>subject_hash,"action"=>action})?;
                true
            }
            Some((attempts, false)) if attempts < limit => {
                transaction.exec_drop("UPDATE auth_rate_limits SET attempts=attempts+1 WHERE subject_hash=:subject AND action=:action",params!{"subject"=>subject_hash,"action"=>action})?;
                true
            }
            Some(_) => false,
        };
        transaction.commit()?;
        Ok(allowed)
    }

    pub fn update_profile(
        &self,
        player_id: &str,
        display_name: Option<&str>,
        pronouns: Option<&str>,
        sex: Option<&str>,
        avatar_id: Option<&str>,
        uniform_id: Option<&str>,
        home_base: &str,
        leaderboard_opt_in: bool,
    ) -> Result<(), StorageError> {
        self.pool.get_conn()?.exec_drop(
            "UPDATE players SET display_name=COALESCE(:display_name,display_name),pronouns=:pronouns,sex=:sex,avatar_id=:avatar,uniform_id=:uniform,home_base=:home,leaderboard_opt_in=:leaderboard WHERE player_id=:player",
            params!{"display_name"=>display_name,"pronouns"=>pronouns,"sex"=>sex,"avatar"=>avatar_id,"uniform"=>uniform_id,"home"=>home_base,"leaderboard"=>leaderboard_opt_in,"player"=>player_id})?;
        Ok(())
    }

    pub fn select_avatar(&self, player_id: &str, avatar_id: &str) -> Result<(), StorageError> {
        let mut connection = self.pool.get_conn()?;
        connection.exec_drop("UPDATE players SET avatar_id=:avatar,avatar_setup_completed_at=COALESCE(avatar_setup_completed_at,UTC_TIMESTAMP()) WHERE player_id=:player",params!{"avatar"=>avatar_id,"player"=>player_id})?;
        Ok(())
    }

    pub fn record_case_completion(
        &self,
        player_id: &str,
        case_id: &str,
        state: &GameState,
    ) -> Result<Vec<TokenAward>, StorageError> {
        let Some(outcome) = state.outcome.as_deref() else {
            return Ok(vec![]);
        };
        let mut token_awards = Vec::new();
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let attempt_kind: String = transaction
            .exec_first(
                "SELECT attempt_kind FROM active_cases WHERE case_id=:case_id AND player_id=:player FOR UPDATE",
                params!{"case_id"=>case_id,"player"=>player_id},
            )?
            .ok_or(StorageError::CaseNotFound)?;
        let (states, correct_travels, wrong_travels, correct_deductions, wrong_deductions) =
            case_metrics(state);
        let states_json = serde_json::to_string(&states)?;
        transaction.exec_drop(
            "INSERT IGNORE INTO case_archive(player_id,case_id,mission_id,thief_id,outcome,score,elapsed_minutes,states_visited_json,correct_travels,wrong_travels,correct_deductions,wrong_deductions,attempt_kind) VALUES (:player,:case_id,:mission,:thief,:outcome,:score,:elapsed,:states,:correct_travels,:wrong_travels,:correct_deductions,:wrong_deductions,:attempt_kind)",
            params!{"player"=>player_id,"case_id"=>case_id,"mission"=>&state.mission_id,"thief"=>&state.thief_id,"outcome"=>outcome,"score"=>state.score,"elapsed"=>state.elapsed,"states"=>&states_json,"correct_travels"=>correct_travels,"wrong_travels"=>wrong_travels,"correct_deductions"=>correct_deductions,"wrong_deductions"=>wrong_deductions,"attempt_kind"=>&attempt_kind})?;
        let first_completion = if outcome == "solved" && attempt_kind != "replay" {
            transaction.exec_drop(
                "INSERT IGNORE INTO player_mission_completions(player_id,mission_id,first_case_id,best_score,best_elapsed_minutes) VALUES (:player,:mission,:case_id,:score,:elapsed)",
                params!{"player"=>player_id,"mission"=>&state.mission_id,"case_id"=>case_id,"score"=>state.score,"elapsed"=>state.elapsed},
            )?;
            transaction.affected_rows() == 1
        } else {
            false
        };
        if outcome == "solved" {
            transaction.exec_drop(
                "UPDATE player_mission_completions SET best_score=GREATEST(best_score,:score),best_elapsed_minutes=LEAST(best_elapsed_minutes,:elapsed),replay_count=replay_count+:replay WHERE player_id=:player AND mission_id=:mission",
                params!{"score"=>state.score,"elapsed"=>state.elapsed,"replay"=>u8::from(attempt_kind=="replay"),"player"=>player_id,"mission"=>&state.mission_id},
            )?;
        }
        transaction.exec_drop(
            "UPDATE case_archive SET first_completion=:first WHERE case_id=:case_id",
            params! {"first"=>first_completion,"case_id"=>case_id},
        )?;
        transaction.exec_drop(
            "DELETE FROM active_mission_assignments WHERE case_id=:case_id",
            params! {"case_id"=>case_id},
        )?;
        if first_completion {
            let token_balance: u32 = transaction
                .exec_first(
                    "SELECT bribe_tokens FROM players WHERE player_id=:player FOR UPDATE",
                    params! {"player"=>player_id},
                )?
                .unwrap_or(0);
            let earned_today:u32=transaction.exec_first("SELECT COALESCE(SUM(GREATEST(amount,0)),0) FROM bribe_token_ledger WHERE player_id=:player AND reason IN ('first_completion','case_completion') AND created_at>=UTC_DATE()",params!{"player"=>player_id})?.unwrap_or(0);
            let pressure_attempts: u32 = transaction
                .exec_first(
                    "SELECT COUNT(*) FROM witness_pressure_attempts WHERE case_id=:case",
                    params! {"case"=>case_id},
                )?
                .unwrap_or(0);
            let components = naijachase_contracts::economy::case_award_components(
                state.difficulty,
                wrong_travels,
                pressure_attempts,
            );
            let award = naijachase_contracts::economy::capped_case_award(
                components.len() as u32,
                earned_today,
                token_balance,
            );
            if award > 0 {
                let after = token_balance + award;
                transaction.exec_drop(
                    "UPDATE players SET bribe_tokens=:balance WHERE player_id=:player",
                    params! {"balance"=>after,"player"=>player_id},
                )?;
                transaction.exec_drop("INSERT IGNORE INTO bribe_token_ledger(player_id,amount,balance_after,reason,reference_id) VALUES (:player,:amount,:balance,'case_completion',:reference)",params!{"player"=>player_id,"amount"=>award,"balance"=>after,"reference"=>&state.mission_id})?;
                token_awards.push(TokenAward {
                    reason: "case_completion".into(),
                    amount: award,
                    balance_after: after,
                    components,
                });
            }
            for state_name in &states {
                transaction.exec_drop("INSERT IGNORE INTO player_state_visits(player_id,state_name) VALUES (:player,:state)",params!{"player"=>player_id,"state"=>state_name})?;
            }
            let old_points: u64 = transaction
                .exec_first(
                    "SELECT points FROM careers WHERE player_id=:player FOR UPDATE",
                    params! {"player"=>player_id},
                )?
                .unwrap_or(0);
            transaction.exec_drop("INSERT INTO careers(player_id,points,solved_missions_json,version) VALUES (:player,:points,JSON_ARRAY(:mission),1) ON DUPLICATE KEY UPDATE points=GREATEST(points,:points),solved_missions_json=IF(JSON_CONTAINS(solved_missions_json,JSON_QUOTE(:mission)),solved_missions_json,JSON_ARRAY_APPEND(solved_missions_json,'$',:mission)),version=version+1",params!{"player"=>player_id,"points"=>state.career_points,"mission"=>&state.mission_id})?;
            transaction.exec_drop("INSERT IGNORE INTO player_achievements(player_id,achievement_id) VALUES (:player,'first_case')",params!{"player"=>player_id})?;
            if state.elapsed <= 7200 {
                transaction.exec_drop("INSERT IGNORE INTO player_achievements(player_id,achievement_id) VALUES (:player,'swift_investigator')",params!{"player"=>player_id})?;
            }
            let solved: u64 = transaction
                .exec_first(
                    "SELECT COUNT(*) FROM player_mission_completions WHERE player_id=:player",
                    params! {"player"=>player_id},
                )?
                .unwrap_or(0);
            if solved >= 5 {
                transaction.exec_drop("INSERT IGNORE INTO player_achievements(player_id,achievement_id) VALUES (:player,'five_cases')",params!{"player"=>player_id})?;
            }
            if state.career_points >= 35000 {
                transaction.exec_drop("INSERT IGNORE INTO player_achievements(player_id,achievement_id) VALUES (:player,'master_detective')",params!{"player"=>player_id})?;
            }
            if wrong_travels == 0 {
                transaction.exec_drop("INSERT IGNORE INTO player_achievements(player_id,achievement_id) VALUES (:player,'clean_route')",params!{"player"=>player_id})?;
            }
            if wrong_deductions == 0 && correct_deductions > 0 {
                transaction.exec_drop("INSERT IGNORE INTO player_achievements(player_id,achievement_id) VALUES (:player,'sharp_deduction')",params!{"player"=>player_id})?;
            }
            let visited: u64 = transaction
                .exec_first(
                    "SELECT COUNT(*) FROM player_state_visits WHERE player_id=:player",
                    params! {"player"=>player_id},
                )?
                .unwrap_or(0);
            if visited >= 10 {
                transaction.exec_drop("INSERT IGNORE INTO player_achievements(player_id,achievement_id) VALUES (:player,'state_explorer')",params!{"player"=>player_id})?;
                if transaction.affected_rows() == 1 {
                    award_achievement_tokens(
                        &mut transaction,
                        player_id,
                        "state_explorer",
                        naijachase_contracts::economy::STATE_EXPLORER_TOKEN_AWARD,
                        &mut token_awards,
                    )?;
                }
            }
            if visited >= 37 {
                transaction.exec_drop("INSERT IGNORE INTO player_achievements(player_id,achievement_id) VALUES (:player,'national_investigator')",params!{"player"=>player_id})?;
                if transaction.affected_rows() == 1 {
                    award_achievement_tokens(
                        &mut transaction,
                        player_id,
                        "national_investigator",
                        naijachase_contracts::economy::NATIONAL_INVESTIGATOR_TOKEN_AWARD,
                        &mut token_awards,
                    )?;
                }
            }
            let old_rank = rank_name(old_points);
            let new_rank = rank_name(state.career_points as u64);
            if old_rank != new_rank {
                transaction.exec_drop("INSERT INTO rank_history(player_id,old_rank,new_rank,points) VALUES (:player,:old,:new,:points)",params!{"player"=>player_id,"old"=>old_rank,"new"=>new_rank,"points"=>state.career_points})?;
                if let Some(achievement) = rank_achievement(new_rank) {
                    transaction.exec_drop("INSERT IGNORE INTO player_achievements(player_id,achievement_id) VALUES (:player,:achievement)",params!{"player"=>player_id,"achievement"=>achievement})?;
                }
            }
        }
        transaction.commit()?;
        Ok(token_awards)
    }

    pub fn case_archive(&self, player_id: &str) -> Result<Vec<CaseArchiveEntry>, StorageError> {
        type Row = (
            String,
            String,
            String,
            String,
            u32,
            u32,
            String,
            Option<String>,
            u32,
            u32,
            u32,
            u32,
        );
        let mut connection = self.pool.get_conn()?;
        let rows:Vec<Row>=connection.exec("SELECT case_id,mission_id,thief_id,outcome,score,elapsed_minutes,CAST(completed_at AS CHAR),CAST(states_visited_json AS CHAR),correct_travels,wrong_travels,correct_deductions,wrong_deductions FROM case_archive WHERE player_id=:player ORDER BY completed_at DESC",params!{"player"=>player_id})?;
        Ok(rows
            .into_iter()
            .map(
                |(
                    case_id,
                    mission_id,
                    thief_id,
                    outcome,
                    score,
                    elapsed_minutes,
                    completed_at,
                    states,
                    correct_travels,
                    wrong_travels,
                    correct_deductions,
                    wrong_deductions,
                )| {
                    let metadata: Option<(String,bool)> = connection.exec_first(
                        "SELECT attempt_kind,first_completion FROM case_archive WHERE case_id=:case_id",
                        params!{"case_id"=>&case_id},
                    ).unwrap_or(None);
                    let (attempt_kind, first_completion) = metadata.unwrap_or_else(|| ("ordinary".into(), false));
                    CaseArchiveEntry {
                    case_id,
                    mission_id,
                    thief_id,
                    outcome,
                    score,
                    elapsed_minutes,
                    completed_at,
                    states_visited: states
                        .and_then(|value| serde_json::from_str(&value).ok())
                        .unwrap_or_default(),
                    correct_travels,
                    wrong_travels,
                    correct_deductions,
                    wrong_deductions,
                    attempt_kind,
                    first_completion,
                }},
            )
            .collect())
    }

    pub fn achievements(&self, player_id: &str) -> Result<Vec<Achievement>, StorageError> {
        self.pool.get_conn()?.exec_map("SELECT achievement_id,CAST(earned_at AS CHAR) FROM player_achievements WHERE player_id=:player ORDER BY earned_at",params!{"player"=>player_id},|(achievement_id,earned_at)|Achievement{achievement_id,earned_at}).map_err(Into::into)
    }

    pub fn career_points(&self, player_id: &str) -> Result<u64, StorageError> {
        Ok(self
            .pool
            .get_conn()?
            .exec_first(
                "SELECT points FROM careers WHERE player_id=:player",
                params! {"player"=>player_id},
            )?
            .unwrap_or(0))
    }

    pub fn progression_summary(&self, player_id: &str) -> Result<ProgressionSummary, StorageError> {
        let mut connection = self.pool.get_conn()?;
        let points: u64 = connection
            .exec_first(
                "SELECT points FROM careers WHERE player_id=:player",
                params! {"player"=>player_id},
            )?
            .unwrap_or(0);
        let solved_cases: u64 = connection
            .exec_first(
                "SELECT COUNT(*) FROM player_mission_completions WHERE player_id=:player",
                params! {"player"=>player_id},
            )?
            .unwrap_or(0);
        let visited_states:Vec<String>=connection.exec_map("SELECT state_name FROM player_state_visits WHERE player_id=:player ORDER BY state_name",params!{"player"=>player_id},|state|state)?;
        let totals:Option<(u64,u64,u64,u64)>=connection.exec_first("SELECT COALESCE(SUM(correct_travels),0),COALESCE(SUM(wrong_travels),0),COALESCE(SUM(correct_deductions),0),COALESCE(SUM(wrong_deductions),0) FROM case_archive WHERE player_id=:player AND first_completion=TRUE",params!{"player"=>player_id})?;
        let (correct_travels, wrong_travels, correct_deductions, wrong_deductions) =
            totals.unwrap_or_default();
        let rank_history=connection.exec_map("SELECT old_rank,new_rank,points,CAST(earned_at AS CHAR) FROM rank_history WHERE player_id=:player ORDER BY earned_at",params!{"player"=>player_id},|(old_rank,new_rank,points,earned_at)|RankHistoryEntry{old_rank,new_rank,points,earned_at})?;
        Ok(ProgressionSummary {
            points,
            rank: rank_name(points).into(),
            solved_cases,
            visited_states,
            correct_travels,
            wrong_travels,
            correct_deductions,
            wrong_deductions,
            achievements: self.achievements(player_id)?,
            rank_history,
        })
    }

    pub fn revoke_session(&self, token_hash: &str) -> Result<(), StorageError> {
        self.pool.get_conn()?.exec_drop(
            "UPDATE player_sessions SET revoked_at=UTC_TIMESTAMP() WHERE token_hash=:token",
            params! {"token"=>token_hash},
        )?;
        Ok(())
    }

    pub fn create_case(
        &self,
        case_id: &str,
        player_id: &str,
        mission_id: &str,
        state: &GameState,
    ) -> Result<u64, StorageError> {
        self.create_case_with_kind(case_id, player_id, mission_id, state, "ordinary")
    }

    pub fn create_case_with_kind(
        &self,
        case_id: &str,
        player_id: &str,
        mission_id: &str,
        state: &GameState,
        attempt_kind: &str,
    ) -> Result<u64, StorageError> {
        let data = serde_json::to_vec(state)?;
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let jailed: Option<u8> = transaction.exec_first(
            "SELECT 1 FROM players WHERE player_id=:player AND jailed_until>UTC_TIMESTAMP()",
            params! { "player" => player_id },
        )?;
        if jailed.is_some() {
            return Err(StorageError::Command(
                "player is jailed and cannot start a mission".into(),
            ));
        }
        let existing: Option<String> = transaction.exec_first(
            "SELECT player_id FROM active_cases WHERE case_id=:case_id FOR UPDATE",
            params! { "case_id" => case_id },
        )?;
        match existing {
            Some(owner) if owner == player_id => return Ok(1),
            Some(_) => return Err(StorageError::Forbidden),
            None => {}
        }
        let completed: Option<u8> = transaction.exec_first(
            "SELECT 1 FROM player_mission_completions WHERE player_id=:player AND mission_id=:mission",
            params!{"player"=>player_id,"mission"=>mission_id},
        )?;
        let content_version: u32 = transaction
            .exec_first(
                "SELECT content_version FROM missions WHERE mission_id=:mission",
                params! {"mission"=>mission_id},
            )?
            .ok_or(StorageError::CaseNotFound)?;
        match attempt_kind {
            "replay" if completed.is_none() => return Err(StorageError::ReplayNotAvailable),
            "ordinary" if completed.is_some() => return Err(StorageError::MissionAlreadyCompleted),
            "ordinary" | "replay" | "weekly" => {}
            _ => return Err(StorageError::InvalidContent("invalid attempt kind".into())),
        }
        transaction.exec_drop(
            "INSERT INTO players(player_id,display_name) VALUES (:player,:player)
             ON DUPLICATE KEY UPDATE player_id=VALUES(player_id)",
            params! { "player" => player_id },
        )?;
        transaction.exec_drop(
            "INSERT INTO active_cases(case_id,player_id,mission_id,version,state_json,attempt_kind,content_version)
             VALUES (:case_id,:player,:mission,1,:state,:attempt_kind,:content_version)",
            params! { "case_id"=>case_id,"player"=>player_id,"mission"=>mission_id,"state"=>data,"attempt_kind"=>attempt_kind,"content_version"=>content_version },
        )?;
        if attempt_kind == "ordinary" {
            transaction.exec_drop(
                "INSERT INTO active_mission_assignments(player_id,mission_id,case_id) VALUES (:player,:mission,:case_id)",
                params!{"player"=>player_id,"mission"=>mission_id,"case_id"=>case_id},
            )?;
        }
        transaction.exec_drop(
            "INSERT INTO service_audit(player_id,case_id,command_id,outcome)
             VALUES (:player,:case_id,'case-created','created')",
            params! { "player"=>player_id,"case_id"=>case_id },
        )?;
        transaction.commit()?;
        Ok(1)
    }

    pub fn unseen_published_missions(&self, player_id: &str) -> Result<Vec<String>, StorageError> {
        self.publish_due_missions()?;
        self.pool.get_conn()?.exec_map(
            "SELECT m.mission_id FROM missions m LEFT JOIN player_mission_completions c ON c.player_id=:player AND c.mission_id=m.mission_id LEFT JOIN active_mission_assignments a ON a.player_id=:player AND a.mission_id=m.mission_id WHERE m.lifecycle_status='published' AND c.mission_id IS NULL AND a.mission_id IS NULL ORDER BY m.published_at DESC,m.mission_id",
            params!{"player"=>player_id},
            |mission_id:String| mission_id,
        ).map_err(Into::into)
    }

    pub fn catalogue_progress(&self, player_id: &str) -> Result<CatalogueProgress, StorageError> {
        self.publish_due_missions()?;
        let mut connection = self.pool.get_conn()?;
        let published_cases: u64 = connection
            .exec_first(
                "SELECT COUNT(*) FROM missions WHERE lifecycle_status='published'",
                (),
            )?
            .unwrap_or(0);
        let completed_cases: u64 = connection.exec_first(
            "SELECT COUNT(*) FROM player_mission_completions c JOIN missions m ON m.mission_id=c.mission_id WHERE c.player_id=:player AND m.lifecycle_status='published'",
            params!{"player"=>player_id},
        )?.unwrap_or(0);
        let unseen_cases = published_cases.saturating_sub(completed_cases);
        Ok(CatalogueProgress {
            published_cases,
            completed_cases,
            unseen_cases,
            exhausted: unseen_cases == 0,
        })
    }

    pub fn runtime_mission(&self, mission_id: &str) -> Result<RuntimeMission, StorageError> {
        type Row = (String, u8, String, String, String, String, String, u32);
        let row: Option<Row> = self.pool.get_conn()?.exec_first(
            "SELECT mission_id,difficulty,thief_id,start_location_id,stop_2_location_id,stop_3_location_id,capture_location_id,content_version FROM missions WHERE mission_id=:mission",
            params!{"mission"=>mission_id},
        )?;
        row.map(
            |(
                mission_id,
                difficulty,
                thief_id,
                start_location_id,
                stop_2_location_id,
                stop_3_location_id,
                capture_location_id,
                content_version,
            )| RuntimeMission {
                mission_id,
                difficulty,
                thief_id,
                start_location_id,
                stop_2_location_id,
                stop_3_location_id,
                capture_location_id,
                content_version,
            },
        )
        .ok_or(StorageError::CaseNotFound)
    }

    pub fn publish_due_missions(&self) -> Result<u64, StorageError> {
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let due: Vec<(String,String,u32)> = transaction.query(
            "SELECT mission_id,lifecycle_updated_by,content_version FROM missions WHERE lifecycle_status='scheduled' AND scheduled_for<=UTC_TIMESTAMP() FOR UPDATE"
        )?;
        for (mission, actor, version) in &due {
            transaction.exec_drop(
                "INSERT IGNORE INTO catalogue_release_notifications(player_id,mission_id,published_at) SELECT p.player_id,:mission,UTC_TIMESTAMP() FROM players p WHERE NOT EXISTS (SELECT 1 FROM missions m LEFT JOIN player_mission_completions c ON c.player_id=p.player_id AND c.mission_id=m.mission_id WHERE m.lifecycle_status='published' AND c.mission_id IS NULL)",
                params!{"mission"=>mission},
            )?;
            transaction.exec_drop("UPDATE missions SET lifecycle_status='published',published_at=UTC_TIMESTAMP(),scheduled_for=NULL WHERE mission_id=:mission",params!{"mission"=>mission})?;
            transaction.exec_drop("INSERT INTO mission_lifecycle_audit(mission_id,actor_player_id,from_status,to_status,content_version,reason) VALUES (:mission,:actor,'scheduled','published',:version,'scheduled publication became due')",params!{"mission"=>mission,"actor"=>actor,"version"=>version})?;
        }
        transaction.commit()?;
        Ok(due.len() as u64)
    }

    pub fn content_role(&self, player_id: &str) -> Result<String, StorageError> {
        self.pool
            .get_conn()?
            .exec_first(
                "SELECT content_role FROM players WHERE player_id=:player",
                params! {"player"=>player_id},
            )?
            .ok_or(StorageError::Forbidden)
    }

    pub fn transition_mission(
        &self,
        player_id: &str,
        mission_id: &str,
        target: &str,
        scheduled_for: Option<&str>,
        reason: &str,
    ) -> Result<(), StorageError> {
        let role = self.content_role(player_id)?;
        let editor_transition = role == "editor" && matches!(target, "draft" | "editorial_review");
        if !editor_transition && !matches!(role.as_str(), "publisher" | "admin") {
            return Err(StorageError::Forbidden);
        }
        if matches!(target, "validated" | "scheduled" | "published") {
            let validation = self.validate_mission(mission_id)?;
            if !validation.valid {
                return Err(StorageError::Command(format!(
                    "mission validation failed: {}",
                    validation.issues.join("; ")
                )));
            }
        }
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let current: Option<(String,u32)> = transaction.exec_first("SELECT lifecycle_status,content_version FROM missions WHERE mission_id=:mission FOR UPDATE",params!{"mission"=>mission_id})?;
        let Some((from, version)) = current else {
            return Err(StorageError::CaseNotFound);
        };
        let allowed = matches!(
            (from.as_str(), target),
            ("draft", "editorial_review")
                | ("editorial_review", "draft")
                | ("editorial_review", "validated")
                | ("validated", "editorial_review")
                | ("validated", "scheduled")
                | ("validated", "published")
                | ("scheduled", "validated")
                | ("published", "retired")
                | ("retired", "draft")
        );
        if !allowed {
            return Err(StorageError::Command(format!(
                "invalid mission lifecycle transition {from} -> {target}"
            )));
        }
        if target == "scheduled" && scheduled_for.is_none() {
            return Err(StorageError::Command("scheduled_for is required".into()));
        }
        if target == "published" {
            transaction.exec_drop("INSERT IGNORE INTO catalogue_release_notifications(player_id,mission_id,published_at) SELECT p.player_id,:mission,UTC_TIMESTAMP() FROM players p WHERE NOT EXISTS (SELECT 1 FROM missions m LEFT JOIN player_mission_completions c ON c.player_id=p.player_id AND c.mission_id=m.mission_id WHERE m.lifecycle_status='published' AND c.mission_id IS NULL)",params!{"mission"=>mission_id})?;
        }
        transaction.exec_drop(
            "UPDATE missions SET content_version=IF(:target='draft' AND lifecycle_status='retired',content_version+1,content_version),lifecycle_status=:target,scheduled_for=IF(:target='scheduled',:scheduled,NULL),published_at=IF(:target='published',UTC_TIMESTAMP(),published_at),retired_at=IF(:target='retired',UTC_TIMESTAMP(),NULL),lifecycle_updated_by=:actor WHERE mission_id=:mission",
            params!{"target"=>target,"scheduled"=>scheduled_for,"actor"=>player_id,"mission"=>mission_id},
        )?;
        let audit_version = if from == "retired" && target == "draft" {
            version + 1
        } else {
            version
        };
        transaction.exec_drop("INSERT INTO mission_lifecycle_audit(mission_id,actor_player_id,from_status,to_status,content_version,reason) VALUES (:mission,:actor,:from,:target,:version,:reason)",params!{"mission"=>mission_id,"actor"=>player_id,"from"=>from,"target"=>target,"version"=>audit_version,"reason"=>reason})?;
        transaction.commit()?;
        Ok(())
    }

    pub fn validate_mission(&self, mission_id: &str) -> Result<MissionValidation, StorageError> {
        type Row = (u8, String, String, String, String, String, String, String);
        let mut connection = self.pool.get_conn()?;
        let row:Option<Row>=connection.exec_first("SELECT difficulty,thief_id,start_location_id,stop_2_location_id,stop_3_location_id,capture_location_id,CAST(content_json AS CHAR),CAST(narrative_json AS CHAR) FROM missions WHERE mission_id=:mission",params!{"mission"=>mission_id})?;
        let Some((difficulty, thief, start, stop2, stop3, capture, content, narrative)) = row
        else {
            return Err(StorageError::CaseNotFound);
        };
        let mut issues = Vec::new();
        if !(1..=5).contains(&difficulty) {
            issues.push("difficulty must be between 1 and 5".into())
        }
        let thief_exists: Option<u8> = connection.exec_first(
            "SELECT 1 FROM thieves WHERE thief_id=:thief",
            params! {"thief"=>thief},
        )?;
        if thief_exists.is_none() {
            issues.push("thief does not exist".into())
        }
        if content.trim().is_empty() || narrative.trim().is_empty() {
            issues.push("content and narrative are required".into())
        }
        for (label, location) in [
            ("start", start),
            ("stop 2", stop2),
            ("stop 3", stop3),
            ("capture", capture),
        ] {
            let state: Option<String> = connection.exec_first(
                "SELECT state_or_territory FROM locations WHERE location_id=:location",
                params! {"location"=>&location},
            )?;
            let Some(state) = state else {
                issues.push(format!("{label} location does not exist"));
                continue;
            };
            let state = if state.split('/').next() == Some("FCT") {
                "Federal Capital Territory".to_string()
            } else {
                state.split('/').next().unwrap_or(&state).to_string()
            };
            let atoms: u64 = connection
                .exec_first(
                    "SELECT COUNT(*) FROM clue_atoms WHERE state=:state",
                    params! {"state"=>state},
                )?
                .unwrap_or(0);
            if atoms < 3 {
                issues.push(format!(
                    "{label} jurisdiction has fewer than three clue atoms"
                ))
            }
        }
        Ok(MissionValidation {
            mission_id: mission_id.into(),
            valid: issues.is_empty(),
            issues,
        })
    }

    pub fn mission_admin_details(
        &self,
        mission_id: &str,
    ) -> Result<serde_json::Value, StorageError> {
        type MissionRow = (
            String,
            u8,
            String,
            String,
            String,
            String,
            String,
            String,
            u32,
            Option<String>,
            Option<String>,
            Option<String>,
        );
        let mut connection = self.pool.get_conn()?;
        let row:Option<MissionRow>=connection.exec_first("SELECT mission_id,difficulty,thief_id,start_location_id,stop_2_location_id,stop_3_location_id,capture_location_id,lifecycle_status,content_version,CAST(published_at AS CHAR),CAST(scheduled_for AS CHAR),CAST(retired_at AS CHAR) FROM missions WHERE mission_id=:mission",params!{"mission"=>mission_id})?;
        let Some((
            mission_id,
            difficulty,
            thief_id,
            start,
            stop2,
            stop3,
            capture,
            status,
            content_version,
            published_at,
            scheduled_for,
            retired_at,
        )) = row
        else {
            return Err(StorageError::CaseNotFound);
        };
        type AuditRow = (String, Option<String>, String, u32, String, String);
        let history:Vec<AuditRow>=connection.exec("SELECT actor_player_id,from_status,to_status,content_version,reason,CAST(created_at AS CHAR) FROM mission_lifecycle_audit WHERE mission_id=:mission ORDER BY audit_id",params!{"mission"=>&mission_id})?;
        Ok(
            serde_json::json!({"mission_id":mission_id,"difficulty":difficulty,"thief_id":thief_id,"anchors":[start,stop2,stop3,capture],"lifecycle_status":status,"content_version":content_version,"published_at":published_at,"scheduled_for":scheduled_for,"retired_at":retired_at,"history":history.into_iter().map(|(actor,from,to,version,reason,created_at)|serde_json::json!({"actor_player_id":actor,"from_status":from,"to_status":to,"content_version":version,"reason":reason,"created_at":created_at})).collect::<Vec<_>>() }),
        )
    }

    pub fn catalogue_health(&self, reserve_target: u64) -> Result<CatalogueHealth, StorageError> {
        self.publish_due_missions()?;
        let mut connection = self.pool.get_conn()?;
        let count =
            |connection: &mut mysql::PooledConn, status: &str| -> Result<u64, StorageError> {
                Ok(connection
                    .exec_first(
                        "SELECT COUNT(*) FROM missions WHERE lifecycle_status=:status",
                        params! {"status"=>status},
                    )?
                    .unwrap_or(0))
            };
        let draft = count(&mut connection, "draft")?;
        let editorial_review = count(&mut connection, "editorial_review")?;
        let validated = count(&mut connection, "validated")?;
        let scheduled = count(&mut connection, "scheduled")?;
        let published = count(&mut connection, "published")?;
        let retired = count(&mut connection, "retired")?;
        let per_player: Vec<u64> = connection.query("SELECT COUNT(m.mission_id) FROM players p LEFT JOIN missions m ON m.lifecycle_status='published' LEFT JOIN player_mission_completions c ON c.player_id=p.player_id AND c.mission_id=m.mission_id WHERE c.mission_id IS NULL GROUP BY p.player_id")?;
        let minimum_unseen_cases = per_player.iter().copied().min().unwrap_or(published);
        let exhausted_players = per_player.iter().filter(|&&n| n == 0).count() as u64;
        Ok(CatalogueHealth {
            draft,
            editorial_review,
            validated,
            scheduled,
            published,
            retired,
            exhausted_players,
            minimum_unseen_cases,
            reserve_below_target: validated + scheduled < reserve_target,
        })
    }

    pub fn publish_initial_catalogue(&self) -> Result<u64, StorageError> {
        let mut connection = self.pool.get_conn()?;
        let missions: Vec<(String, String)> = connection
            .query("SELECT mission_id,lifecycle_status FROM missions ORDER BY mission_id")?;
        if missions.is_empty() {
            return Err(StorageError::Command(
                "cannot publish an empty catalogue; import content first".into(),
            ));
        }
        if missions.iter().all(|(_, status)| status == "published") {
            return Ok(0);
        }
        if missions.iter().any(|(_, status)| status != "draft") {
            return Err(StorageError::Command(
                "initial publication requires every mission to be draft or every mission to already be published"
                    .into(),
            ));
        }
        drop(connection);

        for (mission_id, _) in &missions {
            let validation = self.validate_mission(mission_id)?;
            if !validation.valid {
                return Err(StorageError::Command(format!(
                    "mission {mission_id} failed initial publication validation: {}",
                    validation.issues.join("; ")
                )));
            }
        }

        const ACTOR: &str = "system-catalogue-bootstrap";
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        transaction.exec_drop(
            "INSERT INTO players(player_id,display_name,content_role) VALUES (:actor,'Catalogue Bootstrap','admin') ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),content_role='admin'",
            params! { "actor" => ACTOR },
        )?;
        for (from, to, reason) in [
            (
                "draft",
                "editorial_review",
                "initial canonical catalogue submitted for review",
            ),
            (
                "editorial_review",
                "validated",
                "initial canonical catalogue passed automated validation",
            ),
            (
                "validated",
                "published",
                "initial production catalogue publication",
            ),
        ] {
            transaction.exec_drop(
                "INSERT INTO mission_lifecycle_audit(mission_id,actor_player_id,from_status,to_status,content_version,reason) SELECT mission_id,:actor,:from_status,:to_status,content_version,:reason FROM missions WHERE lifecycle_status='draft'",
                params! { "actor" => ACTOR, "from_status" => from, "to_status" => to, "reason" => reason },
            )?;
        }
        transaction.exec_drop(
            "UPDATE missions SET lifecycle_status='published',published_at=UTC_TIMESTAMP(),scheduled_for=NULL,retired_at=NULL,lifecycle_updated_by=:actor WHERE lifecycle_status='draft'",
            params! { "actor" => ACTOR },
        )?;
        transaction.commit()?;
        Ok(missions.len() as u64)
    }

    pub fn release_notifications(
        &self,
        player_id: &str,
    ) -> Result<Vec<ReleaseNotification>, StorageError> {
        type Row = (u64, String, String, Option<String>);
        let rows:Vec<Row>=self.pool.get_conn()?.exec("SELECT notification_id,mission_id,CAST(published_at AS CHAR),CAST(read_at AS CHAR) FROM catalogue_release_notifications WHERE player_id=:player ORDER BY published_at DESC",params!{"player"=>player_id})?;
        Ok(rows
            .into_iter()
            .map(
                |(notification_id, mission_id, published_at, read_at)| ReleaseNotification {
                    notification_id,
                    mission_id,
                    published_at,
                    read: read_at.is_some(),
                },
            )
            .collect())
    }

    pub fn read_release_notification(
        &self,
        player_id: &str,
        notification_id: u64,
    ) -> Result<(), StorageError> {
        let mut connection = self.pool.get_conn()?;
        connection.exec_drop("UPDATE catalogue_release_notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP()) WHERE notification_id=:id AND player_id=:player",params!{"id"=>notification_id,"player"=>player_id})?;
        if connection.affected_rows() == 0 {
            return Err(StorageError::CaseNotFound);
        }
        Ok(())
    }

    pub fn case_attempt_kind(
        &self,
        case_id: &str,
        player_id: &str,
    ) -> Result<String, StorageError> {
        self.pool.get_conn()?.exec_first(
            "SELECT attempt_kind FROM active_cases WHERE case_id=:case_id AND player_id=:player",
            params!{"case_id"=>case_id,"player"=>player_id},
        )?.ok_or(StorageError::CaseNotFound)
    }

    pub fn load_owned_case(
        &self,
        case_id: &str,
        player_id: &str,
    ) -> Result<(u64, GameState), StorageError> {
        let row: Option<(Option<String>, u64, Vec<u8>)> = self.pool.get_conn()?.exec_first(
            "SELECT player_id,version,state_json FROM active_cases WHERE case_id=:case_id",
            params! { "case_id"=>case_id },
        )?;
        let Some((owner, version, data)) = row else {
            return Err(StorageError::CaseNotFound);
        };
        if owner.as_deref() != Some(player_id) {
            return Err(StorageError::Forbidden);
        }
        Ok((version, serde_json::from_slice(&data)?))
    }

    pub fn execute_case_command<F>(
        &self,
        case_id: &str,
        player_id: &str,
        command_id: &str,
        expected_version: u64,
        execute: F,
    ) -> Result<CaseCommandResult, StorageError>
    where
        F: FnOnce(GameState) -> Result<(GameState, Vec<Event>), String>,
    {
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let row: Option<(Option<String>, u64, Vec<u8>)> = transaction.exec_first(
            "SELECT player_id,version,state_json FROM active_cases WHERE case_id=:case_id FOR UPDATE",
            params! { "case_id"=>case_id },
        )?;
        let Some((owner, version, data)) = row else {
            return Err(StorageError::CaseNotFound);
        };
        if owner.as_deref() != Some(player_id) {
            return Err(StorageError::Forbidden);
        }
        let duplicate: Option<(u64, String)> = transaction.exec_first(
            "SELECT state_version,event_json FROM case_events WHERE case_id=:case_id AND command_id=:command_id",
            params! { "case_id"=>case_id,"command_id"=>command_id },
        )?;
        if let Some((saved_version, event_json)) = duplicate {
            let saved: PersistedCommandResult = serde_json::from_str(&event_json)?;
            transaction.commit()?;
            return Ok(CaseCommandResult::Duplicate {
                version: saved_version,
                state: saved.state,
                events: saved.events,
            });
        }
        if version != expected_version {
            return Err(StorageError::VersionConflict(case_id.into()));
        }
        let state: GameState = serde_json::from_slice(&data)?;
        let (next, events) = execute(state).map_err(StorageError::Command)?;
        let next_version = version + 1;
        transaction.exec_drop(
            "UPDATE active_cases SET version=:version,state_json=:state WHERE case_id=:case_id AND version=:expected",
            params! { "version"=>next_version,"state"=>serde_json::to_vec(&next)?,"case_id"=>case_id,"expected"=>version },
        )?;
        if transaction.affected_rows() != 1 {
            return Err(StorageError::VersionConflict(case_id.into()));
        }
        transaction.exec_drop(
            "INSERT INTO case_events(case_id,command_id,state_version,event_json)
             VALUES (:case_id,:command_id,:version,:events)",
            params! { "case_id"=>case_id,"command_id"=>command_id,"version"=>next_version,"events"=>serde_json::to_string(&PersistedCommandResult { state: next.clone(), events: events.clone() })? },
        )?;
        transaction.exec_drop(
            "INSERT INTO service_audit(player_id,case_id,command_id,outcome)
             VALUES (:player,:case_id,:command_id,'applied')",
            params! { "player"=>player_id,"case_id"=>case_id,"command_id"=>command_id },
        )?;
        transaction.commit()?;
        Ok(CaseCommandResult::Applied {
            version: next_version,
            state: next,
            events,
        })
    }

    pub fn schema_version(&self) -> Result<u32, StorageError> {
        let mut connection = self.pool.get_conn()?;
        Ok(connection
            .query_first("SELECT COALESCE(MAX(version), 0) FROM schema_migrations")?
            .unwrap_or(0))
    }

    pub fn state_version(&self, id: &str) -> Result<Option<u64>, StorageError> {
        let mut connection = self.pool.get_conn()?;
        Ok(connection.exec_first(
            "SELECT version FROM active_cases WHERE case_id = :id",
            params! { "id" => id },
        )?)
    }

    pub fn record_content_file(
        &self,
        relative_path: &str,
        bytes: &[u8],
        row_count: usize,
    ) -> Result<String, StorageError> {
        let checksum = sha256(bytes);
        let mut connection = self.pool.get_conn()?;
        connection.exec_drop(
            "INSERT INTO content_imports(file_path, sha256, row_count)
             VALUES (:path, :checksum, :rows)
             ON DUPLICATE KEY UPDATE
               sha256 = VALUES(sha256), row_count = VALUES(row_count)",
            params! {
                "path" => relative_path,
                "checksum" => &checksum,
                "rows" => row_count as u64,
            },
        )?;
        Ok(checksum)
    }

    pub fn content_manifest_entry(
        &self,
        relative_path: &str,
    ) -> Result<Option<(String, u64)>, StorageError> {
        let mut connection = self.pool.get_conn()?;
        Ok(connection.exec_first(
            "SELECT sha256, row_count FROM content_imports WHERE file_path = :path",
            params! { "path" => relative_path },
        )?)
    }

    pub fn import_content(
        &self,
        repository_root: &Path,
    ) -> Result<ContentImportSummary, StorageError> {
        let data_root = repository_root.join("data");
        let files = csv_files(&data_root)?;
        let mut prepared: Vec<PreparedCsv> = Vec::with_capacity(files.len());
        for path in files {
            let bytes = fs::read(&path)?;
            let mut reader = csv::Reader::from_reader(bytes.as_slice());
            let headers = reader
                .headers()?
                .iter()
                .map(str::to_owned)
                .collect::<Vec<_>>();
            let rows = reader
                .records()
                .map(|record| record.map(|r| r.iter().map(str::to_owned).collect::<Vec<_>>()))
                .collect::<Result<Vec<_>, _>>()?;
            let relative = path
                .strip_prefix(repository_root)
                .map_err(|_| StorageError::InvalidContent(path.display().to_string()))?
                .to_string_lossy()
                .replace('\\', "/");
            prepared.push((relative, sha256(&bytes), headers, rows));
        }

        let total_rows = prepared.iter().map(|(_, _, _, rows)| rows.len()).sum();
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        transaction.query_drop("SET FOREIGN_KEY_CHECKS = 1")?;
        transaction.query_drop("DELETE FROM content_sources")?;
        transaction.query_drop("DELETE FROM content_imports")?;
        for (path, checksum, headers, rows) in &prepared {
            let header_json = serde_json::to_string(headers)?;
            transaction.exec_drop(
                "INSERT INTO content_sources(file_path, header_json, sha256, row_count)
                 VALUES (:path, :headers, :checksum, :rows)",
                params! { "path" => path, "headers" => header_json, "checksum" => checksum, "rows" => rows.len() as u64 },
            )?;
            transaction.exec_drop(
                "INSERT INTO content_imports(file_path, sha256, row_count)
                 VALUES (:path, :checksum, :rows)",
                params! { "path" => path, "checksum" => checksum, "rows" => rows.len() as u64 },
            )?;
            for (index, row) in rows.iter().enumerate() {
                let row_json = serde_json::to_string(row)?;
                let record_key = row.first().cloned().unwrap_or_default();
                transaction.exec_drop(
                    "INSERT INTO content_rows(file_path, row_index, record_key, row_json)
                     VALUES (:path, :index, :record_key, :row_json)",
                    params! { "path" => path, "index" => index as u64, "record_key" => record_key, "row_json" => row_json },
                )?;
            }
        }
        project_normalized_content(&mut transaction, &prepared)?;
        transaction.commit()?;
        self.verify_content(repository_root)?;
        Ok(ContentImportSummary {
            files: prepared.len(),
            rows: total_rows,
        })
    }

    pub fn verify_content(
        &self,
        repository_root: &Path,
    ) -> Result<ContentImportSummary, StorageError> {
        let files = csv_files(&repository_root.join("data"))?;
        let mut total_rows = 0usize;
        let mut connection = self.pool.get_conn()?;
        for path in &files {
            let bytes = fs::read(path)?;
            let relative = path
                .strip_prefix(repository_root)
                .map_err(|_| StorageError::InvalidContent(path.display().to_string()))?
                .to_string_lossy()
                .replace('\\', "/");
            let source_rows = csv::Reader::from_reader(bytes.as_slice()).records().count();
            let stored: Option<(String, u64)> = connection.exec_first(
                "SELECT sha256, row_count FROM content_sources WHERE file_path = :path",
                params! { "path" => &relative },
            )?;
            let Some((stored_checksum, stored_rows)) = stored else {
                return Err(StorageError::InvalidContent(format!("missing {relative}")));
            };
            let database_rows: u64 = connection
                .exec_first(
                    "SELECT COUNT(*) FROM content_rows WHERE file_path = :path",
                    params! { "path" => &relative },
                )?
                .unwrap_or(0);
            if stored_checksum != sha256(&bytes)
                || stored_rows != source_rows as u64
                || database_rows != stored_rows
            {
                return Err(StorageError::InvalidContent(format!(
                    "checksum or row-count mismatch for {relative}"
                )));
            }
            total_rows += source_rows;
        }
        let database_files: u64 = connection
            .query_first("SELECT COUNT(*) FROM content_sources")?
            .unwrap_or(0);
        if database_files != files.len() as u64 {
            return Err(StorageError::InvalidContent(
                "database contains unexpected content files".into(),
            ));
        }
        for (suffix, table) in [
            ("data/locations/locations.csv", "locations"),
            ("data/knowledge/knowledge.csv", "knowledge"),
            (
                "data/knowledge/location-knowledge-relations.csv",
                "location_knowledge",
            ),
            ("data/thieves/thieves.csv", "thieves"),
            ("data/gameplay/venues.csv", "venues"),
            ("data/missions/missions.csv", "missions"),
            ("data/gameplay/state-clue-atoms.csv", "clue_atoms"),
            (
                "data/gameplay/clue-dialogue-variants.csv",
                "dialogue_variants",
            ),
        ] {
            let expected: u64 = connection
                .exec_first(
                    "SELECT row_count FROM content_sources WHERE file_path=:path",
                    params! { "path" => suffix },
                )?
                .ok_or_else(|| {
                    StorageError::InvalidContent(format!("missing manifest row for {suffix}"))
                })?;
            let actual: u64 = connection
                .query_first(format!("SELECT COUNT(*) FROM {table}"))?
                .unwrap_or(0);
            if actual != expected {
                return Err(StorageError::InvalidContent(format!(
                    "normalized table {table}: expected {expected}, found {actual}"
                )));
            }
        }
        Ok(ContentImportSummary {
            files: files.len(),
            rows: total_rows,
        })
    }

    pub fn export_content(
        &self,
        destination_root: &Path,
    ) -> Result<ContentImportSummary, StorageError> {
        let mut connection = self.pool.get_conn()?;
        let sources: Vec<(String, String, u64)> = connection.query(
            "SELECT file_path, header_json, row_count FROM content_sources ORDER BY file_path",
        )?;
        let mut total_rows = 0usize;
        for (path, header_json, expected_rows) in &sources {
            let headers: Vec<String> = serde_json::from_str(header_json)?;
            let rows: Vec<String> = connection.exec_map(
                "SELECT row_json FROM content_rows WHERE file_path = :path ORDER BY row_index",
                params! { "path" => path },
                |row_json: String| row_json,
            )?;
            if rows.len() as u64 != *expected_rows {
                return Err(StorageError::InvalidContent(format!(
                    "row-count mismatch while exporting {path}"
                )));
            }
            let target = destination_root.join(path);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut writer = csv::Writer::from_path(target)?;
            writer.write_record(&headers)?;
            for row_json in rows {
                let row: Vec<String> = serde_json::from_str(&row_json)?;
                writer.write_record(row)?;
            }
            writer.flush()?;
            total_rows += *expected_rows as usize;
        }
        Ok(ContentImportSummary {
            files: sources.len(),
            rows: total_rows,
        })
    }

    pub fn load_terminal_career(
        &self,
        player_id: &str,
    ) -> Result<Option<(u64, Vec<u8>)>, StorageError> {
        let mut connection = self.pool.get_conn()?;
        Ok(connection.exec_first(
            "SELECT version, career_json FROM terminal_careers WHERE player_id = :id",
            params! { "id" => player_id },
        )?)
    }

    pub fn save_terminal_career(
        &self,
        player_id: &str,
        version: u64,
        data: &[u8],
    ) -> Result<(), StorageError> {
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let current: Option<u64> = transaction.exec_first(
            "SELECT version FROM terminal_careers WHERE player_id = :id FOR UPDATE",
            params! { "id" => player_id },
        )?;
        match current {
            Some(existing) if version <= existing => return Err(StorageError::VersionConflict(player_id.into())),
            Some(_) => transaction.exec_drop(
                "UPDATE terminal_careers SET version=:version, career_json=:data WHERE player_id=:id",
                params! { "id" => player_id, "version" => version, "data" => data },
            )?,
            None => transaction.exec_drop(
                "INSERT INTO terminal_careers(player_id, version, career_json) VALUES (:id, :version, :data)",
                params! { "id" => player_id, "version" => version, "data" => data },
            )?,
        }
        transaction.commit()?;
        Ok(())
    }

    pub fn delete_terminal_career(&self, player_id: &str) -> Result<(), StorageError> {
        self.pool.get_conn()?.exec_drop(
            "DELETE FROM terminal_careers WHERE player_id=:id",
            params! { "id" => player_id },
        )?;
        Ok(())
    }

    pub fn backup_operational(&self, path: &Path) -> Result<(), StorageError> {
        let mut connection = self.pool.get_conn()?;
        let backup = OperationalBackup {
            format_version: 7,
            players: connection.query("SELECT player_id, display_name FROM players")?,
            careers: connection
                .query("SELECT player_id, points, solved_missions_json, version FROM careers")?,
            terminal_careers: connection
                .query("SELECT player_id, version, career_json FROM terminal_careers")?,
            active_cases: connection.query(
                "SELECT case_id, player_id, mission_id, version, state_json FROM active_cases",
            )?,
            case_events: connection
                .query("SELECT case_id, command_id, state_version, event_json FROM case_events")?,
            service_audit: connection
                .query("SELECT player_id, case_id, command_id, outcome FROM service_audit")?,
            auth_players: connection.query("SELECT player_id,email,username,home_base,password_hash,CAST(email_verified_at AS CHAR) FROM players")?,
            email_verifications: connection.query("SELECT token_hash,player_id,CAST(expires_at AS CHAR),CAST(used_at AS CHAR) FROM email_verifications")?,
            player_sessions: connection.query("SELECT token_hash,player_id,CAST(expires_at AS CHAR),CAST(revoked_at AS CHAR) FROM player_sessions")?,
            player_profiles: connection.query("SELECT player_id,pronouns,sex,avatar_id,uniform_id,home_base,leaderboard_opt_in FROM players WHERE email IS NOT NULL")?,
            case_archive: connection.query("SELECT player_id,case_id,mission_id,thief_id,outcome,score,elapsed_minutes,CAST(completed_at AS CHAR) FROM case_archive")?,
            achievements: connection.query("SELECT player_id,achievement_id,CAST(earned_at AS CHAR) FROM player_achievements")?,
            archive_metrics: connection.query("SELECT case_id,CAST(states_visited_json AS CHAR),correct_travels,wrong_travels,correct_deductions,wrong_deductions FROM case_archive")?,
            state_visits: connection.query("SELECT player_id,state_name,CAST(first_visited_at AS CHAR) FROM player_state_visits")?,
            rank_history: connection.query("SELECT player_id,old_rank,new_rank,points,CAST(earned_at AS CHAR) FROM rank_history")?,
            session_details: connection.query("SELECT token_hash,session_id,device_label,family_id,rotated_from,CAST(replaced_at AS CHAR) FROM player_sessions")?,
            active_case_kinds: connection.query("SELECT case_id,attempt_kind FROM active_cases")?,
            active_case_content_versions: connection.query("SELECT case_id,content_version FROM active_cases")?,
            archive_completion_metadata: connection.query("SELECT case_id,attempt_kind,first_completion FROM case_archive")?,
            mission_completions: connection.query("SELECT player_id,mission_id,first_case_id,CAST(first_completed_at AS CHAR),best_score,best_elapsed_minutes,replay_count FROM player_mission_completions")?,
            active_mission_assignments: connection.query("SELECT player_id,mission_id,case_id FROM active_mission_assignments")?,
            content_roles: connection.query("SELECT player_id,content_role FROM players")?,
            mission_lifecycle: connection.query("SELECT mission_id,lifecycle_status,content_version,CAST(published_at AS CHAR),CAST(scheduled_for AS CHAR),CAST(retired_at AS CHAR),lifecycle_updated_by FROM missions")?,
            mission_lifecycle_audit: connection.query("SELECT mission_id,actor_player_id,from_status,to_status,content_version,reason,CAST(created_at AS CHAR) FROM mission_lifecycle_audit")?,
            release_notifications: connection.query("SELECT player_id,mission_id,CAST(published_at AS CHAR),CAST(read_at AS CHAR) FROM catalogue_release_notifications")?,
            avatar_profiles: connection.query("SELECT player_id,avatar_id,CAST(avatar_setup_completed_at AS CHAR) FROM players")?,
        };
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, serde_json::to_vec_pretty(&backup)?)?;
        Ok(())
    }

    pub fn restore_operational(&self, path: &Path) -> Result<(), StorageError> {
        let backup: OperationalBackup = serde_json::from_slice(&fs::read(path)?)?;
        if !matches!(backup.format_version, 1 | 2 | 3 | 4 | 5 | 6 | 7) {
            return Err(StorageError::InvalidContent(
                "unsupported backup version".into(),
            ));
        }
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        for (id, name) in backup.players {
            transaction.exec_drop(
                "INSERT INTO players(player_id, display_name) VALUES (:id,:name)
                 ON DUPLICATE KEY UPDATE display_name=VALUES(display_name)",
                params! { "id" => id, "name" => name },
            )?;
        }
        for (id, points, solved, version) in backup.careers {
            transaction.exec_drop(
                "INSERT INTO careers(player_id,points,solved_missions_json,version) VALUES (:id,:points,:solved,:version)
                 ON DUPLICATE KEY UPDATE points=VALUES(points),solved_missions_json=VALUES(solved_missions_json),version=VALUES(version)",
                params! { "id" => id, "points" => points, "solved" => solved, "version" => version },
            )?;
        }
        for (id, version, data) in backup.terminal_careers {
            transaction.exec_drop(
                "INSERT INTO terminal_careers(player_id,version,career_json) VALUES (:id,:version,:data)
                 ON DUPLICATE KEY UPDATE version=VALUES(version),career_json=VALUES(career_json)",
                params! { "id" => id, "version" => version, "data" => data },
            )?;
        }
        for (id, player, mission, version, data) in backup.active_cases {
            transaction.exec_drop(
                "INSERT INTO active_cases(case_id,player_id,mission_id,version,state_json) VALUES (:id,:player,:mission,:version,:data)
                 ON DUPLICATE KEY UPDATE player_id=VALUES(player_id),mission_id=VALUES(mission_id),version=VALUES(version),state_json=VALUES(state_json)",
                params! { "id" => id, "player" => player, "mission" => mission, "version" => version, "data" => data },
            )?;
        }
        for (case_id, command_id, version, event) in backup.case_events {
            transaction.exec_drop(
                "INSERT INTO case_events(case_id,command_id,state_version,event_json) VALUES (:case_id,:command_id,:version,:event)
                 ON DUPLICATE KEY UPDATE state_version=VALUES(state_version),event_json=VALUES(event_json)",
                params! { "case_id" => case_id, "command_id" => command_id, "version" => version, "event" => event },
            )?;
        }
        for (player_id, case_id, command_id, outcome) in backup.service_audit {
            transaction.exec_drop(
                "INSERT INTO service_audit(player_id,case_id,command_id,outcome)
                 VALUES (:player,:case_id,:command_id,:outcome)",
                params! { "player"=>player_id,"case_id"=>case_id,"command_id"=>command_id,"outcome"=>outcome },
            )?;
        }
        for (id, email, username, home, password, verified) in backup.auth_players {
            transaction.exec_drop(
                "UPDATE players SET email=:email,username=:username,home_base=:home,password_hash=:password,email_verified_at=:verified WHERE player_id=:id",
                params!{"id"=>id,"email"=>email,"username"=>username,"home"=>home,"password"=>password,"verified"=>verified},
            )?;
        }
        for (token, player, expires, used) in backup.email_verifications {
            transaction.exec_drop(
                "INSERT INTO email_verifications(token_hash,player_id,expires_at,used_at) VALUES (:token,:player,:expires,:used)
                 ON DUPLICATE KEY UPDATE expires_at=VALUES(expires_at),used_at=VALUES(used_at)",
                params!{"token"=>token,"player"=>player,"expires"=>expires,"used"=>used},
            )?;
        }
        for (token, player, expires, revoked) in backup.player_sessions {
            transaction.exec_drop(
                "INSERT INTO player_sessions(token_hash,player_id,session_id,expires_at,revoked_at) VALUES (:token,:player,UUID(),:expires,:revoked)
                 ON DUPLICATE KEY UPDATE expires_at=VALUES(expires_at),revoked_at=VALUES(revoked_at)",
                params!{"token"=>token,"player"=>player,"expires"=>expires,"revoked"=>revoked},
            )?;
        }
        for (player, pronouns, sex, avatar, uniform, home, leaderboard) in backup.player_profiles {
            transaction.exec_drop("UPDATE players SET pronouns=:pronouns,sex=:sex,avatar_id=:avatar,uniform_id=:uniform,home_base=:home,leaderboard_opt_in=:leaderboard WHERE player_id=:player",params!{"player"=>player,"pronouns"=>pronouns,"sex"=>sex,"avatar"=>avatar,"uniform"=>uniform,"home"=>home,"leaderboard"=>leaderboard})?;
        }
        for (player, case_id, mission, thief, outcome, score, elapsed, completed) in
            backup.case_archive
        {
            transaction.exec_drop("INSERT INTO case_archive(player_id,case_id,mission_id,thief_id,outcome,score,elapsed_minutes,completed_at) VALUES (:player,:case_id,:mission,:thief,:outcome,:score,:elapsed,:completed) ON DUPLICATE KEY UPDATE outcome=VALUES(outcome),score=VALUES(score),elapsed_minutes=VALUES(elapsed_minutes),completed_at=VALUES(completed_at)",params!{"player"=>player,"case_id"=>case_id,"mission"=>mission,"thief"=>thief,"outcome"=>outcome,"score"=>score,"elapsed"=>elapsed,"completed"=>completed})?;
        }
        for (player, achievement, earned) in backup.achievements {
            transaction.exec_drop("INSERT INTO player_achievements(player_id,achievement_id,earned_at) VALUES (:player,:achievement,:earned) ON DUPLICATE KEY UPDATE earned_at=VALUES(earned_at)",params!{"player"=>player,"achievement"=>achievement,"earned"=>earned})?;
        }
        for (
            case_id,
            states,
            correct_travels,
            wrong_travels,
            correct_deductions,
            wrong_deductions,
        ) in backup.archive_metrics
        {
            transaction.exec_drop("UPDATE case_archive SET states_visited_json=:states,correct_travels=:correct_travels,wrong_travels=:wrong_travels,correct_deductions=:correct_deductions,wrong_deductions=:wrong_deductions WHERE case_id=:case_id",params!{"case_id"=>case_id,"states"=>states,"correct_travels"=>correct_travels,"wrong_travels"=>wrong_travels,"correct_deductions"=>correct_deductions,"wrong_deductions"=>wrong_deductions})?;
        }
        for (player, state_name, first_visited) in backup.state_visits {
            transaction.exec_drop("INSERT INTO player_state_visits(player_id,state_name,first_visited_at) VALUES (:player,:state,:visited) ON DUPLICATE KEY UPDATE first_visited_at=VALUES(first_visited_at)",params!{"player"=>player,"state"=>state_name,"visited"=>first_visited})?;
        }
        for (player, old_rank, new_rank, points, earned) in backup.rank_history {
            transaction.exec_drop("INSERT INTO rank_history(player_id,old_rank,new_rank,points,earned_at) VALUES (:player,:old,:new,:points,:earned)",params!{"player"=>player,"old"=>old_rank,"new"=>new_rank,"points"=>points,"earned"=>earned})?;
        }
        for (token, session, device, family, rotated, replaced) in backup.session_details {
            transaction.exec_drop("UPDATE player_sessions SET session_id=:session,device_label=:device,family_id=:family,rotated_from=:rotated,replaced_at=:replaced WHERE token_hash=:token",params!{"token"=>token,"session"=>session,"device"=>device,"family"=>family,"rotated"=>rotated,"replaced"=>replaced})?;
        }
        for (case_id, attempt_kind) in backup.active_case_kinds {
            transaction.exec_drop(
                "UPDATE active_cases SET attempt_kind=:kind WHERE case_id=:case_id",
                params! {"case_id"=>case_id,"kind"=>attempt_kind},
            )?;
        }
        for (case_id, content_version) in backup.active_case_content_versions {
            transaction.exec_drop(
                "UPDATE active_cases SET content_version=:version WHERE case_id=:case_id",
                params! {"case_id"=>case_id,"version"=>content_version},
            )?;
        }
        for (case_id, attempt_kind, first_completion) in backup.archive_completion_metadata {
            transaction.exec_drop("UPDATE case_archive SET attempt_kind=:kind,first_completion=:first WHERE case_id=:case_id",params!{"case_id"=>case_id,"kind"=>attempt_kind,"first"=>first_completion})?;
        }
        for (player, mission, first_case, completed, best_score, best_elapsed, replay_count) in
            backup.mission_completions
        {
            transaction.exec_drop("INSERT INTO player_mission_completions(player_id,mission_id,first_case_id,first_completed_at,best_score,best_elapsed_minutes,replay_count) VALUES (:player,:mission,:first_case,:completed,:best_score,:best_elapsed,:replay_count) ON DUPLICATE KEY UPDATE first_case_id=VALUES(first_case_id),first_completed_at=VALUES(first_completed_at),best_score=VALUES(best_score),best_elapsed_minutes=VALUES(best_elapsed_minutes),replay_count=VALUES(replay_count)",params!{"player"=>player,"mission"=>mission,"first_case"=>first_case,"completed"=>completed,"best_score"=>best_score,"best_elapsed"=>best_elapsed,"replay_count"=>replay_count})?;
        }
        for (player, mission, case_id) in backup.active_mission_assignments {
            transaction.exec_drop("INSERT INTO active_mission_assignments(player_id,mission_id,case_id) VALUES (:player,:mission,:case_id) ON DUPLICATE KEY UPDATE case_id=VALUES(case_id)",params!{"player"=>player,"mission"=>mission,"case_id"=>case_id})?;
        }
        for (player, role) in backup.content_roles {
            transaction.exec_drop(
                "UPDATE players SET content_role=:role WHERE player_id=:player",
                params! {"player"=>player,"role"=>role},
            )?;
        }
        for (mission, status, version, published, scheduled, retired, actor) in
            backup.mission_lifecycle
        {
            transaction.exec_drop("UPDATE missions SET lifecycle_status=:status,content_version=:version,published_at=:published,scheduled_for=:scheduled,retired_at=:retired,lifecycle_updated_by=:actor WHERE mission_id=:mission",params!{"mission"=>mission,"status"=>status,"version"=>version,"published"=>published,"scheduled"=>scheduled,"retired"=>retired,"actor"=>actor})?;
        }
        for (mission, actor, from_status, to_status, version, reason, created) in
            backup.mission_lifecycle_audit
        {
            transaction.exec_drop("INSERT INTO mission_lifecycle_audit(mission_id,actor_player_id,from_status,to_status,content_version,reason,created_at) VALUES (:mission,:actor,:from_status,:to_status,:version,:reason,:created)",params!{"mission"=>mission,"actor"=>actor,"from_status"=>from_status,"to_status"=>to_status,"version"=>version,"reason"=>reason,"created"=>created})?;
        }
        for (player, mission, published, read_at) in backup.release_notifications {
            transaction.exec_drop("INSERT INTO catalogue_release_notifications(player_id,mission_id,published_at,read_at) VALUES (:player,:mission,:published,:read_at) ON DUPLICATE KEY UPDATE published_at=VALUES(published_at),read_at=VALUES(read_at)",params!{"player"=>player,"mission"=>mission,"published"=>published,"read_at"=>read_at})?;
        }
        for (player, avatar, completed) in backup.avatar_profiles {
            transaction.exec_drop("UPDATE players SET avatar_id=:avatar,avatar_setup_completed_at=:completed WHERE player_id=:player",params!{"player"=>player,"avatar"=>avatar,"completed"=>completed})?;
        }
        transaction.commit()?;
        Ok(())
    }

    pub fn cooperation_preferences(
        &self,
        player: &str,
    ) -> Result<CooperationPreferences, StorageError> {
        self.pool.get_conn()?.exec_first(
            "SELECT cooperation_enabled,cooperation_email_enabled,age_assurance_status FROM players WHERE player_id=:player",
            params!{"player"=>player},
        )?.map(|(enabled,email,age):(bool,bool,String)| CooperationPreferences{enabled,email_enabled:email,age_assurance_status:age}).ok_or(StorageError::Forbidden)
    }

    pub fn set_cooperation_preferences(
        &self,
        player: &str,
        enabled: bool,
        email: bool,
    ) -> Result<CooperationPreferences, StorageError> {
        self.pool.get_conn()?.exec_drop(
            "UPDATE players SET cooperation_enabled=:enabled,cooperation_email_enabled=:email WHERE player_id=:player AND age_assurance_status='adult'",
            params!{"player"=>player,"enabled"=>enabled,"email"=>email},
        )?;
        self.cooperation_preferences(player)
    }

    pub fn cooperation_block(&self, actor: &str, username: &str) -> Result<(), StorageError> {
        let mut connection = self.pool.get_conn()?;
        let mut tx = connection.start_transaction(TxOpts::default())?;
        let target: Option<String> = tx.exec_first(
            "SELECT player_id FROM players WHERE username=:username",
            params! {"username"=>username},
        )?;
        let target = target.ok_or(StorageError::Forbidden)?;
        if target == actor {
            return Err(StorageError::Command("cannot block yourself".into()));
        }
        tx.exec_drop(
            "INSERT IGNORE INTO cooperation_blocks(blocker_id,blocked_id) VALUES (:actor,:target)",
            params! {"actor"=>actor,"target"=>&target},
        )?;
        tx.exec_drop("UPDATE cooperation_requests SET status='cancelled' WHERE status IN ('pending','accepted') AND ((owner_id=:actor AND helper_id=:target) OR (owner_id=:target AND helper_id=:actor))",params!{"actor"=>actor,"target"=>&target})?;
        tx.exec_drop("INSERT INTO cooperation_audit(actor_id,event_type,metadata_json) VALUES (:actor,'player_blocked',JSON_OBJECT('blocked_id',:target))",params!{"actor"=>actor,"target"=>target})?;
        tx.commit()?;
        Ok(())
    }

    pub fn cooperation_report(
        &self,
        actor: &str,
        username: &str,
        category: &str,
        details: Option<&str>,
    ) -> Result<String, StorageError> {
        if !matches!(
            category,
            "spam" | "harassment" | "abusive_username" | "cheating" | "other"
        ) || details.is_some_and(|v| v.len() > 500)
        {
            return Err(StorageError::Command("invalid report".into()));
        }
        let mut connection = self.pool.get_conn()?;
        let target: Option<String> = connection.exec_first(
            "SELECT player_id FROM players WHERE username=:username",
            params! {"username"=>username},
        )?;
        let id = uuid::Uuid::new_v4().to_string();
        connection.exec_drop("INSERT INTO cooperation_reports(report_id,reporter_id,reported_id,category,details) VALUES (:id,:actor,:target,:category,:details)",params!{"id"=>&id,"actor"=>actor,"target"=>target.ok_or(StorageError::Forbidden)?,"category"=>category,"details"=>details})?;
        Ok(id)
    }

    pub fn create_cooperation_request(
        &self,
        owner: &str,
        helper_username: &str,
        case_id: &str,
        venue_id: &str,
        command_id: &str,
        public_scene: &serde_json::Value,
    ) -> Result<String, StorageError> {
        let mut connection = self.pool.get_conn()?;
        let mut tx = connection.start_transaction(TxOpts::default())?;
        let helper:Option<String>=tx.exec_first("SELECT player_id FROM players WHERE username=:username AND email_verified_at IS NOT NULL AND cooperation_enabled=TRUE AND age_assurance_status='adult' AND (SELECT COUNT(*) FROM player_mission_completions WHERE player_id=players.player_id)>=3",params!{"username"=>helper_username})?;
        let helper = helper.ok_or(StorageError::Command("helper is not eligible".into()))?;
        let owns:u64=tx.exec_first("SELECT COUNT(*) FROM active_cases WHERE case_id=:case AND player_id=:owner AND attempt_kind='ordinary'",params!{"case"=>case_id,"owner"=>owner})?.unwrap_or(0);
        let blocked:u64=tx.exec_first("SELECT COUNT(*) FROM cooperation_blocks WHERE (blocker_id=:owner AND blocked_id=:helper) OR (blocker_id=:helper AND blocked_id=:owner)",params!{"owner"=>owner,"helper"=>&helper})?.unwrap_or(0);
        if owns != 1 || owner == helper || blocked > 0 {
            return Err(StorageError::Forbidden);
        }
        let id = uuid::Uuid::new_v4().to_string();
        let scene = serde_json::to_string(public_scene)?;
        tx.exec_drop("INSERT INTO cooperation_requests(request_id,command_id,owner_id,helper_id,case_id,venue_id,public_scene_json,expires_at) VALUES (:id,:command,:owner,:helper,:case,:venue,:scene,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 12 HOUR))",params!{"id"=>&id,"command"=>command_id,"owner"=>owner,"helper"=>helper,"case"=>case_id,"venue"=>venue_id,"scene"=>scene})?;
        tx.exec_drop("INSERT INTO cooperation_audit(request_id,actor_id,event_type,metadata_json) VALUES (:id,:owner,'request_created',JSON_OBJECT())",params!{"id"=>&id,"owner"=>owner})?;
        tx.commit()?;
        Ok(id)
    }

    pub fn transition_cooperation_request(
        &self,
        actor: &str,
        request_id: &str,
        action: &str,
        recommendation: Option<&serde_json::Value>,
    ) -> Result<(), StorageError> {
        let (from, to, role) = match action {
            "accept" => ("pending", "accepted", "helper"),
            "decline" => ("pending", "declined", "helper"),
            "complete" => ("accepted", "completed", "helper"),
            "acknowledge" => ("completed", "acknowledged", "owner"),
            _ => return Err(StorageError::Command("invalid cooperation action".into())),
        };
        let mut connection = self.pool.get_conn()?;
        let mut tx = connection.start_transaction(TxOpts::default())?;
        tx.exec_drop("UPDATE cooperation_requests SET status=:to,recommendation_json=COALESCE(:recommendation,recommendation_json) WHERE request_id=:id AND status=:from AND expires_at>UTC_TIMESTAMP() AND ((:role='helper' AND helper_id=:actor) OR (:role='owner' AND owner_id=:actor))",params!{"to"=>to,"from"=>from,"id"=>request_id,"actor"=>actor,"role"=>role,"recommendation"=>recommendation.map(serde_json::to_string).transpose()?})?;
        if tx.affected_rows() != 1 {
            return Err(StorageError::Forbidden);
        }
        if action == "acknowledge" {
            let eligible:u64=tx.exec_first("SELECT COUNT(*) FROM cooperation_requests r WHERE r.request_id=:id AND (SELECT COUNT(*) FROM cooperation_audit a WHERE a.actor_id=r.helper_id AND a.event_type='reputation_awarded' AND a.created_at>=UTC_DATE())<3 AND (SELECT COUNT(*) FROM cooperation_requests p WHERE p.helper_id=r.helper_id AND p.owner_id=r.owner_id AND p.reward_granted=TRUE AND p.updated_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 7 DAY))=0",params!{"id"=>request_id})?.unwrap_or(0);
            if eligible == 1 {
                tx.exec_drop(
                    "UPDATE cooperation_requests SET reward_granted=TRUE WHERE request_id=:id",
                    params! {"id"=>request_id},
                )?;
                tx.exec_drop("UPDATE players SET cooperation_reputation=cooperation_reputation+1 WHERE player_id=(SELECT helper_id FROM cooperation_requests WHERE request_id=:id)",params!{"id"=>request_id})?;
                tx.exec_drop("INSERT INTO cooperation_audit(request_id,actor_id,event_type,metadata_json) SELECT request_id,helper_id,'reputation_awarded',JSON_OBJECT('amount',1) FROM cooperation_requests WHERE request_id=:id",params!{"id"=>request_id})?;
            }
        }
        tx.exec_drop("INSERT INTO cooperation_audit(request_id,actor_id,event_type,metadata_json) VALUES (:id,:actor,:action,JSON_OBJECT())",params!{"id"=>request_id,"actor"=>actor,"action"=>action})?;
        tx.commit()?;
        Ok(())
    }

    pub fn cooperation_requests(
        &self,
        player: &str,
    ) -> Result<Vec<CooperationRequest>, StorageError> {
        let mut connection = self.pool.get_conn()?;
        connection.exec_drop("UPDATE cooperation_requests SET status='expired' WHERE status IN ('pending','accepted') AND expires_at<=UTC_TIMESTAMP()",())?;
        let rows:Vec<(String,String,String,String,String,String,String,Option<String>,bool,String)>=connection.exec(
            "SELECT r.request_id,o.username,h.username,r.case_id,r.venue_id,r.status,CAST(r.public_scene_json AS CHAR),CAST(r.recommendation_json AS CHAR),r.reward_granted,DATE_FORMAT(r.expires_at,'%Y-%m-%dT%H:%i:%sZ') FROM cooperation_requests r JOIN players o ON o.player_id=r.owner_id JOIN players h ON h.player_id=r.helper_id WHERE r.owner_id=:player OR r.helper_id=:player ORDER BY r.created_at DESC LIMIT 100",
            params!{"player"=>player})?;
        rows.into_iter()
            .map(
                |(
                    request_id,
                    owner_username,
                    helper_username,
                    case_id,
                    venue_id,
                    status,
                    scene,
                    recommendation,
                    reward_granted,
                    expires_at,
                )| {
                    Ok(CooperationRequest {
                        request_id,
                        owner_username,
                        helper_username,
                        case_id,
                        venue_id,
                        status,
                        public_scene: serde_json::from_str(&scene)?,
                        recommendation: recommendation
                            .map(|v| serde_json::from_str(&v))
                            .transpose()?,
                        reward_granted,
                        expires_at,
                    })
                },
            )
            .collect()
    }

    pub fn cooperation_reputation(&self, player: &str) -> Result<u64, StorageError> {
        self.pool
            .get_conn()?
            .exec_first(
                "SELECT cooperation_reputation FROM players WHERE player_id=:player",
                params! {"player"=>player},
            )?
            .ok_or(StorageError::Forbidden)
    }

    pub fn cooperation_unblock(&self, actor: &str, blocked: &str) -> Result<(), StorageError> {
        self.pool.get_conn()?.exec_drop(
            "DELETE FROM cooperation_blocks WHERE blocker_id=:actor AND blocked_id=:blocked",
            params! {"actor"=>actor,"blocked"=>blocked},
        )?;
        Ok(())
    }

    pub fn cooperation_blocks(&self, actor: &str) -> Result<Vec<(String, String)>, StorageError> {
        Ok(self.pool.get_conn()?.exec("SELECT p.player_id,p.username FROM cooperation_blocks b JOIN players p ON p.player_id=b.blocked_id WHERE b.blocker_id=:actor ORDER BY p.username",params!{"actor"=>actor})?)
    }
}

fn csv_files(root: &Path) -> Result<Vec<PathBuf>, StorageError> {
    fn visit(path: &Path, files: &mut Vec<PathBuf>) -> Result<(), std::io::Error> {
        for entry in fs::read_dir(path)? {
            let path = entry?.path();
            if path.is_dir() {
                visit(&path, files)?;
            } else if path.extension().and_then(|x| x.to_str()) == Some("csv") {
                files.push(path);
            }
        }
        Ok(())
    }
    let mut files = vec![];
    visit(root, &mut files)?;
    files.sort();
    Ok(files)
}

fn rows_for<'a>(
    prepared: &'a [PreparedCsv],
    suffix: &str,
) -> Result<&'a [Vec<String>], StorageError> {
    prepared
        .iter()
        .find(|(path, _, _, _)| path.ends_with(suffix))
        .map(|(_, _, _, rows)| rows.as_slice())
        .ok_or_else(|| StorageError::InvalidContent(format!("missing {suffix}")))
}

fn project_normalized_content(
    transaction: &mut mysql::Transaction<'_>,
    prepared: &[PreparedCsv],
) -> Result<(), StorageError> {
    for row in rows_for(prepared, "locations/locations.csv")? {
        transaction.exec_drop(
            "INSERT INTO locations(location_id,name,location_type,state_or_territory,region,latitude,longitude,game_tags,knowledge_hooks,source)
             VALUES (:id,:name,:kind,:state,:region,NULLIF(:lat,''),NULLIF(:lon,''),:tags,:hooks,:source)
             ON DUPLICATE KEY UPDATE name=VALUES(name),location_type=VALUES(location_type),state_or_territory=VALUES(state_or_territory),region=VALUES(region),latitude=VALUES(latitude),longitude=VALUES(longitude),game_tags=VALUES(game_tags),knowledge_hooks=VALUES(knowledge_hooks),source=VALUES(source)",
            params! { "id"=>&row[0],"name"=>&row[1],"kind"=>&row[2],"state"=>&row[3],"region"=>&row[4],"lat"=>&row[5],"lon"=>&row[6],"tags"=>&row[7],"hooks"=>&row[8],"source"=>&row[9] },
        )?;
    }
    for row in rows_for(prepared, "knowledge/knowledge.csv")? {
        transaction.exec_drop(
            "INSERT INTO knowledge(knowledge_id,domain,topic,fact,answer,difficulty,clue_forms,source,refresh_policy)
             VALUES (:id,:domain,:topic,:fact,:answer,:difficulty,:forms,:source,:policy)
             ON DUPLICATE KEY UPDATE domain=VALUES(domain),topic=VALUES(topic),fact=VALUES(fact),answer=VALUES(answer),difficulty=VALUES(difficulty),clue_forms=VALUES(clue_forms),source=VALUES(source),refresh_policy=VALUES(refresh_policy)",
            params! { "id"=>&row[0],"domain"=>&row[1],"topic"=>&row[2],"fact"=>&row[3],"answer"=>&row[4],"difficulty"=>&row[5],"forms"=>&row[6],"source"=>&row[7],"policy"=>&row[8] },
        )?;
    }
    for row in rows_for(prepared, "knowledge/location-knowledge-relations.csv")? {
        transaction.exec_drop(
            "INSERT INTO location_knowledge(location_id,knowledge_id,relation_type,weight)
             VALUES (:location,:knowledge,:kind,:weight)
             ON DUPLICATE KEY UPDATE weight=VALUES(weight)",
            params! { "location"=>&row[0],"knowledge"=>&row[1],"kind"=>&row[2],"weight"=>&row[3] },
        )?;
    }
    let profiles = rows_for(prepared, "gameplay/thief-profiles.csv")?
        .iter()
        .map(|row| (row[0].as_str(), serde_json::to_string(row).unwrap()))
        .collect::<std::collections::HashMap<_, _>>();
    for row in rows_for(prepared, "thieves/thieves.csv")? {
        let profile = profiles.get(row[0].as_str()).ok_or_else(|| {
            StorageError::InvalidContent(format!("missing profile for {}", row[0]))
        })?;
        transaction.exec_drop(
            "INSERT INTO thieves(thief_id,name,alias,profile_json) VALUES (:id,:name,:alias,:profile)
             ON DUPLICATE KEY UPDATE name=VALUES(name),alias=VALUES(alias),profile_json=VALUES(profile_json)",
            params! { "id"=>&row[0],"name"=>&row[1],"alias"=>&row[2],"profile"=>profile },
        )?;
    }
    let experiences = rows_for(prepared, "gameplay/venue-experiences.csv")?
        .iter()
        .map(|row| (row[0].as_str(), serde_json::to_string(row).unwrap()))
        .collect::<std::collections::HashMap<_, _>>();
    for row in rows_for(prepared, "gameplay/venues.csv")? {
        let experience = experiences.get(row[0].as_str()).ok_or_else(|| {
            StorageError::InvalidContent(format!("missing venue experience for {}", row[0]))
        })?;
        transaction.exec_drop(
            "INSERT INTO venues(venue_id,venue_name,opens_hour,closes_hour,interview_minutes,witness_roles,experience_json)
             VALUES (:id,:name,:opens,:closes,:minutes,:roles,:experience)
             ON DUPLICATE KEY UPDATE venue_name=VALUES(venue_name),opens_hour=VALUES(opens_hour),closes_hour=VALUES(closes_hour),interview_minutes=VALUES(interview_minutes),witness_roles=VALUES(witness_roles),experience_json=VALUES(experience_json)",
            params! { "id"=>&row[0],"name"=>&row[1],"opens"=>&row[2],"closes"=>&row[3],"minutes"=>&row[4],"roles"=>&row[5],"experience"=>experience },
        )?;
    }
    let narratives = rows_for(prepared, "gameplay/mission-narratives.csv")?
        .iter()
        .map(|row| (row[0].as_str(), serde_json::to_string(row).unwrap()))
        .collect::<std::collections::HashMap<_, _>>();
    for row in rows_for(prepared, "missions/missions.csv")? {
        let narrative = narratives.get(row[0].as_str()).ok_or_else(|| {
            StorageError::InvalidContent(format!("missing narrative for {}", row[0]))
        })?;
        transaction.exec_drop(
            "INSERT INTO missions(mission_id,difficulty,thief_id,start_location_id,stop_2_location_id,stop_3_location_id,capture_location_id,content_json,narrative_json)
             VALUES (:id,:difficulty,:thief,:start,:stop2,:stop3,:capture,:content,:narrative)
             ON DUPLICATE KEY UPDATE difficulty=VALUES(difficulty),thief_id=VALUES(thief_id),start_location_id=VALUES(start_location_id),stop_2_location_id=VALUES(stop_2_location_id),stop_3_location_id=VALUES(stop_3_location_id),capture_location_id=VALUES(capture_location_id),content_json=VALUES(content_json),narrative_json=VALUES(narrative_json)",
            params! { "id"=>&row[0],"difficulty"=>&row[4],"thief"=>&row[5],"start"=>&row[7],"stop2"=>&row[8],"stop3"=>&row[9],"capture"=>&row[10],"content"=>serde_json::to_string(row)?,"narrative"=>narrative },
        )?;
    }
    for row in rows_for(prepared, "gameplay/state-clue-atoms.csv")? {
        let knowledge = (!row[12].is_empty()).then_some(row[12].as_str());
        transaction.exec_drop(
            "INSERT INTO clue_atoms(atom_id,state,venue_id,candidate_states,knowledge_id,content_json)
             VALUES (:id,:state,:venue,:candidates,:knowledge,:content)
             ON DUPLICATE KEY UPDATE state=VALUES(state),venue_id=VALUES(venue_id),candidate_states=VALUES(candidate_states),knowledge_id=VALUES(knowledge_id),content_json=VALUES(content_json)",
            params! { "id"=>&row[0],"state"=>&row[1],"venue"=>&row[5],"candidates"=>&row[4],"knowledge"=>knowledge,"content"=>serde_json::to_string(row)? },
        )?;
    }
    for row in rows_for(prepared, "gameplay/clue-dialogue-variants.csv")? {
        transaction.exec_drop(
            "INSERT INTO dialogue_variants(variant_id,atom_id,difficulty,speech_register,variant_number,dialogue)
             VALUES (:id,:atom,:difficulty,:register,:number,:dialogue)
             ON DUPLICATE KEY UPDATE atom_id=VALUES(atom_id),difficulty=VALUES(difficulty),speech_register=VALUES(speech_register),variant_number=VALUES(variant_number),dialogue=VALUES(dialogue)",
            params! { "id"=>&row[0],"atom"=>&row[1],"difficulty"=>&row[2],"register"=>&row[3],"number"=>&row[4],"dialogue"=>&row[5] },
        )?;
    }
    Ok(())
}

fn apply_migration(connection: &mut mysql::PooledConn, sql: &str) -> Result<(), StorageError> {
    for statement in sql.split(';').map(str::trim).filter(|s| !s.is_empty()) {
        connection.query_drop(statement)?;
    }
    Ok(())
}

impl StateStore for MysqlStore {
    type Error = StorageError;

    fn load(&self, id: &str) -> Result<Option<Vec<u8>>, Self::Error> {
        let mut connection = self.pool.get_conn()?;
        Ok(connection.exec_first(
            "SELECT state_json FROM active_cases WHERE case_id = :id",
            params! { "id" => id },
        )?)
    }

    fn save(&self, id: &str, version: u64, data: &[u8]) -> Result<(), Self::Error> {
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let current: Option<u64> = transaction.exec_first(
            "SELECT version FROM active_cases WHERE case_id = :id FOR UPDATE",
            params! { "id" => id },
        )?;
        match current {
            Some(existing) if version <= existing => {
                return Err(StorageError::VersionConflict(id.to_owned()));
            }
            Some(_) => transaction.exec_drop(
                "UPDATE active_cases SET version = :version, state_json = :state WHERE case_id = :id",
                params! { "id" => id, "version" => version, "state" => data },
            )?,
            None => transaction.exec_drop(
                "INSERT INTO active_cases(case_id, version, state_json) VALUES (:id, :version, :state)",
                params! { "id" => id, "version" => version, "state" => data },
            )?,
        }
        transaction.commit()?;
        Ok(())
    }
}

pub fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    static MYSQL_TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    #[test]
    fn environment_configuration_is_explicit() {
        let values = [
            ("MYSQL_HOST", "127.0.0.1"),
            ("MYSQL_PORT", "3306"),
            ("MYSQL_USER", "naijachase"),
            ("MYSQL_PASSWORD", "secret"),
            ("MYSQL_DATABASE", "naijachase"),
            ("MYSQL_SSL_MODE", "required"),
        ];
        let config = MysqlConfig::from_lookup(|key| {
            values
                .iter()
                .find(|(candidate, _)| candidate == &key)
                .map(|(_, value)| (*value).to_owned())
        })
        .unwrap();
        assert_eq!(config.host, "127.0.0.1");
        assert_eq!(config.port, 3306);
        assert_eq!(config.user, "naijachase");
        assert_eq!(config.database, "naijachase");
        assert_eq!(config.ssl_mode, "required");
        assert!(mysql::Opts::from(config.options()).get_ssl_opts().is_some());
    }

    #[test]
    fn invalid_mysql_ssl_mode_is_rejected() {
        let values = [
            ("MYSQL_HOST", "127.0.0.1"),
            ("MYSQL_PORT", "3306"),
            ("MYSQL_USER", "naijachase"),
            ("MYSQL_PASSWORD", "secret"),
            ("MYSQL_DATABASE", "naijachase"),
            ("MYSQL_SSL_MODE", "sometimes"),
        ];
        let error = MysqlConfig::from_lookup(|key| {
            values
                .iter()
                .find(|(candidate, _)| candidate == &key)
                .map(|(_, value)| (*value).to_owned())
        })
        .unwrap_err();
        assert!(matches!(error, StorageError::InvalidMysqlSslMode(_)));
    }

    #[test]
    fn checksum_is_stable() {
        assert_eq!(
            sha256(b"a,b\n1,2\n"),
            "492d5ea496056f1a6a6592241032fab764c321596317930b4fa0e1e8bc3b7470"
        );
    }

    #[test]
    fn progression_metrics_are_derived_from_replay() {
        let mut game = GameState {
            version: 1,
            mission_id: "M".into(),
            thief_id: "T".into(),
            difficulty: 1,
            stage: 1,
            state: "Kano".into(),
            route: vec!["Lagos".into(), "Kano".into()],
            elapsed: 100,
            score: 500,
            career_points: 0,
            dossier: Default::default(),
            observations: Default::default(),
            visited_venues: vec![],
            warrant_suspect: None,
            hideout_venue: "market".into(),
            replay: vec![],
            outcome: None,
            economy: Default::default(),
        };
        game.observations.insert("hair".into(), "braided".into());
        game.replay.push(naijachase_contracts::Command::Travel {
            destination: "Ogun".into(),
            minutes: 10,
        });
        game.replay.push(naijachase_contracts::Command::Travel {
            destination: "Kano".into(),
            minutes: 10,
        });
        game.replay
            .push(naijachase_contracts::Command::RecordTrait {
                trait_name: "hair".into(),
                value: "short".into(),
            });
        game.replay
            .push(naijachase_contracts::Command::RecordTrait {
                trait_name: "hair".into(),
                value: "braided".into(),
            });
        let (states, correct_travels, wrong_travels, correct_deductions, wrong_deductions) =
            case_metrics(&game);
        assert_eq!(states, vec!["Kano", "Lagos", "Ogun"]);
        assert_eq!((correct_travels, wrong_travels), (1, 1));
        assert_eq!((correct_deductions, wrong_deductions), (1, 1));
    }

    #[test]
    fn dotenv_location_is_repository_root_when_present() {
        if let Some(path) = repository_dotenv_path() {
            assert_eq!(path.file_name().and_then(|x| x.to_str()), Some(".env"));
        }
    }

    #[test]
    fn seed_and_upgrade_fixtures_are_valid() {
        let career: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/terminal-career-v1.json")).unwrap();
        let upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v2-to-v3.json")).unwrap();
        let api_upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v3-to-v4.json")).unwrap();
        let auth_upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v4-to-v5.json")).unwrap();
        let progression_upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v5-to-v6.json")).unwrap();
        let throttle_upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v6-to-v7.json")).unwrap();
        let metrics_upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v7-to-v8.json")).unwrap();
        let assignment_upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v8-to-v9.json")).unwrap();
        let catalogue_upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v9-to-v10.json"))
                .unwrap();
        let pinning_upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v10-to-v11.json"))
                .unwrap();
        let cooperation_upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v11-to-v12.json"))
                .unwrap();
        let weekly_upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v12-to-v13.json"))
                .unwrap();
        let discipline_upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v13-to-v14.json"))
                .unwrap();
        let avatar_upgrade: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schema-upgrade-v14-to-v15.json"))
                .unwrap();
        assert_eq!(career["name"], "Fixture Detective");
        assert_eq!(upgrade["from_version"], 2);
        assert_eq!(upgrade["to_version"], 3);
        assert_eq!(api_upgrade["from_version"], 3);
        assert_eq!(api_upgrade["to_version"], 4);
        assert_eq!(auth_upgrade["from_version"], 4);
        assert_eq!(auth_upgrade["to_version"], 5);
        assert_eq!(progression_upgrade["from_version"], 5);
        assert_eq!(progression_upgrade["to_version"], 6);
        assert_eq!(throttle_upgrade["from_version"], 6);
        assert_eq!(throttle_upgrade["to_version"], 7);
        assert_eq!(metrics_upgrade["from_version"], 7);
        assert_eq!(metrics_upgrade["to_version"], 8);
        assert_eq!(assignment_upgrade["from_version"], 8);
        assert_eq!(assignment_upgrade["to_version"], 9);
        assert_eq!(catalogue_upgrade["from_version"], 9);
        assert_eq!(catalogue_upgrade["to_version"], 10);
        assert_eq!(pinning_upgrade["from_version"], 10);
        assert_eq!(pinning_upgrade["to_version"], 11);
        assert_eq!(cooperation_upgrade["from_version"], 11);
        assert_eq!(cooperation_upgrade["to_version"], 12);
        assert_eq!(weekly_upgrade["from_version"], 12);
        assert_eq!(weekly_upgrade["to_version"], 13);
        assert_eq!(discipline_upgrade["to_version"], 14);
        assert_eq!(avatar_upgrade["from_version"], 14);
        assert_eq!(avatar_upgrade["to_version"], 15);
    }

    #[test]
    fn live_mysql_migration_and_state_round_trip_when_enabled() {
        if env::var("NAIJACHASE_MYSQL_TEST").ok().as_deref() != Some("1") {
            return;
        }
        let _guard = MYSQL_TEST_LOCK.lock().unwrap();
        let store = std::sync::Arc::new(MysqlStore::connect_from_env().unwrap());
        store.migrate().unwrap();
        assert_eq!(store.schema_version().unwrap(), 15);
        let id = "storage-integration-test";
        let next = store.state_version(id).unwrap().unwrap_or(0) + 1;
        store.save(id, next, b"test-state").unwrap();
        assert_eq!(store.load(id).unwrap().unwrap(), b"test-state");

        let player_id = "storage-backup-fixture";
        let current = store
            .load_terminal_career(player_id)
            .unwrap()
            .map(|(version, _)| version)
            .unwrap_or(0);
        store
            .save_terminal_career(player_id, current + 1, b"fixture-career")
            .unwrap();
        let backup = env::temp_dir().join("naijachase-operational-backup-test.json");
        store.backup_operational(&backup).unwrap();
        store
            .save_terminal_career(player_id, current + 2, b"changed-career")
            .unwrap();
        store.restore_operational(&backup).unwrap();
        assert_eq!(
            store.load_terminal_career(player_id).unwrap().unwrap().1,
            b"fixture-career"
        );
        let _ = fs::remove_file(backup);
    }

    #[test]
    fn live_mysql_case_commands_are_owned_idempotent_and_concurrency_safe() {
        if env::var("NAIJACHASE_MYSQL_TEST").ok().as_deref() != Some("1") {
            return;
        }
        let _guard = MYSQL_TEST_LOCK.lock().unwrap();
        use naijachase_contracts::Command;
        use std::{
            collections::BTreeMap,
            sync::{Arc, Barrier},
        };
        let store = Arc::new(MysqlStore::connect_from_env().unwrap());
        store.migrate().unwrap();
        let case_id = "p35-storage-integration";
        {
            let mut connection = store.pool.get_conn().unwrap();
            connection
                .exec_drop(
                    "DELETE FROM service_audit WHERE case_id=:id",
                    params! {"id"=>case_id},
                )
                .unwrap();
            connection
                .exec_drop(
                    "DELETE FROM case_events WHERE case_id=:id",
                    params! {"id"=>case_id},
                )
                .unwrap();
            connection
                .exec_drop(
                    "DELETE FROM active_cases WHERE case_id=:id",
                    params! {"id"=>case_id},
                )
                .unwrap();
        }
        let state = GameState {
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
            economy: Default::default(),
        };
        store
            .create_case(case_id, "p35-owner", "NG-M0001", &state)
            .unwrap();
        assert!(matches!(
            store.load_owned_case(case_id, "intruder"),
            Err(StorageError::Forbidden)
        ));
        let applied = store
            .execute_case_command(case_id, "p35-owner", "command-1", 1, |state| {
                test_execute(state, Command::Wait { minutes: 10 })
            })
            .unwrap();
        assert!(matches!(
            applied,
            CaseCommandResult::Applied { version: 2, .. }
        ));
        let duplicate = store
            .execute_case_command(case_id, "p35-owner", "command-1", 1, |_| {
                panic!("duplicate command executed twice")
            })
            .unwrap();
        assert!(matches!(
            duplicate,
            CaseCommandResult::Duplicate { version: 2, .. }
        ));
        let failed = store.execute_case_command(case_id, "p35-owner", "invalid-command", 2, |_| {
            Err("rejected".into())
        });
        assert!(matches!(failed, Err(StorageError::Command(_))));
        assert_eq!(store.load_owned_case(case_id, "p35-owner").unwrap().0, 2);

        let barrier = Arc::new(Barrier::new(3));
        let mut workers = vec![];
        for suffix in ["a", "b"] {
            let store = store.clone();
            let barrier = barrier.clone();
            workers.push(std::thread::spawn(move || {
                barrier.wait();
                store.execute_case_command(
                    case_id,
                    "p35-owner",
                    &format!("concurrent-{suffix}"),
                    2,
                    |state| test_execute(state, Command::Wait { minutes: 1 }),
                )
            }));
        }
        barrier.wait();
        let results = workers
            .into_iter()
            .map(|worker| worker.join().unwrap())
            .collect::<Vec<_>>();
        assert_eq!(
            results
                .iter()
                .filter(|result| matches!(result, Ok(CaseCommandResult::Applied { .. })))
                .count(),
            1,
            "concurrent results: {results:?}"
        );
        assert_eq!(
            results
                .iter()
                .filter(|result| matches!(result, Err(StorageError::VersionConflict(_))))
                .count(),
            1,
            "concurrent results: {results:?}"
        );
        let restarted = MysqlStore::connect_from_env().unwrap();
        assert_eq!(
            restarted.load_owned_case(case_id, "p35-owner").unwrap().0,
            3
        );
    }

    #[test]
    fn live_mysql_pressure_is_idempotent_and_charges_once_when_enabled() {
        if env::var("NAIJACHASE_MYSQL_TEST").ok().as_deref() != Some("1") {
            return;
        }
        let _guard = MYSQL_TEST_LOCK.lock().unwrap();
        let store = std::sync::Arc::new(MysqlStore::connect_from_env().unwrap());
        store.migrate().unwrap();
        let suffix = uuid::Uuid::new_v4().simple().to_string();
        let player = format!("p391-{suffix}");
        let case_id = format!("p391-case-{suffix}");
        let command = format!("p391-command-{suffix}");
        store.pool.get_conn().unwrap().exec_drop("INSERT INTO players(player_id,display_name,bribe_tokens) VALUES (:player,'Pressure test',2)",params!{"player"=>&player}).unwrap();
        let state = GameState {
            version: 1,
            mission_id: "NG-M0001".into(),
            thief_id: "TH-001".into(),
            difficulty: 1,
            stage: 0,
            state: "LOC-001".into(),
            route: vec!["LOC-001".into(), "LOC-002".into()],
            elapsed: 0,
            score: 500,
            career_points: 0,
            dossier: Default::default(),
            observations: Default::default(),
            visited_venues: vec!["0|LOC-001|VEN-MARKET".into()],
            warrant_suspect: None,
            hideout_venue: "VEN-MARKET".into(),
            replay: vec![],
            outcome: None,
            economy: Default::default(),
        };
        store
            .create_case(&case_id, &player, "NG-M0001", &state)
            .unwrap();
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(3));
        let mut workers = vec![];
        for has_extra in [true, false] {
            let store = store.clone();
            let barrier = barrier.clone();
            let player = player.clone();
            let case_id = case_id.clone();
            let command = command.clone();
            workers.push(std::thread::spawn(move || {
                barrier.wait();
                store
                    .pressure_witness(
                        &player,
                        &case_id,
                        &command,
                        1,
                        "VEN-MARKET",
                        "bribe",
                        has_extra,
                        has_extra.then_some("A corroborating clue."),
                    )
                    .unwrap()
            }));
        }
        barrier.wait();
        let first = workers.remove(0).join().unwrap();
        let duplicate = workers.remove(0).join().unwrap();
        assert_eq!(first, duplicate);
        assert_eq!(first.token_balance, 1);
        assert_eq!(store.load_owned_case(&case_id, &player).unwrap().0, 2);
        let ledger:u64=store.pool.get_conn().unwrap().exec_first("SELECT COUNT(*) FROM bribe_token_ledger WHERE player_id=:player AND reference_id=:reference",params!{"player"=>&player,"reference"=>&command}).unwrap().unwrap();
        assert_eq!(ledger, 1);
    }

    #[test]
    fn live_mysql_completed_missions_are_excluded_and_replays_do_not_reward_twice() {
        if env::var("NAIJACHASE_MYSQL_TEST").ok().as_deref() != Some("1") {
            return;
        }
        let _guard = MYSQL_TEST_LOCK.lock().unwrap();
        use std::collections::BTreeMap;
        let store = MysqlStore::connect_from_env().unwrap();
        store.migrate().unwrap();
        let player = "p371-assignment-owner";
        let mission = "NG-M0002";
        let first_case = "p371-first";
        let replay_case = "p371-replay";
        {
            let mut connection = store.pool.get_conn().unwrap();
            connection
                .exec_drop(
                    "DELETE FROM bribe_token_ledger WHERE player_id=:player",
                    params! {"player"=>player},
                )
                .unwrap();
            connection
                .exec_drop(
                    "DELETE FROM active_cases WHERE player_id=:player",
                    params! {"player"=>player},
                )
                .unwrap();
            connection
                .exec_drop(
                    "DELETE FROM case_archive WHERE player_id=:player",
                    params! {"player"=>player},
                )
                .unwrap();
            connection
                .exec_drop(
                    "DELETE FROM player_mission_completions WHERE player_id=:player",
                    params! {"player"=>player},
                )
                .unwrap();
            connection
                .exec_drop(
                    "DELETE FROM careers WHERE player_id=:player",
                    params! {"player"=>player},
                )
                .unwrap();
            connection
                .exec_drop(
                    "DELETE FROM players WHERE player_id=:player",
                    params! {"player"=>player},
                )
                .unwrap();
        }
        let mut solved = GameState {
            version: 1,
            mission_id: mission.into(),
            thief_id: "NG-T001".into(),
            difficulty: 1,
            stage: 0,
            state: "Abia".into(),
            route: vec!["Abia".into(), "Kano".into()],
            elapsed: 100,
            score: 500,
            career_points: 500,
            dossier: BTreeMap::new(),
            observations: BTreeMap::new(),
            visited_venues: vec![],
            warrant_suspect: None,
            hideout_venue: "market".into(),
            replay: vec![],
            outcome: None,
            economy: Default::default(),
        };
        store
            .create_case_with_kind(first_case, player, mission, &solved, "ordinary")
            .unwrap();
        solved.outcome = Some("solved".into());
        let first_awards = store
            .record_case_completion(player, first_case, &solved)
            .unwrap();
        assert_eq!(first_awards.len(), 1);
        assert_eq!(first_awards[0].amount, 3);
        assert_eq!(
            first_awards[0].components,
            vec!["first_completion", "clean_route", "ethical_investigation"]
        );
        assert!(
            !store
                .unseen_published_missions(player)
                .unwrap()
                .contains(&mission.to_string())
        );
        assert!(matches!(
            store.create_case_with_kind("p371-repeat", player, mission, &solved, "ordinary"),
            Err(StorageError::MissionAlreadyCompleted)
        ));
        store
            .create_case_with_kind(replay_case, player, mission, &solved, "replay")
            .unwrap();
        let replay_awards = store
            .record_case_completion(player, replay_case, &solved)
            .unwrap();
        assert!(replay_awards.is_empty());
        assert_eq!(store.bribe_token_balance(player).unwrap().balance, 3);
        let archive = store.case_archive(player).unwrap();
        assert_eq!(
            archive
                .iter()
                .filter(|entry| entry.first_completion)
                .count(),
            1
        );
        assert_eq!(
            archive
                .iter()
                .filter(|entry| entry.attempt_kind == "replay")
                .count(),
            1
        );
        assert_eq!(store.progression_summary(player).unwrap().solved_cases, 1);
    }

    #[test]
    fn live_mysql_continuous_catalogue_validates_schedules_and_publishes() {
        if env::var("NAIJACHASE_MYSQL_TEST").ok().as_deref() != Some("1") {
            return;
        }
        let _guard = MYSQL_TEST_LOCK.lock().unwrap();
        let store = MysqlStore::connect_from_env().unwrap();
        store.migrate().unwrap();
        let player = "p372-content-admin";
        let mission = "NG-MTEST1";
        let mut connection = store.pool.get_conn().unwrap();
        connection
            .exec_drop(
                "DELETE FROM mission_lifecycle_audit WHERE mission_id=:mission",
                params! {"mission"=>mission},
            )
            .unwrap();
        connection
            .exec_drop(
                "DELETE FROM catalogue_release_notifications WHERE mission_id=:mission",
                params! {"mission"=>mission},
            )
            .unwrap();
        connection
            .exec_drop(
                "DELETE FROM missions WHERE mission_id=:mission",
                params! {"mission"=>mission},
            )
            .unwrap();
        connection.exec_drop("INSERT INTO players(player_id,display_name,content_role) VALUES (:player,:player,'admin') ON DUPLICATE KEY UPDATE content_role='admin'",params!{"player"=>player}).unwrap();
        connection.exec_drop("INSERT INTO missions(mission_id,difficulty,thief_id,start_location_id,stop_2_location_id,stop_3_location_id,capture_location_id,content_json,narrative_json,lifecycle_status,published_at) SELECT :mission,difficulty,thief_id,start_location_id,stop_2_location_id,stop_3_location_id,capture_location_id,content_json,narrative_json,'draft',NULL FROM missions WHERE mission_id='NG-M0003'",params!{"mission"=>mission}).unwrap();
        drop(connection);
        assert!(store.validate_mission(mission).unwrap().valid);
        store
            .transition_mission(player, mission, "editorial_review", None, "editor review")
            .unwrap();
        store
            .transition_mission(player, mission, "validated", None, "validation passed")
            .unwrap();
        store
            .transition_mission(
                player,
                mission,
                "scheduled",
                Some("2000-01-01 00:00:00"),
                "release test",
            )
            .unwrap();
        assert_eq!(store.publish_due_missions().unwrap(), 1);
        assert_eq!(store.runtime_mission(mission).unwrap().mission_id, mission);
        assert_eq!(
            store.mission_admin_details(mission).unwrap()["lifecycle_status"],
            "published"
        );
        assert!(store.catalogue_health(50).unwrap().published >= 1000);
        let mut connection = store.pool.get_conn().unwrap();
        connection
            .exec_drop(
                "DELETE FROM mission_lifecycle_audit WHERE mission_id=:mission",
                params! {"mission"=>mission},
            )
            .unwrap();
        connection
            .exec_drop(
                "DELETE FROM catalogue_release_notifications WHERE mission_id=:mission",
                params! {"mission"=>mission},
            )
            .unwrap();
        connection
            .exec_drop(
                "DELETE FROM missions WHERE mission_id=:mission",
                params! {"mission"=>mission},
            )
            .unwrap();
    }

    #[test]
    fn live_mysql_registration_confirmation_session_and_revocation() {
        if env::var("NAIJACHASE_MYSQL_TEST").ok().as_deref() != Some("1") {
            return;
        }
        let _guard = MYSQL_TEST_LOCK.lock().unwrap();
        let store = MysqlStore::connect_from_env().unwrap();
        store.migrate().unwrap();
        let player = "auth-integration-player";
        store
            .pool
            .get_conn()
            .unwrap()
            .exec_drop(
                "DELETE FROM players WHERE player_id=:id",
                params! {"id"=>player},
            )
            .unwrap();
        store
            .register_player(
                player,
                "auth-test@example.invalid",
                "auth_tester",
                "Lagos",
                "argon-hash",
                "verification-hash",
            )
            .unwrap();
        let (account, password) = store
            .login_record("auth-test@example.invalid")
            .unwrap()
            .unwrap();
        assert!(!account.email_verified);
        assert_eq!(password, "argon-hash");
        assert!(!store.verify_email("wrong-hash").unwrap());
        assert!(store.verify_email("verification-hash").unwrap());
        store
            .create_session(
                player,
                "session-hash",
                "family-1",
                Some("Integration browser"),
            )
            .unwrap();
        assert_eq!(
            store
                .authenticate_session("session-hash")
                .unwrap()
                .unwrap()
                .home_base,
            "Lagos"
        );
        store.revoke_session("session-hash").unwrap();
        assert!(
            store
                .authenticate_session("session-hash")
                .unwrap()
                .is_none()
        );
        store
            .create_session(player, "old-session", "family-2", None)
            .unwrap();
        assert!(store.rotate_session("old-session", "new-session").unwrap());
        assert!(store.authenticate_session("old-session").unwrap().is_none());
        assert!(store.authenticate_session("new-session").unwrap().is_some());
        assert!(
            !store
                .rotate_session("old-session", "attacker-session")
                .unwrap()
        );
        assert!(store.authenticate_session("new-session").unwrap().is_none());
        store
            .create_session(player, "recovery-session", "family-recovery", None)
            .unwrap();
        let sessions = store.sessions(player, "recovery-session").unwrap();
        assert!(sessions.iter().any(|session| session.current));
        let session_id = sessions
            .iter()
            .find(|session| session.current)
            .unwrap()
            .session_id
            .clone();
        assert!(store.revoke_session_id(player, &session_id).unwrap());
        store
            .create_session(player, "reset-session", "family-reset", None)
            .unwrap();
        store
            .update_profile(
                player,
                Some("Agent Ada"),
                Some("she/her"),
                Some("female"),
                Some("avatar-01"),
                Some("uniform-01"),
                "Abia",
                false,
            )
            .unwrap();
        assert_eq!(
            store
                .login_record("auth-test@example.invalid")
                .unwrap()
                .unwrap()
                .0
                .home_base,
            "Abia"
        );
        assert_eq!(
            store
                .create_password_reset("auth-test@example.invalid", "reset-hash")
                .unwrap(),
            Some(player.into())
        );
        assert!(
            store
                .complete_password_reset("reset-hash", "new-argon-hash")
                .unwrap()
        );
        assert!(
            store
                .authenticate_session("reset-session")
                .unwrap()
                .is_none()
        );
        store
            .create_session(player, "expiry-session", "family-3", None)
            .unwrap();
        store.pool.get_conn().unwrap().exec_drop("UPDATE player_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE token_hash='expiry-session'",()).unwrap();
        assert!(
            store
                .authenticate_session("expiry-session")
                .unwrap()
                .is_none()
        );
        store
            .security_event(Some(player), "profile_update", "success")
            .unwrap();
        let completed = GameState {
            version: 1,
            mission_id: "NG-M0001".into(),
            thief_id: "NG-T001".into(),
            difficulty: 1,
            stage: 0,
            state: "Abia".into(),
            route: vec!["Abia".into()],
            elapsed: 6000,
            score: 500,
            career_points: 1700,
            dossier: Default::default(),
            observations: Default::default(),
            visited_venues: vec![],
            warrant_suspect: Some("NG-T001".into()),
            hideout_venue: "market".into(),
            replay: vec![],
            outcome: Some("solved".into()),
            economy: Default::default(),
        };
        store
            .create_case_with_kind(
                "p37-archive-case",
                player,
                "NG-M0001",
                &completed,
                "ordinary",
            )
            .unwrap();
        store
            .record_case_completion(player, "p37-archive-case", &completed)
            .unwrap();
        assert!(
            store
                .case_archive(player)
                .unwrap()
                .iter()
                .any(|entry| entry.case_id == "p37-archive-case")
        );
        assert!(
            store
                .achievements(player)
                .unwrap()
                .iter()
                .any(|entry| entry.achievement_id == "first_case")
        );
        assert_eq!(store.career_points(player).unwrap(), 1700);
        let summary = store.progression_summary(player).unwrap();
        assert_eq!(summary.rank, "Investigator");
        assert_eq!(summary.solved_cases, 1);
        assert!(summary.visited_states.contains(&"Abia".into()));
        store.pool.get_conn().unwrap().exec_drop("DELETE FROM auth_rate_limits WHERE subject_hash='integration-subject' AND action='login'",()).unwrap();
        assert!(
            store
                .allow_auth_attempt("integration-subject", "login", 2)
                .unwrap()
        );
        assert!(
            store
                .allow_auth_attempt("integration-subject", "login", 2)
                .unwrap()
        );
        assert!(
            !store
                .allow_auth_attempt("integration-subject", "login", 2)
                .unwrap()
        );
    }

    #[test]
    fn live_mysql_cooperation_enforces_privacy_abuse_and_idempotency_when_enabled() {
        if env::var("NAIJACHASE_MYSQL_TEST").ok().as_deref() != Some("1") {
            return;
        }
        let _guard = MYSQL_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let store = MysqlStore::connect_from_env().unwrap();
        store.migrate().unwrap();
        let mut db = store.pool.get_conn().unwrap();
        db.query_drop("SET FOREIGN_KEY_CHECKS=0").unwrap();
        db.query_drop("DELETE FROM cooperation_audit WHERE actor_id IN ('coop-owner','coop-helper','coop-outsider')").unwrap();
        db.query_drop("DELETE FROM cooperation_requests WHERE case_id='coop-case'")
            .unwrap();
        db.query_drop("DELETE FROM cooperation_blocks WHERE blocker_id IN ('coop-owner','coop-helper','coop-outsider') OR blocked_id IN ('coop-owner','coop-helper','coop-outsider')").unwrap();
        for (id, name) in [
            ("coop-owner", "CoopOwner"),
            ("coop-helper", "CoopHelper"),
            ("coop-outsider", "CoopOutsider"),
        ] {
            db.exec_drop("INSERT INTO players(player_id,display_name,email,username,home_base,password_hash,email_verified_at,age_assurance_status,cooperation_enabled) VALUES (:id,:name,CONCAT(:id,'@example.test'),:name,'Lagos','x',UTC_TIMESTAMP(),'adult',TRUE) ON DUPLICATE KEY UPDATE username=VALUES(username),email_verified_at=UTC_TIMESTAMP(),age_assurance_status='adult',cooperation_enabled=TRUE",params!{"id"=>id,"name"=>name}).unwrap();
        }
        let missions: Vec<String> = db.query("SELECT mission_id FROM missions LIMIT 3").unwrap();
        for (index, mission) in missions.iter().enumerate() {
            db.exec_drop("INSERT IGNORE INTO player_mission_completions(player_id,mission_id,first_case_id,first_completed_at,best_score,best_elapsed_minutes) VALUES ('coop-helper',:mission,:case,UTC_TIMESTAMP(),500,100)",params!{"mission"=>mission,"case"=>format!("coop-finished-{index}")}).unwrap();
        }
        let mission = missions.first().unwrap();
        db.exec_drop("INSERT INTO active_cases(case_id,player_id,mission_id,version,state_json,attempt_kind,content_version) VALUES ('coop-case','coop-owner',:mission,1,'{}','ordinary',1) ON DUPLICATE KEY UPDATE player_id='coop-owner'",params!{"mission"=>mission}).unwrap();
        db.query_drop("SET FOREIGN_KEY_CHECKS=1").unwrap();
        drop(db);
        let id = store
            .create_cooperation_request(
                "coop-owner",
                "CoopHelper",
                "coop-case",
                "market",
                "coop-command",
                &serde_json::json!({"venue_id":"market"}),
            )
            .unwrap();
        assert!(
            store
                .create_cooperation_request(
                    "coop-owner",
                    "CoopHelper",
                    "coop-case",
                    "market",
                    "coop-command-2",
                    &serde_json::json!({})
                )
                .is_err()
        );
        assert!(
            store
                .transition_cooperation_request("coop-outsider", &id, "accept", None)
                .is_err()
        );
        store
            .transition_cooperation_request("coop-helper", &id, "accept", None)
            .unwrap();
        assert!(
            store
                .transition_cooperation_request("coop-helper", &id, "accept", None)
                .is_err()
        );
        store.cooperation_block("coop-owner", "CoopHelper").unwrap();
        assert_eq!(
            store.cooperation_requests("coop-owner").unwrap()[0].status,
            "cancelled"
        );
        assert!(
            store
                .cooperation_report(
                    "coop-owner",
                    "CoopHelper",
                    "harassment",
                    Some(&"x".repeat(501))
                )
                .is_err()
        );
    }

    #[test]
    fn live_mysql_weekly_schedule_transit_and_single_winner_when_enabled() {
        if env::var("NAIJACHASE_MYSQL_TEST").ok().as_deref() != Some("1") {
            return;
        }
        let _guard = MYSQL_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let store = MysqlStore::connect_from_env().unwrap();
        store.migrate().unwrap();
        let mut db = store.pool.get_conn().unwrap();
        let suffix = uuid::Uuid::new_v4().simple().to_string();
        let owner = format!("wo-{}", &suffix[..12]);
        let helper = format!("wh-{}", &suffix[..12]);
        let owner_name = format!("WO{}", &suffix[..8]);
        let helper_name = format!("WH{}", &suffix[..8]);
        for (id, name) in [(&owner, &owner_name), (&helper, &helper_name)] {
            db.exec_drop("INSERT INTO players(player_id,display_name,email,username,home_base,password_hash,email_verified_at,age_assurance_status) VALUES(:id,:name,CONCAT(:id,'@test.invalid'),:name,'Lagos','x',UTC_TIMESTAMP(),'adult')",params!{"id"=>id,"name"=>name}).unwrap();
        }
        drop(db);
        let group = store
            .create_group(&owner, &format!("Weekly {}", &suffix[..8]), 4)
            .unwrap();
        let invite = store
            .invite_group_member(&owner, &group, &helper_name)
            .unwrap();
        store
            .respond_group_invitation(&helper, &invite, true)
            .unwrap();
        let mission: String = store
            .pool
            .get_conn()
            .unwrap()
            .query_first("SELECT mission_id FROM missions LIMIT 1")
            .unwrap()
            .unwrap();
        let state = GameState {
            version: 1,
            mission_id: mission.clone(),
            thief_id: "T".into(),
            difficulty: 1,
            stage: 0,
            state: "Lagos".into(),
            route: vec!["Lagos".into(), "Kano".into()],
            elapsed: 0,
            score: 500,
            career_points: 0,
            dossier: Default::default(),
            observations: [("sex".into(), "male".into())].into(),
            visited_venues: vec![],
            warrant_suspect: None,
            hideout_venue: "market".into(),
            replay: vec![],
            outcome: None,
            economy: naijachase_contracts::CaseEconomy {
                rules_version: 1,
                opening_budget: 5000,
                balance: 5000,
                ledger: vec![],
            },
        };
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let challenge = store
            .schedule_weekly_challenge(&group, now - 60, now + 3600, &mission, 1, 7, &state)
            .unwrap();
        assert_eq!(
            challenge,
            store
                .schedule_weekly_challenge(&group, now - 60, now + 3600, &mission, 1, 7, &state)
                .unwrap()
        );
        let first = store.start_weekly_attempt(&owner, &challenge).unwrap();
        let second = store.start_weekly_attempt(&helper, &challenge).unwrap();
        assert!(store.weekly_attempt("intruder", &first).is_err());
        let mut arrival = state.clone();
        arrival.economy.balance = 4900;
        arrival.state = "Kano".into();
        let transit = store
            .depart_weekly(
                &owner,
                &first,
                "weekly-travel",
                "Kano",
                "drive",
                100,
                1,
                &arrival,
            )
            .unwrap();
        assert!(store.execute_weekly(&owner, &first, 2, |s| Ok(s)).is_err());
        store.pool.get_conn().unwrap().exec_drop("UPDATE weekly_transits SET arrives_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE transit_id=:id",params!{"id"=>transit}).unwrap();
        assert!(store.complete_weekly_arrival(&owner, &first).unwrap());
        assert_eq!(
            store.weekly_attempt(&owner, &first).unwrap().state.state,
            "Kano"
        );
        let won = store
            .execute_weekly(&owner, &first, 3, |mut s| {
                s.outcome = Some("solved".into());
                Ok(s)
            })
            .unwrap();
        assert!(won.winner);
        assert!(
            store
                .execute_weekly(&helper, &second, 1, |s| Ok(s))
                .is_err()
        );
        let details = store.weekly_challenge_details(&owner, &challenge).unwrap();
        assert_eq!(details["winner_attempt_id"], first);
        assert_eq!(store.expire_weekly_challenges().unwrap(), 0);
    }

    fn test_execute(
        state: GameState,
        command: naijachase_contracts::Command,
    ) -> Result<(GameState, Vec<Event>), String> {
        let mut next = state;
        if let naijachase_contracts::Command::Wait { minutes } = command {
            next.elapsed += minutes;
            Ok((
                next,
                vec![Event {
                    event_type: "waited".into(),
                    data: Default::default(),
                }],
            ))
        } else {
            Err("unsupported test command".into())
        }
    }
}
