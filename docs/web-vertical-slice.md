# P3.6 web vertical slice

The web client lives in `web/` and uses Svelte 5, TypeScript, semantic HTML, and
a small hand-written CSS design system (no UI framework, no web fonts). Run the
Rust API with `make api`, then run the client with `make web` in another terminal
and open `http://127.0.0.1:4173`. To work on the UI without MySQL, run
`make web-mock` and `make web-mock-ui` (see below).

## Structure

```
web/src/
  App.svelte             screen router with an error boundary
  lib/app.svelte.ts      AppController: session, case state, notebook, settings, toasts
  model.ts, map.ts       pure, unit-tested logic (clock, ranks, zones, map projection)
  components/            Shell, Hud, Landing, AuthPanel, CaseDesk, Investigate, Notebook,
                         Dossier, Travel, Warrant, Results, Settings, Icon, ...
  styles/                tokens, base, layout, screens
web/dev/mock-api.mjs     in-memory stand-in for the Rust API (development only)
web/dev/check-budget.mjs advisory bundle-size report run after `vite build`
```

## Experience

- **Landing and sign-in**: animated route map, split-screen login/registration
  with password-strength and match feedback, location-assisted home base, and an
  animated chase scene (three officers in black uniforms pursuing a masked
  thief through a Nigerian city at night). On desktop the sign-in screen, including the compact
  two-column registration form, fits the viewport without scrolling; small
  screens scroll only if the content cannot fit.
- **Menu music**: one original track, "Night Pursuit" (a brooding cinematic thriller,
  E minor, 126 BPM), synthesised with the Web Audio API (no audio files and no
  third-party music). A single on/off button on the home and sign-in screens
  controls it. It plays only on home, login, registration and recovery, fades out
  when the player signs in, and starts on the first tap or key press because
  browsers block autoplay. The choice is remembered on the device. The
  synthesiser is a lazy chunk; the track is pure data in
  `web/src/lib/music-score.ts`.
- **Application shell**: sidebar with rank progress on desktop, bottom tab bar
  on mobile, and a sticky case HUD showing location, zone, case clock, a
  deadline meter that turns urgent in the final 24 hours, and score.
- **Case desk**: server-driven career summary (rank, points, solved cases,
  jurisdictions, accuracy, achievements, rank history), resume, and new-case
  selection (next unplayed case, a random unplayed case, or a case number).
- **Case archive**: completed cases with outcome, thief, score, time, route and
  accuracy.
- **Investigate**: scene banner, eight-stop trail, venue cards with per-stop
  questioned state, and witness accounts shown as dialogue.
- **Notebook**: paper-style accounts grouped by stop, journey timeline and the
  suspect profile so far.
- **Dossier**: eight guided fields with completion ring; changes save together.
- **Travel**: schematic Nigeria map with keyboard-operable state markers, a
  searchable zone-grouped list alternative, and a boarding-pass confirmation so
  a mis-click cannot cost time or score.
- **Warrant and results**: three-step progress, suspect files, confirmation,
  hideout search, and case-closed results with rank progress.
- **Settings**: display options (device only), account profile (display name,
  pronouns, sex, home base), device sessions with per-device and all-device
  sign-out. Password recovery is in the sign-in panel.

The browser submits intent only. Travel duration, interview duration, suspect
truth, route, observations, and hideout remain authoritative server state.

## Accessibility and constrained devices

The UI has a skip link, semantic headings and forms, labelled controls, live
status and error announcements, visible focus, a high-contrast mode,
reduced-motion support (system and manual), and a text/list alternative for
the map. At 390 x 844 pixels no screen has horizontal overflow. Offline
transitions are announced without discarding the visible case. Initial payload
size targets (gzip) are 50 KiB JavaScript and 10 KiB CSS (the lazily loaded music
synthesiser is excluded). They are advisory: the build reports them but never
fails, because the game will keep growing.

Run `make p36` for the Rust, TypeScript, accessibility, privacy, responsive,
dependency-weight, and optimized-build gates. Moderated human usability and
assistive-technology playtests remain a P3.11 release-readiness gate.

## Developing without MySQL

`make web-mock` starts `web/dev/mock-api.mjs` on port 8081. `make web-mock-ui`
starts Vite against it (`API_TARGET=http://127.0.0.1:8081`). Any email and
password signs in. The mock is for UI work only; the Rust API remains the
authority.

## API integration

The client follows `docs/ui-api-handoff.md`. Request and response types come from
`contracts/typescript/api-v1.ts`; `src/api.ts` is the only module that calls the
service, always with `credentials: "include"`. Passwords and tokens never enter
browser storage. The session is rotated on start-up and every six hours.

| Status | Behaviour |
| --- | --- |
| 401 | Signed-in screens return to login with a notice; a failed login just shows its message |
| 403 | Shows the server's safe message (denied, unconfirmed, CSRF) |
| 409 | Reloads the case and tells the player it changed elsewhere |
| 422 | Shows the rejection message |
| 429 | Neutral "try again shortly" message |

Rank, points, achievements and promotion banners are displayed from
`/v1/progression/summary`; the browser never computes them. `web/tests/api-link.test.mjs`
checks that every endpoint the client calls exists in `schemas/openapi-v1.json`.

## Known gaps

- The API has no mission list, so mission ids follow the `NG-M####` convention
  (1–1000) and titles are not shown. The server rejects unknown ids.
- The API does not yet expose the three warrant candidates, the venue list for the
  current stop, or travel durations. The client still uses three fixed venues and
  fixed suspect files `NG-T001`–`NG-T003`, so warrants are not meaningful until
  candidates are served by the API.

## Adaptive rendering direction

Svelte owns the accessible application shell, accounts, controls, notebook,
dossier, travel, warrant, and progression interfaces. P3.10 will add Babylon.js
as a lazily loaded 3D scene renderer and PixiJS as a lazily loaded 2D fallback.
Neither renderer belongs in the initial bundle, and both must consume the same
renderer-neutral scene events from the authoritative game service.

The authoritative Rust engine remains on the server, and duplicating it in the
browser would increase synchronization and answer-leakage risk. WebGL/WebGPU
belongs only to the visual renderers; WebAssembly remains unnecessary unless a
future offline feature supplies a separate justification.
