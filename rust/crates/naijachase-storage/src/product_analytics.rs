//! Write side of the versioned admin reporting boundary. Admin never imports this crate.
use super::*;

fn lock_identity(
    tx: &mut mysql::Transaction<'_>,
    visitor_hash: &str,
) -> Result<bool, StorageError> {
    tx.exec_drop(
        "INSERT IGNORE INTO product_measurement_identities(visitor_hash) VALUES(:visitor)",
        params! {"visitor"=>visitor_hash},
    )?;
    let allowed: Option<bool> = tx.exec_first("SELECT revoked_at IS NULL FROM product_measurement_identities WHERE visitor_hash=:visitor FOR UPDATE", params! {"visitor"=>visitor_hash})?;
    if allowed == Some(true) {
        tx.exec_drop("UPDATE product_measurement_identities SET last_seen_at=UTC_TIMESTAMP() WHERE visitor_hash=:visitor", params! {"visitor"=>visitor_hash})?;
    }
    Ok(allowed == Some(true))
}

impl MysqlStore {
    /// Only called after the browser explicitly opts into usage measurement.
    /// Never trusts a browser-supplied player ID and never touches session activity.
    pub fn record_product_visit(
        &self,
        visitor_hash: &str,
        session_hash: Option<&str>,
    ) -> Result<bool, StorageError> {
        let mut connection = self.connection()?;
        let mut tx = connection.start_transaction(TxOpts::default())?;
        if !lock_identity(&mut tx, visitor_hash)? {
            tx.commit()?;
            return Ok(false);
        }
        let player_id: Option<String> = match session_hash {
            Some(token) => tx.exec_first(
                "SELECT s.player_id FROM player_sessions s JOIN players p ON p.player_id=s.player_id
                 WHERE s.token_hash=:token AND s.revoked_at IS NULL
                   AND s.expires_at>UTC_TIMESTAMP() AND p.email_verified_at IS NOT NULL",
                params! {"token"=>token},
            )?,
            None => None,
        };
        tx.exec_drop(
            "INSERT INTO product_daily_visitors(visit_date,visitor_hash,player_id)
             VALUES(UTC_DATE(),:visitor,:player)
             ON DUPLICATE KEY UPDATE last_seen_at=UTC_TIMESTAMP(),player_id=VALUES(player_id)",
            params! {"visitor"=>visitor_hash,"player"=>player_id},
        )?;
        tx.commit()?;
        Ok(true)
    }

    pub fn record_registration_start(
        &self,
        visitor_hash: &str,
        email: Option<&str>,
    ) -> Result<bool, StorageError> {
        let mut connection = self.connection()?;
        let mut tx = connection.start_transaction(TxOpts::default())?;
        if !lock_identity(&mut tx, visitor_hash)? {
            tx.commit()?;
            return Ok(false);
        }
        tx.exec_drop(
            "INSERT INTO product_registration_starts(visitor_hash,email) VALUES(:visitor,:email)
             ON DUPLICATE KEY UPDATE
               started_at=IF(:email IS NOT NULL AND email IS NOT NULL AND email<>:email,UTC_TIMESTAMP(),started_at),
               email=COALESCE(:email,email),updated_at=UTC_TIMESTAMP()",
            params! {"visitor"=>visitor_hash,"email"=>email},
        )?;
        tx.commit()?;
        Ok(true)
    }

    pub fn delete_product_analytics(&self, visitor_hash: &str) -> Result<(), StorageError> {
        let mut connection = self.connection()?;
        let mut tx = connection.start_transaction(TxOpts::default())?;
        // A hash-only tombstone serializes withdrawal with delayed requests in
        // other tabs. Retain it for the maximum lifetime of the old identifier.
        tx.exec_drop("INSERT INTO product_measurement_identities(visitor_hash,revoked_at) VALUES(:visitor,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE revoked_at=UTC_TIMESTAMP(),last_seen_at=UTC_TIMESTAMP()", params! {"visitor"=>visitor_hash})?;
        tx.exec_drop(
            "DELETE FROM product_registration_starts WHERE visitor_hash=:visitor",
            params! {"visitor"=>visitor_hash},
        )?;
        tx.exec_drop(
            "DELETE FROM product_daily_visitors WHERE visitor_hash=:visitor",
            params! {"visitor"=>visitor_hash},
        )?;
        tx.commit()?;
        Ok(())
    }

    /// Bounded batches keep cleanup from monopolising the gameplay database.
    pub fn prune_product_analytics(&self) -> Result<bool, StorageError> {
        let mut connection = self.connection()?;
        connection.query_drop("DELETE FROM product_registration_starts WHERE updated_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 30 DAY) LIMIT 500")?;
        let more_starts = connection.affected_rows() == 500;
        connection.query_drop("DELETE FROM product_daily_visitors WHERE visit_date<DATE_SUB(UTC_DATE(),INTERVAL 89 DAY) LIMIT 500")?;
        let more_visitors = connection.affected_rows() == 500;
        connection.query_drop("DELETE FROM product_measurement_identities WHERE last_seen_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 90 DAY) LIMIT 500")?;
        Ok(more_starts || more_visitors || connection.affected_rows() == 500)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn live_mysql_reporting_is_deduplicated_and_expires_private_drafts() {
        if env::var("NAIJACHASE_MYSQL_TEST").as_deref() != Ok("1") {
            return;
        }
        let _guard = crate::tests::MYSQL_TEST_LOCK.lock().unwrap();
        // Never load repository .env here: it overrides exported credentials.
        // Mutation tests must explicitly target a disposable local test schema.
        let config = MysqlConfig::from_lookup(|key| env::var(key).ok()).unwrap();
        assert!(
            config.database.ends_with("_test"),
            "use a disposable *_test database"
        );
        assert!(
            matches!(config.host.as_str(), "127.0.0.1" | "localhost" | "::1"),
            "use a local disposable database"
        );
        let store = MysqlStore::connect(&config).unwrap();
        store.migrate().unwrap();
        let visitor = sha256(uuid::Uuid::new_v4().as_bytes());
        store.record_product_visit(&visitor, None).unwrap();
        store.record_product_visit(&visitor, None).unwrap();
        store.record_registration_start(&visitor, None).unwrap();
        store
            .record_registration_start(&visitor, Some("admin-test@example.invalid"))
            .unwrap();
        store.record_registration_start(&visitor, None).unwrap();
        let mut conn = store.connection().unwrap();
        let count: u64 = conn
            .exec_first(
                "SELECT COUNT(*) FROM admin_reporting_visitors_v1 WHERE visitor_hash=:visitor",
                params! {"visitor"=>&visitor},
            )
            .unwrap()
            .unwrap();
        assert_eq!(count, 1);
        let email: String = conn.exec_first("SELECT email FROM admin_reporting_registration_starts_v1 WHERE visitor_hash=:visitor", params! {"visitor"=>&visitor}).unwrap().unwrap();
        assert_eq!(email, "admin-test@example.invalid");
        conn.exec_drop("UPDATE product_registration_starts SET updated_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 31 DAY) WHERE visitor_hash=:visitor", params! {"visitor"=>&visitor}).unwrap();
        let count: u64 = conn.exec_first("SELECT COUNT(*) FROM admin_reporting_registration_starts_v1 WHERE visitor_hash=:visitor", params! {"visitor"=>&visitor}).unwrap().unwrap();
        assert_eq!(count, 0);
        store.prune_product_analytics().unwrap();
        let count: u64 = conn
            .exec_first(
                "SELECT COUNT(*) FROM product_registration_starts WHERE visitor_hash=:visitor",
                params! {"visitor"=>&visitor},
            )
            .unwrap()
            .unwrap();
        assert_eq!(count, 0);
        store.delete_product_analytics(&visitor).unwrap();
        assert!(!store.record_product_visit(&visitor, None).unwrap());
        assert!(
            !store
                .record_registration_start(&visitor, Some("late@example.invalid"))
                .unwrap()
        );
        let count: u64 = conn
            .exec_first(
                "SELECT COUNT(*) FROM product_daily_visitors WHERE visitor_hash=:visitor",
                params! {"visitor"=>&visitor},
            )
            .unwrap()
            .unwrap();
        assert_eq!(count, 0);
        conn.exec_drop(
            "DELETE FROM product_measurement_identities WHERE visitor_hash=:visitor",
            params! {"visitor"=>&visitor},
        )
        .unwrap();
    }
}
