import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as m from "../src/model.ts";

const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const openapi = JSON.parse(fs.readFileSync(new URL("../../schemas/openapi-v1.json", import.meta.url), "utf8"));

test("lifecycle actions follow the documented state machine and the signed-in role", () => {
  assert.deepEqual(m.allowedTransitions("draft", "publisher"), ["editorial_review"]);
  assert.deepEqual(m.allowedTransitions("editorial_review", "publisher"), ["draft", "validated"]);
  assert.deepEqual(m.allowedTransitions("validated", "publisher"), ["editorial_review", "scheduled", "published"]);
  assert.deepEqual(m.allowedTransitions("scheduled", "publisher"), ["validated", "published"]);
  assert.deepEqual(m.allowedTransitions("published", "admin"), ["retired"]);
  assert.deepEqual(m.allowedTransitions("retired", "admin"), ["draft"]);
  assert.deepEqual(m.allowedTransitions("bogus", "admin"), []);
  // editors only move drafts into and out of editorial review
  assert.deepEqual(m.allowedTransitions("draft", "editor"), ["editorial_review"]);
  assert.deepEqual(m.allowedTransitions("editorial_review", "editor"), ["draft"]);
  for (const s of ["validated", "scheduled", "published", "retired"]) assert.deepEqual(m.allowedTransitions(s, "editor"), [], s);
});

test("every lifecycle state the UI knows exists in the OpenAPI contract", () => {
  const schema = openapi.components.schemas.MissionTransition;
  const states = JSON.stringify(schema);
  for (const s of Object.keys(m.LIFECYCLE_LABEL)) assert.ok(states.includes(s), s);
});

test("a transition needs a reason, and scheduling needs a UTC timestamp", () => {
  assert.ok("error" in m.transitionBody("published", "  "));
  assert.ok("error" in m.transitionBody("published", "ok"));
  assert.deepEqual(m.transitionBody("published", "Approved emergency reserve release"), { target_status: "published", reason: "Approved emergency reserve release" });
  assert.ok("error" in m.transitionBody("scheduled", "Monday batch", ""));
  assert.deepEqual(m.transitionBody("scheduled", "Monday batch", "2026-10-19T06:00"), { target_status: "scheduled", scheduled_for: "2026-10-19 06:00:00", reason: "Monday batch" });
  assert.equal(m.utcTimestamp("not a date"), null);
  assert.ok(m.isMissionId("ng-m1001") && !m.isMissionId("hello"));
});

test("reserve alert and unread release notices", () => {
  const health = { draft: 8, editorial_review: 4, validated: 21, scheduled: 10, published: 1000, retired: 2, exhausted_players: 0, minimum_unseen_cases: 683, reserve_below_target: true };
  assert.deepEqual(m.reserveSummary(health), { ready: 31, alert: true, line: "31 validated or scheduled in reserve" });
  const list = [{ notification_id: 3, mission_id: "a", published_at: "", read: false }, { notification_id: 9, mission_id: "b", published_at: "", read: false }, { notification_id: 5, mission_id: "c", published_at: "", read: true }];
  assert.deepEqual(m.unreadReleases(list).map(n => n.notification_id), [9, 3]);
  assert.equal(m.formatUtc(null), "\u2014");
});

test("player notices are polled on the desk and after login, marked read, and never reveal case data", () => {
  const app = read("lib/app.svelte.ts"), desk = read("components/CaseDesk.svelte");
  assert.match(app, /loadReleases\(\)/);
  assert.match(app, /void this\.loadReleases\(\);/);
  assert.match(app, /readRelease\(id\)/);
  assert.match(desk, /\$effect\(\(\) => \{ void app\.loadProgression\(\); \}\)/, "refreshes on every desk visit");
  assert.match(desk, /New case available/);
  assert.doesNotMatch(desk, /mission_id|notification\.mission/, "the notice shows no mission details");
});

test("the content dashboard is isolated from the player experience", () => {
  const app = read("App.svelte"), gate = read("components/ContentGate.svelte"), api = read("api.ts");
  assert.match(gate, /import\("\.\/ContentDashboard\.svelte"\)/, "the dashboard is its own lazy chunk");
  assert.doesNotMatch(app, /ContentDashboard/);
  assert.match(gate, /api\.role\(\)/, "the role is asked of the server, never chosen by the browser");
  assert.match(api, /class ContentApi/);
  assert.match(read("lib/app.svelte.ts"), /location\.hash === "#\/content"/);
  const player = ["CaseDesk", "Shell", "Archive", "Investigate", "Settings", "Landing"].map(n => read(`components/${n}.svelte`)).join("\n");
  assert.doesNotMatch(player, /#\/content|admin\/catalogue|ContentApi/, "no player-facing link or call");
  assert.doesNotMatch(read("lib/app.svelte.ts"), /ContentApi|admin\/catalogue/);
});

test("every content and notification endpoint exists in the contract", () => {
  const known = Object.keys(openapi.paths).map(p => p.replace(/\{[^}]+\}/g, "{id}"));
  for (const p of ["/v1/admin/catalogue/me", "/v1/admin/catalogue/health", "/v1/admin/catalogue/missions/{id}", "/v1/admin/catalogue/missions/{id}/validation", "/v1/admin/catalogue/missions/{id}/transition", "/v1/cases/catalogue-notifications", "/v1/cases/catalogue-notifications/{id}/read"]) assert.ok(known.includes(p), p);
});

test("session rotation never races other requests", () => {
  const api = read("api.ts");
  assert.match(api, /let rotation: Promise<unknown>/);
  assert.match(api, /await rotation;/);
  assert.match(api, /rotation\.then\(settled\)/);
  assert.match(read("lib/app.svelte.ts"), /await this\.api\.refresh\(\)\.catch\(\(\) => undefined\);\n\s+await this\.loadProgression\(\);/);
});
