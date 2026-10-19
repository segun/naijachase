import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith("telemetry.ts")) return { url: "data:text/javascript,export const reportPerformanceEvent=()=>{}", shortCircuit: true };
    if (specifier === "@babylonjs/loaders/glTF/2.0/glTFLoader.js") return next(specifier, context);
    if (specifier.startsWith("@babylonjs/core/") && !specifier.endsWith(".js")) return next(`${specifier}.js`, context);
    return next(specifier, context);
  }
});

class BrowserWindow extends EventTarget {
  setTimeout = setTimeout;
  clearTimeout = clearTimeout;
}
globalThis.window ??= new BrowserWindow();
globalThis.location ??= new URL("http://localhost/");

const bytes = fs.readFileSync(new URL("../public/assets/3d/vehicles/car_player_runabout.glb", import.meta.url));
const originalFetch = globalThis.fetch;
const loader = await import("../src/scenes/shared/chase3d-models.ts");

test.after(() => { globalThis.fetch = originalFetch; loader.trimModelCache(0); });

test("repeated scene transitions reuse one parsed container and release every scene resource", async () => {
  let fetches = 0;
  globalThis.fetch = async (_url, options) => {
    options?.signal?.throwIfAborted();
    fetches++;
    return new Response(bytes, { status: 200 });
  };

  for (let i = 0; i < 12; i++) {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const controller = new AbortController();
    loader.bindModelLoadSignal(scene, controller.signal);
    const first = await loader.loadModel(scene, "car_player_runabout", { priority: "critical" });
    const second = await loader.loadModel(scene, "car_player_runabout", { priority: "critical" });
    assert.ok(first && second);
    assert.equal(loader.modelCacheStats().handles, 2);
    first.dispose(); second.dispose();
    controller.abort();
    scene.dispose(); engine.dispose();
    assert.equal(scene.isDisposed, true);
    assert.equal(loader.modelCacheStats().entries, 0);
    assert.equal(loader.modelCacheStats().handles, 0);
  }
  assert.equal(fetches, 1, "the immutable GLB download is reused across scene transitions");
  loader.trimModelCache(0);
});

test("aborting a replaced scene cancels an in-flight model fetch", async () => {
  let requestSignal;
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    requestSignal = options.signal;
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  });
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const controller = new AbortController();
  loader.bindModelLoadSignal(scene, controller.signal);
  const pending = loader.loadModel(scene, "car_player_runabout", { priority: "critical" });
  await new Promise(resolve => setTimeout(resolve, 0));
  controller.abort();
  assert.equal(await pending, null);
  assert.equal(requestSignal.aborted, true);
  assert.deepEqual(loader.modelCacheStats(), { entries: 0, byteEntries: 0, byteSize: 0, loading: 0, handles: 0, queued: 0, active: 0 });
  scene.dispose(); engine.dispose();
});

test("memory-pressure trimming removes least-recently-used inactive containers", async () => {
  globalThis.fetch = async () => new Response(bytes, { status: 200 });
  const resources = [];
  for (let i = 0; i < 10; i++) {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const model = await loader.loadModel(scene, "car_player_runabout");
    assert.ok(model); model.dispose();
    resources.push({ scene, engine });
  }
  assert.equal(loader.modelCacheStats().entries, 10);
  window.dispatchEvent(new Event("memorypressure"));
  assert.equal(loader.modelCacheStats().entries, 8);
  loader.trimModelCache(2);
  assert.equal(loader.modelCacheStats().entries, 2);
  resources.forEach(({ scene, engine }) => { scene.dispose(); engine.dispose(); });
  assert.equal(loader.modelCacheStats().entries, 0);
});
