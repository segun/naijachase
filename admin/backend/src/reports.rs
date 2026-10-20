use chrono::{Days, Utc};
use mysql::{Pool, PooledConn, params, prelude::Queryable};
use serde::Serialize;
use std::time::Duration;

// Classify an email by its most recent activity across browsers. An older draft
// must not make an actively completed/restarted registration look abandoned.
const EMAIL_DRAFTS: &str = "(SELECT LOWER(TRIM(email)) AS email, MIN(started_at) AS started_at,
    MAX(updated_at) AS updated_at FROM admin_reporting_registration_starts_v1
    WHERE email IS NOT NULL GROUP BY LOWER(TRIM(email)))";

#[derive(Serialize, Default)]
pub struct Metrics {
    pub registered_users: u64,
    pub verified_users: u64,
    pub online_users: u64,
    pub visitors: u64,
    pub registration_starts: u64,
    pub accounts_created: u64,
    pub registrations_completed: u64,
    pub abandoned_registrations: u64,
    pub pending_verification: u64,
}

#[derive(Serialize)]
pub struct Day {
    pub date: String,
    pub visitors: u64,
    pub registration_starts: u64,
    pub accounts_created: u64,
    pub registrations_completed: u64,
}

#[derive(Serialize)]
pub struct Overview {
    pub generated_at: String,
    pub period_days: u64,
    pub available: bool,
    pub metrics: Option<Metrics>,
    pub daily: Vec<Day>,
    pub tracking_started_at: Option<String>,
    pub unavailable_reason: Option<&'static str>,
}

impl Overview {
    pub fn unavailable(days: u64) -> Self {
        Self {
            generated_at: now(),
            period_days: days,
            available: false,
            metrics: None,
            daily: vec![],
            tracking_started_at: None,
            unavailable_reason: Some("Reporting database unavailable"),
        }
    }
}

#[derive(Serialize)]
pub struct Registration {
    pub email: String,
    pub started_at: String,
    pub updated_at: String,
    pub status: String,
    pub account_created: bool,
    pub email_verified: bool,
}

#[derive(Serialize)]
pub struct Registrations {
    pub generated_at: String,
    pub available: bool,
    pub period_days: u64,
    pub page: u64,
    pub page_size: u64,
    pub total: Option<u64>,
    pub items: Vec<Registration>,
    pub unavailable_reason: Option<&'static str>,
}
impl Registrations {
    pub fn unavailable(days: u64, page: u64, page_size: u64) -> Self {
        Self {
            generated_at: now(),
            available: false,
            period_days: days,
            page,
            page_size,
            total: None,
            items: vec![],
            unavailable_reason: Some("Reporting database unavailable"),
        }
    }
}

#[derive(Serialize)]
pub struct EmailQueue {
    pub status: &'static str,
    pub queued: Option<u64>,
    pub sending: Option<u64>,
    pub failed: Option<u64>,
    pub sent: Option<u64>,
}
impl EmailQueue {
    pub fn unavailable() -> Self {
        Self {
            status: "unavailable",
            queued: None,
            sending: None,
            failed: None,
            sent: None,
        }
    }
}

pub fn now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn connect(pool: &Pool) -> mysql::Result<PooledConn> {
    pool.try_get_conn(Duration::from_secs(2))
}

pub fn ready(pool: &Pool) -> mysql::Result<()> {
    let mut conn = connect(pool)?;
    for view in [
        "admin_reporting_accounts_v1",
        "admin_reporting_visitors_v1",
        "admin_reporting_registration_starts_v1",
        "admin_reporting_email_queue_v1",
    ] {
        conn.query_drop(format!("SELECT 1 FROM {view} LIMIT 1"))?;
    }
    Ok(())
}

pub fn overview(pool: &Pool, days: u64) -> mysql::Result<Overview> {
    let mut conn = connect(pool)?;
    let span = days - 1;
    let (registered_users, verified_users, pending_verification, accounts_created, registrations_completed) = conn.exec_first(
        "SELECT COUNT(*), COUNT(email_verified_at), COUNT(CASE WHEN email_verified_at IS NULL THEN 1 END),
         COUNT(CASE WHEN created_at >= DATE_SUB(UTC_DATE(), INTERVAL :span DAY) THEN 1 END),
         COUNT(CASE WHEN email_verified_at >= DATE_SUB(UTC_DATE(), INTERVAL :span DAY) THEN 1 END)
         FROM admin_reporting_accounts_v1 WHERE email IS NOT NULL", params! { "span" => span })?.unwrap();
    let (visitors, online_users) = conn.exec_first(
        "SELECT COUNT(DISTINCT CASE WHEN first_seen_at >= DATE_SUB(UTC_DATE(), INTERVAL :span DAY) THEN visitor_hash END),
         COUNT(DISTINCT CASE WHEN last_seen_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE) THEN player_id END)
         FROM admin_reporting_visitors_v1", params! { "span" => span })?.unwrap();
    let registration_starts = conn
        .exec_first(
            "SELECT COUNT(*) FROM admin_reporting_registration_starts_v1
         WHERE started_at >= DATE_SUB(UTC_DATE(), INTERVAL :span DAY)",
            params! { "span" => span },
        )?
        .unwrap();
    let abandoned_registrations = conn
        .exec_first(
            format!(
                "SELECT COUNT(*) FROM {EMAIL_DRAFTS} r
         WHERE r.email IS NOT NULL AND r.started_at >= DATE_SUB(UTC_DATE(), INTERVAL :span DAY)
         AND r.updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
         AND NOT EXISTS (SELECT 1 FROM admin_reporting_accounts_v1 a
             WHERE a.email = r.email AND a.email_verified_at IS NOT NULL)"
            ),
            params! { "span" => span },
        )?
        .unwrap();
    let tracking_started_at: Option<String> = conn.query_first::<Option<String>, _>(
        "SELECT DATE_FORMAT(MIN(first_seen_at),'%Y-%m-%dT%H:%i:%sZ') FROM admin_reporting_visitors_v1")?.flatten();
    let today = Utc::now().date_naive();
    let mut daily: Vec<Day> = (0..days)
        .rev()
        .map(|offset| Day {
            date: today
                .checked_sub_days(Days::new(offset))
                .unwrap()
                .to_string(),
            visitors: 0,
            registration_starts: 0,
            accounts_created: 0,
            registrations_completed: 0,
        })
        .collect();
    for (index, sql) in [
        "SELECT DATE_FORMAT(first_seen_at,'%Y-%m-%d'), COUNT(DISTINCT visitor_hash) FROM admin_reporting_visitors_v1 WHERE first_seen_at >= DATE_SUB(UTC_DATE(), INTERVAL :span DAY) GROUP BY DATE_FORMAT(first_seen_at,'%Y-%m-%d')",
        "SELECT DATE_FORMAT(started_at,'%Y-%m-%d'), COUNT(*) FROM admin_reporting_registration_starts_v1 WHERE started_at >= DATE_SUB(UTC_DATE(), INTERVAL :span DAY) GROUP BY DATE_FORMAT(started_at,'%Y-%m-%d')",
        "SELECT DATE_FORMAT(created_at,'%Y-%m-%d'), COUNT(*) FROM admin_reporting_accounts_v1 WHERE email IS NOT NULL AND created_at >= DATE_SUB(UTC_DATE(), INTERVAL :span DAY) GROUP BY DATE_FORMAT(created_at,'%Y-%m-%d')",
        "SELECT DATE_FORMAT(email_verified_at,'%Y-%m-%d'), COUNT(*) FROM admin_reporting_accounts_v1 WHERE email IS NOT NULL AND email_verified_at >= DATE_SUB(UTC_DATE(), INTERVAL :span DAY) GROUP BY DATE_FORMAT(email_verified_at,'%Y-%m-%d')",
    ].into_iter().enumerate() {
        let rows: Vec<(String, u64)> = conn.exec(sql, params! { "span" => span })?;
        for (date, value) in rows {
            if let Some(day) = daily.iter_mut().find(|day| day.date == date) {
                match index { 0 => day.visitors = value, 1 => day.registration_starts = value,
                    2 => day.accounts_created = value, _ => day.registrations_completed = value }
            }
        }
    }
    Ok(Overview {
        generated_at: now(),
        period_days: days,
        available: true,
        metrics: Some(Metrics {
            registered_users,
            verified_users,
            online_users,
            visitors,
            registration_starts,
            accounts_created,
            registrations_completed,
            abandoned_registrations,
            pending_verification,
        }),
        daily,
        tracking_started_at,
        unavailable_reason: None,
    })
}

pub fn registrations(
    pool: &Pool,
    days: u64,
    page: u64,
    page_size: u64,
    status: &str,
) -> mysql::Result<Registrations> {
    let mut conn = connect(pool)?;
    // Only allowlisted, application-owned SQL fragments enter this query.
    let verified = "EXISTS (SELECT 1 FROM admin_reporting_accounts_v1 a WHERE a.email=r.email AND a.email_verified_at IS NOT NULL)";
    let abandoned =
        format!("r.updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR) AND NOT ({verified})");
    let filter = match status {
        "abandoned" => abandoned.clone(),
        "pending" => format!(
            "NOT ({verified}) AND r.updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)"
        ),
        _ => "1=1".into(),
    };
    let base = format!(
        "FROM {EMAIL_DRAFTS} r WHERE r.email IS NOT NULL
        AND r.started_at >= DATE_SUB(UTC_DATE(), INTERVAL :span DAY) AND ({filter})"
    );
    let total = conn
        .exec_first(
            format!("SELECT COUNT(*) {base}"),
            params! { "span" => days - 1 },
        )?
        .unwrap();
    let sql = format!(
        "SELECT r.email, DATE_FORMAT(r.started_at,'%Y-%m-%dT%H:%i:%sZ'),
        DATE_FORMAT(r.updated_at,'%Y-%m-%dT%H:%i:%sZ'),
        CASE WHEN {verified} THEN 'completed' WHEN {abandoned} THEN 'abandoned' ELSE 'pending' END,
        EXISTS (SELECT 1 FROM admin_reporting_accounts_v1 a WHERE a.email=r.email), {verified}
        {base} ORDER BY r.updated_at DESC, r.email LIMIT :limit OFFSET :offset"
    );
    let rows: Vec<(String, String, String, String, bool, bool)> = conn.exec(
        sql,
        params! { "span" => days - 1, "limit" => page_size, "offset" => (page - 1) * page_size },
    )?;
    Ok(Registrations {
        generated_at: now(),
        available: true,
        period_days: days,
        page,
        page_size,
        total: Some(total),
        items: rows
            .into_iter()
            .map(
                |(email, started_at, updated_at, status, account_created, email_verified)| {
                    Registration {
                        email,
                        started_at,
                        updated_at,
                        status,
                        account_created,
                        email_verified,
                    }
                },
            )
            .collect(),
        unavailable_reason: None,
    })
}

pub fn email_queue(pool: &Pool) -> mysql::Result<EmailQueue> {
    let mut conn = connect(pool)?;
    let (queued, sending, failed, sent): (u64, u64, u64, u64) = conn.query_first(
        "SELECT COUNT(CASE WHEN status='queued' THEN 1 END), COUNT(CASE WHEN status='sending' THEN 1 END),
         COUNT(CASE WHEN status IN ('dead','failed') THEN 1 END), COUNT(CASE WHEN status='sent' THEN 1 END)
         FROM admin_reporting_email_queue_v1")?.unwrap();
    Ok(EmailQueue {
        status: "healthy",
        queued: Some(queued),
        sending: Some(sending),
        failed: Some(failed),
        sent: Some(sent),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reporting_views_mysql_integration() {
        if std::env::var("NAIJACHASE_ADMIN_MYSQL_TEST").ok().as_deref() != Some("1") {
            eprintln!(
                "Set NAIJACHASE_ADMIN_MYSQL_TEST=1 and ADMIN_MYSQL_* to run reporting database integration"
            );
            return;
        }
        let config = crate::config::Config::from_env().expect("admin integration configuration");
        let pool = Pool::new(config.mysql_options).expect("reporting database pool");
        ready(&pool).expect("all four reporting views accessible");
        let report = overview(&pool, 7).expect("overview queries");
        assert!(report.available);
        assert_eq!(report.daily.len(), 7);
        let metrics = report.metrics.unwrap();
        assert!(metrics.verified_users <= metrics.registered_users);
        for status in ["abandoned", "pending", "all"] {
            let list = registrations(&pool, 30, 1, 25, status).expect("registration queries");
            assert!(list.items.len() <= 25);
            assert!(list.total.unwrap() >= list.items.len() as u64);
            if status != "all" {
                assert!(list.items.iter().all(|row| row.status == status));
            }
        }
        assert_eq!(
            email_queue(&pool).expect("email queue query").status,
            "healthy"
        );
    }
}
