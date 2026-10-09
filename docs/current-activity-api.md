# Current activity endpoint — frontend handoff

Use this authenticated endpoint after login and whenever the case desk regains
focus. It is the authoritative inventory of every activity the player can
resume; browser storage is only a navigation convenience.

## Request

```http
GET /api/v1/activity/current
Cookie: nc_session=<current session>
```

## Response

```json
{
  "has_ongoing_activity": true,
  "ordinary_case": {
    "api_version": "v1",
    "case_id": "case-...",
    "state_version": 7,
    "duplicate": false,
    "attempt_kind": "ordinary",
    "state": {},
    "events": []
  },
  "replay_cases": [
    {
      "api_version": "v1",
      "case_id": "replay-...",
      "state_version": 3,
      "duplicate": false,
      "attempt_kind": "replay",
      "state": {},
      "events": []
    }
  ],
  "weekly_attempts": [
    {
      "attempt_id": "...",
      "challenge_id": "...",
      "status": "in_transit",
      "state_version": 4,
      "state": {},
      "starts_at": "2026-10-05T23:00:00Z",
      "ends_at": "2026-10-12T23:00:00Z",
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

The `state` objects above are abbreviated. Production responses contain the
complete `PublicGameState`, including the opening dossier.

`ordinary_case` is either one resumable case or `null`. `replay_cases` and
`weekly_attempts` are arrays because a player can have more than one independent
replay or group challenge. Only weekly attempts whose challenge is currently
open and whose status is `active` or `in_transit` are returned. Completed,
closed, expired, and forfeited attempts are excluded. Any completed real-time
arrival is reconciled before the response is returned.

## Frontend behaviour

Call `api.currentActivity()` after authentication. Render a separate resume
action for each non-empty lane:

- `ordinary_case`: Resume current case.
- `replay_cases`: Resume replay, labelled by its dossier title.
- `weekly_attempts`: Resume weekly challenge; when `status` is `in_transit`,
  show the server-provided remaining time and travel scene.

When `has_ongoing_activity` is false, all three lanes are empty. Do not infer
activity from `sessionStorage`, a remembered ID, or catalogue totals.

`GET /v1/cases/current` remains available as the narrower ordinary-case-only
compatibility endpoint. New case-desk code should prefer this endpoint.
