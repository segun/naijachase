ALTER TABLE player_sessions
    ADD COLUMN session_id CHAR(36) NULL,
    ADD COLUMN device_label VARCHAR(160) NULL;
UPDATE player_sessions SET session_id=UUID() WHERE session_id IS NULL;
ALTER TABLE player_sessions
    MODIFY COLUMN session_id CHAR(36) NOT NULL,
    ADD UNIQUE KEY uq_session_id (session_id);

ALTER TABLE case_archive
    ADD COLUMN states_visited_json JSON NULL,
    ADD COLUMN correct_travels INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN wrong_travels INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN correct_deductions INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN wrong_deductions INT UNSIGNED NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS player_state_visits (
    player_id VARCHAR(64) NOT NULL,
    state_name VARCHAR(128) NOT NULL,
    first_visited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id,state_name),
    CONSTRAINT fk_state_visit_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rank_history (
    rank_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    old_rank VARCHAR(64) NOT NULL,
    new_rank VARCHAR(64) NOT NULL,
    points BIGINT UNSIGNED NOT NULL,
    earned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rank_history_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE CASCADE,
    KEY idx_rank_history_player (player_id,earned_at)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES (8);
