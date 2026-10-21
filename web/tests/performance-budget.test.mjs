import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("production bundle budgets fail the build when exceeded", () => {
  const budget = read("../dev/check-budget.mjs");
  assert.match(budget, /initialJs:\s*62 \* 1024/);
  assert.match(budget, /initialCss:\s*10 \* 1024/);
  assert.match(budget, /lazyJsTotal:\s*975 \* 1024/);
  assert.match(budget, /lazyJsChunk:\s*365 \* 1024/);
  assert.match(budget, /process\.exitCode = 1/);
  assert.doesNotMatch(budget, /advisory size target/);
});

test("Babylon stays lazy without forced package-internal chunk cycles", () => {
  const vite = read("../vite.config.ts");
  assert.match(vite, /chunkSizeWarningLimit:\s*500/);
  assert.doesNotMatch(vite, /manualChunks/);
  const models = read("../src/scenes/shared/chase3d-models.ts");
  assert.match(models, /@babylonjs\/loaders\/glTF\/2\.0\/glTFLoader\.js/);
  assert.doesNotMatch(models, /import\("@babylonjs\/loaders\/glTF\/2\.0"\)/);
});
