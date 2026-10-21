# Scenery advertising

Companies supply artwork and an HTTPS destination. Staff book a named slot for
real elapsed hours or days. The server serves it only during that interval;
empty, disabled, expired or unavailable inventory uses NaijaChase house artwork.
This feature does not change gameplay clocks, clues, fares or outcomes.

## Player behaviour

- Office: right wall (one landscape board or two portrait boards), plus the small
  landscape board beneath the clock. Ads are available during the exploration pause.
- Garage: back wall above the parked cars and both side walls. Each wall supports
  one large board or two smaller boards. Drag, swipe or arrows change the aim;
  transport controls remain available.
- Witness: arrival and dialogue pause at the end of speech. The player can look
  around, read the full saved clue, or choose **Return to office**. Return plays the
  departure then opens the desk; no automatic dismissal or additional game charge.
- Tapping a poster opens an accessible dialog with the image and **Visit advertiser**.
  That link opens a new tab with `noopener noreferrer`; the game stays open. Dragging
  never opens an ad. **Sponsors & ad spaces** provides keyboard/screen-reader access
  to the same slots, including ones outside the current camera view.
- Office, garage and witnesses have Canvas 2D fallbacks driven by the same timeline.
  A 3D failure preserves progress; a double renderer failure retains usable DOM
  content. Clues remain readable on phones without covering the whole scene.

House messages include “All eyes on the chase. Your brand could be here.”,
“Make your brand the next big lead.” and “Your customers dey here. Put your brand
on the map.” They carry an Advertise on NaijaChase label. The house dialog identifies
the placement and artwork dimensions; it does not promise an online booking form.

## Witness placement inspection

The catalogue was selected against `market-layout.ts`, the open-air/building set
geometry, and model replacement bounds. Keep the witness, walk/vehicle corridor,
venue name, doors, cultural features and safety signage clear. Most spaces are
peripheral and intentionally become prominent when looking around. Forecourt
boards stay outside the main building footprint; sensitive civic/religious venues
use visitor boards instead of placing brands on the institution's main sign.
The table lists every implemented venue. Pixel dimensions are recommended;
matching proportions within 3% are accepted. Review in Standard, Full and Simple
via `/dev-ads.html` after changing scenery assets.

| Witness venue | Selected surface | Artwork pixels |
|---|---|---|
| market | Neighbouring stall | 1200 × 600 |
| craft market | Outer stall poster | 1200 × 600 |
| cattle market | Pen fence board | 1200 × 600 |
| festival ground | Stage sponsor board | 1200 × 600 |
| motor park | Waiting shelter board | 1200 × 600 |
| railway station | Station entrance poster | 1200 × 1440 |
| airport | Terminal forecourt board | 1200 × 600 |
| beach | Vendor area board | 1200 × 600 |
| fishing jetty | Ticket area board | 1200 × 600 |
| jetty | Ticket area sponsor | 1200 × 600 |
| waterfront | Warehouse side board | 1200 × 600 |
| seaport | Customs shed poster | 1200 × 600 |
| farm | Sorting shed board | 1200 × 600 |
| mining site | Perimeter sponsor board | 1200 × 600 |
| refinery | Perimeter sponsor board | 1200 × 600 |
| factory gate | Loading area sponsor | 1200 × 600 |
| conservation office | Veranda sponsor board | 1200 × 900 |
| community hall | Community sponsor panel | 1200 × 800 |
| university | Campus noticeboard | 1200 × 709 |
| library | Entrance noticeboard | 1200 × 709 |
| museum | Entrance banner | 415 × 1600 |
| radio station | Exterior sponsor board | 1200 × 600 |
| carnival workshop | Workshop poster | 1100 × 1600 |
| hotel | Entrance sponsor board | 1200 × 900 |
| restaurant | Awning sponsor poster | 1200 × 600 |
| nightclub | Entrance poster | 1067 × 1600 |
| police station | Forecourt sponsor board | 1200 × 720 |
| hospital | Forecourt sponsor board | 1200 × 720 |
| church | Visitor sponsor board | 1200 × 800 |
| mosque | Visitor sponsor board | 1200 × 800 |
| sacred grove | Visitor sponsor board | 1200 × 800 |
| palace | Courtyard sponsor board | 1200 × 720 |
| emir palace | Courtyard sponsor board | 1200 × 720 |
| traditional council | Courtyard sponsor board | 1200 × 720 |
| monument | Visitor sponsor board | 1200 × 720 |

## Admin workflow

Open **Advertisements** as an owner/operator. Enter company/contact, campaign name,
placement, HTTPS link and accessible image description. Upload PNG, JPEG or WebP
under 2 MiB, choose a start in the displayed local timezone, and an elapsed duration
in hours/days. The end time is shown before saving. Draft, published and paused
states can be edited, and the same form extends a schedule. The artwork preview
has desktop/mobile widths; it is an aspect-ratio preview, not a guaranteed camera
impression. A publication with a future start appears as scheduled; expiry is
computed from the schedule. The latest 1,000 campaigns can be searched locally.

Large and split alternatives share a wall: a large booking blocks either half,
while the left and right halves can run together. Back-to-back bookings may touch
at their boundary. Draft/paused entries do not reserve inventory. An inventory row
lock serializes scheduling transactions across server instances; revisions reject
stale edits. Campaign writes are audited. Runtime roles and grants remain separate
from player accounts and migrations.

## Storage and delivery

`shared/ad-placements.json` is the release-controlled geometry/artwork catalogue.
Migration `0003_advertising.sql` mirrors it into `ad_placements`. The other tables
are `ad_advertisers`, `ad_creatives`, `ad_campaigns`, `ad_bookings` and
`ad_inventory_lock`, all in the admin control schema. One campaign books one slot;
create separate campaigns for multiple placements. Whole/split is decided by active
bookings, not an unrelated manual display toggle.

Images are decoded with bounded dimensions/allocation, checked for aspect ratio,
downscaled to at most 1600 pixels per side and re-encoded as PNG. No SVG, script or
remote-image fetching is accepted. Creatives are immutable. The admin API allows
3 MiB JSON bodies to accommodate a 2 MiB base64 upload; ordinary admin endpoints
retain their 4 KiB limit. Requests and images use no-store. The public image route
serves only creatives in currently live bookings; drafts and expired images return
404. Admin previews require `ads:manage`.

`GET /ads-api/v1/manifest` returns server time and only current placement, image,
alt text, URL and schedule data. Contact details never enter it. The player polls
while visible, at most every 15 seconds, and drops expired ads on its one-second
tick. Server checks use start-inclusive/end-exclusive UTC timestamps. Ad service
failure gives house artwork and never blocks a scene. Anonymous ad measurement is
described below. No player-level identifiers, third-party scripts, auction network
or advertiser cookie is implemented.

## Release and checks

1. Provision migrations 0003 and 0004 and the updated restricted grants using the existing
   admin deployment tooling; no migration runs from the public player API.
2. Publish the admin and player bundles and both Nginx changes. The game host's
   `/ads-api/v1/` proxy permits GET/HEAD, plus POST only at `/ads-api/v1/events`, and strips Cookie/Authorization before
   forwarding to localhost:8081. Other admin routes stay on the admin host.
3. Prepare and preview campaigns with `ADMIN_ADS_ENABLED=false` (default). Public
   responses stay empty/404. Complete the existing P3.9 advertising launch review
   before setting it true and restarting the admin service. This is a documented
   repository launch gate, not an unfinished implementation step.
4. Against staging MySQL, create a short booking, check scheduled/live/expired
   transitions, reject a whole/half overlap, pause/replace it and confirm a viewer
   cannot manage ads. Verify uploaded links and images from desktop and a phone.
5. For rollback, disable serving and restart; leave the additive tables in place.
   Players immediately fall back to house artwork on the next manifest refresh.

Local checks: `cd web && npx svelte-check --tsconfig ./tsconfig.json && node --test
 tests/*.test.mjs`, `npm run build`, admin `npm run build && npm test`, and
`cargo test --manifest-path rust/Cargo.toml -p naijachase-admin --lib`.
`/dev-admin-ads.html` is a development-only editor fixture with in-memory campaigns;
it never calls the admin service. Neither review page is a production build entry.

Validation limits for this implementation: the sandbox prevents opening local test
ports and a fresh local MySQL instance could not start, so live database transaction
smoke tests remain a staging release check. Compile/unit/route tests validate the
upload boundary, authorization, launch gate, placement conflicts and image decoding.

Verified in this pass: both Svelte checks report zero errors/warnings; both production
builds pass (player: 60.1 KiB initial JS and 962.1 KiB lazy JS gzip). Backend tests:
21 passed, two existing database tests ignored. Admin UI tests: 17 passed; deployment
helper tests: seven passed. Web suite: 374 passed, four blocked by local-port `EPERM`.
The office poster click, garage drag, persistent market witness and explicit return
were checked in the browser. At 393 × 852, the Canvas museum clue drawer and ad dialog
fit; the admin editor accepted a 1200 × 600 sample and saved a draft in its in-memory
fixture. These browser checks do not substitute for the staging MySQL release check.

## Ad measurements and exports

`0004_ad_analytics.sql` adds append-only `ad_events` in the control database.
Reports remain available when serving is disabled. The runtime needs SELECT/INSERT
on this table; readiness fails until it exists. `ADMIN_ADS_PLAYER_ORIGIN` is the
exact player origin allowed to POST events (production default
`https://naijachase.app`, development `http://localhost:4173`). Admin CSRF checks
remain unchanged for every admin write. Public JSON bodies are capped at 4 KiB.

Only players who chose **Allow measurement** send ad events. The existing usage
privacy controls and legal notice now describe ad measurement. No consent means
no ad telemetry and direct HTTPS advertiser links. House ads and admin previews
never count. No ad events contain an account, persistent browser identifier, IP,
user agent or fingerprint. Counts are events, **not unique people**; browser
automation can contribute and these are not fraud-proof billable metrics.

- **Shown / impression**: loaded paid artwork visible for a continuous second in
  the foreground tab. After a full second out of view it may count again. Scenery
  and the opened detail image are separate exposures, identified by source.
  Polling works in settled scenes without restarting the animation loop; short
  3D-to-2D handoffs retain the exposure counter. 3D requires at least five of nine
  artwork samples to be on screen, unobscured by DOM, and hit by nearest-mesh
  picking. Canvas 2D requires half the projected billboard in the canvas and
  browser viewport with its centre unobscured by DOM; it estimates visibility
  and cannot detect scenery painted over the billboard. DOM details require
  half the image element in the viewport and its centre unobscured.
- **Ad clicked**: a paid poster or its entry in **Sponsors & ad spaces** was
  activated. Dragging, opening the general list and house placeholders do not count.
- **Link opened / visit**: GET of `/ads-api/v1/out/{creative}/{event UUID}` records
  a visit then sends a 303 to the stored HTTPS destination. HEAD and prefetch
  requests do not count. This confirms the outbound request, not that an external
  page loaded or a sale happened. Declined measurement bypasses this route.

Events use UUIDs for idempotency (bounded POST retry; refresh of the same outbound
URL counts once), server UTC millisecond receipt times and immutable creative IDs.
The server resolves campaign and placement from an active booking, rejects stale
creatives, and caps writes at 100 events/second/process. Rejected, blocked or
network-lost events are not counted; there is no offline queue or durable user ID.
Use these descriptive metrics with their opt-in coverage and visibility limits.

**Advertisement performance** in the Ads admin tab offers a date range (maximum
366 days), campaign and event type filters, totals by campaign/placement, and
individual events in pages of 100. The upper event-ID watermark keeps later
arrivals out while paging/exporting; refresh includes new arrivals. Each query
uses one database snapshot. Times on screen use the administrator's browser zone;
CSV timestamps are explicit UTC. Historical events retain their original creative,
placement and URL even after campaign edits; names reflect the current campaign.

Two CSV downloads open in Excel: **totals** and **individual events**. Exports use
the applied filters and watermark, not unsaved form changes or just the current
page. Detailed exports are capped at 50,000 matching rows and fail with a clear
instruction to narrow the filter instead of silently truncating. CSV is UTF-8 with
a BOM, quoted cells, CRLF rows and formula-injection protection. PDF export is not
implemented. No new external document or analytics dependencies are required.

Staging verification: opt in, view a paid image for a second in 3D/2D/details,
click it, follow its link, and confirm separate counts/times. Repeat a POST with
the same UUID and refresh an outbound URL: counts must not grow. Check a fresh
activation does count; hide the tab, look away, fail the artwork, decline consent,
expire/pause the campaign, and confirm no new measurements. Export a filtered
multi-page report and compare totals and timestamps. Check non-staff/viewer access
is denied. The opt-in disposable MySQL test covers the event write contract.

Local analytics verification: web/admin Svelte checks and production builds pass
within existing asset budgets; measurement tests cover dwell time, visibility,
consent, idempotent retry and renderer handoff. Backend unit/route tests cover
event validation, auth/origin boundaries, body limits, serving gates and safe CSV.
The desktop/393-pixel admin preview supports event filters and pagination without
page overflow. Four web integration tests need sockets disallowed in the local
sandbox; the disposable MySQL test is opt-in and was not run locally. Run it with
`ADMIN_TEST_ADS_URL` pointing at a fresh local `nc_admin_test_*` schema and
`cargo test --manifest-path rust/Cargo.toml -p naijachase-admin mysql_events -- --ignored`.
