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
