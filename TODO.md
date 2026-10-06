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
- [x] 37 automated tests passing

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

- [x] Eight dossier fields: sex, height, skin tone, hair, hobby, vehicle,
  accessory, and distinguishing feature
- [x] Unique profile for every thief
- [x] Profile evidence gathered during ordinary witness interviews
- [x] Physical descriptors are embedded naturally in both English and Nigerian
  Pidgin witness accounts
- [x] Completed profile resolves to one thief
- [x] All eight fields are required before a warrant can be issued
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

- [ ] Add a clearer case dossier at the beginning of each mission.
- [ ] Add a structured detective notebook.
- [ ] Add a text-based travel map or route summary.
- [ ] Show eliminated and still-possible destinations clearly.
- [ ] Improve warrant paperwork and suspect comparison.
- [ ] Add arrival, arrest, escape, promotion, and deadline scenes.
- [ ] Add accessibility-friendly display settings.
- [ ] Add an in-game help and rules screen.

### P3 - Production readiness

- [ ] Use a relational database like mysql instead of csv files
- [ ] Make sure DB is normalized
- [ ] Build the engine in Rust
- [ ] Start the web based UI project, create image artifacts, animations, 3D (of course), for instance when flying an airplane flying over a believable terrain animation or driving through the suburbs animation or obtaining the warrant animation, each thief should have a 3D representation that represents them.
- [ ] User should be able to build a profile for themselves too, select avatar, uniform, sex, car brands (room for advertisement), preferred flight operator (room for advertisement) etc
- [ ] User should have an achievements page to see all the criminals they've caught, we need to build some other achievements into the game like flying achievements, driving achievements, number of states visited achievements, leaderboards etc
- [ ] User will select a location at the state of the game as home base, when they are in home base, witness questioning costs no time. 
- [ ] User can ask another user for help...e.g if User A flew to Kano and another User B sets Kano as home base....if User B is online, they can ask User B for help. User B then questions witnesses on their behalf and send a recommendation to them (remember User B witness questioning costs nothing because of home base). The only caveat is User B must be at home...if User B is on a mission in Abia for instance, even though their home base is Kano, they can not render help to user A...they can get alert to fly to home and help user A, in which case they pay the time cost of flying to home and flying back to continue their mission. 
- [ ] WHen user render help, they earn points, these points can be used on the app (I don't know what they can use it for yet...help!!!)
- [ ] User can bribe witness to give them better clues. They can pay real cash (monetization) to buy some type of in game cash they can use to bribe witness...when a witness is bribed, he gives more accurate information...sometimes a witness can collect the cash and still not give better information. 
- [ ] User can spend in game cash (or points...not sure yet) to speed up travel times, buy better cars, fly better airlines (e.g fly private jet).
- [ ] User can bribe judges to get a warrant even if the profile is not fully completed. Sometimes the judges collect the bribe and give the warrant, sometimes the user gets thrown in jail for X number of time, they can pay in game cash to get out of jail immediately or stay in jail for the X number of time.
- [ ] The lower the number of profile points completed, the more bribe is needed to get a warrant....
- [ ] we don't automatically give the user the name of a thief, no after building the profile, we provide 3 thiefs and their characteristics and the user must using the built profile to select one of the 3...of course one of the three thieves provided must be correct
- [ ] User must manually build the dosier too from the witness clues, we don't automatically build it for them....if a witness says something like "brown eyes" they must open their dosier and add brown eyes under say for excample eye color or "likes to whistle" under say feature.

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
python3 scripts/editorial_review_clues.py
python3 scripts/build_location_coordinates.py
python3 scripts/build_location_investigations.py
python3 scripts/build_mission_narratives.py
python3 scripts/simulate_game_balance.py
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
