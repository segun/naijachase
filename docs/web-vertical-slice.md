# P3.6 web vertical slice

The web client lives in `web/` and uses Svelte 5, TypeScript, semantic HTML, and
a small hand-written CSS design system (no UI framework, no web fonts). Run the
Rust API with `make api`, then run the client with `make web` in another terminal
and open `http://127.0.0.1:4173`. To work on the UI without MySQL, run
`make web-mock` and `make web-mock-ui` (see below).

## Structure

```
web/src/
  main.ts, App.svelte    entry point and the screen router with an error boundary
  api/                   api.ts: the typed client for the Rust API
  state/                 app.svelte.ts (AppController: session, case state, notebook, settings,
                         toasts, briefing) and groups.svelte.ts
  domain/                pure, unit-tested logic: model.ts (clock, ranks, zones, quotes), map.ts
                         (map projection), briefing.ts (the typed case dossier), venues.ts
  music/                 the menu music: score data, catalogue, synthesiser, controller, toggle
  avatar/                the avatar presets, their 3D and SVG drawings and the picker
  scenes/                everything with a camera and a stage
    shared/              Stage.svelte (the frame every room uses), chase3d-stage.ts (engine, lights,
                         shell, door, figure, render loop), chase3d-kit.ts, scene-capability.ts,
                         scene-core.ts (palettes, room footprint, easing, limb angles)
    chase/               the sign-in chase: chase3d*.ts, chase-biomes.ts, chase-motion.ts, ChaseStage
    office/              the desk: Room, CaseDesk (the CRT terminal and briefing), VenueArt,
                         room-scene.ts and chase3d-room.ts
    archive/             the records room: ArchiveRoom, Archive (the list), archive-scene.ts
    garage/              the garage: GarageRoom, garage-scene.ts and chase3d-garage.ts
    witness/             the witness interview: WitnessScene, witness-scene.ts (timing, poses, subtitles),
                         venue-recipes.ts (per-venue look and sound), market-layout.ts (where things stand),
                         witness-driver.ts (shared options, sound, subtitles), witness-audio.ts,
                         chase3d-witness.ts (3D) and witness-2d.ts (2D)
  screens/               the ordinary screens, grouped by feature
    entry/               Landing, AuthPanel
    account/             Settings
    case/                Investigate, Notebook, Dossier, Travel, Warrant, Results, Ledger, ...
    social/              Groups, Weekly, WeeklyPlay, Helpers
    admin/               ContentGate and ContentDashboard (reached only by URL)
  ui/                    shared pieces: Shell, Hud, Brand, Icon, Toasts, Stepper, NigeriaArt
  styles/                tokens, base, layout, screens, terminal (the rooms)
web/tests/               unit tests; helpers.mjs finds a source file by name wherever it lives
web/dev/mock-api.mjs     in-memory stand-in for the Rust API (development only)
web/dev/check-budget.mjs advisory bundle-size report run after `vite build`
```

Rules of the layout: Babylon.js may only be imported by TypeScript modules under `scenes/` and
`avatar/avatar3d.ts`, and only through a dynamic `import()`; each scene keeps its pure timeline
(`*-scene.ts`, no Babylon.js, unit-tested) next to the module that draws it.

## Experience

- **Landing and sign-in**: animated route map, split-screen login/registration
  with password-strength and match feedback, location-assisted home base, and an
  animated chase scene (three officers in black uniforms pursuing a masked
  thief through a Nigerian city at night). On desktop the sign-in screen, including the compact
  two-column registration form, fits the viewport without scrolling; small
  screens scroll only if the content cannot fit.
- **3D chase scene (Babylon.js)**: the sign-in chase is rendered in real time with
  Babylon.js. Three officers in black uniforms chase a masked thief with a sack of
  loot through three Nigerian locations on one endless loop: **Lagos** (night: the
  Atlantic with fishing boats and a lighthouse, seawall, palms, a lit bridge, a
  tower skyline, danfo buses and commuters), **Anambra** (dusk: an Onitsha-style
  market with striped stalls, goods and baskets, concrete shopfronts, the Niger
  Bridge, and market women in gele and wrappers and men in red caps carrying
  baskets and sacks) and **Kano** (harmattan daylight: groundnut-sack pyramids,
  mud-brick houses, Dala Hill, baobabs, farmland and farmers in gowns, fula and
  kufi caps with hoes), then back to Lagos. Each city is named by a signboard in the scene
  itself (no overlay label): the "Lagos Island Medical Hospital" sign, the "Onitsha
  Main Market" sign and a "Welcome to Sabon Gari" board, painted onto textures at
  load time (`chase3d-signs.ts`). The world eases down to about 40% speed as each
  sign passes and speeds up between cities, so the text is readable for several
  seconds without changing the length of the loop. Each city holds for a while, then sky, fog, light, road, stars, sun or moon
  and scenery cross-fade smoothly into the next (`chase-biomes.ts`, unit-tested:
  weights always sum to 1 and palettes change continuously).
  - Modules: `chase-motion.ts` (gaits: sprint, walk, idle), `chase-biomes.ts`
    (locations and blending), `chase3d-kit.ts` (materials, painted textures),
    `chase3d-actors.ts` (one parametric figure builder for officers, thief and every
    passer-by: head-wear, wrappers, gowns, carried items), `chase3d-world.ts` (the
    scenery ring and people) and `chase3d.ts` (engine, lights, sky, camera).
  - Technique: everything is procedural (primitives, painted canvas textures, no
    model files); scenery is instanced and distance-culled; far layers of a city sink
    below the ground as it fades so nothing lingers.
  - Performance gate (`scene-capability.ts`, unit-tested): the 3D chunk is only
    downloaded on screens wide enough to show the panel (961 px and up, so never on
    phones or most tablets), and not with reduced motion, Save-Data, a 3G or slower
    connection, or under 2 GB of memory. It starts only once the browser is idle, so
    the sign-in form is usable first. Devices with few cores, little memory or a
    touch screen get a "light" tier (no shadows or glow, 1x pixel density). If the
    frame rate stays under 20 fps the scene falls back to 2D for good (no flip-
    flopping).
  - A 3D/2D switch is remembered. The 2D SVG scene is always the base layer and the
    fallback (while loading, without WebGL, or with reduced motion). Rendering pauses
    when off-screen or the tab is hidden and WebGL resources are released on leaving
    the screen. Babylon.js is imported with deep paths and only through a dynamic
    import, so it is not in the initial bundle (the lazy chunk is about 410 KiB
    gzipped, the main cost to weigh before using 3D more widely).
- **Music**: ten original tunes (Night Pursuit, Lagos Nights, Highlife Sunrise, Smoke and
  Mirrors, Harmattan Dawn, Express to Kano, Market Day, Neon Circuit, Midnight Heist and
  Victory Lap), synthesised with the Web Audio API (no audio files and no third-party
  music). An on/off button and a tune picker sit on the home and sign-in screens and, once
  signed in, in the side rail (or a small floating control on the room screens and on
  mobile). The music starts on the first tap or key press because browsers block autoplay,
  and keeps playing through sign-in and the game; changing tune fades the old one out and
  the new one in. The on/off and tune choices are remembered on the device. The synthesiser
  and the scores are a lazy chunk; the scores are pure data in `web/src/music/music-score.ts`
  and the names in the tiny `web/src/music/music-catalogue.ts`.
- **Application shell**: sidebar with rank progress on desktop, bottom tab bar
  on mobile, and a sticky case HUD showing location, zone, case clock, a
  deadline meter that turns urgent in the final 24 hours, and score.
- **Room and agency terminal** (the signed-in home, `Room.svelte` + `CaseDesk.svelte`): after
  login the player's own avatar walks into a 3D office, sits at a computer and the camera
  zooms into the monitor, where a retro CRT terminal takes over. The terminal says
  "Good morning/afternoon/evening, {name}" from the local clock, shows the server-owned rank
  prominently, offers "Start new case" (or "Resume case"), Achievements and a Career file
  (accuracy and rank history), and a Menu that opens the archive, groups, weekly, helpers,
  settings and log out. Behind it everything is server-driven: career summary, catalogue
  progress from `GET /v1/cases/catalogue-status`, and one "Open new case" action that calls
  `POST /v1/cases` with an empty body: the server picks the mission and issues the case id and
  seed. When the server reports the catalogue exhausted, the terminal shows a completion
  milestone with a link to the archive instead of an error. The intro lasts five seconds and plays once per sign-in
  (it can be skipped with the button or Esc) and is a lazy Babylon.js chunk
  (`scenes/office/chase3d-room.ts`) built from primitives and painted textures; timing, lighting for the
  time of day and the camera framing are pure and unit-tested in `scenes/office/room-scene.ts`. With
  reduced motion, Save-Data, a slow network, low memory or no WebGL the terminal opens directly.
  Keyboard: arrows move between options, `N` new case, `A` achievements, `C` career file,
  `M` menu, `Esc` back.
- **Case briefing and garage** (`CaseDesk.svelte`, `GarageRoom.svelte`): opening a new case
  (`POST /v1/cases`) no longer jumps to the investigation. The terminal first types out the
  server's `state.case_dossier` (title, stolen item, premise, opening briefing, plus starting
  state, case clock, funds and attempt; `domain/briefing.ts`) and then waits: the player reads at their
  own pace and presses Continue (or Enter). It never moves on by itself. The three local leads
  follow (the server's local transport quotes), each with its own line drawing
  (`VenueArt.svelte`, one per venue in `data/gameplay/venues.csv`, a map pin for new ones).
  Picking a lead plays a short exit (the player stands and walks out of the door, about 3
  seconds) and the camera pans into a garage of parked cars (`scenes/garage/chase3d-garage.ts`,
  `scenes/garage/garage-scene.ts`). The player comes through the door and waits while two animated cards
  offer the server's two local modes: **Drive** (keys `D` or `1`) and **Hitch a ride** (`H` or
  `2`), each with the server's fare, journey time, arrival and balance after, and a warning when
  unaffordable or past the deadline. The visit command is sent first; only when the server accepts
  it does the player climb into the open-top car and drive off (about 3.8 seconds) or set off
  for the roadside with a thumb out (about 2.5 seconds), and then the witness scene plays (below)
  and the investigation opens with the witness account in the notebook. "Not now" (Esc) goes back to the investigation without
  travelling. The dossier cannot be skipped; "Skip to the case" on the leads screen goes straight to the investigation; resuming a
  saved case does not replay the briefing.
- **Witness scene** (`scenes/witness/`): after a visit is accepted (from the garage, or from the
  investigation's travel dialog) the picture fades up on the venue. Only the market has a scene so far;
  other venues go straight to the investigation. The player's vehicle pulls up (the open-top car for
  **Drive**, a yellow minibus with a rear door for **Hitch a ride**), the player gets out under a banner
  carrying the venue's name, walks up to the witness behind her stall, and the witness greets the player and
  speaks with her mouth and hands moving. The words appear along the bottom of the screen as they are said (a
  large caption of about 14 words at a time, spoken words bright and the rest dim). The whole
  account is also announced once to screen readers and stays in the notebook. Length follows the number of
  words: about 10 to 15 seconds for a typical account (speech is paced at 3.3 words per second, between 3 and
  11 seconds, and the scene never exceeds 18 seconds); Esc, Enter, Space or the Skip button end it. Everything is
  derived from the account text and the venue id, so no per-location scene is stored or downloaded: the
  witness is picked from the venue recipe by the account text and the lighting follows the case clock. Sound is
  synthesised with the Web Audio API (crowd murmur, traders calling, a generator, coins, the engine, door,
  footsteps and a syllable-timed voice babble); it follows the Music toggle and turns the music down while it
  plays. It is never skipped and never leaves a black screen: it starts in 3D on capable devices and in 2D (Canvas 2D, `witness-2d.ts`) on
  the rest, and if 3D fails, throws, loses its context, stalls or runs below 20 fps it carries on in 2D from the same moment. Reduced motion
  starts the 2D scene at the conversation. The pattern every scene must follow is in `docs/scene-conventions.md`. Timing, poses, subtitle paging and mouth movement are pure and unit-tested in
  `scenes/witness/witness-scene.ts`; a new venue needs an entry in `venue-recipes.ts` and its dressing in
  `chase3d-witness.ts`.
- **Case archive** (`ArchiveRoom.svelte`): opened from the terminal menu, the avatar walks into a
  records room, takes a case file off the shelf and turns to show it, and the camera zooms onto
  the file, where the list below is shown on a manila sheet (about 4.5 seconds, skippable with
  the button or Esc, once per sign-in; same lazy scene frame, fallbacks and unit-tested timeline
  as the office: `scenes/archive/chase3d-archive.ts`, `scenes/archive/archive-scene.ts`, shared
  `scenes/shared/Stage.svelte` and `scenes/shared/chase3d-stage.ts`). "Back to the desk" or Esc returns. The list itself: completed
  cases with outcome, thief, score, time, route and
  accuracy; "First solve" and "Replay" badges from `first_completion` and
  `attempt_kind`; and a "Replay case" action (`POST /v1/cases/replay`) on solved
  missions. Replays are labelled in the case, header and results, and the UI states
  that they award no points or achievements (the server enforces this).
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
- **Money and transport**: every journey is quoted by the server
  (`GET /v1/cases/{id}/transport-quotes`). Witness venues, state destinations and
  hideout raids all use a modal confirmation with fly / drive / hitch options (flying
  is never offered locally because the server never quotes it), fare, journey time,
  opening-hours wait, estimated arrival, balance after, and a warning if it would miss
  the Monday 07:00 deadline. Unaffordable options are disabled; hitching stays
  enabled at zero balance. Case funds show in the HUD, and a read-only spending ledger
  (`/ledger`) sits in the notebook. The browser never calculates a fare.
- **Release notices and content dashboard**: a "New case available" notice (from
  `/v1/cases/catalogue-notifications`, no case details) on the case desk, marked read
  when dismissed or followed. The content team's restricted dashboard lives at
  `#/content`, has no link anywhere in the player UI, and is a separate lazy chunk
  that only downloads after the server confirms a content role: catalogue health and
  reserve alert, mission lookup, validation issues, role-appropriate lifecycle actions
  with a required reason (and a UTC time to schedule), and the immutable audit history.
- **Helpers (cooperation)**: private, asynchronous help from a friend by exact
  username: preferences, "Ask a friend for help" on Investigate, a request list with
  accept / decline / write a recommendation (1–240 characters) / say thanks, expiry
  countdowns, block and report dialogs, and a blocked list. Offered only to
  age-confirmed adults who opted in. There is no chat, directory, presence or
  location. Recommendations are rendered as untrusted plain text.
- **Groups and weekly challenges**: private groups (create, invite by exact username,
  accept / decline, roles, remove, transfer ownership, leave, delete) and the weekly
  challenge: join, an independent attempt with question / travel / dossier / warrant
  tabs, real-time transit shown from the server's remaining seconds (commands are
  hidden while travelling), standings and the server-chosen winner, a text timeline,
  history, cancel (owners and admins) and notification settings. Device time only
  drives a display countdown; the server decides eligibility, arrival and winners.
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
password signs in. Switches (environment variables): `MOCK_PUBLISHED=3` (exhaust the
catalogue quickly), `MOCK_NOTICES=1` (a new-case notice), `MOCK_ROLE=editor|publisher|admin`
(unlock `#/content`), `MOCK_AGE=adult|minor|unknown` (cooperation eligibility) and
`MOCK_TRANSIT=6` (weekly journey seconds). The mock also seeds a second player, "Ada_01",
so invitations, requests and standings have content. The mock is for UI work only; the Rust API remains the
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

- Mission titles are not shown because the API does not expose them.
- Weekly attempts have no quote endpoint, so they offer the three standard witness
  venues and fixed suspect files, and do not show fares or opening-hour waits.
- The API has no "list my groups" call; the browser remembers group ids it has seen
  and re-validates each with the server.
- Weekly renderer events are shown as a text timeline only; no event animations yet.
- Animating the returned journey duration (P3.7.3) is not built.
- The API does not yet expose the warrant candidates, so the Warrant screen still uses
  fixed suspect files `NG-T001`–`NG-T003`. Warrants are not meaningful until the API
  serves the real candidates. (Venues, fares and journey times now come from the
  server's transport quotes.)

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
