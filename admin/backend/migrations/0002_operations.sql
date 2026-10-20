CREATE TABLE IF NOT EXISTS admin_account_notes (
    note_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    staff_id BIGINT UNSIGNED NOT NULL,
    staff_username VARCHAR(64) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_admin_notes_player (player_id,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_support_actions (
    action_id CHAR(64) PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    staff_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    action VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    affected_sessions BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at TIMESTAMP(3) NULL,
    KEY idx_admin_support_player (player_id,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_moderation_decisions (
    report_id CHAR(36) PRIMARY KEY,
    decision VARCHAR(32) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    staff_id BIGINT UNSIGNED NOT NULL,
    staff_username VARCHAR(64) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_alert_samples (
    sample_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    process_started DOUBLE NOT NULL,
    requests BIGINT UNSIGNED NOT NULL,
    errors BIGINT UNSIGNED NOT NULL,
    duration_seconds DOUBLE NOT NULL,
    collected_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_admin_alert_collected (collected_at)
) ENGINE=InnoDB;
