# UI API handoff

The authoritative contract is `schemas/openapi-v1.json`. Stable TypeScript
DTOs generated from that contract are in `contracts/typescript/api-v1.ts`.
The UI may copy or import those types, but must not redefine response shapes.

All browser requests use `credentials: "include"`. Production mutations must
originate from an entry in `NAIJACHASE_ALLOWED_ORIGINS`; a different or missing
`Origin` is rejected. Passwords and session tokens must never enter browser
storage.

## Account flow

1. Register with `POST /v1/auth/register`.
2. Cloudflare sends `/?confirm=<token>`; submit the token to
   `POST /v1/auth/confirm`.
3. Log in with `POST /v1/auth/login`. The response sets the HttpOnly cookie.
4. Load the account with `GET /v1/auth/me`.
5. Rotate the 24-hour session with `POST /v1/auth/refresh`; the response replaces
   the cookie. Treat a 401 as signed out.
6. Use `POST /v1/auth/logout` for this device or `/v1/auth/logout-all` for every
   device.

Registration example:

```json
{"email":"ada@example.com","username":"agent_ada","home_base":"Abia","password":"a-long-passphrase","confirm_password":"a-long-passphrase"}
```

## Recovery

`POST /v1/auth/recovery/request` always returns the same message, including for
unknown addresses. The emailed `/?reset=<token>` value is submitted with the
new password to `/v1/auth/recovery/complete`. Success revokes every session.

## Profile and devices

`GET /v1/profile` returns the same public player shape as `/v1/auth/me`.
`PUT /v1/profile` accepts optional identity/cosmetic fields plus `home_base` and
`leaderboard_opt_in`. `GET /v1/auth/sessions` returns safe public session IDs;
delete `/v1/auth/sessions/{session_id}` to revoke one. Token hashes are never
returned.

## Progression

`GET /v1/progression/summary` is the dashboard source. It includes points,
current rank, solved-case count, visited jurisdictions, travel/deduction
accuracy, earned achievements and rank history. `/archive` supplies completed
cases. `/achievement-catalog` supplies display names and descriptions.

Progression is server-derived from committed command replay. The browser must
never calculate or submit points, achievements, travel accuracy, deductions,
rank changes or home-base discounts.

## Errors

Non-success responses use `{ "error": "stable_code", "message": "safe text" }`.
Handle 401 by returning to login, 403 as denied/unconfirmed/CSRF failure, 409 as
conflict, 422 as rejected gameplay intent, and 429 with a neutral retry-later
message. Do not infer account existence from recovery responses.
