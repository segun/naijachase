ALTER TABLE players
    ADD COLUMN cooperation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN cooperation_email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN age_assurance_status ENUM('unknown','adult','minor') NOT NULL DEFAULT 'unknown',
    ADD COLUMN cooperation_reputation INT UNSIGNED NOT NULL DEFAULT 0;

CREATE TABLE cooperation_blocks (
    blocker_id VARCHAR(64) NOT NULL,
    blocked_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id,blocked_id),
    CONSTRAINT fk_coop_blocker FOREIGN KEY (blocker_id) REFERENCES players(player_id) ON DELETE CASCADE,
    CONSTRAINT fk_coop_blocked FOREIGN KEY (blocked_id) REFERENCES players(player_id) ON DELETE CASCADE,
    CHECK (blocker_id <> blocked_id)
) ENGINE=InnoDB;

CREATE TABLE cooperation_requests (
    request_id CHAR(36) PRIMARY KEY,
    command_id VARCHAR(64) NOT NULL,
    owner_id VARCHAR(64) NOT NULL,
    helper_id VARCHAR(64) NOT NULL,
    case_id VARCHAR(64) NOT NULL,
    venue_id VARCHAR(64) NOT NULL,
    status ENUM('pending','accepted','completed','acknowledged','declined','cancelled','expired') NOT NULL DEFAULT 'pending',
    public_scene_json JSON NOT NULL,
    recommendation_json JSON NULL,
    reward_granted BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_coop_owner_command (owner_id,command_id),
    UNIQUE KEY uq_coop_case_helper (case_id,helper_id),
    KEY idx_coop_helper_status (helper_id,status,expires_at),
    CONSTRAINT fk_coop_owner FOREIGN KEY (owner_id) REFERENCES players(player_id) ON DELETE CASCADE,
    CONSTRAINT fk_coop_helper FOREIGN KEY (helper_id) REFERENCES players(player_id) ON DELETE CASCADE,
    CONSTRAINT fk_coop_case FOREIGN KEY (case_id) REFERENCES active_cases(case_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cooperation_reports (
    report_id CHAR(36) PRIMARY KEY,
    reporter_id VARCHAR(64) NOT NULL,
    reported_id VARCHAR(64) NOT NULL,
    category ENUM('spam','harassment','abusive_username','cheating','other') NOT NULL,
    details VARCHAR(500) NULL,
    status ENUM('open','reviewing','resolved','dismissed') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_coop_reporter FOREIGN KEY (reporter_id) REFERENCES players(player_id) ON DELETE CASCADE,
    CONSTRAINT fk_coop_reported FOREIGN KEY (reported_id) REFERENCES players(player_id) ON DELETE CASCADE,
    KEY idx_coop_reports_status (status,created_at)
) ENGINE=InnoDB;

CREATE TABLE cooperation_audit (
    audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id CHAR(36) NULL,
    actor_id VARCHAR(64) NULL,
    event_type VARCHAR(64) NOT NULL,
    metadata_json JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_coop_audit_request (request_id,created_at),
    CONSTRAINT fk_coop_audit_actor FOREIGN KEY (actor_id) REFERENCES players(player_id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES (12);
