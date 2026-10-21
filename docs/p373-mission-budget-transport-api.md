# P3.7.3 frontend handoff: mission money and transport

The API owns all fares, journey times, opening-hour waits, and balance changes. The frontend displays server quotes and never calculates or alters them.

## Case state

Every case response includes these fields inside `state`:

```json
{"opening_budget":45000,"balance":45000,"transport_rules_version":1}
```

Case money is isolated virtual money. It cannot be bought, exchanged, or carried into another case.

## Catalogue balance gate

The permanent Rust catalogue audit plays all 1,000 missions through all three
witness visits at every stop, paid local driving, flights between correct
states, dossier completion, warrant issuance and paid apprehension. It checks
all six witness orders because opening hours change waiting time. Every mission
must have a complete itinerary inside the 10,080-minute deadline and retain a
positive balance; the opening budget must also remain at least 20% above the
mission's conservative transport baseline and is rounded up to ₦5,000.
New allocations add reserves of 80%, 60%, 40%, 30%, and 20% for levels 1–5
to the maximum baseline for that difficulty. Saved allocations remain unchanged;
see [case difficulty](case-difficulty.md).

Slow choices may still consume the deadline. That is an intended game outcome,
not a catalogue failure; hitching and inefficient venue order remain tradeoffs.

## Request current choices

```http
GET /v1/cases/{case_id}/transport-quotes
Cookie: nc_session=...
```

```json
[
  {"scope":"interstate","destination_id":"Kano","label":"Kano","mode":"fly","cost":1760,"travel_minutes":120,"wait_minutes":0,"affordable":true,"rules_version":1},
  {"scope":"local","destination_id":"market","label":"Market","mode":"hitch_ride","cost":0,"travel_minutes":56,"wait_minutes":0,"affordable":true,"rules_version":1}
]
```

`scope` is `interstate`, `local`, or `apprehension`. Group quotes by `scope` and `destination_id`. Disable choices where `affordable` is false. Hitching is always free, but can consume enough simulated time to miss the deadline.

Before confirmation, show destination, mode, fare, journey duration, opening-hours wait, projected arrival, and remaining balance. Derive projected arrival only for presentation from the current `elapsed`, `travel_minutes`, and `wait_minutes`; the subsequent command response remains authoritative.

## Submit the selected mode

All requests retain the normal idempotent `command_id` and optimistic-lock `expected_version`.

Interstate:

```json
{"command_id":"travel-017","expected_version":4,"command":{"type":"travel","destination":"Kano","mode":"drive"}}
```

Witness venue:

```json
{"command_id":"venue-018","expected_version":5,"command":{"type":"visit_venue","venue_id":"market","mode":"hitch_ride"}}
```

Final hideout journey:

```json
{"command_id":"search-019","expected_version":22,"command":{"type":"search_hideout","venue_id":"market","mode":"drive"}}
```

The response contains the new authoritative balance. Movement events include `mode`, `cost`, journey timing, and `balance`. An invalid or unaffordable command returns an error without charging or moving. Refresh the case and quotes after a version conflict. Retrying the same `command_id` returns the original result and never charges twice.

## Spending history

```http
GET /v1/cases/{case_id}/ledger
Cookie: nc_session=...
```

```json
[
  {"sequence":1,"kind":"opening_allocation","origin":"","destination":"","mode":"allocation","cost":0,"minutes":0,"balance_after":45000},
  {"sequence":2,"kind":"interstate","origin":"Abia","destination":"Kano","mode":"drive","cost":610,"minutes":360,"balance_after":44390}
]
```

Render this as read-only history. It intentionally omits the hidden correct route and opening-budget calculation.

## Frontend acceptance checklist

- Fetch quotes whenever case state, available venues, or balance changes.
- Never offer flying for local witness or hideout journeys.
- Keep hitching enabled at zero balance.
- Require an accessible confirmation step before movement.
- Animate the returned duration, while treating the command response as authoritative.
- Show the ledger and opening allocation without exposing hidden-route data.
