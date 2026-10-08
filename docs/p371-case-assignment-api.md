# P3.7.1 frontend API: case assignment and replay

This is the implementation handoff for the case desk and case archive. The
Rust API—not the browser—selects ordinary missions, generates case IDs, tracks
first completions, and decides whether replay is allowed.

## Request conventions

- Development API base URL: `http://127.0.0.1:8080`.
- Browser requests must include `credentials: "include"` so the `nc_session`
  cookie is sent.
- Mutating requests must include `Content-Type: application/json` and an allowed
  `Origin` such as `http://localhost:4173`.
- Do not generate an ordinary `case_id`, select an ordinary `mission_id`, or send
  a random seed from the frontend.

## 1. Load the player's catalogue status

Use this on the case desk and refresh it after a first completion.

```http
GET /v1/cases/catalogue-status
Cookie: nc_session=<opaque-session-cookie>
```

Successful response — `200 OK`:

```json
{
  "published_cases": 1000,
  "completed_cases": 27,
  "unseen_cases": 973,
  "exhausted": false
}
```

The catalogue is dynamic. Display these values instead of assuming that the
game permanently contains 1,000 missions.

## 2. Ask the server for a new ordinary case

```http
POST /v1/cases
Content-Type: application/json
Cookie: nc_session=<opaque-session-cookie>

{}
```

The request body is deliberately empty. The server randomly selects a published
mission the player has never solved and generates the case ID and seed.

Successful response — `201 Created`:

```json
{
  "api_version": "v1",
  "case_id": "case-4e090abc-3fd2-44f7-b695-c9edb1e8902e",
  "state_version": 1,
  "duplicate": false,
  "attempt_kind": "ordinary",
  "state": {
    "mission_id": "NG-M0001",
    "case_dossier": {
      "title": "The Vanishing Carved Ceremonial Staff — The Umuahia Case",
      "stolen_item": "a carved ceremonial staff",
      "premise": "Someone has taken a carved ceremonial staff from Umuahia. The route suggests an artifact theft operation, and the object may be moved again before the week is over.",
      "opening_briefing": "The local case officer seals the scene at Umuahia. Recover a carved ceremonial staff, identify the thief from eight dossier details, and obtain a warrant before the seven-day deadline."
    },
    "difficulty": 2,
    "stage": 0,
    "current_state": "Abia",
    "elapsed": 0,
    "score": 650,
    "career_points": 4200,
    "dossier": {},
    "visited_venues": [],
    "warrant_suspect": null,
    "outcome": null,
    "opening_budget": 35000,
    "balance": 35000,
    "transport_rules_version": 1
  },
  "events": []
}
```

Persist the returned `case_id`; it is required to resume the case and submit
commands. Do not replace it with a browser-generated ID.

`state.case_dossier` is the immutable opening case file shown before gameplay.
`state.dossier` is intentionally a separate map: it begins empty and gains the
eight suspect-profile traits discovered from witnesses. The frontend must not
substitute one for the other.

Catalogue exhausted — `409 Conflict`:

```json
{
  "error": "catalogue_exhausted",
  "message": "all currently published missions are complete; replay an archived case or return when new cases publish"
}
```

This is a successful catalogue milestone, not a generic failure screen. Show a
completion message and links to the archive. New published missions will later
make ordinary assignment available again.

## 3. Load the case archive

```http
GET /v1/progression/archive
Cookie: nc_session=<opaque-session-cookie>
```

Successful response — `200 OK`:

```json
[
  {
    "case_id": "case-f63f5064-acde-4214-9fe2-2f42e2010358",
    "mission_id": "NG-M0007",
    "thief_id": "NG-T014",
    "outcome": "solved",
    "score": 650,
    "elapsed_minutes": 6940,
    "completed_at": "2026-10-07 15:42:19",
    "states_visited": ["Lagos", "Oyo", "Kwara", "Sokoto"],
    "correct_travels": 3,
    "wrong_travels": 0,
    "correct_deductions": 8,
    "wrong_deductions": 0,
    "attempt_kind": "ordinary",
    "first_completion": true
  },
  {
    "case_id": "replay-64989dbe-bf6f-4077-b1ab-fb2e94d175fa",
    "mission_id": "NG-M0007",
    "thief_id": "NG-T014",
    "outcome": "solved",
    "score": 700,
    "elapsed_minutes": 6600,
    "completed_at": "2026-10-09 12:06:51",
    "states_visited": ["Lagos", "Oyo", "Kwara", "Sokoto"],
    "correct_travels": 3,
    "wrong_travels": 0,
    "correct_deductions": 8,
    "wrong_deductions": 0,
    "attempt_kind": "replay",
    "first_completion": false
  }
]
```

Show `Replay case` only for a mission with a successfully solved archive entry.
`first_completion` identifies the original rewarding solve. `attempt_kind`
identifies later replay attempts.

## 4. Start an explicit replay

```http
POST /v1/cases/replay
Content-Type: application/json
Cookie: nc_session=<opaque-session-cookie>

{
  "mission_id": "NG-M0007"
}
```

Successful response — `201 Created`:

```json
{
  "api_version": "v1",
  "case_id": "replay-3d87e073-3849-4ec3-8c8e-c495174dc03e",
  "state_version": 1,
  "duplicate": false,
  "attempt_kind": "replay",
  "state": {
    "mission_id": "NG-M0007",
    "difficulty": 2,
    "stage": 0,
    "current_state": "Lagos",
    "elapsed": 0,
    "score": 650,
    "career_points": 4200,
    "dossier": {},
    "visited_venues": [],
    "warrant_suspect": null,
    "outcome": null
  },
  "events": []
}
```

Replay not allowed — `409 Conflict`:

```json
{
  "error": "replay_not_available",
  "message": "only successfully completed missions can be replayed"
}
```

The frontend must not award points, achievements, tokens, or completion credit.
The server suppresses those rewards for replay attempts.

## 5. Resume either case type

Use the returned ID for an ordinary case or replay:

```http
GET /v1/cases/case-4e090abc-3fd2-44f7-b695-c9edb1e8902e
Cookie: nc_session=<opaque-session-cookie>
```

The response is the same case-response shape and retains `attempt_kind`.
Gameplay commands continue to use:

```http
POST /v1/cases/{case_id}/commands
```

## Required frontend changes

Witness order is not evidence order. At each stop exactly one of the three
available witnesses carries the suspect-description hint, and its venue is
selected deterministically by the server for that case. The eight dossier
fields are also shuffled per case. Never label the first card as the dossier
witness or predict the next field in the browser; render the returned witness
account and current case state.

1. Remove the fixed mission-number input, “next mission” calculation, and
   browser-side random mission selection.
2. Make the ordinary `Open case` action call `POST /v1/cases` with `{}`.
3. Save the server-returned `case_id` and render the returned case state.
4. Load case-desk totals from `GET /v1/cases/catalogue-status`.
5. Add `Replay case` to solved archive missions and call
   `POST /v1/cases/replay` with that mission ID.
6. Visually label replay attempts and results using `attempt_kind`.
7. Treat `catalogue_exhausted` as a completion state and
   `replay_not_available` as an archive-state conflict.

The formal source of truth remains `schemas/openapi-v1.json`. Shared frontend
types are generated in `contracts/typescript/api-v1.ts`.
