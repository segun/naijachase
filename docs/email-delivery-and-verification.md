# Email delivery, confirmation, and recovery

This is the operational and frontend handoff for account email.

## Behaviour

- Registration writes the player, a hashed 24-hour confirmation token, and the
  email outbox row in one MySQL transaction. It returns `201` without waiting for
  Cloudflare.
- An API background worker claims due outbox rows safely across multiple API
  instances. A failed delivery is retried after 1 minute, 5 minutes, 15 minutes,
  1 hour, then 6-hour intervals. After eight attempts it becomes `dead`.
- `NAIJACHASE_EMAIL_WORKERS` controls bounded delivery concurrency per API
  process (default 4, allowed 1–32). Workers drain continuously while mail is
  due and sleep for one second only when the queue is empty.
- Rows left in `sending` for five minutes are recovered after a process failure.
- Sent, expired, superseded, and dead rows have the recipient and bodies erased
  because confirmation and reset links are credentials.
- Confirmation is one-time but idempotent: reopening the same successfully used
  link reports success. Expired, unknown, and superseded links return
  `invalid_confirmation`.
- Resending invalidates all unused older confirmation links and queued messages,
  then creates one new 24-hour link. The response is deliberately identical for
  an unknown address, a verified account, and an unverified account.
- Password recovery creates a hashed 30-minute reset token and outbox row in one
  transaction. A new request supersedes older unused links. Completing the reset
  revokes every active session.

## API calls for the web client

### Register

```http
POST /v1/auth/register
Content-Type: application/json

{
  "email": "player@example.com",
  "username": "player_one",
  "home_base": "Lagos",
  "password": "at-least-12-characters",
  "confirm_password": "at-least-12-characters",
  "dob_day": 1,
  "dob_month": 1,
  "dob_year": 1990
}
```

Success is `201`:

```json
{"message":"Account created. Confirmation email has been queued."}
```

Show the confirmation-pending screen immediately. Do not send the password
again and do not poll for delivery.

### Confirm

The email links to `/?confirm=<raw token>`. The browser sends:

```http
POST /v1/auth/confirm
Content-Type: application/json

{"token":"<raw token from URL>"}
```

Success is `200`. Remove the token from browser history and show login. For
`400 invalid_confirmation`, remove the token and show the resend form.

### Resend confirmation

```http
POST /v1/auth/confirmation/resend
Content-Type: application/json

{"email":"player@example.com"}
```

Every accepted request returns `202`:

```json
{"message":"If that account is awaiting confirmation, a new link has been queued."}
```

The endpoint permits three requests per email per minute. A `429` should keep
the player on the same screen and show the server's retry message.

If login returns `403 email_unconfirmed`, the web client opens the same resend
screen with the attempted email already filled in.

### Password recovery

`POST /v1/auth/recovery/request` accepts `{"email":"player@example.com"}` and
always returns a generic response saying that a message has been queued. The email links to
`/?reset=<raw token>`. Complete it with:

```http
POST /v1/auth/recovery/complete
Content-Type: application/json

{
  "token": "<raw token from URL>",
  "password": "the-new-password",
  "confirm_password": "the-new-password"
}
```

## Production operation

Apply migration 18 before restarting the new API:

```bash
make db-migrate
make production-build
make restart-api
```

The service refuses to start in staging or production unless
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN`, and
`NAIJACHASE_EMAIL_FROM` are present.

Safe queue-health query (it never selects addresses, links, or bodies):

```sql
SELECT status, message_kind, COUNT(*) AS messages,
       MIN(created_at) AS oldest_created,
       MAX(attempts) AS highest_attempts
FROM email_outbox
GROUP BY status, message_kind
ORDER BY status, message_kind;
```

Inspect terminal failures without exposing message content:

```sql
SELECT email_id, message_kind, attempts, last_error, created_at
FROM email_outbox
WHERE status = 'dead'
ORDER BY created_at DESC
LIMIT 100;
```

Metrics include `naijachase_emails_sent_total` and
`naijachase_email_failures_total`. Alert on new dead rows, a growing queued
count, an old queued row, or sustained failure-counter growth.
