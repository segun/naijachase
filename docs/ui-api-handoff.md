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

## Three-clue difficulty structure

Every on-trail stop now returns a deliberately structured set of three witness
accounts:

- two ambiguous clues whose catalogue candidate sets each contain multiple
  jurisdictions;
- one decisive landmark clue intended to identify the destination on its own.

The decisive clue is shuffled among the three venues, so the UI must not assume
it is the third displayed witness. It is never the key witness and never carries
the new suspect-profile trait. The key witness is selected deterministically
from the two ambiguous-clue witnesses and remains the only interview required
by the engine before onward travel. Consequently, a player who investigates the
decisive clue first still has to locate the key witness, while a player who finds
the key witness first may travel immediately.

Do not label clues as “ambiguous”, “decisive”, or “key” in the player UI. Those
roles exist to shape deduction and progression, not to reveal the solution.

## Hire Assistant

This is an ordinary-case feature and is not available in weekly challenges.
The case state supplies `assistant_available`, `assistant_hired`, and
`assistant_cost`. Show **Hire Assistant** only while `assistant_available` is
true. The server makes it true only when the player is above Rookie rank, the
case is unfinished, no assistant is already active, and no witness has yet been
questioned. It becomes false permanently for that attempt after the first
interview.

The confirmation must say that the assistant will automatically file suspect
dossier evidence, suggest three possible onward routes, and make local witness
journeys quicker. Do not display or describe the internal travel-time percentage.
Display the server-provided `assistant_cost`, which is one-third of the opening
case allocation, rounded up to the nearest whole naira and paid from the case
balance.

Hire through the normal idempotent command endpoint:

```json
{
  "command_id": "assistant-01",
  "expected_version": 1,
  "command": { "type": "hire_assistant" }
}
```

On success, refresh state, quotes, and the ledger. Subsequent key-witness
responses cause the backend to add the observed trait directly to `state.dossier`;
the browser must not infer or submit that value itself. Local witness quotes
already contain the adjusted authoritative duration.

When the player asks for route advice, call
`GET /v1/cases/{case_id}/assistant/routes`. It returns
`{ "suggestions": ["State A", "State B", "State C"] }`; exactly one suggestion
is the correct next destination. Present all three neutrally. A 403 means no
assistant is active. At the final stop, `suggestions` is empty.

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

## Exhausted case funds

Transport quotes are authoritative. Disable every quote whose `affordable` is
`false`. When `state.balance` is zero, Fly and Drive must be disabled everywhere:
interstate travel, local witness visits, and the final hideout journey. Keep
Hitch a ride enabled because its fare is zero, although its longer duration may
still exhaust the case deadline. Weekly challenge screens currently have no
separate quote endpoint, so they must select Hitch a ride automatically and
disable their Fly/Drive radio controls whenever the attempt balance reaches zero.

Frontend disabling is only presentation. The Rust engine independently rejects
any Fly or Drive command at zero balance, and rejects any transport command whose
server-calculated fare exceeds the current balance, with
`insufficient case budget; hitch a ride instead`. Never treat a disabled button
as the security boundary.

## Final witness, warrant candidates, and hideout search

At the final stop, the player may proceed as soon as the key witness has been
questioned. The other two witnesses remain available but are optional. The API
enforces the key-witness rule for both `request_warrant` and `search_hideout`;
the frontend must not require three completed interviews.

Once all eight dossier fields are filled at the final stop,
`state.suspect_files` contains exactly three server-selected candidates. Each
entry contains `suspect_id`, `name`, `alias`, the complete eight-field
`dossier`, a backend-written `summary`, and a procedural `portrait` descriptor:

```json
{
  "suspect_id": "NG-T042",
  "name": "Example Name",
  "alias": "The Example",
  "dossier": {
    "sex": "female",
    "height": "tall",
    "skin_tone": "dark-skinned",
    "hair": "long braided hair",
    "hobby": "tennis",
    "vehicle": "a silver saloon",
    "accessory": "a leather briefcase",
    "feature": "quotes old proverbs"
  },
  "summary": "Backend-authored suspect summary.",
  "portrait": {
    "skin_color": "#57351f",
    "hair_style": "long braided hair",
    "hair_color": "#15120f",
    "background_color": "#315f6b",
    "presentation": "female"
  }
}
```

Render `portrait` locally as a consistent passport-style avatar; it is a visual
descriptor, not an image URL. The warrant page shows only `name`, `alias`,
`portrait` and `summary` for each candidate; the `dossier` field stays in the
payload but is not displayed. Do not invent or hard-code candidates. The real
thief and both decoys are included, and each decoy differs from the real profile
in only one or two dossier fields. Send the selected `suspect_id` in the normal
`request_warrant` command.

After a warrant is issued, the apprehension section of
`GET /v1/cases/{case_id}/transport-quotes` contains exactly five possible
hideouts, including the real hideout. Only offer those five locations. Empty
hideouts keep the case active. If the player reaches the real hideout with the
wrong warrant, the command returns `state.outcome = "escaped"`, a
`wrong_warrant` event containing `thief_name` and `thief_alias`, and no reward.
Show a terminal dialog explaining that the named real thief avoided arrest due
to the wrong warrant. Offer **Start new case** and **Close**, matching the
deadline dialog. `state.resolved_thief_name` is populated only for a terminal
outcome and is safe to use after refresh.

The server persists the final score, correct/wrong travel totals,
correct/wrong deductions, and visited-state count for every terminal outcome,
not only successful arrests. Archive and progression screens must display the
returned values and must not replace failed-case statistics with zeroes.

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
