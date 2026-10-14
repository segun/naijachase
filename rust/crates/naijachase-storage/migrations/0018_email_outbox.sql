CREATE TABLE IF NOT EXISTS email_outbox (
    email_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(64) NULL,
    message_kind VARCHAR(32) NOT NULL,
    recipient VARCHAR(320) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    text_body TEXT NOT NULL,
    html_body MEDIUMTEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'queued',
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    locked_at TIMESTAMP NULL,
    sent_at TIMESTAMP NULL,
    last_error VARCHAR(1000) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_email_outbox_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE CASCADE,
    KEY idx_email_outbox_due (status, next_attempt_at, expires_at),
    KEY idx_email_outbox_player (player_id, message_kind, created_at)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES (18);
