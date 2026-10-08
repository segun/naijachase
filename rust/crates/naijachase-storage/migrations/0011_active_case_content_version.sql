UPDATE active_cases a
JOIN missions m ON m.mission_id=a.mission_id
SET a.content_version=m.content_version;

INSERT IGNORE INTO schema_migrations(version) VALUES (11);
