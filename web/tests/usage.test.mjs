import test from "node:test";
import assert from "node:assert/strict";
import { createUsageTracker } from "../src/usage.ts";
import fs from "node:fs";

function fixture(initial = null) {
  let choice = initial, visible = true;
  const events = [];
  const tracker = createUsageTracker({ choice: () => choice, saveChoice: value => choice = value, visible: () => visible, send: async event => { events.push(event); } });
  return { tracker, events, hide: () => visible = false, show: () => visible = true };
}
test("no visit or draft email is collected before explicit opt-in", async () => {
  const f = fixture();
  await f.tracker.visit(); await f.tracker.registrationStarted(); await f.tracker.registrationEmail("ada@example.com");
  assert.deepEqual(f.events, []);
  await f.tracker.setChoice("yes");
  assert.deepEqual(f.events, [{ kind: "visit" }, { kind: "registration_start" }]);
});
test("a visible consenting browser sends visits and only bounded valid email drafts", async () => {
  const f = fixture("yes");
  await f.tracker.visit();
  f.hide(); await f.tracker.visit(); f.show();
  for (const value of ["bad", "a@@b.com", "a\r\n@b.com", `${"a".repeat(321)}@b.com`]) await f.tracker.registrationEmail(value);
  await f.tracker.registrationEmail(" ADA@Example.com "); await f.tracker.registrationEmail("ada@example.com");
  assert.deepEqual(f.events, [{ kind: "visit" }, { kind: "registration_start", email: "ada@example.com" }]);
});
test("withdrawal follows queued requests and suppresses all later capture", async () => {
  const f = fixture("yes");
  void f.tracker.visit(); void f.tracker.registrationEmail("ada@example.com");
  await f.tracker.setChoice("no");
  await f.tracker.visit(); await f.tracker.registrationEmail("other@example.com");
  assert.deepEqual(f.events, [null]);
});
test("a withdrawn choice takes effect even if browser storage cannot be updated", async () => {
  const events = [];
  const tracker = createUsageTracker({ choice: () => "yes", saveChoice: () => {}, visible: () => true, send: async event => events.push(event) });
  await tracker.setChoice("no"); await tracker.visit(); await tracker.registrationEmail("ada@example.com");
  assert.deepEqual(events, [null]);
});
test("queued events are suppressed when another tab withdraws consent", async () => {
  let choice = "yes", release;
  const gate = new Promise(resolve => release = resolve);
  const events = [];
  const tracker = createUsageTracker({ choice: () => choice, saveChoice: value => choice = value, visible: () => true, send: async event => { events.push(event); await gate; } });
  void tracker.visit();
  await new Promise(resolve => setTimeout(resolve, 0));
  const queued = tracker.registrationEmail("ada@example.com");
  choice = "no"; tracker.syncChoice("no"); release(); await queued;
  assert.deepEqual(events, [{ kind: "visit" }, null]);
});
test("allowing measurement after leaving signup does not record a signup start", async () => {
  const f = fixture();
  await f.tracker.registrationStarted(); f.tracker.registrationClosed(); await f.tracker.setChoice("yes");
  assert.deepEqual(f.events, [{ kind: "visit" }]);
});
test("a failed measurement does not prevent withdrawal or affect signup", async () => {
  let choice = "yes", attempts = 0;
  const tracker = createUsageTracker({ choice: () => choice, saveChoice: value => choice = value, visible: () => true, send: async () => { attempts++; throw Error("offline"); } });
  await tracker.registrationEmail("ada@example.com"); await tracker.setChoice("no"); await tracker.visit();
  assert.equal(attempts, 2);
});

test("the first-choice prompt disappears permanently and Settings owns later changes", () => {
  const prompt = fs.readFileSync(new URL("../src/ui/UsagePrivacy.svelte", import.meta.url), "utf8");
  const settings = fs.readFileSync(new URL("../src/screens/account/Settings.svelte", import.meta.url), "utf8");
  assert.doesNotMatch(prompt, /usage-settings|Usage privacy<\/button>/);
  assert.match(prompt, /getUsageChoice\(\) === null/);
  assert.match(settings, /Optional usage measurement/);
  assert.match(settings, /chooseUsage\("yes"\)/);
  assert.match(settings, /chooseUsage\("no"\)/);
  assert.match(settings, /aria-pressed=\{usageChoice === "yes"\}/);
  assert.match(settings, /aria-pressed=\{usageChoice === "no"\}/);
});
