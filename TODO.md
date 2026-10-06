# Carmen Sandiego: Nigeria — Project Tracker

Last updated: 6 October 2026

This file is the source of truth for completed work, current limitations, and
next development priorities. Update it whenever a feature or content pass is
completed.

## Current baseline

- [x] 500 Nigerian locations
- [x] 5,243 knowledge records
- [x] 12,729 clue formulations
- [x] 1,000 missions
- [x] 100 thieves with unique five-attribute profiles
- [x] All 36 states plus the Federal Capital Territory
- [x] Complete state-to-state distance and travel-time graph
- [x] 35 venue types
- [x] 1,295 state-to-venue suitability rules
- [x] 35 venue experience profiles with time- and event-aware atmosphere
- [x] Fictional local display names for every available state/venue pairing
- [x] All 500 locations mapped through 2,946 suitable location-to-venue links
- [x] 518 destination clue atoms: 14 for every jurisdiction
- [x] 9,324 dialogue variants across three difficulty levels and two registers
- [x] All 1,000 missions connected to the contextual witness engine
- [x] Career-level recent clue and dialogue tracking
- [x] 28 automated tests passing

## Completed game systems

### Career and cases

- [x] Investigator identity
- [x] Rookie starting rank
- [x] Career points and promotions
- [x] Automatic saving and case resumption
- [x] Seven-day case deadline beginning Monday at 07:00
- [x] Case score, travel penalties, arrest, and failure states

### Travel and time

- [x] Travel is limited to states and the FCT
- [x] Travel time is based on distance between state hubs
- [x] Nearby routes use road travel; longer routes use air travel
- [x] Consecutive stops in one state use a local road transfer
- [x] Interviews, waiting, travel, and warrant processing consume time
- [x] Venues have opening and closing hours

### Witnesses and clues

- [x] Three witness encounters at every investigation stage
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

- [x] Five evidence fields: hair, hobby, vehicle, accessory, and feature
- [x] Unique profile for every thief
- [x] Profile evidence gathered during ordinary witness interviews
- [x] Completed profile resolves to one thief
- [x] Warrant required before arrest
- [x] Correct warrant and capture state required to close a case

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

## Current limitations

- [x] Every jurisdiction has 14 distinct clue atoms.
- [x] Every clue atom has three formulations per difficulty and speech register.
- [ ] Nigerian Pidgin variants are mechanically generated and still require
  regional, native-speaker editorial review.
- [x] Venue context is state-, city-, LGA-, landmark-, and institution-aware.
- [ ] Local travel times are deterministic hub-based estimates until verified
  coordinates or road-routing data are added.
- [ ] The 1,000 mission narratives are functional but often feel assembled
  rather than individually authored.
- [ ] Difficulty affects clue selection but needs broader balancing across
  ambiguity, time, travel, false leads, and witness reliability.
- [ ] Cultural, historical, and linguistic content needs a systematic editorial
  and source-verification pass before publication.
- [x] Venue encounters now have an atmospheric terminal presentation.
- [ ] The wider terminal presentation outside venue encounters remains
  functional rather than atmospheric.

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

- [ ] Coordinate each crime, stolen object, thief, route, venue, and final
  capture setting around a coherent theme.
- [ ] Add crime-specific opening briefings.
- [ ] Add route-specific transitions and arrival descriptions.
- [ ] Create stronger false destinations that share one or two clue traits.
- [ ] Add thief-specific behaviour and calling cards.
- [ ] Add authored capture scenes and case conclusions.
- [ ] Review all mission titles and premises for repetition.

### P2 — Difficulty and game balance

- [ ] Define measurable easy, medium, and hard ambiguity targets.
- [ ] Make difficult witnesses more indirect without becoming obscure.
- [ ] Tune the number and quality of false destinations.
- [ ] Balance opening hours and waiting penalties.
- [ ] Balance road and air travel times against the seven-day deadline.
- [ ] Replace estimated in-state travel times with verified coordinate or
  road-routing data while keeping an offline deterministic fallback.
- [ ] Add witness reliability carefully; never make a case depend on an
  unknowably false statement.
- [ ] Run automated simulations to measure solve rates and remaining time.
- [ ] Tune points, penalties, warrants, and promotion thresholds.

### P2 — Editorial review

- [ ] Attach a reliable source or knowledge record to every clue atom.
- [ ] Verify geographic, historical, cultural, and institutional claims.
- [ ] Review Nigerian English and Pidgin with native speakers from multiple
  regions; avoid presenting one variety as universal.
- [ ] Check names, spelling, diacritics, and capitalisation.
- [ ] Distinguish historical facts from current institutions and conditions.
- [ ] Remove stereotypes and overly broad ethnic or religious assumptions.
- [ ] Mark sensitive civil-war, religious, and political material for review.

### P3 — Terminal experience

- [ ] Add a clearer case dossier at the beginning of each mission.
- [ ] Add a structured detective notebook.
- [ ] Add a text-based travel map or route summary.
- [ ] Show eliminated and still-possible destinations clearly.
- [ ] Improve warrant paperwork and suspect comparison.
- [ ] Add arrival, arrest, escape, promotion, and deadline scenes.
- [ ] Add accessibility-friendly display settings.
- [ ] Add an in-game help and rules screen.

### P3 — Future interfaces

- [ ] Separate engine logic from terminal input/output completely.
- [ ] Define a stable game-state and content API.
- [ ] Create a graphical prototype only after the content and difficulty loops
  are strong in the terminal version.
- [ ] Consider map, desktop, web, and mobile interfaces after engine stability.

## Verification checklist

Run these checks after changing gameplay data or engine logic:

```bash
python3 scripts/build_gameplay_data.py
python3 scripts/build_state_clue_atoms.py
python3 scripts/build_location_investigations.py
python3 -m unittest discover -s tests -v
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
