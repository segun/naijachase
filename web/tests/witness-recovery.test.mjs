import test from "node:test";
import assert from "node:assert/strict";
import { controller, caseFile, deferred, ApiError, activity } from "./controller-runtime.mjs";
import { mergeWitnessAccounts, parseNotes } from "../src/domain/model.ts";

const receipt = (id = "2:1", stop = "Lagos", message = "The original clue.") => ({
  event_type: "witness_account", data: { account_id: id, state_version: id.split(":")[0],
    stop, stage: "0", venue_id: "market", venue_name: "Market", message }
});
const active = () => {
  const app = controller(); app.game = caseFile(); app.caseId = app.game.case_id;
  return app;
};

test("lost interview response recovers saved words with the questioned state", async () => {
  const app = active();
  const saved = caseFile("case-one", { state_version: 2 });
  saved.state.visited_venues = ["0|Lagos|market"];
  app.api.command = async () => { throw new ApiError(0, "network", "Response interrupted"); };
  app.api.load = async () => saved;
  app.api.caseAccounts = async () => [receipt()];
  assert.equal(await app.command({ type: "visit_venue", venue_id: "market", mode: "drive" }, ""), false);
  assert.deepEqual(app.game.state.visited_venues, ["0|Lagos|market"]);
  assert.equal(app.notes[0].message, "The original clue.");
  assert.equal(parseNotes(sessionStorage.getItem("nc-notes"))[0].accountId, "2:1");
});

test("fresh browser, replay and closed case recover history on resume", async () => {
  for (const attempt_kind of ["ordinary", "replay"]) {
    const app = active();
    app.api.load = async () => caseFile("case-one", { attempt_kind });
    app.api.caseAccounts = async () => [receipt(), receipt("5:1", "Oyo", "Second clue.")];
    await app.resume();
    assert.deepEqual(app.notes.map(n => n.stop), ["Lagos", "Oyo"]);
    app.game.state.outcome = "escaped";
    app.notes = [];
    await app.refreshWitnessAccounts();
    assert.equal(app.notes.length, 2);
  }
});

test("duplicate interview responses are recorded once, not discarded", async () => {
  const app = active();
  app.api.command = async () => caseFile("case-one", { state_version: 2, duplicate: true,
    events: [{ event_type: "venue_visited", data: {} }, receipt()] });
  for (let i = 0; i < 2; i++) await app.command({ type: "visit_venue", venue_id: "market", mode: "drive" }, "");
  assert.equal(app.notes.length, 1);
  assert.equal(app.lastWitness.message, "The original clue.");
  assert.equal(app.toasts.length, 0, "the notebook confirmation must not spoil the witness scene");
  app.api.caseAccounts = async () => [receipt()];
  await app.refreshWitnessAccounts();
  assert.equal(app.notes.length, 1);
});

test("failed history fetch preserves cached clues and exposes a retry error", async () => {
  const app = active();
  app.notes = [{ stop: "Lagos", venue: "Market (extra)", message: "Bonus clue" }];
  app.api.caseAccounts = async () => { throw new Error("Offline"); };
  await app.refreshWitnessAccounts();
  assert.match(app.notesError, /Retry/); assert.equal(app.notesLoading, false);
  assert.equal(app.notes.length, 1);
  app.api.caseAccounts = async () => [receipt()];
  await app.refreshWitnessAccounts();
  assert.equal(app.notesError, ""); assert.equal(app.notes.length, 2);
});

test("late old-case history cannot contaminate a different case", async () => {
  const app = active(), pending = deferred();
  app.api.caseAccounts = () => pending.promise;
  const loading = app.refreshWitnessAccounts();
  app.applyActivity(activity(caseFile("new-case")));
  pending.resolve([receipt()]); await loading;
  assert.equal(app.notes.length, 0);
});

test("history received before a concurrent interview cannot erase its note", async () => {
  const app = active(), pending = deferred();
  app.api.caseAccounts = () => pending.promise;
  const loading = app.refreshWitnessAccounts();
  app.notes = mergeWitnessAccounts([], [receipt("3:1")]);
  pending.resolve([receipt()]); await loading;
  assert.deepEqual(app.notes.map(n => n.accountId), ["2:1", "3:1"]);
});

test("legacy cache migrates without duplicates; identical words at separate visits remain separate", () => {
  const legacy = [{ stop: "Lagos", venue: "Market", message: "The original clue." }];
  const recovered = mergeWitnessAccounts(legacy, [receipt(), receipt("4:1")]);
  assert.equal(recovered.length, 2);
  assert.deepEqual(mergeWitnessAccounts(recovered, [receipt(), receipt("4:1")]), recovered);
});
