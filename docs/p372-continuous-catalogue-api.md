# P3.7.2 API handoff: continuous case catalogue

This guide covers the player-facing new-case notifications and the restricted
content-operations API. Newly imported missions start as drafts. They do not
enter random assignment until an authorised publisher validates and publishes
or schedules them.

All requests use the authenticated `nc_session` cookie. Mutations also require
an allowed browser `Origin` and `Content-Type: application/json`.

## Roles

- `player`: no content access.
- `editor`: view mission details and validation; move drafts into or out of
  editorial review.
- `publisher`: editor access plus validation, scheduling, publishing, rollback,
  and retirement.
- `admin`: full content access.

Roles are server-side account properties. They must never be selected or sent
by the browser. Initial publishers are provisioned by a database administrator.
The restricted dashboard can discover the current role with
`GET /v1/admin/catalogue/me`; ordinary players receive `403 Forbidden`.

## Content preparation

Authors add the mission and narrative to the repository content files, run the
normal validation and simulation gates, and run `make db-import`. A previously
unknown mission is imported as `draft`; reimporting an existing mission does not
silently publish it or reset its lifecycle.

The service reads a published mission's runtime fields directly from MySQL.
Publishing therefore makes a validated case assignable without rebuilding,
redeploying, or restarting the API.

Ordinary assignment remains unpredictable while favouring fresh content: 70%
of assignments draw from the newest 20% of that player's unseen catalogue and
30% draw from their entire unseen catalogue. Completed missions are excluded
before weighting.

The initial editorial cadence is Monday at 06:00 WAT, targeting 25 validated
missions per batch with a minimum of 10. An audited midweek reserve release is
allowed when any player drops below 25 unseen cases. These targets never permit
the team to bypass validation; they can be recalibrated after real completion
velocity is available.

## 1. Catalogue health

```http
GET /v1/admin/catalogue/health
Cookie: nc_session=<editor-publisher-or-admin-session>
```

`200 OK`:

```json
{
  "draft": 8,
  "editorial_review": 4,
  "validated": 21,
  "scheduled": 10,
  "published": 1000,
  "retired": 2,
  "exhausted_players": 0,
  "minimum_unseen_cases": 683,
  "reserve_below_target": false
}
```

`reserve_below_target` becomes true when fewer than 50 validated plus scheduled
missions remain. The content dashboard should show this as an operational alert.

## 2. Inspect a mission and its audit history

```http
GET /v1/admin/catalogue/missions/NG-M1001
Cookie: nc_session=<content-session>
```

`200 OK`:

```json
{
  "mission_id": "NG-M1001",
  "difficulty": 3,
  "thief_id": "NG-T042",
  "anchors": ["LOC-013", "LOC-204", "LOC-088", "LOC-311"],
  "lifecycle_status": "editorial_review",
  "content_version": 1,
  "published_at": null,
  "scheduled_for": null,
  "retired_at": null,
  "history": [
    {
      "actor_player_id": "content-editor-1",
      "from_status": "draft",
      "to_status": "editorial_review",
      "content_version": 1,
      "reason": "First editorial pass complete",
      "created_at": "2026-10-12 14:20:00"
    }
  ]
}
```

This endpoint contains hidden case structure and belongs only in the restricted
content dashboard—not the player UI.

## 3. Validate a mission

```http
GET /v1/admin/catalogue/missions/NG-M1001/validation
Cookie: nc_session=<content-session>
```

Passing response — `200 OK`:

```json
{
  "mission_id": "NG-M1001",
  "valid": true,
  "issues": []
}
```

Failing response — `200 OK`:

```json
{
  "mission_id": "NG-M1001",
  "valid": false,
  "issues": [
    "stop 2 jurisdiction has fewer than three clue atoms"
  ]
}
```

The server repeats mandatory structural validation before a mission can enter
`validated`, `scheduled`, or `published` state.

## 4. Change lifecycle state

Submit for editorial review:

```http
POST /v1/admin/catalogue/missions/NG-M1001/transition
Content-Type: application/json
Cookie: nc_session=<editor-session>

{
  "target_status": "editorial_review",
  "reason": "First editorial pass complete"
}
```

Schedule a validated mission using a UTC timestamp:

```http
POST /v1/admin/catalogue/missions/NG-M1001/transition
Content-Type: application/json
Cookie: nc_session=<publisher-session>

{
  "target_status": "scheduled",
  "scheduled_for": "2026-10-19 06:00:00",
  "reason": "Monday content release batch 2026-W43"
}
```

Publish immediately:

```json
{
  "target_status": "published",
  "reason": "Approved emergency reserve release"
}
```

Successful transition — `200 OK`:

```json
{
  "message": "mission lifecycle updated"
}
```

Invalid transition or failed validation — `422 Unprocessable Entity`:

```json
{
  "error": "invalid_command",
  "message": "mission validation failed: stop 2 jurisdiction has fewer than three clue atoms"
}
```

Supported paths are:

```text
draft <-> editorial_review -> validated -> scheduled -> published -> retired
                              ^            |
                              +------------+
retired -> draft (starts a new content version)
```

Active player cases retain their already-created route, thief, difficulty, and
state. Retiring or correcting catalogue content cannot rewrite an active case.

## 5. Player release notifications

Players who had exhausted the published catalogue receive an in-app notification
when a new mission publishes.

```http
GET /v1/cases/catalogue-notifications
Cookie: nc_session=<player-session>
```

`200 OK`:

```json
[
  {
    "notification_id": 81,
    "mission_id": "NG-M1001",
    "published_at": "2026-10-19 06:00:00",
    "read": false
  }
]
```

Mark it read:

```http
POST /v1/cases/catalogue-notifications/81/read
Cookie: nc_session=<player-session>
Content-Type: application/json

{}
```

`200 OK`:

```json
{
  "message": "notification read"
}
```

After publication, the existing `GET /v1/cases/catalogue-status` shows the new
unseen count and `POST /v1/cases {}` can assign the new mission automatically.

## Required UI work

### Player frontend

1. Poll release notifications when opening the case desk and after login.
2. Show a “New case available” notification without revealing hidden case data.
3. Mark the notification read after the player dismisses or follows it.
4. Refresh catalogue status after receiving a release notification.

### Restricted content dashboard

1. Show catalogue health counts and the reserve warning.
2. Show mission lifecycle details, validation issues, and immutable audit history.
3. Offer only lifecycle actions allowed for the signed-in content role.
4. Require a reason for every transition and a UTC date for scheduling.
5. Never expose these endpoints or hidden anchors in the ordinary player UI.

The formal contract is `schemas/openapi-v1.json`; shared TypeScript definitions
are in `contracts/typescript/api-v1.ts`.
