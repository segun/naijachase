# Data and database audit — 2026-10-07

## CSV result

The active `data/` tree contains 17 canonical CSV files consumed by the Rust runtime, validation/editorial pipeline, simulation, or transactional MySQL import. Nine superseded CSVs were moved intact to `archive/legacy-csv-2026-10-07/`.

The archived files are the 30-case pilot set, legacy mission clue and witness expansions, the old five-trait catalogue and assignments, and intermediate location-coordinate and state-venue-profile outputs. Their replacements are documented in the archive manifest.

## MySQL result

The live database contains only tables created by migrations 1–12. No unknown or orphan table exists.

- Gameplay state: `active_cases`, `case_events`, `careers`, `case_archive`, `player_mission_completions`, `active_mission_assignments`, `player_state_visits`, `rank_history`, and `player_achievements`.
- Canonical content: `locations`, `knowledge`, `location_knowledge`, `thieves`, `venues`, `missions`, `clue_atoms`, and `dialogue_variants`.
- Content operations: `content_imports`, `content_sources`, `content_rows`, `mission_lifecycle_audit`, and `catalogue_release_notifications`.
- Identity and security: `players`, `player_sessions`, `email_verifications`, `password_resets`, `auth_rate_limits`, `security_events`, and `service_audit`.
- Cooperation: `cooperation_requests`, `cooperation_blocks`, `cooperation_reports`, and `cooperation_audit`.
- Compatibility and infrastructure: `terminal_careers` supports the terminal edition and `schema_migrations` controls safe upgrades.

Every table has an active Rust reference or a current foreign-key, audit, recovery, import/export, authentication, terminal, or migration responsibility. No table can currently be dropped safely without first removing a supported feature and adding a new migration. Consequently, no database table was removed.

After archiving the CSVs, the canonical set was transactionally re-imported and verified: 17 files, 45,246 rows, and 1,000 identical mission outcomes.
