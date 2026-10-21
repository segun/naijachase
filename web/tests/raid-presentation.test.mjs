import test from "node:test";
import assert from "node:assert/strict";
import { controller, caseFile, deferred } from "./controller-runtime.mjs";
import { unsearchedFirst } from "../src/domain/hideouts.ts";

const { canPresentAchievement, resultsPresentation, markResultsAfterPaint } = await import("../src/ui/results-presentation.svelte.ts");

function frames() {
  let id = 0;
  const pending = new Map();
  return {
    request: callback => { pending.set(++id, callback); return id; },
    cancel: id => pending.delete(id),
    paint() { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(0)); }
  };
}

test("searched hideouts move after remaining choices without changing server order or data", () => {
  const choices = ["market", "hotel", "station", "port"].map(id => Object.freeze({ id }));
  Object.freeze(choices);
  assert.deepEqual(unsearchedFirst(choices, new Set(["hotel", "market"])).map(v => v.id), ["station", "port", "market", "hotel"]);
  assert.deepEqual(unsearchedFirst(choices, new Set()), choices);
  assert.deepEqual(unsearchedFirst(choices, new Set(choices.map(v => v.id))), choices);
  assert.deepEqual(unsearchedFirst([], new Set(["market"])), []);
});

test("results sharing waits for a paint and cancels when the page is left", () => {
  for (const leaveAfterFrames of [0, 1, 2]) {
    const clock = frames();
    const cleanup = markResultsAfterPaint("case-one", clock.request, clock.cancel);
    assert.equal(resultsPresentation.caseId, null);
    for (let i = 0; i < leaveAfterFrames; i++) clock.paint();
    assert.equal(resultsPresentation.caseId, leaveAfterFrames === 2 ? "case-one" : null);
    cleanup();
    clock.paint(); clock.paint();
    assert.equal(resultsPresentation.caseId, null, "no delayed dialog on a page already left");
  }
});

test("animation and completion loading cannot expose queued share prompts", () => {
  for (const screen of ["raid", "journey", "witness", "garage"]) {
    for (const ended of [true, false]) assert.equal(canPresentAchievement(screen, ended, "case-one", "case-one"), false);
  }
  assert.equal(canPresentAchievement("warrant", true, "case-one", null), false);
  assert.equal(canPresentAchievement("results", true, "case-one", null), false);
  assert.equal(canPresentAchievement("results", true, "case-one", "old-case"), false);
  assert.equal(canPresentAchievement("results", true, "case-one", "case-one"), true);
  assert.equal(canPresentAchievement("cases", true, "case-one", null), true, "earned achievements still share from the career desk");
  assert.equal(canPresentAchievement("investigate", false, "case-one", null), true);
});

test("a winning raid retains its award queue through the animation and results mount", async () => {
  const app = controller();
  app.game = caseFile(); app.caseId = app.game.case_id; app.screen = "warrant";
  app.summary = await app.api.progression();
  app.catalog = [{ id: "first_catch", title: "First catch", description: "Catch a thief." }];
  app.preloadSceneCritical = () => {};
  app.loadTokens = async () => {};
  const enteredProgression = deferred(), progression = deferred();
  app.api.progression = () => { enteredProgression.resolve(); return progression.promise; };
  const result = caseFile("case-one", { state_version: 2 });
  result.state.outcome = "solved";
  app.api.command = async () => result;
  const visible = () => canPresentAchievement(app.screen, Boolean(app.game.state.outcome), app.caseId, resultsPresentation.caseId);
  const pending = app.raid({ id: "market", label: "Market", options: [{ mode: "drive", cost: 100, affordable: true, travel_minutes: 20, wait_minutes: 0 }] });
  await enteredProgression.promise;
  assert.equal(visible(), false, "completion response precedes the animation");
  progression.resolve({ ...app.summary, achievements: [{ achievement_id: "first_catch", earned_at: "2026-10-21" }] });
  assert.equal(await pending, true);
  assert.equal(app.screen, "raid");
  assert.equal(app.raidVisit.ending, "catch");
  assert.equal(app.achievementShares.length, 1);
  assert.equal(visible(), false);
  app.leaveRaid();
  assert.equal(app.screen, "results");
  assert.equal(visible(), false, "wait for the lazy results screen to mount");
  const clock = frames();
  const cleanup = markResultsAfterPaint(app.caseId, clock.request, clock.cancel);
  clock.paint(); assert.equal(visible(), false);
  clock.paint(); assert.equal(visible(), true);
  assert.equal(app.achievementShares.length, 1, "waiting must not dismiss the award");
  cleanup();
});
