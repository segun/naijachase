CREATE TABLE IF NOT EXISTS service_audit (
    audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(64),
    case_id VARCHAR(64),
    command_id VARCHAR(64),
    outcome VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_service_audit_case (case_id, created_at),
    KEY idx_service_audit_player (player_id, created_at)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES (4);
