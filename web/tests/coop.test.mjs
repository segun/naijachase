import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as m from "../src/model.ts";

const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const openapi = JSON.parse(fs.readFileSync(new URL("../../schemas/openapi-v1.json", import.meta.url), "utf8"));
const req = (status, owner = "ada", helper = "bola") => ({ request_id: status, owner_username: owner, helper_username: helper, case_id: "c", venue_id: "market", status, public_scene: { venue_id: "market", jurisdiction: "Kano", stage: 1 }, recommendation: null, reward_granted: false, expires_at: "2099-01-01T00:00:00Z" });

test("cooperation is only offered to adults", () => {
  assert.equal(m.cooperationAvailable({ age_assurance_status: "adult" }), true);
  for (const s of ["unknown", "minor"]) assert.equal(m.cooperationAvailable({ age_assurance_status: s }), false, s);
  assert.equal(m.cooperationAvailable(null), false);
});

test("each side only gets the actions the lifecycle allows", () => {
  assert.deepEqual(m.coopActions(req("pending"), "bola"), ["accept", "decline"]);
  assert.deepEqual(m.coopActions(req("pending"), "ada"), [], "owners wait");
  assert.deepEqual(m.coopActions(req("accepted"), "bola"), ["complete"]);
  assert.deepEqual(m.coopActions(req("completed"), "ada"), ["acknowledge"]);
  assert.deepEqual(m.coopActions(req("completed"), "bola"), [], "only the owner can acknowledge");
  for (const s of ["acknowledged", "declined", "cancelled", "expired"]) { assert.deepEqual(m.coopActions(req(s), "ada"), [], s); assert.deepEqual(m.coopActions(req(s), "bola"), [], s); }
  assert.equal(m.coopCounterpart(req("pending"), "ada"), "bola");
  assert.equal(m.coopCounterpart(req("pending"), "bola"), "ada");
});

test("every contract status has a label and a terminal flag, and the UI knows every report category", () => {
  const statuses = openapi.components.schemas;
  assert.ok(JSON.stringify(statuses).includes("pending"), "contract lists statuses");
  for (const s of ["pending", "accepted", "completed", "acknowledged", "declined", "cancelled", "expired"]) assert.ok(m.COOP_STATUS[s].label, s);
  assert.equal(Object.values(m.COOP_STATUS).filter(x => x.terminal).length, 4);
  assert.deepEqual(m.REPORT_CATEGORIES.map(c => c.id), ["spam", "harassment", "abusive_username", "cheating", "other"]);
});

test("recommendations and usernames are validated to the documented limits", () => {
  assert.ok(m.recommendationProblem("   "));
  assert.equal(m.recommendationProblem("Check the cloth description carefully."), null);
  assert.equal(m.recommendationProblem("x".repeat(240)), null);
  assert.ok(m.recommendationProblem("x".repeat(241)));
  assert.equal(m.RECOMMENDATION_MAX, 240);
  assert.equal(m.REPORT_DETAILS_MAX, 500);
  assert.ok(m.usernameProblem("ab"));
  assert.equal(m.usernameProblem("Ada_01"), null);
});

test("waiting work sorts first and expiry reads naturally", () => {
  // for "ada" (the owner): nothing needs a reply except the completed one; waiting items come next; finished ones last.
  const sorted = m.sortCoop([req("expired"), req("accepted"), req("completed")], "ada").map(r => r.status);
  assert.deepEqual(sorted, ["completed", "accepted", "expired"]);
  const now = Date.parse("2026-10-07T00:00:00Z");
  assert.equal(m.expiresIn("2026-10-07T12:30:00Z", now), "12h 30m left");
  assert.equal(m.expiresIn("2026-10-07T00:20:00Z", now), "20m left");
  assert.equal(m.expiresIn("2026-10-06T00:00:00Z", now), "expired");
});

test("the privacy rules of the handoff are built into the screens", () => {
  const ui = ["Helpers", "AskForHelp"].map(n => read(`components/${n}.svelte`)).join("\n");
  assert.doesNotMatch(ui, /\{@html/, "recommendations are untrusted text and never rendered as HTML");
  assert.doesNotMatch(ui, /type="search"|navigator\.geolocation|lastSeen|last_seen|is_online|isOnline/, "no player search, presence or location features");
  assert.match(ui, /no online status/i, "the screen tells players there is none");
  assert.match(ui, /no chat/i);
  assert.match(ui, /exact username/i);
  assert.match(ui, /Treat this as a suggestion from another player/);
  assert.match(ui, /Report/);
  assert.match(ui, /Block/);
  assert.match(ui, /never told who reported/);
  assert.match(ui, /cooperationAvailable/);
});

test("help is offered on ordinary cases only, and server state is reloaded after every mutation", () => {
  assert.match(read("components/Investigate.svelte"), /attempt_kind === "ordinary"/);
  assert.match(read("components/Investigate.svelte"), /cooperationAvailable\(app\.coop\.prefs\) && app\.coop\.prefs\?\.enabled/);
  const app = read("lib/app.svelte.ts");
  assert.match(app, /await this\.loadCoop\(\);\n\s+if \(ok\) this\.toast/, "list is refreshed whether the call succeeded or not");
  assert.match(app, /command_id: crypto\.randomUUID\(\)/, "a fresh command id per request");
  assert.match(app, /prefs\.age_assurance_status !== "adult"/, "no requests are made for non-adult accounts");
});

test("every cooperation endpoint exists in the contract", () => {
  const known = Object.keys(openapi.paths).map(p => p.replace(/\{[^}]+\}/g, "{id}"));
  const api = read("api.ts");
  for (const needle of ["coopAccept", "coopDecline", "coopAcknowledge", "coopComplete", "askForHelp", "blocks =", "unblock", "report =", "reputation", "setCoopPreferences"]) assert.ok(api.includes(needle), needle);
  for (const p of ["/v1/cooperation/preferences", "/v1/cooperation/requests", "/v1/cooperation/blocks", "/v1/cooperation/reports", "/v1/cooperation/reputation", "/v1/cooperation/requests/{id}/accept", "/v1/cooperation/requests/{id}/decline", "/v1/cooperation/requests/{id}/complete", "/v1/cooperation/requests/{id}/acknowledge", "/v1/cooperation/blocks/{id}"]) assert.ok(known.includes(p), p);
});
