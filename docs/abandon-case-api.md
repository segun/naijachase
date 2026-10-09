# Abandon ordinary case API — frontend handoff

This feature permanently ends the authenticated player's ongoing ordinary case
and immediately makes them eligible to start another ordinary case.

It does not apply to replays or weekly challenges.

## Product rules

- Only an unfinished `attempt_kind: "ordinary"` case may be abandoned.
- The case-local score, route progress, evidence dossier, remaining budget, and
  prospective career-point/rank gains are discarded.
- The player's committed career points and rank remain exactly what they were
  without the abandoned case's uncommitted gains.
- The abandoned mission is not marked solved and may be assigned again later,
  including immediately if random selection chooses it.
- The old case is no longer returned by `/v1/cases/current` or as
  `ordinary_case` in `/v1/activity/current`.
- The player may call `POST /v1/cases {}` immediately afterwards.
- Replays must be finished normally; this endpoint rejects them.
- Weekly attempts use their own competitive lifecycle and cannot be abandoned
  through this endpoint.
- Disciplinary offences, detected witness tampering, excessive-force penalties,
  jail, and already-spent tokens are not erased. Abandonment is not an undo for
  sanctions or consumable spending.

Career points and rank are committed only when a case completes successfully.
Therefore an unfinished case normally reports `points_reverted: 0`: its
prospective award was discarded before it ever entered the career record. The
field is explicit so the contract remains correct if case-local incremental
awards are introduced later.

## Endpoint

```http
POST /api/v1/cases/{case_id}/abandon
Content-Type: application/json
Cookie: nc_session=<current session>
Origin: <configured frontend origin>

{
  "expected_version": 7
}
```

| Caller | URL |
| --- | --- |
| Browser through Vite/Nginx | `/api/v1/cases/{case_id}/abandon` |
| Direct local API | `http://127.0.0.1:8080/v1/cases/{case_id}/abandon` |

This is a state-changing request. Production and staging require an allowed
`Origin`; the HttpOnly session cookie supplies authentication.

## Request fields

| Field | Source | Meaning |
| --- | --- | --- |
| `case_id` | Current ordinary `CaseResponse.case_id` | Exact runtime attempt to abandon. Do not send `mission_id`. |
| `expected_version` | Current ordinary `CaseResponse.state_version` | Prevents abandoning against stale state from another tab/device. Minimum `1`. |

The body has no `player_id`, point total, rank, outcome, or mission ID. The
server derives and validates all of them.

## Successful response

Status: `200 OK`

```json
{
  "case_id": "case-0f42cbdc-e497-4119-8c17-4283fb3795e6",
  "mission_id": "NG-M0007",
  "status": "abandoned",
  "previous_state_version": 7,
  "state_version": 8,
  "points_reverted": 0,
  "points_after": 4200,
  "rank_after": "Senior Investigator"
}
```

| Field | Meaning |
| --- | --- |
| `case_id` | Attempt that was ended. |
| `mission_id` | Content mission that was being played. It remains unsolved. |
| `status` | Always `abandoned`. |
| `previous_state_version` | Version accepted from the request. |
| `state_version` | Final terminal version of the abandoned attempt. |
| `points_reverted` | Case-earned career points removed during abandonment. Under the current commit-at-completion model this is normally `0`. |
| `points_after` | Authoritative committed career points after abandonment. |
| `rank_after` | Rank derived from `points_after`. |

Abandonment is atomic: the terminal state, assignment release, and audit entry
commit together. A new case cannot be assigned while only half the operation
has completed.

## Typed frontend call

The shared API client exposes:

```ts
const result = await api.abandonCase(caseId, stateVersion);
```

Equivalent raw request:

```ts
const response = await fetch(
  `/api/v1/cases/${encodeURIComponent(caseId)}/abandon`,
  {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expected_version: stateVersion })
  }
);
```

Local command-line example:

```bash
curl -sS \
  --cookie cookies.txt \
  --header 'Content-Type: application/json' \
  --header 'Origin: http://localhost:4173' \
  --request POST \
  --data '{"expected_version":7}' \
  http://127.0.0.1:8080/v1/cases/case-0f42cbdc-e497-4119-8c17-4283fb3795e6/abandon | jq
```

Use the exact origin present in `NAIJACHASE_ALLOWED_ORIGINS`.

## Required UI flow

1. Show **Abandon case** only for `attempt_kind === "ordinary"` and
   `state.outcome === null`.
2. Open a destructive-action confirmation dialog. Do not abandon on the first
   click or tap.
3. Explain that investigation progress, case score, evidence, budget, and
   uncommitted point/rank gains will be lost permanently.
4. Explain that disciplinary sanctions and spent tokens are not restored.
5. Disable the confirmation button while the request is in flight.
6. Send the exact `case_id` and `state_version` shown when the player confirmed.
   Do not fetch a newer version and silently abandon that newer state.
7. On success, remove the abandoned case from application/browser state.
8. Refresh `api.currentActivity()`, `api.progression()`, and
   `api.catalogueStatus()`.
9. Return to the case desk. Enable **Start new case** only after discovery
   confirms that no ordinary case remains. A failed refresh is not proof that
   the player has no ongoing case; offer **Refresh case status**.
10. Do not automatically start another case unless the player explicitly chose
    a combined **Abandon and start new case** action in the confirmation UI.

Suggested confirmation copy:

> Abandon this case? Your investigation progress, evidence, remaining case
> budget, score, and any uncommitted rank progress from this case will be lost.
> Disciplinary penalties and spent tokens will not be restored. This cannot be
> undone.

Recommended buttons: **Keep investigating** and **Abandon case**.

## Error handling

All errors use `{ "error": "code", "message": "safe message" }`.

| Status/code | Meaning | Frontend action |
| --- | --- | --- |
| `400 invalid_request` | Invalid ID or `expected_version` below 1. | Treat as a client defect; keep the case open. |
| `401 unauthorized` | Session is absent, expired, invalid, or revoked. | Return to login. |
| `403 forbidden` | Case belongs to another player, or CSRF origin is rejected. | Do not reveal ownership details; refresh auth/origin configuration. |
| `404 case_not_found` | Attempt ID does not exist. | Refresh current activity and remove a stale local ID. |
| `409 stale_version` | Another tab/device changed the case. | Reload the case/current activity and ask for confirmation again. Never silently retry abandonment. |
| `409 case_not_abandonable` | Attempt is a replay, already terminal, or otherwise not an ongoing ordinary case. | Refresh activity and hide the abandon action for that attempt. |
| `429` | Rate limited. | Re-enable the button after a neutral retry delay. |
| `500`/`503` | Operation could not be committed. | Keep the case in UI and offer retry; do not assume it was abandoned. |

## Race and retry rules

- The operation checks `expected_version` while holding the case row lock.
- A command and abandonment cannot both commit against the same version.
- On timeout or lost connection, call `api.currentActivity()` before deciding
  whether to retry. If the ordinary case is absent, abandonment committed.
- A second abandonment request for the now-terminal attempt returns
  `case_not_abandonable`; it does not change progression again.
- Never automatically retry a destructive action after `stale_version`.

## Lifecycle consistency

- Ordinary creation is serialized per player inside the storage transaction,
  including requests that randomly select different missions. Assignment,
  commands, completion, witness pressure, and abandonment lock the player
  before the case to avoid inconsistent lock ordering.
- `POST /v1/cases` returning `duplicate: true` means **resume**, not **start**.
  Preserve its visited witnesses, elapsed time, dossier, and existing local
  notebook. Do not replay the opening briefing as if it were a fresh attempt.
- Successful abandonment clears the attempt ID, notebook, trail, rank-at-start,
  quotes, ledger, briefing, pending journey, and witness-scene state. Late
  responses from the old attempt must not restore any of them.
- A new attempt may use the same mission, but has a new runtime `case_id`,
  version 1, and fresh investigation state. Local witness quotes exclude venues
  already questioned at the current stop without changing the mission's
  deterministic dossier-witness assignment.
- An old idempotent command or witness-pressure request cannot return a
  pre-abandonment snapshot after its case has been abandoned.
- Existing historical duplicate ordinary attempts are not silently discarded.
  Abandoning the currently discovered attempt can reveal another older ongoing
  attempt. The desk must name and offer that actual attempt for resumption,
  and keep new ordinary assignment disabled until it is finished or explicitly
  abandoned.

Regression coverage includes actual Svelte-controller execution in
[`case-lifecycle.test.mjs`](../web/tests/case-lifecycle.test.mjs), real-MySQL
concurrent assignment/abandonment/reassignment using the core interview engine,
and API quote filtering. The development mock implements the same ordinary
discovery, duplicate-assignment, and expected-version abandonment semantics.
Browser verification against a separately launched updated Rust API and real
MySQL also covers interview, abandonment, removal of Resume, fresh assignment
at version 1, and a successful first interview at version 2. Verification uses
a temporary account, not the player's existing investigation.

## Explicit exclusions

The following are deliberately unsupported:

```http
POST /v1/cases/{replay_case_id}/abandon
POST /v1/weekly/attempts/{attempt_id}/abandon
```

The first returns `409 case_not_abandonable`; the second route does not exist.

## Related contracts

- Unified activity discovery: [`current-activity-api.md`](current-activity-api.md)
- Ordinary case discovery: [`current-case-api.md`](current-case-api.md)
- JSON Schema: [`../schemas/api-abandon-case-v1.schema.json`](../schemas/api-abandon-case-v1.schema.json)
- OpenAPI: [`../schemas/openapi-v1.json`](../schemas/openapi-v1.json)
- TypeScript contracts: [`../contracts/typescript/api-v1.ts`](../contracts/typescript/api-v1.ts)
- Typed API client: [`../web/src/api/api.ts`](../web/src/api/api.ts)
