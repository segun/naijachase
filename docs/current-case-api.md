# Current case endpoint — frontend handoff

The server, not browser storage, is authoritative for whether the signed-in
player has an ongoing ordinary case.

## Request

```http
GET /api/v1/cases/current
Cookie: nc_session=<current session>
```

With an ongoing case, `200 OK` returns:

```json
{
  "has_ongoing_case": true,
  "case": {
    "api_version": "v1",
    "case_id": "case-0f42cbdc-e497-4119-8c17-4283fb3795e6",
    "state_version": 7,
    "duplicate": false,
    "attempt_kind": "ordinary",
    "state": {},
    "events": []
  }
}
```

Without one, `200 OK` returns:

```json
{
  "has_ongoing_case": false,
  "case": null
}
```

The real `case.state` is the complete public game state defined by
`CaseResponse`; it is abbreviated above only for readability.

## Frontend behaviour

Call `api.currentCase()` after authentication. If `case` is present, adopt its
`case_id` and state and offer Resume/Open ongoing case. If it is absent, clear
any stale browser case ID and show Start new case. `sessionStorage` may remain a
navigation convenience, but it must not decide whether a case exists.

`POST /v1/cases {}` now returns the existing ongoing ordinary case with
`200 OK` and `duplicate: true` when one exists. It creates a case with `201`
only when the player has none. Replays and weekly attempts remain independent
and are not returned by this endpoint.
