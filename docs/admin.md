# Independent administration console

The administration console is a separate application in `admin/backend/` and
`admin/frontend/`. It provides account growth, measured visitor and registration
activity, email queue state, system health, named staff access and operational
support workflows. The
player application remains responsible for gameplay, account registration,
and recording the small reporting dataset.

## Boundaries

| Component | Owns | Connection to the player application |
| --- | --- | --- |
| `admin/backend/` | Staff login/session, reporting, support workflows, host health | Versioned views plus one narrow session-revoke procedure; fixed local health/metrics probes |
| `admin/frontend/` | Separate admin UI, dependencies, build output | Calls only same-origin `/admin-api/v1`; no player frontend imports |
| Admin control schema | Staff, sessions, append-only audit/notes, support actions, moderation decisions, metric samples | Separate database and runtime principal; no player-schema grants |
| Player API | Player accounts, gameplay, consented measurement ingestion and retention | Publishes reporting/procedure contracts through migrations 22–23 |
| Deployment | Separate process, OS account, hostname, credentials and web root | No dependency on player/landing publication targets |

The Rust workspace/toolchain can be shared without linking the admin service
to the player API, storage implementation, or game engine. The database is
the explicit integration boundary. Changes to a reporting view's meaning or
columns need a compatible migration; introduce a new view version for a
breaking change. A reporting replica is a future option when the extra read
load warrants it; show its lag before using it for operational decisions.

The reporting principal receives `SELECT` on these views:

- `admin_reporting_accounts_v1(player_id, email, username, created_at, email_verified_at)`
- `admin_reporting_visitors_v1(visitor_hash, first_seen_at, last_seen_at, player_id)`
- `admin_reporting_registration_starts_v1(visitor_hash, email, started_at, updated_at)`
- `admin_reporting_email_queue_v1(status, created_at)`
- `admin_reporting_account_progress_v1`
- `admin_reporting_case_history_v1`
- `admin_reporting_activity_v1`
- `admin_reporting_moderation_v1`
- `admin_reporting_security_events_v1`
- `admin_reporting_email_health_v1`

The views omit password hashes, session/reset/verification tokens, hidden game
answers, and email message bodies. Account support can invoke only
`admin_revoke_player_sessions_v1(player_id)` to revoke that player's live
sessions, with a recorded reason and audit history. The reporting principal
has no arbitrary base-table reads/writes. The separate control principal has
table-specific permissions, including only INSERT/SELECT for audit and notes.
Do not solve a missing report by granting either principal whole-database access.
The admin Nginx access log uses the path without query strings, cookies or
authorization values, so account email search terms are not access-log fields.

## What the numbers mean

Account records and measured browser activity have different coverage. The UI
offers date windows, while all-time account totals come from existing account
records. Registration completion means email verification, rather than merely
submitting a registration form.

| Measure | Definition and interpretation |
| --- | --- |
| Registered accounts | Existing email account records, including accounts awaiting email verification; excludes terminal-only identities without an email |
| Verified accounts | Accounts with `email_verified_at` set |
| Awaiting verification | Email account records whose `email_verified_at` is still unset; includes accounts outside the selected date window |
| Recently online users | Distinct linked accounts with a measured visitor heartbeat in the last five minutes; approximate recent activity rather than a live connection count |
| Measured visitors | Distinct consenting browser identifiers observed in the selected reporting window; not a count of individual people |
| Registration starts | Consented opening of the signup form, including starts without an email; one current draft per browser identifier, rather than every click |
| Accounts created | Account records created in the selected window |
| Registrations completed | Accounts whose email was verified in the selected window; their account creation or first visit may have been earlier |
| Pending registration | Unique captured email without a matching verified account, still within the 24-hour abandonment window |
| Abandoned registration | Unique captured email without a matching verified account after 24 hours without draft activity; this threshold supports diagnostics, not a claim that the user will never return |
| Email queue | Counts of existing outbox statuses; queued/sent status is not proof that a message reached an inbox |

Only drafts with a captured email appear in the registration email list and
its pending/abandoned counts. These deduplicate normalized emails across
browsers: the earliest retained start chooses the reporting date window and
the most recent draft update determines pending versus abandoned. Starts
without an email still contribute to the total starts. A matching verified
email makes a draft completed; reopening the form or typing an email alone
does not complete verification. Dates are UTC.

Visitor and draft collection begins only after rollout and the browser's
explicit optional usage-measurement choice. No choice or a declined choice
means those visitor/draft events are not recorded. The registration form also
discloses capture of an unfinished signup's email. Existing accounts remain
countable independently of that choice. People who abandon before the email
capture point have no email to list, and unmeasured visits cannot be recovered
from this dashboard.

Multiple devices, cleared browser storage, blockers, offline tabs and withdrawn
consent affect the measurements. A browser identifier can represent more than
one person; one person can produce several identifiers. Recent activity is
limited to consenting browsers, so it can undercount logged-in users. Date
bucket totals are diagnostic trends; do not divide verification events by
visits and call that a cohort conversion rate. A proper conversion report
must follow the same starting cohort through its eventual outcome.

Retention is deliberately bounded: captured drafts expire after 30 days and
visitor records after 90 days through the player's hourly bounded cleanup.
Consequently an "all-time" visitor/draft interpretation would be misleading.
Historical account creation/verification remains available through account
records. No earlier visitor history is invented or backfilled.

Consent withdrawal is serialized against ingestion using a hash-only identity
marker retained for 90 days. A delayed request carrying a withdrawn identifier
cannot recreate its draft or visitor records. The browser also rechecks consent
before sending queued events and observes choice changes in other tabs. No
email or other account data is stored in the withdrawal marker.

Registration emails are personal data. Use the dashboard for diagnosing signup
and verification problems. It does not provide exports, bulk messages, or
automatic outreach, and capture is not marketing permission. Keep screenshots
and support notes free of email lists and secrets.

## Player measurement contract

The player API exposes `POST /v1/telemetry/usage` and
`DELETE /v1/telemetry/usage`, reached by the browser through
`/api/v1/telemetry/usage`. These are a small write/delete measurement boundary,
not admin routes. The frontend stores the optional choice as localStorage
`nc-usage-consent=yes|no`; unknown, declined or unavailable storage does not
send measurement events. Opening signup before allowing measurement does not
record a start. Choosing Allow while signup is open records that start.

A POST body has `kind: "visit"` or `kind: "registration_start"`, with an
optional `email` only for a registration start. Visits run at startup and once
per minute while a consented page is visible, and on returning to visibility.
Opening the signup form records a nullable-email start; leaving the email field
records its normalized valid email if measurement is allowed. The server
validates the request and Origin, limits accepted event rates to 12 per minute
per browser identifier and 600 per minute per ingress address, and hashes the
random browser identifier before storing it. A linked player ID is derived
only from a valid verified session, never from event input. Do not trust a
browser-supplied Origin or client address as authentication.

The separate opaque `nc_usage` cookie is HttpOnly, host scoped, SameSite Lax,
limited to `/api`, and Secure outside development, with a 90-day lifetime. It
contains no email and is separate from the player and admin session cookies.
Choosing No sends DELETE, which checks Origin, removes measurement rows for
that browser identifier and expires its cookie. It does not delete the account
or its operational authentication records. The event body contains no page
route, password, fingerprint or user-supplied player ID. Measurement failures
are best effort and must not block login, registration or play.

## Local development and checks

Apply player migrations through 23 against a disposable or staging database,
then both `admin/backend/migrations/0001_staff.sql` and `0002_operations.sql`
against a different control schema. Provision the reporting and control
principals with their separate grant templates. The view/procedure definer
must retain the underlying permissions; the admin principals must not receive
them. [admin-deployment.md](admin-deployment.md) provides the complete
production sequence and a helper that creates filled private env/SQL files.

Copy `config/environments/admin.env.example` to a private location outside the
checkout, fill in database credentials and an Argon2 PHC password hash, and
export those variables in the terminal running the backend. The admin service
does not implicitly load the player `.env`. Keep the single quotes around a
PHC hash when sourcing shell configuration because the hash contains `$`.

Generate the hash locally using the backend's stdin helper. This Bash/Zsh
example hides the password input and keeps it out of command arguments and
shell history; put the resulting PHC hash in the private environment file.

```sh
read -r -s ADMIN_NEW_PASSWORD
printf '\n'
printf '%s\n' "$ADMIN_NEW_PASSWORD" | cargo run --manifest-path rust/Cargo.toml -p naijachase-admin -- --hash-password
unset ADMIN_NEW_PASSWORD
```

```sh
make admin-install
make admin-check
make admin-build
```

In a backend terminal, load the private configuration and start the process:

```sh
set -a
. /absolute/private/path/admin.env
set +a
make admin-api
```

In another terminal run `make admin-web`, then open `http://127.0.0.1:4174`.
The Vite server proxies `/admin-api` to `http://127.0.0.1:8081`. Override
`ADMIN_API_TARGET` for the frontend and `ADMIN_BIND` for the backend together
when changing that port. The player's optional mock API also uses 8081, so
stop it or choose a different admin port while using both.

`admin/frontend/dist/` is the standalone frontend artifact. The backend binary
is `rust/target/release/naijachase-admin`. The frontend build contains no
operator or database secrets and always uses the same-origin API path.
`make admin-check` runs backend formatting/tests and frontend type/tests;
player changes still require the repository's normal API/web checks.

The shared source-sync target excludes admin frontend dependencies, build
output and local environment files. Installing or publishing the admin service
still requires its own deployment; source synchronization does not activate it.

The mutating player analytics integration test uses exported `MYSQL_*` settings
directly, requires a loopback host and a database name ending in `_test`, and
is enabled with `NAIJACHASE_MYSQL_TEST=1` while filtering to
`product_analytics::tests::live_mysql`. It never loads the player `.env`.
The admin's read-only SQL integration check uses
`NAIJACHASE_ADMIN_MYSQL_TEST=1` and its own `ADMIN_*` settings. Run database
checks against a disposable schema with the migration applied and verify the
reporting principal cannot read base tables or perform arbitrary writes.

## Verification

Validation on 20 October 2026 covered the complete staff and operational
implementation. Admin backend checks passed (13 tests); both opt-in database
tests were also run explicitly against disposable local schemas. Staff lifecycle
tests verified irreversible bootstrap retirement, restart without bootstrap
credentials, forced session revocation, and protection of the last owner under
concurrent changes. Restricted principals were denied base-table reads,
arbitrary player writes, audit changes and DDL.

All 17 admin frontend tests, Svelte diagnostics and the backend/frontend release
build passed. The player API/storage suites and required web checks passed
(355 web tests passed, one skipped). Migration 23 and the earlier measurement
retention/withdrawal integration ran on an explicitly isolated test database.
HTTP checks exercised exact analytics/cohort fixtures, all three roles, support
notes/session revocation, alert states, moderation escalation/final decisions,
audit attribution, origin rejection and default-account session retirement.
Desktop and phone browser checks covered setup, revoked access, named-owner
login, support details, reports, alerts, moderation and audit history; the
phone viewport had no page-level horizontal overflow.

Deployment helper checks verified matching generated SQL/environment secrets,
restrictive file permissions, overwrite/injection rejection, Nginx rollback and
HTTP downgrade refusal. Both HTTP bootstrap and HTTPS templates passed Nginx
syntax checks with a temporary local certificate. These checks do not confirm
a production rollout.

## Staff authentication and access

Staff use individual username/password identities with owner, operator and
viewer roles. Argon2id hashes, bounded login attempts, server-side sessions,
Origin checks and an HttpOnly/SameSite Strict cookie protect access. Production
uses a Secure host-only cookie. Player accounts cannot grant admin access.

The configured bootstrap username defaults to `admin`. Startup seeds it only
when the control staff store is empty. Its first task is creating a named
**owner**; this transaction permanently retires bootstrap and revokes all its
sessions. Later disabling staff or restarting cannot restore bootstrap. The
last enabled named owner cannot be disabled or demoted.

| Role | Access |
| --- | --- |
| Viewer | Aggregate overview, system readings, product analytics and alerts |
| Operator | Viewer access plus registration emails, account support and moderation decisions |
| Owner | Operator access plus staff management and audit history |

Staff creation, role changes, disabling, password resets, successful login and
logout, sensitive reporting access and support/moderation actions produce
audit records with actor, target, outcome and reason. The runtime cannot update
or delete audit/notes rows. This is database-level append-only access for that
principal, not a claim that a privileged DBA cannot modify records.

Sessions live in the control database, expire after eight hours, and are
capped at 16 per staff identity. A routine restart preserves them. Staff
disabling, password reset or role changes revoke affected sessions, and
permission checks consult current staff state. Login throttling remains
process-local; keep a single instance until shared throttling and any other
multi-instance operational controls have been verified.

The supplied Nginx site allows only loopback access initially. Add your real
office/IP or VPN CIDR for direct access, or follow the documented SSH tunnel
setup with a matching public origin. Do not expose the backend port directly.
No external identity provider is required.

## Operational areas

| Area | Available workflow and limits |
| --- | --- |
| Staff and audit | Create named accounts, select roles, disable/reset staff, inspect paginated audit history; bootstrap retires on the first named owner |
| Account support | Search by player ID/email/username/name, inspect verification, sessions, recent cases and security events; add append-only notes and revoke live sessions with a reason |
| Product analytics | Account activation, case starts/outcomes, consenting signed-in DAU/WAU/MAU and exact D1/D7/D30 return cohorts with elapsed-day eligibility |
| Abuse and moderation | Review reported accounts/evidence, record resolved/dismissed/escalated decisions with staff attribution and reasons; decisions are admin-owned records, not automatic player bans |
| Alerts and recovery | Email backlog/failures/stalled claims, sampled API errors/mean latency and weekly job freshness, backup-success freshness, disk and memory capacity |

Account activation follows accounts created in the selected period through
retained case history as of now; the steps are not a strict funnel. Case
outcomes count closures during the period, while starts count their own dates.
DAU/WAU/MAU use UTC calendar windows for consenting signed-in accounts only.
Retention requires a measured signup-day visit and the exact requested return
day to have fully elapsed; lost/withdrawn consent and 90-day cleanup reduce
coverage. These are measured cohorts, not inferred behavior for every account.

Session revocation first records an intent, then calls the restricted game
procedure, then records the outcome. The two schemas do not form one
transaction: a timeout/crash can leave a pending or unknown result. Inspect
active sessions and action history before retrying; do not interpret an
uncertain result as success or failure.

Moderation decisions live in the control database and leave the original game
report intact. An escalated report can receive a later final decision; a final
decision rejects conflicting subsequent changes. Use account support session
revocation separately if warranted; this release does not add an automatic
ban or gameplay penalty.

## Deployment and incident operations

Follow [admin-deployment.md](admin-deployment.md) for the exact server setup:
DNS, generated database secrets, game/control migrations, restricted grants,
private env, separate service, HTTP ACME bootstrap, actual certificate paths,
HTTPS activation and first named-owner handover. Admin publication is an
explicit deployment step; existing player/landing publication targets do not
activate it.

The HTTPS login page is public, with staff authentication and permission
checks enforced by the API. Existing Certbot admin blocks in Nginx's default
site can be moved using `make admin-nginx-move-from-default`; validation and
reload failures restore both the default and dedicated admin configuration.

Setup reuses the existing game's database host, port and encryption setting.
`ADMIN_MYSQL_SSL_MODE=required` has the same meaning as the game's `required`:
encryption is mandatory, without requiring a trusted certificate or matching
certificate hostname. Use `verify_identity` to additionally validate the
certificate chain and hostname, with an optional `ADMIN_MYSQL_SSL_CA` for a
private CA. The control connection inherits these settings. Production rejects
unencrypted database connections. The two generated database service passwords
are managed by setup; the operator chooses only the web login password.

System readings describe the machine/container and filesystem visible to the
admin process: CPU count, memory, load, uptime and the configured disk. They do
not report the remote MySQL host or an entire fleet. Missing measurements are
shown as unavailable. macOS available RAM is not currently reported. Inspect
the disk path/mount before equating its space with the game's filesystem.

`ADMIN_GAME_HEALTH_ENABLED=true` enables fixed loopback checks of game readiness
and metrics at port 8080. Leave it off when the game is elsewhere. API error
and mean-latency alerts require at least two compatible samples; a game process
restart resets the baseline. Metrics are evaluated while Alerts refreshes;
this console does not provide background paging or external notifications.
The existing Prometheus/Grafana stack remains the persistent monitoring path.

`ADMIN_BACKUP_STATUS_PATH` is an optional absolute local JSON file with
`last_success_at`, written by a real backup job. `ADMIN_BACKUP_MAX_AGE_HOURS`
defaults to 24. Missing configuration is shown as unconfigured; an unreadable,
invalid or stale configured record is an alert. The timestamp does not prove
that restoration was tested. Provider inbox delivery/bounce/suppression
webhooks, certificate expiry, release inventory and external paging are not
configured integrations in this release.

For console failures use `make admin-status`, then loopback liveness/readiness.
Check both databases, encryption settings, migrations and grants before broadening access.
Preserve the control schema during upgrades/rollback; it holds identity, audit,
notes and decisions. Reset staff passwords through another named owner and
rotate exposed database passwords in MySQL and the matching private env
separately. A restart alone does not revoke durable staff sessions. Do not
paste secrets or email lists into tickets. See
[operations-runbook.md](operations-runbook.md) for player API incidents.
