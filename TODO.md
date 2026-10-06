# Naija Chase — Project Tracker

Last updated: 6 October 2026

This file is the source of truth for completed work, current limitations, and
next development priorities. Update it whenever a feature or content pass is
completed.

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
- [x] 518 destination clue atoms: 14 for every jurisdiction
- [x] Source URLs attached to all 518 clue atoms
- [x] 406 clue atoms linked directly to internal knowledge records
- [x] 238 clues reference-cross-checked; 280 held for exact source-line review
- [x] 9,324 dialogue variants across three difficulty levels and two registers
- [x] All 1,000 missions connected to the contextual witness engine
- [x] Career-level recent clue and dialogue tracking
- [x] Rust workspace tests pass, including all 1,000 missions and every
  mission-stage venue combination

## Completed game systems

### Career and cases

- [x] Investigator identity
- [x] Rookie starting rank
- [x] Career points and promotions
- [x] Automatic saving and case resumption
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
- [x] Travel unlocks as soon as the key witness at the current stop provides
  that stop's dossier hint; the other two interviews remain optional
- [x] Different destination evidence from each witness
- [x] Individual clues remain ambiguous
- [x] Three-clue intersection resolves to exactly one state
- [x] Suspect traits are embedded naturally in witness dialogue
- [x] Notebook shows the narrowing destination shortlist
- [x] Nigerian roles such as agbero, market woman, conductor, boatman,
  clearing agent, cattle trader, and palace guard
- [x] Nigerian Pidgin for appropriate informal and non-formal witnesses
- [x] Standard English for most formal and professional witnesses
- [x] Removed generic phrases such as "route cipher" and "specialist detail"

### Suspects and warrants

- [x] Eight dossier fields: sex, height, skin tone, hair, hobby, vehicle,
  accessory, and distinguishing feature
- [x] Unique profile for every thief
- [x] Profile evidence described during ordinary witness interviews and entered
  manually by the player
- [x] Physical descriptors are embedded naturally in both English and Nigerian
  Pidgin witness accounts
- [x] Completed profile opens a three-suspect comparison led by the player
- [x] All eight fields are required before a warrant can be issued
- [x] Correct warrant and capture state required to close a case
- [x] Warrant candidates display complete eight-trait descriptions
- [x] A warrant no longer ends the case; the player must locate the final hideout
- [x] Finding the correct hideout without a warrant causes the suspect to escape

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

- [x] Every jurisdiction has 14 distinct clue atoms.
- [x] Every clue atom has three formulations per difficulty and speech register.
- [ ] Nigerian Pidgin variants are mechanically generated and still require
  regional, native-speaker editorial review.
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
- [ ] Publication remains blocked on 280 exact source-line checks, 78 human
  sensitivity reviews, and native-speaker review of the Pidgin variants.
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
- [x] Target 500–750 curated clue atoms nationally. Current total: 518.
- [x] Cover history, kingdoms, independence, civil-war history, languages,
  traditions, food, festivals, literature, music, architecture, geography,
  ecology, agriculture, industry, institutions, monuments, and heritage.
- [x] Give every clue at least three dialogue formulations per difficulty and
  speech register.
- [x] Add easy, medium, and hard versions of clue phrasing.
- [ ] User editorial task: manually review Nigerian Pidgin rather than relying
  only on mechanical transformations.
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
- [ ] Review Nigerian English and Pidgin with native speakers from multiple
  regions; avoid presenting one variety as universal.
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

- [ ] Implement `naijachase-api` as an application layer around
  `naijachase-core`, not
  as part of the core game engine.
- [ ] Define versioned HTTP endpoints around engine commands and event responses;
  add WebSockets only for features that genuinely require server push.
- [ ] Convert validated API requests into typed core commands and convert core
  results into client-safe response DTOs without leaking hidden case answers.
- [ ] Load the active case, enforce ownership, execute one core command, and
  persist new state plus events within a single transaction.
- [ ] Keep database repositories and transaction handling behind
  `naijachase-storage`; the core receives explicit inputs and returns state
  changes.
- [ ] Add authentication, authorisation, validation, rate limiting, and secure
  session handling before public access.
- [ ] Make state-changing requests idempotent and protect concurrent updates.
- [ ] Require a client-generated command ID and state version so retries are
  safe and stale or duplicate commands cannot advance a case twice.
- [ ] Add structured logs, error reporting, health checks, metrics, and audit
  trails without recording private data or unrevealed answers.
- [ ] Add unit, integration, contract, load, security, and recovery tests.
- [ ] Establish separate development, staging, and production environments.
- [ ] Exit criterion: restarts, duplicate requests, invalid commands, and
  concurrent updates cannot corrupt a case.

#### P3.6 — Web vertical slice

- [ ] Build one responsive, accessible 2D web case before expanding the scope.
- [ ] Implement onboarding, case selection, interviews, notebook, manual dossier,
  state travel, warrant selection, arrest, and results.
- [ ] Add a usable Nigeria map with keyboard and screen-reader alternatives.
- [ ] Create a reusable visual system for states, venues, witnesses, suspects,
  evidence, travel, warrants, and ranks.
- [ ] Use TypeScript for the application layer and evaluate Three.js, Babylon.js,
  or another WebGL/WebGPU renderer through a focused prototype rather than
  coupling browser rendering to the server implementation language.
- [ ] Use the Rust WebAssembly build only for suitable client-side engine work;
  keep DOM, accessibility, asset loading, and 3D scene presentation in the web
  technology best suited to those tasks.
- [ ] Start with lightweight route, arrival, dossier, warrant, and arrest motion.
- [ ] Test on low-bandwidth connections and modest mobile devices.
- [ ] Exit criterion: new players finish the case unaided and accessibility,
  performance, and usability targets pass.

#### P3.7 — Identity, progression, and home base

- [ ] Add an optional profile with display name, pronouns or sex if the player
  chooses, avatar, uniform, and home state/FCT.
- [ ] Use fictional vehicles and travel operators until advertising and legal
  policies exist; keep real brands out of the first release.
- [ ] Prototype reduced local investigation cost at home rather than completely
  free questioning, which could remove the time challenge.
- [ ] Add a case archive of captured thieves and completed missions.
- [ ] Add achievements for cases, ranks, states, deduction, efficient travel,
  and helping other investigators.
- [ ] Add leaderboards only after anti-cheat, privacy, moderation, seasons, and
  fair ranking rules exist.
- [ ] Exit criterion: progression remains understandable, balanced, and fully
  playable without purchases.

#### P3.8 — Cooperative investigations

- [ ] Specify eligibility, online presence, home-base status, time costs,
  response windows, and rewards before implementation.
- [ ] Prototype asynchronous help first: an eligible helper questions one
  witness and returns a recommendation; the case owner keeps all decisions.
- [ ] Prevent hidden-answer exposure, duplicate accounts, and reward farming.
- [ ] Reward help with reputation, cosmetics, or capped convenience—not an
  advantage that makes solo play unfair.
- [ ] Add blocking, reporting, moderation, notification preferences, and child
  safety/privacy protections before public social features.
- [ ] Exit criterion: help adds value without making a second account optimal
  or enabling harassment and answer leakage.

#### P3.9 — Economy and monetisation guardrails

- [ ] Define currencies, earning rates, spending sinks, refunds, regional
  pricing, parental controls, and spending limits before adding purchases.
- [ ] Do not sell accurate clues, valid warrants, shorter penalties, faster case
  clocks, or other pay-to-win advantages.
- [ ] If corruption appears as a story mechanic, keep it fictional,
  non-purchasable, consequence-driven, and separate from real money.
- [ ] Prefer cosmetics, optional story packs, supporter editions, and clearly
  labelled sponsorships that do not alter case truth or difficulty.
- [ ] Review advertising, consumer protection, gambling-like mechanics, age
  ratings, privacy, and platform payment requirements before launch.
- [ ] Exit criterion: every case is equally solvable without spending money and
  economy simulations show no coercive progression bottleneck.

#### P3.10 — Visual expansion and 3D decision gate

- [ ] Measure whether the 2D slice meets retention, comprehension, performance,
  and cost goals before commissioning 3D work.
- [ ] Prototype air travel, road travel, warrant approval, and one suspect
  character on target devices.
- [ ] Define art direction, Nigerian references, asset and animation pipelines,
  download budget, production budget, and device performance floor.
- [ ] Choose 2D, 2.5D, selective 3D, or full 3D from prototype evidence.
- [ ] If 3D proceeds, create modular characters and environments rather than 100
  bespoke thieves and nationwide terrain for the first release.
- [ ] Exit criterion: the go/no-go decision documents performance, production
  time, accessibility, and total asset cost.

#### P3.11 — Release readiness

- [ ] Complete trademark, company-name, domain, app-store, package-name, and
  social-handle clearance for Naija Chase before public branding or launch.
- [ ] Complete outstanding source-line, sensitivity, Nigerian English, Pidgin,
  spelling, name, and diacritic reviews from P2.
- [ ] Define supported devices, performance budgets, uptime objectives, data
  retention, privacy policy, terms, community rules, and support process.
- [ ] Run closed playtests, accessibility and localisation reviews, security and
  load tests, backup restoration, and incident-response exercises.
- [ ] Add analytics only for documented product questions and minimise personal
  data collection.
- [ ] Run a staged rollout with rollback controls and monitored release gates.
- [ ] Exit criterion: no release-blocking content, security, accessibility,
  reliability, privacy, or legal findings remain.

#### Deferred technical decisions

- [ ] Reassess native desktop and mobile clients after the web client and engine
  API are stable; do not maintain multiple interfaces prematurely.

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
- [x] Individual clues retain meaningful ambiguity.
- [x] Witness roles match their venues.
- [ ] Informal speech sounds natural and preserves the factual clue.
- [x] Profile evidence remains embedded in dialogue.
- [x] All 100 thieves remain uniquely identifiable.
- [x] All 1,000 missions complete an automated engine dry run.
- [x] Existing save files either load safely or migrate gracefully.

## Maintenance rule

When work is completed, move or mark its checkbox in this file during the same
change. If counts change, update both **Current baseline** here and the relevant
section of `README.md`.
