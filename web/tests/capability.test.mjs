import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as cap from "../src/scenes/shared/scene-capability.ts";

const desktop = { viewportWidth: 1440, reducedMotion: false, saveData: false, coarsePointer: false, cores: 12, memoryGb: 8, connection: "4g" };

test("a capable desktop gets the full 3D scene", () => {
  assert.deepEqual(cap.decideScene(desktop), { run: true, quality: "high" });
});

test("3D is never started on phones and other narrow screens", () => {
  for (const width of [360, 390, 768, 960]) assert.deepEqual(cap.decideScene({ ...desktop, viewportWidth: width }), { run: false, reason: "narrow" });
  assert.equal(cap.decideScene({ ...desktop, viewportWidth: cap.MIN_WIDTH }).run, true);
});

test("it is skipped for reduced motion, Save-Data, slow networks and very low memory", () => {
  assert.equal(cap.decideScene({ ...desktop, reducedMotion: true }).reason, "reduced-motion");
  assert.equal(cap.decideScene({ ...desktop, saveData: true }).reason, "save-data");
  for (const c of ["slow-2g", "2g", "3g"]) assert.equal(cap.decideScene({ ...desktop, connection: c }).reason, "slow-network");
  assert.equal(cap.decideScene({ ...desktop, memoryGb: 1 }).reason, "low-memory");
  assert.equal(cap.decideScene({ ...desktop, connection: "4g" }).run, true);
});

test("weaker devices (few cores, little memory, touch screens) get the light tier", () => {
  assert.equal(cap.decideScene({ ...desktop, cores: 4 }).quality, "light");
  assert.equal(cap.decideScene({ ...desktop, memoryGb: 4 }).quality, "light");
  assert.equal(cap.decideScene({ ...desktop, coarsePointer: true }).quality, "light");
  assert.equal(cap.decideScene({ ...desktop, cores: undefined, memoryGb: undefined }).quality, "high", "unknown signals do not downgrade");
});

test("the frame-rate guard needs sustained slowness and ignores single dips", () => {
  assert.equal(cap.tooSlow([]), false);
  assert.equal(cap.tooSlow([5, 5]), false, "too few samples");
  assert.equal(cap.tooSlow([60, 4, 60, 60]), false);
  assert.equal(cap.tooSlow([12, 14, 15]), true);
  assert.equal(cap.tooSlow([60, 60, 18, 15, 12]), true);
});

test("the stage gates the download, waits for idle, and falls back one way to 2D", () => {
  const stage = fs.readFileSync(new URL("../src/scenes/chase/ChaseStage.svelte", import.meta.url), "utf8");
  assert.match(stage, /decideScene\(readDevice\(\)\)/);
  assert.match(stage, /requestIdleCallback/);
  assert.match(stage, /onSlow: \(\) => \{ failed = true; \}/);
  // the import() is only reachable from inside the effect guarded by `want`
  assert.match(stage, /if \(!want \|\| !target \|\| !decision\.run\) return;/);
  const scene = fs.readFileSync(new URL("../src/scenes/chase/chase3d.ts", import.meta.url), "utf8");
  assert.match(scene, /quality === "light"/);
  assert.match(scene, /light \? null : new GlowLayer/);
  assert.match(scene, /light \? null : new ShadowGenerator/);
  assert.match(scene, /tooSlow\(samples\)/);
});

test("the 3D panel is hidden by CSS at the same breakpoint the capability gate uses", () => {
  const css = fs.readFileSync(new URL("../src/styles/screens.css", import.meta.url), "utf8");
  assert.match(css, new RegExp(`@media \\(max-width: ${cap.MIN_WIDTH - 1}px\\)[\\s\\S]*?\\.auth-side \\{ display: none; \\}`));
});
