# Naija Chase — Project Tracker

Last updated: 20 October 2026

This file is the source of truth for completed work, current limitations, and
next development priorities. Update it whenever a feature or content pass is
completed.

## Witness venue repair — 20 October 2026

- [x] Reassign all 77 non-landmark museum clues to appropriate libraries, universities, community halls and craft markets, including matching witness roles.
- [x] Preserve clue IDs, facts, candidate sets and every dialogue wording; update the eight affected authoring seeds so regeneration keeps the repair.
- [x] Add a regression guard requiring every authored clue to have a valid combination on the case routes, while still excluding synthetic missing-venue and museum-collision fixtures.
- [x] Confirm all 994 clues are structurally eligible with zero exclusions; pass the 11 content tests, catalogue validation, Svelte diagnostics and all 358 web tests.
- [x] Verify all 77 repaired accounts appear across 8,000 sampled attempts (993 of 994 eligible clues sampled overall).

## Reviewed witness facts — 20 October 2026

- [x] Review all 150 supplied facts against the live content database and canonical files; record duplicates, retained cores and unsupported details in `docs/reviews/witness-facts-2026-10-20.csv`.
- [x] Add 37 source-checked witness clues and 333 English variants; reuse the existing Akwete knowledge entry and correct the Dufuna destination to Yobe.
- [x] Merge overlapping beach, crater-lake and reservoir facts; omit unverified rankings, measurements, dates and cultural generalisations.
- [x] Validate the catalogue and confirm all 37 additions are eligible and selected across 8,000 sampled attempts; preserve existing rows and pass all 358 web tests.
- [ ] Deploy the reviewed content and restart the API through the normal release process; production was only read during this review.

## Combined scene controls — 20 October 2026

- [x] Replace the separate floating detail, music and tune buttons with one top-right hamburger menu.
- [x] Keep the three options, existing preferences, outside dismissal, Escape focus return and safe-area layout.

## Witness variety — 20 October 2026

- [x] Choose fresh witness combinations per ordinary/replay attempt, preferring unheard clues and then older material.
- [x] Save complete private witness plans and wordings; preserve legacy attempts and shared weekly lineups.
- [x] Derive owned player history from delivered interview receipts, excluding cold replies, unvisited clues and unfinished weekly journeys.
- [x] Add `make witness-coverage` with exhaustive eligibility, sampled exposure and exclusion reasons; allow content growth beyond baseline counts.
- [x] Audit all 250 recent additions: all 250 are eligible after repairing the four museum-venue conflicts.
- [x] Verify 4,000 generated attempt itineraries, content-growth loading, the Rust suite, 29 live database tests, and all 356 web tests; changed game crates pass strict linting.
- [x] Move SCA-EVENT-003, SCA-EVENT-006, SCA-EVENT-009 and SCA-EVENT-011 to the library, along with suitable venues for the other 73 blocked accounts; preserve the three-distinct-venues puzzle rule.
- [ ] Deploy the API and updated content, restart the API, and verify a new attempt plus resume. Existing attempts retain their legacy selector.

## Mobile UI corrections — 20 October 2026

- [x] Keep the first-login avatar Continue action floating above the mobile home indicator.
- [x] Reserve iPhone safe areas for full-screen terminal and Archive headers, including the Back action.
- [x] Let Settings, warrant profiles, hideout rows and shared cards shrink and wrap instead of clipping on the right.
- [x] Label and validate `username` as Investigator Name with a precise 3–32-character format explanation in both web and API validation.
- [x] Remove the premature “witness statement added” notification; the witness scene now appears before any notebook confirmation.
- [x] Keep the mobile corrections within release budgets by lazy-loading the privacy control, account styles and dossier-list styles; startup is 59.8 KiB JS and 9.9 KiB CSS gzip.
- [x] Hide the first-time usage-consent prompt after either choice and keep later allow/deny controls in Settings instead of a permanent floating button.
- [ ] Verify these corrections on an installed iPhone PWA in portrait and landscape after the next deployment.

## Witness notebook recovery — 19 October 2026

- [x] Recover ordinary/replay witness statements from persisted command receipts, not just browser storage.
- [x] Add authenticated `GET /v1/cases/{case_id}/accounts`; restore old records without regenerating dialogue or changing the database schema.
- [x] Restore notes on sign-in/resume, notebook opening and failed-command reconciliation; deduplicate retried responses.
- [x] Keep cached notes on fetch failures and show an explicit retry action; reject stale responses after switching cases.
- [x] Cover interrupted responses, legacy notes, retries, cold-location accounts and database reconnection with regression tests; document the frontend contract.
- [ ] Deploy the updated API and web together, then verify an affected ongoing case recovers its notes on refresh. Do not reset or abandon that case for this verification.

## Current baseline

- [x] 500 Nigerian locations
- [x] Product name selected: Naija Chase
- [x] 5,243 knowledge records
- [x] 12,729 clue formulations
- [x] 1,000 missions
- [x] 100 thieves with unique eight-attribute dossiers
- [x] All 36 states plus the Federal Capital Territory
- [x] Complete state-to-state distance and travel-time graph
- [x] 35 venue types
- [x] 1,295 state-to-venue suitability rules
- [x] 35 venue experience profiles with time- and event-aware atmosphere
- [x] Fictional local display names for every available state/venue pairing
- [x] All 500 locations mapped through 2,946 suitable location-to-venue links
- [x] 1,000 complete mission narrative profiles with unique titles
- [x] 100 thief-specific calling cards
- [x] Balance simulation report for all 1,000 missions
- [x] Coordinate-backed local travel for 416 matched locations
- [x] 957 destination clue atoms: at least 25 for every state and 26 for the FCT
- [x] Add a motto, city-identity, landmark, and economic-driver witness clue for
  every state and the FCT, with deliberately confusable candidate states.
- [x] Remove all state and capital names from base witness clues and dialogue
  variants, and enforce the rule in repository validation.
- [x] Add 36 deeper cultural, industrial, historical, ecological, and heritage
  clue atoms supplied for the states, without exposing place names.
- [x] Source URLs attached to the original 518 clue atoms.
- [ ] Editorially verify the 148 newly supplied state motto, city-identity,
  landmark, and economy atoms against authoritative sources and attach URLs
  before publication; they are explicitly marked verification-required.
- [ ] Editorially verify the additional 36 deep state facts and attach
  authoritative source URLs before publication.
- [ ] Resolve the unsupported “largest city in West Africa by land mass” claim
  and the approximately 3,080 km² figure before considering it for gameplay.
- [x] 406 clue atoms linked directly to internal knowledge records
- [x] 238 clues reference-cross-checked; 280 held for exact source-line review
- [x] 12,726 dialogue variants across three difficulty levels and two registers
- [x] All 1,000 missions connected to the contextual witness engine
- [x] Career-level recent clue and dialogue tracking
- [x] Rust workspace tests pass, including all 1,000 missions and every
  mission-stage venue combination

## Completed game systems

### Registration

- [x] Required Year, Month, Day date-of-birth dropdowns, with years capped at
  the current year minus 18 and days adjusted for month length/leap years.
  Clear invalid day selections when year/month changes; validate calendar dates
  and enforce the 18+ registration gate in the frontend and independently against
  the server clock in the backend; persist the private DOB
  on the player record (existing accounts remain null).

### Career and cases

- [x] Investigator identity
- [x] Rookie starting rank
- [x] Career points and promotions
- [x] Automatic saving and case resumption
- [x] Confirmed ordinary-case abandonment with complete local-state cleanup,
  authoritative activity refresh, and explicit retry after stale versions
- [x] Atomic per-player ordinary assignment; existing attempts resume instead
  of resetting the briefing, and a replay cannot masquerade as a new ordinary case
- [x] Case lifecycle regressions: executable web controllers, concurrent
  real-MySQL assignment/abandonment/reassignment, and questioned-witness quote filtering
- [ ] Review any historical duplicate unfinished ordinary attempts before
  repairing affected accounts; never silently discard their investigation progress
- [x] Seven-day case deadline beginning Monday at 07:00
- [x] Case score, travel penalties, arrest, and failure states
- [x] Eight-stop cases: opening jurisdiction plus seven successful state/FCT trips
- [x] Correct playthroughs consume five to six in-game days, leaving at most
  two days for false leads

### Travel and time

- [x] Travel is limited to states and the FCT
- [x] Travel time is based on distance between state hubs
- [x] Nearby routes use road travel; longer routes use air travel
- [x] Consecutive stops in one state use a local road transfer
- [x] Interviews, waiting, travel, and warrant processing consume time
- [x] Venues have opening and closing hours

### Witnesses and clues

- [x] Three witness encounters at every investigation stage
- [x] Exactly one of the three witnesses at each stop supplies a new dossier clue
- [x] Randomise which of the three venue witnesses supplies that clue; never
  assume the first witness questioned is the key witness.
- [x] Shuffle all eight dossier fields per case instead of revealing them in the
  fixed sex, height, skin-tone, hair, hobby, vehicle, accessory, feature order.
  Keep the shuffle deterministic for saves, retries, and weekly play.
- [x] Travel unlocks once the key witness at the current stop is questioned;
  recording the clue in the dossier can happen later
- [x] A warrant requires all eight dossier details; players may fill them in
  before or after travelling to the next stop
- [x] Different destination evidence from each witness
- [x] The two non-decisive clues at each stop remain individually ambiguous
- [x] Three-clue intersection resolves to exactly one state
- [x] Structure every on-trail stop as two multi-state ambiguous clues and one
  shuffled decisive landmark clue; choose the key witness only from the two
  ambiguous witnesses, while retaining the one-key-witness travel rule.
- [x] Suspect traits are embedded naturally in witness dialogue
- [x] Notebook shows the narrowing destination shortlist
- [x] Nigerian roles such as agbero, market woman, conductor, boatman,
  clearing agent, cattle trader, and palace guard
- [x] Use grammatically correct English for every witness role; informal job
  titles remain locally appropriate, but dialogue is no longer mechanically
  generated Nigerian Pidgin.
- [x] Removed generic phrases such as "route cipher" and "specialist detail"

### Suspects and warrants

- [x] Eight dossier fields: sex, height, skin tone, hair, hobby, vehicle,
  accessory, and distinguishing feature
- [x] Unique profile for every thief
- [x] Profile evidence described during ordinary witness interviews and entered
  manually by the player
- [x] Physical descriptors, carried/worn accessories, and predicate-style
  distinguishing features are embedded as grammatical English clauses.
- [x] Completed profile opens a three-suspect comparison led by the player
- [x] All eight fields are required before a warrant can be issued
- [x] Correct warrant and capture state required to close a case
- [x] Warrant candidates display complete eight-trait descriptions
- [x] A warrant no longer ends the case; the player must locate the final hideout
- [x] Finding the correct hideout without a warrant causes the suspect to escape
- [x] Let the player request a warrant and begin the final search after the key
  witness is questioned; the other two final-stop interviews are optional.
- [x] Return three named, closely matched suspect files with complete dossier
  details, backend summaries, and procedural passport-avatar descriptors.
- [x] Limit the final search to five server-selected hideouts, close a case with
  no reward when the real thief is found under a wrong warrant, and expose the
  real thief's name for the terminal result dialog.
- [x] Raid list: one "Raid this location" button per hideout (drive if
  affordable, else hitch), searched hideouts disabled (`searched_hideouts`),
  and a short raid chase: the thief escapes from empty hideouts and is caught
  at the real one.
- [x] Preserve score, travel, stop, and deduction statistics in the
  archive for failed, expired, and wrong-warrant cases.

### Context-aware venues

- [x] Expanded the catalogue from 12 to 35 venue types
- [x] Explicit venue suitability for every jurisdiction
- [x] Unavailable venues are excluded from clue combinations
- [x] Highly characteristic venues receive selection priority
- [x] Sokoto strongly favours mosques and emirate settings
- [x] Anambra strongly favours markets and has no seaport venue
- [x] Benue favours farms and agricultural settings
- [x] Rivers favours refineries, seaports, and waterfronts
- [x] Lagos favours ports, markets, nightlife, airports, and waterfronts
- [x] Osun favours sacred groves, palaces, and festival grounds
- [x] Corrected Ondo's former seaport clue to a waterfront encounter
- [x] Venue menus report live open/closed status before selection
- [x] Questioned status is scoped to the current stop and never leaks between cities

## Current limitations

- [x] Every jurisdiction has 18 distinct clue atoms.
- [x] Every clue atom has three grammatical English formulations per difficulty.
- [x] Remove all mechanically generated Nigerian Pidgin witness variants and
  remove runtime/generator selection of those variants.
- [x] Venue context is state-, city-, LGA-, landmark-, and institution-aware.
- [x] Local travel uses verified LGA boundary centroids wherever matched.
- [ ] Sixty-five non-LGA landmarks and institutions still use the documented
  state-hub fallback until landmark-level coordinates are verified.
- [x] All 1,000 missions have coherent generated narrative profiles rather than
  the former ten repeated premises.
- [ ] The generated mission narratives still need a human line-editing pass to
  achieve the nuance of 1,000 individually authored cases.
- [x] Difficulty is balanced across ambiguity, phrasing, travel choices, false
  leads, time, scoring, and explicitly labelled witness reliability.
- [x] All cultural, historical, and linguistic clues have systematic editorial
  metadata and source coverage.
- [ ] Publication remains blocked on 280 exact source-line checks and 78 human
  sensitivity reviews.
- [x] Venue encounters now have an atmospheric terminal presentation.
- [x] The wider terminal presentation now includes structured dossiers,
  notebooks, route analysis, warrant paperwork, scenes, help, and accessible
  display controls.

## Next priorities

### P0 — Content depth and replayability

- [x] Expand every jurisdiction from 4 to at least 12 clue atoms.
- [x] North West batch: 12 atoms each for Jigawa, Kaduna, Kano, Katsina,
  Kebbi, Sokoto, and Zamfara.
- [x] North East batch: Adamawa, Bauchi, Borno, Gombe, Taraba, and Yobe.
- [x] North Central and FCT batch: Benue, FCT, Kogi, Kwara, Nasarawa, Niger,
  and Plateau.
- [x] South West batch: Ekiti, Lagos, Ogun, Ondo, Osun, and Oyo.
- [x] South South batch: Akwa Ibom, Bayelsa, Cross River, Delta, Edo, and
  Rivers.
- [x] South East batch: Abia, Anambra, Ebonyi, Enugu, and Imo.
- [x] Exceeded the original 500–750 curated clue target nationally. Current total: 957.
- [x] Add six state-creation and early-governance clue dimensions across all 36 states and the FCT.
- [x] Add source-linked former-president and major Nigerian sports-event clue atoms.
- [x] Cover history, kingdoms, independence, civil-war history, languages,
  traditions, food, festivals, literature, music, architecture, geography,
  ecology, agriculture, industry, institutions, monuments, and heritage.
- [x] Give every clue at least three English dialogue formulations per difficulty.
- [x] Add easy, medium, and hard versions of clue phrasing.
- [ ] Human-edit the remaining English witness lines for voice, rhythm, and
  regional context after the automated grammar and predicate checks.
- [x] Prevent recent clue and dialogue repetition within a career where unused
  alternatives remain available.

### P1 — Venue depth

- [x] Add venue arrival descriptions and atmosphere.
- [x] Add day, night, weekday, weekend, and event-day variations.
- [x] Give each venue several possible witness roles and introductions.
- [x] Add role-specific behaviours before and after questioning.
- [x] Allow locally appropriate venue names without using real businesses.
- [x] Add venue-specific waiting and investigation events.
- [x] Review every state-to-venue weight editorially.

### P1 — Location-aware investigations

- [x] Keep flights state-based while allowing investigations in real cities,
  LGAs, landmarks, and institutions within the current state.
- [x] Add local travel time between in-state investigation locations.
- [x] Connect all 500 locations to suitable venue categories.
- [x] Use location knowledge to alter available witnesses and clue wording.
- [x] Ensure the player never flies directly to an LGA.

### P1 — Mission quality

- [x] Coordinate each crime, stolen object, thief, route, venue, and final
  capture setting around a coherent theme.
- [x] Add crime-specific opening briefings.
- [x] Return the complete opening case dossier (`title`, `stolen_item`,
  `premise`, and `opening_briefing`) in every ordinary/replay/resume API case
  response while keeping the witness-built suspect `dossier` separate.
- [x] Add route-specific transitions and arrival descriptions.
- [x] Create stronger false destinations that share one or two clue traits.
- [x] Add thief-specific behaviour and calling cards.
- [x] Add authored capture scenes and case conclusions.
- [x] Review all mission titles and premises for repetition.

### P2 — Difficulty and game balance

- [x] Define measurable easy, medium, and hard ambiguity targets.
- [x] Make difficult witnesses more indirect without becoming obscure.
- [x] Tune the number and quality of false destinations.
- [x] Balance opening hours and waiting penalties.
- [x] Balance road and air travel times against the seven-day deadline.
- [x] Replace estimated in-state travel times with verified coordinate or
  road-routing data while keeping an offline deterministic fallback.
- [x] Add witness reliability carefully; never make a case depend on an
  unknowably false statement.
- [x] Run automated simulations to measure solve rates and remaining time.
- [x] Tune points, penalties, warrants, and promotion thresholds.

### P2 — Editorial review

- [x] Attach a reliable source or knowledge record to every clue atom.
- [ ] Verify geographic, historical, cultural, and institutional claims. Current
  status: 238 reference-cross-checked; 280 require exact source-line checks.
- [ ] Review Nigerian English with editors from multiple regions; retain local
  vocabulary without using mechanically generated dialect.
- [ ] Check names, spelling, diacritics, and capitalisation. Automated Nigerian
  English and capitalisation checks pass; human name and diacritic review remains.
- [x] Distinguish historical facts from current institutions and conditions.
- [x] Remove stereotypes and overly broad ethnic or religious assumptions.
  Automated broad-term scan currently reports zero findings.
- [x] Mark sensitive civil-war, religious, and political material for review.
  Seventy-eight clues are flagged in the editorial queue.

### P3 — Terminal experience

- [x] Add a clearer case dossier at the beginning of each mission.
- [x] Add a structured detective notebook.
- [x] Add a text-based travel map or route summary.
- [x] Show eliminated and still-possible destinations clearly.
- [x] Improve warrant paperwork and suspect comparison.
- [x] Add arrival, arrest, escape, promotion, and deadline scenes.
- [x] Add accessibility-friendly display settings.
- [x] Add an in-game help and rules screen.

### P3 — Production readiness roadmap

The production path is deliberately incremental. Rust is the authoritative
engine, terminal, content-validation, simulation, and test toolchain. The web
client is a separate concern: it may use TypeScript with WebGL or WebGPU for
rendering and selectively load Rust through WebAssembly where useful. Use
MySQL for local development and hosted persistence, and prove a usable
web vertical slice before committing to full-scale 3D production.

#### P3.1 — Engine boundaries and contracts

- [x] Separate pure game rules and state transitions from terminal input/output.
- [x] Define serialisable models for career, case, investigation, evidence,
  dossier, warrant, travel, time, score, and outcome.
- [x] Expose commands such as `start_case`, `visit_venue`, `record_trait`,
  `travel`, `request_warrant`, and `arrest` through one engine interface.
- [x] Make every command return structured events that any interface can render.
- [x] Add deterministic seeds and replay logs so reported cases are reproducible.
- [x] Add versioned save migration instead of deleting incompatible saves.
- [x] Keep the terminal game as the reference client during the refactor.
- [x] Exit criterion: all 1,000 missions pass through the new interface and the
  terminal client contains no game-rule decisions.

#### P3.2 — Player-controlled deduction

- [x] Stop automatically adding traits to the suspect dossier.
- [x] Let players translate witness statements into dossier fields themselves.
- [x] Allow dossier entries to be changed before requesting a warrant.
- [x] Once enough evidence exists, present three plausible suspects and require
  the player to choose the warrant target.
- [x] Ensure one candidate is correct and the other two differ by subtle,
  evidence-supported traits rather than random mismatches.
- [x] Explain contradictory or incomplete entries without revealing the answer.
- [x] Rebalance time, score, and difficulty for manual deduction.
- [x] Exit criterion: automated scenarios cover correct, incomplete,
  contradictory, and wrong-suspect paths at every difficulty.

#### P3.3 — Rust engine migration

Migration audit completed 6 October 2026: the active repository contains zero
`.py`, `.pyc`, `.pyo`, or `__pycache__` artifacts; `./play`, content validation,
editorial checks, enrichment reporting, simulations, exports, save migration,
benchmarks, and tests all run through the Cargo workspace. The obsolete save
from the retired runtime was removed as authorised.

- [x] Freeze the Python command/state/event behaviour as the migration
  specification; make no silent rule changes during the port.
- [x] Define language-neutral, versioned JSON Schemas for commands, events,
  game state, content input, replay logs, and errors.
- [x] Create a Cargo workspace with `naijachase-core`, `naijachase-contracts`,
  `naijachase-content`, `naijachase-storage`, `naijachase-api`,
  and `naijachase-cli` crates.
- [x] Enforce one-way dependencies: clients call `naijachase-api`,
  `naijachase-api` calls `naijachase-core`, and `naijachase-core` never imports API, storage, HTTP,
  authentication, rendering, or platform code.
- [x] Keep `naijachase-core` deterministic and independent of terminals, browsers,
  databases, networking, clocks, and operating-system services.
- [x] Model career, case, investigation, venue visit, evidence, dossier, travel,
  warrant, arrest, scoring, deadline, and rank rules with explicit Rust types.
- [x] Parse and validate the canonical checked-in content with the Rust content
  and tools crates.
- [x] Port one complete case first, including every success and failure path.
- [x] Build Rust integration coverage for identical seeded commands and state.
- [x] Expand parity testing to all 1,000 missions, every difficulty level,
  incomplete and contradictory dossiers, false travel, wrong warrants,
  deadlines, scoring, promotions, saving, and replay.
- [x] Add property, fuzz, malformed-content, deterministic-replay, and benchmark
  tests around the Rust core.
- [x] Define save migration from historical versioned state into Rust-owned
  state; retain fixtures for every historical save version.
- [x] Expose a stable native Rust interface for the service layer.
- [x] Keep authoritative multiplayer decisions in the server-side Rust engine.
- [x] Benchmark realistic concurrent case workloads before choosing the service
  process model; Rust improves per-process efficiency but scaling also depends
  on database, network, caching, and deployment architecture.
- [x] Switch all runtime authority to Rust after parity, performance,
  replay, save migration, and all 1,000 mission gates pass.
- [x] Port the terminal client, clue engine, content validation, editorial
  review, imports, simulations, balance reports, migrations, and test suite to
  Rust with equivalent coverage.
- [x] Replace `./play` with a Rust entrypoint and remove the former runtime,
  `clue_engine.py`, every Python script, and the Python test suite only after
  their Rust replacements pass.
- [x] Add a repository guard that fails when a `.py` file or legacy-runtime invocation
  is introduced outside explicitly archived historical material.
- [x] Exit criterion: Rust is authoritative, passes every integration
  test, loads migrated saves, reproduces replay logs, and meets documented load
  and latency targets without changing case outcomes; the active repository
  contains no legacy source or runtime dependency.

WebAssembly is not a P3.3 requirement. Evaluate it later only if offline play,
local replay, or client-side prediction becomes a concrete product requirement.

#### P3.4 — Data model and persistence

- [x] Inventory CSV schemas, ownership, identifiers, and relationships.
  See `docs/data-model.md`.
- [x] Design a normalised relational schema with foreign keys and constraints.
- [x] Separate immutable content from player, career, and live-case data.
- [x] Use MySQL for development, tests, hosted play, and content imports.
  - [x] Add the MySQL Rust dependency, environment configuration, and versioned
    migration runner.
  - [x] Add optimistic-lock storage for versioned active-case state.
  - [x] Add SHA-256 content-manifest records.
  - [x] Move the terminal career save from JSON into MySQL.
- [x] Write an idempotent CSV importer with row-count and checksum validation;
  retain CSV as an authoring/export format until editorial tools are migrated.
- [x] Add schema migrations, backups, restore tests, and seed fixtures.
  - [x] Add MySQL migration 0001 and automated configuration/checksum coverage.
  - [x] Add database backup/restore automation and recovery testing.
  - [x] Add complete content seed fixtures and migration upgrade fixtures.
- [x] Select MySQL as the persistence backend while keeping database concerns
  outside the core game engine.
- [x] Exit criterion: the database rebuilds cleanly from source content and
  produces the same 1,000 mission outcomes as the current dataset.

#### P3.5 — Service API and operational safety

- [x] Implement `naijachase-api` as an application layer around
  `naijachase-core`, not
  as part of the core game engine.
- [x] Define versioned HTTP endpoints around engine commands and event responses;
  add WebSockets only for features that genuinely require server push.
- [x] Convert validated API requests into typed core commands and convert core
  results into client-safe response DTOs without leaking hidden case answers.
- [x] Load the active case, enforce ownership, execute one core command, and
  persist new state plus events within a single transaction.
- [x] Keep database repositories and transaction handling behind
  `naijachase-storage`; the core receives explicit inputs and returns state
  changes.
- [x] Replace development API tokens with verified email/password accounts and
  revocable, hashed, server-side sessions carried in HttpOnly cookies.
- [x] Make state-changing requests idempotent and protect concurrent updates.
- [x] Require a client-generated command ID and state version so retries are
  safe and stale or duplicate commands cannot advance a case twice.
- [x] Add structured logs, error reporting, health checks, metrics, and audit
  trails without recording private data or unrevealed answers.
- [x] Add unit, integration, contract, load, security, and recovery tests.
- [x] Establish separate development, staging, and production environments.
- [x] Exit criterion: restarts, duplicate requests, invalid commands, and
  concurrent updates cannot corrupt a case, and public access uses revocable
  player sessions rather than environment-provided player tokens.

#### P3.6 — Web vertical slice

- [x] Build one responsive, accessible 2D web case before expanding the scope.
- [x] Implement onboarding, case selection, interviews, notebook, manual dossier,
  state travel, warrant selection, arrest, and results.
- [x] Add a usable Nigeria map with keyboard and screen-reader alternatives.
- [x] Create a reusable visual system for states, venues, witnesses, suspects,
  evidence, travel, warrants, and ranks.
- [x] Use TypeScript for the application layer and evaluate Three.js, Babylon.js,
  or another WebGL/WebGPU renderer through a focused prototype rather than
  coupling browser rendering to the server implementation language.
- [x] Use the Rust WebAssembly build only for suitable client-side engine work;
  keep DOM, accessibility, asset loading, and 3D scene presentation in the web
  technology best suited to those tasks.
- [x] Start with lightweight route, arrival, dossier, warrant, and arrest motion.
- [x] Test the production bundle and responsive layout under a 390 x 844 mobile
  viewport; after adopting Svelte, the initial compressed payload remains below
  the original 25 KiB JavaScript and 2 KiB CSS budgets. The redesigned client
  (P3.10) uses advisory size targets of 50 KiB JavaScript and 10 KiB CSS (gzip); the
  build reports but never fails on them.
- [x] Exit criterion: the complete case flow is keyboard accessible, preserves
  hidden server state, renders without horizontal overflow at the mobile
  breakpoint, and passes the automated accessibility, privacy, and build gates.
- [ ] Run moderated playtests in P3.11 to confirm that new players finish the
  case unaided and that broader accessibility, performance, and usability
  targets pass.

#### P3.7 — Identity, progression, and home base

- [x] Expose the canonical eight-field dossier option catalogue through an
  authenticated API, reject arbitrary trait values, and document the ordinary
  and weekly frontend integration contract.
- [x] Expose the signed-in player's current ordinary case for cross-device
  resume and make new-case assignment reuse an existing ongoing case.
- [x] Expose one authenticated current-activity inventory covering the ordinary
  case, every resumable replay, and every active or in-transit weekly attempt;
  document `GET /v1/activity/current` for the frontend and keep the narrower
  ordinary endpoint for compatibility.
- [x] Fix: the web case desk asks `GET /v1/activity/current` after login and on
  load, so a fresh sign-in offers **Resume case** for an unfinished case instead
  of always **Start new case**.
- [x] Add an authenticated, version-checked ordinary-case abandonment operation
  that discards case-local progression, preserves sanctions and unrelated
  account state, releases the mission assignment, permits a new case, rejects
  replays/weekly attempts, and includes a complete frontend handoff.
- [x] Replace ordinary and weekly web dossier free-text inputs with server-owned
  select choices, session-cached loading, inline retry, saved-value preselection,
  and exact listed-value submission.

- [x] Implement proper player accounts and login; do not represent individual
  players with tokens listed in an environment variable.
- [x] Choose and document the supported login methods before implementation:
  verified email/password with Argon2id, passkeys, or a trusted OIDC provider.
- [x] Store only password hashes and hashed refresh/session tokens; never store
  plaintext passwords, access tokens, or refresh tokens.
- [x] Issue short-lived access credentials backed by rotating, revocable
  sessions with expiry, logout, logout-all-devices, and account-recovery flows.
- [x] For the web client, use Secure, HttpOnly, SameSite cookies and CSRF
  protection rather than exposing long-lived credentials to browser storage.
- [x] Add login and recovery throttling, generic failure messages, session
  fixation protection, and security-event auditing.
- [ ] Add optional MFA after recovery and primary login flows have completed
  product and usability review.
- [x] Add authentication contract, integration, abuse, expiry, rotation,
  revocation, account-recovery, and cross-account authorisation tests.
- [x] Add the profile foundation with display name, optional pronouns/sex,
  placeholder `avatar_id`/`uniform_id`, and home state/FCT. Full visual avatar
  creation remains in P3.7.4; the placeholder IDs alone do not count as an
  implemented avatar picker.
- [x] Use fictional vehicles and travel operators until advertising and legal
  policies exist; keep real brands out of the first release.
- [x] Prototype reduced local investigation cost at home rather than completely
  free questioning, which could remove the time challenge.
- [x] Add a case archive of captured thieves and completed missions.
- [x] Add server-awarded achievements for first case, case count, rank, and
  efficient completion; add state, deduction, and helper achievements when the
  corresponding tracked gameplay exists.
- [x] Award `demoted` and `suspended` achievements transactionally from the
  authoritative disciplinary result, including rank loss caused by a bribery
  points deduction and the 24-hour Rookie suspension.
- [x] Detect newly committed achievements in the web client, present a share
  dialog after higher-priority disciplinary panels, generate a shareable PNG,
  include achievement text and the production app link, and offer the device
  share sheet plus direct Facebook, X, WhatsApp, LinkedIn, Telegram, Reddit and
  Bluesky actions.
- [x] Make every earned card on the Achievements page keyboard-accessible and
  reusable for sharing again; locked cards remain non-interactive.
- [x] Track jurisdiction coverage, travel accuracy, deduction accuracy, and
  rank history from authoritative committed case replay.
- [x] Expose progression summary, achievement catalogue, device-session list,
  and individually revocable device sessions through authenticated APIs.
- [x] Publish a versioned OpenAPI contract, generated TypeScript DTOs, request
  examples, and authentication/progression integration guidance for the UI.
- [ ] Add leaderboards only after anti-cheat, privacy, moderation, seasons, and
  fair ranking rules exist.
- [ ] Exit criterion: progression remains understandable, balanced, and fully
  playable without purchases.

##### P3.7.1 — Non-repeating case assignment and replay

- [x] Record each player's first successful completion of a mission as an
  authoritative `(player_id, mission_id)` completion with a database uniqueness
  constraint. A completion from any eligible game mode counts only once.
- [x] Make ordinary random case assignment select only from the currently
  published missions that the player has not successfully completed. Perform
  selection and active case creation transactionally so concurrent requests
  cannot assign the same mission twice or create multiple ordinary active cases.
- [x] Do not remove failed, expired, abandoned, or forfeited missions from the
  unseen pool; only a valid successful capture marks a mission completed.
- [x] Never silently fall back to a completed mission. When every currently
  published mission has been completed, report that the player has finished the
  current catalogue and offer the archive until additional missions publish.
- [x] Show completed missions in the player's case archive API with completion
  date, result, thief, score, first-completion status, and replay metadata while preserving
  unrevealed information for missions that have not been solved.
- [x] Allow a completed mission to be started again only through an explicit
  `Replay case` action. Label the resulting attempt as a replay in state, API
  responses, events, saves, results, and history; never return it from random
  assignment.
- [x] Prevent replay farming: replay attempts may update personal bests and
  replay statistics, but do not repeat first-completion progression, achievement,
  token, weekly-challenge, or other one-time rewards.
- [x] Define mission identity by stable mission ID rather than title or content
  version. Editorial revisions remain the same completed case unless a future
  migration explicitly publishes them under a new mission ID.
- [x] Add API, storage, concurrency, and regression tests covering random selection,
  the final unseen mission, all 1,000 completed, failed-case eligibility,
  cross-device requests, explicit replay, reward suppression, and account
  isolation.
- [x] Exit criterion: no player receives a successfully completed mission through
  random assignment, every completed mission remains manually replayable, and
  exhausting the catalogue produces a clear completion state rather than an
  accidental repeat.
- [x] **FRONTEND HANDOFF (done in the web client; still to be verified against the live API):** replace the fixed mission picker and browser-side
  randomisation with `POST /v1/cases {}`, add archive `Replay case` actions using
  `POST /v1/cases/replay`, consume `attempt_kind`/`first_completion`, and use
  `GET /v1/cases/catalogue-status` instead of hard-coding 1,000. Full integration
  notes are in `docs/p371-case-assignment-api.md`, with complete requests,
  responses, errors, and required UI changes.

##### P3.7.2 — Continuous case catalogue

- [x] Treat the initial 1,000 missions as the launch catalogue, not the finished
  game. Build a continuous editorial release pipeline for adding new missions
  without rebuilding or redeploying the Rust services or web client.
- [x] Store missions as immutable, stable IDs with lifecycle states such as
  `draft`, `editorial_review`, `validated`, `scheduled`, `published`, and
  `retired`. Only published missions may enter random assignment.
- [x] Add a repository-authored and authenticated internal workflow for reviewing,
  validating, previewing, scheduling, publishing, correcting, and retiring case
  batches, with role-based access and an append-only audit trail.
- [x] Require every new case to pass the existing schema, route solvability,
  budget, time, witness, clue uniqueness, dossier, no-place-name, Nigerian
  context, source, sensitivity, dialogue, and simulation gates before publication.
- [x] Support immediate and UTC-scheduled publication plus a ready-to-publish
  reserve warning; publishing never bypasses validation.
- [x] Use a default Monday 06:00 WAT release, targeting 25 validated missions
  per batch (minimum 10); permit an audited midweek reserve release when any
  player falls below 25 unseen cases, but never publish unvalidated content.
- [x] Make the assignment service query the current published catalogue and
  subtract the player's completed mission IDs. Newly published cases therefore
  become eligible automatically and receive priority over older unseen cases
  according to a documented, non-predictable weighting policy.
- [x] Keep case truth pinned to the content version used when an attempt starts.
  Later corrections affect new attempts and replays but cannot mutate an active
  investigation or invalidate its audit history.
- [x] Track live lifecycle counts, validated/scheduled reserve, minimum unseen
  cases, and exhausted accounts through the restricted catalogue-health API.
- [ ] Extend catalogue health with release rate, player completion velocity,
  projected days-to-exhaustion, clue repetition, regional balance, and editorial
  throughput once production telemetry exists.
- [x] Alert the content dashboard when the validated/scheduled reserve falls
  below 50 and expose the minimum unseen count across players.
- [ ] Calibrate the reserve target and projected-days alert from real completion
  velocity after production telemetry exists.
- [x] When a player temporarily exhausts all published cases, celebrate the
  achievement, retain manual replay, and notify them when a new batch publishes.
  Never manufacture an unreviewed case or silently assign a solved one.
- [x] Add import, publication, rollback, compatibility, live MySQL, backup, and
  assignment tests proving that new case batches become available safely
  while active cases, completions, archives, and replays remain consistent.
- [x] Exit criterion: authorised publishers can publish a validated batch without a
  software release, unseen cases appear automatically for eligible players, and
  operational reporting gives enough warning to keep the practical catalogue
  ahead of player completion.
- [x] **FRONTEND/CONTENT-DASHBOARD HANDOFF (done in the web client; not yet verified against the live API):** implement release notifications,
  catalogue refresh, role discovery, health warnings, validation reports,
  lifecycle history, scheduling, publication, and retirement using the complete
  requests and responses in `docs/p372-continuous-catalogue-api.md`.

##### P3.7.3 — Mission budget and multimodal transport

**Authoritative mission budget**

- [x] Add a case-scoped virtual-money balance that is created with the case,
  persisted in `GameState`, returned in public state, and never purchasable or
  convertible to/from cosmetics, bribe tokens, career points, or real money.
- [x] Define versioned fare rules for interstate flying, interstate driving,
  local driving, and apprehension/search costs. Fares must derive from the
  existing distance graph plus explicit base fares and distance bands rather
  than arbitrary per-mission values.
- [x] At case creation, calculate the correct-route completion baseline as:
  every interstate leg by air + driving from each state hub to all three witness
  locations at every stop + final local travel/search needed to apprehend the
  thief. Add an initial 20% contingency reserve and round up to a documented
  currency denomination.
- [x] Keep the true route and cost breakdown server-side. Expose only the
  opening budget and public fare quotes; add a leakage test proving the opening
  budget cannot uniquely identify the hidden route among candidate routes.
- [x] If rounding plus 20% reserve still leaks a unique route, increase the
  reserve band or assign the next shared budget tier used by multiple routes.
- [x] Debit fares transactionally with the corresponding movement command.
  Duplicate commands, retries, concurrent tabs, and reconnects must never charge
  twice or move without a successful debit.
- [x] Do not refund completed travel merely because it was a wrong lead. Failed
  validation, duplicate commands, and server errors must not consume money.
- [x] Never allow a negative balance. Always preserve a free route forward so a
  player who spends badly cannot become permanently unable to continue a case.

**Interstate travel choices**

- [x] Replace the single interstate travel command with a mode-aware command
  supporting `fly`, `drive`, and `hitch_ride` for every reachable state.
- [x] Make flying the fastest and most expensive mode, driving slower and less
  expensive, and hitching a ride free but substantially slower. All three use
  the same authoritative origin/destination distance graph and advance the
  simulated seven-day case clock—not real wall-clock time.
- [x] Publish a fare and duration quote for each destination/mode combination
  before confirmation. Quotes must include the rules version or quote ID and be
  revalidated by the server when the command is submitted.
- [x] Disable unaffordable paid modes while keeping `hitch_ride` available. If
  the balance reaches zero, interstate hitching is the only enabled mode.
- [x] Keep geographic plausibility without creating dead ends: “fly” represents
  the complete airport transfer/flight connection and remains available between
  state hubs even when the route requires a connection.

**Local witness and apprehension travel**

- [x] Require a local transport choice before visiting each witness venue:
  `drive` or `hitch_ride`. Flying is never available for travel within the
  current state/LGA investigation context.
- [x] Calculate local driving fares and durations from the existing hub-to-local
  coordinates; use documented fallbacks for locations whose coordinates are
  still pending verification.
- [x] Make local hitching free and slower than driving, with venue arrival time
  still respecting opening hours, waiting, day/night availability, and the case
  deadline.
- [x] Apply the same drive-or-hitch rule to the final hideout/apprehension trip.
  If the player cannot afford to drive, hitching must still permit an arrest
  attempt if sufficient simulated case time remains.
- [x] Keep transport selection separate from clue truth. Spending more can save
  simulated time but can never improve witness accuracy, reveal hidden routes,
  change dossier evidence, or guarantee apprehension.

**API, presentation, and verification**

- [x] Enforce exhausted case funds in both layers: disable Fly and Drive for
  interstate, witness, weekly-challenge, and hideout journeys at zero balance;
  automatically retain Hitch a ride; and reject paid commands authoritatively
  in Rust even if a client bypasses the disabled controls.
- [x] End a case authoritatively when an action reaches or crosses the simulated
  seven-day deadline. Persist `outcome = deadline`, emit `deadline_expired`,
  suppress the interrupted witness account, archive the failed attempt, and
  show a timeout dialog with **Start new case** and **Close** actions. See
  `docs/ui-api-handoff.md`.
- [x] Treat wrong interstate destinations as cold trails across the engine and
  API. Persist `state.trail_status`, emit explicit hot/cold travel events, offer
  three venues from the jurisdiction actually visited, and return only neutral
  English witness accounts there—never route clues, dossier evidence, cached
  dialogue from the previous stop, or pressure-action bonus clues. Display the
  authoritative status in the web case HUD and terminal. See
  `docs/ui-api-handoff.md`.
- [x] Bring the web development mock into hot/cold parity: wrong destinations
  keep three local witnesses with neutral replies and no profile hints; recovery
  restores the hot trail. Verify controller dialogue/notebook handling, travel
  feedback without events, and persistent status including weekly attempts.
- [x] Add transport quotes, current balance, opening budget, selected mode,
  fare charged, duration, and remaining balance to versioned contracts and
  renderer-neutral events. Update OpenAPI and generated TypeScript DTOs.
- [x] Add ledger/history views for opening allocation and every debit so players
  can understand where case money went; do not expose hidden route calculations.
- [x] **FRONTEND HANDOFF (done in the web client; not yet verified against the live API):** provide accessible confirmation showing destination
  description, mode,
  fare, duration, arrival time, and remaining balance before each movement.
  (A modal confirmation with fare, journey, opening-hours wait, estimated arrival,
  balance after and a deadline warning. Destination descriptions are the server
  label only; animating the returned duration is not done yet.)
- [x] Add unit/property tests for fare ordering (`fly > drive > hitch = 0`),
  duration ordering (`fly < drive < hitch`), route distances, reserve and tier
  calculations, no-route leakage, affordability, zero balance, idempotency,
  concurrency, overflow, opening hours, deadlines, and arrest accessibility.
- [x] Re-simulate all 1,000 missions using all-flight/local-drive, mixed prudent,
  wrong-turn, and zero-balance hitch strategies. Exit only when every correct
  route is affordable at opening, bad spending has meaningful time consequences,
  and no case can be permanently soft-locked by lack of money.
- [x] **FRONTEND HANDOFF (done in the web client; not yet verified against the live API):** consume the exact transport and ledger contracts in
  `docs/p373-mission-budget-transport-api.md`; do not calculate fares, journey
  durations, affordability, or balances in the browser.

##### P3.7.4 — Post-login avatar creation and appearance

First-login avatar choice is intentionally a small preset system. Babylon.js
constructs each preview from primitives and colours supplied by the API; this
phase has no 3D models, body-part editor, asset pipeline, or paid dependency.

- [x] Define exactly ten free, stable, server-owned presets with varied visual
  presentation, representative skin tones, simple hairstyles, and uniform
  palettes. Identity fields remain independent and choices have no gameplay effect.
- [x] Add MySQL migration 0015 and persist `avatar_id` plus
  `avatar_setup_completed_at`; include both in operational backup/restore.
- [x] Add authenticated `GET /v1/avatar/options`, `GET /v1/profile/avatar`, and
  idempotent `PUT /v1/profile/avatar`; reject IDs outside the server catalogue
  and close the generic profile endpoint as an arbitrary-avatar back door.
- [x] Publish the exact OpenAPI and TypeScript contracts and the Babylon.js UI
  integration guide in `docs/p374-avatar-api.md`.
- [x] Return `avatar_setup_complete` at login and from `/v1/auth/me`, allowing
  the UI to route first-login players before showing the case desk.
- [x] **FRONTEND HANDOFF:** implement the required first-login ten-card picker,
  procedural Babylon.js previews, accessible non-WebGL fallback, save/error
  states, and later re-selection in Settings exactly as documented in
  `docs/p374-avatar-api.md`. Done in `web/`: `AvatarPicker.svelte` (first login
  and Settings), `lib/avatar3d.ts` (lazy Babylon.js stills), `lib/avatar-model.ts`
  and `AvatarSilhouette.svelte` (shared fields, SVG fallback and sidebar badge).
- [ ] Test the actual rendered palette in supported lighting, mobile, keyboard,
  screen-reader, reduced-motion, and low-power modes; complete editorial review.
- [ ] Exit criterion: a new player chooses one of the ten presets on first login,
  sees it consistently across the UI, and can change it later without affecting
  clues, ranking, eligibility, or gameplay.

#### P3.8 — Cooperative investigations

- [x] Specify eligibility, online presence, home-base status, time costs,
  response windows, and rewards before implementation.
  The authoritative decisions are recorded in
  `docs/p38-cooperative-investigations-design.md`: private asynchronous help,
  exact-username discovery, no presence/location disclosure, three completed
  cases for eligibility, 12-hour requests, normal owner-case interview time,
  reputation-only rewards with daily and pair caps, and cooperation disabled by
  default for minors or accounts awaiting age assurance.
- [x] Prototype asynchronous help first: an eligible helper questions one
  witness and returns a recommendation; the case owner keeps all decisions.
- [x] Prevent hidden-answer exposure, duplicate accounts, and reward farming.
- [x] Reward help with reputation, cosmetics, or capped convenience—not an
  advantage that makes solo play unfair.
- [x] Add blocking, reporting, moderation, notification preferences, and child
  safety/privacy protections before public social features.
- [x] Exit criterion: help adds value without making a second account optimal
  or enabling harassment and answer leakage.
- [x] **FRONTEND HANDOFF (done in the web client; not yet verified against the live API):** implement the private cooperation screens using
  `docs/p38-cooperation-api.md`; do not add chat, public discovery, presence,
  location sharing, or expose report identities.

##### P3.8.1 — Groups and real-time weekly challenges

Weekly challenges use real server wall-clock time, including movement. If a
journey takes four hours, that challenge attempt remains in transit for four
real hours. This is separate from the ordinary simulated case: a player may
keep one of each case type active and continue playing the ordinary case while
the weekly attempt is travelling.

- [x] Play the weekly attempt on the ordinary case desk and scenes (briefing
  typing, leads, garage, journey loop, notebook, dossier, travel, warrant,
  results) with a distinct violet scheme; Esc returns to the weekly desk, which
  can replay the endless journey animation while the real wait counts down.

**Groups and membership**

- [x] Add private player groups with stable IDs, unique names, owner/admin/member
  roles, invitations, accept/decline/expiry, member removal, voluntary leaving,
  ownership transfer, configurable capacity, and append-only moderation audit.
- [x] Prevent invitation spam, duplicate-account farming, ban evasion, abusive
  names, and unauthorised membership changes. Add blocking/reporting before
  groups are publicly discoverable.
- [x] Define membership at challenge lock time. Players may join or leave groups
  between challenges, but cannot join an already-started challenge, move their
  active attempt to another group, or compete for multiple groups in one week.
- [x] Keep group rosters and results private to members initially; require an
  explicit later privacy/moderation decision before public group leaderboards.

**Weekly schedule and shared case**

- [x] Schedule challenges with an authoritative IANA timezone. Default to
  `Africa/Lagos`, starting every Monday at 07:00 WAT and ending the following
  Monday at 07:00 WAT unless a winner closes the group challenge earlier.
- [x] Store UTC instants plus timezone and schedule version; clients display a
  localised countdown but never calculate eligibility or closure themselves.
- [x] Generate one mission ID, content version, rules version, seed, opening
  budget, fare table, route, thief, witnesses, hidden extra-clue assignments,
  and difficulty for the weekly challenge. Every eligible member receives the
  exact same case truth and economic conditions; only their decisions and
  resulting state differ.
- [x] Open registration before the Monday start and snapshot eligible members
  at lock time. Decide a minimum of two eligible members and a configurable
  maximum before implementation.
- [x] Allow a member to begin at any point during the open week, but use the
  fixed challenge start/end window; joining late grants no deadline extension.
- [x] The challenge expires without a winner if no eligible member records a
  valid capture before the closing instant.
- [x] Run weekly expiry in the production API every minute so winnerless
  challenges and their active attempts close even when nobody opens the UI.

**Parallel cases and real-time movement**

- [x] Support two independent active-case slots per player: one ordinary case
  using the simulated clock and one weekly challenge using the wall clock.
  Their state, budget, dossier, warrant, transport, discipline, and deadline
  must never leak into or block one another.
- [x] Apply real elapsed durations to every weekly-challenge journey, including
  interstate flight/drive/hitching and local drive/hitching to witness venues.
  Flying is fastest and paid, driving is slower and paid, and hitching is free
  and slowest; exact duration scaling remains a balance decision.
- [x] Persist each weekly journey as an authoritative server-side transit job
  containing origin, destination, mode, fare, `departed_at`, and `arrives_at`.
  Debit the fare atomically at departure and mark the attempt `in_transit`.
- [x] Reject travel, interview, warrant, and capture commands on that weekly
  attempt before `arrives_at`. At or after that instant, complete arrival
  idempotently and allow the next action without requiring the browser to have
  remained open.
- [x] Show the quoted real duration and arrival time before departure. Warn when
  a journey cannot finish before the weekly deadline and never let a client,
  reconnect, refresh, animation, or device-clock change the server arrival time.
- [x] Decide during balancing whether venue opening hours can introduce a second
  real-time wait after arrival. Witness questioning itself is immediate by
  default once the player has arrived and the venue is available.

**Fair competition and winner selection**

- [x] Give every competitor a separate authoritative case state; one player's
  travel, witnesses, dossier, budget, warrant, or mistakes never mutate another's.
- [x] Standardise competitive resources. Default to a challenge-only bribe-token
  allowance identical for every member rather than using personal earned-token
  balances; no storefront entitlement may affect challenge gameplay.
- [x] Determine the winner from the earliest server-committed valid `solved`
  transition. Client time, animation completion, request start time, and device
  clock are never authoritative.
- [x] Resolve near-simultaneous captures transactionally with one database winner
  row. Use commit ordering and a stable event ID as the tie-breaker; later valid
  captures remain recorded as finishes but cannot overwrite the winner.
- [x] Close that group's challenge immediately after the first valid capture,
  reject further gameplay commands with a clear result, and preserve all member
  attempts for audit and replay.
- [x] A winner must have a valid warrant and pass every normal engine rule.
  Admins, group owners, support staff, retries, or reconnects cannot appoint or
  replace a winner outside a separately audited correction workflow.
- [x] Award the first valid solver a bounded quantity of in-app tokens, alongside
  the group trophy/result. Define the token type and amount before implementation:
  either use earned bribe tokens or introduce separate challenge tokens.
- [x] Prevent the reward from compounding into a competitive advantage. Weekly
  challenges retain an identical challenge-only bribe-token allowance for every
  entrant, regardless of personal earned balances or previous wins.

**Discipline, lifecycle, and resilience**

- [x] Apply active jail restrictions at challenge start and during play. A
  player jailed before lock is ineligible; a punishment during the challenge
  follows the same active-case forfeiture rule selected for ordinary missions.
- [x] Define behaviour for group deletion, owner departure, account deletion,
  bans, mission/content withdrawal, emergency challenge cancellation, and
  erroneous winners without losing the immutable audit history.
- [x] Make scheduling idempotent across multiple API instances using database
  uniqueness/locking. Restarting services around Monday boundaries must neither
  skip nor duplicate a weekly challenge.
- [x] Preserve active attempts across logout, browser closure, deployments, and
  failover. Server time and persisted transit state determine arrival and expiry
  after recovery; time away from the site still counts toward the journey.

**API, UI events, notifications, and testing**

- [x] Add authenticated APIs for group lifecycle, invitations, roster, upcoming
  challenge, eligibility, enrolment, attempt creation/resume, countdown, member
  status, winner, final standings, history, and notification preferences.
- [x] Publish renderer-neutral events for challenge opening, countdown milestones,
  departure, transit progress/ETA, arrival, member starts/finishes, first valid
  capture, closure, expiry, and rewards. UI animation may show the vehicle,
  changing landscape, and optional music, but cannot decide or accelerate time.
- [x] Let players leave the transit screen and play their ordinary case. Add an
  arrival notification and restore the correct journey progress when they return.
- [x] Add opt-in web/email notifications for invitation, registration opening,
  Monday start, approaching close, winner, and cancellation with rate limits,
  timezone clarity, unsubscribe controls, and no hidden case information.
- [x] Add tests using an injectable server clock for every Monday boundary,
  seven-day window, late start, expiry, timezone conversion, concurrent captures,
  idempotent scheduling, API-instance races, reconnects, jail, bans, and content
  version pinning.
- [x] Test early-command rejection, exact-time arrival, fare atomicity, browser
  closure, service restart/failover during transit, challenge expiry mid-journey,
  ordinary-case play during transit, and a winner closing the challenge while
  other members are still travelling.
- [x] Run load tests for simultaneous Monday starts and capture races, security
  tests for cross-group/cross-account access, and anti-cheat simulations for
  automation, request replay, leaked seeds, alternate accounts, and collusion.
- [x] Exit criterion: every member receives the same complete case, weekly travel
  consumes real elapsed time, an ordinary case remains independently playable,
  the database selects exactly one valid winner per group, no client clock can
  alter outcomes, and challenge operation survives restart and failover.
- [x] **FRONTEND HANDOFF (done in the web client; not yet verified against the live API):** implement private groups, real-time transit,
  standings, event animations, history, and notification controls from
  `docs/p381-groups-weekly-api.md`; never use device time to decide outcomes.
  (Groups, roster management, invitations, the weekly challenge, real-time transit
  with server-timed polling, standings, history, a text timeline and notification
  settings are in. Renderer event *animations* are not built yet; the timeline is
  text only. The API has no "list my groups" call, so the client remembers group ids
  and re-validates them with the server.)

#### P3.9 — Economy and monetisation guardrails

- [x] Define gameplay currencies, earning rates, spending sinks, and anti-farming
  limits. Bribe tokens are earned through play and cannot be purchased.
- [x] Do not sell accurate clues, valid warrants, shorter penalties, faster case
  clocks, or other pay-to-win advantages.
- [x] If corruption appears as a story mechanic, keep it fictional,
  non-purchasable, consequence-driven, and separate from real money.
- [x] Prefer cosmetics, optional story packs, supporter editions, and clearly
  labelled sponsorships that do not alter case truth or difficulty.
- [x] Establish a launch-blocking review gate for advertising, consumer
  protection, gambling-like mechanics, age ratings, privacy, and web payment
  requirements. Commerce remains disabled until the documented review passes.
- [x] Exit criterion: every case is equally solvable without spending money and
  economy simulations show no coercive progression bottleneck.

Implementation, invariant tests, launch gates, and frontend boundaries are in
`docs/p39-economy-monetisation-guardrails.md`. The actual legal review remains a
pre-launch human approval; completing P3.9 does not claim that approval.

##### P3.9.1 — Witness pressure and disciplinary system

This is implemented as a web-only mechanic. Bribe tokens are
earned exclusively through gameplay and cannot be bought, gifted, traded, or
converted to or from money. This preserves the rules against selling better
clues and making corruption purchasable.

The Rust/MySQL implementation and exact frontend contract are documented in
`docs/p391-witness-pressure-api.md`. Only the explicitly labelled frontend and
pre-launch human-review handoffs remain outside the backend implementation.

**Rules and deterministic case setup**

- [x] Add `bribe_witness` and `intimidate_witness` as explicit, server-authoritative
  commands; neither the client nor renderer may decide clue availability,
  detection, panel votes, punishment, rank, or incarceration.
- [x] Generate the extra-clue assignment once from the immutable case seed,
  mission, stage, and witness identity. Persist or deterministically reproduce
  it so retries, reconnects, multiple devices, and duplicate commands cannot
  reroll the result.
- [x] Allow zero or one of the three witnesses at a stop to hold an optional
  extra clue. Start balance testing with a 65% chance that exactly one witness
  has one and a 35% chance that none do; never reveal which witness in advance.
- [x] Make every extra clue supplemental only. The ordinary three-witness route
  must remain sufficient to identify the destination and thief, and refusing
  both pressure actions must never make a case materially harder than its stated
  difficulty.
- [x] Return a better-formulated corroborating clue—not a destination name,
  hidden route, thief ID, guaranteed correct travel choice, or otherwise
  unsolvable information—and pass it through the existing no-place-name and
  editorial validation gates.
- [x] Permit at most one pressure attempt per witness and make the result
  idempotent. Decide during balance testing whether attempting one method locks
  the other method for that witness; default to locking both to prevent fishing.

**Offences and detection**

- [x] Record bribery as `witness_tampering` and intimidation as
  `excessive_use_of_force` in an append-only disciplinary event ledger.
- [x] If the selected witness has an extra clue, return it without a detection
  roll. If the witness has no extra clue, record the offence and make exactly
  one server-side detection roll.
- [x] Use an initial bribery detection probability of 1 in 5 (20%) when no
  extra clue exists. Store the configured numerator, denominator, roll, case,
  stage, witness, command ID, and outcome for audit and deterministic replay.
- [x] Use an initial intimidation detection probability of 1 in 2 (50%) when no
  extra clue exists. Keep this substantially riskier than bribery and test the
  rates over large seeded simulations before release.
- [x] Do not expose the hidden-clue flag or random roll through API payloads,
  logs available to players, analytics, timing differences, or error messages.
- [x] Define a repeat offender as a player with any prior substantiated panel
  case for either offence, including a case resolved with a warning. Failed or
  duplicate API requests do not count as offences.

**Five-member disciplinary panel**

- [x] Persist a `disciplinary_case` containing the triggering offence, prior
  offence count, five individual votes, majority decision, punishment, point
  change, rank change, jail interval, timestamps, and engine-rules version.
- [x] For a first offender, generate five independent seeded 50/50 votes for
  `punish` or `warning`; the majority decision requires at least three matching
  votes and can never tie.
- [x] For a repeat offender, the outcome must be punishment. Generate the five
  panel votes deterministically, then enforce at least three `punish` votes so
  the displayed vote tally and authoritative decision always agree.
- [x] Emit renderer-neutral panel events for five arrivals, individual votes,
  the 3-of-5 decision, warning or sentence, points lost, demotion, and jail end.
  The future UI may animate these events but cannot alter their outcome.
- [x] A warning records the substantiated offence but applies no point loss,
  demotion, or jail. The history remains available for repeat-offender rules.

**Punishment, rank, and jail**

- [x] For punished witness tampering, deduct 1,000 career points with a floor of
  zero. Recompute rank from the resulting points and record a demotion whenever
  the new total falls below the current rank threshold.
- [x] For punished excessive use of force, always demote exactly one rank. Set
  career points to at most one point below the former rank's threshold while
  preserving any already-lower total; never promote or add points as a side
  effect of punishment.
- [x] If a punished player is already a Rookie, replace either offence's normal
  punishment with a 24-hour account-level mission suspension. Store `jailed_until`
  in UTC server time and reject starting or joining missions until it expires.
- [x] Forfeit the active ordinary case immediately when jail begins so
  incarceration cannot pause and preserve a favourable clock.
- [x] Never sell sentence reductions, detection protection, panel votes,
  offence-history removal, rank restoration, or shorter jail time.

**Persistence and API**

- [x] Add migrations for pressure attempts, token ledger entries, disciplinary
  events/cases/votes, punishment transactions, rank-history reasons, and
  `jailed_until`, with foreign keys, unique command IDs, and transactional
  application of clue/result/offence/punishment.
- [x] Add authenticated endpoints for pressure actions, token
  balance, disciplinary history, current panel case, acknowledgement, and jail
  status. Update OpenAPI and generated TypeScript contracts in the same change.
- [x] Keep earned bribe-token awards and spending in an immutable ledger with
  idempotent award/spend references; never trust a client-supplied balance.
- [x] Expose authenticated `GET /v1/cases/{case_id}/pressure-attempts` so the
  frontend can restore pressured-witness locks, supplemental clues, detection
  results, linked disciplinary cases, and resulting token balances after reload.
- [x] Block case creation at the API and storage layers while jailed, including
  concurrent requests and alternate devices. Authentication, account recovery,
  settings, token history, and support access must remain available.

**Resolved economy and distribution decision**

- [x] Ship Naija Chase as a web application; native iOS and Android applications
  and their store-specific purchase requirements are out of scope.
- [x] Bribe tokens are earned through gameplay only. They cannot be purchased
  with real money, transferred between players, gifted, or cashed out.
- [x] Define transparent token awards for case performance and the first
  `state_explorer`/`national_investigator` achievements. Cap repeatable awards and prevent alternate-account,
  replay, automation, and cooperative-mode farming.
  Implemented schedule: first completion `1`, no wrong travel `+1`, no pressure
  `+1`, difficulty 4–5 `+1`, capped at `3` per case and `3` case-earned tokens
  per UTC day; first `state_explorer` earns `2`, first
  `national_investigator` earns `5`, and the held balance is capped at `20`.
  Intimidation remains token-free; bribery spends one earned token.
- [x] **FRONTEND HANDOFF:** show the bribe token requirement and current balance,
  the possibility that a witness has no extra clue, and possible punishment
  before confirmation. Lock a witness after one attempt; do not reveal whether
  that specific witness holds an extra clue.
  Implemented in `web/src/screens/case/Pressure.svelte` (actions after questioning,
  confirmation), `PanelPresentation.svelte` (five-member panel and punishment),
  the case-desk and case-terminal token balance, the token award breakdown on
  `Results.svelte`, and token plus disciplinary history in `Settings.svelte`.
  Local leads omit redundant trail explanations; witness pressure actions are
  compact and aligned beside each questioned witness.
  Lead tiles show only their image and venue name; a questioned lead opens its
  matching notebook statement instead of being disabled.
  Pure logic and tests: `web/src/domain/pressure.ts`, `web/tests/pressure.test.mjs`.
  The panel is a 3D scene (`web/src/scenes/panel/`: five judges raise vote papers, then a cut to the player accepting
  judgement) with `PanelPresentation.svelte` as its 2D fallback.
- [x] Do not tune clue availability, detection, panel voting, or punishment per
  token balance or earning history. Publish the gameplay odds and version every
  balance change for reproducible disputes and support investigations.

**Testing and exit criteria**

- [x] Add unit/property tests for deterministic assignments and rolls, 1-in-5
  and 1-in-2 statistical bounds, one-attempt rules, five-vote majorities,
  mandatory repeat-offender punishment, 1,000-point deductions, every rank
  demotion boundary, Rookie jail, UTC expiry, and arithmetic underflow safety.
- [x] Add storage/API concurrency and idempotency tests proving that tokens are
  charged once, clues are emitted once, offences are recorded once, and panel
  punishment cannot be duplicated or bypassed across devices.
- [x] Simulate the complete 1,000-mission catalogue with players who never use,
  occasionally use, and aggressively use pressure actions. Confirm ordinary
  cases remain equally solvable, expected discipline rates match configuration,
  and no token-farming strategy becomes required or optimal for progression.
- [ ] **PRE-LAUNCH HUMAN REVIEW:** complete abuse, ethics, accessibility, consumer-protection, economy, and
  moderated player testing. Exit only when the mechanic is understandable,
  auditable, non-coercive, and cannot buy case success or evade consequences.

##### P3.9.2 — Web storefront, cosmetics, and optional story packs

**Deferred by product decision.** Do not implement catalogue persistence,
entitlements, checkout, payment-provider integration, paid asset delivery, or
storefront UI until this section is explicitly resumed. The preliminary product
families in `docs/p392-product-catalogue.md` are retained only as the starting
specification for that future pass.

The storefront may sell presentation and additional authored content, but never
gameplay power. Purchased vehicles are visual travel representations only;
their ownership cannot change routes, travel minutes, deadlines, clue access,
scores, rank, detection odds, panel votes, punishment, or jail time.

**Catalogue and product rules**

- [x] Define versioned product types for cosmetic outfits, uniforms, avatar
  accessories, visual themes, cosmetic vehicles, witness/travel/arrest
  animations, animation bundles, and optional story packs.
  The approved sellable families, launch catalogue scope, exclusions, free
  defaults, stable IDs and price tiers are defined in
  `docs/p392-product-catalogue.md`. “Upgrade” means visual or authored-content
  quality only; Naija Chase sells no gameplay upgrades.
- [ ] Give every product a stable ID, display name, description, preview assets,
  price, currency, tax treatment, availability window, regional availability,
  content version, accessibility metadata, and active/retired status.
- [ ] Mark every cosmetic explicitly as `gameplay_effect: none` and reject any
  product configuration that changes authoritative engine values or commands.
- [ ] Treat vehicles as skins for renderer-neutral travel events. A bicycle,
  car, bus, aircraft, or boat skin never overrides the route's server-computed
  mode or duration where that would be geographically or narratively invalid.
- [ ] Treat uniforms and accessories as appearance layers with compatible body,
  animation, clipping, cultural-sensitivity, and modesty metadata.
- [ ] Treat visual themes as client presentation only. They may alter colour,
  texture, typography, sound, HUD framing, and scene dressing while preserving
  contrast, readable text, reduced motion, subtitles, focus states, and the
  semantic DOM alternative.
- [ ] Treat purchased animations as optional visual substitutions for existing
  renderer-neutral events. They cannot delay commands, obscure clues, remove
  accessibility output, or convey information unavailable to other players.
- [ ] Treat story packs as additional authored missions and narratives, not
  easier replacements for the included game. Every pack must pass the same
  clue, no-place-name, venue, deadline, editorial, simulation, and accessibility
  gates as the base 1,000 missions.
- [ ] Keep a substantial complete base game available without purchase. Never
  place account recovery, core progression, ordinary state coverage, required
  dossier traits, or the conclusion of an already-started story behind payment.

**Web checkout and payments**

- [ ] Select a web payment provider only after comparing Nigerian card/bank
  support, international coverage, settlement currencies, fees, tax tooling,
  refunds, disputes, webhook signing, recurring-payment behaviour, availability,
  and data-processing terms. Record the decision in an ADR.
- [ ] Use provider-hosted checkout or provider-tokenised payment elements so
  Naija Chase never receives or stores raw card numbers, CVVs, bank credentials,
  or other sensitive payment authentication data.
- [ ] Create server-side checkout sessions from the authoritative product
  catalogue. Never accept a client-supplied price, currency, discount, product
  description, entitlement, or successful-payment claim.
- [ ] Verify signed provider webhooks, fetch/confirm final payment status where
  appropriate, and process each provider event and transaction ID idempotently.
  The browser redirect is not proof of payment.
- [ ] Maintain an append-only purchase ledger covering checkout creation,
  pending/succeeded/failed/cancelled/refunded/disputed states, provider IDs,
  gross/net/tax/currency amounts, and audit timestamps without sensitive data.
- [ ] Grant entitlements transactionally only after verified payment success.
  Duplicate, delayed, and out-of-order webhooks must never duplicate ownership.
- [ ] Display the complete price, currency, taxes or fees, product contents,
  compatibility, refund conditions, and whether an item is permanent before the
  customer confirms payment.

**Ownership and entitlements**

- [ ] Store permanent account-level entitlements independently of browser
  storage and active sessions. Logging in on another browser restores ownership.
- [ ] Add authenticated APIs for storefront catalogue, owned entitlements,
  checkout creation, transaction status, purchase history, equipped cosmetics,
  story-pack missions, and customer-support references.
- [ ] Enforce ownership on the server for story-pack mission creation and on
  manifest delivery for paid visual assets. Treat client-side hiding as display,
  not access control.
- [ ] Make equipping cosmetics idempotent, validate compatibility server-side,
  and provide a free default for every cosmetic slot and visual category.
- [ ] Define bundles without double-charging existing owners. Before purchase,
  disclose already-owned contents and either prevent purchase or reduce the
  bundle according to a documented policy.
- [ ] Never allow trading, gifting, resale, cash-out, wagering, or conversion of
  purchased entitlements into bribe tokens, career points, or other gameplay
  currency in the initial release.

**Refunds, disputes, tax, and support**

- [ ] Publish web terms of sale, refund policy, privacy notice, fulfilment rules,
  contact details, supported currencies, and regional restrictions before the
  first transaction; obtain legal/accounting review for launch markets.
- [ ] Build a support workflow using internal order references rather than card
  data. Support agents need auditable grant, revoke, refund, and correction
  operations with least-privilege permissions and mandatory reasons.
- [ ] Make refund handling idempotent. Revoke an unused/refunded story pack or
  cosmetic entitlement where legally and contractually permitted, but preserve
  completed-case history and never corrupt saves if content is later unavailable.
- [ ] Define chargeback and fraud handling without automatically punishing
  innocent accounts. Separate commerce disputes from gameplay discipline,
  ranks, offence history, and jail status.
- [ ] Configure receipts, tax/VAT evidence, invoice numbering, retention,
  reconciliation, settlement reporting, and financial exports with an
  accountant familiar with every market in which sales are accepted.

**Safety and presentation**

- [ ] Provide purchase controls: optional storefront hiding, confirmation before
  checkout, transaction email/receipt, spending history, clear cancellation,
  and configurable account-level spending limits before broader release.
- [ ] Never use countdown pressure, fake scarcity, misleading discounts,
  confusing virtual-money conversion, preselected purchases, dark patterns, or
  personalised prices based on gameplay frustration or disciplinary state.
- [ ] Preview cosmetics and themes before purchase using representative 2D and
  3D scenes. Label renderer compatibility, download size, motion, sound, and
  performance requirements.
- [ ] Ensure paid assets have documented ownership or licences, creator credits
  where required, source files, export settings, provenance, and commercial-use
  rights. Do not sell culturally sensitive items without editorial review.

**Testing and exit criteria**

- [ ] Add contract and integration tests for product validation, authoritative
  pricing, signed webhooks, duplicate/out-of-order events, transactional grants,
  cross-account isolation, refunds, disputes, bundles, equipment, and story-pack
  access control.
- [ ] Add browser tests for checkout cancellation, delayed confirmation,
  reconnect/reload, multiple tabs, receipt display, ownership restoration,
  accessible previews, reduced motion, and payment-provider failure modes.
- [ ] Add invariant tests proving purchased products cannot change engine state,
  mission timing, clue selection, scoring, rank, bribe-token balance, detection,
  discipline, or outcomes.
- [ ] Run sandbox purchases, refunds, disputes, reconciliation, backup/restore,
  incident response, and provider-outage exercises before accepting real money.
- [ ] Exit criterion: purchases are server-verified, recoverable, supportable,
  legally reviewed, accessible, and demonstrably cosmetic or additive-only;
  every included mission remains equally solvable without spending money.

#### P3.10 — Adaptive visual client and scene production

- [x] Fix portrait disciplinary-panel framing: keep the camera inside the courtroom,
  retain all five judges, centre the verdict independently of its entrance animation,
  and bound/scroll long verdicts so Accept stays reachable in both orientations.
- [x] Give mobile players the best browser-supported full-screen experience in
  portrait and landscape: a gesture-driven Fullscreen API control, an installable
  fullscreen/standalone web manifest, Android's native install prompt, iPhone
  Safari Add-to-Home-Screen guidance, safe-area-aware `100dvh` layout, install
  icons, tests and operator notes in `docs/mobile-fullscreen-and-install.md`.
- [ ] Generated GLB models (`docs/3d-models.md`, progress in `docs/3d-asset-progress.md`).
  - [x] Prompts, naming and folders (`docs/3d-generator-prompts.md`), asset checker page (`web/dev-assets.html`), optimiser (`pnpm assets:optimize`).
  - [x] Manifest, lazy loader with fallback to the procedural shapes, model-driven figure poses.
  - [x] Avatar picker and garage scene (player avatar and runabout car) use the models.
  - [x] Manifest covers all 346 generated models with real-world sizes; the checker page shows each at its manifest size.
  - [ ] Move the scenes onto the models, one at a time, in this order. For each: use `stage.addModelFigure` with the procedural figure as fallback, drive it
    with `figure.apply(pose)`, check it in the scene (add a `dev/*-preview` page like `dev/garage-preview.ts` if the scene is hard to reach),
    set `checked` in `model-manifest.ts`, run `svelte-check` and the web tests, and update `docs/3d-models.md`.
    - [x] 1. Case office (`office/chase3d-room.ts`): player walking in, blending into a seat, typing and leaving; nine individual furniture models with per-object
      procedural fallback. All ten avatars checked at the keyboard; Standard downloads no GLBs. Shell/door and interactive terminal stay procedural.
      `office_room.glb` is not used because its furniture is baked in. Preview: `web/dev-office.html`; fitting notes in `docs/3d-models.md`.
      - [x] Correct the generated chair's sideways facing: quarter-turn in the manifest, keeping its backrest behind the avatar.
      - [x] Pause seated on every office entry, including witness returns, with "Look around the office", drag/swipe and arrow-key camera controls,
        and "Continue to case desk" to resume the zoom. Full/Standard switching retains exploration; Simple opens the desk directly.
      - [x] Check phone-sized portrait/landscape layouts and emulated touch swipe/taps; keep the exploration card clear of the Detail button at narrow widths.
      - [x] Simple office skips entry/return/exploration/exit animations and opens the functional desk directly, including mid-intro or mid-exploration changes.
    - Future scene passes: remove non-login 2D animations one scene at a time, preserving dialogue, choices, server timing and outcomes.
      Login retains its Canvas 2D chase. Other scenes are unchanged until their own pass.
    - [x] 2. Witness scenes (`witness/chase3d-witness.ts`, buildings and open-air kits): all 35 venue types use the selected avatar,
      role-matched witness, venue-specific crowds, arrival runabout/danfo, main frontage and tagged shared props at Full.
      Manifest sizes and uniform footprint fitting preserve the walking/conversation corridor. Standard downloads no GLBs.
      Baked character textures are retained rather than whole-body tinting; standing and speech gestures are driven through the shared bones.
      Market keeps the witness's open stall procedural. Signs, ground, water, moving details and some specialist vehicles/animals remain procedural.
      Preview: `web/dev-witness.html`; scope and calibration in `docs/3d-models.md`.
      - [x] Simple skips the animation and shows the full server account with Continue; 3D failure shows the same account and an explicit alert.
      - [x] Preserve the server visit/time/funds and pressure handoff; guard Continue and cancel pending setup/late callbacks on detail changes.
      - [x] Check all 35 Full previews and five portrait/landscape mobile layouts, including long account/error scrolling and reachable Continue.
      - [x] Size cattle-market cows to 1.9 m overall height in Full and Standard, without footprint fitting shrinking them below human height.
    - [x] 3. Journey (`journey/chase3d-journey.ts`): Full uses all ten selected avatars walking/sitting/steering, supplied uniformed cabin crew,
      the runabout, moving danfo, parked coaches and airliner. Correct vehicle axes/facing and manifest sizing; fit flight stairs/people to the model's higher door.
      Boarding pass stays procedural and follows the hand. Static exports cannot spin wheels, open textured doors or retract gear.
      Standard retains procedural figures/vehicles. Full-detail drive and hitch journeys use supplied models for landscape props and set pieces; destination/location text remains overlaid, while road, ground, water and sky surfaces and flight scenery stay procedural. Preview: `web/dev-journey.html`.
      - [x] Use the supplied journey scenery models behind Full-detail road journeys, retaining the procedural props as per-model fallbacks.
      - [x] Simple skips ordinary animation with one guarded handoff; weekly Simple preserves server progress and Back without shortening the wait.
      - [x] 3D failure shows functional status with alert/details/Continue; abort abandoned setup and suppress late callbacks.
      - [x] Check all ten seated avatars, vehicle facing, boarding, and five mobile portrait/landscape functional layouts.
    - [ ] 4. Archive (`archive/chase3d-archive.ts`): finish visually verifying the selected player avatar walking to the file, taking it and holding it in a reading pose. The integration and procedural fallback are wired, but the preview reports an avatar GLB loader error (`Cannot set properties of undefined (setting 'weight')`), so Full currently falls back to procedural figures.
    - [ ] 5. Disciplinary panel (`panel/chase3d-panel.ts`): finish fitting and visually verifying all five seated judge models and the player at Full detail; vote papers remain procedural. The current judge models render as oversized dark silhouettes and are single static meshes.
      - [ ] Re-export the judge models with a rig and named arm bones before adding the raise-paper arm motion.
    - [x] 6. Login chase (`chase/chase3d-actors.ts`, `chase3d-world.ts`): masked thief, police and passers-by from models, danfo and matching scenery.
      - [x] Add the omitted masked thief prompt, register its generated Walk/Run model at 1.78 m, and optimise it.
      - [x] Verify and optimise the corrected police Walk/Run export; fit at 1.72 m and retain procedural held props.
      - [x] Full/Standard/Simple share the timeline, with a real Canvas 2D fallback and live switching; failed models retain procedural shapes.
      - [x] Inspect the three cities, no-model requests at lower detail, cancelled setup and WebGL-loss fallback; check mobile login layout and touch navigation.
      - [x] Add `web/dev-chase.html` with seekable inspection and all three detail levels.
    - [ ] 7. Journey and venue vehicles and animals (cattle market, farm, palace, motor park, railway, airport, seaport): replace the lofted cars and boats with the vehicle
      and animal models and set `checked` for each.
  - [x] Generate the 7 missing water-edge and work venues (beach, fishing jetty, jetty, waterfront, seaport, farm, mining site: 29 files) from `docs/3d-missing-prompts.md`, then run `pnpm assets:optimize`.
  - [ ] Generate the 20 held items (`props/held/`, same file), later: they are only needed for carried props and the panel vote paper.
  - [ ] Generate the remaining assets in this order (names and prompts in `docs/3d-generator-prompts.md`, progress in `docs/3d-asset-progress.md`): held items, interior
    rooms (office, garage, hearing room, archive), shared street and market pieces, the 16 open-air venues, the 18 building venues and their interiors, chase and
    journey scenery, then textures and effects. After each batch: check on `dev-assets.html`, run `pnpm assets:optimize`, add the models to the manifest.
  - [x] Add a combined archive/panel preview page for checking model-backed scenes and frame timing.
  - [ ] Dev tools to add as needed: a manifest check that lists files with no manifest entry and the reverse.

- [x] Migrate the current TypeScript DOM renderer to Svelte 5 components while
  retaining Vite, the Rust HTTP API, native HTML semantics, keyboard support,
  screen-reader support, and responsive layouts.
  - [x] Build the application shell, responsive sidebar, account screens, case
    desk, case clock, navigation, settings, and error/loading boundaries.
  - [x] Componentise investigation controls, notebook, dossier, travel, warrant,
    arrest, results, and progression views. The case archive view remains with P3.7.
  - [x] Redesign the visual system: dark Naija palette, serif display type, icon
    set, schematic Nigeria map, paper notebook, case HUD with deadline meter,
    toasts, high-contrast/large-text/reduced-motion settings, and a mock API for
    UI development. See `docs/web-vertical-slice.md`.
  - [x] Link the client to the account, profile, device-session, recovery and
    progression APIs and remove the hard-coded mission list.
  - [x] Add an animated chase scene to the sign-in screen, a compact
    no-scroll registration layout, and a synthesised "Night Pursuit" menu track with an
    on/off button for the pre-game screens.
  - [x] Expose server-selected warrant candidates, the current stop's venues,
    travel durations, and five final hideouts through the API so the client no
    longer uses fixed suspect or venue placeholders. Case assignment replaces
    the obsolete mission picker; the archive remains the mission/replay list.
  - [x] Keep essential dialogue, clues, subtitles, labels, and notebook entries
    as accessible text; do not present environmental prose as large paragraphs.
- [ ] Add Babylon.js as a lazily loaded 3D scene renderer rather than coupling
  rendering to the Rust engine or API.
  - [x] Test drive: the sign-in police chase renders in 3D with Babylon.js (deep
    imports, dynamic import only, 2D fallback, reduced-motion respected) and loops
    through Lagos, Anambra and Kano with smooth transitions, regional scenery and
    passers-by. The lazy chunk is about 410 KiB gzipped; measure frame rate on real
    mobile devices before committing.
  - [ ] Prototype one market investigation, one road journey with a vehicle and
    generated LGA sign, one witness interaction, and one arrest sequence.
    - [x] Market witness scene: Drive or Hitch arrival, the player walks up to a market
      witness who speaks with live word-by-word subtitles, synthesised market sound, a
      length that follows the words (about 10-15 s), venue name on a banner.
      2D (Canvas 2D) fallback for it is built and takes over when 3D fails or the device is weak;
      the convention is in `docs/scene-conventions.md`.
      The player now walks back to the vehicle and is driven away, and the office plays a short return to a case
      terminal (status strip, leads, notebook, dossier, travel, warrant) instead of the old Investigate page.
      Cheap look upgrades (no artist, no GLB): rounded lofted cars and buses, softened boxes, tone-mapped grade,
      sun glow and clouds, contact shadows, and matching curved vehicles in 2D (`docs/scene-conventions.md`).
    - [x] Travelling scene between states (`web/src/scenes/journey/`): hitch ride leaves a bus park and drive
      leaves a garage; either then passes through 3 to 5 landscapes picked at random from 12 (waterfront, forest,
      desert, roadside market, farm road, savanna, rocky hills, village, city outskirts, rainforest, palm plantation,
      river crossing) that blend into each other, and ends at a "Welcome to <state>" billboard. Flying goes through
      "<source state> Airport", shows the boarding pass to the cabin crew, climbs the air stairs, taxis, takes off,
      lands, steps down and walks to "Welcome to <state> Airport". 3D with a 2D fallback, Skip, reduced motion
      starts at the arrival shot; the desk follows. The scene is only the picture: the server's travel command
      has already been accepted and nothing about it changes.
    - [x] Weekly play "Show travel route": an endless, seamless loop of the same scenery (landscapes for drive/hitch,
      a plane among random clouds for flying) behind a button in the in-transit panel; Esc returns to the text.
      Not yet checked on real phones: frame rate, and whether the extra geometry is fine on low-end devices.
      Remaining: the other 34 venue scenes (split between two agents: `docs/agents/Agent1.md` and
      `docs/agents/Agent2.md`), the road journey with an LGA sign, the arrest
      sequence, and measuring frame rate on real mobile devices.
  - [ ] Support glTF/GLB assets, character animation, reusable camera sequences,
    spatial/ambient audio, time-of-day lighting, weather, and regional scenery.
  - [ ] Translate environmental descriptions into animation and scene direction
    rather than displaying prose such as crowd or journey descriptions onscreen.
  - [x] Export the 35 reusable witness-venue archetypes and all 2,946
    location-specific placements as a deterministic Babylon.js input file;
    regenerate it with `make export-witness-scenes`.
- [ ] Add PixiJS as a lazily loaded 2D visual renderer for low-powered devices,
  reduced data use, and players who prefer 2D.
  - [ ] Use animated illustrated backgrounds, parallax layers, sprite characters,
    vehicles, signage, camera pans/zooms, ambient sound, and reduced-motion
    alternatives without reducing clue content or changing game rules.
  - [ ] Do not download Babylon.js and 3D assets during a 2D-only session, or
    PixiJS and 2D scene assets during a 3D-only session.
- [ ] Define one versioned, renderer-neutral semantic scene contract consumed by
  both Babylon.js and PixiJS.
  - [ ] Represent scene type, jurisdiction, LGA, venue, regional environment,
    characters, activities, vehicle, signage, camera sequence, time, weather,
    sound, dialogue, clue reveal, and accessibility description as structured
    data rather than renderer-specific instructions from the Rust engine.
  - [ ] Guarantee that 2D and 3D modes consume the same authoritative game
    events, reveal the same clues, charge the same time, and produce identical
    outcomes; they are renderers, not separate games.
- [ ] Implement adaptive graphics selection without relying on phone-model or
  user-agent allowlists.
  - [ ] Check usable WebGL support and safe browser capability signals, then run
    a short representative render benchmark before choosing an initial mode.
  - [ ] Provide enhanced 3D, lightweight mobile 3D, and 2D quality tiers with
    measurable frame-time, memory, download, thermal, and battery budgets.
  - [ ] Default to Automatic, prefer lightweight 3D on capable mobile devices,
    fall back to 2D when 3D is unsupported or persistently misses the tested
    performance floor, and never oscillate modes during a scene.
  - [ ] Persist the recommended mode per device/browser and reassess after a
    material browser, device, or renderer change.
- [ ] Give the player permanent controls for Automatic/3D/2D mode, automatic or
  low/medium/high 3D quality, 30/60 FPS limit, reduced motion, subtitles, and
  relevant audio levels; a manual choice overrides automatic selection.
- [ ] Create a modular Nigerian scene-production pipeline instead of building a
  bespoke cinematic for every mission.
  - [ ] Produce reusable regional terrain, road, vegetation, architecture,
    vehicle, venue, prop, crowd, witness, animation, signage, weather, lighting,
    sound, and camera-shot libraries with documented Nigerian references.
  - [ ] Generate state/LGA/venue variations from validated content while
    preventing geographically impossible assets or culturally inappropriate
    combinations.
  - [ ] Define Blender-to-glTF validation, texture/mesh compression, levels of
    detail, instancing, asset manifests, caching, streaming, disposal, and
    licensing/provenance requirements.
- [ ] Test representative low-, mid-, and high-tier Android devices plus current
  iOS and desktop browsers using cold and warm caches, slow networks, long play
  sessions, background/resume, orientation changes, and memory pressure.
- [ ] Preserve a fully operable DOM alternative for every essential canvas
  interaction and document meaningful scene descriptions for screen readers;
  visual spectacle must never be required to understand or solve a clue.
- [ ] Exit criterion: Automatic selects a stable playable mode on the supported
  device matrix; players can switch modes without losing case state; 2D and 3D
  pass gameplay-parity tests; mobile budgets and accessibility gates pass; and
  production cost plus asset provenance are documented.

#### P3.11 — Release readiness

- [x] Bound MySQL pool size and connect/read/write time, and protect the API with
  configurable request deadlines, concurrent-request limits, load shedding, and
  stable JSON `503` responses. Production defaults remain below Nginx's timeout.

- [x] Add explicit MySQL transport encryption configuration, require it in the
  staging/production environment templates, and bind the API to loopback for
  Nginx proxying.

- [ ] Block staging-to-production promotion until the remaining P3.7
  account/session security and recovery tests pass.
- [ ] Complete trademark, company-name, domain, web-app name, and social-handle
  clearance for Naija Chase before public branding or launch.
- [ ] Complete outstanding source-line, sensitivity, Nigerian English,
  spelling, name, and diacritic reviews from P2.
- [ ] Define supported devices, performance budgets, uptime objectives, data
  retention, privacy policy, terms, community rules, and support process.
- [ ] Verify the production Cloudflare Email Sending account, onboarded sender
  domain, `Email Sending: Edit` token, delivery/bounce monitoring, suppression
  handling, and confirmation/password-reset delivery before launch.
- [x] Replace best-effort background confirmation delivery with a durable MySQL
  email outbox, bounded exponential retries, dead-letter/support visibility,
  expiry-aware token regeneration, and a rate-limited resend-confirmation API.
  Registration must remain successful when the provider is unavailable.
- [ ] Run closed playtests, accessibility and localisation reviews, security and
  load tests, backup restoration, and incident-response exercises.
- [ ] Run destructive/restore integration fixtures against a dedicated disposable
  MySQL test database and add retention/partitioning for `service_audit`; the
  shared development database currently contains over 264,000 audit rows, making
  a complete restore fixture unnecessarily slow.
- [ ] Add analytics only for documented product questions and minimise personal
  data collection.
- [ ] Run a staged rollout with rollback controls and monitored release gates.
- [ ] Exit criterion: no release-blocking content, security, accessibility,
  reliability, privacy, or legal findings remain.

#### Deferred technical decisions

- [x] Keep distribution web-only; native desktop, iOS, and Android clients are
  out of scope unless a future product decision explicitly reopens them.

## Verification checklist

Run these checks after changing gameplay data or engine logic:

```bash
make check
make build
make release
make benchmark
make db-test
```

Before considering a content pass complete, confirm:

- [x] Every jurisdiction has at least one valid three-clue combination.
- [x] Every selected venue is available in its state profile.
- [x] Each three-clue intersection resolves to only the intended state.
- [x] Individual clues retain meaningful ambiguity on levels 3–5; easier cases
  deliberately provide landmark support or explicit destination confirmation.
- [x] Witness roles match their venues.
- [ ] Informal speech sounds natural and preserves the factual clue.
- [x] Profile evidence remains embedded in dialogue.
- [x] All 100 thieves remain uniquely identifiable.
- [x] All 1,000 missions complete an automated engine dry run.
- [x] Existing save files either load safely or migrate gracefully.

## Maintenance rule

- [x] Make all five case difficulties affect deduction and budget: Easy destination
  confirmation, Standard landmark support, ordered ambiguous-clue bands for levels
  3–5, and 80/60/40/30/20% reserves. Preserve random unsolved-case assignment and
  saved attempts; validate the catalogue and solved-case exclusion. See
  `docs/case-difficulty.md`.

When work is completed, move or mark its checkbox in this file during the same
change. If counts change, update both **Current baseline** here and the relevant
section of `README.md`.

- [ ] Buying music
- [x] Hire an assistant using one-third of the virtual opening case budget,
  available above Rookie rank only before the first witness interview. The
  assistant files observed dossier traits, returns three route suggestions and
  quietly shortens local witness travel time; it remains unavailable in weekly
  group challenges to preserve competitive parity.
- [x] After assistant testing, restore the above-Rookie hiring restriction.

## Marketing site (naijachase.com)

- [x] Static landing site in `landing/` (home, privacy, terms, disclaimer); play buttons open `https://naijachase.app`.
  Publish with `make publish-landing` (nginx: `deploy/nginx/naijachase.com.conf`, root `/var/www/naijachase.com`).
- [ ] Update the legal pages whenever data collection, analytics, checkout or advertising change.
- [ ] Add an Open Graph PNG (1200×630) and `og:image` tags to `landing/index.html`.
- [x] Link Privacy/Terms/Disclaimer from the registration screen in `web/` and require acceptance.

- [x] Remove resolved-level and device-capability hints beneath the Automatic/Full/Standard/Simple toggle.

- [x] Precompute catalogue opening budgets by difficulty, mission routes and stage clue plans, local costs and venue availability; verify all 1,000 missions against uncached calculations and independent loads.

- [x] Handle SIGTERM/Ctrl-C, drain requests and stop background workers within systemd limits; separate deployment migrations and runtime grants, and lock weekly expiry across instances (see `docs/process-lifecycle.md`).

- [x] Bound browser API requests and preserve uncertain command IDs; enforce game CSP, version-aware HTTP caching, asset-original deployment exclusion and Finder-file cleanup (see `docs/browser-resilience.md`). Service-worker caching remains deferred.

- [x] Reconcile the two NaijaChase Nginx sites together, disable the legacy duplicate landing entry, reject duplicate-name warnings and restore files/symlinks on deployment failure.

## Independent administration console

- [x] Add physically separate admin backend/frontend, independent operator
  authentication and credentials, versioned read-only reporting views, account
  and consented registration/visitor measurements, email queue visibility, and
  host health readings. See `docs/admin.md` for definitions and limits.
- [x] Add dedicated admin build/check targets and deployment templates without
  adding admin publication to the player or landing-site deployment flow.
- [x] Add named username/password staff accounts with owner/operator/viewer
  roles, durable sessions/revocation, append-only runtime audit and permanent
  bootstrap retirement when the first named owner is created.
- [x] Add account support/notes/session revocation, activation/retention metrics,
  moderation decisions and operational alerts using a separate control schema
  and narrow versioned game reporting/procedure contracts.
- [x] Document concrete DNS/certificate/database/password setup and add a helper
  that generates consistent private env/SQL secrets; admin installation remains
  independent of the player deployment. See `docs/admin-deployment.md`.
- [x] Match the existing game's required database encryption, make strict
  certificate identity checking explicit, and preserve staff/bootstrap state
  when control migrations are resumed.
- [x] Reuse existing game connection settings during admin setup, manage service
  passwords automatically, resume earlier setup files, and explain missing
  migration-service prerequisites before invoking systemd.
- [x] Support normal HTTPS staff login and keep the admin site in its own
  005 Nginx configuration with validation and rollback.
- [x] Publish the admin frontend under `/var/www/naijachase-admin` to match
  the other NaijaChase web deployments.
- [x] Retire completed deployment repair helpers and legacy config aliases;
  keep prepared settings at `~/.config/naijachase-admin/admin.env` and remove
  spent provisioning files without deleting credentials or database backups.
- [ ] Run the documented production rollout with actual DNS/server/database
  values, restricted grants, certificate and named-owner handover.
- [ ] Integrate provider-confirmed delivery/bounces, external alert delivery,
  tested-restore evidence, certificate expiry and release/dependency inventory.
