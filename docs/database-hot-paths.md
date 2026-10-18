# Database hot paths and round-trip controls

The API and MySQL server may run on different hosts, so a pool checkout and each
SQL exchange have measurable network cost. The October 2026 hot-path pass made
the following changes without introducing a session cache:

- `POST /v1/cases` now selects an unseen published mission, reads career points,
  builds the initial state, checks for an existing ordinary case, and persists
  the case, assignment, and audit record under one player lock and one storage
  transaction. It returns the existing case from that same operation during a
  concurrent or duplicate request.
- Protected requests now authenticate the session and consume the shared
  general-rate-limit slot using one connection and one transaction. Session
  `last_seen_at` is written at most once per minute rather than on every request.
- `GET /v1/progression/archive` no longer performs one metadata query per
  archived case. Attempt metadata is returned by the archive query itself.
- Progression achievements reuse the summary's existing connection.
- Ordinary and replay activity are fetched together rather than through two
  sequential pool checkouts. Weekly activity remains a separate query because it
  has a different lifecycle and schema.
- Every runtime pool checkout now uses the bounded acquisition path and records
  wait duration and failures.

## Metrics

`GET /metrics` exposes aggregate values without player, session, or token labels:

- `naijachase_auth_db_round_trips_total`
- `naijachase_auth_db_failures_total`
- `naijachase_auth_db_duration_microseconds_total`
- `naijachase_auth_db_duration_microseconds_max`
- `naijachase_mysql_pool_acquisitions_total`
- `naijachase_mysql_pool_acquisition_failures_total`
- `naijachase_mysql_pool_wait_microseconds_total`
- `naijachase_mysql_pool_wait_microseconds_max`

The API also emits a structured warning when a session authorization database
operation takes at least 100 ms. Calculate average authentication time from the
duration total divided by the round-trip count; alert on sustained increases,
not one isolated maximum.

## Query-plan verification

Migration 0020 replaces the shorter active-case index with
`(player_id, attempt_kind, updated_at, created_at)`. `EXPLAIN ANALYZE` against the
full 1,000-mission local catalogue confirmed:

- current ordinary/replay activity uses `idx_active_player_kind_recency`;
- mission assignment uses the publication index plus primary-key antijoins for
  completions and active assignments; a warmed run returned 1,000 eligible
  mission IDs in about 7.5 ms locally;
- session authentication uses the `player_sessions.token_hash` primary key.

This is production-shaped content, not production traffic. End-to-end latency,
remote-network effects, concurrent pool pressure, and database resource usage
still belong to the production-capacity load test.

## Session-cache decision

A session cache is deliberately not added yet. Combining authentication and
rate limiting removes the extra checkout while preserving immediate session
revocation across API replicas. Add a shared, short-lived cache only if deployed
metrics show authentication remains material; any future cache must have a
strict TTL, bounded size, and explicit invalidation for logout, rotation,
password reset, and account revocation.

Apply the index before deploying the new API:

```bash
make db-migrate
```

