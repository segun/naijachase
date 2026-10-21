# Scene conventions: adaptive animation and functional fallbacks

Read this before you add or change any animated scene in the web client (`web/src/scenes/`).

The Automatic/Full/Standard/Simple control shows the selected button without a resolved-level or device-capability hint. Settings retains the option descriptions.

## Mobile presentation

At widths up to 960 px in portrait, office, garage, witness, journey and raid
canvases use a bounded landscape-shaped viewing area. Witness/raid captions sit
below the picture, with independent scrolling for long text. This is a layout
change; timeline and renderer selection remain unchanged. See `mobile-case-ux.md`.
Witness completion now opens the full saved account instead of automatically
leaving the scene. Read full clue opens it early; Continue performs the guarded
handoff once. Opening the account cancels renderer setup and disposes the scene.
Keep this explicit reading step for both animated and flat presentations.

## The rule

**Current policy (supersedes the legacy two-renderer guidance below):** login keeps its 2D chase. Non-login scenes should skip
animation at Simple detail and show their functional content instead. Apply this one scene at a time during its next integration pass;
do not remove all existing 2D renderers in one sweep. Preserve essential dialogue, clues, choices, server timing and outcomes.
The office has adopted this policy: Simple opens its desk immediately, without entry/return/exploration/exit animation or an alert.
Switching to Simple during its intro or exploration opens the desk; increasing detail afterwards must not replay or re-gate that entry.
Witness has also adopted this policy: Simple shows the full server account and an explicit Continue action, without a canvas or animation.
3D failure opens that same account with an alert and error details; `nc-witness-flat` remembers the failure independently of journey.
Full/Standard use the shared pure timeline and preserve elapsed time on rebuilds; cancelled setup must not publish late callbacks.
Journey has adopted this policy: ordinary Simple journeys hand off to the desk once; weekly Simple journeys retain server progress and Back.
3D failure shows journey status with an alert and Continue/Back (`nc-journey-flat`). Neither skipping nor returning changes server travel timing.
Panel, archive and garage behaviour is unchanged. The following two-renderer instructions document legacy implementations
until each is updated; they do not require adding witness, office or journey 2D animation back.

A scene is never skipped because the device is weak, and it never leaves a black screen. Every animated scene
has **two renderers that show the same thing**:

1. **3D** (Babylon.js, `chase3d-*.ts`), lazily imported. It is the default on devices that look capable.
2. **2D** (Canvas 2D, `*-2d.ts`), lazily imported. It needs no WebGL and almost no download. It is used when
   the device looks weak (reduced motion, Save-Data, a slow network, low memory, no WebGL) and as the
   fallback when 3D fails.

If 3D fails to start, throws while drawing, loses its WebGL context, stops producing frames or runs too
slowly, the scene **carries on in 2D from the moment it had reached**, and remembers that for the rest of the
session (`sessionStorage` key `nc-witness-2d`) so the next scene does not fail the same way. Only if 2D also fails is
anything shown, and then it is the reason, with a button to continue, never a silent jump. A player can force
2D with `localStorage["nc-scene"] = "2d"`, which is also how you test it.

The renderers are renderers, not separate games: they consume the same events, reveal the same clues, charge the
same time and produce the same outcome. `docs/web-vertical-slice.md` and `TODO.md` (P3.10) describe the wider plan.

## How to build a scene so both renderers stay in step

The witness scene in `web/src/scenes/witness/` remains the reference for pure choreography and renderer separation.
Its Canvas 2D files are now legacy utilities retained for the old journey 2D source, not an active Simple renderer:

| File | Holds | Imports a graphics library? |
| --- | --- | --- |
| `witness-scene.ts` | The rules: the timeline, poses, camera path, subtitles. Pure and unit-tested. | No |
| `market-layout.ts`, `venue-recipes.ts` | Where things are, what a venue looks and sounds like. Data. | No |
| `witness-driver.ts` | The options and handle both renderers share, sound, subtitles, per-frame bookkeeping. | No |
| `chase3d-witness.ts` | The 3D picture for time `t`. | Babylon.js |
| `witness-2d.ts` | The 2D picture for the same `t`, using the same camera path (billboards under a real perspective projection). | No (Canvas 2D) |
| `WitnessScene.svelte` | Chooses 3D or readable account, owns subtitles, Skip and guarded Continue. | No |

Rules:

- Put every decision (what happens when, where people stand, what is said) in the pure module and test it. A renderer
  only draws frame `t`; it never decides anything.
- Both renderers take the same options and return the same handle (`WitnessOptions`, `WitnessHandle`). The handle can
  start from a given time so 2D can take over mid-scene.
- Essential text (dialogue, clues, subtitles) is real DOM text, never only pixels, so both renderers and screen readers
  get it.
- Wrap each renderer's per-frame work so an error is reported once through `onFault` and the caller switches renderer.
  Sound is optional: an audio error must never stop the picture.
- Never import Babylon.js from the main bundle, the driver, the layout or the 2D file. Keep `chase3d-*` behind a dynamic
  `import()`.
- Test both renderers: add the new venue or scene to the pure tests, then look at it in 3D and in 2D
  (`localStorage["nc-scene"] = "2d"`).
- PixiJS was the original idea for the 2D renderer. Plain Canvas 2D was used because Pixi needs WebGL, which is exactly what
  the weak devices lack. A Pixi renderer can still be added behind the same handle if 2D ever needs it.

## Adding a venue to the witness scenes

A venue is a recipe plus a 3D scenery set; the choreography is shared and does not change. Simple needs no scenery set.

- Recipe: `recipes-open-air.ts` or `recipes-buildings.ts` (the market's is in `venue-recipes.ts`), built with `recipe-kit.ts`.
- 3D set: register in `chase3d-open-air.ts` / `chase3d-buildings.ts` (via `chase3d-sets.ts`) under the recipe's `set` id.
  Add role/crowd mappings in `witness-models.ts`; use the shared loader and retain procedural objects when their models fail.
- `web/tests/witness-sets.test.mjs` checks every recipe automatically (real venue, legacy sets registered, witnesses, quiet sound).
  `web/tests/witness-models.test.mjs` checks supplied assets, dimensions, skins/Walk clips, model groups and exact corridor clearance.
- All 35 venues are implemented. The old parallel-agent ownership documents are not present in this checkout.
- Flags: do not draw anything that reads as a real national flag (green and white are never the two colours of a flag; a test enforces it).
- Signs carrying the venue's name are sized for the arrival shot. In the conversation shot the camera looks at the witness, so a sign can
  be cut off by the frame; that is expected and not worth bending the layout for (checked: moving the camera does not help either).
- The witness scene is the whole round trip: arrival, conversation and the walk back to the vehicle. Keep the corridor from the
  witness to the vehicle clear in a set (the player walks it twice), and do not draw anything on the lane near the stopping point.
  The office part of the return is separate (`room-scene.ts`, `T_RETURN_FROM`).

## The travelling scene

`web/src/scenes/journey/` plays between a travel command being accepted and the desk (`app.startJourney` in `Travel.svelte`,
`app.leaveJourney` at the end). It follows the same split as the witness scene:

| File | Holds |
| --- | --- |
| `journey-scene.ts` | The rules, pure and unit-tested (`tests/journey.test.mjs`): the landscapes, the random route, the timeline of a drive, a hitch ride and a flight, and `frameAt(plan, t)`, which says where the camera, vehicle, player and cabin crew are at second `t`. |
| `journey-driver.ts` | The options and handle both renderers share. |
| `chase3d-journey.ts` | Draws the pure timeline; Full drive/hitch journeys use supplied people, vehicles and scenery models, Standard stays procedural. Flight scenery remains procedural. |
| `journey-2d.ts` | Legacy, no longer imported by the runtime. |
| `JourneyScene.svelte` | Picks 3D or functional status/handoff, handles failure, keeps journey narration out of the UI, and owns status notes, Skip/Back and the guarded hand-over to the desk. |

- **Landscapes** are data (`LANDSCAPES`): colours, a strip of water, and weighted props. Add one by adding an entry; use only prop kinds that
  both renderers draw (`PropKind`). Props are generated once, with a seed, so a 3D to 2D hand-over shows the same route. Where one landscape ends the
  next begins: props of both grow and shrink across `plan.blend` metres and the sky, ground, road and hills mix their colours.
- **Set pieces** (garage, bus park, billboard, terminals) clear random props around them and are never blended out.
- Planes fly in one continuous world: the first airport, the boarding apron, the runway and the second airport are far apart, and a dip to black (`plan.cuts`) joins the
  jumps. The camera must not jump anywhere else (a test checks it).
- **Route view (weekly play)**: weekly attempts run on real time, so `WeeklyPlay.svelte` offers a "Show travel route" button during a journey that opens `JourneyScene` with
  `loop`. The plan (`planJourney({ loop: true })`) is endless and periodic: 8 landscapes in a ring for driving and hitching (no garage, bus park or billboard), and for
  flying a plane in cruise among 150 random clouds. Props are stored once per lap and drawn at the copy nearest the camera (`propX`), so there is no jump at the seam.
  Esc (or Back) calls `onclose` instead of skipping; it never affects the real wait. Reduced motion shows one still frame.
- The flight's two airports are named from the case: `"<from> Airport"` and `"Welcome to <to> Airport"`. Avoid a green and white livery (it reads as a flag).

## Disciplinary panel on phones

The courtroom keeps its camera positions inside the room in both orientations.
`panelFov` preserves the horizontal view by widening the vertical field of view
on portrait screens. Do not apply the shared camera-backoff helper here: it moves
the bench shot through the front wall and the verdict shot into the judges.
The verdict card uses symmetric insets and auto margins for centring because
the shared `rise` animation owns `transform`. Its height is bounded by the screen
and safe areas, and long verdicts scroll to keep Accept reachable in landscape.
Verified the actual Svelte panel in Chromium at 320×568, 393×852, 852×393,
932×430 and 1280×720: the verdict stayed inside the viewport with no horizontal
overflow, and Accept remained clickable after the entrance animation and rotation.
These are browser viewport checks; physical iPhone/PWA confirmation is still needed.

## The raid scene

`web/src/scenes/chase/` also plays the end-game raid after the player picks a hideout on the warrant screen (`app.raid` then `app.playRaid`,
`app.leaveRaid` at the end). It reuses the login chase world:

| File | Holds |
| --- | --- |
| `raid-scene.ts` | Pure and unit-tested (`tests/raid.test.mjs`): `raidFrame(s, ending, start)` for the 7.5 s escape (the thief pulls away, officers fall back) and the 8.5 s catch (officers surround him, he stops and raises his hands), and the captions (`raidLines`) naming the warrant suspect. |
| `RaidScene.svelte` | 3D through `createChaseScene({ frame })`, the 2D chase (`drawChase(..., timeline)`) at Simple detail or after a 3D failure, from the same second. Reduced motion shows the captions with Continue. Skip/Esc ends early. |

An empty hideout plays the escape and returns to the warrant list, where that hideout is now disabled. The real hideout plays the catch
when the case is solved; a wrong warrant or the deadline plays the escape with a closing caption, then the results screen.

Achievement share prompts must stay queued throughout raid preparation and the
scene, including when progression returns before `playRaid`. Only present them
after the results component has mounted and painted. `results-presentation.svelte.ts`
owns this gate and cancels pending readiness when Results unmounts. An empty
hideout stays disabled at the bottom of the returned list, below unsearched choices.

## Looks: cheap upgrades, no artist

The procedural 3D fallback is built in code. What keeps it from looking like building blocks:

- `shared/chase3d-shapes.ts`: `loft` sweeps rounded cross-sections along a length (car and bus bodies, with a paint colour per face),
  `roundedBox` softens a box, `tyre` is a lathe, `contactShadow` is a soft blob under things that stand on the ground.
- `shared/chase3d-cars.ts` builds the runabout, minibus and saloon from those. Keep their wheel positions, the driver's seat and the
  bus's rear-door pivot where they are: the witness timeline and the garage depend on them.
- The witness scene grades the picture (tone mapping, contrast, vignette), paints a sun glow and cloud puffs, and softens chunky
  untextured boxes (`softBox` in `chase3d-witness.ts`; thin and textured boxes stay sharp, and light quality keeps plain boxes).
  A rounded box built with `plain` has the same vertex data as a Babylon box, so it can still be merged with boxes.
- A prop can set `soft` (a radius in metres): 3D rounds the box and 2D chamfers the corners of the face it shows. The parked minibuses use it.
- The 2D renderer matches: curved bodies with a light-to-dark gradient, wheel arches, a ground shadow, a sun glow and a vignette.
- Register the shaders a scene needs before rendering: a fresh Vite cache can otherwise make Babylon fetch shader source as a missing
  URL and receive HTML. Shared stages register their procedural shaders; the model loader registers PBR shaders.

## Generated 3D models

Scenes may use GLB models from `web/public/assets/3d/` (see [3d-models.md](./3d-models.md)). The rule above still holds: if a model fails to load the scene keeps the shapes it builds in code, and the 2D renderer is unchanged.

Full-detail model work has three priorities. The selected player, active witness and active vehicle are `critical`; a scene may await
those before starting. Nearby scenery is `nearby`, while crowds, furniture and other dressing are `decorative` and start during browser
idle time after the procedural scene has produced a usable first frame. The shared loader runs no more than four fetch/decode jobs at
once and reserves background capacity so decorative work cannot crowd out critical models.

Preloading is deliberately narrow. After the API accepts a venue visit, journey or raid command, application state may preload at most
four explicitly named critical models for that next scene. It must not inspect or preload the complete model catalogue. New scenes must
use the shared priority loader and preserve their procedural fallback until each replacement is fitted successfully.

The shared loader owns a bounded application-level cache: immutable GLB bytes are reused across scene transitions, while parsed
Babylon containers are reused by every instance within their owning scene. Both caches are LRU-bounded; a browser `memorypressure`
event trims them aggressively. A scene must bind its `AbortSignal` through `createStage` or `bindModelLoadSignal`. Replacing that scene,
switching away from Full detail, or hitting the twelve-second limit then aborts queued jobs and the underlying `fetch`, releases its
containers, and prevents a late decode from attaching to a disposed scene. Keep model handles disposable: the cache will not destroy a
shared container until its live instances have been released.

The login chase uses `chase-frame.ts` for both its model/procedural 3D and Canvas 2D renderers. Detail changes and 3D faults use the
same clock, keeping the city progression, camera and runners in step. Do not independently play a model's Run clip or allow exported
hip translation to move a runner away from its timeline position. Its desktop-only login side panel is intentionally hidden below
961 px; do not download scene assets for that hidden panel.

The case office uses the selected avatar and nine separate furniture models at Full detail; Standard keeps the procedural room and
downloads no GLBs. The generated room shell is not used because furniture is baked into it. Character clips and keyboard reach must
be sampled from the scene's `Pose` and time, never `performance.now()`, so rebuilding at another detail level preserves the pose.
Witness Continue opens the case desk immediately at every detail level, without an office intro, zoom or second Continue button.
The office consumes a one-entry flag; rebuilding its renderer or changing detail must not restore the exploration pause.
Other office entries pause seated before the zoom: drag/swipe or arrow keys orbit the camera, and
**Continue to case desk** resumes from that view. Keep the exploration hint/button in DOM, leave the terminal inert while paused, and
do not mistake the intentional pause for a stalled renderer. At Simple the office bypasses the pause and opens the desk directly.

**Existing exception to the two-renderer rule:** generic room stages (including the office) currently show their flat DOM content at
Simple detail or on 3D failure, rather than an animated Canvas 2D room. The office intentionally has no 2D animation under the new
policy; its former 2D implementation task has been removed.
