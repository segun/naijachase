ALTER TABLE missions
    ADD COLUMN lifecycle_status ENUM('draft','editorial_review','validated','scheduled','published','retired') NOT NULL DEFAULT 'draft',
    ADD COLUMN content_version INT UNSIGNED NOT NULL DEFAULT 1,
    ADD COLUMN published_at TIMESTAMP NULL,
    ADD KEY idx_mission_publication (lifecycle_status, published_at);

UPDATE missions SET lifecycle_status='published', published_at=COALESCE(published_at, UTC_TIMESTAMP());

ALTER TABLE active_cases
    ADD COLUMN attempt_kind ENUM('ordinary','replay','weekly') NOT NULL DEFAULT 'ordinary',
    ADD KEY idx_active_player_kind (player_id, attempt_kind);

ALTER TABLE case_archive
    ADD COLUMN attempt_kind ENUM('ordinary','replay','weekly') NOT NULL DEFAULT 'ordinary',
    ADD COLUMN first_completion BOOLEAN NOT NULL DEFAULT FALSE,
    ADD KEY idx_archive_player_mission (player_id, mission_id, completed_at);

CREATE TABLE IF NOT EXISTS player_mission_completions (
    player_id VARCHAR(64) NOT NULL,
    mission_id VARCHAR(32) NOT NULL,
    first_case_id VARCHAR(64) NOT NULL,
    first_completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    best_score INT UNSIGNED NOT NULL,
    best_elapsed_minutes INT UNSIGNED NOT NULL,
    replay_count INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, mission_id),
    CONSTRAINT fk_completion_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE CASCADE,
    CONSTRAINT fk_completion_mission FOREIGN KEY (mission_id)
        REFERENCES missions(mission_id),
    KEY idx_completion_player_time (player_id, first_completed_at)
) ENGINE=InnoDB;

INSERT IGNORE INTO player_mission_completions
    (player_id, mission_id, first_case_id, first_completed_at,
     best_score, best_elapsed_minutes)
SELECT player_id, mission_id,
       SUBSTRING_INDEX(GROUP_CONCAT(case_id ORDER BY completed_at, archive_id), ',', 1),
       MIN(completed_at), MAX(score),
       MIN(elapsed_minutes)
FROM case_archive
WHERE outcome = 'solved'
GROUP BY player_id, mission_id;

UPDATE case_archive a
JOIN player_mission_completions c
  ON c.player_id = a.player_id AND c.first_case_id = a.case_id
SET a.first_completion = TRUE
WHERE a.outcome = 'solved';

CREATE TABLE IF NOT EXISTS active_mission_assignments (
    player_id VARCHAR(64) NOT NULL,
    mission_id VARCHAR(32) NOT NULL,
    case_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id, mission_id),
    UNIQUE KEY uq_assignment_case (case_id),
    CONSTRAINT fk_assignment_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE CASCADE,
    CONSTRAINT fk_assignment_mission FOREIGN KEY (mission_id)
        REFERENCES missions(mission_id),
    CONSTRAINT fk_assignment_case FOREIGN KEY (case_id)
        REFERENCES active_cases(case_id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES (9);
