import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { RAID_SECONDS, raidFrame, raidLineAt, raidLines, raidStart, streetSeconds } from "../src/scenes/chase/raid-scene.ts";
import { chaseFrame } from "../src/scenes/chase/chase-frame.ts";
import { raidQuote } from "../src/domain/model.ts";

const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const q = (mode, cost, travel, affordable = true) => ({ scope: "apprehension", destination_id: "market", label: "Market", mode, cost, travel_minutes: travel, wait_minutes: 0, affordable, rules_version: 1 });

test("a raid lasts five to ten seconds either way", () => {
  for (const ending of ["escape", "catch"]) assert.ok(RAID_SECONDS[ending] >= 5 && RAID_SECONDS[ending] <= 10, ending);
});

test("a raid opens as the login chase does, then the street slows", () => {
  const start = raidStart("Lagos");
  for (const ending of ["escape", "catch"]) {
    const a = raidFrame(0.5, ending, start), b = chaseFrame(start + 0.5);
    assert.deepEqual(a.runners.map(r => r.x), b.runners.map(r => r.x), "the opening is the login chase");
    assert.ok(streetSeconds(RAID_SECONDS[ending], ending) < RAID_SECONDS[ending], "the pace drops");
    for (let s = 0.1; s < RAID_SECONDS[ending]; s += 0.1) assert.ok(streetSeconds(s, ending) > streetSeconds(s - 0.1, ending) - 1e-9, "the street never runs backwards");
  }
  assert.ok(raidStart("Kano") > raidStart("Anambra") && raidStart("Anambra") > raidStart("Lagos"), "the raid starts in the hideout's state");
  assert.equal(raidStart("Oyo"), raidStart("Lagos"), "any other state uses Lagos");
});

test("when the suspect is not there the thief outruns the officers", () => {
  const end = raidFrame(RAID_SECONDS.escape, "escape");
  const [thief, ...officers] = end.runners;
  for (const o of officers) assert.ok(thief.x - o.x > 12, `${o.name} is left far behind`);
  assert.ok(thief.x - end.target[0] > 8, "the thief has run out of the picture");
});

test("when the suspect is there the officers close in and the thief gives up", () => {
  const end = raidFrame(RAID_SECONDS.catch, "catch");
  const [thief, ...officers] = end.runners;
  for (const o of officers) assert.ok(Math.hypot(thief.x - o.x, thief.z - o.z) < 1.3, `${o.name} has reached the thief`);
  assert.ok(officers.some(o => o.x > thief.x), "one officer cuts him off ahead");
  assert.equal(thief.raise, 1); assert.equal(thief.stand, 1);
  assert.ok(thief.pose.armL > 2.5 && thief.pose.armR > 2.5, "hands up");
  assert.ok(Math.abs(thief.pose.thighL) < 1e-6 && Math.abs(thief.pose.thighR) < 1e-6, "standing still");
});

test("the captions name the warrant suspect and follow the ending", () => {
  const escape = raidLines("escape", "Chief Eze", 0);
  assert.ok(escape.slice(0, 2).every(l => l.text.includes("Chief Eze")));
  assert.notEqual(raidLines("escape", "Chief Eze", 1)[0].text, escape[0].text, "another raid opens differently");
  assert.match(escape.at(-1).text, /^Chief Eze /);
  assert.notEqual(escape[0].text, escape[1].text, "the two openers differ");
  const endings = new Set(), openers = new Set();
  for (let seed = 0; seed < 40; seed++) {
    const lines = raidLines("escape", "Chief Eze", seed);
    assert.notEqual(lines[0].text, lines[1].text);
    assert.doesNotMatch(lines.at(-1).text, /not (here|this|at)|hideout/i, "an escape never says the suspect was not there");
    openers.add(lines[0].text); endings.add(lines.at(-1).text);
  }
  assert.ok(openers.size >= 12 && endings.size >= 10, "plenty of variety");
  for (const line of raidLines("escape", "", 3)) assert.doesNotMatch(line.text, /! the suspect/, "the name is capitalised after an exclamation");
  assert.match(raidLines("escape", "", 0)[0].text, /^You.re closing in on the suspect/);
  assert.match(raidLines("escape", "", 0).at(-1).text, /^The suspect /);
  assert.match(raidLines("catch", "Chief Eze").at(-1).text, /Chief Eze is under arrest/);
  assert.equal(raidLines("escape", "X", 0, "Time has run out.").at(-1).text, "Time has run out.");
  for (const ending of ["escape", "catch"]) {
    const lines = raidLines(ending, "X");
    assert.ok(lines.at(-1).to <= RAID_SECONDS[ending] + 1e-9);
    assert.equal(raidLineAt(lines, RAID_SECONDS[ending]), lines.at(-1), "the last caption stays up to the end");
  }
});

test("a raid drives when the player can afford it and otherwise hitches a ride", () => {
  assert.equal(raidQuote([q("drive", 120, 20), q("hitch_ride", 0, 56)]).mode, "drive");
  assert.equal(raidQuote([q("drive", 120, 20, false), q("hitch_ride", 0, 56)]).mode, "hitch_ride");
  assert.equal(raidQuote([q("drive", 120, 20, false)]), null);
});

test("the raid list offers no transport choice and greys out searched hideouts", () => {
  const warrant = read("screens/case/Warrant.svelte");
  assert.doesNotMatch(warrant, /MoveOptions|MoveDialog/);
  assert.match(warrant, /Raid this location/);
  assert.match(warrant, /searched_hideouts/);
  assert.match(warrant, /disabled=\{app\.busy \|\| done/);
});

test("the raid scene follows the 3D-with-2D-fallback rule and returns through the controller", () => {
  const scene = read("scenes/chase/RaidScene.svelte"), app = read("state/app.svelte.ts");
  assert.match(scene, /createChaseScene\(/);
  assert.match(scene, /createChase2d\(/);
  assert.match(scene, /broken = true/, "a 3D failure continues in 2D");
  assert.match(scene, /app\.leaveRaid\(\)/);
  assert.match(app, /"journey", "raid"\]/, "the raid stays inside a weekly attempt");
  assert.match(app, /payload\.type === "search_hideout" && this\.playRaid\(\)/);
});
