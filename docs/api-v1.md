# Naija Chase service API v1

## First-login avatar selection

Authenticated clients read the ten procedural presets from
`GET /v1/avatar/options`, inspect the current choice with
`GET /v1/profile/avatar`, and save one stable preset ID with
`PUT /v1/profile/avatar`. Login and `/v1/auth/me` include
`player.avatar_setup_complete`; the frontend uses it to show the first-login
picker before the case desk. Exact payloads and Babylon.js guidance are in
[`p374-avatar-api.md`](p374-avatar-api.md).

Mission economy and transport use `GET /v1/cases/{case_id}/transport-quotes` for authoritative choices and `GET /v1/cases/{case_id}/ledger` for read-only spending history. Movement commands choose a mode but never submit a fare or duration. Complete examples are in [`p373-mission-budget-transport-api.md`](p373-mission-budget-transport-api.md).

Witness pressure, earned bribe tokens, disciplinary panels, and jail use the
authoritative endpoints documented in
[`p391-witness-pressure-api.md`](p391-witness-pressure-api.md). The client never
submits hidden assignments, random rolls, votes, punishment, or balance changes.

The Rust API keeps hidden routes, thief identities, answer keys, hideouts, and
timing rules on the server. Clients send player intent only.

## Authentication

Naija Chase uses verified email/password accounts. Passwords are hashed with
Argon2id and never stored in plaintext. Confirmation and session tokens contain
32 random bytes; MySQL stores only their SHA-256 hashes. Login sets a 24-hour
opaque `nc_session` cookie with `HttpOnly`, `SameSite=Lax`, and `Secure` in
production. Sessions can be rotated, revoked individually, or revoked across
all devices. Reuse of a rotated token revokes its session family. Production
mutations require the configured web origin as CSRF protection.

Configure these values in the repository `.env`:

```dotenv
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_EMAIL_API_TOKEN=
NAIJACHASE_EMAIL_FROM=
NAIJACHASE_PUBLIC_WEB_URL=http://127.0.0.1:4173
NAIJACHASE_ALLOWED_ORIGINS=http://localhost:4173,http://127.0.0.1:4173
```

The sender must be authorized in Cloudflare. The public web URL becomes the
base of each one-time confirmation link. Registration commits the account,
confirmation token, and durable outbox row in one transaction, then returns
immediately. A background worker claims queued mail, retries temporary provider
failures with bounded backoff, and recovers rows left in-flight by a restart.
Password-reset mail uses the same outbox. Sent, expired, superseded, and
terminally failed rows have their address, link, and message bodies erased. A
provider outage does not delete the account or turn registration into a 502.
The account remains unable to log in until its confirmation token is consumed.

`CLOUDFLARE_ACCOUNT_ID` must be the Cloudflare **account ID**, not a zone ID.
In Compute → Email Service → Email Sending, onboard the sender domain and wait
for its SPF/DKIM status to become active. The API token needs the account-level
`Email Sending: Edit` permission. Email Sending must be available on the
account; Email Routing alone does not activate this REST endpoint. Restart the
API after changing `.env`; repository `.env` values override stale variables
inherited from an IDE or parent shell.

- `POST /v1/auth/register`: `email`, `username`, `home_base`, `password`,
  `confirm_password`, and required integer `dob_day`, `dob_month`, `dob_year`;
  both clients and the server reject invalid/future dates and applicants under
  18 (using today's UTC date). The server uses its own clock independently of
  client time or dropdown restrictions. The 18th birthday is eligible; February 29
  birthdays become eligible on March 1 in a non-leap year. Underage requests
  return `400` with "You must be 18 years or older."; missing or wrongly typed
  fields return `422`. DOB is persisted privately as `players.date_of_birth`
  and is not included in public account/profile responses.
  Returns after the account and confirmation token are
  persisted, without waiting for Cloudflare delivery.
- `POST /v1/auth/confirm`: consumes the one-time `token` from the email link.
- `POST /v1/auth/confirmation/resend`: accepts `email`, invalidates unused old
  links, and transactionally queues a new 24-hour link. Unknown, verified, and
  pending accounts receive the same generic `202` response. The operation is
  rate-limited.
- `POST /v1/auth/login`: `email` and `password`; email must be confirmed.
- `POST /v1/auth/logout`: revokes the current session.
- `POST /v1/auth/logout-all`: revokes every session for the account.
- `POST /v1/auth/refresh`: rotates the current session token.
- `GET /v1/auth/sessions`: lists safe device-session metadata.
- `DELETE /v1/auth/sessions/{session_id}`: revokes one owned device session.
- `POST /v1/auth/recovery/request`: sends a generic, rate-limited recovery
  response without revealing whether an email is registered. A new request
  supersedes older unused reset links and queued messages.
- `POST /v1/auth/recovery/complete`: consumes a 30-minute recovery token,
  replaces the Argon2id password hash, and revokes all sessions.
- `GET /v1/auth/me`: returns the current public account.

## Profile and progression

- `GET /v1/profile` returns the authenticated account profile.
- `PUT /v1/profile` updates optional display name, pronouns/sex, avatar,
  uniform, home state/FCT, and future leaderboard consent.
- `GET /v1/progression/archive` returns only the player's completed cases and
  captured-thief records.
- `GET /v1/progression/achievements` returns server-awarded achievements.
- `GET /v1/progression/summary` returns points, rank, solved cases, visited
  jurisdictions, travel/deduction accuracy, achievements, and rank history.
- `GET /v1/progression/achievement-catalog` returns stable display metadata.

New cases inherit persisted career points. A home-base witness interview costs
20 percent less time, subject to a minimum one-minute cost; it is never free.
Case completion transactionally updates the archive, career, and achievements.
Leaderboard publication remains disabled until its fairness, privacy,
moderation, and anti-cheat requirements are implemented.

The machine-readable contract is `schemas/openapi-v1.json`; generated frontend
DTOs are in `contracts/typescript/api-v1.ts`, with integration guidance and
examples in `docs/ui-api-handoff.md`.

## Runtime limits

The API bounds work before it reaches MySQL. Configure these per API process:

```dotenv
MYSQL_POOL_MIN=2
MYSQL_POOL_MAX=32
MYSQL_POOL_WAIT_TIMEOUT_MS=2000
MYSQL_CONNECT_TIMEOUT_MS=5000
MYSQL_READ_TIMEOUT_MS=15000
MYSQL_WRITE_TIMEOUT_MS=15000
NAIJACHASE_REQUEST_TIMEOUT_SECONDS=25
NAIJACHASE_MAX_CONCURRENT_REQUESTS=128
```

Pool exhaustion returns `503` with `{"error":"database_busy",...}`. API
deadline expiry returns `503` with `{"error":"request_timed_out",...}` and
immediate load shedding returns `503` with `{"error":"service_busy",...}`.
Clients may offer a manual retry. They must not create a new command ID when
retrying a state-changing case command. Liveness remains available while the
application is shedding load; readiness performs a bounded MySQL check.

The general authenticated request limit is enforced through the shared MySQL
`general_rate_limits` table, not process memory, so adding API instances does
not multiply a player's allowance. The table has one row per player and is
deleted with the account. Sensitive authentication routes retain independent,
hashed-subject counters in `auth_rate_limits`; these are intentionally not
combined with the general authenticated allowance.

These are starting values, not permanent capacity claims. The combined
`MYSQL_POOL_MAX` of every API process must fit the database server's connection
budget, and changes should follow production-shaped load tests.

## Case endpoints

- `GET /health/live` reports process liveness.
- `GET /health/ready` checks MySQL readiness.
- `GET /metrics` exposes aggregate counters without private labels.
- `GET /v1/activity/current` is the canonical case-desk bootstrap. It returns
  the player's unfinished ordinary case, all unfinished replays, and all active
  or in-transit weekly attempts. Complete response shapes, field definitions,
  ID usage, refresh rules, and UI decisions are documented in
  [`current-activity-api.md`](current-activity-api.md).
- `GET /v1/cases/current` is the narrower compatibility endpoint for the
  ordinary case only. It deliberately does not report replays or weekly
  attempts. See [`current-case-api.md`](current-case-api.md).
- `POST /v1/cases/{case_id}/abandon` permanently ends an unfinished ordinary
  case, discards its uncommitted progression, releases its mission assignment,
  and permits a new case. Replays and weekly attempts are excluded. The full
  confirmation, request, response, race, and error contract is in
  [`abandon-case-api.md`](abandon-case-api.md).
- `POST /v1/cases` accepts `{}` and assigns a server-selected, published mission
  the player has never solved. When an unfinished ordinary case already exists,
  it returns that case instead of creating another. It returns
  `catalogue_exhausted` when none remain.
- `POST /v1/cases/replay` accepts `mission_id` and starts a completed mission as
  an explicit replay. Replays are labelled and cannot repeat progression or
  first-completion rewards.
- `GET /v1/cases/catalogue-status` returns the live published, completed, and
  unseen counts plus the per-player exhaustion flag.
- `GET /v1/cases/catalogue-notifications` lists new releases for players who had
  exhausted the catalogue; `POST .../{notification_id}/read` acknowledges one.
- Restricted content-role endpoints under `/v1/admin/catalogue` expose health,
  mission validation, lifecycle history, scheduling, publication, and retirement.
  See `docs/p372-continuous-catalogue-api.md` for complete examples.
- `GET /v1/cases/{case_id}` returns its public state to its owner.
- `POST /v1/cases/{case_id}/commands` executes one validated command.

Case endpoints require a valid session cookie. Commands require a unique
client-generated `command_id` and the last observed `expected_version`. MySQL
locks the case, verifies ownership and version, and atomically commits state,
events, audit data, and the new version. Retrying the same command returns its
original response; competing commands cannot both commit.

Mission IDs and random seeds for ordinary cases are server-selected. Clients
must not manufacture them. Every response includes `attempt_kind`; archive
entries additionally identify `first_completion`. A mission enters the solved
set exactly once, regardless of devices or retries.

Request bodies are limited to 32 KiB. Logs and metrics exclude passwords,
tokens, private player data, hidden routes, clues, and answers. Run `make p35`
for the service safety and recovery gate.
