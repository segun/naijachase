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
- `terminal_careers` owns terminal-player career and resumable-case state. The
  terminal no longer reads or writes a repository JSON save file.

Engine rules remain in `naijachase-core`; storage persists inputs and outputs
without deciding whether a move, warrant, or arrest is valid.
