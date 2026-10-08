ALTER TABLE players
    ADD COLUMN content_role ENUM('player','editor','publisher','admin') NOT NULL DEFAULT 'player';

ALTER TABLE missions
    ADD COLUMN scheduled_for TIMESTAMP NULL,
    ADD COLUMN retired_at TIMESTAMP NULL,
    ADD COLUMN lifecycle_updated_by VARCHAR(64) NULL,
    ADD COLUMN lifecycle_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD CONSTRAINT fk_mission_lifecycle_actor FOREIGN KEY (lifecycle_updated_by)
        REFERENCES players(player_id) ON DELETE SET NULL,
    ADD KEY idx_mission_schedule (lifecycle_status, scheduled_for);

CREATE TABLE IF NOT EXISTS mission_lifecycle_audit (
    audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    mission_id VARCHAR(32) NOT NULL,
    actor_player_id VARCHAR(64) NOT NULL,
    from_status VARCHAR(32) NULL,
    to_status VARCHAR(32) NOT NULL,
    content_version INT UNSIGNED NOT NULL,
    reason VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lifecycle_mission FOREIGN KEY (mission_id)
        REFERENCES missions(mission_id),
    CONSTRAINT fk_lifecycle_actor FOREIGN KEY (actor_player_id)
        REFERENCES players(player_id),
    KEY idx_lifecycle_audit_mission (mission_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS catalogue_release_notifications (
    notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL,
    mission_id VARCHAR(32) NOT NULL,
    published_at TIMESTAMP NOT NULL,
    read_at TIMESTAMP NULL,
    UNIQUE KEY uq_release_notification (player_id, mission_id),
    CONSTRAINT fk_release_notification_player FOREIGN KEY (player_id)
        REFERENCES players(player_id) ON DELETE CASCADE,
    CONSTRAINT fk_release_notification_mission FOREIGN KEY (mission_id)
        REFERENCES missions(mission_id),
    KEY idx_release_notification_unread (player_id, read_at, published_at)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES (10);
