ALTER TABLE players
    ADD COLUMN avatar_setup_completed_at TIMESTAMP NULL;

INSERT IGNORE INTO schema_migrations(version) VALUES(15);
