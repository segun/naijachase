import test from "node:test";
import assert from "node:assert/strict";
import { activity, ApiError, caseFile, controller, deferred } from "./controller-runtime.mjs";

test("interview, abandon, start the same mission anew, and interview its first witness", async () => {
  const app = controller();
  let ongoing = caseFile();
  app.api.currentActivity = async () => activity(ongoing);
  app.api.assign = async () => ongoing;
  app.api.command = async (id, version) => {
    assert.equal(id, ongoing.case_id);
    assert.equal(version, ongoing.state_version);
    assert.deepEqual(ongoing.state.visited_venues, []);
    ongoing = { ...ongoing, state_version: version + 1, state: { ...ongoing.state, visited_venues: ["0|Lagos|market"] } };
    return ongoing;
  };
  app.api.abandonCase = async (id, version) => {
    assert.equal(id, "case-one"); assert.equal(version, 2);
    ongoing = null;
    return { status: "abandoned", points_after: 1200, rank_after: "Investigator" };
  };
  app.applyActivity(activity(ongoing));
  assert.equal(app.canStartCase, false);
  assert.equal(await app.command({ type: "visit_venue", venue_id: "market", mode: "drive" }, "Interviewed"), true);
  app.briefing = true; app.pendingLead = "market"; app.lastWitness = { venueId: "market" };
  app.witnessVisit = { venueId: "market" }; app.returning = true;
  app.notes = [{ stop: "Lagos", venue: "market", message: "Old clue" }];
  app.ledger = [{ sequence: 1 }];
  app.persist();
  assert.equal(await app.abandonCurrentCase(), true);
  assert.equal(app.caseId, ""); assert.equal(app.game, null); assert.equal(app.screen, "cases");
  assert.equal(app.canStartCase, true);
  for (const key of ["nc-case", "nc-notes", "nc-trail", "nc-rank"]) assert.equal(sessionStorage.getItem(key), null);
  assert.deepEqual(app.notes, []); assert.deepEqual(app.trail, []); assert.deepEqual(app.ledger, []);
  assert.equal(app.briefing, false); assert.equal(app.pendingLead, "");
  assert.equal(app.lastWitness, null); assert.equal(app.witnessVisit, null); assert.equal(app.returning, false);
  ongoing = caseFile("case-two");
  app.api.currentActivity = async () => activity(app.caseId ? ongoing : null);
  await app.openCase();
  assert.equal(app.caseId, "case-two"); assert.equal(app.briefing, true);
  assert.deepEqual(app.game.state.visited_venues, []);
  assert.equal(await app.command({ type: "visit_venue", venue_id: "market", mode: "drive" }, "Interviewed"), true);
});

test("assignment returning an existing case resumes its authoritative progress instead of running a fresh briefing", async () => {
  const app = controller();
  const existing = caseFile("existing", { duplicate: true });
  existing.state.visited_venues = ["0|Lagos|market"];
  existing.state.stage = 2;
  app.api.currentActivity = async () => activity();
  app.api.assign = async () => existing;
  await app.openCase();
  assert.equal(app.caseId, "existing"); assert.equal(app.game.state.stage, 2);
  assert.deepEqual(app.game.state.visited_venues, ["0|Lagos|market"]);
  assert.equal(app.briefing, false); assert.equal(app.screen, "investigate");
  assert.equal(app.canStartCase, false);
});

test("start while an ordinary case exists resumes it and preserves the same tab's notebook", async () => {
  const app = controller(), existing = caseFile();
  app.applyActivity(activity(existing));
  app.notes = [{ stop: "Lagos", venue: "market", message: "Saved clue" }];
  app.api.currentActivity = async () => activity(existing);
  app.api.load = async () => existing;
  app.api.assign = async () => { assert.fail("must not request a new case"); };
  await app.openCase();
  assert.equal(app.briefing, false); assert.equal(app.notes.length, 1); assert.equal(app.canStartCase, false);
});

test("stale abandonment uses the confirmed version once, reloads, and requires a new confirmation", async () => {
  const app = controller(), current = caseFile();
  app.applyActivity(activity(current));
  let calls = 0;
  app.api.abandonCase = async (id, version) => {
    calls++; assert.equal(version, 1);
    throw new ApiError(409, "stale_version", "Changed elsewhere");
  };
  app.api.currentActivity = async () => activity({ ...current, state_version: 3 });
  assert.equal(await app.abandonCurrentCase(), false);
  assert.equal(calls, 1); assert.equal(app.game.state_version, 3); assert.equal(app.canStartCase, false);
  assert.match(app.toasts.at(-1).text, /confirm abandonment again/);
});

test("network loss checks activity; server failures never masquerade as successful abandonment", async () => {
  for (const status of [0, 500, 503]) {
    const app = controller();
    app.applyActivity(activity(caseFile()));
    app.api.abandonCase = async () => { throw new ApiError(status, "failure", "Failed"); };
    app.api.currentActivity = async () => activity();
    const committed = await app.abandonCurrentCase();
    assert.equal(committed, status === 0);
    assert.equal(app.caseId, status === 0 ? "" : "case-one");
    assert.equal(app.game === null, status === 0);
  }
});

test("failed reconciliation does not resurrect an abandoned ID or enable an unsafe start", async () => {
  const app = controller();
  app.applyActivity(activity(caseFile()));
  app.api.abandonCase = async () => ({ points_after: 1200, rank_after: "Investigator" });
  app.api.currentActivity = async () => { throw new ApiError(503, "unavailable", "Activity unavailable"); };
  assert.equal(await app.abandonCurrentCase(), true);
  assert.equal(app.game, null); assert.equal(app.caseId, ""); assert.equal(app.canStartCase, false);
  assert.ok(app.toasts.some(t => t.kind === "error"));
  app.api.currentActivity = async () => activity();
  await app.refreshCaseDesk();
  assert.equal(app.canStartCase, true);
});

test("a late activity, quote, ledger, or command response cannot repopulate a cleared case", async () => {
  for (const operation of ["activity", "quotes", "ledger", "command"]) {
    const app = controller(), old = caseFile(), pending = deferred();
    app.applyActivity(activity(old));
    let work;
    if (operation === "activity") { app.api.currentActivity = () => pending.promise; work = app.syncCurrentCase(); }
    if (operation === "quotes") { app.api.quotes = () => pending.promise; work = app.refreshQuotes(); }
    if (operation === "ledger") { app.api.ledger = () => pending.promise; work = app.refreshLedger(); }
    if (operation === "command") { app.api.command = () => pending.promise; work = app.command({ type: "wait", minutes: 10 }, "Waited"); }
    app.clearCase();
    pending.resolve(operation === "activity" ? activity(old) : operation === "command" ? old : [{ destination_id: "market" }]);
    await work;
    assert.equal(app.caseId, ""); assert.equal(app.game, null);
    assert.deepEqual(app.quotes, []); assert.deepEqual(app.ledger, []);
    assert.equal(sessionStorage.getItem("nc-case"), null);
  }
});

test("replays cannot be abandoned and do not block a new ordinary case", async () => {
  const app = controller(), replay = caseFile("replay-one", { attempt_kind: "replay" });
  app.applyActivity(activity(null, [replay]));
  assert.equal(app.canStartCase, true);
  app.api.abandonCase = async () => { assert.fail("replay must not be abandoned"); };
  assert.equal(await app.abandonCurrentCase(), false);
});

test("starting with a selected replay resumes the existing ordinary case, not the replay", async () => {
  const app = controller(), ordinary = caseFile(), replay = caseFile("replay-one", { attempt_kind: "replay" });
  app.caseId = replay.case_id;
  app.applyActivity(activity(ordinary, [replay]));
  assert.equal(app.caseId, replay.case_id);
  app.api.currentActivity = async () => activity(ordinary, [replay]);
  app.api.assign = async () => { assert.fail("must resume the ordinary case"); };
  await app.openCase();
  assert.equal(app.caseId, ordinary.case_id); assert.equal(app.briefing, false);
});

test("ordinary discovery and assignment share one busy operation", async () => {
  const app = controller(), pending = deferred();
  let discoveries = 0, assignments = 0;
  app.api.currentActivity = () => { discoveries++; return pending.promise; };
  app.api.assign = async () => { assignments++; return caseFile(); };
  const first = app.openCase();
  await app.openCase();
  assert.equal(discoveries, 1);
  pending.resolve(activity());
  await first;
  assert.equal(assignments, 1);
});

test("late assignment cannot reopen a case after the desk has been cleared", async () => {
  const app = controller(), pending = deferred();
  app.api.currentActivity = async () => activity();
  app.api.assign = () => pending.promise;
  const opening = app.openCase();
  await Promise.resolve();
  app.clearCase();
  pending.resolve(caseFile());
  await opening;
  assert.equal(app.caseId, ""); assert.equal(app.game, null);
});

test("old quotes and duplicate command snapshots never overwrite newer progress", async () => {
  const app = controller(), old = caseFile(), pending = deferred();
  app.applyActivity(activity(old));
  app.api.quotes = () => pending.promise;
  const quotes = app.refreshQuotes();
  const newer = { ...old, state_version: 3, state: { ...old.state, visited_venues: ["0|Lagos|market"] } };
  app.game = newer;
  app.quotes = [{ destination_id: "library" }];
  pending.resolve([{ destination_id: "market" }]);
  await quotes;
  assert.deepEqual(app.quotes, [{ destination_id: "library" }]);
  app.api.command = async () => ({ ...old, duplicate: true });
  app.api.load = async () => newer;
  app.api.quotes = async () => [{ destination_id: "library" }];
  assert.equal(await app.command({ type: "wait", minutes: 10 }, "Waited"), true);
  assert.equal(app.game.state_version, 3);
  assert.deepEqual(app.game.state.visited_venues, ["0|Lagos|market"]);
  app.api.currentActivity = async () => activity(old);
  await app.syncCurrentCase();
  assert.equal(app.game.state_version, 3);
});
