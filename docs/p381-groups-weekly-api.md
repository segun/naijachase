# P3.8.1 frontend handoff

Weekly challenges are private to group members and use authoritative server time. They run Monday 07:00 WAT to the following Monday 07:00 WAT, or close on the first valid capture. Never calculate eligibility, arrival, closure, or winners in the browser.

Group endpoints are `POST /v1/groups`, `GET /v1/groups/{group_id}`, invitation creation/response, member role/removal, leave, ownership transfer, and soft deletion. Rosters are returned only to members.

Challenge windows are half-open intervals: Monday 07:00 WAT is included and
the following Monday 07:00 WAT is excluded. The next challenge begins at that
same instant, so the two challenges never overlap. A production background task
expires winnerless challenges and active attempts within one minute of the end.

`GET /v1/groups/{group_id}/weekly/current` idempotently returns the shared challenge. `POST /v1/weekly/{challenge_id}/attempt` creates or resumes the caller's independent attempt. `GET /v1/weekly/attempts/{attempt_id}` returns state, countdown boundaries, winner status, and current transit.

Commands use `POST /v1/weekly/attempts/{attempt_id}/commands` with the ordinary command envelope. Movement responds with `status: in_transit`, `transit_id`, and `duration_seconds`. While in transit all commands are rejected. At or after arrival, any attempt read or command completes arrival idempotently from persisted server state. The player may continue an ordinary case in parallel.

`GET /v1/weekly/attempts/{attempt_id}/transport-quotes` returns the same fare quotes as an ordinary case for the attempt's current state (empty while in transit or finished). `GET /v1/weekly/attempts/{attempt_id}/accounts` returns the caller's own witness accounts (game events with `event_type: witness_account`, plus `stop` and `venue_id`) for journeys that have already completed; an account is stored with its transit at departure and is only returned once the journey is done.

The web client plays the weekly attempt on the ordinary case desk (same briefing typing, leads, garage, journey scenes, notebook, dossier, travel and warrant screens) in a violet colour scheme (`html[data-mode="weekly"]`). Scenes play by default after a movement command and loop until the server reports arrival; Esc returns to the weekly desk, which shows the countdown and a "Watch the journey" button. Animations never shorten the wait.

`GET /v1/weekly/{challenge_id}` returns private standings and the database-selected winner. `GET /v1/weekly/history` returns prior group challenges. `GET/PUT /v1/weekly/notifications` controls web/email opt-in. Renderer events include scheduling, start, departure, arrival, finish, first capture, closure, and reward; animations and music cannot accelerate them.

The winner receives five separate challenge tokens. Every entrant begins with three challenge-only bribe tokens; storefront or personal balances never affect competition.
