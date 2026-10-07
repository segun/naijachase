use mysql::{OptsBuilder, Pool, TxOpts, params, prelude::Queryable};
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

const MIGRATION_1: &str = include_str!("../migrations/0001_initial.sql");
const MIGRATION_2: &str = include_str!("../migrations/0002_content_and_terminal.sql");
const MIGRATION_3: &str = include_str!("../migrations/0003_thief_alias_index.sql");
const MIGRATION_4: &str = include_str!("../migrations/0004_api_audit.sql");
const MIGRATION_5: &str = include_str!("../migrations/0005_player_auth.sql");
const MIGRATION_6: &str = include_str!("../migrations/0006_identity_progression.sql");
const MIGRATION_7: &str = include_str!("../migrations/0007_auth_rate_limits.sql");
const MIGRATION_8: &str = include_str!("../migrations/0008_progression_sessions.sql");

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
        Ok(Self {
            host: required(&mut lookup, "MYSQL_HOST")?,
            port: required(&mut lookup, "MYSQL_PORT")?.parse()?,
            user: required(&mut lookup, "MYSQL_USER")?,
            password: required(&mut lookup, "MYSQL_PASSWORD")?,
            database: required(&mut lookup, "MYSQL_DATABASE")?,
        })
    }

    fn options(&self) -> OptsBuilder {
        OptsBuilder::new()
            .ip_or_hostname(Some(self.host.clone()))
            .tcp_port(self.port)
            .user(Some(self.user.clone()))
            .pass(Some(self.password.clone()))
            .db_name(Some(self.database.clone()))
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
    dotenvy::from_path(&path)?;
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
            bool,
        );
        let row: Option<LoginRow> = self.pool.get_conn()?.exec_first(
            "SELECT player_id,email,username,home_base,password_hash,email_verified_at IS NOT NULL,
                        display_name,pronouns,sex,avatar_id,uniform_id,leaderboard_opt_in
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
                leaderboard_opt_in,
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
                        leaderboard_opt_in,
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
        );
        let mut connection = self.pool.get_conn()?;
        let row: Option<AccountRow> = connection.exec_first(
            "SELECT p.player_id,p.email,p.username,p.home_base,TRUE,p.display_name,
                        p.pronouns,p.sex,p.avatar_id,p.uniform_id,p.leaderboard_opt_in
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

    pub fn record_case_completion(
        &self,
        player_id: &str,
        case_id: &str,
        state: &GameState,
    ) -> Result<(), StorageError> {
        let Some(outcome) = state.outcome.as_deref() else {
            return Ok(());
        };
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let (states, correct_travels, wrong_travels, correct_deductions, wrong_deductions) =
            case_metrics(state);
        let states_json = serde_json::to_string(&states)?;
        transaction.exec_drop(
            "INSERT IGNORE INTO case_archive(player_id,case_id,mission_id,thief_id,outcome,score,elapsed_minutes,states_visited_json,correct_travels,wrong_travels,correct_deductions,wrong_deductions) VALUES (:player,:case_id,:mission,:thief,:outcome,:score,:elapsed,:states,:correct_travels,:wrong_travels,:correct_deductions,:wrong_deductions)",
            params!{"player"=>player_id,"case_id"=>case_id,"mission"=>&state.mission_id,"thief"=>&state.thief_id,"outcome"=>outcome,"score"=>state.score,"elapsed"=>state.elapsed,"states"=>&states_json,"correct_travels"=>correct_travels,"wrong_travels"=>wrong_travels,"correct_deductions"=>correct_deductions,"wrong_deductions"=>wrong_deductions})?;
        for state_name in &states {
            transaction.exec_drop("INSERT IGNORE INTO player_state_visits(player_id,state_name) VALUES (:player,:state)",params!{"player"=>player_id,"state"=>state_name})?;
        }
        if outcome == "solved" {
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
            let solved:u64=transaction.exec_first("SELECT COUNT(*) FROM case_archive WHERE player_id=:player AND outcome='solved'",params!{"player"=>player_id})?.unwrap_or(0);
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
            }
            if visited >= 37 {
                transaction.exec_drop("INSERT IGNORE INTO player_achievements(player_id,achievement_id) VALUES (:player,'national_investigator')",params!{"player"=>player_id})?;
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
        Ok(())
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
        let rows:Vec<Row>=self.pool.get_conn()?.exec("SELECT case_id,mission_id,thief_id,outcome,score,elapsed_minutes,CAST(completed_at AS CHAR),CAST(states_visited_json AS CHAR),correct_travels,wrong_travels,correct_deductions,wrong_deductions FROM case_archive WHERE player_id=:player ORDER BY completed_at DESC",params!{"player"=>player_id})?;
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
                )| CaseArchiveEntry {
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
                },
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
                "SELECT COUNT(*) FROM case_archive WHERE player_id=:player AND outcome='solved'",
                params! {"player"=>player_id},
            )?
            .unwrap_or(0);
        let visited_states:Vec<String>=connection.exec_map("SELECT state_name FROM player_state_visits WHERE player_id=:player ORDER BY state_name",params!{"player"=>player_id},|state|state)?;
        let totals:Option<(u64,u64,u64,u64)>=connection.exec_first("SELECT COALESCE(SUM(correct_travels),0),COALESCE(SUM(wrong_travels),0),COALESCE(SUM(correct_deductions),0),COALESCE(SUM(wrong_deductions),0) FROM case_archive WHERE player_id=:player",params!{"player"=>player_id})?;
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
        let data = serde_json::to_vec(state)?;
        let mut connection = self.pool.get_conn()?;
        let mut transaction = connection.start_transaction(TxOpts::default())?;
        let existing: Option<String> = transaction.exec_first(
            "SELECT player_id FROM active_cases WHERE case_id=:case_id FOR UPDATE",
            params! { "case_id" => case_id },
        )?;
        match existing {
            Some(owner) if owner == player_id => return Ok(1),
            Some(_) => return Err(StorageError::Forbidden),
            None => {}
        }
        transaction.exec_drop(
            "INSERT INTO players(player_id,display_name) VALUES (:player,:player)
             ON DUPLICATE KEY UPDATE player_id=VALUES(player_id)",
            params! { "player" => player_id },
        )?;
        transaction.exec_drop(
            "INSERT INTO active_cases(case_id,player_id,mission_id,version,state_json)
             VALUES (:case_id,:player,:mission,1,:state)",
            params! { "case_id"=>case_id,"player"=>player_id,"mission"=>mission_id,"state"=>data },
        )?;
        transaction.exec_drop(
            "INSERT INTO service_audit(player_id,case_id,command_id,outcome)
             VALUES (:player,:case_id,'case-created','created')",
            params! { "player"=>player_id,"case_id"=>case_id },
        )?;
        transaction.commit()?;
        Ok(1)
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
            format_version: 4,
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
        };
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, serde_json::to_vec_pretty(&backup)?)?;
        Ok(())
    }

    pub fn restore_operational(&self, path: &Path) -> Result<(), StorageError> {
        let backup: OperationalBackup = serde_json::from_slice(&fs::read(path)?)?;
        if !matches!(backup.format_version, 1 | 2 | 3 | 4) {
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
        transaction.commit()?;
        Ok(())
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
    }

    #[test]
    fn live_mysql_migration_and_state_round_trip_when_enabled() {
        if env::var("NAIJACHASE_MYSQL_TEST").ok().as_deref() != Some("1") {
            return;
        }
        let _guard = MYSQL_TEST_LOCK.lock().unwrap();
        let store = MysqlStore::connect_from_env().unwrap();
        store.migrate().unwrap();
        assert_eq!(store.schema_version().unwrap(), 8);
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
        };
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
