CREATE TABLE IF NOT EXISTS schema_migrations (
    version INT UNSIGNED PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS content_imports (
    file_path VARCHAR(512) PRIMARY KEY,
    sha256 CHAR(64) NOT NULL,
    row_count BIGINT UNSIGNED NOT NULL,
    imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS locations (
    location_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location_type VARCHAR(64) NOT NULL,
    state_or_territory VARCHAR(128) NOT NULL,
    region VARCHAR(64) NOT NULL,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    game_tags TEXT NOT NULL,
    knowledge_hooks TEXT NOT NULL,
    source TEXT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS knowledge (
    knowledge_id VARCHAR(32) PRIMARY KEY,
    domain VARCHAR(64) NOT NULL,
    topic VARCHAR(128) NOT NULL,
    fact TEXT NOT NULL,
    answer TEXT NOT NULL,
    difficulty TINYINT UNSIGNED NOT NULL,
    clue_forms TEXT NOT NULL,
    source TEXT NOT NULL,
    refresh_policy VARCHAR(128) NOT NULL,
    CONSTRAINT chk_knowledge_difficulty CHECK (difficulty BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS location_knowledge (
    location_id VARCHAR(32) NOT NULL,
    knowledge_id VARCHAR(32) NOT NULL,
    relation_type VARCHAR(64) NOT NULL,
    weight INT NOT NULL,
    PRIMARY KEY (location_id, knowledge_id, relation_type),
    CONSTRAINT fk_lk_location FOREIGN KEY (location_id) REFERENCES locations(location_id),
    CONSTRAINT fk_lk_knowledge FOREIGN KEY (knowledge_id) REFERENCES knowledge(knowledge_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS thieves (
    thief_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    alias VARCHAR(255) NOT NULL UNIQUE,
    profile_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS venues (
    venue_id VARCHAR(64) PRIMARY KEY,
    venue_name VARCHAR(255) NOT NULL,
    opens_hour TINYINT UNSIGNED NOT NULL,
    closes_hour TINYINT UNSIGNED NOT NULL,
    interview_minutes INT UNSIGNED NOT NULL,
    witness_roles TEXT NOT NULL,
    experience_json JSON NOT NULL,
    CONSTRAINT chk_venue_hours CHECK (opens_hour <= 23 AND closes_hour <= 24)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS missions (
    mission_id VARCHAR(32) PRIMARY KEY,
    difficulty TINYINT UNSIGNED NOT NULL,
    thief_id VARCHAR(32) NOT NULL,
    start_location_id VARCHAR(32) NOT NULL,
    stop_2_location_id VARCHAR(32) NOT NULL,
    stop_3_location_id VARCHAR(32) NOT NULL,
    capture_location_id VARCHAR(32) NOT NULL,
    content_json JSON NOT NULL,
    narrative_json JSON NOT NULL,
    KEY idx_missions_thief (thief_id),
    CONSTRAINT fk_mission_thief FOREIGN KEY (thief_id) REFERENCES thieves(thief_id),
    CONSTRAINT fk_mission_start FOREIGN KEY (start_location_id) REFERENCES locations(location_id),
    CONSTRAINT fk_mission_stop2 FOREIGN KEY (stop_2_location_id) REFERENCES locations(location_id),
    CONSTRAINT fk_mission_stop3 FOREIGN KEY (stop_3_location_id) REFERENCES locations(location_id),
    CONSTRAINT fk_mission_capture FOREIGN KEY (capture_location_id) REFERENCES locations(location_id),
    CONSTRAINT chk_mission_difficulty CHECK (difficulty BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clue_atoms (
    atom_id VARCHAR(96) PRIMARY KEY,
    state VARCHAR(128) NOT NULL,
    venue_id VARCHAR(64) NOT NULL,
    candidate_states TEXT NOT NULL,
    knowledge_id VARCHAR(32),
    content_json JSON NOT NULL,
    KEY idx_clue_atoms_state (state),
    CONSTRAINT fk_atom_venue FOREIGN KEY (venue_id) REFERENCES venues(venue_id),
    CONSTRAINT fk_atom_knowledge FOREIGN KEY (knowledge_id) REFERENCES knowledge(knowledge_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dialogue_variants (
    variant_id VARCHAR(128) PRIMARY KEY,
    atom_id VARCHAR(96) NOT NULL,
    difficulty VARCHAR(16) NOT NULL,
    speech_register VARCHAR(32) NOT NULL,
    variant_number TINYINT UNSIGNED NOT NULL,
    dialogue TEXT NOT NULL,
    UNIQUE KEY uq_dialogue_variant (atom_id, difficulty, speech_register, variant_number),
    CONSTRAINT fk_variant_atom FOREIGN KEY (atom_id) REFERENCES clue_atoms(atom_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS players (
    player_id VARCHAR(64) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS careers (
    player_id VARCHAR(64) PRIMARY KEY,
    points BIGINT UNSIGNED NOT NULL DEFAULT 0,
    solved_missions_json JSON NOT NULL,
    version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_active_cases_player (player_id),
    CONSTRAINT fk_career_player FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS active_cases (
    case_id VARCHAR(64) PRIMARY KEY,
    player_id VARCHAR(64),
    mission_id VARCHAR(32),
    version BIGINT UNSIGNED NOT NULL,
    state_json LONGBLOB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_case_player FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
    CONSTRAINT fk_case_mission FOREIGN KEY (mission_id) REFERENCES missions(mission_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS case_events (
    event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL,
    command_id VARCHAR(64) NOT NULL,
    state_version BIGINT UNSIGNED NOT NULL,
    event_json JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_case_command (case_id, command_id),
    KEY idx_case_events_case (case_id, event_id),
    CONSTRAINT fk_event_case FOREIGN KEY (case_id) REFERENCES active_cases(case_id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES (1);
