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

A warrant becomes available only after five profile fields identify exactly one
thief. Successful cases award career points and promotions. The current case is
saved automatically and can be resumed on the next run.

Useful commands:

```bash
./play --mission NG-M0001
./play --difficulty hard
./play --seed 42
./play --reset
```

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
location catalogue does not yet include coordinates, local journey times are
deterministic hub-based estimates; verified geospatial routing is tracked as a
later balancing task.

Regenerate location placement data with
`python3 scripts/build_location_investigations.py`, then run the automated
checks with `python3 -m unittest discover -s tests -v`.
