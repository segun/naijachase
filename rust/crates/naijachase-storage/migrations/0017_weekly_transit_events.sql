ALTER TABLE weekly_transits
    ADD COLUMN event_json JSON NULL;

INSERT IGNORE INTO schema_migrations(version) VALUES(17);
