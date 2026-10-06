CREATE TABLE IF NOT EXISTS content_sources (
    file_path VARCHAR(512) PRIMARY KEY,
    header_json JSON NOT NULL,
    sha256 CHAR(64) NOT NULL,
    row_count BIGINT UNSIGNED NOT NULL,
    imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS content_rows (
    file_path VARCHAR(512) NOT NULL,
    row_index BIGINT UNSIGNED NOT NULL,
    record_key VARCHAR(255) NOT NULL,
    row_json JSON NOT NULL,
    PRIMARY KEY (file_path, row_index),
    KEY idx_content_record_key (record_key),
    CONSTRAINT fk_content_row_source FOREIGN KEY (file_path)
        REFERENCES content_sources(file_path) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS terminal_careers (
    player_id VARCHAR(64) PRIMARY KEY,
    version BIGINT UNSIGNED NOT NULL,
    career_json LONGBLOB NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations(version) VALUES (2);
