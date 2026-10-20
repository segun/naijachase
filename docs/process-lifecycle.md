# API lifecycle and deployment

The API handles SIGTERM (systemd stop/restart) and SIGINT (Ctrl-C). Both stop
accepting connections and signal the weekly and email workers. Workers stop
starting work and finish their current operation, including email acknowledgements.
HTTP requests and workers share a 27-second drain deadline; the Tokio runtime
then has at most one second for cleanup. This fits the unit's 30-second
`TimeoutStopSec`. The normal request timeout is 25 seconds. At the deadline,
remaining async work is cancelled; a blocking database call cannot be cancelled
and the process exits after the bounded runtime cleanup. Durable email claims
can be reclaimed after their existing lease expires.

## Controlled release sequence

Normal API startup only reads `schema_migrations` and requires schema version 23.
It never applies DDL or imports content. An old/new schema mismatch fails startup
with a migration instruction. Migration 21 seeds the weekly-expiry lock row;
migration 22 adds the consented usage tables and versioned admin reporting views.
Migration 23 extends those reports and adds a definer procedure for narrowly
scoped player session revocation by the separate admin application.

1. Build the release (`make production-build`) and take a database backup using
   the deployment account. Review pending migrations and coordinate a single
   deployment operator. DDL is not transactionally rolled back by MySQL.
2. Provision separate MySQL principals using `deploy/mysql/migration-grants.sql`
   and `deploy/mysql/runtime-grants.sql` as DBA templates. Replace both password
   placeholders, database name if needed, and `localhost` with the correct API
   and deployment host identities. Do not reuse the old privileged principal.
   Migrations 22–23 require `CREATE VIEW`, `CREATE ROUTINE`, `ALTER ROUTINE` and
   `EXECUTE`: update an existing deployment principal's grants before applying
   them. Their reporting views/procedure use SQL SECURITY
   DEFINER; retain that definer account and its underlying read permissions so
   the separate admin principal can read views without base-table grants.
3. Provision the `naijachase-migrate` system user with read/execute access to the
   release tree. Keep the tree owned by the deployment operator. Install
   `/opt/naijachase/shared/migrations.env` owned by `naijachase-migrate`, mode 0600.
   Start from `config/environments/migrations.env.example`, set the production
   MySQL host/TLS settings, and use `MYSQL_USER=naijachase_migrate` with its
   separate secret. Its longer query timeout accommodates deployment DDL. The API OS user
   (`drawback-admin`) must not be able to read this file.
4. Set `MYSQL_USER=naijachase_api` and its separate password in `production.env`.
   Keep that file readable by the API OS user. Both systemd units explicitly set
   `NAIJACHASE_ENV_FILE`, so a repository `.env` cannot replace these accounts.
   A missing explicitly selected file fails startup rather than falling back.
5. Run `make deploy-migrate`. This installs and starts a oneshot service using
   only the migration credentials; systemd reports a failed migration as failure.
   Check `journalctl -u naijachase-migrate.service` and require successful exit
   before continuing. The migration service is never enabled for boot and is
   never an API startup dependency or `ExecStartPre`. Do not run concurrent
   migration deployments. For local work, use `NAIJACHASE_ENV_FILE=/path/to/migrations.env make db-migrate`.
6. Run `make install-api-service` when installing/updating the unit, otherwise
   `make restart-api`, then check readiness and API logs. For a code rollback,
   verify the older binary accepts the deployed schema; restore from backup or
   use a reviewed forward fix if the migration is incompatible.

The runtime SQL grants permit reads and gameplay/authentication/outbox writes,
plus the lifecycle columns used by the existing content administration API.
They grant no schema privileges, content-import writes, or grant option. The
migration principal has schema privileges scoped to this database and is never
loaded into the API service. Have the DBA inspect `SHOW GRANTS` for both new
principals, including inherited roles, and retire the old privileged runtime
credential once the switch has been verified. Provisioning templates are not
executed automatically by application startup.

The separate admin console uses one reporting principal with versioned view
reads and EXECUTE on the session-revoke procedure, plus a different control
principal for its own identity/audit/operational schema. Provision its rendered
grant files only after game migration 23 and both control migrations. It is
not started or published by the player deployment targets. See
[admin-deployment.md](admin-deployment.md) for the full sequence.

## Weekly expiry with multiple instances

Every instance may run the 60-second expiry timer. The sweep first locks the
single `scheduled_jobs` row for `weekly_expiry` inside the same transaction as
its updates, using `FOR UPDATE SKIP LOCKED`. A competing process returns without
waiting. Commit, rollback, connection loss or process death releases ownership;
there is no connection-scoped advisory lock to leak into the pool. Only open or
registration challenges past their deadline without a winner are changed, and
only active/in-transit attempts are expired, so repeat sweeps are idempotent.
This uses MySQL 8 locking, as does the existing email outbox worker.

Run `cargo test -p naijachase-api -p naijachase-storage` from `rust/` for lifecycle,
shutdown deadline and signal tests. The gated MySQL weekly integration test also
checks competing ownership, expiry and repeat expiry when
`NAIJACHASE_MYSQL_TEST=1` points at a disposable test database with migration
credentials. Do not enable that test against production.
