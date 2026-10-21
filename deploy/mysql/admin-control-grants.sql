-- Input template for deploy/admin/provision.mjs; do not execute unrendered.
-- Apply all admin/backend/migrations SQL files in the dedicated control schema
-- before these grants. The runtime never creates its own schema or tables.
CREATE USER 'naijachase_admin_control'@'@@CLIENT_HOST@@'
    IDENTIFIED BY '@@CONTROL_PASSWORD@@' REQUIRE SSL;
GRANT SELECT, UPDATE ON `@@CONTROL_DATABASE@@`.admin_security_state
    TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
GRANT SELECT, INSERT, UPDATE ON `@@CONTROL_DATABASE@@`.admin_staff
    TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
GRANT SELECT, INSERT, DELETE ON `@@CONTROL_DATABASE@@`.admin_sessions
    TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
GRANT SELECT, INSERT ON `@@CONTROL_DATABASE@@`.admin_audit
    TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
GRANT SELECT, INSERT ON `@@CONTROL_DATABASE@@`.admin_account_notes
    TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
GRANT SELECT, INSERT, UPDATE ON `@@CONTROL_DATABASE@@`.admin_support_actions
    TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
GRANT SELECT, INSERT, UPDATE ON `@@CONTROL_DATABASE@@`.admin_moderation_decisions
    TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
GRANT SELECT, INSERT, DELETE ON `@@CONTROL_DATABASE@@`.admin_alert_samples
    TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
-- Audit and support notes are append-only. No DELETE on staff or security state.
-- No game-schema privileges, roles, DDL, GRANT OPTION or audit UPDATE/DELETE.

-- Scenery advertising: no game-schema access.
GRANT SELECT, UPDATE ON `@@CONTROL_DATABASE@@`.ad_inventory_lock TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
GRANT SELECT ON `@@CONTROL_DATABASE@@`.ad_placements TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
GRANT SELECT, INSERT, UPDATE ON `@@CONTROL_DATABASE@@`.ad_advertisers TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
GRANT SELECT, INSERT ON `@@CONTROL_DATABASE@@`.ad_creatives TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
GRANT SELECT, INSERT, UPDATE ON `@@CONTROL_DATABASE@@`.ad_campaigns TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';
GRANT SELECT, INSERT, UPDATE ON `@@CONTROL_DATABASE@@`.ad_bookings TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';

GRANT SELECT, INSERT ON `@@CONTROL_DATABASE@@`.ad_events TO 'naijachase_admin_control'@'@@CLIENT_HOST@@';

SHOW GRANTS FOR 'naijachase_admin_control'@'@@CLIENT_HOST@@';
