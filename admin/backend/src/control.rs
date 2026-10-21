//! Admin-owned identities, sessions and append-only audit records. No game types or tables.
use mysql::{Pool, TxOpts, params, prelude::Queryable};
use serde::{Deserialize, Serialize};

#[derive(Debug)]
pub(crate) enum Error {
    Database,
    Unauthorized,
    Forbidden,
    Conflict(&'static str),
    Invalid(&'static str),
    NotFound,
}
impl From<mysql::Error> for Error {
    fn from(_: mysql::Error) -> Self {
        Self::Database
    }
}
pub(crate) type Result<T> = std::result::Result<T, Error>;

#[derive(Clone, Debug, Serialize)]
pub(crate) struct Actor {
    pub account_id: u64,
    pub username: String,
    pub role: String,
    pub is_bootstrap: bool,
    pub permissions: Vec<&'static str>,
}
impl Actor {
    pub fn allows(&self, permission: &str) -> bool {
        self.permissions.contains(&permission)
    }
}
pub(crate) fn permissions(role: &str) -> Vec<&'static str> {
    let mut result = vec![
        "overview:read",
        "system:read",
        "analytics:read",
        "alerts:read",
    ];
    if matches!(role, "owner" | "operator") {
        result.extend([
            "registrations:read",
            "accounts:read",
            "accounts:support",
            "moderation:read",
            "moderation:resolve",
            "ads:manage",
        ]);
    }
    if role == "owner" {
        result.extend(["staff:manage", "audit:read"]);
    }
    if !valid_role(role) {
        result.clear();
    }
    result
}
pub(crate) fn valid_username(username: &str) -> bool {
    (3..=64).contains(&username.len())
        && username
            .bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || b"._-".contains(&c))
}
fn valid_role(role: &str) -> bool {
    matches!(role, "owner" | "operator" | "viewer")
}
pub(crate) fn valid_password(password: &str) -> bool {
    (16..=128).contains(&password.len())
}
fn valid_reason(reason: &str) -> bool {
    !reason.trim().is_empty() && reason.chars().count() <= 500
}

pub(crate) fn audit(
    db: &mut impl Queryable,
    actor: &Actor,
    action: &str,
    target: &str,
    outcome: &str,
    reason: &str,
) -> Result<()> {
    db.exec_drop("INSERT INTO admin_audit (actor_id,actor_username,action,target,outcome,reason) VALUES (:id,:username,:action,:target,:outcome,:reason)", params! {
        "id" => actor.account_id, "username" => &actor.username, "action" => action,
        "target" => target, "outcome" => outcome, "reason" => reason,
    })?;
    Ok(())
}

/// Called once before serving. Migration is intentionally a separate DBA operation.
pub(crate) fn initialize(pool: &Pool, username: &str, password_hash: &str) -> Result<()> {
    let mut conn = pool.get_conn()?;
    let mut tx = conn.start_transaction(TxOpts::default())?;
    let retired: bool = tx
        .query_first("SELECT bootstrap_retired FROM admin_security_state WHERE id=1 FOR UPDATE")?
        .ok_or(Error::Database)?;
    let count: u64 = tx
        .query_first("SELECT COUNT(*) FROM admin_staff")?
        .ok_or(Error::Database)?;
    if count == 0 {
        if retired {
            return Err(Error::Database);
        }
        if password_hash.is_empty() {
            return Err(Error::Invalid(
                "ADMIN_BOOTSTRAP_PASSWORD_HASH is required to initialize an empty admin store",
            ));
        }
        tx.exec_drop("INSERT INTO admin_staff (username,password_hash,role,is_bootstrap) VALUES (:username,:hash,'owner',TRUE)", params! {"username"=>username,"hash"=>password_hash})?;
        let actor = Actor {
            account_id: tx.last_insert_id().ok_or(Error::Database)?,
            username: username.into(),
            role: "owner".into(),
            is_bootstrap: true,
            permissions: permissions("owner"),
        };
        audit(
            &mut tx,
            &actor,
            "bootstrap.created",
            "staff",
            "success",
            "Initial owner provisioned",
        )?;
    } else if count > 1 && !retired {
        // Defensive reconciliation for imports. Retirement never reverses.
        tx.query_drop("UPDATE admin_security_state SET bootstrap_retired=TRUE WHERE id=1")?;
        tx.query_drop("UPDATE admin_staff SET enabled=FALSE,updated_at=UTC_TIMESTAMP(3) WHERE is_bootstrap=TRUE")?;
        tx.query_drop("DELETE s FROM admin_sessions s JOIN admin_staff a ON a.id=s.staff_id WHERE a.is_bootstrap=TRUE")?;
    }
    tx.commit()?;
    Ok(())
}

pub(crate) fn ready(pool: &Pool) -> Result<()> {
    let mut conn = pool.get_conn()?;
    let exists: Option<u8> = conn.query_first("SELECT id FROM admin_security_state WHERE id=1")?;
    if exists != Some(1) {
        return Err(Error::Database);
    }
    conn.query_drop("SELECT id FROM admin_staff LIMIT 0")?;
    conn.query_drop("SELECT token_hash FROM admin_sessions LIMIT 0")?;
    conn.query_drop("SELECT id FROM admin_audit LIMIT 0")?;
    Ok(())
}

/// Use inside a control transaction for mutations; retirement/disable is checked each time.
pub(crate) fn require_session(
    db: &mut impl Queryable,
    digest: &[u8; 32],
    permission: &str,
) -> Result<Actor> {
    let row: Option<(u64,String,String,bool)> = db.exec_first(
        "SELECT a.id,a.username,a.role,a.is_bootstrap FROM admin_sessions s JOIN admin_staff a ON a.id=s.staff_id JOIN admin_security_state c ON c.id=1 WHERE s.token_hash=:token AND s.expires_at>UTC_TIMESTAMP(3) AND a.enabled=TRUE AND (a.is_bootstrap=FALSE OR c.bootstrap_retired=FALSE)", params! {"token"=>digest.as_slice()})?;
    let (account_id, username, role, is_bootstrap) = row.ok_or(Error::Unauthorized)?;
    let permissions = permissions(&role);
    let actor = Actor {
        account_id,
        username,
        role,
        is_bootstrap,
        permissions,
    };
    if !permission.is_empty() && !actor.allows(permission) {
        return Err(Error::Forbidden);
    }
    Ok(actor)
}

pub(crate) fn authenticate(pool: &Pool, digest: [u8; 32], permission: &str) -> Result<Actor> {
    require_session(&mut pool.get_conn()?, &digest, permission)
}

pub(crate) fn credential(pool: &Pool, username: &str) -> Result<Option<(u64, String)>> {
    let mut conn = pool.get_conn()?;
    Ok(conn.exec_first("SELECT a.id,a.password_hash FROM admin_staff a JOIN admin_security_state c ON c.id=1 WHERE a.username=:username AND a.enabled=TRUE AND (a.is_bootstrap=FALSE OR c.bootstrap_retired=FALSE)",params!{"username"=>username})?)
}

pub(crate) fn create_session(
    pool: &Pool,
    id: u64,
    verified_hash: &str,
    digest: [u8; 32],
) -> Result<Actor> {
    let mut conn = pool.get_conn()?;
    let mut tx = conn.start_transaction(TxOpts::default())?;
    tx.query_drop("SELECT id FROM admin_security_state WHERE id=1 FOR UPDATE")?;
    let row: Option<(String,String,bool)> = tx.exec_first("SELECT a.username,a.role,a.is_bootstrap FROM admin_staff a JOIN admin_security_state c ON c.id=1 WHERE a.id=:id AND a.password_hash=:hash AND a.enabled=TRUE AND (a.is_bootstrap=FALSE OR c.bootstrap_retired=FALSE)",params!{"id"=>id,"hash"=>verified_hash})?;
    let (username, role, is_bootstrap) = row.ok_or(Error::Unauthorized)?;
    let actor = Actor {
        account_id: id,
        username,
        permissions: permissions(&role),
        role,
        is_bootstrap,
    };
    tx.query_drop("DELETE FROM admin_sessions WHERE expires_at<=UTC_TIMESTAMP(3)")?;
    // Bound sessions per person while preserving sessions owned by other staff.
    let count: u64 = tx
        .exec_first(
            "SELECT COUNT(*) FROM admin_sessions WHERE staff_id=:id",
            params! {"id"=>id},
        )?
        .unwrap_or(0);
    if count >= 16 {
        tx.exec_drop(
            "DELETE FROM admin_sessions WHERE staff_id=:id ORDER BY created_at LIMIT 1",
            params! {"id"=>id},
        )?;
    }
    tx.exec_drop("INSERT INTO admin_sessions (token_hash,staff_id,expires_at) VALUES (:token,:id,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 8 HOUR))",params!{"token"=>digest.as_slice(),"id"=>id})?;
    audit(
        &mut tx,
        &actor,
        "session.login",
        "session",
        "success",
        "Password login",
    )?;
    tx.commit()?;
    Ok(actor)
}
pub(crate) fn logout(pool: &Pool, digest: [u8; 32]) -> Result<()> {
    let mut conn = pool.get_conn()?;
    let mut tx = conn.start_transaction(TxOpts::default())?;
    tx.query_drop("SELECT id FROM admin_security_state WHERE id=1 FOR UPDATE")?;
    match require_session(&mut tx, &digest, "") {
        Ok(actor) => {
            tx.exec_drop(
                "DELETE FROM admin_sessions WHERE token_hash=:token",
                params! {"token"=>digest.as_slice()},
            )?;
            audit(
                &mut tx,
                &actor,
                "session.logout",
                "session",
                "success",
                "Staff logout",
            )?;
        }
        Err(Error::Unauthorized) => {}
        Err(err) => return Err(err),
    }
    tx.commit()?;
    Ok(())
}

#[derive(Serialize)]
pub(crate) struct Staff {
    pub account_id: u64,
    pub username: String,
    pub role: String,
    pub enabled: bool,
    pub is_bootstrap: bool,
    pub created_at: String,
    pub updated_at: String,
}
fn staff_row(row: (u64, String, String, bool, bool, String, String)) -> Staff {
    let (account_id, username, role, enabled, is_bootstrap, created_at, updated_at) = row;
    Staff {
        account_id,
        username,
        role,
        enabled,
        is_bootstrap,
        created_at,
        updated_at,
    }
}
const STAFF_COLUMNS: &str = "id,username,role,enabled,is_bootstrap,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ'),DATE_FORMAT(updated_at,'%Y-%m-%dT%H:%i:%s.%fZ')";
fn staff(db: &mut impl Queryable, id: u64) -> Result<Staff> {
    Ok(staff_row(
        db.exec_first(
            format!("SELECT {STAFF_COLUMNS} FROM admin_staff WHERE id=:id"),
            params! {"id"=>id},
        )?
        .ok_or(Error::NotFound)?,
    ))
}
#[derive(Serialize)]
pub(crate) struct StaffList {
    pub accounts: Vec<Staff>,
    pub bootstrap_retired: bool,
}
pub(crate) fn list_staff(pool: &Pool, digest: [u8; 32]) -> Result<StaffList> {
    let mut conn = pool.get_conn()?;
    require_session(&mut conn, &digest, "staff:manage")?;
    let accounts = conn.query_map(
        format!("SELECT {STAFF_COLUMNS} FROM admin_staff ORDER BY id"),
        staff_row,
    )?;
    let bootstrap_retired = conn
        .query_first("SELECT bootstrap_retired FROM admin_security_state WHERE id=1")?
        .ok_or(Error::Database)?;
    Ok(StaffList {
        accounts,
        bootstrap_retired,
    })
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct NewStaff {
    pub username: String,
    pub password: String,
    pub role: String,
    pub reason: String,
}
pub(crate) fn validate_new(input: &NewStaff) -> Result<()> {
    if !valid_username(&input.username) {
        return Err(Error::Invalid(
            "Username must be 3..64 lowercase letters, digits, dot, dash or underscore",
        ));
    }
    if !valid_password(&input.password) {
        return Err(Error::Invalid("Password must contain 16..128 bytes"));
    }
    if !valid_role(&input.role) {
        return Err(Error::Invalid("Unknown staff role"));
    }
    if !valid_reason(&input.reason) {
        return Err(Error::Invalid("A reason of 1..500 characters is required"));
    }
    Ok(())
}
pub(crate) fn create_staff(
    pool: &Pool,
    digest: [u8; 32],
    input: NewStaff,
    hash: String,
) -> Result<Staff> {
    let mut conn = pool.get_conn()?;
    let mut tx = conn.start_transaction(TxOpts::default())?;
    let retired: bool = tx
        .query_first("SELECT bootstrap_retired FROM admin_security_state WHERE id=1 FOR UPDATE")?
        .ok_or(Error::Database)?;
    let actor = require_session(&mut tx, &digest, "staff:manage")?;
    if !retired && input.role != "owner" {
        return Err(Error::Conflict(
            "The first named staff account must be an owner",
        ));
    }
    let duplicate: Option<u64> = tx.exec_first(
        "SELECT id FROM admin_staff WHERE username=:username",
        params! {"username"=>&input.username},
    )?;
    if duplicate.is_some() {
        return Err(Error::Conflict("Username already exists"));
    }
    tx.exec_drop(
        "INSERT INTO admin_staff (username,password_hash,role) VALUES (:username,:hash,:role)",
        params! {"username"=>&input.username,"hash"=>hash,"role"=>&input.role},
    )?;
    let id = tx.last_insert_id().ok_or(Error::Database)?;
    audit(
        &mut tx,
        &actor,
        "staff.created",
        &format!("staff:{id}"),
        "success",
        &input.reason,
    )?;
    if !retired {
        tx.query_drop("UPDATE admin_security_state SET bootstrap_retired=TRUE WHERE id=1")?;
        tx.query_drop("UPDATE admin_staff SET enabled=FALSE,updated_at=UTC_TIMESTAMP(3) WHERE is_bootstrap=TRUE")?;
        tx.query_drop("DELETE s FROM admin_sessions s JOIN admin_staff a ON a.id=s.staff_id WHERE a.is_bootstrap=TRUE")?;
        audit(
            &mut tx,
            &actor,
            "bootstrap.retired",
            "bootstrap",
            "success",
            "First named owner created; bootstrap access permanently disabled",
        )?;
    }
    let result = staff(&mut tx, id)?;
    tx.commit()?;
    Ok(result)
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct StaffUpdate {
    pub role: Option<String>,
    pub enabled: Option<bool>,
    pub password: Option<String>,
    pub reason: String,
}
pub(crate) fn validate_update(input: &StaffUpdate) -> Result<()> {
    if input.role.as_deref().is_some_and(|r| !valid_role(r)) {
        return Err(Error::Invalid("Unknown staff role"));
    }
    if input
        .password
        .as_deref()
        .is_some_and(|p| !valid_password(p))
    {
        return Err(Error::Invalid("Password must contain 16..128 bytes"));
    }
    if input.role.is_none() && input.enabled.is_none() && input.password.is_none() {
        return Err(Error::Invalid("No staff change supplied"));
    }
    if !valid_reason(&input.reason) {
        return Err(Error::Invalid("A reason of 1..500 characters is required"));
    }
    Ok(())
}
pub(crate) fn update_staff(
    pool: &Pool,
    digest: [u8; 32],
    id: u64,
    input: StaffUpdate,
    hash: Option<String>,
) -> Result<Staff> {
    let mut conn = pool.get_conn()?;
    let mut tx = conn.start_transaction(TxOpts::default())?;
    tx.query_drop("SELECT id FROM admin_security_state WHERE id=1 FOR UPDATE")?;
    let actor = require_session(&mut tx, &digest, "staff:manage")?;
    let target = staff(&mut tx, id)?;
    if target.is_bootstrap {
        return Err(Error::Conflict(
            "Bootstrap account cannot be modified or re-enabled",
        ));
    }
    let role = input.role.as_deref().unwrap_or(&target.role);
    let enabled = input.enabled.unwrap_or(target.enabled);
    if target.enabled && target.role == "owner" && (!enabled || role != "owner") {
        let owners:u64=tx.query_first("SELECT COUNT(*) FROM admin_staff WHERE enabled=TRUE AND role='owner' AND is_bootstrap=FALSE")?.ok_or(Error::Database)?;
        if owners <= 1 {
            return Err(Error::Conflict(
                "The last active owner cannot be disabled or demoted",
            ));
        }
    }
    tx.exec_drop("UPDATE admin_staff SET role=:role,enabled=:enabled,updated_at=UTC_TIMESTAMP(3) WHERE id=:id",params!{"role"=>role,"enabled"=>enabled,"id"=>id})?;
    if let Some(hash) = hash {
        tx.exec_drop(
            "UPDATE admin_staff SET password_hash=:hash WHERE id=:id",
            params! {"hash"=>hash,"id"=>id},
        )?;
        audit(
            &mut tx,
            &actor,
            "staff.password_changed",
            &format!("staff:{id}"),
            "success",
            &input.reason,
        )?;
    }
    // Every role/enable/password change revokes all of that person's sessions.
    tx.exec_drop(
        "DELETE FROM admin_sessions WHERE staff_id=:id",
        params! {"id"=>id},
    )?;
    audit(
        &mut tx,
        &actor,
        "staff.updated",
        &format!("staff:{id}"),
        "success",
        &input.reason,
    )?;
    let result = staff(&mut tx, id)?;
    tx.commit()?;
    Ok(result)
}

#[derive(Serialize)]
pub(crate) struct AuditEntry {
    id: u64,
    actor_id: u64,
    actor_username: String,
    action: String,
    target: String,
    outcome: String,
    reason: String,
    created_at: String,
}
#[derive(Serialize)]
pub(crate) struct AuditPage {
    entries: Vec<AuditEntry>,
    page: u64,
    page_size: u64,
    total: u64,
}
pub(crate) fn list_audit(
    pool: &Pool,
    digest: [u8; 32],
    page: u64,
    page_size: u64,
) -> Result<AuditPage> {
    let mut conn = pool.get_conn()?;
    require_session(&mut conn, &digest, "audit:read")?;
    let total = conn
        .query_first("SELECT COUNT(*) FROM admin_audit")?
        .ok_or(Error::Database)?;
    let entries=conn.exec_map("SELECT id,actor_id,actor_username,action,target,outcome,reason,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') FROM admin_audit ORDER BY id DESC LIMIT :limit OFFSET :offset",params!{"limit"=>page_size,"offset"=>(page-1)*page_size},|(id,actor_id,actor_username,action,target,outcome,reason,created_at)|AuditEntry{id,actor_id,actor_username,action,target,outcome,reason,created_at})?;
    Ok(AuditPage {
        entries,
        page,
        page_size,
        total,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use argon2::{Argon2, PasswordHasher, password_hash::SaltString};
    #[test]
    fn permissions_are_explicit_and_unknown_roles_fail_closed() {
        assert!(permissions("owner").contains(&"staff:manage"));
        assert!(permissions("operator").contains(&"registrations:read"));
        assert!(!permissions("operator").contains(&"audit:read"));
        assert!(!permissions("viewer").contains(&"registrations:read"));
        assert!(permissions("viewer").contains(&"analytics:read"));
        assert!(permissions("administrator").is_empty());
    }
    #[test]
    fn staff_input_has_bounded_credentials_and_required_reason() {
        assert!(!valid_username("Uppercase"));
        assert!(!valid_username("x"));
        assert!(valid_username("named.owner-1"));
        assert!(!valid_password("too short"));
        assert!(valid_password(&"x".repeat(16)));
        assert!(!valid_password(&"x".repeat(129)));
        assert!(
            validate_update(&StaffUpdate {
                role: None,
                enabled: None,
                password: None,
                reason: "test".into()
            })
            .is_err()
        );
        assert!(!valid_reason("   "));
    }

    /// Explicitly opt in against a new empty local schema; never uses the app .env file.
    #[test]
    #[ignore = "requires ADMIN_TEST_CONTROL_URL pointing at a fresh nc_admin_test_* schema"]
    fn mysql_staff_lifecycle_is_durable_and_revokes_access() {
        let url = std::env::var("ADMIN_TEST_CONTROL_URL").expect("explicit disposable control URL");
        let opts = mysql::Opts::from_url(&url).expect("control URL");
        assert!(
            opts.get_db_name()
                .is_some_and(|name| name.starts_with("nc_admin_test_")),
            "test schema must start nc_admin_test_"
        );
        assert!(
            matches!(
                opts.get_ip_or_hostname().as_ref(),
                "127.0.0.1" | "localhost" | "::1"
            ),
            "integration test must use local disposable MySQL"
        );
        let pool = Pool::new(opts).unwrap();
        let mut conn = pool.get_conn().unwrap();
        // Provisioning migrations can be resumed, but this destructive lifecycle test
        // still requires an empty schema and must never reuse an existing identity store.
        let existing_tables: u64 = conn
            .query_first(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()",
            )
            .unwrap()
            .unwrap();
        assert_eq!(
            existing_tables, 0,
            "test requires a fresh empty disposable schema"
        );
        for statement in include_str!("../migrations/0001_staff.sql").split(';') {
            if !statement.trim().is_empty() {
                conn.query_drop(statement).unwrap();
            }
        }
        let hash = Argon2::default()
            .hash_password(
                b"a sufficiently long test password",
                &SaltString::encode_b64(b"test unique salt").unwrap(),
            )
            .unwrap()
            .to_string();
        assert!(matches!(
            initialize(&pool, "defaultadmin", ""),
            Err(Error::Invalid(_))
        ));
        initialize(&pool, "defaultadmin", &hash).unwrap();
        let (bootstrap_id, _) = credential(&pool, "defaultadmin").unwrap().unwrap();
        let bootstrap_session = [1; 32];
        create_session(&pool, bootstrap_id, &hash, bootstrap_session).unwrap();
        let new_staff = |name: &str, role: &str| NewStaff {
            username: name.into(),
            password: "a sufficiently long test password".into(),
            role: role.into(),
            reason: "Integration test provisioning".into(),
        };
        assert!(matches!(
            create_staff(
                &pool,
                bootstrap_session,
                new_staff("viewer-one", "viewer"),
                hash.clone()
            ),
            Err(Error::Conflict(_))
        ));
        let owner = create_staff(
            &pool,
            bootstrap_session,
            new_staff("owner-one", "owner"),
            hash.clone(),
        )
        .unwrap();
        assert!(matches!(
            authenticate(&pool, bootstrap_session, ""),
            Err(Error::Unauthorized)
        ));
        assert!(credential(&pool, "defaultadmin").unwrap().is_none());
        initialize(&pool, "admin", "").unwrap();
        assert!(
            credential(&pool, "defaultadmin").unwrap().is_none(),
            "restart never restores bootstrap"
        );
        let owner_session = [2; 32];
        create_session(&pool, owner.account_id, &hash, owner_session).unwrap();
        let viewer = create_staff(
            &pool,
            owner_session,
            new_staff("viewer-one", "viewer"),
            hash.clone(),
        )
        .unwrap();
        let viewer_session = [3; 32];
        create_session(&pool, viewer.account_id, &hash, viewer_session).unwrap();
        authenticate(&pool, viewer_session, "overview:read").unwrap();
        assert!(matches!(
            authenticate(&pool, viewer_session, "registrations:read"),
            Err(Error::Forbidden)
        ));
        let operator = create_staff(
            &pool,
            owner_session,
            new_staff("operator-one", "operator"),
            hash.clone(),
        )
        .unwrap();
        let operator_session = [4; 32];
        create_session(&pool, operator.account_id, &hash, operator_session).unwrap();
        authenticate(&pool, operator_session, "registrations:read").unwrap();
        assert!(matches!(
            authenticate(&pool, operator_session, "staff:manage"),
            Err(Error::Forbidden)
        ));
        // Re-running provisioning after bootstrap retirement must not re-enable
        // its login, replace staff identities, delete sessions, or erase audit history.
        let staff_before: Vec<(u64, String, String, String, bool, bool)> = conn.query("SELECT id,username,password_hash,role,enabled,is_bootstrap FROM admin_staff ORDER BY id").unwrap();
        let sessions_before: u64 = conn
            .query_first("SELECT COUNT(*) FROM admin_sessions")
            .unwrap()
            .unwrap();
        let audit_before: u64 = conn
            .query_first("SELECT COUNT(*) FROM admin_audit")
            .unwrap()
            .unwrap();
        for statement in include_str!("../migrations/0001_staff.sql").split(';') {
            if !statement.trim().is_empty() {
                conn.query_drop(statement).unwrap();
            }
        }
        let staff_after: Vec<(u64, String, String, String, bool, bool)> = conn.query("SELECT id,username,password_hash,role,enabled,is_bootstrap FROM admin_staff ORDER BY id").unwrap();
        assert_eq!(
            staff_after, staff_before,
            "resume preserves staff identities and credentials"
        );
        assert_eq!(
            conn.query_first::<u64, _>("SELECT COUNT(*) FROM admin_sessions")
                .unwrap()
                .unwrap(),
            sessions_before,
            "resume preserves live sessions"
        );
        assert_eq!(
            conn.query_first::<u64, _>("SELECT COUNT(*) FROM admin_audit")
                .unwrap()
                .unwrap(),
            audit_before,
            "resume preserves the audit history"
        );
        assert_eq!(
            conn.query_first::<bool, _>(
                "SELECT bootstrap_retired FROM admin_security_state WHERE id=1"
            )
            .unwrap(),
            Some(true)
        );
        assert!(
            credential(&pool, "defaultadmin").unwrap().is_none(),
            "resume never restores the bootstrap login"
        );
        authenticate(&pool, owner_session, "staff:manage").unwrap();
        authenticate(&pool, viewer_session, "overview:read").unwrap();
        authenticate(&pool, operator_session, "registrations:read").unwrap();
        let change = |role: Option<&str>, enabled: Option<bool>| StaffUpdate {
            role: role.map(str::to_owned),
            enabled,
            password: None,
            reason: "Integration test staff change".into(),
        };
        assert!(matches!(
            update_staff(
                &pool,
                owner_session,
                owner.account_id,
                change(None, Some(false)),
                None
            ),
            Err(Error::Conflict(_))
        ));
        assert!(matches!(
            update_staff(
                &pool,
                owner_session,
                owner.account_id,
                change(Some("viewer"), None),
                None
            ),
            Err(Error::Conflict(_))
        ));
        assert!(matches!(
            update_staff(
                &pool,
                owner_session,
                bootstrap_id,
                change(None, Some(true)),
                None
            ),
            Err(Error::Conflict(_))
        ));
        update_staff(
            &pool,
            owner_session,
            viewer.account_id,
            change(Some("operator"), None),
            None,
        )
        .unwrap();
        assert!(
            matches!(
                authenticate(&pool, viewer_session, "overview:read"),
                Err(Error::Unauthorized)
            ),
            "role changes revoke sessions"
        );
        update_staff(
            &pool,
            owner_session,
            operator.account_id,
            StaffUpdate {
                password: Some("new sufficiently long test password".into()),
                ..change(None, None)
            },
            Some(hash.clone()),
        )
        .unwrap();
        assert!(
            matches!(
                authenticate(&pool, operator_session, "registrations:read"),
                Err(Error::Unauthorized)
            ),
            "password changes revoke sessions"
        );
        let owner2 = create_staff(
            &pool,
            owner_session,
            new_staff("owner-two", "owner"),
            hash.clone(),
        )
        .unwrap();
        let owner2_session = [5; 32];
        create_session(&pool, owner2.account_id, &hash, owner2_session).unwrap();
        update_staff(
            &pool,
            owner2_session,
            owner.account_id,
            change(None, Some(false)),
            None,
        )
        .unwrap();
        assert!(matches!(
            authenticate(&pool, owner_session, "staff:manage"),
            Err(Error::Unauthorized)
        ));
        let audit = list_audit(&pool, owner2_session, 1, 100).unwrap();
        assert!(
            audit
                .entries
                .iter()
                .any(|entry| entry.action == "bootstrap.retired")
        );
        assert!(
            audit
                .entries
                .iter()
                .any(|entry| entry.action == "staff.password_changed")
        );
        logout(&pool, owner2_session).unwrap();
        assert!(matches!(
            authenticate(&pool, owner2_session, ""),
            Err(Error::Unauthorized)
        ));
        let expired = [6; 32];
        create_session(&pool, owner2.account_id, &hash, expired).unwrap();
        conn.exec_drop("UPDATE admin_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE token_hash=:token",params!{"token"=>expired.as_slice()}).unwrap();
        assert!(matches!(
            authenticate(&pool, expired, ""),
            Err(Error::Unauthorized)
        ));

        // Two owners racing to demote themselves cannot remove the final owner.
        let owner2_session = [7; 32];
        create_session(&pool, owner2.account_id, &hash, owner2_session).unwrap();
        let owner3 = create_staff(
            &pool,
            owner2_session,
            new_staff("owner-three", "owner"),
            hash.clone(),
        )
        .unwrap();
        let owner3_session = [8; 32];
        create_session(&pool, owner3.account_id, &hash, owner3_session).unwrap();
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
        let jobs: Vec<_> = [
            (owner2.account_id, owner2_session),
            (owner3.account_id, owner3_session),
        ]
        .into_iter()
        .map(|(id, session)| {
            let pool = pool.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                barrier.wait();
                update_staff(
                    &pool,
                    session,
                    id,
                    StaffUpdate {
                        role: Some("viewer".into()),
                        enabled: None,
                        password: None,
                        reason: "Concurrent last-owner protection check".into(),
                    },
                    None,
                )
            })
        })
        .collect();
        let results: Vec<_> = jobs.into_iter().map(|job| job.join().unwrap()).collect();
        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(
            results
                .iter()
                .filter(|result| matches!(result, Err(Error::Conflict(_))))
                .count(),
            1
        );
        let remaining: u64=conn.query_first("SELECT COUNT(*) FROM admin_staff WHERE role='owner' AND enabled=TRUE AND is_bootstrap=FALSE").unwrap().unwrap();
        assert_eq!(remaining, 1);
    }
}
