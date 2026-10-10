# P3.9.1 witness pressure and discipline API

All endpoints require the `nc_session` cookie. Mutations require an allowed
`Origin`. The browser never chooses hidden-clue availability, detection, votes,
punishment, rank, points, or jail time.

## Read earned token balance

`GET /v1/economy/bribe-tokens`

```json
{"currency":"earned_bribe_token","balance":4,"purchasable":false,"transferable":false,"cash_value":false}
```

First successful completion of a case earns one token. The same completion can
also earn one token for no wrong travel, one for using neither pressure action,
and one for difficulty 4 or 5. The result is capped at three tokens per case and
three case-earned tokens per UTC day. Replays, failures, abandoned cases,
cooperative assistance, and repeated achievements award none.

The first `state_explorer` achievement (10 distinct jurisdictions) awards two
tokens. The first `national_investigator` achievement (all 37 jurisdictions)
awards five. These non-repeatable achievement awards sit outside the daily case
cap but respect the maximum held balance of 20. Bribery costs one token;
intimidation costs none. Tokens cannot be bought, gifted, traded, or cashed out.

`GET /v1/economy/bribe-tokens/ledger` returns immutable award and spend entries
with signed amount, resulting balance, reason, reference ID, and UTC timestamp.

When the arrest command completes a first-time case, its normal `CaseResponse`
contains one `token_awarded` event per award transaction:

```json
{
  "event_type":"token_awarded",
  "data":{
    "currency":"earned_bribe_token",
    "reason":"case_completion",
    "amount":"3",
    "balance_after":"8",
    "components":"first_completion,clean_route,ethical_investigation,high_difficulty"
  }
}
```

`components` explains what qualified; `amount` reflects the per-case, daily and
balance caps. The browser displays the server result and must not recalculate it.

## Pressure a questioned witness

`POST /v1/cases/{case_id}/pressure`

```json
{
  "command_id":"pressure-018",
  "expected_version":6,
  "venue_id":"VEN-MARKET",
  "method":"bribe"
}
```

The venue must be one of the current stop's three witnesses and must already
have been questioned. Each witness accepts at most one pressure attempt; trying
one method locks the other. A repeated `command_id` returns the exact persisted
result and does not spend again, reroll, or repeat punishment.

## Restore pressure attempts after reload

`GET /v1/cases/{case_id}/pressure-attempts` returns every persisted pressure
attempt for that case in creation order. Ownership is checked by the server;
requesting another player's case returns `403 forbidden`.

```json
[
  {
    "stage": 2,
    "venue_id": "VEN-MARKET",
    "method": "bribe",
    "extra_clue": "The suspect asked about a place where two great rivers meet.",
    "detected": false,
    "disciplinary_case_id": null,
    "token_balance": 3
  }
]
```

The frontend uses this response to disable both pressure actions for witnesses
already pressured and restore supplemental clues to the notebook after reload.
`stage` is zero-based and must be combined with `venue_id`, because the same
venue type may appear at multiple stages. A non-null `disciplinary_case_id`
links to the matching record returned by `GET /v1/discipline`.

```json
{
  "command_id":"pressure-018",
  "state_version":7,
  "method":"bribe",
  "extra_clue":null,
  "offence":"witness_tampering",
  "detected":true,
  "panel":{
    "disciplinary_case_id":"4eb22ee0-0f67-4cb9-b298-7b57a4562028",
    "offence":"witness_tampering",
    "repeat_offender":false,
    "votes":["warning","punish","punish","warning","punish"],
    "decision":"punish",
    "punishment":"points_deducted",
    "points_before":4200,
    "points_after":3200,
    "old_rank":"Senior Investigator",
    "new_rank":"Investigator",
    "jailed_until":null,
    "acknowledged":false
  },
  "token_balance":3,
  "events":[
    {"event_type":"witness_pressure_resolved","data":{"method":"bribe","extra_clue_received":false,"detected":true}},
    {"event_type":"panel_vote","data":{"panel_position":1,"vote":"warning"}},
    {"event_type":"panel_decision","data":{"decision":"punish","punishment":"points_deducted"}}
  ]
}
```

The response contains five `panel_vote` events when a panel convenes. The UI may
animate arrivals and votes in their returned order. It must not manufacture or
change them. `extra_clue` is present only when that witness held supplemental
evidence; the ordinary clues always remain sufficient.

Initial published rules:

- a stop has a 65% chance of exactly one extra-clue witness and 35% chance of none;
- an empty bribery attempt is detected 1 in 5 times;
- an empty intimidation attempt is detected 1 in 2 times;
- the first detected offence uses five deterministic 50/50 votes and majority rule;
- every later detected offence is punished with at least three punish votes;
- punished witness tampering deducts 1,000 career points, down to zero;
- punished excessive force demotes exactly one rank;
- a punished Rookie is jailed for 24 hours and the active ordinary case is forfeited.

Typical errors are `409 stale_version`, `422 invalid_command` for an unvisited or
already-pressured witness, or insufficient tokens, and `403 forbidden` for a case
belonging to another player.

## Discipline and jail

- `GET /v1/discipline` returns the private panel history and all five votes.
- `POST /v1/discipline/{disciplinary_case_id}/acknowledge` records acknowledgement.
- `GET /v1/discipline/jail` returns
  `{"jailed":true,"jailed_until":"2026-10-08 18:30:00"}` when suspended.

Authentication, recovery, profile, support, token history, and discipline
history remain usable while jailed. Ordinary and weekly mission creation are
rejected until authoritative UTC server time reaches `jailed_until`.

## Frontend handoff

Before confirmation, show the token cost, current balance, one-attempt rule,
the possibility of no extra clue, and the published 20% or 50% detection risk.
Never reveal which witness holds the extra clue. Refresh the case using returned
`state_version`; render panel events and exact jail expiry; disable mission start
while jailed but leave account and support screens available.

### Frontend implementation

- Balance: case desk rank panel, case-terminal status bar, Settings.
- Actions and confirmation: `Pressure.svelte` on the Local leads screen, for witnesses already questioned at the current stop.
  Spent witnesses come from `GET /v1/cases/{id}/pressure-attempts`.
- Awards: `Results.svelte` lists the `token_awarded` events and what qualified.
- History: the Bribe tokens page shows the token ledger and the private disciplinary record.
- Panel: `scenes/panel/PanelScene.svelte` plays a 3D courtroom (Babylon.js, `chase3d-panel.ts`): five judges sit behind a bench,
  the player's avatar stands before them, and each judge in turn raises a paper on a stick carrying their vote, in the order
  returned. When the last paper is up the scene cuts to the player accepting judgement, where the verdict card and the
  acknowledge button appear. The timeline is pure and tested (`panel-scene.ts`). `PanelPresentation.svelte` is the 2D fallback
  (weak device, reduced motion, or 3D failure, continuing from the vote reached). The dialog cannot be dismissed without
  acknowledging. A forfeited case continues to the case desk, which disables starting a case until `jailed_until`.
