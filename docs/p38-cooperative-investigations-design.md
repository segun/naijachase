# P3.8 cooperative investigations: authoritative design

This document fixes the rules that must be implemented before Naija Chase exposes player-to-player investigation help.

## Scope

The first release is asynchronous and private. A case owner asks one eligible player to interview one currently available witness. The helper receives only the public scene and witness dialogue needed for that interview, then returns one structured recommendation. The owner retains the case, dossier, travel, warrant, and arrest decisions.

There is no live chat, free-text messaging, public player directory, public activity feed, location sharing, or transfer of case ownership in this release.

## Eligibility

A helper must have a verified account, have completed at least three ordinary cases, not own the case, not be blocked in either direction, not be suspended or jailed, and not have already helped that case. The case must be active and ordinary, the selected venue must be currently available and unvisited, and neither account may exceed the rolling anti-abuse limits.

Requests expire after 12 hours or when the case ends, the venue is visited by the owner, either player blocks the other, or either account becomes ineligible. A request reserves no venue and never prevents the owner from continuing alone.

## Time and case effects

Creating or declining a request costs no case time. On accepted help, the normal witness interview and opening-hours time is applied exactly once to the owner's authoritative case. The helper cannot choose travel, spend the owner's budget, consume tokens, edit the dossier, request a warrant, or expose hidden route data.

The response contains a renderer-neutral recommendation and the same clue fragment the owner could have obtained by interviewing that witness. The owner explicitly chooses whether to record any dossier implication.

## Rewards and anti-farming

A completed, owner-acknowledged assist awards one reputation point, capped at three rewarded assists per helper per UTC day and one rewarded assist per helper-owner pair per seven days. Reputation has no effect on clue truth, travel time, budget, rank, competitive eligibility, or rewards. No cosmetic or token award is included in the first release.

The server records request creation, acceptance, completion, acknowledgement, expiry, cancellation, rejection, and reward decisions. Duplicate commands are idempotent. Reciprocal farming, repeated pairs, shared-device signals, excessive requests, and reports can suppress rewards or suspend cooperation without changing either player's ordinary progression.

## Safety and privacy

Players are found only through an exact username entered by the case owner. The API never discloses email, home base, sex, age, online status, IP-derived location, case route, thief identity, or hidden answers.

Either player can block the other. Blocking cancels pending requests and prevents future requests in both directions. Reports use fixed categories plus optional text limited to 500 characters. Evidence and moderation actions are append-only and visible only to authorised moderators. Reporter identity is not shown to the reported player.

Cooperation notifications default to in-app only and can be disabled. Email cooperation notifications are off by default. Quiet hours are 21:00–08:00 in the player's configured timezone. Minors and accounts without an age-assurance decision have cooperation disabled by default until the child-safety/privacy review defines consent and retention requirements.

## API boundaries

All mutations require the authenticated session, allowed origin, a unique command ID, and optimistic version where case state changes. Public response objects use opaque player IDs and usernames only. The intended endpoints are:

- `GET/PUT /v1/cooperation/preferences`
- `POST /v1/cooperation/requests`
- `GET /v1/cooperation/requests`
- `POST /v1/cooperation/requests/{id}/accept`
- `POST /v1/cooperation/requests/{id}/decline`
- `POST /v1/cooperation/requests/{id}/complete`
- `POST /v1/cooperation/requests/{id}/acknowledge`
- `POST /v1/cooperation/blocks`
- `DELETE /v1/cooperation/blocks/{player_id}`
- `GET /v1/cooperation/blocks`
- `POST /v1/cooperation/reports`
- `GET /v1/cooperation/reputation`

The implementation must add complete OpenAPI schemas and exact frontend request/response examples before these endpoints are considered available.

## Exit checks

Tests must cover cross-account access, blocked pairs, expiry, duplicate completion, owner continuation, owner visiting first, case completion races, reward caps, repeated-pair suppression, hidden-answer redaction, report privacy, notification opt-out, and transaction rollback. The feature remains private until moderation operations, retention, child-safety, and abuse-response procedures have been manually approved.
