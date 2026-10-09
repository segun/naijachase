# UI API handoff

Private groups and real-time weekly challenges are documented in [`p381-groups-weekly-api.md`](p381-groups-weekly-api.md).

Cooperative-investigation requests, responses, privacy rules, and UI acceptance criteria are in [`p38-cooperation-api.md`](p38-cooperation-api.md).

Mission budgets and fly/drive/hitch transport have complete requests and responses in [`p373-mission-budget-transport-api.md`](p373-mission-budget-transport-api.md). The frontend must consume server quotes and must not calculate fares or durations.

The authoritative contract is `schemas/openapi-v1.json`. Stable TypeScript
DTOs generated from that contract are in `contracts/typescript/api-v1.ts`.
The UI may copy or import those types, but must not redefine response shapes.

## Hot and cold trail handling

Use `state.trail_status` as the authoritative location status on ordinary,
replay, and weekly attempts. It is always `"hot"` or `"cold"`; do not infer it
from the route stage or witness wording.

After `travel`, inspect the command events as immediate animation/toast cues:

- `arrived_on_trail`, with `data.trail_status = "hot"`: show that the trail is hot.
- `false_destination`, with `data.trail_status = "cold"`: show that the trail has gone cold.

The persistent status comes from `state.trail_status`, including after refresh.
The server still returns three locally appropriate witness venues at a cold
location. Their `witness_account` events have `data.trail_status = "cold"` and
neutral messages only. Display or animate the returned account exactly as any
other witness response. Never substitute a cached account from the previous
location; key witness state must be keyed by the current command response and
`current_state`.

The web development mock follows the same hot/cold contract for ordinary and
replay cases, including three neutral witness replies at wrong destinations.
The case HUD, office terminal, and weekly attempt panel display the persistent
status. Ordinary/replay travel feedback falls back to `state.trail_status` when
no travel event is returned. Changing location clears pending witness scenes
and old transport quotes while the new location's leads load; new interviews
use only that command's returned dialogue. Regression coverage
is in `web/tests/trail-parity.test.mjs` and
`web/tests/mock-case-lifecycle.test.mjs`.

## Seven-day deadline

The Rust engine is authoritative for the 10,080-minute simulated deadline. If a
command begins when the deadline has already passed, or the command itself
advances the clock to or beyond the deadline, the command response contains:

- `state.outcome = "deadline"`;
- a `deadline_expired` event with `elapsed_minutes` and `deadline_minutes`;
- the terminal case state persisted by the server and recorded as a completed
  failed attempt.

Do not leave the player on an interactive case screen when this response
arrives. Show the timeout dialog immediately: “You're out of time. The seven-day
deadline has passed and the suspect has escaped.” Offer **Start new case**, which
uses the normal `POST /v1/cases {}` assignment flow, and **Close**, which clears
the finished local case selection and returns to the case desk. A refresh must
not resurrect the expired attempt as an ongoing case.

All browser requests use `credentials: "include"`. Production mutations must
originate from an entry in `NAIJACHASE_ALLOWED_ORIGINS`; a different or missing
`Origin` is rejected. Passwords and session tokens must never enter browser
storage.

## Account flow

1. Register with `POST /v1/auth/register`.
2. Cloudflare sends `/?confirm=<token>`; submit the token to
   `POST /v1/auth/confirm`.
3. Log in with `POST /v1/auth/login`. The response sets the HttpOnly cookie.
4. Load the account with `GET /v1/auth/me`.
5. Rotate the 24-hour session with `POST /v1/auth/refresh`; the response replaces
   the cookie. Treat a 401 as signed out.
6. Use `POST /v1/auth/logout` for this device or `/v1/auth/logout-all` for every
   device.

Registration example:

```json
{"email":"ada@example.com","username":"agent_ada","home_base":"Abia","password":"a-long-passphrase","confirm_password":"a-long-passphrase"}
```

## Recovery

`POST /v1/auth/recovery/request` always returns the same message, including for
unknown addresses. The emailed `/?reset=<token>` value is submitted with the
new password to `/v1/auth/recovery/complete`. Success revokes every session.

## Profile and devices

`GET /v1/profile` returns the same public player shape as `/v1/auth/me`.
`PUT /v1/profile` accepts optional identity/cosmetic fields plus `home_base` and
`leaderboard_opt_in`. `GET /v1/auth/sessions` returns safe public session IDs;
delete `/v1/auth/sessions/{session_id}` to revoke one. Token hashes are never
returned.

## Progression

`GET /v1/progression/summary` is the dashboard source. It includes points,
current rank, solved-case count, visited jurisdictions, travel/deduction
accuracy, earned achievements and rank history. `/archive` supplies completed
cases. `/achievement-catalog` supplies display names and descriptions.

Progression is server-derived from committed command replay. The browser must
never calculate or submit points, achievements, travel accuracy, deductions,
rank changes or home-base discounts.

## P3.7.1 frontend handoff — assignment and replay

Complete copy-ready request and response examples are documented in
`docs/p371-case-assignment-api.md`. Use that guide for implementation and this
section only as the architectural summary.

Every `CaseResponse.state` contains two intentionally separate values:
`case_dossier` is the immutable opening presentation (`title`, `stolen_item`,
`premise`, and `opening_briefing`) and should be shown when the case opens;
`dossier` is the mutable suspect-trait notebook, so it correctly starts as `{}`
and fills from witness evidence. Never use the empty trait notebook as the
opening-case display.

The continuous-release player notifications and restricted editorial dashboard
contract are documented separately in `docs/p372-continuous-catalogue-api.md`.

The suspect dossier is selection-based, not free text. Fetch the authenticated
`GET /v1/dossier/options` catalogue and use its eight fields and canonical
values in both ordinary and weekly dossier editors. Full request, response, and
UI handling details are in `docs/dossier-options-api.md`.

The old mission picker is no longer authoritative. Replace calls that send
`case_id`, `mission_id`, or `seed` to `POST /v1/cases` with an empty JSON object;
the server returns the generated case ID and an unseen mission. Remove the fixed
1–1,000 picker, client-side `randomMission`, and client-side exhaustion logic.

After login, call `GET /v1/activity/current` instead of relying on IDs in
browser storage. It returns the complete resumable ordinary case, every active
replay, and every active or in-transit weekly attempt. `POST /v1/cases` also
reuses an ongoing ordinary case. The complete contracts are in
`docs/current-activity-api.md` and `docs/current-case-api.md`.

Show a confirmed **Abandon case** action only for an unfinished ordinary case.
Call `POST /v1/cases/{case_id}/abandon` with the latest `expected_version`, then
refresh current activity, progression, and catalogue status before offering a
new case. Never expose it for replays or weekly attempts. Complete destructive
confirmation copy, responses, races, and errors are in
`docs/abandon-case-api.md`.

Add a `Replay case` action to successfully solved archive entries. It calls
`POST /v1/cases/replay` with `{ "mission_id": "NG-M0001" }`. Display replay
attempts using `attempt_kind === "replay"` and use `first_completion` to mark the
original solve. Replays may update personal-best history but never award the
first-completion rewards again.

Handle `409 catalogue_exhausted` as a positive catalogue-completion state with
links to the archive and notification settings—not as a generic error. The
catalogue is dynamic, so never hard-code 1,000 as its permanent size.
Use `GET /v1/cases/catalogue-status` for the case-desk totals and exhaustion
state; refresh it after a first completion and when returning to the case desk.

## Errors

Non-success responses use `{ "error": "stable_code", "message": "safe text" }`.
Handle 401 by returning to login, 403 as denied/unconfirmed/CSRF failure, 409 as
conflict, 422 as rejected gameplay intent, and 429 with a neutral retry-later
message. Do not infer account existence from recovery responses.
