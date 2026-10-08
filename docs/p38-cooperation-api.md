# P3.8 frontend handoff: cooperative investigations

All calls use the `nc_session` cookie. Mutations require the configured browser origin. Cooperation is private, asynchronous, and disabled unless age assurance is `adult`.

## Preferences

`GET /v1/cooperation/preferences` returns `{"enabled":true,"email_enabled":false,"age_assurance_status":"adult"}`. Update with `PUT` and `{"enabled":true,"email_enabled":false}`. The UI must not offer cooperation when status is `unknown` or `minor`.

## Request help

`POST /v1/cooperation/requests`:

```json
{"command_id":"help-01","case_id":"case-uuid","venue_id":"market","helper_username":"Ada_01"}
```

The response is `201` with `{"request_id":"uuid","status":"pending","expires_in_seconds":43200}`. Exact usernames are required; there is no player search or presence indicator. The API rejects ineligible helpers, blocked pairs, non-ordinary cases, unavailable venues, and duplicate helper/case pairs.

`GET /v1/cooperation/requests` returns requests visible to the signed-in owner or helper only. `public_scene` contains only venue, current jurisdiction, and stage—never route answers, thief identity, observations, email, home base, or location data.

## Helper lifecycle

- `POST /v1/cooperation/requests/{id}/accept` with `{}`.
- `POST /v1/cooperation/requests/{id}/decline` with `{}`.
- `POST /v1/cooperation/requests/{id}/complete` with `{"recommendation":"Check the cloth description carefully."}`. Text is 1–240 characters.
- `POST /v1/cooperation/requests/{id}/acknowledge` with `{}`. Only the owner can acknowledge.

The UI displays recommendations as untrusted player-provided text. Acknowledgement may award one reputation point, limited to three per UTC day and one rewarded owner/helper pair per seven days. Reputation never affects gameplay.

## Safety

Block with `POST /v1/cooperation/blocks` and `{"username":"Ada_01"}`. List with `GET /v1/cooperation/blocks`. Unblock with `DELETE /v1/cooperation/blocks/{player_id}`. Blocking cancels pending work in either direction.

Report with `POST /v1/cooperation/reports`:

```json
{"username":"Ada_01","category":"harassment","details":"Optional, maximum 500 characters"}
```

Categories are `spam`, `harassment`, `abusive_username`, `cheating`, and `other`. Never reveal report status or reporter identity to the reported player.

`GET /v1/cooperation/reputation` returns `{"reputation":4}`.

## UI acceptance

- No free-form chat, public directory, presence, or location display.
- Owners can continue independently; requests never reserve a witness.
- Clearly show expiry and terminal statuses.
- Provide block and report controls wherever a request is shown.
- Refresh the list after every mutation; server state is authoritative.
