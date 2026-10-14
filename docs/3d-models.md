# Generated 3D models (GLB) in the game

How the GLB files in `web/public/assets/3d/` get into the scenes. For making the files see [3d-generator-prompts.md](./3d-generator-prompts.md);
for what exists see [3d-asset-progress.md](./3d-asset-progress.md).

## The pieces

| File | What it does |
| --- | --- |
| `web/src/scenes/shared/model-manifest.ts` | Pure data: every model on disk (346 so far): file, kind, real size in metres and how it is measured (`measure`: height, or `length` for vehicles, rooms, bridges, fields), facing (`yaw`), `mirror`, `offset`. A test fails if a file has no entry or an entry has no file. |
| `web/src/scenes/shared/chase3d-models.ts` | `loadModel(scene, id)`: downloads the GLB once per scene, scales it to its real size, stands it on its origin and faces it correctly. Returns `null` if the id or file is bad, so callers fall back to the shapes built in code. |
| `web/src/scenes/shared/chase3d-model-figure.ts` | Poses a person from the scene's normal `Pose`: walk follows gait, sitting blends continuously onto the seat, optional hand targets reach the keyboard. Sampling is deterministic, including the small typing movement. |
| `Stage.addModelFigure(preset)` | The player's avatar from its GLB, or `null` (then use `addFigure`, the procedural avatar). |

Files are plain static files served from `/assets/3d/`; a scene downloads a model only when it needs it, and the browser caches it.
Production builds append a content-derived catalogue version to every model URL. This makes the one-year immutable Nginx cache safe:
changing any GLB changes the version used by the next deployment, while unchanged releases keep the same cache key.
Nothing from the models is in the main bundle, and the Babylon.js loader is imported lazily.

## Where the models are used so far

- **Avatar picker** (`avatar/avatar3d.ts`, `renderAvatarSnapshots`): the ten avatars from their GLBs, procedural shapes if one fails.
- **Garage** (`scenes/garage/chase3d-garage.ts`): the player's avatar and the runabout car. The car is mirrored so its steering wheel is on the
  side the avatar sits. A GLB car does not spin its wheels and the avatar has no thumb-out pose when hitching.
- **Case office** (`scenes/office/chase3d-room.ts`): the player's avatar walking, sitting, typing and leaving, plus nine individual furniture
  models: desk, monitor, lamp, chair, filing cabinet, corkboard, plant, papers and window. Each failed model retains its own procedural
  counterpart. The shell, swinging door, time-of-day sky, case map, terminal glass, keyboard and mouse stay procedural.
- **Login chase** (`scenes/chase/chase3d.ts`): the masked thief, three police officers, commuters, traders and farmers; palms, towers,
  fishing boats, lighthouse, danfo (with a seated driver), stalls, shopfronts, pyramids, mud houses, baobabs, roadside trees and lamps. The raid
  scene reuses it with a custom timeline; runners may carry `heading`, `stand`, `raise` and `reach`, which the model actors apply by aiming
  leg and arm bones on top of the run clip (hands up for the arrest, officers reaching for the thief).
- **Witness encounters** (`scenes/witness/chase3d-witness.ts`): all 35 venue types use the selected player, role-matched witness,
  venue-specific crowds, arrival vehicle and model-backed scenery at Full detail. See calibration and exceptions below.
- **Journeys** (`scenes/journey/chase3d-journey.ts`): the selected player walking, sitting and steering, flight cabin crew, runabout,
  moving danfo, parked coaches and airliner at Full detail. See calibration and limitations below.
- **Case archive** (`scenes/archive/chase3d-archive.ts`): Full attempts to use the selected avatar as it walks to the case file, reaches for it, turns and holds it in a reading pose.
  The procedural avatar remains the fallback, and model hands are aimed at the file during the reach and reading poses. Current avatar exports need loader validation:
  the preview reports `Cannot set properties of undefined (setting 'weight')` for an avatar GLB, so that avatar currently uses the fallback.
- **Disciplinary panel** (`scenes/panel/chase3d-panel.ts`): Full attempts to use the five seated judge models and selected player avatar; vote papers remain procedural.
  The judge exports are unrigged and need visual fitting—the current preview shows oversized dark silhouettes—so do not treat their integration as calibrated.

### Witness calibration and fallbacks

Full uses existing manifest dimensions for people and the runabout/danfo. The 34 non-market venue frontages and tagged shared props
are uniformly fitted to their existing procedural layout dimensions, without stretching any axis independently. Main frontages stay
behind the conversation corridor (minimum Z: **3.1 m** for buildings, **3.4 m** for open-air venues). Shared replacements include palms,
trees, benches, tables, shade tents, crates, lamps, canoes, parked danfos and cattle. Market replaces nine surrounding stalls and palms;
its witness's own open stall remains procedural because the supplied complete stall's front posts would obstruct the conversation.
Sky, roads, water, readable signs, particles, some moving/detail geometry and specialist venue vehicles/animals remain procedural.
Venue interiors and every individual supplied accessory are not wired by this pass.

`witness-models.ts` maps each recipe's selected role/presentation onto the supplied character templates without changing the witness
selection, voice or server account. Full retains the models' baked clothing/skin textures rather than tinting the entire textured body;
Standard retains the original procedural recipe colours. Witness exports have Walk, not Talk/Idle: standing legs are corrected from
the walk sample, and shared bone aiming drives timeline-matched arm gestures across different bone axes. Player and crowd movement
still follows the pure witness timeline; horizontal exported hip travel is pinned while vertical walking bounce is retained.
Static vehicle exports do not provide opening doors or spinning wheels; their existing round-trip trajectory is preserved.
Cattle-market cows use a scene-specific **1.9 m overall height**, at least as tall as the people, in Full and procedural Standard.
Their uniform height fit overrides footprint fitting so narrow pen anchors cannot shrink them; other scenes keep manifest animal sizes.
A failed model or missing Walk leaves its procedural counterpart and logs the reason.

Standard loads no GLBs. Simple creates no canvas or animated renderer: it presents the complete server account, role and venue, with
**Continue to the investigation**. A stalled, slow or failed 3D scene opens the same account with an alert and expandable error details.
The visit has already been charged by the server; Continue calls the existing guarded handoff, not another visit command. Full/Standard
rebuilds resume the same timeline. Pending setup is aborted on detail changes and late callbacks cannot overwrite the readable account.
Witness failures use `nc-witness-flat`, independent of journey's `nc-journey-flat`. Changing the detail choice clears the failure.
Witness 2D source utilities remain for the legacy journey 2D source; neither active scene loads them.

Development preview: [web/dev-witness.html](../web/dev-witness.html), all 35 venues, Full/Standard, Drive/Hitch, hour and seek controls.
All 35 Full previews were loaded and sought through arrival, conversation and return; market and conservation-office images and both
arrival vehicle facings were inspected. Only individually inspected assets gain new `checked` flags, not the entire inventory.

### Journey calibration and fallbacks

Full keeps manifest dimensions: runabout **3.6 m**, danfo **4.4 m**, parked coach **11 m**, airliner **27 m**.
The runabout and danfo have different authored axes; only the danfo receives the extra quarter-turn before the timeline's rightward heading.
Portrait ground cameras follow the approaching player and then centre the vehicle, rather than leaving both outside the desktop camera's lead.
Coaches stay parked in the bus park. All ten players use Walk/Sit clips and steering-hand targets; the hitch journey uses the danfo model, with a driver at the
wheel and the player at the passenger window (the witness scene seats both too, until the door opens). The flight boarding pass follows the player's right hand.
No dedicated `crew` asset exists: cabin crew reuses `witness_woman_uniform` at **1.65 m**, retaining its supplied uniform texture.

The airliner has a higher door and wider wings than the procedural plane. `MODEL_AIR` and `modelBoardingPosition` fit the existing
boarding/deplaning choreography to its **3.55 m sill**, with diagonal procedural stairs ahead of the engine and a wider camera.
Sequence, pass presentation, fades and travel outcomes remain unchanged. The supplied vehicles are single static meshes:
they cannot spin wheels, swing their textured doors or retract baked landing gear. The plane keeps procedural stairs and a doorway overlay;
true moving parts require revised, separately rigged exports. Full-detail drive and hitch journeys use supplied journey models for
landscape props and set pieces; destination and location text stays as a readable overlay on the model signs. Standard keeps procedural
scenery, as do road, ground, water and sky surfaces. Flight scenery remains procedural.
A failed model or missing required Walk/Sit keeps its procedural counterpart and logs the reason.

Standard requests no GLBs. Simple skips ordinary journey animation and performs the existing guarded desk handoff once.
Weekly Simple instead shows route, server-derived progress and **Back to the desk**: it never shortens the real server wait.
3D faults, stalls and low frame rates show readable journey status, an explicit alert, expandable details and Continue/Back.
Full/Standard changes preserve elapsed timeline time; pending setup is aborted and late callbacks are ignored.
The legacy `journey-2d.ts` file is no longer imported by the runtime. Login alone retains an active animated Simple renderer.

Development preview: [web/dev-journey.html](../web/dev-journey.html), Drive/Hitch/Fly, Full/Standard, all ten avatars, weekly loop, hour and seek controls.
Browser checks cover the actual Simple visit/Continue flow and 320x568, 360x640, 390x844, 568x320 and 844x390 layouts: full account,
scrollable text, reachable Continue, no horizontal overflow or floating-control overlap. The production component was also checked
with a long account, detail rebuilds and WebGL-loss recovery. These are Chromium emulation checks, not real-phone/Safari performance evidence.

### Archive and panel scene integration

Full uses the selected avatar model for the archive walk, file reach and reading pose; the shared model-figure hand targets keep the held file aligned
to the player's hands while the procedural file remains available at every detail level.
The panel uses the five seated judge exports and the selected avatar, with the existing procedural vote papers and per-figure procedural fallback.
The judge exports currently contain one static mesh each, with no skin or named arm joints. As a result, papers rise in the existing timeline but the
judge's arm cannot yet move with them; that gesture needs a rigged judge export. Preview both scenes and all player avatars at [web/dev-model-scenes.html](../web/dev-model-scenes.html),
or use the dedicated panel/judges inspection harness at [web/dev-judges.html](../web/dev-judges.html) (redirected also from `web/dev-panel.html`).

## How sizes are set

The login chase's `masked_thief` is registered under `characters/chase/` at **1.78 m standing height**, using height measurement and
the usual person facing correction. The browser loader measured its fitted height at 1.780 m and its base at ground level, and confirmed
both Walk and Run after optimisation. The police export also includes both clips and is fitted at **1.72 m**.
The optimiser preserves replaced originals in hash-suffixed backups and processes the newly supplied export, never the previous backup.

Every generated model comes out about one unit on its longest side, whatever it is, so the manifest gives each one its real size: real-world dimensions (a bin 0.9 m,
a church 18 m across, the Lagos bridge 120 m long) or what the scenes need (the cutaway rooms are the shared room's 8.8 m width). People, animals, props, buildings and
scenery are measured by height; vehicles, rooms and anything long and low (bridges, hills, fields, fences, tracks) by their longest horizontal side. Everything except
vehicles is turned to face -z, towards the camera. Models also come with a small slab of ground under them, so footprints include a little extra.
The sizes are real-world starting points: tune one when its scene is moved over (set `checked` once it looks right).

### Login chase calibration and fallbacks

Full uses the registered runner/crowd models and 16 matching scenery/vehicle models (23 unique files, each downloaded once per scene).
Scenery is uniformly fitted to the existing procedural anchors: building/tree heights and boat/bus lengths. The danfo's long axis is
already X, so it needs no quarter-turn. Its windows are see-through, so each danfo model gets a seated primitive driver at the
wheel (Standard keeps the built-in danfo with riders' heads). People turn from the loader's -Z facing to the chase's +X. The checked manifest flags cover only
models inspected in this scene. Roads, kerbs, water, sky, bridges, distant hills, far shop facades and readable city signs stay procedural.
Generated scenery may retain its baked base; no source geometry is destructively edited.

Run/Walk clips are paused and sampled by shared cadence, not advanced independently. Exported hip translations are anchored horizontally
so runners do not drift away from their timeline positions. The thief's sack and two officers' batons remain procedural while held assets
are deferred; the sack follows the hips and batons follow the hand. A failed model or missing required clip leaves its procedural actor intact.
Standard requests no GLBs. Simple is now Canvas 2D, sharing the city progression, camera, runner positions and poses with 3D through
`chase-frame.ts`; its scenery is intentionally simplified. Full/Standard/Simple changes and WebGL failure continue on the same clock.
Reduced motion draws one calm 2D frame. Abandoned model setup is disposed, including containers arriving after cancellation.

The login chase keeps the existing desktop-only side panel: below **961 px**, it is hidden and neither renderer nor GLBs are loaded.
Mobile login checks cover 320x568, 360x640, 390x844, 568x320 and 844x390: inputs fit, no horizontal overflow, submit is reachable by
scrolling, and touch password visibility/recovery navigation work. Full selected on these screens still issues zero GLB requests.
These are Chromium viewport/touch-emulation checks, not physical-phone or Safari performance checks.
Development preview: `web/dev-chase.html`, with Full/Standard/Simple and a seekable inspection time.

### Office calibration

The office fits individual models to its existing desk and camera anchors, rather than changing the gameplay timeline. Its desktop is
0.75 m high, seated hips are 0.48 m high, and hands reach keyboard targets within about 1 cm for all ten avatars. The model avatar and chair
move 0.2 m closer to the desktop when seated, accounting for the generated figures' shorter arm reach. Sit transitions blend with the walk/rest
pose; typing is a two-bone reach with a small timeline-driven hand movement, not a separate downloaded clip.
The chair model's front is authored sideways relative to the other props. Its manifest `yaw: -Math.PI / 2` corrects that quarter-turn,
putting the backrest behind the seated avatar and facing the seat towards the desk; the procedural chair's orientation is unchanged.

Every Full/Standard office entry pauses at `T_ZOOM_START`, once the avatar is seated and before the terminal glass appears. The first entry still
walks in; later entries and witness returns start seated. The DOM hint says **Look around the office**, with bounded drag/swipe camera
orbit and arrow-key controls. **Continue to case desk** resumes the zoom from the explored view, without snapping back. The paused scene
renders only on camera input or resize; the shared timeline does not keep running during exploration. Skip intro stops at the exploration
pause rather than bypassing it. Full/Standard changes retain the pause and camera offset. Simple opens the functional terminal directly:
no entry, return, exploration, exit fade, alert or Continue gate. Switching to Simple mid-intro or mid-exploration also opens the desk,
and increasing detail afterwards does not replay the intro or reintroduce the gate. A failed 3D scene retains its camera-unavailable
message and Continue step; failure handling has not changed in this pass.
Archive and garage do not opt into this office-only pause.
Mobile browser checks cover 320x568, 360x640 and 390x844 portrait, plus 568x320 and 844x390 landscape. The exploration card reserves
space above the floating Detail button on narrow screens, including the bottom safe-area inset. Chromium touch emulation verified
swiping without page scrolling, tapping Detail/Standard with zero GLB requests, and tapping Continue to open the terminal. The updated
Simple desk was checked at all five sizes: interactive terminal, no office canvas, no exploration gate and no horizontal overflow.
Switching from Standard exploration to Simple opens the desk; upgrading back to Standard leaves it interactive without re-gating.
Simple requires no office canvas or model downloads. These are
emulated mobile checks, not evidence of performance or Safari behaviour on a physical phone.

`office_room.glb` is deliberately **not downloaded**: it contains baked-in furniture in one mesh, so it cannot replace the shell without
duplicating objects, obstructing the moving door or changing the camera path. The separate monitor also contains a keyboard and a display slab.
It is fitted with these below the desktop; the existing keyboard/mouse and 4:3 glass remain visible and keep the interactive terminal aligned.
Generated slabs under the other objects are sunk slightly where practical. Do not discard or regenerate these files.

Full requests the selected avatar and nine unique furniture GLBs (the plant is instantiated twice from one download). Standard requests no
GLBs. Abandoning an office load on a detail change disposes its scene immediately; late/timed-out model containers are disposed rather than
instantiated into an abandoned scene. Browser checks covered all ten seated avatars, blocked-asset fallback, intro/return/exit previews and live
Full/Standard/Simple switching. **Simple intentionally opens the flat DOM terminal, not an animated Canvas 2D office**.
As each remaining non-login scene is integrated, remove its 2D animation in that scene's own pass and preserve functional content and
gameplay timing. Login keeps its Canvas 2D chase; no other scene's renderer is removed by the office-only change.

## Adding or fixing a model

1. Save the GLB under `web/public/assets/3d/...` and run `pnpm assets:optimize` in `web/` (shrinks it and updates the progress note).
2. Check it on `http://127.0.0.1:4173/dev-assets.html` (run `pnpm dev`): size, triangles, skeleton, movements.
3. Add or edit its line in `model-manifest.ts`: set `size` (and `measure` if it is long and low). People and animals are turned to face -z automatically; use `yaw` (radians) when a vehicle's nose is not already towards -z.
4. Look at it in its scene. `http://127.0.0.1:4173/dev-garage.html` runs the real garage scene (`?avatar=avatar-03`, `?settled`).
   `http://127.0.0.1:4173/dev-office.html` runs the real office (`?avatar=avatar-03&time=3.5`, `?detail=standard`); use its intro,
   return, leave and pose-inspection controls. These previews are development-only, not production entry points.
   Set `checked: true` in the manifest when size, facing and position are right.

## Gotchas

- Shaders: `chase3d-stage.ts` imports the default, post-process, rgbd-decode and shadow-map shaders up front; `chase3d-models.ts` registers PBR shaders
  for generated materials. Babylon otherwise fetches them lazily on
  the first frame and a scene that starts rendering before they arrive fails to compile its effects.
- `pnpm dev` caches modules aggressively in an already open tab: reload with a cache-busting query when checking a change.
- Vehicle sizes in the manifest are real-world lengths; only `car_player_runabout` has had its facing checked (`checked` flags are still to do).
