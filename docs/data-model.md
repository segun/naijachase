# P3.4 data inventory and ownership

The checked-in CSV files remain the authoring source. MySQL is the validated
runtime representation. Content imports are replaceable and reproducible;
player records and live cases are mutable operational data and are never
overwritten by a content import.

Connections are configured through `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`,
`MYSQL_PASSWORD`, `MYSQL_DATABASE`, and `MYSQL_SSL_MODE`. Use
`MYSQL_SSL_MODE=required` for staging and production so the connection is
encrypted; `disabled` is the local-development default. Production database
accounts must also use MySQL's `REQUIRE SSL` policy so a client cannot silently
downgrade to plaintext. Credentials are never stored in source control.

Pool and network bounds are explicit: `MYSQL_POOL_MIN`, `MYSQL_POOL_MAX`,
`MYSQL_POOL_WAIT_TIMEOUT_MS`, `MYSQL_CONNECT_TIMEOUT_MS`, `MYSQL_READ_TIMEOUT_MS`, and
`MYSQL_WRITE_TIMEOUT_MS`. Production defaults to 2–32 connections per API
process, a 2-second pool wait, a 5-second connection timeout, and 15-second
read/write timeouts. Count
the maximum across every API process when sizing MySQL; do not raise it without
load-test and pool-wait evidence.

## Rebuild and recovery

`make db-rebuild` applies pending migrations, transactionally imports every
canonical CSV, validates SHA-256 checksums and row counts, exports the stored
catalogue, and proves that all 1,000 mission outcomes match. Running it again
is the idempotency check. `make db-verify` repeats the non-mutating validation.

Mutable operational data is deliberately separate from replaceable content.
Use `make db-backup` before maintenance and `make db-restore` to restore the
versioned JSON backup. `make db-test` exercises migrations, optimistic locking,
and an actual backup/change/restore recovery cycle against MySQL. `make p34`
runs the complete local and live-database P3.4 gate.

## Immutable content

| Area | Primary identifier | Principal relationships |
|---|---|---|
| locations | `location_id` | knowledge links, mission stops, venue placements |
| knowledge | `knowledge_id` | locations, clue formulations, clue atoms |
| thieves and profiles | `thief_id` | missions and trait assignments |
| venues and experiences | `venue_id` | state profiles, placements, clue atoms |
| missions and narratives | `mission_id` | thief, four authored anchor locations, clues, witnesses |
| clue atoms | `atom_id` | destination state, venue, knowledge, dialogue variants |
| dialogue variants | `variant_id` | clue atom |

The travel graph uses `(origin_state, destination_state)`. Location knowledge
uses `(location_id, knowledge_id, relation_type)`. State venue suitability uses
`(state, venue_id)`. These composite keys prevent duplicate edges.

The editorial review, coordinate match, and balance report CSVs are derived
quality-control records. They are included in the import manifest and checked
by checksum but are not required by the live game transaction path.

## Mutable operational data

- `players` owns identity only, including private `date_of_birth` (`DATE`).
  Migration 0016 leaves DOB null for existing accounts; new registrations require
  a valid DOB and enforce an age of at least 18 before inserting the account.
- `careers` owns points, solved missions, and an optimistic-lock version.
- `active_cases` owns the serialized versioned engine state and its optimistic
  lock version.
- `case_events` is the append-only command/event audit log. The unique
  `(case_id, command_id)` constraint makes retried commands idempotent.
- `email_outbox` durably owns queued confirmation and password-reset messages.
  Account/token creation and enqueueing share one transaction; workers claim
  due rows with row locking, retry transient failures, and erase recipient and
  message bodies after a terminal status.
- `general_rate_limits` stores one fixed-window request counter per player. Its
  player foreign key cascades on account deletion, bounding the table by the
  account population while making enforcement consistent across API instances.
- `auth_rate_limits` remains separate for sensitive unauthenticated operations;
  it keys hashed subjects by action so registration, login, confirmation resend,
  and recovery can use stricter limits without disclosing email addresses.
  Entries older than ten minutes are removed in small indexed batches.
- Migration 0020 gives active ordinary/replay lookup the composite
  `(player_id, attempt_kind, updated_at, created_at)` index used by the case-desk
  bootstrap and transactional case assignment.
- `terminal_careers` owns terminal-player career and resumable-case state. The
  terminal no longer reads or writes a repository JSON save file.

Engine rules remain in `naijachase-core`; storage persists inputs and outputs
without deciding whether a move, warrant, or arrest is valid.

### Loaded catalogue gameplay caches

`Catalogue::load` builds routes, per-mission/per-stage clue atom indices, local
travel cost lists, venue availability and opening budgets before publishing the
catalogue. Budgets aggregate each mission baseline once into a maximum for its
difficulty, retaining the existing reserve and rounding. Off-trail venue lists
are shared by state and clue rotation rather than duplicated per mission.
These caches belong to one catalogue snapshot; treat its source tables as
immutable and reload the catalogue to replace content. Player visits, funds,
elapsed time, dossier evidence and hideout selection remain dynamic.
Noncanonical saved routes use the original clue planner for compatibility.
New ordinary/replay attempts persist a private, attempt-specific `witness_plan`
in their existing state JSON. Actual saved interviews supply player history;
unvisited planned clues never become exposures. Weekly templates share a plan
across entrants. No SQL migration is needed. The cached mission plans above
remain the compatibility path for older attempts without snapshots. See
[`witness-selection.md`](witness-selection.md) for selection and coverage.
The content regression test compares independent loads and uncached calculations
for all 1,000 missions, every stage and all 37 possible current states.

Database hot-path transactions, query-plan evidence, metrics, and the decision
not to add a session cache prematurely are documented in
[`database-hot-paths.md`](database-hot-paths.md).

Schema migration 21 adds `scheduled_jobs` for transaction-scoped weekly expiry ownership. The API checks the schema without migrating; see [process lifecycle and deployment](process-lifecycle.md) for the separate migration service and runtime grants.
