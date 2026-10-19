import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { frameAt, panelFov, planPanel, resumeTime, SEATS, SEAT_X, LAYOUT } from "../src/scenes/panel/panel-scene.ts";
import { FOV } from "../src/scenes/shared/scene-core.ts";

const votes = ["warning", "punish", "punish", "warning", "punish"];
const plan = planPanel(votes);
const read = file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("the judges raise their papers one after the other, in the order the server returned", () => {
  assert.equal(plan.votes.length, SEATS);
  for (let i = 1; i < SEATS; i++) assert.ok(plan.raiseAt[i] > plan.raiseAt[i - 1]);
  const mid = frameAt(plan, plan.raiseAt[2] + plan.raiseFor + 0.01);
  assert.deepEqual(mid.revealed, ["warning", "punish", "punish", null, null]);
  assert.equal(mid.verdict, false);
});

test("the scene cuts to accepting judgement only after the last paper is up", () => {
  const lastUp = plan.raiseAt[SEATS - 1] + plan.raiseFor;
  assert.ok(plan.cutAt > lastUp);
  assert.equal(frameAt(plan, lastUp + 0.01).verdict, false);
  assert.deepEqual(frameAt(plan, lastUp + 0.01).revealed, votes);
  const after = frameAt(plan, plan.cutAt + 0.01);
  assert.equal(after.verdict, true);
  assert.equal(frameAt(plan, plan.cutAt).fade, 0, "the cut happens in a dip to black");
  assert.equal(frameAt(plan, plan.end).fade, 1);
  assert.ok(frameAt(plan, plan.end).bow > 0.99);
});

test("the scene starts from black and never changes a vote", () => {
  assert.equal(frameAt(plan, 0).fade, 0);
  assert.deepEqual(frameAt(plan, plan.end).revealed, votes);
  assert.ok(resumeTime(plan, 0) === 0 && resumeTime(plan, 2) > plan.raiseAt[1] && resumeTime(plan, SEATS) === plan.cutAt);
});

test("the 3D scene is lazy and the 2D panel is the fallback", () => {
  const view = read("scenes/panel/PanelScene.svelte");
  assert.match(view, /import\("\.\/chase3d-panel\.ts"\)/);
  assert.match(view, /<PanelPresentation/);
  assert.match(view, /detail\.resolved/);
  assert.match(read("App.svelte"), /scenes\/panel\/PanelScene\.svelte/);
  for (const file of ["scenes/panel/panel-scene.ts", "scenes/panel/PanelScene.svelte"]) assert.doesNotMatch(read(file), /@babylonjs/);
  assert.match(view, /if \(verdict\) return;/, "the stall watchdog must not hand over once the verdict is showing");
});

test("Full detail uses seated judge and player models while retaining procedural vote papers", () => {
  const scene = read("scenes/panel/chase3d-panel.ts");
  assert.match(scene, /if \(options\.models\) void afterBrowserIdle\(async \(\) =>/);
  assert.match(scene, /loadModel\(scene, `judge_\$\{i \+ 1\}`, \{ priority: "decorative" \}\)/);
  assert.match(scene, /stage\.addModelFigure\(options\.preset\)/);
  assert.match(scene, /judgeBodies\[i\]!\.setEnabled\(false\)/, "the procedural judge remains the per-model fallback");
  assert.match(scene, /plane\(`paper\$\{i\}`/);
  assert.match(scene, /RightArm/);
  assert.match(scene, /options\.signal\?\.addEventListener/);
});

test("portrait framing keeps all five judges and papers in view without moving through the walls", () => {
  for (const [w, h] of [[320, 568], [393, 852], [430, 932], [852, 393], [1280, 720]]) {
    const aspect = w / h, fov = panelFov(aspect);
    assert.ok(fov >= FOV && fov < Math.PI);
    for (let t = 0; t < plan.cutAt; t += 0.1) {
      const shot = frameAt(plan, t).camera;
      // The old portrait dolly moved this camera behind the front wall at z=-7.6.
      assert.ok(shot.position[2] > -7.45 && shot.position[2] < LAYOUT.benchZ);
      const dy = shot.target[1] - shot.position[1], dz = shot.target[2] - shot.position[2];
      const length = Math.hypot(dy, dz);
      for (const x of SEAT_X) {
        for (const point of [[x, 1.95, LAYOUT.judgeZ], [x + 0.8, LAYOUT.paperRaised + 0.23, LAYOUT.judgeZ - 0.4]]) {
          const depth = ((point[1] - shot.position[1]) * dy + (point[2] - shot.position[2]) * dz) / length;
          const halfWidth = depth * Math.tan(fov / 2) * aspect;
          assert.ok(Math.abs(point[0]) < halfWidth, `${w}x${h} at ${t}: edge judge/paper is cropped`);
        }
      }
    }
    const end = frameAt(plan, plan.end).camera;
    assert.ok(end.position[2] < LAYOUT.benchZ, "verdict camera stays in front of the bench and judge models");
  }
  assert.equal(panelFov(NaN), FOV);
  assert.equal(panelFov(0), FOV);
});
