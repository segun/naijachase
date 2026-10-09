ALTER TABLE players
    ADD COLUMN date_of_birth DATE NULL;

INSERT IGNORE INTO schema_migrations(version) VALUES(16);
