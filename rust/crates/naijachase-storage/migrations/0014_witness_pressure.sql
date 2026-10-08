ALTER TABLE players
    ADD COLUMN bribe_tokens INT UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE rank_history
    ADD COLUMN reason VARCHAR(64) NOT NULL DEFAULT 'progression';

CREATE TABLE bribe_token_ledger (
    ledger_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    amount INT NOT NULL,
    balance_after INT UNSIGNED NOT NULL,
    reason VARCHAR(64) NOT NULL,
    reference_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bribe_token_reference(player_id,reason,reference_id),
    KEY idx_bribe_token_player(player_id,created_at),
    CONSTRAINT fk_bribe_token_player FOREIGN KEY(player_id) REFERENCES players(player_id)
) ENGINE=InnoDB;

CREATE TABLE witness_pressure_attempts (
    attempt_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    case_id VARCHAR(64) NOT NULL,
    command_id VARCHAR(64) NOT NULL,
    stage TINYINT UNSIGNED NOT NULL,
    venue_id VARCHAR(64) NOT NULL,
    method ENUM('bribe','intimidate') NOT NULL,
    had_extra_clue BOOLEAN NOT NULL,
    offence_type ENUM('none','witness_tampering','excessive_use_of_force') NOT NULL,
    detection_numerator TINYINT UNSIGNED NULL,
    detection_denominator TINYINT UNSIGNED NULL,
    detection_roll TINYINT UNSIGNED NULL,
    detected BOOLEAN NOT NULL,
    result_json JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pressure_command(player_id,command_id),
    UNIQUE KEY uq_pressure_witness(case_id,stage,venue_id),
    CONSTRAINT fk_pressure_player FOREIGN KEY(player_id) REFERENCES players(player_id),
    CONSTRAINT fk_pressure_case FOREIGN KEY(case_id) REFERENCES active_cases(case_id)
) ENGINE=InnoDB;

CREATE TABLE disciplinary_cases (
    disciplinary_case_id CHAR(36) PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    pressure_attempt_id BIGINT UNSIGNED NOT NULL,
    offence_type ENUM('witness_tampering','excessive_use_of_force') NOT NULL,
    prior_offence_count INT UNSIGNED NOT NULL,
    decision ENUM('warning','punish') NOT NULL,
    punishment ENUM('none','points_deducted','demoted','jailed') NOT NULL,
    points_before INT UNSIGNED NOT NULL,
    points_after INT UNSIGNED NOT NULL,
    old_rank VARCHAR(64) NOT NULL,
    new_rank VARCHAR(64) NOT NULL,
    jailed_until TIMESTAMP NULL,
    rules_version SMALLINT UNSIGNED NOT NULL,
    acknowledged_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_panel_attempt(pressure_attempt_id),
    KEY idx_panel_player(player_id,created_at),
    CONSTRAINT fk_panel_player FOREIGN KEY(player_id) REFERENCES players(player_id),
    CONSTRAINT fk_panel_attempt FOREIGN KEY(pressure_attempt_id) REFERENCES witness_pressure_attempts(attempt_id)
) ENGINE=InnoDB;

CREATE TABLE disciplinary_votes (
    disciplinary_case_id CHAR(36) NOT NULL,
    panel_position TINYINT UNSIGNED NOT NULL,
    vote ENUM('warning','punish') NOT NULL,
    PRIMARY KEY(disciplinary_case_id,panel_position),
    CONSTRAINT fk_vote_case FOREIGN KEY(disciplinary_case_id) REFERENCES disciplinary_cases(disciplinary_case_id)
) ENGINE=InnoDB;

CREATE TABLE disciplinary_events (
    event_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    case_id VARCHAR(64) NOT NULL,
    pressure_attempt_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    event_json JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_discipline_player(player_id,created_at),
    CONSTRAINT fk_discipline_event_player FOREIGN KEY(player_id) REFERENCES players(player_id),
    CONSTRAINT fk_discipline_event_attempt FOREIGN KEY(pressure_attempt_id) REFERENCES witness_pressure_attempts(attempt_id)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES(14);
