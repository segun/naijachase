ALTER TABLE players
    ADD COLUMN pronouns VARCHAR(64) NULL,
    ADD COLUMN sex VARCHAR(32) NULL,
    ADD COLUMN avatar_id VARCHAR(64) NULL,
    ADD COLUMN uniform_id VARCHAR(64) NULL,
    ADD COLUMN leaderboard_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE player_sessions
    ADD COLUMN family_id CHAR(36) NULL,
    ADD COLUMN rotated_from CHAR(64) NULL,
    ADD COLUMN replaced_at TIMESTAMP NULL,
    ADD KEY idx_session_family (family_id, revoked_at);

CREATE TABLE IF NOT EXISTS password_resets (
    token_hash CHAR(64) PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reset_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE CASCADE,
    KEY idx_reset_player (player_id, expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS security_events (
    event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(64) NULL,
    event_type VARCHAR(64) NOT NULL,
    outcome VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_security_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE SET NULL,
    KEY idx_security_player (player_id, created_at),
    KEY idx_security_type (event_type, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS case_archive (
    archive_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    case_id VARCHAR(64) NOT NULL,
    mission_id VARCHAR(32) NOT NULL,
    thief_id VARCHAR(32) NOT NULL,
    outcome VARCHAR(32) NOT NULL,
    score INT UNSIGNED NOT NULL,
    elapsed_minutes INT UNSIGNED NOT NULL,
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_archive_case (case_id),
    CONSTRAINT fk_archive_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE CASCADE,
    KEY idx_archive_player (player_id, completed_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS player_achievements (
    player_id VARCHAR(64) NOT NULL,
    achievement_id VARCHAR(64) NOT NULL,
    earned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id, achievement_id),
    CONSTRAINT fk_achievement_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES (6);
