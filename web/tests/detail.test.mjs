import test from "node:test";
import assert from "node:assert/strict";
import { resolveDetail, parseChoice, needsRebuild, detailKey } from "../src/scenes/shared/detail-level.ts";

const strong = { viewportWidth: 1400, reducedMotion: false, saveData: false, connection: "4g", memoryGb: 8, cores: 8, coarsePointer: false };
const modest = { ...strong, memoryGb: 4, cores: 4 };

test("automatic follows the device: full, standard or simple", () => {
  assert.deepEqual([resolveDetail("auto", strong).level, resolveDetail("auto", strong).models], ["full", true]);
  const m = resolveDetail("auto", modest);
  assert.deepEqual([m.level, m.renderer, m.models, m.quality], ["standard", "3d", false, "light"]);
  for (const weak of [{ saveData: true }, { connection: "3g" }, { memoryGb: 1 }]) {
    const r = resolveDetail("auto", { ...strong, ...weak });
    assert.deepEqual([r.level, r.renderer, r.models], ["simple", "2d", false], JSON.stringify(weak));
  }
});

test("the player's choice wins over the device, except for reduced motion", () => {
  const weak = { ...strong, saveData: true, memoryGb: 1 };
  assert.equal(resolveDetail("full", weak).models, true, "a player who asks for full gets models even on Data Saver");
  assert.equal(resolveDetail("standard", strong).models, false);
  assert.equal(resolveDetail("simple", strong).renderer, "2d");
  const calm = resolveDetail("full", { ...strong, reducedMotion: true });
  assert.deepEqual([calm.level, calm.reducedMotion], ["simple", true]);
});

test("only the full level allows model downloads", () => {
  for (const choice of ["auto", "full", "standard", "simple"]) for (const d of [strong, modest, { ...strong, saveData: true }]) {
    const r = resolveDetail(choice, d);
    assert.equal(r.models, r.level === "full", `${choice}`);
  }
});

test("a narrow window does not change the scene level (the scenes are full-screen)", () => {
  assert.equal(resolveDetail("auto", { ...strong, viewportWidth: 400 }).level, "full");
});

test("unknown saved values become automatic", () => {
  assert.equal(parseChoice("full"), "full");
  assert.equal(parseChoice("ultra"), "auto");
  assert.equal(parseChoice(null), "auto");
});

test("the rebuild key changes only when the renderer, models or quality change", () => {
  const a = resolveDetail("full", strong), b = resolveDetail("standard", strong), c = resolveDetail("simple", strong);
  assert.ok(needsRebuild(a, b) && needsRebuild(b, c) && needsRebuild(a, c));
  assert.equal(needsRebuild(a, resolveDetail("full", strong)), false);
  assert.notEqual(detailKey(a), detailKey(b));
});
