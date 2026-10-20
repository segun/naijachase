CREATE TABLE IF NOT EXISTS product_measurement_identities (
    visitor_hash CHAR(64) PRIMARY KEY,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    KEY idx_product_identities_retention (last_seen_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_daily_visitors (
    visit_date DATE NOT NULL,
    visitor_hash CHAR(64) NOT NULL,
    first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    player_id VARCHAR(64) NULL,
    PRIMARY KEY (visit_date, visitor_hash),
    KEY idx_product_visitors_online (last_seen_at, player_id),
    KEY idx_product_visitors_identity (visitor_hash),
    CONSTRAINT fk_product_visitor_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_registration_starts (
    visitor_hash CHAR(64) PRIMARY KEY,
    email VARCHAR(320) NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_product_registration_updated (updated_at),
    KEY idx_product_registration_started (started_at),
    KEY idx_product_registration_email (email)
) ENGINE=InnoDB;

CREATE OR REPLACE SQL SECURITY DEFINER VIEW admin_reporting_accounts_v1 AS
    SELECT player_id, email, username, created_at, email_verified_at
    FROM players WHERE email IS NOT NULL;
CREATE OR REPLACE SQL SECURITY DEFINER VIEW admin_reporting_visitors_v1 AS
    SELECT visitor_hash, first_seen_at, last_seen_at, player_id
    FROM product_daily_visitors WHERE visit_date >= DATE_SUB(UTC_DATE(), INTERVAL 89 DAY);
CREATE OR REPLACE SQL SECURITY DEFINER VIEW admin_reporting_registration_starts_v1 AS
    SELECT visitor_hash, email, started_at, updated_at
    FROM product_registration_starts WHERE updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY);
CREATE OR REPLACE SQL SECURITY DEFINER VIEW admin_reporting_email_queue_v1 AS
    SELECT status, created_at FROM email_outbox;

INSERT IGNORE INTO schema_migrations(version) VALUES (22);
