CREATE OR REPLACE SQL SECURITY DEFINER VIEW admin_reporting_account_progress_v1 AS
    SELECT p.player_id, p.email, p.username, p.display_name, p.home_base,
        p.created_at, p.email_verified_at, COALESCE(c.points,0) AS points,
        (SELECT MAX(s.last_seen_at) FROM player_sessions s WHERE s.player_id=p.player_id) AS last_seen_at,
        (SELECT COUNT(*) FROM player_sessions s WHERE s.player_id=p.player_id
            AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()) AS active_sessions,
        (SELECT COUNT(*) FROM case_archive a WHERE a.player_id=p.player_id) AS completed_cases,
        (SELECT COUNT(*) FROM case_archive a WHERE a.player_id=p.player_id AND a.outcome='solved') AS solved_cases
    FROM players p LEFT JOIN careers c ON c.player_id=p.player_id WHERE p.email IS NOT NULL;

CREATE OR REPLACE SQL SECURITY DEFINER VIEW admin_reporting_case_history_v1 AS
    SELECT c.case_id, c.player_id, c.mission_id, c.created_at AS started_at,
        a.completed_at, a.outcome, c.attempt_kind
    FROM active_cases c JOIN players p ON p.player_id=c.player_id AND p.email IS NOT NULL
    LEFT JOIN case_archive a ON a.case_id=c.case_id
    UNION ALL
    SELECT a.case_id, a.player_id, a.mission_id, NULL AS started_at,
        a.completed_at, a.outcome, a.attempt_kind
    FROM case_archive a JOIN players p ON p.player_id=a.player_id AND p.email IS NOT NULL
    WHERE NOT EXISTS (SELECT 1 FROM active_cases c WHERE c.case_id=a.case_id);

CREATE OR REPLACE SQL SECURITY DEFINER VIEW admin_reporting_activity_v1 AS
    SELECT visit_date AS activity_date, player_id FROM product_daily_visitors
    WHERE player_id IS NOT NULL AND visit_date >= DATE_SUB(UTC_DATE(), INTERVAL 89 DAY)
    GROUP BY visit_date, player_id;

CREATE OR REPLACE SQL SECURITY DEFINER VIEW admin_reporting_moderation_v1 AS
    SELECT r.report_id, r.reporter_id, p.username AS reporter_username,
        r.reported_id, q.username AS reported_username, r.category, r.details,
        r.status AS source_status, r.created_at
    FROM cooperation_reports r
    LEFT JOIN players p ON p.player_id=r.reporter_id
    LEFT JOIN players q ON q.player_id=r.reported_id;

CREATE OR REPLACE SQL SECURITY DEFINER VIEW admin_reporting_security_events_v1 AS
    SELECT event_id, player_id, event_type, outcome, created_at FROM security_events;

CREATE OR REPLACE SQL SECURITY DEFINER VIEW admin_reporting_email_health_v1 AS
    SELECT status, attempts, created_at, locked_at, next_attempt_at FROM email_outbox;

DROP PROCEDURE IF EXISTS admin_revoke_player_sessions_v1;
CREATE PROCEDURE admin_revoke_player_sessions_v1(IN target_player_id VARCHAR(64))
    SQL SECURITY DEFINER
    UPDATE player_sessions SET revoked_at=UTC_TIMESTAMP()
    WHERE player_id=target_player_id AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP();

INSERT IGNORE INTO schema_migrations(version) VALUES (23);
