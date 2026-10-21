import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as w from "../src/scenes/witness/witness-scene.ts";
import * as recipes from "../src/scenes/witness/venue-recipes.ts";
import * as layout from "../src/scenes/witness/market-layout.ts";
import { random } from "../src/scenes/witness/witness-audio.ts";

const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const words = n => Array.from({ length: n }, (_, i) => (i % 9 === 8 ? "word." : "word"));
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test("the scene length follows the number of words: 10 to 15 seconds up to the last word, never more than the cap, plus a short leave", () => {
  for (const arrival of ["drive", "hitch"]) {
    const short = w.planScene(arrival, 14), typical = w.planScene(arrival, 26), long = w.planScene(arrival, 48), huge = w.planScene(arrival, 400);
    const talk = p => p.speechEnd + 0.8;
    assert.ok(talk(short) >= 9.5 && talk(short) <= 12.5, `${arrival} short ${talk(short).toFixed(1)}s`);
    assert.ok(talk(typical) >= 12 && talk(typical) <= 15.5, `${arrival} typical ${talk(typical).toFixed(1)}s`);
    assert.ok(talk(long) > talk(typical) && talk(long) <= w.MAX_SECONDS);
    assert.ok(talk(huge) <= w.MAX_SECONDS && talk(huge) >= talk(long), "even an enormous account never runs past the cap");
    assert.ok(talk(short) < talk(typical), "a short answer is not padded to the length of a long one");
    for (const p of [short, typical, long, huge]) {
      const leave = p.end - p.speechEnd;
      assert.ok(leave > 2.5 && leave <= w.MAX_LEAVE_SECONDS + 0.5, `${arrival}: leaving takes ${leave.toFixed(2)}s`);
      assert.ok(p.end - p.leaveStart <= w.MAX_LEAVE_SECONDS, `${arrival}: from the cut to the end ${(p.end - p.leaveStart).toFixed(2)}s`);
    }
  }
  const still = w.planScene("drive", 26, false);
  assert.equal(still.leave, false);
  assert.ok(still.end <= still.speechEnd + 0.81, "without leaving (reduced motion) the scene ends just after the conversation");
});

test("the plan is in order: arrive, step out, walk, greet, speak, cut, walk back, board, away, fade", () => {
  for (const arrival of ["drive", "hitch"]) {
    const p = w.planScene(arrival, 26);
    const order = [0, p.lead, p.stopped, p.walkStart, p.walkEnd, p.speechStart, p.speechEnd, p.leaveStart, p.backAt, p.boarded, p.end];
    order.slice(1).forEach((v, i) => assert.ok(v > order[i], `${arrival} step ${i}`));
    assert.ok(close(p.speechEnd - p.speechStart, p.speech));
  }
});

test("speech timings cover the words in order, with a longer pause after a sentence than after a comma", () => {
  const list = ["Hello,", "my", "friend.", "Listen", "carefully."];
  const t = w.wordTimings(list, 4);
  t.forEach((x, i) => { assert.ok(x.end > x.start); if (i) assert.ok(x.start >= t[i - 1].end - 1e-9); });
  assert.ok(close(t.at(-1).end, 4, 1e-9), "the last word ends exactly when the speech does");
  const gapComma = t[1].start - t[0].end, gapSentence = t[3].start - t[2].end;
  assert.ok(gapComma > 0 && gapSentence > gapComma, "pauses: sentence longer than comma");
  assert.deepEqual(w.wordTimings([], 3), []);
});

test("subtitles page at sentence ends, never run past the page size, and cover every word once", () => {
  const text = "The buyer asked for the road to the big river city. He paid in crisp notes, and he was tall with a scar on his chin and a red cap. I also noticed he limped.";
  const list = w.wordsOf(text);
  const pages = w.subtitlePages(list, 14);
  assert.equal(pages[0].from, 0);
  pages.forEach((p, i) => { assert.ok(p.to - p.from <= 18); if (i) assert.equal(p.from, pages[i - 1].to); });
  assert.equal(pages.at(-1).to, list.length);
  assert.ok(pages.at(-1).to - pages.at(-1).from >= 4, "no one-word orphan page");
  assert.deepEqual(w.subtitlePages([]), []);
});

test("the subtitle shows the page being spoken and how many words have been said", () => {
  const list = w.wordsOf("One two three four five six. Seven eight nine ten eleven twelve.");
  const pages = w.subtitlePages(list, 14);
  const t = w.wordTimings(list, 6);
  assert.equal(w.subtitleAt(t, pages, -0.1).spoken, 0);
  assert.equal(w.subtitleAt(t, pages, 0.001).spoken, 1);
  assert.equal(w.subtitleAt(t, pages, 6).spoken, list.length);
  let last = 0;
  for (let s = 0; s <= 6; s += 0.05) { const st = w.subtitleAt(t, pages, s); assert.ok(st.spoken >= last, "words are only ever added"); last = st.spoken; }
  const mid = w.subtitleAt(t, pages, t[8].start + 0.01);
  assert.equal(pages[mid.page].from <= 8 && 8 < pages[mid.page].to, true, "the page contains the word being spoken");
});

test("the mouth opens on each syllable, closes in the pauses and is shut outside the speech", () => {
  const t = w.wordTimings(["Good", "morning."], 2);
  assert.equal(w.mouthAt(t, -1), 0);
  assert.equal(w.mouthAt(t, 5), 0);
  let max = 0, moved = false, prev = -1;
  for (let s = 0; s <= 2; s += 0.02) { const m = w.mouthAt(t, s); assert.ok(m >= 0 && m <= 1); max = Math.max(max, m); if (prev >= 0 && Math.abs(m - prev) > 0.05) moved = true; prev = m; }
  assert.ok(max > 0.5 && moved, "the mouth visibly moves");
});

test("the player is in the vehicle until it stops, then gets out and walks to the witness without teleporting", () => {
  for (const arrival of ["drive", "hitch"]) {
    const p = w.planScene(arrival, 26);
    let last = w.playerPoseAt(p, 0);
    for (let t = 0.02; t <= p.speechEnd; t += 0.02) {
      const q = w.playerPoseAt(p, t);
      const jump = Math.hypot(q.x - last.x, q.z - last.z);
      assert.ok(jump < (t < p.stopped ? 0.3 : 0.1), `${arrival} moves ${jump.toFixed(2)} m in one step at ${t.toFixed(2)}s`);
      last = q;
    }
    const end = w.playerPoseAt(p, p.speechEnd);
    assert.ok(close(end.x, w.MEET.x) && close(end.z, w.MEET.z) && end.stride === 0, "stands at the witness when she finishes");
    assert.ok(Math.abs(Math.sin((end.heading - Math.atan2(-(w.WITNESS.x - w.MEET.x), -(w.WITNESS.z - w.MEET.z))) / 2)) < 1e-6, "facing the witness");
  }
  const drive = w.planScene("drive", 26);
  assert.equal(w.playerPoseAt(drive, 1).sit, 1, "seated while driving in");
  assert.equal(w.playerPoseAt(drive, drive.walkEnd).sit, 0, "standing by the time they walk");
  const hitch = w.planScene("hitch", 26);
  assert.equal(w.playerPoseAt(hitch, 1).visible, false, "inside the minibus until its door opens");
  assert.equal(w.playerPoseAt(hitch, hitch.walkStart).alpha, 1, "visible once down the step");
});

test("after the conversation the player walks back to the vehicle, gets in or on, and is driven away without teleporting", () => {
  for (const arrival of ["drive", "hitch"]) {
    const p = w.planScene(arrival, 26);
    let last = w.playerPoseAt(p, p.leaveStart);
    assert.ok(close(last.x, w.MEET.x, 0.05) && close(last.z, w.MEET.z, 0.05), `${arrival}: starts the walk back from the witness`);
    for (let t = p.leaveStart + 0.02; t <= p.boarded; t += 0.02) {
      const q = w.playerPoseAt(p, t);
      if (q.visible && last.visible) assert.ok(Math.hypot(q.x - last.x, q.z - last.z) < 0.12, `${arrival} jumps at ${t.toFixed(2)}s`);
      last = q;
    }
    const beside = w.playerPoseAt(p, p.backAt);
    assert.ok(close(beside.x, w.EXIT_POINT[arrival][0], 0.05) && close(beside.z, w.EXIT_POINT[arrival][1], 0.05), `${arrival}: stops beside the vehicle`);
    const walk = p.backAt - p.leaveStart;
    assert.ok(walk > 0.8 && walk < 1.8, `${arrival}: the walk back takes ${walk.toFixed(2)}s`);
  }
  const drive = w.planScene("drive", 26), inCar = w.playerPoseAt(drive, drive.boarded + 0.5);
  assert.equal(inCar.sit, 1, "seated in the car as it leaves");
  assert.ok(close(inCar.x, w.vehicleXAt(drive, drive.boarded + 0.5) + w.CAR_SEAT.z), "rides with the car");
  const hitch = w.planScene("hitch", 26);
  assert.equal(w.playerPoseAt(hitch, hitch.boarded).visible, false, "on board the minibus");
  assert.ok(w.playerPoseAt(hitch, hitch.backAt + 0.05).alpha > 0.9, "visible while stepping aboard");
});

test("the vehicle slows to a stop at the kerb; the car waits for the player, the minibus drives off and comes back for them", () => {
  const drive = w.planScene("drive", 26), hitch = w.planScene("hitch", 26);
  assert.equal(w.vehicleXAt(drive, 0), w.VEHICLE_FROM_X);
  assert.ok(close(w.vehicleXAt(drive, drive.stopped), w.VEHICLE_STOP_X));
  assert.ok(close(w.vehicleXAt(drive, drive.boarded - 0.01), w.VEHICLE_STOP_X, 1e-6), "the car stays parked until the player is in it");
  assert.ok(w.vehicleXAt(drive, drive.end) < w.VEHICLE_STOP_X - 9, "then it drives away");
  assert.ok(w.vehicleSpeedAt(drive, drive.lead + 0.2) > 0.3 && w.vehicleSpeedAt(drive, drive.walkStart) < 0.02, "moving, then still");
  assert.ok(w.vehicleXAt(hitch, hitch.walkStart + 2.6) < w.VEHICLE_STOP_X - 9, "the minibus drives off after dropping the player");
  assert.ok(w.vehicleXAt(hitch, w.busReturnStart(hitch)) > w.VEHICLE_STOP_X + 8, "it comes back from the right while the conversation ends");
  assert.ok(close(w.vehicleXAt(hitch, w.busReturnStop(hitch)), w.VEHICLE_STOP_X, 1e-6) && close(w.vehicleXAt(hitch, hitch.boarded - 0.01), w.VEHICLE_STOP_X, 1e-6), "and waits for them at the kerb");
  assert.ok(w.busReturnStop(hitch) < hitch.leaveStart + 1.2, "it has stopped before the player reaches the lane");
  assert.ok(w.vehicleXAt(hitch, hitch.end) < w.VEHICLE_STOP_X - 9, "then it leaves with them");
  for (const p of [drive, hitch]) {
    // Within each run of travel the vehicle only ever moves left, except for the minibus coming back round (a jump while out of sight).
    let last = Infinity;
    for (let t = 0; t <= p.end; t += 0.05) { const x = w.vehicleXAt(p, t); if (x > last + 1) assert.ok(p.arrival === "hitch" && t > p.walkStart + 2.4 && t < p.leaveStart, `${p.arrival}: jumps right at ${t.toFixed(2)}s`); last = x; }
  }
  for (const t of [0.5, 1.5]) assert.ok(w.vehicleXAt(drive, t) >= w.vehicleXAt(drive, t + 0.1), "slowing, never reversing");
  const door = [...Array(120)].map((_, i) => w.busDoorAt(hitch, i * hitch.end / 120));
  assert.ok(door.every(v => v >= 0 && v <= 1) && door.some(v => v > 0.9), "the minibus door opens");
  assert.ok(w.busDoorAt(hitch, hitch.backAt) > 0.9 && w.busDoorAt(hitch, hitch.boarded + 0.5) < 0.05, "open for boarding, shut as it leaves");
});

test("the witness is still until she notices the player, greets, and then talks with her hands", () => {
  const p = w.planScene("drive", 26), t = w.wordTimings(w.wordsOf(Array(26).fill("word").join(" ")), p.speech);
  assert.equal(w.witnessAt(p, t, 0.5).mouth, 0);
  assert.ok(w.witnessAt(p, t, p.walkEnd + 0.3).wave > 0, "she waves in greeting");
  const speaking = Array.from({ length: 40 }, (_, i) => w.witnessAt(p, t, p.speechStart + 0.5 + i * 0.1));
  assert.ok(speaking.some(m => m.mouth > 0.4), "her mouth moves while she speaks");
  assert.ok(speaking.every(m => m.arms[1] > 0.15 && m.elbows[1] > 0.4), "she gestures while she speaks");
  assert.equal(w.witnessAt(p, t, p.end).mouth, 0, "mouth shut at the end");
  assert.ok(w.witnessAt(p, t, p.speechStart + 1).heading > 0.1, "she has turned towards the player");
});

test("the camera is continuous from the arrival shot to the talk shot, then cuts once to the wide shot to watch the player leave", () => {
  for (const arrival of ["drive", "hitch"]) {
    const p = w.planScene(arrival, 26);
    let last = w.cameraAt(p, 0), cuts = 0;
    for (let t = 0.02; t <= p.end; t += 0.02) {
      const c = w.cameraAt(p, t);
      const move = Math.max(Math.hypot(...c.position.map((v, i) => v - last.position[i])), Math.hypot(...c.target.map((v, i) => v - last.target[i])));
      if (move > 0.45) { cuts++; assert.ok(Math.abs(t - p.leaveStart) < 0.03, `${arrival}: unexpected jump at ${t.toFixed(2)}s`); }
      last = c;
    }
    assert.equal(cuts, 1, `${arrival}: exactly one cut`);
    assert.ok(w.cameraAt(p, p.leaveStart).position[2] < -9, "the wide shot looks back at the venue from across the lane");
  }
});

test("the picture dips to black for the cut and is black again at the end", () => {
  const p = w.planScene("drive", 26);
  assert.ok(w.fadeAt(p, p.leaveStart - 0.05) < 0.02, "black at the cut");
  assert.ok(w.fadeAt(p, p.speechEnd) > 0.99 && w.fadeAt(p, p.leaveStart + 0.4) > 0.99, "fully visible either side of it");
  assert.equal(w.fadeAt(p, p.end), 0);
  const still = w.planScene("drive", 26, false);
  for (let t = 1; t < still.end - 0.7; t += 0.1) assert.equal(w.fadeAt(still, t), 1, "no dip when the player does not leave");
});

test("the picture fades in from black at the start and out to black at the end", () => {
  const p = w.planScene("drive", 26);
  assert.equal(w.fadeAt(p, 0), 0);
  assert.equal(w.fadeAt(p, 3), 1);
  assert.equal(w.fadeAt(p, p.end), 0);
});

test("footsteps are counted only while striding", () => {
  assert.equal(w.stepsTaken({ stride: 0, gait: 10 }), -1);
  assert.ok(w.stepsTaken({ stride: 1, gait: 10 }) > w.stepsTaken({ stride: 1, gait: 3 }));
});

test("only venues with a recipe get a witness scene; the market's witnesses and voices are fixed by the account", () => {
  assert.ok(recipes.recipeFor("market"));
  assert.equal(recipes.recipeFor("no_such_venue"), undefined);
  const market = recipes.recipeFor("market");
  assert.equal(recipes.witnessFor(market, "same words").avatar_id, recipes.witnessFor(market, "same words").avatar_id);
  assert.ok(new Set(Array.from({ length: 40 }, (_, i) => recipes.witnessFor(market, `account ${i}`).avatar_id)).size > 2, "different accounts meet different people");
  for (const k of ["crowd", "calls", "hum", "clinks"]) assert.ok(market.sound[k] >= 0 && market.sound[k] <= 1);
  for (const witness of market.witnesses) assert.match(witness.skin_color, /^#[0-9a-f]{6}$/i);
});

test("the garage hands the visit to the witness scene, which loads lazily and never blocks the investigation", () => {
  const app = read("state/app.svelte.ts"), view = read("scenes/witness/WitnessScene.svelte"), root = read("App.svelte");
  assert.match(app, /if \(payload\.type === "visit_venue"\) this\.lastWitness = null;/, "a stale account is never replayed");
  assert.match(read("scenes/office/CaseTerminal.svelte"), /await leave\(\);\s*app\.finishBriefing\(lead\.id\)/, "every later witness is visited the same way: out of the office, through the garage");
  assert.match(read("scenes/garage/GarageRoom.svelte"), /app\.arriveAtWitness\(how\)/);
  assert.match(app, /async arriveAtWitness\(arrival: "drive" \| "hitch"\)/);
  assert.match(app, /recipes\?\.recipeFor\(witness\.venueId\)/, "venues without a scene go straight to the investigation");
  assert.match(app, /import\("\.\.\/scenes\/witness\/venue-recipes\.ts"\)/, "recipes load on demand, not in the first download");
  assert.match(app, /leaveWitness\(\) \{\s*this\.witnessVisit = null;/);
  assert.match(root, /import\("\.\/scenes\/witness\/WitnessScene\.svelte"\)/);
  assert.match(view, /import\("\.\/chase3d-witness\.ts"\)/, "Babylon.js is a dynamic import");
  assert.doesNotMatch(app + root, /from "[^"]*chase3d-witness/, "the 3D scene is not in the main bundle");
  assert.match(view, /await done;[\s\S]*holding=true/, "completion pauses for exploration");
  assert.doesNotMatch(view, /if\s*\(reading\)\s*return/, "reading preserves the renderer");
  assert.match(view, /import\("\.\/witness-2d\.ts"\)/, "weak devices keep the location");
  assert.match(view, /resumeAt=at/, "fallback retains elapsed time");
  assert.match(view, /onFault:/);
  assert.match(view, /level\.renderer==="3d"&&!broken/);
  assert.match(view, /class="witness-account-text">\{visit\?\.message\}/);
  assert.match(view, /onclick=\{leave\}/, "only leaving hands off to the office");
  assert.match(view, /Return to office/);
  assert.match(view, /controller\.abort\(\)/);
  assert.match(view, /class="witness-caption" aria-hidden="true"/);
  assert.match(view, /role="status">\{#if heard/);

});

test("the voice and the layout random generators accept any seed: a negative one once crashed the scene for some accounts", () => {
  for (const seed of [-1, -123456789, 0, 1, 2 ** 31, 2 ** 32 + 5, -(2 ** 40), 3.7, Number.MAX_SAFE_INTEGER]) {
    const r = random(seed);
    for (let i = 0; i < 200; i++) { const v = r(); assert.ok(v >= 0 && v < 1, `seed ${seed} gave ${v}`); assert.ok(Math.floor(v * 5) >= 0); }
  }
  for (const seed of [-5, 0, 100, 2 ** 33]) assert.ok(layout.lookOf(seed).skin.startsWith("#"));
  for (let i = 0; i < 300; i++) assert.ok(recipes.witnessFor(recipes.recipeFor("market"), `text ${i} ${i % 2 ? "é" : ""}`).pitch > 0);
});

test("the shared market layout: the witness's stall is first, walkers stay in range and are the same for any frame", () => {
  assert.equal(layout.STALLS[0].x, w.WITNESS.x);
  assert.equal(layout.STALLS[0].frontPoles, false, "nothing between the camera and the witness");
  for (const count of [layout.crowdSize(true), layout.crowdSize(false)]) for (let i = 0; i < count; i++) {
    for (let t = 0; t < 40; t += 0.7) { const a = layout.walkerAt(i, count, t); assert.ok(a.x >= -10 && a.x < 10); assert.deepEqual(a, layout.walkerAt(i, count, t)); }
  }
  assert.deepEqual(layout.lookOf(101), layout.lookOf(101));
  assert.ok(layout.crowdSize(true) < layout.crowdSize(false));
});

test("the 3D and 2D renderers share one driver and the conventions are written down", () => {
  const d3 = read("scenes/witness/chase3d-witness.ts"), d2 = read("scenes/witness/witness-2d.ts"), driver = read("scenes/witness/witness-driver.ts");
  assert.match(d3, /createDriver\(options\)/);
  assert.match(d2, /createDriver\(options\)/);
  assert.doesNotMatch(d2 + driver + read("scenes/witness/market-layout.ts"), /@babylonjs/, "only the 3D renderer imports Babylon.js");
  assert.match(d3, /onFault/); assert.match(d2, /onFault/);
  assert.match(driver, /try \{[\s\S]*audio\.engine[\s\S]*\} catch/, "a sound error never stops the picture");
  const conv = fs.readFileSync(new URL("../../docs/scene-conventions.md", import.meta.url), "utf8"), agents = fs.readFileSync(new URL("../../AGENTS.md", import.meta.url), "utf8");
  assert.match(conv, /Office, garage and witness scenes use the two-renderer rule/);
  assert.match(conv, /Witnesses pause at `plan.speechEnd`/);
  assert.match(conv, /Return to office/);
  assert.match(conv, /Journey retains its existing functional Simple handoff/);
  assert.match(agents, /scene-conventions\.md/);
});

test("the 2D renderer plays the same plan: its start can be given, and reduced motion starts at the conversation", () => {
  const d2 = read("scenes/witness/witness-2d.ts"), drv = read("scenes/witness/witness-driver.ts");
  assert.match(d2, /start\(begin = options\.reducedMotion \? plan\.walkEnd : 0\)/);
  assert.match(drv, /start\(from\?: number\)/);
});

test("a fading figure is always hidden once its alpha reaches zero, even after a near-zero frame", () => {
  // glTF materials are opaque, so a figure left enabled at a tiny alpha is drawn in full (the player was left on the road while the bus left).
  for (const file of ["scenes/shared/chase3d-model-figure.ts", "scenes/shared/chase3d-stage.ts"]) {
    const src = read(file);
    assert.match(src, /const shown = alpha > 0\.002;\s*if \(Math\.abs\(alpha - last\) <= 0\.004 && shown === last > 0\.002\) return;/, file);
    assert.match(src, /setEnabled\(shown\)/, file);
  }
  const plan = w.planScene("hitch", 24);
  assert.equal(w.playerPoseAt(plan, plan.boarded).alpha, 0);
  assert.equal(w.playerPoseAt(plan, plan.boarded).visible, false);
});
