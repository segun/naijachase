# Agent1: witness scenes for open-air, transport, water and work venues

Your half is everything outside or on the move: markets and festivals, transport hubs, the water's edge, and farms, mines and industry. These are mostly open scenes with vehicles, crowds, water and big shapes, so they lean on sound (whistles, surf, engines, drums) and on a strong silhouette in the arrival shot.

**You are Agent1. Another agent (Agent2) is doing the other half of the venues at the same time in the same repository.** The market is
already done and is your reference. All paths below are under `web/src/scenes/witness/` unless they start with `web/`.

## Your venues (16)

### Markets and festivals: suggested set id `market_variants`

Start from the market set (`chase3d-market.ts`, `witness-2d-market.ts`): it can be reused with a `variant` (different wares, animals, looms, a stage) instead of being copied.

| Venue id | Name | Witness roles | Opens-closes | Scene placements | What it should feel like (from the data) |
| --- | --- | --- | --- | --- | --- |
| `cattle_market` | Cattle market | cattle trader, herder, veterinary worker, loader | 5:00-17:00 | 9 | Herders negotiate over restless animals amid dust, ropes and feed sacks. Night: The pens are quiet except for watchmen and the occasional animal call. |
| `craft_market` | Craft market | weaver, dyer, carver, bronze caster, leather seller | 7:00-18:00 | 46 | Dyers, carvers and weavers work beside displays arranged by material. Night: Most workshops are shuttered, leaving only a few artisans finishing orders. |
| `festival_ground` | Festival ground | drummer, dancer, food vendor, festival organiser | 7:00-21:00 | 38 | Vendors mark out spaces while drummers test rhythms near the stage. Night: Security lights reveal empty stands and decorations moving in the breeze. |

### Transport hubs: suggested set id `transport_hub`

Buses and conductors, a platform and a train, a terminal frontage with trolleys. The lane in front is already the road.

| Venue id | Name | Witness roles | Opens-closes | Scene placements | What it should feel like (from the data) |
| --- | --- | --- | --- | --- | --- |
| `motor_park` | Motor park | agbero, driver, conductor, ticket seller, mechanic, passenger | 5:00-23:00 | 465 | Conductors shout destinations as buses load beneath patched awnings. Night: Headlamps, generators and late departures keep the park restless. |
| `railway_station` | Railway station | ticket seller, railway worker, passenger, security guard | 5:00-22:00 | 7 | Passengers study the board while vendors and porters work the platform. Night: The platform echoes between late services under bright security lights. |
| `airport` | Airport | check-in agent, baggage handler, pilot, traveller, security officer | 4:00-24:00 | 41 | Announcements compete with trolley wheels, greetings and security checks. Night: Red-eye passengers doze beneath bright lights near the check-in desks. |

### Water's edge: suggested set id `water_edge`

Water behind the lane (a painted plane or a dark band), boats, nets, cranes and containers. Surf, gulls and ship horns are sound extras.

| Venue id | Name | Witness roles | Opens-closes | Scene placements | What it should feel like (from the data) |
| --- | --- | --- | --- | --- | --- |
| `beach` | Beach | lifeguard, fish seller, boat operator, food vendor | 6:00-20:00 | 4 | Fishing boats, food stands and wind off the water animate the shoreline. Night: The dark water is watched by security staff as vendors pack away their tables. |
| `fishing_jetty` | Fishing jetty | fisherman, boat operator, fish seller, ticket seller | 5:00-20:00 | 4 | Boats knock against the landing while fish sellers sort the morning catch. Night: A few lamps reveal crews preparing nets for a pre-dawn departure. |
| `jetty` | Passenger jetty | boat operator, ticket seller, passenger, fish seller | 5:00-20:00 | 1 | Passengers balance bags as boat operators call routes from the landing. Night: A few late boats idle beneath lamps while the ticket table is packed away. |
| `waterfront` | Waterfront | boatman, fish seller, dockworker, food vendor | 5:00-21:00 | 19 | Boats, fish sellers and waterside traffic crowd the muddy landing. Night: Reflections from a few lamps shake across the dark water. |
| `seaport` | Seaport | dockworker, clearing agent, customs officer, sailor | 0:00-24:00 | 7 | Cranes move above stacked cargo as customs agents and drivers trade paperwork. Night: Floodlights and ship horns keep the port active through the night. |

### Work and the land: suggested set id `work_and_land`

Fields and sheds, a pit and a conveyor, tanks and a flare stack, a gatehouse with a boom, a ranger office with maps and a jeep.

| Venue id | Name | Witness roles | Opens-closes | Scene placements | What it should feel like (from the data) |
| --- | --- | --- | --- | --- | --- |
| `farm` | Farm | farmer, produce buyer, farmhand, extension worker | 5:00-18:00 | 415 | Workers move between rows, sheds and produce laid out for sorting. Night: The fields are dark and only the farmhouse and animal pens show light. |
| `mining_site` | Mining site | miner, quarry worker, mineral trader, site engineer | 6:00-18:00 | 4 | Dusty vehicles pass a checkpoint near heaps of rock and safety notices. Night: Machinery is mostly silent while the night watch patrols the fenced workings. |
| `refinery` | Refinery | engineer, security man, tanker driver, shift worker | 0:00-24:00 | 3 | Pipes, warning signs and the distant hum of processing surround the gatehouse. Night: Orange safety lights mark a continuous shift behind the security fence. |
| `factory_gate` | Factory gate | factory worker, security man, artisan, tanker driver | 6:00-18:00 | 5 | Shift workers pass the gatehouse as trucks queue for inspection. Night: Floodlights wash over the loading yard during a quieter night shift. |
| `conservation_office` | Conservation office | park ranger, wildlife officer, researcher, tour guide | 8:00-17:00 | 18 | Maps, field boots and wildlife posters crowd the practical office. Night: Only the duty ranger remains, monitoring calls from distant patrol posts. |


## 0. Read these first (in this order)

1. `AGENTS.md` and `docs/scene-conventions.md`: every animated scene is **3D with a 2D fallback**, built from one shared pure timeline.
2. `docs/web-vertical-slice.md`, the "Witness scene" paragraph, and `docs/fictional-brands-policy.md` (no real brands anywhere).
3. The reference implementation, the market, in `web/src/scenes/witness/`:
   `witness-scene.ts` (the rules), `market-layout.ts` (data), `chase3d-market.ts` (3D set), `witness-2d-market.ts` (2D set),
   `venue-recipes.ts` (the market's recipe) and `recipe-kit.ts` (types and helpers for recipes).

## 1. The job

Give each of your venues a witness scene that looks and sounds like the place, in **both** 3D and 2D, the way the market does.
The scene is the same for every venue: a vehicle (the player's open-top car for Drive, a minibus for Hitchhike) pulls up on the lane,
the player walks to the witness, the witness talks and the words appear as subtitles. **Do not change that choreography.** You only add
what stands behind and beside it: scenery, props, a crowd, lights, a sound mix and a handful of witnesses. A venue is data (a recipe)
plus a scenery set per renderer. Several venues may share one set and differ by `variant`.

For each venue you must deliver:

1. A **recipe** in your recipes file (id, set, optional variant, sound mix, at least four fictional witnesses).
2. A **3D set** registered in your 3D file, and a **2D set** registered in your 2D file, under the same set id.
3. Tests (your own test file) and a note in the progress log at the bottom of this file.

## 2. Files: what you own and what you must not touch

You work in parallel with another agent, so the shared extension points were prepared for you. Edit only the files below.

| You own (edit freely) | Notes |
| --- | --- |
| ``recipes-open-air.ts`` | your recipes, keyed by venue id |
| ``chase3d-open-air.ts`` | registry of your 3D sets (`export const OPEN_AIR_SETS_3D`) |
| ``witness-2d-open-air.ts`` | registry of your 2D sets |
| New files whose names start `chase3d-open-air-`, `witness-2d-open-air-` or `layout-open-air-` | your set code, props and layout data; import them from your registry |
| `web/tests/witness-open-air.test.mjs` | your tests |
| the progress log at the bottom of **this** file | |

**Do not edit** (the other agent and the coordinator depend on them; ask for a change instead, see section 8):
`witness-scene.ts`, `witness-driver.ts`, `witness-audio.ts`, `witness-2d.ts`, `witness-2d-kit.ts`, `witness-2d-sets.ts`, `chase3d-witness.ts`,
`chase3d-sets.ts`, `chase3d-people.ts`, `chase3d-market.ts`, `witness-2d-market.ts`, `market-layout.ts`, `venue-recipes.ts`, `recipe-kit.ts`,
`WitnessScene.svelte`, `web/src/scenes/shared/*`, `web/src/state/*`, `web/tests/witness.test.mjs`, `web/tests/witness-sets.test.mjs`,
any `docs/` file other than this one, `TODO.md`, `README.md`, `AGENTS.md`, and the other agent's files (``*-buildings-*`, `recipes-buildings.ts`, `chase3d-buildings.ts`, `witness-2d-buildings.ts``).
Never edit `data/exports/witness-location-scenes.json`; it is generated (`make export-witness-scenes`).

## 3. How a scene is put together (cheat sheet)

Axes: metres, x to the right, y up, z away from the camera. Heading 0 faces the camera.

| Thing | Where | Why it matters to you |
| --- | --- | --- |
| The lane (road) | z from -4.7 to -1.3, along x, centre z = -3 | The vehicle drives along it from x = +11 to -2.6 (car) or stops at the minibus position, then leaves to x = -13. Keep it clear. |
| The witness | (1.15, 2.55), facing the camera, turns slightly towards the player | The picture is about her. Her backdrop must be plain enough for her face and arms to read. |
| Where the player stops | (0.35, 1.05) | Leave 1.5 m around the walk from the lane to here. |
| Arrival camera | about (0.4, 1.8, -11.5) to (-0.4, 1.75, -10.6), looking at z = 0.5 | It sees the whole front of your set, over the lane. Your set's name or sign belongs high in this shot. |
| Talk camera | from (3.3, 1.55, -1.3) to (3.0, 1.55, -0.9), looking at (0.8, 1.35, 1.95) | **Keep-out box: x 1.5 to 6, z -3 to 0.5.** Anything there blocks the shot (a pole and a handcart did, in the market). Also keep the line between the camera and the witness clear: x 0 to 3, z 0 to 2.3, below 2 m. |
| Ground | a red-earth box and the lane | A set can recolour or retexture the ground (`ground`, `lane` in 2D; the stage helpers in 3D). |
| Time of day | `stage.palette` (3D), `palette` (2D): `.lamp` is 0 by day to 1 at night, `.stars`, `.sun*` | The hour follows the case clock. Add lights and glow when `palette.lamp > 0.3`. Test hours 8, 11, 18 and 21. |
| Crowd size | `options.quality === "light"` | Use at most 8 people on high and 4 on light, and fewer meshes on light. |
| Venue name | `options.venueName` (a fictional local name such as "Aba Community Market") | Paint it on a sign, in both renderers. |
| Variant | `options.recipe.variant` | Lets one set draw church or mosque, jetty or beach. |

Helpers you can use (read them, do not edit them): 3D: `createStage` helpers on `stage` (`mat`, `box`, `cyl`, `sphere`, `plane`, `textured`,
`caster`), `merge`, `seeded` and `hex` in `scenes/shared/chase3d-kit.ts`, `person` and `printed` in `chase3d-people.ts`, the cars in
`scenes/shared/chase3d-cars.ts`. 2D: everything exported by `witness-2d-kit.ts` (`project`, `polygon`, `box`, `disc`, `stroke`, `figure`,
`crowdFigure`, `wheel`, `mixHex`) and `lookOf`/`walkerAt`/`PRINTS` in `market-layout.ts`.

A set must be a **pure function of the time `t`**: the same `t` always gives the same picture. That lets 2D take over from 3D mid-scene, lets
a scene start at the conversation under reduced motion, and keeps previews and tests exact. Never use `Math.random` or `Date.now` inside a
set; use `seeded(hashOf(...))` for scenery and `t` for movement.

Sound is data. Use the four base layers (`crowd`, `calls`, `hum`, `clinks`, each 0 to 1) and `extras` (`tone`, `swell`, `pulse`, `chirps`;
documented in `recipe-kit.ts`): a train or ship whistle is a `tone` with `slide` and `vibrato`, a church bell a low `tone`, surf and wind a
`swell`, festival drums a `pulse`, birds `chirps`. Keep every extra at level 0.3 or less; the witness's voice must stay clear.

## 4. Lessons from the market (do not repeat these mistakes)

- **A black screen is the worst outcome.** An exception inside a frame stops the picture while the sound carries on. The bug we hit was a
  negative number from a hash used as a random seed and then as an array index, so it only broke for some witness texts. Always use
  `Math.abs`/`>>> 0` on hashes, never index an array with an unchecked modulo of a signed number, and never let a set throw. Test with many
  different texts and with the real avatar presets (`web/dev/mock-api.mjs` has all ten).
- **Never skip a scene for a weak device and never leave a black screen.** The 3D to 2D fallback is automatic; you only have to make both
  renderers exist. Do not add `decideScene` checks, frame-rate gates or "if it fails, return" branches of your own.
- **Both renderers or neither.** A set id used by a recipe must be registered in 3D and in 2D; `web/tests/witness-sets.test.mjs` fails otherwise.
  The 2D picture can be simpler, but it must show the same venue, the same people and the same events.
- **Camera first.** Draw your set, then look at the frames at `t` = 1.6 (the vehicle arriving), 3.1 (stepping out), 4.3 (walking) and 8
  (the conversation), for both Drive and Hitchhike. If a pole, a sign or a prop is between the camera and the witness, move it.
- **Keep it cheap.** Merge static meshes (`merge`), reuse materials (`stage.mat` caches by colour), no allocation per frame, no more than a few
  hundred meshes. The 3D scene runs on phones; the 2D scene must also hold 30 fps on a weak laptop.
- **Keep the first download small.** Sets, recipes' scenery and renderers are lazy chunks. Never import a renderer, a set or Babylon.js from
  `web/src/state`, `web/src/ui` or any screen. Babylon.js may only be imported by files named `chase3d-*.ts`. After your changes
  `cd web && npx vite build && node dev/check-budget.mjs` must still show initial JS under 60 KiB gzip.
- **The browser tab can be hidden.** Rendering and animation pause in a background tab, so an automated browser can show a frozen or black
  page. Check `document.hidden` first. For exact frames, use a throwaway preview page that calls the renderer's `seek(t)` and reads pixels in
  the same task (draw the canvas into a small 2D canvas and sample it); do not rely on screenshots of an unseen tab. Delete the preview page
  before you finish; never commit it.
- **The 3D box top maps u across its depth and v along its width**, so a lane texture needs its dashes along v. Check textures on large boxes.
- **Do not put the market's vocabulary everywhere.** Stalls, wares and crowds are the market's. A railway station needs platforms, a train and
  a bell; a church needs a bell and steps; do not just recolour stalls.
- **Cultural care.** These are fictional places in real Nigerian settings. Draw them with respect and without caricature: no real brands, no
  real people, no religious figures or symbols used as decoration, modest clothing on witnesses, a mix of ages and builds. Witness names and
  venue names are fictional (`docs/fictional-brands-policy.md`). If unsure about a depiction (a shrine, a palace, a mosque or church
  interior), keep it simple and exterior only, and note the doubt in the progress log.
- **Do not touch live data or servers.** A real API may be running on port 8080 with the owner's data. Use `node web/dev/mock-api.mjs`
  (port 8081) with `API_TARGET=http://127.0.0.1:8081`, start your own dev server on a free port, stop only the processes you started (use
  `kill <pid>`; name-based killing is not allowed here), and do not open or change `.env`, `save/` or the database.
- **Do not skip the tests.** The suite runs in about a second and catches most mistakes (wrong id, missing set, quiet-sound limits).

## 5. Suggested order of work

1. Read the market set and copy its structure for your first set; get one venue working end to end (recipe, 3D, 2D, test).
2. Add the other venues of that set as `variant`s where they share most of the scenery, and write new sets where they do not.
3. Do the family with the most placements first (the "Scene placements" column is how often players will see it).
4. After every set run the checks in section 6 and write one line in the progress log.

## 6. Checks before you say a venue is done

Run from `web/`:

```
npx svelte-check --tsconfig ./tsconfig.json
node --test tests/*.test.mjs
npx vite build && node dev/check-budget.mjs
```

Then, for each venue, in **3D and in 2D** (force 2D with `localStorage["nc-scene"] = "2d"`), with **Drive and Hitchhike**, at **hours 8, 11 and 21**,
and with quality **high and light** (emulate light with `navigator.hardwareConcurrency = 2`):

- [ ] the picture appears and never goes black; the console has no errors or "switching to 2D" warnings
- [ ] the vehicle arrives on the lane, the player walks to the witness, the witness talks, the subtitles run, the scene ends by itself
- [ ] nothing blocks the camera's view of the witness (keep-out box, section 3)
- [ ] the venue is recognisable at a glance in the arrival shot, and the sound fits it and is quieter than the witness's voice
- [ ] the venue name or a sign appears and reads correctly
- [ ] 3D and 2D show the same venue; both are a pure function of `t` (use `seek(t)` twice with the same `t` and compare pixels)
- [ ] your tests pass, `witness-sets.test.mjs` passes, the initial JS budget holds

## 7. How the pieces connect (so you can debug)

`WitnessScene.svelte` (shared) picks 3D or 2D, loads the recipe with `recipeFor(venueId)`, and starts the renderer. `chase3d-witness.ts` and
`witness-2d.ts` build the common parts (sky, ground, lane, vehicle, player, witness, camera) and call `setFor(recipe.set)` from their registry
to get your set. Your set returns `update(t)` (3D) or `items(c, t)`/`backdrop`/`ground`/`lane` (2D). `witness-driver.ts` adds the sound, the
subtitles and the per-frame bookkeeping and is shared by both renderers. The pure rules are in `witness-scene.ts`.

## 8. Asking for a change to a shared file

If you need something the shared files do not offer (a new sound kind, a drawing helper, a different witness position, a longer scene), do not
edit them and do not work around them with copies. Add a short entry under "Requests for the coordinator" below (what you need, which venue,
why, a suggested change) and carry on with the rest of your venues. Prefer adding a helper in a new file of your own first.

## 9. Do not

- change the choreography, the camera, the witness's position or the timing (`witness-scene.ts`);
- add a renderer, a graphics library or a dependency (`package.json`, `pnpm-lock.yaml`);
- skip, gate or short-circuit a scene by device, speed or connection;
- use randomness or the clock inside a set;
- import anything from the other agent's files;
- edit shared docs, `TODO.md` or generated data;
- leave preview pages, debug logging or `console.log` in the code;
- start, stop or modify servers or databases that you did not start.

## 10. Progress log (you fill this in)

| Venue | Recipe | 3D | 2D | Tests | Notes (what you could not verify, doubts about depiction) |
| --- | --- | --- | --- | --- | --- |
| `cattle_market` | done | `market_variants` / cattle | same | `witness-open-air.test.mjs` | Two pens with zebu cows (heads nod), feed shed as the plain backdrop, truck and ramp, sacks and hay. Cows are simple boxes, so breed detail is minimal. |
| `craft_market` | done | `market_variants` / craft | same | same | Stalls dressed by material (cloth, carvings, bronze, leather), looms, dye vats and dyed cloth swaying on a line, adobe wall behind the witness. No masks or ritual objects were drawn. |
| `festival_ground` | done | `market_variants` / festival | same | same | Stage with the name banner, speaker stacks, hand drums, bunting, food stalls with grills that glow after dark. Drum pulse is the only loud extra (0.26). |
| `motor_park` | done | `transport_hub` / motor_park | same | same | Rows of parked minibuses (yellow, white, green), patched awnings, ticket kiosk, destinations board, tyres and drums. Destinations are real cities, no operator names. |
| `railway_station` | done | `transport_hub` / railway_station | same | same | Station building with clock and name, platform with canopy, rails and sleepers, a train that rolls in over the first 8 s and stops, bell, departures board. Whistle and bell are `tone` extras. |
| `airport` | done | `transport_hub` / airport | same | same | Terminal wall and lit glass band, check-in canopy and desks, trolleys, luggage, control tower and a parked aeroplane (livery is plain stripes, no airline). The aeroplane is cut off on the right on a 16:9 arrival shot. |
| `beach` | done | `water_edge` / beach | same | same | Water band with foam lines moving, beached and floating canoes, lifeguard tower with a flag, umbrella stands, a drying net. Surf is a `swell`, gulls are `chirps`. |
| `fishing_jetty` | done | `water_edge` / fishing_jetty | same | same | Plank landing on pilings, moored boats bobbing, crates of fish, heaped nets, ticket hut, lamps with shaking reflections after dark. |
| `jetty` | done | `water_edge` / jetty | same | same | Pier, a covered passenger launch alongside, ticket table with umbrella, route board, luggage. |
| `waterfront` | done | `water_edge` / waterfront | same | same | Muddy bank, boats on the mud and afloat, fish baskets, food stall, warehouse with the name, lamp reflections. |
| `seaport` | done | `water_edge` / seaport | same | same | Ship at the quay, portal crane with a swaying container, container stacks, customs shed, lorry, floodlights. Horn is a low `tone`. The crane and ship fill the arrival shot, so the water is barely visible. |
| `farm` | done | `work_and_land` / farm | same | same | Crop rows either side of a bare strip, sorting shed with produce, water tank, farmhouse with a lit window, goat pen. |
| `mining_site` | done | `work_and_land` / mining_site | same | same | Gate arch with a barrier boom that lifts and drops, rock heaps, conveyor, digger, haul truck, safety signs, fence. |
| `refinery` | done | `work_and_land` / refinery | same | same | White tanks (the plain backdrop), pipe rack, flare stack with an orange flame and halo, tanker, warning signs, orange lamps. The flare is kept low so it fits the frame. |
| `factory_gate` | done | `work_and_land` / factory_gate | same | same | Plain factory wall with sawtooth roof and chimney, gate with boom, two queuing tankers, shift sign, floodlights. |
| `conservation_office` | done | `work_and_land` / conservation_office | same | same | Cream office with veranda, notice boards and posters, field jeep, radio mast, acacias, one lit window after dark. No national flag is drawn (a plain pennant instead). |

**Scenery variants (added after the first pass).** Each account's words seed the arrangement (`sceneSeed(text)` in `layout-open-air-kit.ts`, independent of the witness pick), so the same mission always shows the same place but different missions differ. Every layout builder takes `(variant, name, seed)`: it changes what is present (buses parked or not, a second line of bunting, stalls swapped between positions, the train rolling in or standing, an aeroplane or a fuel tanker, how many boats and cows), swaps colours, signs and set pieces from side to side, and `variate()` then reshuffles the accent colours and re-seeds the people. Tests run every venue through 24 seeds (arrangements differ, prop counts differ, nothing enters the clear areas). Dev-server note: pre-bundling Babylon in `vite dev` can serve broken shader chunks (black 3D, `'<' : syntax error` in the console); use `optimizeDeps: { exclude: ["@babylonjs/core"] }` and a private `cacheDir` in a throwaway config.

How the work is organised: a venue is a **layout** (pure data: solid props, signs, glows, people, lamps) in `layout-open-air-{market,transport,water,work}.ts`, built with the helpers in `layout-open-air-kit.ts`. One drawing function per renderer (`chase3d-open-air-kit.ts`, `witness-2d-open-air-kit.ts`) reads the same layout, so the two renderers show the same place piece for piece, and each set is one line in `chase3d-open-air.ts` / `witness-2d-open-air.ts`. Static solids are merged into one 3D mesh; only things that move (water, boats, flags, train, crane, boom) are separate meshes.

Checked in the browser (a throwaway preview page, now deleted): all 16 venues, 3D and 2D, Drive and Hitchhike, hours 8, 11 and 21, high and light quality, the ten real avatar presets as the player, ten different witness texts and venue names per venue (empty, very long and accented included). No faults, no console errors or "switching to 2D" warnings, and no black frame in about 2,500 2D and 400 3D frames. 3D `seek(t)` twice gives identical pixels. 2D differs by a few dozen pixels out of 230,000 between two renders of the same `t`, the same as the market does, so it is canvas anti-aliasing and not something a set does. 2D takes 0.5 to 3 ms per frame and 3D 2 to 3 ms of CPU on this machine. Initial JS is 58.3 KiB gzip.

**Not verified:** the sound. The mixes pass the quiet-extras test and every recipe builds its audio without throwing, but I could not listen to them. Check the whistle, horn, drums and surf for loudness against the witness's voice by ear.

**Known limits:** at 16:9 the arrival shot sees about x -11 to 12 at the venue's front, so signs and set pieces beyond that are only seen in the talk shot. A strolling passer-by crosses behind the witness now and then. The dev server shares `web/node_modules/.vite` with other dev servers, so two running at once break each other's chunks (404 on shader files); use `cacheDir` in a throwaway config.

## 11. Requests for the coordinator (you fill this in)

- `web/tests/witness.test.mjs`, "only venues with a recipe get a witness scene", asserts that `library` has no recipe. Agent2 has now given `library` one, so it fails (not because of this half). Suggest it checks an id that is not a venue, or that every venue has a recipe once both halves are done.
- `web/src/scenes/witness/itness-driver.ts` is an empty stray file (looks like a typo of `witness-driver.ts`); suggest deleting it.
