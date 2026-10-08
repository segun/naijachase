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
