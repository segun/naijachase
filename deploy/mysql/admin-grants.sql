-- Input template for deploy/admin/provision.mjs; do not execute unrendered.
-- Provisioning renders the stored service password in memory and sends SQL to MySQL.
-- Apply game migration 23 first; restrict CLIENT_HOST to the service machine.
CREATE USER 'naijachase_admin'@'@@CLIENT_HOST@@'
    IDENTIFIED BY '@@REPORTING_PASSWORD@@' REQUIRE SSL;

-- The versioned reporting views are the entire database access contract.
-- Do not grant SELECT on naijachase.* or underlying authentication tables.
GRANT SELECT ON `@@GAME_DATABASE@@`.admin_reporting_accounts_v1
    TO 'naijachase_admin'@'@@CLIENT_HOST@@';
GRANT SELECT ON `@@GAME_DATABASE@@`.admin_reporting_visitors_v1
    TO 'naijachase_admin'@'@@CLIENT_HOST@@';
GRANT SELECT ON `@@GAME_DATABASE@@`.admin_reporting_registration_starts_v1
    TO 'naijachase_admin'@'@@CLIENT_HOST@@';
GRANT SELECT ON `@@GAME_DATABASE@@`.admin_reporting_email_queue_v1
    TO 'naijachase_admin'@'@@CLIENT_HOST@@';
GRANT SELECT ON `@@GAME_DATABASE@@`.admin_reporting_account_progress_v1
    TO 'naijachase_admin'@'@@CLIENT_HOST@@';
GRANT SELECT ON `@@GAME_DATABASE@@`.admin_reporting_case_history_v1
    TO 'naijachase_admin'@'@@CLIENT_HOST@@';
GRANT SELECT ON `@@GAME_DATABASE@@`.admin_reporting_activity_v1
    TO 'naijachase_admin'@'@@CLIENT_HOST@@';
GRANT SELECT ON `@@GAME_DATABASE@@`.admin_reporting_moderation_v1
    TO 'naijachase_admin'@'@@CLIENT_HOST@@';
GRANT SELECT ON `@@GAME_DATABASE@@`.admin_reporting_security_events_v1
    TO 'naijachase_admin'@'@@CLIENT_HOST@@';
GRANT SELECT ON `@@GAME_DATABASE@@`.admin_reporting_email_health_v1
    TO 'naijachase_admin'@'@@CLIENT_HOST@@';

-- Only this fixed operation can write player state; no arbitrary SQL writes.
GRANT EXECUTE ON PROCEDURE `@@GAME_DATABASE@@`.admin_revoke_player_sessions_v1
    TO 'naijachase_admin'@'@@CLIENT_HOST@@';
-- No base-table reads/writes, roles, DDL, or GRANT OPTION.
SHOW GRANTS FOR 'naijachase_admin'@'@@CLIENT_HOST@@';
