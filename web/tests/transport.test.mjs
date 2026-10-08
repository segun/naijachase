import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as m from "../src/domain/model.ts";
import { component, components, allComponents } from "./helpers.mjs";

const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const q = (scope, id, mode, cost, travel, wait = 0, affordable = true) => ({ scope, destination_id: id, label: id[0].toUpperCase() + id.slice(1), mode, cost, travel_minutes: travel, wait_minutes: wait, affordable, rules_version: 1 });

test("quotes are grouped by scope and destination, with options ordered fly, drive, hitch", () => {
  const quotes = [q("interstate", "kano", "hitch_ride", 0, 900), q("local", "market", "drive", 120, 20), q("interstate", "kano", "fly", 1760, 120), q("interstate", "abia", "drive", 610, 360), q("interstate", "kano", "drive", 610, 360)];
  const inter = m.groupQuotes(quotes, "interstate");
  assert.deepEqual(inter.map(g => g.id), ["kano", "abia"]);
  assert.deepEqual(inter[0].options.map(o => o.mode), ["fly", "drive", "hitch_ride"]);
  assert.deepEqual(m.groupQuotes(quotes, "local").map(g => g.id), ["market"]);
  assert.deepEqual(m.groupQuotes(quotes, "apprehension"), []);
});

test("local and apprehension journeys never offer flying (the server decides; the UI just displays)", () => {
  const local = m.groupQuotes([q("local", "market", "drive", 120, 20), q("local", "market", "hitch_ride", 0, 56)], "local");
  assert.equal(local[0].options.some(o => o.mode === "fly"), false);
});

test("projections are presentation-only: arrival, balance after and deadline", () => {
  const p = m.project(0, 5000, { cost: 1760, travel_minutes: 120, wait_minutes: 30 });
  assert.deepEqual(p, { arrivalMinutes: 150, arrival: "Monday 09:30", balanceAfter: 3240, totalMinutes: 150, missesDeadline: false });
  assert.equal(m.project(m.DEADLINE_MINUTES - 10, 100, { cost: 0, travel_minutes: 56, wait_minutes: 0 }).missesDeadline, true);
  assert.equal(m.project(0, 0, { cost: 0, travel_minutes: 56, wait_minutes: 0 }).balanceAfter, 0, "hitching is free at a zero balance");
});

test("the preselected option is the fastest affordable one that still makes the deadline", () => {
  const opts = [q("interstate", "k", "fly", 1760, 120, 0, false), q("interstate", "k", "drive", 610, 360), q("interstate", "k", "hitch_ride", 0, 900)];
  assert.equal(m.defaultOption(opts, 0, 100).mode, "drive");
  assert.equal(m.defaultOption(opts, m.DEADLINE_MINUTES - 500, 100).mode, "drive", "hitching would miss the deadline");
  assert.equal(m.defaultOption(opts, m.DEADLINE_MINUTES - 100, 100).mode, "drive", "falls back to the best affordable when none make it");
  assert.equal(m.defaultOption([q("interstate", "k", "fly", 1760, 120, 0, false)], 0, 0), null);
  assert.equal(m.cheapest(opts).mode, "hitch_ride");
});

test("money and ledger rows render without exposing hidden route data", () => {
  assert.equal(m.money(45000), "\u20A645,000");
  const rows = m.ledgerView([
    { sequence: 1, kind: "opening_allocation", origin: "", destination: "", mode: "allocation", cost: 0, minutes: 0, balance_after: 45000 },
    { sequence: 2, kind: "interstate", origin: "Abia", destination: "Kano", mode: "drive", cost: 610, minutes: 360, balance_after: 44390 }
  ]);
  assert.deepEqual(rows[0], { sequence: 1, title: "Opening allocation", detail: "Case funds issued", cost: 0, balanceAfter: 45000, allocation: true });
  assert.equal(rows[1].title, "Abia \u2192 Kano");
  assert.equal(rows[1].detail, "Drive \u00B7 6h 0m");
  assert.equal(rows[1].balanceAfter, 44390);
  assert.equal(m.venueInfo("market").icon, "market");
  assert.equal(m.venueInfo("a_new_venue").icon, "pin", "unknown server venues still render");
});

test("the UI never calculates fares and always submits a server-quoted mode", () => {
  const ui = components(["Investigate", "Travel", "Warrant", "MoveOptions"]);
  assert.match(read("api/api.ts"), /transport-quotes/);
  assert.match(read("api/api.ts"), /\/ledger/);
  assert.match(read("screens/case/Travel.svelte"), /type: "travel", destination, mode: quote\.mode/);
  assert.match(read("screens/case/Investigate.svelte"), /type: "visit_venue", venue_id: group\.id, mode:/);
  assert.match(read("screens/case/Warrant.svelte"), /type: "search_hideout", venue_id: group\.id, mode:/);
  assert.doesNotMatch(ui, /cost\s*[:=]\s*\d|fare\s*=\s*\d|\* 1\.\d/, "no browser-side fare maths");
  assert.match(read("screens/case/Travel.svelte"), /groupQuotes\(app\.quotes, "interstate"\)/);
  assert.match(read("screens/case/Warrant.svelte"), /groupQuotes\(app\.quotes, "apprehension"\)/);
  assert.match(read("screens/case/Investigate.svelte"), /groupQuotes\(app\.quotes, "local"\)/);
  assert.doesNotMatch(read("domain/model.ts"), /export const VENUES/);
});

test("quotes are refreshed whenever case state changes and are never stale across cases", () => {
  const app = read("state/app.svelte.ts");
  assert.match(app, /async refreshQuotes\(\)/);
  assert.match(app, /if \(id === this\.caseId\) this\.quotes = quotes/);
  assert.match(app, /payload\.type !== "record_trait"/);
  assert.ok((app.match(/refreshQuotes\(\)/g) ?? []).length >= 5);
});

test("movement needs an accessible confirmation step", () => {
  const dialog = read("screens/case/MoveDialog.svelte"), opts = read("screens/case/MoveOptions.svelte");
  assert.match(dialog, /showModal\(\)/);
  assert.match(dialog, /aria-labelledby/);
  assert.match(opts, /<fieldset/);
  assert.match(opts, /type="radio"/);
  assert.match(opts, /aria-live="polite"/);
  assert.match(opts, /role="alert"/);
  assert.match(opts, /disabled=\{!o\.affordable\}/);
});
