ALTER TABLE players
    ADD COLUMN jailed_until TIMESTAMP NULL,
    ADD COLUMN account_status ENUM('active','suspended','banned','deleted') NOT NULL DEFAULT 'active',
    ADD COLUMN weekly_web_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN weekly_email_notifications BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN challenge_tokens INT UNSIGNED NOT NULL DEFAULT 0;

CREATE TABLE player_groups (
    group_id CHAR(36) PRIMARY KEY,
    group_name VARCHAR(48) NOT NULL UNIQUE,
    owner_id VARCHAR(64) NOT NULL,
    capacity SMALLINT UNSIGNED NOT NULL DEFAULT 20,
    status ENUM('active','deleted') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT fk_group_owner FOREIGN KEY(owner_id) REFERENCES players(player_id),
    CHECK (capacity BETWEEN 2 AND 100)
) ENGINE=InnoDB;

CREATE TABLE group_members (
    group_id CHAR(36) NOT NULL,
    player_id VARCHAR(64) NOT NULL,
    role ENUM('owner','admin','member') NOT NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(group_id,player_id),
    CONSTRAINT fk_member_group FOREIGN KEY(group_id) REFERENCES player_groups(group_id),
    CONSTRAINT fk_member_player FOREIGN KEY(player_id) REFERENCES players(player_id)
) ENGINE=InnoDB;

CREATE TABLE group_invitations (
    invitation_id CHAR(36) PRIMARY KEY,
    group_id CHAR(36) NOT NULL,
    inviter_id VARCHAR(64) NOT NULL,
    invitee_id VARCHAR(64) NOT NULL,
    status ENUM('pending','accepted','declined','expired','cancelled') NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pending_group_invitee(group_id,invitee_id,status),
    KEY idx_invitee_status(invitee_id,status,expires_at),
    CONSTRAINT fk_invite_group FOREIGN KEY(group_id) REFERENCES player_groups(group_id),
    CONSTRAINT fk_inviter FOREIGN KEY(inviter_id) REFERENCES players(player_id),
    CONSTRAINT fk_invitee FOREIGN KEY(invitee_id) REFERENCES players(player_id)
) ENGINE=InnoDB;

CREATE TABLE group_audit (
    audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    group_id CHAR(36) NOT NULL,
    actor_id VARCHAR(64) NULL,
    event_type VARCHAR(64) NOT NULL,
    metadata_json JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_group_audit(group_id,created_at),
    CONSTRAINT fk_group_audit_group FOREIGN KEY(group_id) REFERENCES player_groups(group_id),
    CONSTRAINT fk_group_audit_actor FOREIGN KEY(actor_id) REFERENCES players(player_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE weekly_challenges (
    challenge_id CHAR(36) PRIMARY KEY,
    group_id CHAR(36) NOT NULL,
    week_key DATE NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Lagos',
    schedule_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    rules_version SMALLINT UNSIGNED NOT NULL,
    mission_id VARCHAR(32) NOT NULL,
    content_version INT UNSIGNED NOT NULL,
    seed BIGINT UNSIGNED NOT NULL,
    template_state_json JSON NOT NULL,
    opens_at TIMESTAMP NOT NULL,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    status ENUM('registration','open','closed','expired','cancelled') NOT NULL,
    winner_attempt_id CHAR(36) NULL,
    winner_event_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_group_week(group_id,week_key),
    KEY idx_weekly_schedule(status,starts_at,ends_at),
    CONSTRAINT fk_weekly_group FOREIGN KEY(group_id) REFERENCES player_groups(group_id),
    CONSTRAINT fk_weekly_mission FOREIGN KEY(mission_id) REFERENCES missions(mission_id)
) ENGINE=InnoDB;

CREATE TABLE weekly_entrants (
    challenge_id CHAR(36) NOT NULL,
    player_id VARCHAR(64) NOT NULL,
    eligible BOOLEAN NOT NULL,
    ineligibility_reason VARCHAR(64) NULL,
    enrolled_at TIMESTAMP NULL,
    locked_at TIMESTAMP NOT NULL,
    PRIMARY KEY(challenge_id,player_id),
    CONSTRAINT fk_entrant_challenge FOREIGN KEY(challenge_id) REFERENCES weekly_challenges(challenge_id),
    CONSTRAINT fk_entrant_player FOREIGN KEY(player_id) REFERENCES players(player_id)
) ENGINE=InnoDB;

CREATE TABLE weekly_attempts (
    attempt_id CHAR(36) PRIMARY KEY,
    challenge_id CHAR(36) NOT NULL,
    player_id VARCHAR(64) NOT NULL,
    state_json JSON NOT NULL,
    state_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    status ENUM('active','in_transit','solved','closed','expired','forfeited') NOT NULL DEFAULT 'active',
    challenge_bribe_tokens SMALLINT UNSIGNED NOT NULL DEFAULT 3,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP NULL,
    UNIQUE KEY uq_weekly_player(challenge_id,player_id),
    KEY idx_weekly_attempt_player(player_id,status),
    CONSTRAINT fk_attempt_challenge FOREIGN KEY(challenge_id) REFERENCES weekly_challenges(challenge_id),
    CONSTRAINT fk_attempt_player FOREIGN KEY(player_id) REFERENCES players(player_id)
) ENGINE=InnoDB;

CREATE TABLE weekly_transits (
    transit_id CHAR(36) PRIMARY KEY,
    attempt_id CHAR(36) NOT NULL,
    command_id VARCHAR(64) NOT NULL,
    origin VARCHAR(128) NOT NULL,
    destination VARCHAR(128) NOT NULL,
    mode ENUM('fly','drive','hitch_ride') NOT NULL,
    fare INT UNSIGNED NOT NULL,
    duration_seconds INT UNSIGNED NOT NULL,
    departed_at TIMESTAMP NOT NULL,
    arrives_at TIMESTAMP NOT NULL,
    arrival_state_json JSON NOT NULL,
    completed_at TIMESTAMP NULL,
    UNIQUE KEY uq_attempt_command(attempt_id,command_id),
    KEY idx_transit_arrival(arrives_at,completed_at),
    CONSTRAINT fk_transit_attempt FOREIGN KEY(attempt_id) REFERENCES weekly_attempts(attempt_id)
) ENGINE=InnoDB;

CREATE TABLE weekly_events (
    event_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    challenge_id CHAR(36) NOT NULL,
    attempt_id CHAR(36) NULL,
    player_id VARCHAR(64) NULL,
    event_type VARCHAR(64) NOT NULL,
    event_json JSON NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_weekly_events(challenge_id,event_id),
    CONSTRAINT fk_weekly_event_challenge FOREIGN KEY(challenge_id) REFERENCES weekly_challenges(challenge_id)
) ENGINE=InnoDB;

CREATE TABLE challenge_token_ledger (
    ledger_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    challenge_id CHAR(36) NOT NULL,
    amount SMALLINT NOT NULL,
    reason VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_challenge_reward(player_id,challenge_id,reason),
    CONSTRAINT fk_token_player FOREIGN KEY(player_id) REFERENCES players(player_id),
    CONSTRAINT fk_token_challenge FOREIGN KEY(challenge_id) REFERENCES weekly_challenges(challenge_id)
) ENGINE=InnoDB;

CREATE TABLE weekly_notifications (
    notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    challenge_id CHAR(36) NULL,
    notification_type VARCHAR(64) NOT NULL,
    channel ENUM('web','email') NOT NULL,
    payload_json JSON NOT NULL,
    sent_at TIMESTAMP NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_weekly_notification(player_id,created_at),
    CONSTRAINT fk_weekly_notification_player FOREIGN KEY(player_id) REFERENCES players(player_id)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES(13);
