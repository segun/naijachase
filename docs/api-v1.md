# Naija Chase service API v1

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
base of each one-time confirmation link. Registration remains unavailable
until the three Cloudflare email values are filled.

- `POST /v1/auth/register`: `email`, `username`, `home_base`, `password`, and
  `confirm_password`.
- `POST /v1/auth/confirm`: consumes the one-time `token` from the email link.
- `POST /v1/auth/login`: `email` and `password`; email must be confirmed.
- `POST /v1/auth/logout`: revokes the current session.
- `POST /v1/auth/logout-all`: revokes every session for the account.
- `POST /v1/auth/refresh`: rotates the current session token.
- `GET /v1/auth/sessions`: lists safe device-session metadata.
- `DELETE /v1/auth/sessions/{session_id}`: revokes one owned device session.
- `POST /v1/auth/recovery/request`: sends a generic, rate-limited recovery
  response without revealing whether an email is registered.
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

## Case endpoints

- `GET /health/live` reports process liveness.
- `GET /health/ready` checks MySQL readiness.
- `GET /metrics` exposes aggregate counters without private labels.
- `POST /v1/cases` creates an owned case.
- `GET /v1/cases/{case_id}` returns its public state to its owner.
- `POST /v1/cases/{case_id}/commands` executes one validated command.

Case endpoints require a valid session cookie. Commands require a unique
client-generated `command_id` and the last observed `expected_version`. MySQL
locks the case, verifies ownership and version, and atomically commits state,
events, audit data, and the new version. Retrying the same command returns its
original response; competing commands cannot both commit.

Request bodies are limited to 32 KiB. Logs and metrics exclude passwords,
tokens, private player data, hidden routes, clues, and answers. Run `make p35`
for the service safety and recovery gate.
