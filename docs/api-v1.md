# Naija Chase service API v1

The API is a server-side application layer around `naijachase-core`. Clients
send intent only. They never submit or receive the hidden route, thief identity,
observed answer key, hideout, travel duration, or interview duration.

## Run and configure

Copy `.env.example` to `.env`, retain the existing MySQL settings, and set a
random API token. Start the service with `make api`. This token map is only a
bootstrap mechanism for local development and closed internal staging; it is
not the planned player login system and must not be used for public production.
P3.7 replaces it with proper accounts and revocable sessions.

Bootstrap tokens use the header `Authorization: Bearer <token>`. A token maps
to exactly one local test player. Token hashes are compared in constant time,
case ownership is checked for every read and mutation, request bodies are
limited to 32 KiB, and each player is rate-limited independently.

## Endpoints

- `GET /health/live` reports process liveness.
- `GET /health/ready` checks MySQL readiness.
- `GET /metrics` exposes aggregate counters with no player, case, clue, or
  answer labels.
- `POST /v1/cases` creates an owned case from `case_id`, `mission_id`, and an
  optional deterministic `seed`.
- `GET /v1/cases/{case_id}` returns its current public state to its owner.
- `POST /v1/cases/{case_id}/commands` executes one validated command.

Every command request requires a unique client-generated `command_id` and the
last observed `expected_version`. The database locks the case, checks ownership
and version, executes the core command, and commits the state, exact response,
audit event, and new version in one transaction. Retrying the same command ID
returns the original response with `duplicate: true`. Two different commands
using the same version cannot both commit.

The public state deliberately omits hidden engine fields. Errors use stable
codes and appropriate HTTP statuses: 400 validation, 401 authentication, 403
ownership, 404 missing case, 409 stale version, 422 rejected game command, 429
rate limit, and 500 for an opaque internal failure.

## Operations and verification

Logs are structured JSON. They contain request metadata and error categories,
not bearer tokens, private player data, hidden routes, clues, or answers.
`service_audit` records player, case, command ID, outcome, and timestamp only.
Use the P3.4 database backup and restore process for recovery.

Run `make p35` for unit, contract, load-guard, security, database recovery,
restart, duplicate-request, invalid-command, ownership, stale-version, and
concurrent-update checks.
