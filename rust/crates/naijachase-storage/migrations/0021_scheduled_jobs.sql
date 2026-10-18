CREATE TABLE IF NOT EXISTS scheduled_jobs (
    job_name VARCHAR(64) PRIMARY KEY
) ENGINE=InnoDB;
INSERT IGNORE INTO scheduled_jobs(job_name) VALUES ('weekly_expiry');
INSERT IGNORE INTO schema_migrations(version) VALUES (21);
