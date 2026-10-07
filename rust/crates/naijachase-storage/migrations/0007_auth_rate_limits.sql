CREATE TABLE IF NOT EXISTS auth_rate_limits (
    subject_hash CHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    attempts INT UNSIGNED NOT NULL,
    window_started TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subject_hash, action)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES (7);
