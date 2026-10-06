ALTER TABLE thieves DROP INDEX alias;
CREATE INDEX idx_thieves_alias ON thieves(alias);

INSERT IGNORE INTO schema_migrations(version) VALUES (3);
