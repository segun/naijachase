# Naija Chase

This repository contains the structured content used by the Nigeria mystery game.
Active filenames intentionally omit version numbers; dataset history belongs in
source control and in each bundle's metadata.

## Layout

- `data/locations/locations.csv` — 500 playable locations
- `data/knowledge/knowledge.csv` — 5,000 knowledge records
- `data/knowledge/location-knowledge-relations.csv` — location-to-knowledge links
- `data/clues/clue-formulations.csv` — 12,000 reusable clue formulations
- `data/missions/` — 1,000 missions plus their clues and witnesses
- `data/thieves/` — thieves, trait definitions, and trait assignments
- `data/bundles/` — JSON content packs and dataset metadata
- `rust/` — Rust engine, terminal, API boundary, content tools, and tests
- `admin/backend/` and `admin/frontend/` — separate administration service and console
- `schemas/` — reserved for machine-readable dataset schemas
- `archive/` — superseded datasets retained for reference

## Active versus archived data

The expanded 500-location and 5,243-record knowledge datasets are active. The
original `v0_2` location and knowledge backbone is retained under `archive/v0_2/`.
Mission and thief datasets remain active because no newer replacements exist.

## Content catalogue

The checked-in CSV catalogue is the canonical authored source. The Rust content
crate loads and validates its identifiers, relationships, counts, clue coverage,
missions, travel graph, profiles, narratives, and editorial metadata. Run
`make validate` after edits. The Makefile also exposes the editorial,
enrichment, simulation, and export workflows; run `make help` for the complete
command list. The checked-in catalogue remains the authored source of truth.

MySQL persistence reads `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`,
`MYSQL_PASSWORD`, and `MYSQL_DATABASE` from the environment. Apply pending
schema migrations with `make db-migrate`. Never commit database credentials.
The runtime automatically loads these values from `.env` at the repository
root when present, or from the file selected by `NAIJACHASE_ENV_FILE`. That
file overrides inherited environment values. Use an explicit private file for
isolated tests or deployments; the separate admin service reads only its own
exported `ADMIN_*` settings.

Run `make db-rebuild` to import and validate all canonical content, or
`make p34` for the complete persistence gate. `make db-backup` and
`make db-restore` back up and recover mutable player, career, case, and event
data without mixing it into the replaceable content catalogue. See
`docs/data-model.md` for ownership and recovery details.

## Service API

The Rust HTTP service is available with `make api`. It exposes versioned
`/v1` authentication, case, and command endpoints while keeping hidden routes,
thief identities, answer keys, timing rules, and hideouts on the server.
Configure `NAIJACHASE_API_BIND`, `NAIJACHASE_RATE_LIMIT_PER_MINUTE`,
`NAIJACHASE_REQUEST_TIMEOUT_SECONDS`, `NAIJACHASE_MAX_CONCURRENT_REQUESTS`,
`NAIJACHASE_ENV`, and the Cloudflare email settings in the repository `.env`.
Registration uses verified email/password accounts; browser sessions are
opaque, revocable, HttpOnly cookies. Environment-specific examples live in
`config/environments/`.

Run `make p35` for the complete service-safety gate. API contracts, status
codes, authentication, deployment requirements, health checks, metrics, and
recovery behaviour are documented in `docs/api-v1.md`.
Email queueing, confirmation, resend, password recovery, and production
monitoring are documented in `docs/email-delivery-and-verification.md`.

## Administration

The independent admin backend and frontend provide account/registration
statistics, system health, named staff roles and audit, account support,
product activity/retention, moderation and operational alerts. They connect
through versioned game reporting views and one narrow session-revoke
procedure. Staff, sessions, audit and support records live in a separate
control schema with different credentials; the process, bundle and hostname
are also independent.

Run `make admin-install`, `make admin-check`, and `make admin-build`. For local
development, export a private copy of `config/environments/admin.env.example`,
then run `make admin-api` and `make admin-web` in separate terminals. The admin
console opens at `http://127.0.0.1:4174`. For production follow
[docs/admin-deployment.md](docs/admin-deployment.md): `make admin-setup` reuses
the existing database connection, manages generated service credentials, and
resumes earlier setup files. The guide covers the hostname certificate and
separate installation. First login uses bootstrap `admin`;
creating a named owner permanently disables that bootstrap account. Definitions
and operational limits are in [docs/admin.md](docs/admin.md).

## Web client

Install the pinned web dependencies with `cd web && pnpm install`. Run
`make api` and `make web` in separate terminals, then open
`http://127.0.0.1:4173`. Run `make p36` for the complete web vertical-slice
gate. The architecture, accessibility checks, mobile budget, and 2D/3D/Wasm
decision are documented in `docs/web-vertical-slice.md`. Animated scenes are 3D
with a 2D fallback; see `docs/scene-conventions.md` before adding one.

## Play in the terminal

The terminal edition requires Rust and Cargo. Run:

```bash
make play
```

The first run creates a MySQL-backed investigator identity at Rookie rank. Each case begins
Monday at 07:00 and must be solved before the following Monday. The case menu
draws from all 1,000 missions and all 100 thieves. At every stop, three locally
appropriate venues offer different, conversational witness clues. Each clue
leaves several states plausible; the notebook intersects the evidence until the
three accounts point to one destination. Suspect traits are embedded in what
each witness remembers instead of being printed as a separate clue. Every
witness now speaks grammatical English; locally appropriate roles and terms
such as agbero remain part of the setting without mechanically generated
dialect. Venues have
opening hours, interviews consume time, and travel time depends on the
distance between state capitals. Travel is limited to Nigeria's 36 states and
the Federal Capital Territory. Consecutive stops within one state use a local
road transfer rather than pretending the player can fly directly to an LGA.
Each case now spans eight investigation stops: the opening jurisdiction and
seven successful trips. One key witness at each stop contributes a new suspect
detail and unlocks onward travel; the other two interviews are optional. A correct route
takes five to six in-game days, preserving no more than two days for mistakes.

A warrant becomes available only after the player manually completes eight
dossier fields: sex, height, skin tone, hair, hobby, vehicle, accessory, and a
distinguishing feature. Each detail is embedded naturally in grammatical
English witness dialogue, but the game does not copy it into
the dossier. The player interprets the statement, chooses the appropriate
field value, and may revise it later. At the capture state, the game presents
three plausible suspect profiles and the player chooses the warrant target.
Successful cases award career points and promotions. The current case is saved
automatically and can be resumed on the next run.
Selecting a warrant target does not end the case. At the last stop, the player
must search the three investigation venues and find the hideout before time
runs out. Finding the thief without first obtaining a valid warrant results in
an escape.

Useful commands:

```bash
make play ARGS="--mission NG-M0001"
make play ARGS="--difficulty hard"
make play ARGS="--seed 42"
make play ARGS="--plain"
make play ARGS="--width 100"
make play ARGS="--no-wrap"
make play ARGS="--reset"
```

The P3 terminal experience opens each mission with a full case dossier and
adds a structured detective notebook. The notebook shows the route discovered
so far without exposing future stops, lists the states still supported by the
current witness accounts, lists eliminated states, tracks the journey actually
taken, compares the gathered traits against the suspect roster, and reports
warrant readiness. Completed dossiers produce formal warrant paperwork before
the player signs it. Arrival, arrest, escape, promotion, and expired-deadline
scenes now give the major case transitions distinct presentation.

Choose **Help and rules** from any investigation menu for an explanation of
the game loop. For accessibility and terminal compatibility, `--plain`
replaces typographic punctuation with ASCII, `--width N` sets wrapping from 50
to 120 columns, and `--no-wrap` disables automatic wrapping.

## Engine interface

The UI-independent boundary lives in `naijachase-core` and
`naijachase-contracts`. Clients submit typed visit, dossier, travel, warrant,
and arrest commands and receive structured events without copying game rules.

Sessions retain their deterministic seed and a serialisable replay log. Career
and active-case saves carry format version 2; older unversioned saves migrate
when loaded. Automated coverage runs every one of the 1,000 missions through
the public command interface as well as through the existing content checks.

P3.2 makes deduction player-controlled. Witness interviews populate private
case observations but never the player's dossier. Dossier entries consume a
small difficulty-scaled amount of case time; an entry that contradicts an
observed account produces a warning and score penalty without disclosing the
correct value. Once all eight fields are filled, the engine deterministically
selects the culprit and the two closest alternative profiles for warrant
comparison. The warrant is issued for the suspect selected by the player, so a
wrong interpretation can now produce a wrong arrest and escape.

## Rust engine migration

The production engine lives in the Cargo workspace under
`rust/`. `naijachase-core` contains deterministic state transitions,
`naijachase-contracts` owns serialisable commands, events, and game state,
`naijachase-content` validates the live catalogue, and the API, storage, and CLI
crates depend inward without introducing platform concerns into the core.

Run `make test` for the Rust suite.
The Rust catalogue integration suite exercises every one of the 1,000 missions.
Run `make benchmark` for the engine throughput regression gate.

The terminal, clue catalogue, content validation, simulations, migrations, and
tests are Rust-only. WebAssembly is not required for the server engine.

The ambiguity-aware Nigerian witness catalogue covers all 36 states and the FCT in six confusable
regional groups, with a validated three-clue solution for every jurisdiction.
The P0 depth pass and state-identity enrichment give every state and the FCT
at least 25 distinct atoms. The catalogue currently contains 957 atoms and covers the complete P0 thematic
checklist. The dialogue layer contains 8,613 English formulations: three
variants for each clue and difficulty level. New ordinary/replay attempts prefer
unheard clues and wordings using actual saved interview receipts, then older
material, and save their complete witness plan for consistent resumes. Weekly
entrants share one saved plan. See [witness selection and coverage](docs/witness-selection.md)
for legacy-history limits, rollout and the `make witness-coverage` report.

The editorial catalogue preserves every clue ID and adds an internal knowledge link,
source URL, source authority, reference-alignment status, temporal scope,
sensitivity flags, Nigerian-English status, legacy dialect-review status, and editorial
notes. All 518 atoms have source URLs; 406 link to internal knowledge records;
238 are reference-cross-checked. The remaining 280 are deliberately labelled
for exact page-or-passage verification. The audit also separates historical,
stable, and changeable claims and flags 78 sensitive clues for human review.

The complete queue is stored in
`data/gameplay/clue-editorial-review.csv`. Automated checks are publication
guards, not a substitute for the outstanding source-line, sensitivity, name,
diacritic, and native-speaker reviews.
The venue layer contains 35 venue types and 1,295 explicit state-to-venue
suitability rules. The engine excludes unavailable venues and favours locally
characteristic ones: for example, mosque and emirate clues rank highly in
Sokoto, markets dominate Anambra, farms dominate Benue, and refinery and port
clues rank highly in Rivers. Anambra's seaport weight is explicitly zero.

P1 adds a complete experience profile for every venue type. Encounters now use
fictional locally grounded venue names, day, night, weekend, and event-day
atmosphere, varied witness introductions, role-specific before-and-after
behaviour, and venue-specific waiting and investigation events. These events
also consume investigation time. All 1,295 state-to-venue rules carry an
explicit editorial-review status, and the automated suite dry-runs every one of
the 1,000 missions through the contextual encounter engine.

The location-aware investigation layer maps all 500 real catalogue locations
to 2,946 suitable venue placements. Flights still select only a state or the
FCT; after arrival, the detective travels locally to named cities, LGAs,
landmarks, parks, museums, institutions, and heritage sites. Location type and
tags determine which venues and witnesses can appear, and the witness wording
identifies the local investigation setting without revealing the destination.
Local transfers consume time and persist in saved cases. Because the source
location catalogue did not include coordinates, the geospatial pass now joins
416 locations to Nigerian LGA boundary centroids. Nineteen state capitals use
the state-hub coordinates, while 65 unmatched landmarks and institutions keep
a documented offline state-hub fallback pending landmark-level verification.
Local transfer time uses coordinate distance with a road-distance factor.

The mission-quality layer adds 1,000 narrative profiles and replaces the old
ten-premise cycle in play. Every case now has a unique title, a concrete stolen
item, crime-specific briefing, three route transitions, a thematic venue
preference, a thief-specific calling card, behavioural evidence, a capture
scene, and separate success and failure conclusions. Witness evidence guides
travel across the full jurisdiction map. The three accounts together identify
the destination, with more direct support on the easier levels.

The five difficulty levels now change the puzzle itself. Easy includes a
destination confirmation; Standard retains a landmark clue. Medium,
Challenging and Hard use three ambiguous accounts drawn from increasing bands
of candidate-state overlap, with no standalone landmark giveaway. All three
accounts together identify one destination. Spare transport allocations fall
from 80% on Easy to 20% on Hard. All levels keep the seven-day deadline and
full web travel map. Ordinary assignment remains random among unsolved cases;
player rank does not select the difficulty. See [case difficulty](docs/case-difficulty.md)
for the selection rules, compatibility and validation.

`data/gameplay/mission-balance-report.csv` records the full 1,000-case
scripted simulation. The API catalogue tests separately verify complete
three-witness itineraries using actual venue hours, travel and case budgets.

Validate all content and engine behaviour with the Rust commands documented in
the verification checklist in `TODO.md`.

API shutdown, separate deployment migrations and restricted runtime database grants are documented in [process lifecycle and deployment](docs/process-lifecycle.md).
