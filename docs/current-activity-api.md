# Current activity API: ordinary cases, replays, and weekly challenges

This is the canonical frontend handoff for discovering everything the signed-in
player can currently resume. New case-desk implementations should use this
endpoint instead of guessing from browser storage.

## What this endpoint answers

`GET /v1/activity/current` returns three independent activity lanes:

1. The player's unfinished ordinary case, if one exists.
2. Every unfinished replay attempt.
3. Every active or in-transit weekly-challenge attempt whose challenge window
   is still open.

The three modes can coexist. A player may have an ordinary case, one or more
replays, and one or more weekly attempts simultaneously. The endpoint does not
pick one as the globally "current" game.

## Authentication and URLs

The endpoint requires the secure `nc_session` cookie created by login. Browser
requests must include credentials.

| Caller | URL |
| --- | --- |
| Browser through Vite/Nginx | `/api/v1/activity/current` |
| Direct local API call | `http://127.0.0.1:8080/v1/activity/current` |

Use the typed client:

```ts
const activity = await api.currentActivity();
```

Raw browser equivalent:

```ts
const response = await fetch("/api/v1/activity/current", {
  credentials: "include"
});

if (!response.ok) throw await response.json();
const activity = await response.json();
```

Local command-line example, assuming login saved the cookie in `cookies.txt`:

```bash
curl -sS \
  --cookie cookies.txt \
  http://127.0.0.1:8080/v1/activity/current | jq
```

## Complete response example

Status: `200 OK`

```json
{
  "has_ongoing_activity": true,
  "ordinary_case": {
    "api_version": "v1",
    "case_id": "case-0f42cbdc-e497-4119-8c17-4283fb3795e6",
    "state_version": 7,
    "duplicate": false,
    "attempt_kind": "ordinary",
    "state": {
      "mission_id": "NG-M0007",
      "case_dossier": {
        "title": "The Missing Bronze Plaque — The Lagos Case",
        "stolen_item": "a ceremonial bronze plaque",
        "premise": "A ceremonial bronze plaque disappeared before an exhibition opened.",
        "opening_briefing": "Recover the plaque, identify the thief from eight dossier details, and obtain a warrant before the seven-day deadline."
      },
      "difficulty": 3,
      "stage": 2,
      "current_state": "Kano",
      "trail_status": "hot",
      "elapsed": 965,
      "score": 640,
      "career_points": 1200,
      "dossier": { "sex": "male", "vehicle": "a silver saloon" },
      "visited_venues": ["market", "motor_park"],
      "warrant_suspect": null,
      "outcome": null,
      "opening_budget": 35000,
      "balance": 27100,
      "transport_rules_version": 1
    },
    "events": []
  },
  "replay_cases": [
    {
      "api_version": "v1",
      "case_id": "replay-e4cb870a-3ccb-4c82-a124-c6903d4868fb",
      "state_version": 3,
      "duplicate": false,
      "attempt_kind": "replay",
      "state": {
        "mission_id": "NG-M0001",
        "case_dossier": {
          "title": "The Vanishing Carved Ceremonial Staff — The Umuahia Case",
          "stolen_item": "a carved ceremonial staff",
          "premise": "Someone has taken a carved ceremonial staff from Umuahia.",
          "opening_briefing": "Recover the staff and identify the thief before the seven-day deadline."
        },
        "difficulty": 1,
        "stage": 0,
        "current_state": "Abia",
        "trail_status": "hot",
        "elapsed": 0,
        "score": 500,
        "career_points": 1200,
        "dossier": {},
        "visited_venues": [],
        "warrant_suspect": null,
        "outcome": null,
        "opening_budget": 28000,
        "balance": 28000,
        "transport_rules_version": 1
      },
      "events": []
    }
  ],
  "weekly_attempts": [
    {
      "attempt_id": "0af673ea-c1a8-4ef8-975e-a582eaab8064",
      "challenge_id": "0a3fbf26-13d4-42df-b130-003ff8730a7e",
      "status": "in_transit",
      "state_version": 4,
      "state": {
        "mission_id": "NG-M0312",
        "case_dossier": {
          "title": "The Missing Festival Mask — The Calabar Case",
          "stolen_item": "a festival mask",
          "premise": "A festival mask vanished shortly before a public procession.",
          "opening_briefing": "Recover the mask and identify the thief before the weekly challenge closes."
        },
        "difficulty": 4,
        "stage": 1,
        "current_state": "Cross River",
        "trail_status": "hot",
        "elapsed": 125,
        "score": 780,
        "career_points": 1200,
        "dossier": { "height": "tall" },
        "visited_venues": ["seaport"],
        "warrant_suspect": null,
        "outcome": null,
        "opening_budget": 42000,
        "balance": 35400,
        "transport_rules_version": 1
      },
      "starts_at": "2026-10-05T06:00:00Z",
      "ends_at": "2026-10-12T06:00:00Z",
      "winner": false,
      "transit": {
        "destination": "Kano",
        "mode": "drive",
        "remaining_seconds": 3812
      }
    }
  ]
}
```

## Empty response

When nothing is resumable:

```json
{
  "has_ongoing_activity": false,
  "ordinary_case": null,
  "replay_cases": [],
  "weekly_attempts": []
}
```

This is a successful response, not an error.

## Top-level fields

| Field | Type | Meaning |
| --- | --- | --- |
| `has_ongoing_activity` | boolean | `true` when any other field contains a resumable activity. |
| `ordinary_case` | case or `null` | At most one unfinished ordinary case. |
| `replay_cases` | case array | Every unfinished replay, newest first. Multiple entries are possible. |
| `weekly_attempts` | weekly-attempt array | Every currently resumable weekly attempt, newest first. |

Do not assume only one top-level lane can be populated.

## Ordinary and replay case fields

Both use the same `CaseResponse` shape.

| Field | Meaning |
| --- | --- |
| `case_id` | Runtime attempt ID used in `/v1/cases/{case_id}` requests. |
| `state_version` | Current optimistic-concurrency version. Send it as `expected_version` on the next command. |
| `duplicate` | Always `false` for discovery reads. It has special meaning only on case creation. |
| `attempt_kind` | `ordinary` in `ordinary_case`; `replay` in `replay_cases`. |
| `state` | Current player-safe `PublicGameState`. |
| `events` | Empty on discovery. Command responses may contain animation events. |

An ordinary case or replay remains here while `state.outcome` is `null`.
Solved, failed, timed-out, or otherwise terminal cases are omitted.

### PublicGameState

| Field | Meaning |
| --- | --- |
| `mission_id` | Stable content ID. Different attempts may share this ID. |
| `case_dossier` | Opening title, stolen item, premise, and briefing. |
| `difficulty` | Mission difficulty. |
| `stage` | Current investigation-route stage. |
| `current_state` | Current state/FCT jurisdiction. |
| `trail_status` | `hot` when the player is on the active route; `cold` after travelling to a wrong jurisdiction. This is authoritative and safe to display. |
| `elapsed` | Simulated gameplay minutes. Weekly wall-clock transit is separately represented by `transit`. |
| `score` | Attempt score. |
| `career_points` | Career points represented in this snapshot. |
| `dossier` | Earned suspect traits. Empty at the beginning is valid. |
| `visited_venues` | Venue IDs visited at the current route stage. |
| `warrant_suspect` | Suspect named on the warrant, or `null`. |
| `outcome` | `null` for every case returned by this endpoint. |
| `opening_budget` | Starting virtual-money allocation. |
| `balance` | Remaining virtual money. |
| `transport_rules_version` | Fare/time ruleset pinned to the attempt. |

The server excludes the hidden route, final destination, thief identity, and
unearned clues from `PublicGameState`.

At a cold location, local-venue quotes still expose three locally valid places
to investigate, but every `witness_account` is a neutral English response such
as “I have not seen anyone matching that description.” Cold-location accounts
never contain a destination clue or dossier trait. The travel command also emits
`arrived_on_trail` with `data.trail_status = "hot"`, or `false_destination` with
`data.trail_status = "cold"`. Render this result immediately and retain the
state-level status after refresh or login.

## Weekly-attempt fields

| Field | Meaning |
| --- | --- |
| `attempt_id` | Runtime weekly attempt ID. Use this—not `case_id`—for weekly commands. |
| `challenge_id` | Shared group challenge ID used for standings, events, and details. |
| `status` | Only `active` or `in_transit` appears here. |
| `state_version` | Expected version for the next weekly command. |
| `state` | Same player-safe game-state shape used by ordinary cases. |
| `starts_at` | Challenge start in UTC. |
| `ends_at` | Challenge deadline in UTC. |
| `winner` | Normally `false` for a resumable attempt; completed winner information belongs in history views. |
| `transit` | Current real-time journey, or `null` when the player may act immediately. |

### Weekly transit

| Field | Meaning |
| --- | --- |
| `destination` | Destination for the journey in progress. |
| `mode` | `fly`, `drive`, or `hitch_ride`. |
| `remaining_seconds` | Server-calculated wall-clock seconds remaining. It is a display snapshot, not client authority. |

The endpoint reconciles an arrival whose server deadline has passed before
responding. After arrival, it returns `status: "active"`, `transit: null`, and
the updated state/version. During travel, render the journey and disable
commands that require arrival.

Weekly attempts are omitted when solved, closed by another winner, expired,
forfeited, outside the challenge window, or attached to a challenge that is no
longer open. Completed challenge history comes from weekly-history APIs.

## Frontend decision table

| Returned state | Recommended UI |
| --- | --- |
| All lanes empty | Show **Start new case** and normal group/challenge discovery. |
| `ordinary_case` populated | Show **Resume ordinary case** using its dossier title. |
| One or more `replay_cases` | Show one resume card per replay and label each as a replay. |
| Weekly `status: active` | Show **Resume weekly challenge**. |
| Weekly `status: in_transit` | Show the journey scene, destination, server-derived countdown, and an option to return to the ordinary case. |
| Multiple lanes populated | Show all lanes. Never discard one because another exists. |

Suggested bootstrap:

```ts
const activity = await api.currentActivity();

caseDesk.set({
  ordinary: activity.ordinary_case,
  replays: activity.replay_cases,
  weekly: activity.weekly_attempts
});

if (!activity.has_ongoing_activity) {
  clearStaleRememberedAttemptIds();
}
```

Refresh this endpoint:

- immediately after login;
- when the case desk opens or regains focus;
- after reconnecting;
- after starting or finishing any attempt;
- when a weekly transit countdown reaches zero;
- after a command returns a version conflict.

Do not poll it every second for countdown animation. Animate locally from
`remaining_seconds`, then refresh at zero and when restoring a backgrounded
page. The server remains authoritative.

Current web client: [`web/src/state/app.svelte.ts`](../web/src/state/app.svelte.ts)
calls this endpoint after login and on page load (`syncCurrentCase`). The desk's
single **Resume case** button targets the case this tab already had open if the
server still lists it, otherwise `ordinary_case`, otherwise the newest replay
(`resumableCase` in `web/src/domain/model.ts`). A stale remembered `case_id` is
cleared only on a successful empty response, never on an HTTP error.

## Which ID goes where

| Activity | Runtime ID | Resume/state endpoint | Command endpoint |
| --- | --- | --- | --- |
| Ordinary case | `case_id` | `GET /v1/cases/{case_id}` | `POST /v1/cases/{case_id}/commands` |
| Replay | `case_id` | `GET /v1/cases/{case_id}` | `POST /v1/cases/{case_id}/commands` |
| Weekly attempt | `attempt_id` | `GET /v1/weekly/attempts/{attempt_id}` | `POST /v1/weekly/attempts/{attempt_id}/commands` |
| Weekly shared view | `challenge_id` | `GET /v1/weekly/{challenge_id}` | Not a gameplay command target |

Do not send `mission_id` as a runtime attempt ID. It identifies reusable case
content, not the player's current attempt.

## Relationship with `/v1/cases/current`

The narrower endpoint still exists and returns:

```json
{
  "has_ongoing_case": true,
  "case": {}
}
```

It sees only the ordinary case. It cannot tell whether replays or weekly
attempts exist. Use it only on screens deliberately limited to ordinary cases.
New case-desk bootstrap code should call `api.currentActivity()`.

## Errors

| Status | Meaning | Frontend action |
| --- | --- | --- |
| `401` | Session missing, expired, revoked, or invalid. | Return to login and clear authenticated application state. |
| `429` | Rate limit reached. | Back off and show a retry-later message. |
| `500`/`503` | API or database unavailable. | Keep the last known UI state, mark it stale, and offer retry. Do not display an empty desk. |

Error body:

```json
{
  "error": "stable_machine_code",
  "message": "Safe message for display or logging"
}
```

An HTTP error is not equivalent to `has_ongoing_activity: false`.

## Security and state rules

- The session cookie identifies the player; the request accepts no `player_id`.
- The response contains only attempts owned by that player.
- Browser storage is not a source of truth.
- Never display or log raw cookies.
- Never infer hidden mission data absent from `PublicGameState`.
- Always use the returned `state_version` for the next mutation.
- Weekly time comes from the server, never the device clock.

## Related contracts

- Ordinary-only guide: [`docs/current-case-api.md`](current-case-api.md)
- JSON Schema: [`schemas/api-current-activity-v1.schema.json`](../schemas/api-current-activity-v1.schema.json)
- Case response schema: [`schemas/api-case-response-v1.schema.json`](../schemas/api-case-response-v1.schema.json)
- OpenAPI: [`schemas/openapi-v1.json`](../schemas/openapi-v1.json)
- TypeScript contracts: [`contracts/typescript/api-v1.ts`](../contracts/typescript/api-v1.ts)
- Typed frontend client: [`web/src/api/api.ts`](../web/src/api/api.ts)
