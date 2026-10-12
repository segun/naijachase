# Scene conventions: every animated scene is 3D with a 2D fallback

Read this before you add or change any animated scene in the web client (`web/src/scenes/`).

## The rule

A scene is never skipped because the device is weak, and it never leaves a black screen. Every scene
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

Follow the witness scene in `web/src/scenes/witness/`, which is the reference implementation:

| File | Holds | Imports a graphics library? |
| --- | --- | --- |
| `witness-scene.ts` | The rules: the timeline, poses, camera path, subtitles. Pure and unit-tested. | No |
| `market-layout.ts`, `venue-recipes.ts` | Where things are, what a venue looks and sounds like. Data. | No |
| `witness-driver.ts` | The options and handle both renderers share, sound, subtitles, per-frame bookkeeping. | No |
| `chase3d-witness.ts` | The 3D picture for time `t`. | Babylon.js |
| `witness-2d.ts` | The 2D picture for the same `t`, using the same camera path (billboards under a real perspective projection). | No (Canvas 2D) |
| `WitnessScene.svelte` | Chooses 3D or 2D, switches on failure, owns the subtitles and Skip. | No |

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

A venue is a recipe plus a scenery set per renderer; the choreography is shared and does not change.

- Recipe: `recipes-open-air.ts` or `recipes-buildings.ts` (the market's is in `venue-recipes.ts`), built with `recipe-kit.ts`.
- 3D set: register in `chase3d-open-air.ts` / `chase3d-buildings.ts` (via `chase3d-sets.ts`); 2D set: `witness-2d-open-air.ts` /
  `witness-2d-buildings.ts` (via `witness-2d-sets.ts`). Both under the recipe's `set` id.
- `web/tests/witness-sets.test.mjs` checks every recipe automatically (real venue, both sets registered, witnesses, quiet sound).
- The remaining 34 venues are split between two agents in `docs/agents/Agent1.md` and `docs/agents/Agent2.md`, which also list what to
  avoid, based on what went wrong with the market.
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
| `chase3d-journey.ts` / `journey-2d.ts` | Draw a frame. Same side-on pinhole camera (`cam.d` metres in front of the road, horizon mid-screen), so a prop is the same size and place in both. |
| `JourneyScene.svelte` | Picks 3D or 2D, falls back, owns the caption, Skip and the hand-over to the desk. |

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

The case office uses the selected avatar and nine separate furniture models at Full detail; Standard keeps the procedural room and
downloads no GLBs. The generated room shell is not used because furniture is baked into it. Character clips and keyboard reach must
be sampled from the scene's `Pose` and time, never `performance.now()`, so rebuilding at another detail level preserves the pose.

**Existing exception to the two-renderer rule:** generic room stages (including the office) currently show their flat DOM content at
Simple detail or on 3D failure, rather than an animated Canvas 2D room. The office's missing 2D intro/return/exit is tracked explicitly
in `TODO.md`; do not describe that flat terminal as an animated 2D fallback.
