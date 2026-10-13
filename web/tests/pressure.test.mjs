import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  alreadyPressured, canAfford, consequenceLines, jailRemaining, panelSteps, parseUtc, pressureWarnings, tally, tokenAwards, totalAwarded
} from "../src/domain/pressure.ts";

const read = file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("confirmation states the requested bribe terms without revealing whether the witness has an extra clue", () => {
  const bribe = pressureWarnings("bribe", 3);
  assert.deepEqual(bribe, [
    "This witness may have nothing further to reveal. If you're caught bribing a witness, you could be punished with demotion or suspension.",
    "You need 1 bribe token. You have 3 tokens.",
    "The token is spent even if the witness has nothing to reveal."
  ]);
  assert.match(pressureWarnings("bribe", 1)[1], /You need 1 bribe token\. You have 1 token\./);
  assert.deepEqual(pressureWarnings("intimidate", 3), ["This witness may have nothing further to reveal. If you're caught intimidating a witness, you could be punished with demotion or suspension."]);
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
  assert.doesNotMatch(read("screens/case/Pressure.svelte"), /extra_clue|hidden/i);
});

test("the case terminal keeps leads uncluttered and presents pressure as compact witness actions", () => {
  const terminal = read("scenes/office/CaseTerminal.svelte");
  const pressure = read("screens/case/Pressure.svelte");
  assert.doesNotMatch(terminal, /witnesses questioned|Listen for a destination clue|The trail is hot\. Listen/);
  assert.doesNotMatch(pressure, /Optional\. A witness may hold a little extra/);
  assert.match(pressure, /class="pressure-actions" role="group" aria-label="Actions for \{venue\.label\}"/);
  assert.match(pressure, /<span>\{method === "intimidate" \? "Press" : PRESSURE_RULES\[method\]\.label\}<\/span>\{#if method === "bribe"\}<small>1 token<\/small>\{\/if\}/);
  assert.match(pressure, /"Press witness for more information"/);
  assert.doesNotMatch(pressure, /anything more\?|Bribe witness — 1 token|pressurePrompt/);
  assert.doesNotMatch(read("state/app.svelte.ts"), /pressurePrompt|Continue \/ Bribe \/ Intimidate choice/);
  assert.match(read("styles/case-terminal.css"), /pressure-list li \{ display: grid;/);
});

test("intimidation is presented as pressing a witness without token or generic terms copy", () => {
  const pressure = read("screens/case/Pressure.svelte");
  assert.match(pressure, /Press witness for more information/);
  assert.match(pressure, /method === "intimidate" \? "Press"/);
  assert.doesNotMatch(pressure, /Read the terms\. This cannot be undone\.|Intimidate witness|rule\.label\} \(\{tokenCost\(pending\.method\)\}\)/);
  const warning = pressureWarnings("intimidate", 3).join(" ");
  assert.doesNotMatch(warning, /Cost:|balance:|five-member panel|1-in-2|Free/);
});

test("bribery confirmation names the witness, omits generic terms and panel copy, and uses a concise action", () => {
  const pressure = read("screens/case/Pressure.svelte");
  assert.match(pressure, /pending\.method === "intimidate" \? "Press witness for more information" : "Bribe witness"/);
  assert.match(pressure, /pending\.method === "intimidate" \? "Press" : "Bribe"/);
  assert.doesNotMatch(pressure, /Read the terms\. This cannot be undone\.|rule\.label\} \(\{tokenCost\(pending\.method\)\}\)/);
  const bribe = pressureWarnings("bribe", 3).join(" ");
  assert.doesNotMatch(bribe, /five-member panel|1-in-5|cannot be bought|balance:|Cost:/);
});
