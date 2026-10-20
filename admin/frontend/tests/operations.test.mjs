import test from "node:test";
import assert from "node:assert/strict";
import { operations } from "../src/operations-api.ts";
import { ApiError } from "../src/api.ts";

const account = { player_id: "player_1", email: "person@example.test", username: null, display_name: "Person", home_base: null, created_at: "2026-10-20T00:00:00Z", email_verified_at: null, last_seen_at: null, points: 0, active_sessions: 2, completed_cases: 0, solved_cases: 0 };
const page = items => ({ generated_at: "2026-10-20T00:00:00Z", page: 1, page_size: 25, total: items.length, items });
async function withFetch(fetch, run) { const original = globalThis.fetch; try { globalThis.fetch = fetch; await run(); } finally { globalThis.fetch = original; } }

test("account lookup encodes the prefix and retains missing account facts as null", async () => {
  await withFetch(async (url, options) => {
    assert.equal(url, "/admin-api/v1/accounts?search=person%2Btag%40example.test&page=2&page_size=25");
    assert.equal(options.credentials, "same-origin"); assert.equal(options.cache, "no-store");
    return Response.json(page([account]));
  }, async () => { const result = await operations.accounts("person+tag@example.test", 2); assert.equal(result.items[0].last_seen_at, null); assert.equal(result.items[0].active_sessions, 2); });
});

test("support actions require explicit reason and do not silently retry uncertain writes", async () => {
  let calls = 0;
  await withFetch(async (url, options) => {
    calls++; assert.equal(url, "/admin-api/v1/accounts/player_1/revoke-sessions"); assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), { reason: "Account owner reported a lost device" });
    return Response.json({ status: "unknown", message: "Verify sessions before retrying" }, { status: 503 });
  }, async () => { await assert.rejects(operations.revoke("player_1", "Account owner reported a lost device"), error => error instanceof ApiError && error.status === 503 && /Verify sessions/.test(error.message)); assert.equal(calls, 1); });
});

test("health unknown and missing configuration survive validation without becoming healthy", async () => {
  const data = { generated_at: "2026-10-20T00:00:00Z", scope: "Live local checks", items: [{ key: "api", title: "API", message: "No baseline", severity: "unknown", value: null }, { key: "backups", title: "Backups", message: "Set a success record", severity: "not_configured", value: null }] };
  await withFetch(async () => Response.json(data), async () => { assert.deepEqual(await operations.alerts(), data); });
  await withFetch(async () => Response.json({ ...data, items: [{ ...data.items[0], severity: "everything_is_fine" }] }), async () => { await assert.rejects(operations.alerts(), /unexpected response/); });
});

test("malformed reporting payloads fail visibly rather than showing zero activity", async () => {
  await withFetch(async () => Response.json({}), async () => {
    await assert.rejects(operations.accounts("", 1), /unexpected response/);
    await assert.rejects(operations.account("player_1"), /unexpected response/);
    await assert.rejects(operations.analytics(30), /unexpected response/);
    await assert.rejects(operations.moderation("open", 1), /unexpected response/);
  });
  await withFetch(async () => Response.json(page([{ ...account, active_sessions: -1 }])), async () => { await assert.rejects(operations.accounts("", 1), /unexpected response/); });
});

test("expired sessions propagate to the screen and moderation decisions carry their reason", async () => {
  await withFetch(async () => Response.json({ error: "Session expired" }, { status: 401 }), async () => { await assert.rejects(operations.alerts(), error => error instanceof ApiError && error.status === 401); });
  await withFetch(async (url, options) => {
    assert.equal(url, "/admin-api/v1/moderation/report-123/resolve");
    assert.deepEqual(JSON.parse(options.body), { decision: "escalated", reason: "Requires a second reviewer" });
    return Response.json({ status: "saved" });
  }, async () => { assert.equal((await operations.resolve("report-123", "escalated", "Requires a second reviewer")).status, "saved"); });
});
