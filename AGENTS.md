# Notes for anyone (human or AI) working in this repository

- **Animated web scenes are 3D with a 2D fallback.** Never skip a scene because the device is weak and never leave a black
  screen: start in 3D (Babylon.js) when the device is capable, otherwise in 2D (Canvas 2D), and if 3D fails continue in 2D
  from where it had got to. Both renderers share one pure timeline. Read `docs/scene-conventions.md` first and copy the
  structure of `web/src/scenes/witness/`.
- Run the web checks with `cd web && npx svelte-check --tsconfig ./tsconfig.json && node --test tests/*.test.mjs`.
- Keep `TODO.md` and `docs/` up to date when a feature changes.
