ALTER TABLE players
    ADD COLUMN email VARCHAR(320) NULL,
    ADD COLUMN username VARCHAR(32) NULL,
    ADD COLUMN home_base VARCHAR(128) NULL,
    ADD COLUMN password_hash VARCHAR(255) NULL,
    ADD COLUMN email_verified_at TIMESTAMP NULL;

CREATE UNIQUE INDEX uq_players_email ON players(email);
CREATE UNIQUE INDEX uq_players_username ON players(username);

CREATE TABLE IF NOT EXISTS email_verifications (
    token_hash CHAR(64) PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_verification_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS player_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_session_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE CASCADE,
    KEY idx_session_player (player_id, expires_at)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES (5);
