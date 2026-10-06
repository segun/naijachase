# Carmen Sandiego Nigeria content

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
- `scripts/` — content-generation utilities
- `schemas/` — reserved for machine-readable dataset schemas
- `archive/` — superseded datasets retained for reference

## Active versus archived data

The expanded 500-location and 5,243-record knowledge datasets are active. The
original `v0_2` location and knowledge backbone is retained under `archive/v0_2/`.
Mission and thief datasets remain active because no newer replacements exist.

## Semantic enrichment

`scripts/enrich_semantic_knowledge.py` reproducibly adds source-linked records
covering heritage, history, culture, ecology, food, music, literature, languages,
agriculture, industry, transport, institutions, and architecture. It preserves
all legacy IDs and replaces only records in its own `KN-SE-` and `CF-SE-` ranges.

`scripts/enrich_semantic_pass2.py` adds deeper material on kingdoms, the civil
war, living heritage, writers, musicians, ecosystems, rivers, industries, and
all 36 states plus the Federal Capital Territory. It owns the separate `KN-S2-`
and `CF-S2-` ranges, so reruns do not disturb earlier content.

## Mission pilot

`data/missions/pilot/` contains 30 playtest missions: ten easy, ten medium, and
ten hard. Every route step uses a distinct knowledge record associated with its
destination. Run `scripts/build_pilot_missions.py` to reproduce the pilot.

## Play in the terminal

The terminal edition requires Python 3. Run:

```bash
./play
```

The first run creates an investigator identity at Rookie rank. Each case begins
Monday at 07:00 and must be solved before the following Monday. The case menu
draws from all 1,000 missions and all 100 thieves. At every stop, three locally
appropriate venues offer different, conversational witness clues. Each clue
leaves several states plausible; the notebook intersects the evidence until the
three accounts point to one destination. Suspect traits are embedded in what
each witness remembers instead of being printed as a separate clue. Informal
witnesses such as agberos, conductors, market women and dockworkers speak
Nigerian Pidgin; formal witnesses generally use standard English. Venues have
opening hours, interviews consume time, and travel time depends on the
distance between state capitals. Travel is limited to Nigeria's 36 states and
the Federal Capital Territory. Consecutive stops within one state use a local
road transfer rather than pretending the player can fly directly to an LGA.

A warrant becomes available only after the player manually completes eight
dossier fields: sex, height, skin tone, hair, hobby, vehicle, accessory, and a
distinguishing feature. Each detail is embedded naturally in witness dialogue,
including role-appropriate Nigerian Pidgin, but the game does not copy it into
the dossier. The player interprets the statement, chooses the appropriate
field value, and may revise it later. At the capture state, the game presents
three plausible suspect profiles and the player chooses the warrant target.
Successful cases award career points and promotions. The current case is saved
automatically and can be resumed on the next run.

Useful commands:

```bash
./play --mission NG-M0001
./play --difficulty hard
./play --seed 42
./play --plain
./play --width 100
./play --no-wrap
./play --reset
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

P3.1 introduces a UI-independent command boundary exported by `engine.py`.
Clients start a case and submit `visit_venue`, `record_trait`, `travel`,
`request_warrant`, and `arrest` commands through `GameEngine`. Each command
returns a `CommandResult` containing structured `EngineEvent` records, so a web,
mobile, or test client can render the same state transitions without copying
terminal rules. The terminal edition now uses this interface as its reference
client.

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

`scripts/build_gameplay_data.py` regenerates the state hubs, distance-based
travel graph, venue catalogue, and unique thief profiles under `data/gameplay/`.
`scripts/build_state_clue_atoms.py` regenerates the ambiguity-aware Nigerian
witness catalogue. It covers all 36 states and the FCT in six confusable
regional groups, with a validated three-clue solution for every jurisdiction.
The P0 depth pass gives every state and the FCT 14 distinct atoms. The
catalogue currently contains 518 atoms and covers the complete P0 thematic
checklist. The dialogue layer contains 9,324
formulations: three variants for each clue,
difficulty level, and speech register. Career saves retain the 60 most recent
clue atoms and 120 most recent dialogue variants so later cases prefer unused
material when alternatives exist.

The editorial pipeline runs `scripts/editorial_review_clues.py` after clue
generation. It preserves every clue ID and adds an internal knowledge link,
source URL, source authority, reference-alignment status, temporal scope,
sensitivity flags, Nigerian-English status, Pidgin-review status, and editorial
notes. All 518 atoms have source URLs; 406 link to internal knowledge records;
238 are reference-cross-checked. The remaining 280 are deliberately labelled
for exact page-or-passage verification. The audit also separates historical,
stable, and changeable claims, flags 78 sensitive clues for human review, and
keeps all Pidgin variants pending regional native-speaker sign-off.

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
scene, and separate success and failure conclusions. Travel choices use the
active witness evidence to prioritise false destinations that share one or two
clues with the correct state. The case remains solvable only by combining all
three clues.

The P2 balance model defines five difficulty levels. Easy and standard cases
use direct formulations and three travel choices; medium uses four choices;
challenging and hard use indirect formulations and five choices. Higher levels
select clue combinations with more candidate states and more overlap, while
all statements remain truthful and carry an explicit reliability label. Venue
ordering minimises unnecessary opening-hour waits without removing the time
pressure. Difficulty-scaled case points, false-travel penalties, time bonuses,
and promotion thresholds replace the original flat rewards.

`data/gameplay/mission-balance-report.csv` records the full 1,000-case
simulation. Every route resolves after three clues and every simulated case
finishes with at least a two-day deadline buffer.

Regenerate location placement data with
`python3 scripts/build_location_coordinates.py` followed by
`python3 scripts/build_location_investigations.py`. Regenerate mission stories
with `python3 scripts/build_mission_narratives.py`, produce the balance audit
with `python3 scripts/simulate_game_balance.py`, then run the automated checks
with `python3 -m unittest discover -s tests -v`.
