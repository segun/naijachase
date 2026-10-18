# Production observability and incident runbook

Prometheus scrapes `127.0.0.1:8080/metrics` directly. Nginx deliberately returns 404 for `/api/metrics`. Grafana imports `deploy/grafana/naijachase-overview.json`; Prometheus loads `deploy/prometheus/naijachase-alerts.yml`.

Every browser response contains `X-Request-ID`. API errors also contain `request_id`, and JSON logs record that same value. Ask support reporters for it, then search the systemd journal:

```sh
sudo journalctl -u naijachase-api.service --since "30 minutes ago" | grep 'REQUEST_ID'
```

## API down or repeated restarts

1. Check `systemctl status naijachase-api` and the last 200 journal lines.
2. Check `/health/live`, then `/health/ready`; readiness failure normally means MySQL is unavailable.
3. Check memory, CPU, restart count, and the most recent deployment. Roll back the binary/config when the incident began immediately after a release.
4. Do not restart repeatedly before preserving the error and request IDs.

## Sustained 5xx or high latency

1. Use the dashboard route/status panels to identify the affected route.
2. Compare request duration with MySQL pool waiters/failures and runtime waiting tasks.
3. Search logs by request ID. Check the database slow-query log before increasing the pool or concurrency limits.
4. Reduce traffic or roll back if failures are growing; verify recovery for at least ten minutes.

## Database failure

Verify network reachability from the app host, MySQL health and connection limits. Confirm runtime credentials still have only runtime grants. Never paste passwords into tickets or logs.

## Email backlog

Check queue age/retry/permanent-failure panels and Cloudflare status/rate limits. Email delivery is asynchronous: keep the API serving, correct the provider problem, and allow the durable outbox workers to retry. Inspect message metadata only, not bodies.

## Weekly expiry failure

Check `naijachase_weekly_job_last_success_unix_seconds`, failure count, API logs, and database locks. After repair, confirm the worker runs and expired challenges are closed exactly once.

## Browser failures and source maps

Browser errors arrive at `/v1/telemetry/browser-errors` and are logged with release and last API request ID. Hidden source maps are copied to `/opt/naijachase/source-maps/<release>` and are excluded from the web root. Use the matching release privately to symbolicate a stack; never upload maps to the public site.

## Closeout

Record start/end time, impact, request IDs, graphs, root cause, mitigation and follow-up owner. Confirm all alerts clear and add a regression test for code defects.
