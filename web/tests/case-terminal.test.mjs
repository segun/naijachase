import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as room from "../src/scenes/office/room-scene.ts";
import * as w from "../src/scenes/witness/witness-scene.ts";
import { CASE_SCREENS, isCaseScreen } from "../src/domain/model.ts";

const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("leaving the venue and arriving back at the desk take about five seconds together, never more than ten", () => {
  const back = room.T_END - room.T_RETURN_FROM;
  assert.ok(back > 1.2 && back < 2.5, `the office part is ${back.toFixed(2)}s`);
  for (const arrival of ["drive", "hitch"]) {
    for (const words of [8, 26, 48, 200]) {
      const p = w.planScene(arrival, words);
      const leave = p.end - p.speechEnd;
      const total = leave + back;
      assert.ok(total <= 10, `${arrival}/${words} words: ${total.toFixed(2)}s from the last word to the desk`);
      assert.ok(total >= 4.5 && total <= 7, `${arrival}/${words} words: ${total.toFixed(2)}s is near the five-second target`);
    }
  }
});

test("the return starts with the player already seated at the computer and ends on the zoomed monitor", () => {
  const start = room.poseAt(room.T_RETURN_FROM);
  assert.ok(start.sit > 0.95 && start.visible, "seated");
  assert.ok(room.avatarAlpha(room.T_RETURN_FROM) > 0.99, "the player is drawn until the zoom passes through them");
  assert.ok(room.T_RETURN_FROM > room.T_SIT_START && room.T_RETURN_FROM < room.T_ZOOM_START, "after sitting down, before the zoom");
  assert.equal(room.glassAt(room.T_RETURN_FROM), 0, "the screen is dark at first");
  assert.equal(room.glassAt(room.T_END), 1, "and the terminal is up by the end");
});

test("the case is part of the office: the five case screens render on the office computer and keep it mounted", () => {
  assert.deepEqual([...CASE_SCREENS], ["investigate", "notebook", "dossier", "travel", "warrant"]);
  assert.ok(CASE_SCREENS.every(isCaseScreen) && !isCaseScreen("cases") && !isCaseScreen("garage") && !isCaseScreen("settings"));
  const app = read("App.svelte"), shell = read("ui/Shell.svelte");
  assert.match(app, /app\.screen === "cases" \|\| \(app\.game && isCaseScreen\(app\.screen\)\)\}\{@render room\(\)\}/, "one branch for the desk and the case, so the room is not rebuilt between them");
  assert.doesNotMatch(app, /<(Investigate|Notebook|Dossier|Travel|Warrant) \{app\}/, "no case screen is drawn outside the terminal");
  assert.match(shell, /isCaseScreen\(app\.screen\)/, "no side rail or HUD over the terminal");
  assert.ok(!fs.existsSync(new URL("../src/screens/case/Investigate.svelte", import.meta.url)), "the old investigate page is gone");
});

test("the case terminal shows where the player is, the case clock and funds, the leads, and no way to start a new case", () => {
  const view = read("scenes/office/CaseTerminal.svelte");
  for (const needle of [/gs\.current_state/, /Case clock/, /money\(gs\.balance\)/, /gs\.score/, /timeLeft\(/, /Deadline Monday 07:00/, /<LeadGrid /, /<Notebook \{app\}/, /<Dossier \{app\}/, /<Travel \{app\}/, /<Warrant \{app\}/]) assert.match(view, needle);
  assert.doesNotMatch(view, /openCase|Start new case/, "a case is open: there is nothing to start");
  assert.match(view, /await leave\(\);\s*app\.finishBriefing\(lead\.id\)/, "a lead is visited by walking out of the office");
  assert.match(view, /dialog\[open\]/, "a fare dialog owns the keyboard");
  assert.match(view, /INPUT\|TEXTAREA\|SELECT/, "typing in a form never triggers a shortcut");
  assert.match(view, /done\.includes|questioned=\{done\}/, "witnesses already questioned here are marked");
  assert.match(view, /if \(done\.includes\(lead\.id\)\)[\s\S]*?notebookFocus = \{ stop: gs\.current_state, venueId: lead\.id, venueLabel: lead\.label \};[\s\S]*?app\.go\("notebook"\)/, "a questioned witness opens its saved notebook account");
  assert.doesNotMatch(view, /What you heard|Latest witness accounts/, "accounts are read from their notebook entry, not duplicated beneath the leads");
  assert.match(read("scenes/office/LeadGrid.svelte"), /disabled=\{Boolean\(leaving\) \|\| \(!seen && \(lead\.options\.length === 0 \|\| Boolean\(shut\)\)\)\}/, "questioned witnesses remain interactive");
  assert.doesNotMatch(read("scenes/office/LeadGrid.svelte"), /info\.who|info\.blurb/, "lead cards only show the venue name and image");
  assert.match(read("screens/case/Notebook.svelte"), /data-focused-note/);
});

test("the room opens the case terminal directly after a witness and retains other office entries", () => {
  const view = read("scenes/office/Room.svelte"), stage = read("scenes/shared/Stage.svelte"), app = read("state/app.svelte.ts");
  assert.match(view, /\{#if inCase\}<CaseTerminal/);
  assert.match(view, /!app\.briefing && isCaseScreen\(app\.screen\)/, "the briefing is still the desk's");
  assert.match(view, /const quick = app\.returning/);
  assert.match(view, /introFrom=\{T_RETURN_FROM\}/);
  assert.match(stage, /startSeconds: looking \? exploreAt : intro \?/, "exploration resumes at the seated pause");
  assert.match(stage, /quick \? introFrom : seen && exploreAt !== undefined \? exploreAt : 0/, "the first visit walks in; returns and repeat entries start seated");
  assert.match(stage, /\(detail\.resolved\.renderer === "3d" \|\| Boolean\(load2d\)\) && \(!seen \|\| quick \|\| exploreAt !== undefined\)/, "the return plays even though the walk-in has already been seen");
  assert.match(view, /const startAtDesk = app\.directDeskEntry/);
  assert.match(view, /<Stage[\s\S]*?\{startAtDesk\}/);
  assert.match(view, /onMount\(\(\) => \{[^}]*app\.directDeskEntry = false;/, "consume the entry flag without changing the captured Stage prop");
  assert.match(stage, /const playIntro = !startAtDesk &&/, "direct entries cannot start the office intro");
  assert.match(stage, /startAtDesk \? "desk" : playIntro/, "the desk is interactive immediately");
  assert.match(stage, /let glass = \$state\(startAtDesk \? 1 :/, "the desk is visible immediately");
  assert.match(stage, /let continued = startAtDesk \|\|/, "renderer failures and detail changes cannot reintroduce the exploration gate");
  assert.match(app, /leaveWitness\(\) \{[^}]*this\.returning = false;/s);
});

test("the witness scene leaves by the same vehicle, and only when motion is allowed", () => {
  const driver = read("scenes/witness/witness-driver.ts");
  assert.match(driver, /planScene\(options\.arrival, words\.length, !options\.reducedMotion\)/);
  assert.match(driver, /plan\.speechEnd \+ 0\.35/, "the caption goes soon after the last word");
});
