import test from "node:test";
import assert from "node:assert/strict";
import { api, ApiError } from "../src/api.ts";
import { can, navigationFor } from "../src/access.ts";

const owner = { username: "operator", account_id: 2, role: "owner", is_bootstrap: false, permissions: ["overview:read", "system:read", "registrations:read", "staff:manage", "audit:read"] };

test("login uses dedicated same-origin session without storing credentials", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/admin-api/v1/session");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.cache, "no-store");
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), { username: "operator", password: "secret" });
      return Response.json(owner);
    };
    assert.deepEqual(await api.login("operator", "secret"), owner);
  } finally { globalThis.fetch = original; }
});

test("roles hide sensitive screens unless the server grants their permission", () => {
  const viewer = { ...owner, role: "viewer", permissions: ["overview:read", "system:read", "analytics:read", "alerts:read"] };
  assert.deepEqual(navigationFor(viewer).map(item => item.id), ["overview", "analytics", "alerts", "system"]);
  assert.equal(can(viewer, "staff:manage"), false);
  assert.equal(can(viewer, "registrations:read"), false);
  assert.equal(can(null, "overview:read"), false);
});

test("staff creation and updates preserve explicit reasons and separate passwords from session data", async () => {
  const original = globalThis.fetch;
  const account = { account_id: 2, username: "named_owner", role: "owner", enabled: true, is_bootstrap: false, created_at: "2026-10-20T00:00:00Z", updated_at: "2026-10-20T00:00:00Z" };
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/admin-api/v1/staff"); assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), { username: "named_owner", password: "a strong temporary password", role: "owner", reason: "Initial named owner" });
      return Response.json(account, { status: 201 });
    };
    assert.deepEqual(await api.createStaff("named_owner", "a strong temporary password", "owner", "Initial named owner"), account);
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/admin-api/v1/staff/2"); assert.equal(options.method, "PATCH");
      assert.deepEqual(JSON.parse(options.body), { enabled: false, reason: "Staff member departed" });
      return Response.json({ ...account, enabled: false });
    };
    assert.equal((await api.updateStaff(2, { enabled: false, reason: "Staff member departed" })).enabled, false);
  } finally { globalThis.fetch = original; }
});

test("old single-operator responses cannot bypass the staff permission contract", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ username: "operator" });
    await assert.rejects(api.session(), /unexpected response/);
    globalThis.fetch = async () => Response.json({ ...owner, permissions: null });
    await assert.rejects(api.session(), /unexpected response/);
  } finally { globalThis.fetch = original; }
});
test("unavailable reporting preserves null metrics while auth failures still reject", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ generated_at: "2026-10-20T00:00:00Z", period_days: 30, available: false, metrics: null, daily: [], unavailable_reason: "Database unavailable" }, { status: 503 });
    const result = await api.overview(30);
    assert.equal(result.available, false);
    assert.equal(result.metrics, null);
    globalThis.fetch = async () => Response.json({ error: "Session expired" }, { status: 401 });
    await assert.rejects(api.overview(30), error => error instanceof ApiError && error.status === 401 && error.message === "Session expired");
  } finally { globalThis.fetch = original; }
});
test("registration paging and filters follow the independent admin contract", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      assert.equal(url, "/admin-api/v1/registrations?days=90&status=abandoned&page=2&page_size=25");
      return Response.json({ generated_at: "2026-10-20T00:00:00Z", period_days: 90, page: 2, page_size: 25, available: true, items: [], total: 25 });
    };
    await api.registrations(90, "abandoned", 2);
  } finally { globalThis.fetch = original; }
});
test("incompatible successful contracts are visible errors rather than broken dashboards", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ available: true });
    await assert.rejects(api.overview(30), /unexpected response/);
    await assert.rejects(api.registrations(30, "all", 1), /unexpected response/);
    await assert.rejects(api.system(), /unexpected response/);
    await assert.rejects(api.session(), /unexpected response/);
  } finally { globalThis.fetch = original; }
});
test("unreadable and unreachable services stay errors rather than empty success", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("<html>not JSON</html>");
    await assert.rejects(api.system(), /unreadable response/);
    globalThis.fetch = async () => { throw new TypeError("network failed"); };
    await assert.rejects(api.system(), /Could not reach/);
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal(await api.logout(), undefined);
  } finally { globalThis.fetch = original; }
});
