# Current ordinary case API

This document explains the ordinary-case-only endpoint. For a complete case
desk that also discovers replays and weekly challenges, use the unified
[`GET /v1/activity/current`](current-activity-api.md) endpoint instead.

## What this endpoint answers

`GET /v1/cases/current` answers exactly one question:

> Does the authenticated player have an unfinished ordinary case, and if so,
> what is its current authoritative public state?

It does not return replay attempts or weekly-challenge attempts. It exists for
simple ordinary-case screens and compatibility with older clients.

An ordinary case is ongoing when it belongs to the signed-in player, has
`attempt_kind: "ordinary"`, and its game-state `outcome` is `null`.

## Authentication and URLs

The endpoint uses the secure `nc_session` cookie issued by login. Browser code
must send credentials. Do not put a token in JavaScript, localStorage, an
Authorization header, or the query string.

| Caller | URL |
| --- | --- |
| Browser through the Vite/Nginx proxy | `/api/v1/cases/current` |
| API client calling Rust directly | `http://127.0.0.1:8080/v1/cases/current` |

The TypeScript client applies the `/api` proxy prefix and sends cookies:

```ts
const result = await api.currentCase();
```

Raw browser equivalent:

```ts
const response = await fetch("/api/v1/cases/current", {
  credentials: "include"
});
const result = await response.json();
```

Local command-line example, assuming login previously saved the session cookie
in `cookies.txt`:

```bash
curl -sS \
  --cookie cookies.txt \
  http://127.0.0.1:8080/v1/cases/current | jq
```

## Response when an ordinary case exists

Status: `200 OK`

```json
{
  "has_ongoing_case": true,
  "case": {
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
      "elapsed": 965,
      "score": 640,
      "career_points": 1200,
      "dossier": {
        "sex": "male",
        "vehicle": "a silver saloon"
      },
      "visited_venues": ["market", "motor_park"],
      "warrant_suspect": null,
      "outcome": null,
      "opening_budget": 35000,
      "balance": 27100,
      "transport_rules_version": 1
    },
    "events": []
  }
}
```

## Response when no ordinary case exists

Status: `200 OK`

```json
{
  "has_ongoing_case": false,
  "case": null
}
```

This is normal, not an error. The frontend may offer **Start new case**. It
says nothing about replays or weekly challenges; query `/v1/activity/current`
when those matter.

## Field reference

### Envelope

| Field | Meaning |
| --- | --- |
| `has_ongoing_case` | `true` exactly when `case` is non-null. |
| `case` | Complete resumable ordinary case, or `null`. |

### Case

| Field | Meaning |
| --- | --- |
| `api_version` | Response-contract version. Currently `v1`. |
| `case_id` | Runtime attempt ID for case commands and state requests. It is not the mission ID. |
| `state_version` | Optimistic-concurrency version. Send this as `expected_version` with the next command and replace it after every successful response. |
| `duplicate` | `false` on this read endpoint. On `POST /v1/cases`, `true` means the server returned an existing case instead of creating another. |
| `attempt_kind` | Always `ordinary` here. |
| `state` | Player-safe state. Hidden routes, solutions, thief identity, and unearned clues are excluded. |
| `events` | Empty on discovery reads. Command responses may contain renderer-neutral events. |

### Public game state

| Field | Meaning |
| --- | --- |
| `mission_id` | Stable content ID used for archive and replay operations. |
| `case_dossier` | Opening narrative shown when the case begins. It is separate from the suspect-trait notebook. |
| `difficulty` | Mission difficulty level. |
| `stage` | Current investigation-route stage. |
| `current_state` | Current Nigerian state/FCT jurisdiction. |
| `elapsed` | Simulated ordinary-case minutes elapsed, not wall-clock time. |
| `score` | Current attempt score. |
| `career_points` | Career points represented by this state snapshot. Refresh progression separately after completion. |
| `dossier` | Suspect traits earned so far. It correctly begins as `{}`. |
| `visited_venues` | Venue IDs already visited at the current stage. |
| `warrant_suspect` | Suspect ID after a warrant is obtained; otherwise `null`. |
| `searched_hideouts` | Hideout venue IDs already searched and found empty. A repeat `search_hideout` for one of them is rejected (422). |
| `outcome` | `null` while ongoing. Terminal attempts are not returned here. |
| `opening_budget` | Virtual-money allocation at case start. |
| `balance` | Remaining virtual money. |
| `transport_rules_version` | Fare/time ruleset pinned to this attempt. |

`case_dossier` is the opening case briefing. `dossier` is the evidence notebook.
Do not hide the opening briefing merely because `dossier` is initially empty.

## Required frontend behaviour

After authentication:

1. Prefer `api.currentActivity()` for the complete case desk.
2. If this narrower endpoint is used and `case` is non-null, adopt the returned
   object and show **Resume current case**.
3. If `case` is null, remove any stale ordinary `case_id` from browser storage
   and show **Start new case**.
4. On resume, use the returned `state_version`, not a cached version.
5. Refresh after a command conflict, reconnect, tab restoration, login on a new
   device, or return to the case desk.

Browser storage may remember navigation intent, but it is never authoritative.

## Relationship with case creation

```http
POST /api/v1/cases
Content-Type: application/json

{}
```

- With no ordinary case, the server creates one and returns `201 Created` with
  `duplicate: false`.
- With an existing ordinary case, it returns that case with `200 OK` and
  `duplicate: true`.
- Repeated clicks, reconnects, or two tabs therefore do not intentionally
  create a second ordinary case.

Replay creation is separate (`POST /v1/cases/replay`). Weekly participation is
also separate (`POST /v1/weekly/{challenge_id}/attempt`).

## Errors

| Status | Meaning | Frontend action |
| --- | --- | --- |
| `401` | Missing, expired, revoked, or invalid session. | Return to login and clear authenticated application state. |
| `429` | Request rate limit reached. | Show a neutral retry-later message and back off. |
| `500`/`503` | Server or dependency unavailable. | Preserve current UI state and offer retry; do not pretend no case exists. |

Error bodies use:

```json
{
  "error": "stable_machine_code",
  "message": "Safe message for display or logging"
}
```

Do not interpret an HTTP error as `{ "has_ongoing_case": false }`.

## Related contracts

- Unified discovery: [`docs/current-activity-api.md`](current-activity-api.md)
- JSON Schema: [`schemas/api-current-case-v1.schema.json`](../schemas/api-current-case-v1.schema.json)
- Case response schema: [`schemas/api-case-response-v1.schema.json`](../schemas/api-case-response-v1.schema.json)
- OpenAPI: [`schemas/openapi-v1.json`](../schemas/openapi-v1.json)
- TypeScript client: [`web/src/api/api.ts`](../web/src/api/api.ts)
