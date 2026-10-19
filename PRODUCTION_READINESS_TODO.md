# Production readiness TODO

Created: 14 October 2026

Scope: Rust API and engine, remote MySQL storage, Svelte/Babylon.js web client,
3D delivery, deployment, reliability, security and launch operations.

The application has a strong base, but it should not be opened to thousands of
players until every **Launch blocker** is complete and verified. A small,
monitored beta is reasonable after those blockers are cleared.

## Launch blockers

### Secure and bound the remote MySQL connection

- [ ] Stop accepting invalid MySQL certificates.
- [ ] Enable MySQL certificate-chain verification.
- [ ] Enable MySQL hostname verification.
- [ ] Install/configure the trusted CA certificate on the API server.
- [ ] Prefer a private network between the API and database servers.
- [ ] Keep the database firewall restricted to the API server.
- [x] Add configurable MySQL minimum and maximum pool sizes.
- [x] Add configurable MySQL pool-wait, connection, read and write timeouts.
- [ ] Size the total connection limit across every API process against measured
  database capacity.
- [x] Give the readiness database check a short timeout.

Implemented defaults: 2 minimum connections, 32 maximum connections, a
2-second pool wait, a 5-second connection timeout, and 15-second read/write
timeouts. Every value is configurable through the environment. Readiness uses
the same bounded database acquisition and I/O path.

### Protect the API during slowdowns and traffic bursts

- [x] Add an application request deadline below Nginx's 30-second read timeout.
- [x] Add a bounded request-concurrency limit.
- [x] Add load shedding with a clear `503 Service Unavailable` response.
- [x] Bound slow or unavailable MySQL work so it cannot wait indefinitely for a
  pool connection or socket I/O.
- [x] Replace the unbounded in-memory rate-limiter map or expire idle entries.
- [x] Make general rate limiting consistent across multiple API instances,
  preferably at the edge or in a shared store.
- [x] Preserve database-backed limits for sensitive authentication operations.

Implemented in migration 19: authenticated general traffic uses a shared
MySQL fixed-window counter with one cascade-deleted row per player. This removes
the process-local map and makes limits consistent across API instances.
Registration, login, confirmation resend, and password recovery continue using
their separate hashed-subject MySQL limits. Both limiters use atomic upserts and
row locks so simultaneous first requests cannot bypass or break the counter.
Expired authentication subjects are removed in indexed, bounded batches.

Implemented defaults: a 25-second request deadline and 128 concurrent
requests. Saturated, timed-out and database-busy requests return stable JSON
`503` responses. Health and metrics endpoints remain outside gameplay load
shedding so operators can still diagnose saturation.

### Make 3D caching safe across releases

- [x] Give every deployed GLB a content-hashed filename, or append a build/content
  version to every model URL.
- [x] Keep one-year `immutable` caching only for versioned assets.
- [x] Make direct or unversioned `/assets/3d/` requests revalidate instead of
  caching immutable content for one year.
- [x] Test a deployment that replaces a model and confirm returning browsers load
  the new version.

Production builds inject a 20-character SHA-256 catalogue version into every GLB
URL. Nginx grants the one-year immutable policy only to 3D requests carrying that
version; unversioned model and texture requests revalidate. The existing build's
embedded version matches the current catalogue (`70d65c243ccb3407b433`), and a
replacement-byte test confirmed that changing a model produces a different URL
cache key. This behavior is also covered by `web/tests/models.test.mjs`.

### Prove production capacity

- [ ] Run end-to-end load tests through Nginx, Rust and the remote MySQL server.
- [ ] Use production-like content, database size and network latency.
- [ ] Cover ordinary gameplay, login bursts, case assignment, concurrent
  commands, archive reads and password recovery.
- [ ] Cover simultaneous Monday weekly-challenge starts and capture races.
- [ ] Record p50, p95 and p99 latency and error rates.
- [ ] Record API CPU, memory, active requests and blocking-task pressure.
- [ ] Record MySQL pool wait time, connections, slow queries, CPU, memory and I/O.
- [ ] Establish measured capacity and alert thresholds for the initial deployment.
- [ ] Run the tests again after every material pool, query or infrastructure change.

### Complete release and recovery gates

- [ ] Complete the outstanding account/session security and recovery tests from
  P3.11 in `TODO.md`.
- [ ] Implement a durable MySQL email outbox.
- [ ] Add bounded exponential email retries and dead-letter/support visibility.
- [ ] Add expiry-aware confirmation-token regeneration.
- [ ] Add a rate-limited resend-confirmation endpoint.
- [ ] Verify sender domain, Cloudflare account/token, delivery, bounce monitoring
  and suppression handling.
- [ ] Test confirmation and password-recovery delivery during provider failures.
- [ ] Complete backup restoration and incident-response exercises.
- [ ] Complete accessibility, localisation and supported-device reviews.
- [ ] Complete privacy policy, terms, retention, community rules and support plan.
- [ ] Define uptime objectives and a staged rollout/rollback procedure.

## Backend performance and reliability

### Remove repeated catalogue computation

- [x] Precompute opening budgets for every difficulty when the catalogue loads.
- [x] Precompute immutable per-mission, per-stage clue plans.
- [x] Precompute venue availability and other immutable route-derived data.
- [ ] Benchmark case creation and game-state rendering before and after caching.
- [x] Confirm precomputed data remains deterministic for all 1,000 missions.

### Reduce remote database round trips

- [x] Combine case assignment, progression lookup and active-case creation into
  one storage operation/transaction.
- [x] Measure the session-authentication database round trip on every authorised
  request.
- [x] Evaluate a short, bounded session cache and retain immediate database-backed
  revocation until deployed measurements demonstrate that caching is needed.
- [x] Review high-traffic endpoints for repeated sequential pool checkouts.
- [x] Capture and optimise slow queries using production-shaped data.

Completed in the October 2026 hot-path pass: ordinary assignment is one
player-locked transaction; authorization and shared rate limiting use one
connection/transaction; archive metadata no longer causes an N+1 query;
ordinary and replay activity share one checkout; progression achievements reuse
their connection; and every pool acquisition is bounded and measured. Migration
0020 adds the active-case recency index. Authentication and pool duration/failure
metrics are exposed at `/metrics`. `EXPLAIN ANALYZE` used the full 1,000-mission
catalogue; remote-network and concurrency validation remains under **Prove
production capacity**. Details are in `docs/database-hot-paths.md`.

### Improve process lifecycle and scheduled work

- [x] Handle Unix `SIGTERM` as well as Ctrl-C.
- [x] Stop the weekly background task during shutdown.
- [x] Allow in-flight requests to drain within systemd's stop timeout.
- [x] Remove automatic schema migration from normal API startup.
- [x] Run migrations as a controlled deployment step.
- [ ] Give the runtime API database account only gameplay privileges.
  Provisioning templates are ready in `deploy/mysql/`; applying the grants and
  switching production credentials remain deployment steps.
- [x] If multiple API instances run, give weekly expiry a single owner or database
  lock while keeping the operation idempotent.

Implementation and deployment sequence: `docs/process-lifecycle.md`.

### Make email delivery production-safe

- [x] Reuse one configured `reqwest::Client` instead of creating one per email.
- [x] Configure short email-provider connection and request timeouts.
- [x] Move confirmation and recovery delivery through the durable outbox.
- [x] Add metrics and alerts for queue age, retry count and permanent failure.

The API owns one reusable email client with a five-second connection timeout
and fifteen-second total request timeout. Confirmation and recovery enqueue in
the same transaction as their tokens. `/metrics` exposes current queue depth,
oldest pending age, queued retries, dead rows, and process counters for retries
and permanent failures. Prometheus alert rules are checked in at
`deploy/prometheus/naijachase-alerts.yml`.

## Observability and operations

- [x] Generate a request ID at Nginx/API entry.
- [x] Return the request ID to the browser.
- [x] Include the request ID in structured logs and error responses.
- [x] Add request duration and status metrics by route.
- [x] Add active/waiting request and blocking-work metrics.
- [x] Add MySQL pool usage, wait-time and failure metrics.
- [x] Add email queue and weekly-job metrics.
- [x] Add process CPU and memory monitoring.
- [x] Keep `/metrics` off the public proxy or protect it with monitoring-network
  access controls.
- [x] Add browser error reporting with private production source maps.
- [x] Add alerts for sustained `5xx`, high latency, database failure, email
  backlog, weekly-expiry failure and repeated process restarts.
- [x] Create a production dashboard and a short incident runbook.

## Web and 3D delivery

### Prioritise Full-detail loading

- [x] Load the player, active witness and vehicle first.
- [x] Render a usable first frame before loading decorative content.
- [x] Load nearby scenery next and background crowds during idle time.
- [x] Limit concurrent model fetch/decode work; begin testing with four at a time.
- [x] Preload only the next likely scene's critical asset set after the API confirms
  the action.
- [x] Never preload the complete model catalogue.

### Reuse and cancel model work

- [x] Add a bounded application-level parsed-model/container cache, or use a
  longer-lived Babylon asset scene.
- [x] Dispose least-recently-used resources under memory pressure.
- [x] Test repeated scene transitions for memory and WebGL resource leaks.
- [x] Replace the non-cancelling 12-second wrapper with an abortable loading path.
- [x] Cancel model work when a scene is replaced or detail is lowered.

Implemented in the October 2026 model-lifecycle pass. The shared loader keeps a
bounded LRU of parsed per-scene containers and reusable immutable GLB bytes,
trims both on browser memory pressure, and binds queued/download/decode work to
the scene's abort signal. `web/tests/model-lifecycle.test.mjs` exercises repeated
scene teardown, cache reuse, LRU pressure and an aborted in-flight request.

### Improve Automatic mode with real measurements

- [x] Capture selected detail level and fallback reason.
- [x] Capture model URL, bytes, download time and decode time.
- [x] Capture frame rate, WebGL context loss and Core Web Vitals.
- [ ] Analyse production results by device class and connection type without collecting
  unnecessary personal data.
- [ ] Tune Automatic thresholds using production evidence.
- [x] Confirm explicit Full mode presents an understandable warning on a slow or
  data-saving connection.

Instrumentation implemented in the October 2026 adaptive-detail telemetry pass. The browser
batches bounded anonymous events to `POST /v1/telemetry/performance`; the API
validates a fixed allow-list and writes structured events for aggregation. See
`docs/automatic-detail-telemetry.md`. Production analysis and threshold tuning
remain open by design: both require a representative live sample rather than
development-device guesses.

### Enforce web performance budgets

- [x] Reduce initial JavaScript below the current 60 KiB compressed target.
  Current result: 57.3 KiB gzip.
- [x] Reduce initial CSS below the current 10 KiB compressed target.
  Current result: 9.8 KiB gzip.
- [x] Review approximately 1.1 MiB of compressed lazy JavaScript. It is now
  approximately 926.9 KiB gzip; Babylon remains the dominant, deliberately lazy
  dependency. See `docs/web-performance-budgets.md`.
- [x] Reduce the approximately 330 KiB compressed `chase3d-models` chunk using
  narrower Babylon imports. It is now approximately 318.5 KiB gzip. The glTF
  loader uses its narrow registration module and optional loader extensions are
  separate. Forced package-directory chunks were rejected because they introduced
  circular production chunks merely to move bytes between output files.
- [x] Convert agreed initial and route-level budgets from advisory warnings into
  release failures. `pnpm build` now fails initial JS/CSS, total lazy JS, and
  largest-lazy-chunk regressions.
- [x] Reconsider Vite's raised 1.5 MB chunk warning threshold. It is now 500 KiB
  uncompressed, alongside the stricter gzip release gate.

### Improve browser/API resilience and deployment hygiene

- [x] Add `AbortController` deadlines to browser API calls.
- [x] Show a clear retryable error instead of loading forever.
- [x] Never retry a non-idempotent command with a new command ID.
- [x] Add a Content Security Policy to the game application's Nginx configuration.
- [x] Exclude `web/asset-originals/` from `make copy-code`; it is about 330 MiB and
  is not required in production.
- [x] Remove `.DS_Store` files from served assets.
- [x] Prefer correct HTTP/CDN caching before adding a service worker.
- [x] If a service worker is later added, cache only a small shell and bounded
  player-used asset packs, with a tested upgrade strategy.

Policy and verification: `docs/browser-resilience.md`. No service worker is added;
the final item defines the requirements for any future implementation.

## Bugs and broken release checks

- [x] Fix `make benchmark`: its sample travels before questioning the key witness,
  so it currently panics and measures nothing.
- [x] Replace the benchmark's stale flow with a valid representative workload.
- [x] Add the repaired benchmark to CI as a regression gate.
- [x] Fix the strict Clippy warning in `naijachase-content/src/lib.rs`:
  `unnecessary_lazy_evaluations`.
- [x] Run `cargo clippy --workspace --all-targets -- -D warnings` in CI.
- [x] Fix the two web mock-server tests that can wait forever when startup fails.
- [x] Make those tests reject on early child-process exit.
- [x] Include mock-server stderr in test failures.
- [x] Add a short mock-server startup deadline.
- [x] Reconcile the detail-state comment/contract with its missing window-resize
  listener, either by registering the listener or correcting the contract.
- [x] Add locked Rust and pnpm dependency-vulnerability checks to CI.

## Verification completed during the review

- [x] The MySQL storage regression suite passed after adding the bounds: 25
  tests.
- [x] API timeout JSON and service-limit configuration tests passed.
- [x] A release-profile compile check passed for `naijachase-api`.
- [x] `cargo test --release --workspace` passed: 78 Rust tests plus doc tests.
- [x] The complete 1,000-mission catalogue simulation passed.
- [x] Production web build passed.
- [x] Svelte reported zero errors and zero warnings.
- [x] Vite built 1,336 modules successfully.
- [x] 298 web tests passed in the restricted review environment.
- [x] The local-server web integration tests passed, including API-link and avatar
  tests using the bounded mock-server harness.
- [x] Strict Clippy passed across the workspace and all targets with warnings
  treated as errors.
- [x] The repaired release benchmark completed 1,000,000 representative commands
  at approximately 415,893 commands per second on the review machine.
- [x] The production pnpm dependency audit reported no known vulnerabilities.
- [x] The Rust dependency audit passes after locking `rustls` 0.23.46; no known
  vulnerabilities remain. The audit still reports allowed transitive maintenance
  warnings from `mysql` 26 (`lru` 0.12.5 and `rustls-pemfile` 2.2.0), which should
  be removed during a separately tested MySQL-client major-version upgrade.

## Launch sequence

- [ ] Complete every item under **Launch blockers**.
- [ ] Repair all broken release checks.
- [ ] Complete backend caching, database-round-trip and observability work.
- [ ] Complete critical 3D delivery and cache-versioning work.
- [ ] Run production-shaped load, security, backup and rollback exercises.
- [ ] Resolve every release-blocking finding from those exercises.
- [ ] Launch to a small percentage or closed group.
- [ ] Watch errors, latency, MySQL capacity, email delivery and client performance.
- [ ] Increase traffic gradually only while service objectives remain healthy.
