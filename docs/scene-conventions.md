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
