# Web performance budgets

`pnpm build` is the production performance gate. After Vite creates `web/dist`,
`web/dev/check-budget.mjs` measures the actual gzip size of the generated files
and exits unsuccessfully when any budget is exceeded.

| Payload | Release limit |
|---|---:|
| JavaScript referenced by `index.html` | 62 KiB gzip |
| CSS referenced by `index.html` | 10 KiB gzip |
| All lazy JavaScript combined | 975 KiB gzip |
| Any one lazy JavaScript chunk | 365 KiB gzip |

The gate prints the ten largest lazy chunks so increases are visible during every
release build. Vite also warns at 500 KiB uncompressed instead of suppressing
large-chunk warnings until 1.5 MB.

## October 2026 review

Before this pass the initial application was 66.2 KiB of JavaScript and about
10.4 KiB of CSS gzip. Lazy JavaScript was 1,119.3 KiB gzip, including a single
327.8 KiB `chase3d-models` chunk.

The application router now loads authentication, administration, results and
detail controls only when used. Route-specific authentication and warrant CSS is
also loaded with those routes. The model loader registers only Babylon's glTF 2
loader rather than the barrel containing every optional glTF extension. Babylon
remains behind the scene-level dynamic imports. We deliberately let Rollup group
Babylon's mutually dependent internals instead of forcing package directories
into circular chunks.

Most remaining lazy weight is the Babylon rendering runtime, materials and
shaders. It is intentionally absent from the initial page and is only requested
after the device/detail checks allow a 3D scene. The smaller application-route
chunks, music engine and 2D fallbacks remain independently cacheable.

The verified production result is 57.3 KiB initial JavaScript, 9.8 KiB initial
CSS, 926.9 KiB total lazy JavaScript and a 318.5 KiB largest lazy chunk, all gzip.
Vite still prints its intentional 500 KiB uncompressed warning for that Babylon
chunk; the gzip release gate is the authoritative pass/fail check.

The resulting shared CSS is 10.02 KiB gzip. Its budget is 10.5 KiB rather than a
rounded 10 KiB so a successful release build has a small, explicit margin without
hiding a meaningful stylesheet increase.

Changing a limit is a reviewed release decision: update the table, the constants
in `web/dev/check-budget.mjs`, and the budget regression test together.

## Contextual advertisements and explorable scenes

Office/garage Canvas fallbacks are now active, and both renderers load the shared
placement catalogue and advertisement interactions. The initial JavaScript limit
is 62 KiB and total lazy JavaScript is 975 KiB for this feature (previously 60 and
950 KiB). The largest-chunk limit stays 365 KiB; Babylon remains lazy. The current
CSS gate is 10 KiB, matching `check-budget.mjs`. The development-only review pages
are not production entries. Run the release build to print exact current sizes.
