import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  alreadyPressured, canAfford, consequenceLines, jailRemaining, panelSteps, parseUtc, pressureWarnings, tally, tokenAwards, totalAwarded
} from "../src/domain/pressure.ts";

const read = file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("confirmation states cost, balance, one attempt, possible nothing and risk, never the hidden clue", () => {
  const bribe = pressureWarnings("bribe", 3).join(" ");
  assert.match(bribe, /1 bribe token/);
  assert.match(bribe, /balance: 3 tokens, 2 afterwards/);
  assert.match(bribe, /only pressure this witness once/);
  assert.match(bribe, /nothing further to reveal/);
  assert.match(bribe, /witness tampering and carries a 1-in-5 chance of detection/);
  assert.match(pressureWarnings("intimidate", 0).join(" "), /excessive use of force and carries a 1-in-2 chance[\s\S]*Free/);
  assert.equal(canAfford("bribe", 0), false);
  assert.equal(canAfford("intimidate", 0), true);
});

test("token awards are displayed exactly as the server reports them", () => {
  const awards = tokenAwards([
    { event_type: "arrested", data: {} },
    { event_type: "token_awarded", data: { reason: "case_completion", amount: "3", balance_after: "8", components: "first_completion,clean_route,ethical_investigation,high_difficulty" } }
  ]);
  assert.equal(awards.length, 1);
  assert.equal(awards[0].amount, 3);
  assert.equal(awards[0].balanceAfter, 8);
  assert.deepEqual(awards[0].components, ["First completion", "No wrong travel", "No bribery or intimidation", "High-difficulty case"]);
  assert.equal(totalAwarded(awards), 3);
});

test("panel steps keep the server's order: five arrivals, five votes, one decision", () => {
  const votes = ["warning", "punish", "punish", "warning", "punish"];
  const result = {
    panel: { votes },
    events: [
      { event_type: "witness_pressure_resolved", data: {} },
      ...votes.map((vote, i) => ({ event_type: "panel_vote", data: { panel_position: i + 1, vote } })),
      { event_type: "panel_decision", data: {} }
    ]
  };
  const steps = panelSteps(result.panel, result.events);
  assert.equal(steps.length, 11);
  assert.deepEqual(steps.slice(5, 10).map(s => s.vote), votes);
  assert.equal(steps.at(-1).kind, "decision");
  assert.deepEqual(tally(votes), { punish: 3, warning: 2 });
});

test("consequences come from the server's figures", () => {
  const base = { offence: "witness_tampering", repeat_offender: true, decision: "punish", punishment: "points_deducted", points_before: 4200, points_after: 3200, old_rank: "Senior Investigator", new_rank: "Investigator", jailed_until: null };
  const lines = consequenceLines(base).join(" ");
  assert.match(lines, /4,200 → 3,200 \(−1,000\)/);
  assert.match(lines, /Senior Investigator → Investigator/);
  assert.match(lines, /punishment was mandatory/);
  assert.match(consequenceLines({ ...base, decision: "warning", punishment: "none" })[0], /releasing you with a warning/);
  const jailed = consequenceLines({ ...base, punishment: "jailed", points_after: 4200, new_rank: "Senior Investigator", jailed_until: "2026-10-08 18:30:00" }, new Date("2026-10-08T17:00:00Z")).join(" ");
  assert.match(jailed, /24 hours/);
  assert.match(jailed, /1 h 30 min left/);
});

test("jail times are read as UTC", () => {
  assert.equal(parseUtc("2026-10-08 18:30:00").toISOString(), "2026-10-08T18:30:00.000Z");
  assert.equal(jailRemaining("2026-10-08 18:30:00", new Date("2026-10-09T00:00:00Z")), "Released");
});

test("an already-pressured rejection is recognised", () => {
  assert.equal(alreadyPressured(422, "invalid_command", "this witness has already been pressured"), true);
  assert.equal(alreadyPressured(422, "invalid_command", "an earned bribe token is required"), false);
});

test("pressure is wired through the API, the leads screen, results, settings and the panel overlay", () => {
  assert.match(read("api/api.ts"), /\/v1\/cases\/\$\{encodeURIComponent\(caseId\)\}\/pressure/);
  assert.match(read("api/api.ts"), /\/v1\/economy\/bribe-tokens\/ledger/);
  assert.match(read("scenes/office/CaseTerminal.svelte"), /<Pressure /);
  assert.match(read("scenes/office/CaseTerminal.svelte"), /Bribe tokens/);
  assert.match(read("scenes/office/CaseDesk.svelte"), /app\.tokenBalance/);
  assert.match(read("screens/case/Results.svelte"), /token-awards/);
  assert.match(read("screens/account/Tokens.svelte"), /Token history/);
  assert.match(read("App.svelte"), /app\.panel/);
  assert.match(read("state/app.svelte.ts"), /api\.discipline\(\)/);
  assert.match(read("state/app.svelte.ts"), /pendingPressure/);
  assert.match(read("screens/social/Weekly.svelte"), /app\.jailedUntil/);
  assert.match(read("screens/case/Pressure.svelte"), /Bribe witness — 1 token/);
  assert.doesNotMatch(read("screens/case/Pressure.svelte"), /extra_clue|hidden/i);
});
