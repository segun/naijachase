-- Run as the DBA in the dedicated admin control schema. Never run in the game schema.
-- DDL can resume after interruption, while existing identities and retirement state are preserved.
-- Runtime receives table-specific grants, with INSERT/SELECT only for the audit log.
CREATE TABLE IF NOT EXISTS admin_security_state (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    bootstrap_retired BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (id = 1)
) ENGINE=InnoDB;
INSERT IGNORE INTO admin_security_state (id, bootstrap_retired) VALUES (1, FALSE);

CREATE TABLE IF NOT EXISTS admin_staff (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(16) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_bootstrap BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CHECK (role IN ('owner', 'operator', 'viewer'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash BINARY(32) NOT NULL PRIMARY KEY,
    staff_id BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX admin_sessions_staff (staff_id),
    INDEX admin_sessions_expiration (expires_at),
    FOREIGN KEY (staff_id) REFERENCES admin_staff (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_audit (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_id BIGINT UNSIGNED NOT NULL,
    actor_username VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(128) NOT NULL,
    outcome VARCHAR(16) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX admin_audit_actor_time (actor_id, created_at),
    INDEX admin_audit_created (created_at)
) ENGINE=InnoDB;
