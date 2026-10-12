# Generated 3D models (GLB) in the game

How the GLB files in `web/public/assets/3d/` get into the scenes. For making the files see [3d-generator-prompts.md](./3d-generator-prompts.md);
for what exists see [3d-asset-progress.md](./3d-asset-progress.md).

## The pieces

| File | What it does |
| --- | --- |
| `web/src/scenes/shared/model-manifest.ts` | Pure data: every model on disk (345 so far): file, kind, real size in metres and how it is measured (`measure`: height, or `length` for vehicles, rooms, bridges, fields), facing (`yaw`), `mirror`, `offset`. A test fails if a file has no entry or an entry has no file. |
| `web/src/scenes/shared/chase3d-models.ts` | `loadModel(scene, id)`: downloads the GLB once per scene, scales it to its real size, stands it on its origin and faces it correctly. Returns `null` if the id or file is bad, so callers fall back to the shapes built in code. |
| `web/src/scenes/shared/chase3d-model-figure.ts` | Poses a person model from the scene's normal `Pose`: walk clip follows the gait, `sit` clip when seated (lifted onto the seat), rest pose otherwise. |
| `Stage.addModelFigure(preset)` | The player's avatar from its GLB, or `null` (then use `addFigure`, the procedural avatar). |

Files are plain static files served from `/assets/3d/`; a scene downloads a model only when it needs it, and the browser caches it.
Nothing from the models is in the main bundle, and the Babylon.js loader is imported lazily.

## Where the models are used so far

- **Avatar picker** (`avatar/avatar3d.ts`, `renderAvatarSnapshots`): the ten avatars from their GLBs, procedural shapes if one fails.
- **Garage** (`scenes/garage/chase3d-garage.ts`): the player's avatar and the runabout car. The car is mirrored so its steering wheel is on the
  side the avatar sits. A GLB car does not spin its wheels and the avatar has no thumb-out pose when hitching.
- Everything else (office, witness, journey, archive, panel, chase) still draws the procedural figures. Moving a scene over means using
  `addModelFigure` and calling `figure.apply(pose)` instead of setting `rig` angles, as the garage does.

## How sizes are set

Every generated model comes out about one unit on its longest side, whatever it is, so the manifest gives each one its real size: real-world dimensions (a bin 0.9 m,
a church 18 m across, the Lagos bridge 120 m long) or what the scenes need (the cutaway rooms are the shared room's 8.8 m width). People, animals, props, buildings and
scenery are measured by height; vehicles, rooms and anything long and low (bridges, hills, fields, fences, tracks) by their longest horizontal side. Everything except
vehicles is turned to face -z, towards the camera. Models also come with a small slab of ground under them, so footprints include a little extra.
The sizes are real-world starting points: tune one when its scene is moved over (set `checked` once it looks right).

## Adding or fixing a model

1. Save the GLB under `web/public/assets/3d/...` and run `pnpm assets:optimize` in `web/` (shrinks it and updates the progress note).
2. Check it on `http://127.0.0.1:4173/dev-assets.html` (run `pnpm dev`): size, triangles, skeleton, movements.
3. Add or edit its line in `model-manifest.ts`: set `size` (and `measure` if it is long and low). People and animals are turned to face -z automatically; use `yaw` (radians) when a vehicle's nose is not already towards -z.
4. Look at it in its scene. `http://127.0.0.1:4173/dev-garage.html` runs the real garage scene (`?avatar=avatar-03`, `?settled`).
   Set `checked: true` in the manifest when size, facing and position are right.

## Gotchas

- Shaders: `chase3d-stage.ts` imports the default, post-process, rgbd-decode and shadow-map shaders up front. Babylon otherwise fetches them lazily on
  the first frame and a scene that starts rendering before they arrive fails to compile its effects.
- `pnpm dev` caches modules aggressively in an already open tab: reload with a cache-busting query when checking a change.
- Vehicle sizes in the manifest are real-world lengths; only `car_player_runabout` has had its facing checked (`checked` flags are still to do).
