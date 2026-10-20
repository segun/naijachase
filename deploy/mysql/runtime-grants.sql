-- DBA provisioning template: replace password and host before executing.
-- Use a NEW runtime principal; never reuse a migration/admin principal or role.
-- Restrict the host to the API host (use its network address for remote MySQL).
CREATE USER 'naijachase_api'@'localhost' IDENTIFIED BY 'REPLACE_WITH_UNIQUE_RUNTIME_SECRET' REQUIRE SSL;
GRANT SELECT ON naijachase.* TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.active_cases TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.active_mission_assignments TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.auth_rate_limits TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.bribe_token_ledger TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.careers TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.case_archive TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.case_events TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.catalogue_release_notifications TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.challenge_token_ledger TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.cooperation_audit TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.cooperation_blocks TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.cooperation_reports TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.cooperation_requests TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.disciplinary_cases TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.disciplinary_events TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.disciplinary_votes TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.email_outbox TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.email_verifications TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.general_rate_limits TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.group_audit TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.group_invitations TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.group_members TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.mission_lifecycle_audit TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.password_resets TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.player_achievements TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.player_groups TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.player_mission_completions TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.player_sessions TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.player_state_visits TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.players TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.product_daily_visitors TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.product_measurement_identities TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.product_registration_starts TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.rank_history TO 'naijachase_api'@'localhost';
GRANT UPDATE ON naijachase.scheduled_jobs TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.security_events TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.service_audit TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.weekly_attempts TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.weekly_challenges TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.weekly_entrants TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.weekly_events TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.weekly_notifications TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.weekly_transits TO 'naijachase_api'@'localhost';
GRANT INSERT, UPDATE, DELETE ON naijachase.witness_pressure_attempts TO 'naijachase_api'@'localhost';
-- Runtime content administration changes lifecycle metadata only.
GRANT UPDATE (lifecycle_status, content_version, scheduled_for, published_at, retired_at, lifecycle_updated_by)
    ON naijachase.missions TO 'naijachase_api'@'localhost';
-- The row is seeded by deployment; runtime only locks it during the sweep.
-- No CREATE, ALTER, DROP, INDEX, REFERENCES, GRANT OPTION or content import writes.
SHOW GRANTS FOR 'naijachase_api'@'localhost';
