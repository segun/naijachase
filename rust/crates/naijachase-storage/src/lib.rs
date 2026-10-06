use mysql::{OptsBuilder, Pool, TxOpts, params, prelude::Queryable};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    env, fs,
    num::ParseIntError,
    path::{Path, PathBuf},
};
use thiserror::Error;

const MIGRATION_1: &str = include_str!("../migrations/0001_initial.sql");
const MIGRATION_2: &str = include_str!("../migrations/0002_content_and_terminal.sql");
const MIGRATION_3: &str = include_str!("../migrations/0003_thief_alias_index.sql");

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContentImportSummary {
    pub files: usize,
    pub rows: usize,
}

type PreparedCsv = (String, String, Vec<String>, Vec<Vec<String>>);

#[derive(Debug, Serialize, Deserialize)]
struct OperationalBackup {
    format_version: u32,
    players: Vec<(String, String)>,
    careers: Vec<(String, u64, String, u64)>,
    terminal_careers: Vec<(String, u64, Vec<u8>)>,
    active_cases: Vec<(String, Option<String>, Option<String>, u64, Vec<u8>)>,
    case_events: Vec<(String, String, u64, String)>,
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
        Ok(())
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
            format_version: 1,
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
        };
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, serde_json::to_vec_pretty(&backup)?)?;
        Ok(())
    }

    pub fn restore_operational(&self, path: &Path) -> Result<(), StorageError> {
        let backup: OperationalBackup = serde_json::from_slice(&fs::read(path)?)?;
        if backup.format_version != 1 {
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
        assert_eq!(career["name"], "Fixture Detective");
        assert_eq!(upgrade["from_version"], 2);
        assert_eq!(upgrade["to_version"], 3);
    }

    #[test]
    fn live_mysql_migration_and_state_round_trip_when_enabled() {
        if env::var("NAIJACHASE_MYSQL_TEST").ok().as_deref() != Some("1") {
            return;
        }
        let store = MysqlStore::connect_from_env().unwrap();
        store.migrate().unwrap();
        assert_eq!(store.schema_version().unwrap(), 3);
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
}
