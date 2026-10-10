import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as m from "../src/domain/model.ts";
import { component, components, allComponents } from "./helpers.mjs";

const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const openapi = JSON.parse(fs.readFileSync(new URL("../../schemas/openapi-v1.json", import.meta.url), "utf8"));

test("member actions follow the group role rules", () => {
  assert.deepEqual(m.memberActions("owner", "member", false), ["promote", "remove", "transfer"]);
  assert.deepEqual(m.memberActions("owner", "admin", false), ["demote", "remove", "transfer"]);
  assert.deepEqual(m.memberActions("admin", "member", false), ["remove"]);
  assert.deepEqual(m.memberActions("admin", "admin", false), [], "admins cannot remove other admins");
  assert.deepEqual(m.memberActions("member", "member", false), []);
  assert.deepEqual(m.memberActions("owner", "owner", true), [], "nothing to do to yourself");
  assert.deepEqual(m.memberActions("admin", "owner", false), [], "nobody acts on the owner");
  assert.equal(m.canManageGroup("admin"), true);
  assert.equal(m.canManageGroup("member"), false);
  assert.equal(m.canManageGroup(undefined), false);
  assert.equal(m.myRole({ members: [{ player_id: "1", username: "ada", role: "admin" }] }, "ada"), "admin");
});

test("group names and remembered group ids are validated", () => {
  assert.ok(m.groupNameProblem("ab"));
  assert.equal(m.groupNameProblem("Lagos Detectives"), null);
  assert.ok(m.groupNameProblem("x".repeat(m.GROUP_NAME_MAX + 1)));
  assert.deepEqual(m.parseKnownGroups('["a","b","a",3,""]'), ["a", "b"]);
  assert.deepEqual(m.parseKnownGroups("{broken"), []);
  assert.deepEqual(m.parseKnownGroups(null), []);
  assert.deepEqual(m.rememberGroup(["a"], "b"), ["a", "b"]);
  assert.deepEqual(m.rememberGroup(["a"], "a"), ["a"]);
  assert.deepEqual(m.forgetGroup(["a", "b"], "a"), ["b"]);
});

test("countdowns come from the server's timestamps and flag the last hour", () => {
  const now = Date.parse("2026-10-07T00:00:00Z");
  assert.deepEqual(m.countdown(now + 5 * 86400000 + 3 * 3600000, now), { label: "5d 3h left", over: false, urgent: false });
  assert.deepEqual(m.countdown(now + 90 * 60000, now), { label: "1h 30m left", over: false, urgent: false });
  assert.equal(m.countdown(now + 30 * 60000 + 15000, now).urgent, true);
  assert.deepEqual(m.countdown(now - 1, now), { label: "closed", over: true, urgent: false });
  assert.equal(m.secondsLabel(45), "45s");
  assert.equal(m.secondsLabel(125), "2m 5s");
  assert.equal(m.secondsLabel(7260), "2h 1m");
  assert.equal(m.parseUtc("2026-10-07 12:00:00"), Date.parse("2026-10-07T12:00:00Z"));
  assert.equal(m.parseUtc("2026-10-07T12:00:00Z"), Date.parse("2026-10-07T12:00:00Z"));
});

test("transit replies are recognised and standings put the winner first", () => {
  assert.equal(m.isTransitReply({ status: "in_transit", transit_id: "t", duration_seconds: 6 }), true);
  assert.equal(m.isTransitReply({ status: "active" }), false);
  assert.equal(m.isTransitReply(null), false);
  const list = [{ username: "zed", status: "active", attempt_id: "3", finished_at: null }, { username: "bola", status: "solved", attempt_id: "2", finished_at: "x" }, { username: "ada", status: "solved", attempt_id: "1", finished_at: "y" }];
  assert.deepEqual(m.sortStandings(list, "2").map(s => s.username), ["bola", "ada", "zed"]);
  assert.equal(m.weeklyStatus("in_transit").label, "Travelling");
  assert.equal(m.weeklyStatus("mystery").label, "mystery");
  assert.equal(m.eventLabel("first_valid_capture"), "First valid capture");
  assert.equal(m.notificationLabel("reward"), "You won challenge tokens");
});

test("eligibility, arrival, closure and winners are never computed in the browser", () => {
  const ui = components(["Weekly", "Groups"]) + read("state/groups.svelte.ts");
  assert.match(read("screens/social/Weekly.svelte"), /display aid; the server clock decides/);
  assert.doesNotMatch(ui, /isWinner\s*=|determineWinner|first to finish|finished_at\s*[<>]|\.sort\([^)]*finished_at/i, "no browser-side winner logic");
  assert.match(ui, /find\(s => s\.attempt_id === g\.details!\.winner_attempt_id\)/, "a winner is only ever looked up from the server's winner_attempt_id");
  assert.match(ui, /g\.details\.winner_attempt_id/, "the winner comes from the server's standings");
  assert.match(ui, /a\.winner/);
  assert.match(read("state/groups.svelte.ts"), /remaining_seconds/, "arrival timing is read from the server's transit data");
  assert.match(read("state/groups.svelte.ts"), /private schedulePoll\(\)/);
  assert.match(read("scenes/office/CaseTerminal.svelte"), /nothing you watch speeds it up/);
});

test("while travelling no commands are offered, and a stale attempt is reloaded", () => {
  const desk = read("scenes/office/CaseTerminal.svelte"), ctl = read("state/app.svelte.ts");
  assert.match(desk, /\{#if transit\}\{@render travelling\(\)\}\{:else\}[\s\S]*?<LeadGrid/, "no leads while travelling");
  assert.match(desk, /\{:else if transit\}\{@render travelling\(\)\}\s*\{:else if app\.screen === "dossier"\}/, "no dossier, travel or warrant while travelling");
  assert.match(ctl, /if \(this\.weeklyTransit\) \{ this\.toast\("You are travelling/);
  assert.match(ctl, /e\.code === "stale_version"/);
  assert.match(ctl, /isTransitReply\(reply\)/);
  assert.match(ctl, /attemptCommand/);
  assert.match(read("api/api.ts"), /crypto\.randomUUID\(\), expected_version: version, command/);
});

test("weekly play is independent of the ordinary case and exposes no hidden data", () => {
  const ui = components(["Weekly", "Groups"]);
  assert.match(ui, /independent of your ordinary case|carries on in parallel/);
  assert.doesNotMatch(ui, /thief_id|hideout_venue|observations|route:/);
  assert.doesNotMatch(read("state/groups.svelte.ts"), /app\.game\b|this\.app\.game|sessionStorage/, "weekly state never touches the ordinary case");
});

test("every group and weekly endpoint exists in the contract", () => {
  const known = Object.keys(openapi.paths).map(p => p.replace(/\{[^}]+\}/g, "{id}"));
  const api = read("api/api.ts");
  const urls = [...api.matchAll(/`?"?(\/v1\/(?:groups|group-invitations|weekly)[^"`?]*)/g)].map(x => x[1].replace(/\$\{[^}]+\}/g, "{id}"));
  assert.ok(urls.length >= 20, `found ${urls.length}`);
  for (const u of new Set(urls)) assert.ok(known.includes(u), `${u} is not in the contract`);
});

test("groups are private: no directory, roster only for members, remembered ids are re-validated", () => {
  const ctl = read("state/groups.svelte.ts"), ui = read("screens/social/Groups.svelte");
  assert.match(ui, /no public directory/i);
  assert.match(ui, /exact username/i);
  assert.match(ctl, /e\.status === 403 \|\| e\.status === 404/, "forgotten groups are dropped when the server says no");
  assert.match(ctl, /g\.status === "active"/);
  assert.match(ctl, /localStorage/);
  assert.doesNotMatch(ctl, /sessionStorage|password|token/i);
});
