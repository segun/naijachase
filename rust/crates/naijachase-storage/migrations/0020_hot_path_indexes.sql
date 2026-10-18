ALTER TABLE active_cases
    DROP INDEX idx_active_player_kind,
    ADD KEY idx_active_player_kind_recency
        (player_id, attempt_kind, updated_at, created_at);

INSERT IGNORE INTO schema_migrations(version) VALUES (20);
