# Generated 3D models (GLB) in the game

How the GLB files in `web/public/assets/3d/` get into the scenes. For making the files see [3d-generator-prompts.md](./3d-generator-prompts.md);
for what exists see [3d-asset-progress.md](./3d-asset-progress.md).

## The pieces

| File | What it does |
| --- | --- |
| `web/src/scenes/shared/model-manifest.ts` | Pure data: every model on disk (345 so far): file, kind, real size in metres and how it is measured (`measure`: height, or `length` for vehicles, rooms, bridges, fields), facing (`yaw`), `mirror`, `offset`. A test fails if a file has no entry or an entry has no file. |
| `web/src/scenes/shared/chase3d-models.ts` | `loadModel(scene, id)`: downloads the GLB once per scene, scales it to its real size, stands it on its origin and faces it correctly. Returns `null` if the id or file is bad, so callers fall back to the shapes built in code. |
| `web/src/scenes/shared/chase3d-model-figure.ts` | Poses a person from the scene's normal `Pose`: walk follows gait, sitting blends continuously onto the seat, optional hand targets reach the keyboard. Sampling is deterministic, including the small typing movement. |
| `Stage.addModelFigure(preset)` | The player's avatar from its GLB, or `null` (then use `addFigure`, the procedural avatar). |

Files are plain static files served from `/assets/3d/`; a scene downloads a model only when it needs it, and the browser caches it.
Nothing from the models is in the main bundle, and the Babylon.js loader is imported lazily.

## Where the models are used so far

- **Avatar picker** (`avatar/avatar3d.ts`, `renderAvatarSnapshots`): the ten avatars from their GLBs, procedural shapes if one fails.
- **Garage** (`scenes/garage/chase3d-garage.ts`): the player's avatar and the runabout car. The car is mirrored so its steering wheel is on the
  side the avatar sits. A GLB car does not spin its wheels and the avatar has no thumb-out pose when hitching.
- **Case office** (`scenes/office/chase3d-room.ts`): the player's avatar walking, sitting, typing and leaving, plus nine individual furniture
  models: desk, monitor, lamp, chair, filing cabinet, corkboard, plant, papers and window. Each failed model retains its own procedural
  counterpart. The shell, swinging door, time-of-day sky, case map, terminal glass, keyboard and mouse stay procedural.
- Everything else (witness, journey, archive, panel, chase) still draws the procedural figures. Moving a scene over means using
  `addModelFigure` and calling `figure.apply(pose)` instead of setting `rig` angles, as the garage does.

## How sizes are set

Every generated model comes out about one unit on its longest side, whatever it is, so the manifest gives each one its real size: real-world dimensions (a bin 0.9 m,
a church 18 m across, the Lagos bridge 120 m long) or what the scenes need (the cutaway rooms are the shared room's 8.8 m width). People, animals, props, buildings and
scenery are measured by height; vehicles, rooms and anything long and low (bridges, hills, fields, fences, tracks) by their longest horizontal side. Everything except
vehicles is turned to face -z, towards the camera. Models also come with a small slab of ground under them, so footprints include a little extra.
The sizes are real-world starting points: tune one when its scene is moved over (set `checked` once it looks right).

### Office calibration

The office fits individual models to its existing desk and camera anchors, rather than changing the gameplay timeline. Its desktop is
0.75 m high, seated hips are 0.48 m high, and hands reach keyboard targets within about 1 cm for all ten avatars. The model avatar and chair
move 0.2 m closer to the desktop when seated, accounting for the generated figures' shorter arm reach. Sit transitions blend with the walk/rest
pose; typing is a two-bone reach with a small timeline-driven hand movement, not a separate downloaded clip.
The chair model's front is authored sideways relative to the other props. Its manifest `yaw: -Math.PI / 2` corrects that quarter-turn,
putting the backrest behind the seated avatar and facing the seat towards the desk; the procedural chair's orientation is unchanged.

`office_room.glb` is deliberately **not downloaded**: it contains baked-in furniture in one mesh, so it cannot replace the shell without
duplicating objects, obstructing the moving door or changing the camera path. The separate monitor also contains a keyboard and a display slab.
It is fitted with these below the desktop; the existing keyboard/mouse and 4:3 glass remain visible and keep the interactive terminal aligned.
Generated slabs under the other objects are sunk slightly where practical. Do not discard or regenerate these files.

Full requests the selected avatar and nine unique furniture GLBs (the plant is instantiated twice from one download). Standard requests no
GLBs. Abandoning an office load on a detail change disposes its scene immediately; late/timed-out model containers are disposed rather than
instantiated into an abandoned scene. Browser checks covered all ten seated avatars, blocked-asset fallback, intro/return/exit previews and live
Full/Standard/Simple switching. **Simple currently opens the flat DOM terminal, not an animated Canvas 2D office**; a matching 2D office remains
an explicit follow-up, rather than a claim that this room has one already.

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
