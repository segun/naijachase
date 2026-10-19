// Loads the generated GLB models (public/assets/3d, described in model-manifest.ts) into a Babylon.js scene, scaled to their real size and
// facing the way the game expects. A model that cannot be loaded gives null, and the caller carries on with the shapes it already builds
// in code, so a missing or broken file never leaves a blank scene. Lazy: nothing here is in the main bundle.
import type { Scene } from "@babylonjs/core/scene";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import "@babylonjs/core/Shaders/pbr.vertex";
import "@babylonjs/core/Shaders/pbr.fragment";
import { baseYaw, measureOf, modelSpec, modelUrl, type ModelSpec } from "./model-manifest.ts";
import { reportPerformanceEvent } from "../../telemetry.ts";

export type ModelHandle = {
  id: string;
  spec: ModelSpec;
  /** Place and turn this node; it stands on its own origin (feet or base centre) and faces -z at yaw 0 (people and animals). */
  root: TransformNode;
  meshes: AbstractMesh[];
  /** The model's own movements by lower-case name (walk, run, sit). Empty for props and vehicles. */
  clips: Map<string, AnimationGroup>;
  skeletons: Skeleton[];
  /** The node the model is fitted inside (scale, facing, offset). Scenes may adjust its height, for example to seat a figure. */
  fit: TransformNode;
  dispose(): void;
};

type CacheEntry = {
  key: string;
  scene: Scene;
  id: string;
  promise: Promise<AssetContainer | null>;
  container: AssetContainer | null;
  controller: AbortController;
  lastUsed: number;
  handles: number;
  evicted: boolean;
};
const MAX_CONTAINER_CACHE = 32;
const MEMORY_PRESSURE_TARGET = 8;
const MAX_BYTE_CACHE = 16;
const MAX_BYTE_CACHE_SIZE = 64 * 1024 * 1024;
const containerCache = new Map<string, CacheEntry>();
const byteCache = new Map<string, { bytes: Uint8Array; lastUsed: number }>();
const sceneIds = new WeakMap<Scene, number>();
const sceneSignals = new WeakMap<Scene, AbortSignal>();
const observedScenes = new WeakSet<Scene>();
let nextSceneId = 1;
let loaderReady: Promise<unknown> | null = null;
const warned = new Set<string>();
export type ModelPriority = "critical" | "nearby" | "decorative";
type LoadJob<T> = { priority: number; run: () => Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void; signal?: AbortSignal; removeAbort?: () => void };
const MAX_MODEL_WORK = 4;
const MAX_BACKGROUND_WORK = 2;
let activeModelWork = 0;
let activeBackgroundWork = 0;
const modelQueue: LoadJob<unknown>[] = [];

const priorityNumber = (priority: ModelPriority) => priority === "critical" ? 0 : priority === "nearby" ? 1 : 2;
function pumpModelQueue() {
  while (activeModelWork < MAX_MODEL_WORK) {
    modelQueue.sort((a, b) => a.priority - b.priority);
    const index = modelQueue.findIndex(job => job.priority === 0 || activeBackgroundWork < MAX_BACKGROUND_WORK);
    if (index < 0) return;
    const [job] = modelQueue.splice(index, 1);
    if (!job) return;
    job.removeAbort?.();
    if (job.signal?.aborted) { job.reject(job.signal.reason ?? new DOMException("Model load cancelled", "AbortError")); continue; }
    activeModelWork++;
    if (job.priority > 0) activeBackgroundWork++;
    void job.run().then(job.resolve, job.reject).finally(() => {
      activeModelWork--;
      if (job.priority > 0) activeBackgroundWork--;
      pumpModelQueue();
    });
  }
}

function scheduled<T>(priority: ModelPriority, run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason ?? new DOMException("Model load cancelled", "AbortError")); return; }
    const job: LoadJob<T> = { priority: priorityNumber(priority), run, resolve, reject, signal };
    if (signal) {
      const abort = () => {
        const index = modelQueue.indexOf(job as LoadJob<unknown>);
        if (index >= 0) modelQueue.splice(index, 1);
        reject(signal.reason ?? new DOMException("Model load cancelled", "AbortError"));
      };
      signal.addEventListener("abort", abort, { once: true });
      job.removeAbort = () => signal.removeEventListener("abort", abort);
    }
    modelQueue.push(job as LoadJob<unknown>);
    pumpModelQueue();
  });
}

export const afterBrowserIdle = <T,>(work: () => Promise<T>): Promise<T> => new Promise((resolve, reject) => {
  const start = () => work().then(resolve, reject);
  const idle = (window as unknown as { requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(start, { timeout: 1500 }); else window.setTimeout(start, 100);
});

// Import only the registering glTF 2 loader. The directory index also exports
// every optional extension (FlowGraph, OpenPBR, Gaussian splats and extra texture
// decoders). Our optimized GLBs only require mesh quantization, registered here.
const ready = () => (loaderReady ??= Promise.all([
  import("@babylonjs/loaders/glTF/2.0/glTFLoader.js"),
  import("@babylonjs/loaders/glTF/2.0/Extensions/KHR_mesh_quantization.js")
]));
const abortError = (reason?: unknown) => reason instanceof Error ? reason : new DOMException("Model load cancelled", "AbortError");
const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
const sceneId = (scene: Scene) => { let id = sceneIds.get(scene); if (!id) { id = nextSceneId++; sceneIds.set(scene, id); } return id; };
const disposeEntry = (entry: CacheEntry) => {
  entry.evicted = true;
  entry.controller.abort(new DOMException("Model cache entry released", "AbortError"));
  if (!entry.handles || entry.scene.isDisposed) {
    if (entry.container && !entry.scene.isDisposed) entry.container.dispose();
    entry.container = null;
  }
};
const trimCache = (target = MAX_CONTAINER_CACHE) => {
  if (containerCache.size <= target) return;
  const oldest = [...containerCache.values()].sort((a, b) => a.lastUsed - b.lastUsed);
  for (const entry of oldest) {
    if (containerCache.size <= target) break;
    containerCache.delete(entry.key);
    disposeEntry(entry);
  }
};
const trimByteCache = (target = MAX_BYTE_CACHE, maxBytes = MAX_BYTE_CACHE_SIZE) => {
  let bytes = [...byteCache.values()].reduce((sum, entry) => sum + entry.bytes.byteLength, 0);
  for (const [key, entry] of [...byteCache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)) {
    if (byteCache.size <= target && bytes <= maxBytes) break;
    byteCache.delete(key); bytes -= entry.bytes.byteLength;
  }
};

/** Drops least-recently-used parsed containers. Exposed for memory-pressure integration and deterministic tests. */
export const trimModelCache = (target = MEMORY_PRESSURE_TARGET) => {
  const safe = Math.max(0, target);
  trimCache(safe);
  trimByteCache(Math.min(safe, MAX_BYTE_CACHE), safe ? MAX_BYTE_CACHE_SIZE : 0);
};
export const modelCacheStats = () => ({
  entries: containerCache.size,
  byteEntries: byteCache.size,
  byteSize: [...byteCache.values()].reduce((sum, entry) => sum + entry.bytes.byteLength, 0),
  loading: [...containerCache.values()].filter(entry => !entry.container).length,
  handles: [...containerCache.values()].reduce((sum, entry) => sum + entry.handles, 0),
  queued: modelQueue.length,
  active: activeModelWork
});

/** Associates every model request in a scene with its view/detail lifetime. */
export function bindModelLoadSignal(scene: Scene, signal?: AbortSignal) {
  if (!signal) return;
  sceneSignals.set(scene, signal);
  if (signal.aborted) { if (!scene.isDisposed) scene.dispose(); return; }
  const abort = () => releaseSceneModels(scene);
  signal.addEventListener("abort", abort, { once: true });
  scene.onDisposeObservable.addOnce(() => { signal.removeEventListener("abort", abort); releaseSceneModels(scene); });
}

/** Cancels queued/network model work and releases parsed containers owned by a replaced scene. */
export function releaseSceneModels(scene: Scene) {
  for (const entry of [...containerCache.values()]) {
    if (entry.scene !== scene) continue;
    containerCache.delete(entry.key);
    disposeEntry(entry);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("memorypressure", () => trimModelCache(), { passive: true });
}

function linkedController(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason ?? new DOMException("Model load cancelled", "AbortError"));
  signal?.addEventListener("abort", abort, { once: true });
  const timer = window.setTimeout(() => controller.abort(new DOMException("Model load timed out", "TimeoutError")), timeoutMs);
  return { controller, cleanup: () => { window.clearTimeout(timer); signal?.removeEventListener("abort", abort); } };
}

async function fetchAndParse(scene: Scene, id: string, spec: ModelSpec, timeoutMs: number, priority: ModelPriority, signal: AbortSignal): Promise<AssetContainer | null> {
  return scheduled(priority, async () => {
    const linked = linkedController(signal, timeoutMs);
    try {
      await ready();
      if (scene.isDisposed || linked.controller.signal.aborted) throw abortError(linked.controller.signal.reason);
      const url = modelUrl(spec);
      const downloadStarted = performance.now();
      const byteHit = byteCache.get(url);
      let bytes: Uint8Array;
      if (byteHit) { byteHit.lastUsed = performance.now(); bytes = byteHit.bytes; }
      else {
        const response = await fetch(url, { signal: linked.controller.signal, cache: "force-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        bytes = new Uint8Array(await response.arrayBuffer());
        if (!linked.controller.signal.aborted) { byteCache.set(url, { bytes, lastUsed: performance.now() }); trimByteCache(); }
      }
      const downloadMs = performance.now() - downloadStarted;
      if (scene.isDisposed || linked.controller.signal.aborted) throw abortError(linked.controller.signal.reason);
      const decodeStarted = performance.now();
      const loaded = await LoadAssetContainerAsync(bytes, scene, { pluginExtension: ".glb", name: `${id}.glb` });
      reportPerformanceEvent({ kind: "model_load", model_url: new URL(url, location.origin).pathname, bytes: bytes.byteLength, download_ms: Math.round(downloadMs), decode_ms: Math.round(performance.now() - decodeStarted), priority });
      if (scene.isDisposed || linked.controller.signal.aborted) { loaded.dispose(); throw abortError(linked.controller.signal.reason); }
      return loaded;
    } finally { linked.cleanup(); }
  }, signal);
}

function container(scene: Scene, id: string, spec: ModelSpec, timeoutMs: number, priority: ModelPriority): Promise<CacheEntry | null> {
  const key = `${sceneId(scene)}:${id}`;
  const cached = containerCache.get(key);
  if (cached) { cached.lastUsed = performance.now(); return cached.promise.then(value => value ? cached : null); }
  const controller = new AbortController();
  const sceneSignal = sceneSignals.get(scene);
  const abort = () => controller.abort(sceneSignal?.reason ?? new DOMException("Scene replaced", "AbortError"));
  if (sceneSignal?.aborted) abort(); else sceneSignal?.addEventListener("abort", abort, { once: true });
  const entry: CacheEntry = { key, scene, id, promise: Promise.resolve(null), container: null, controller, lastUsed: performance.now(), handles: 0, evicted: false };
  entry.promise = fetchAndParse(scene, id, spec, timeoutMs, priority, controller.signal).then(loaded => {
    entry.container = loaded;
    if (entry.evicted && loaded && !scene.isDisposed) { loaded.dispose(); entry.container = null; return null; }
    return loaded;
  }).catch(error => {
    if (!isAbort(error) && !scene.isDisposed && !warned.has(id)) { warned.add(id); console.warn(`3D model "${id}" could not be loaded; using the built-in shape instead.`, error); }
    return null;
  }).finally(() => sceneSignal?.removeEventListener("abort", abort));
  containerCache.set(key, entry);
  if (!observedScenes.has(scene)) {
    observedScenes.add(scene);
    scene.onDisposeObservable.addOnce(() => releaseSceneModels(scene));
  }
  trimCache();
  return entry.promise.then(value => value ? entry : null);
}

/** Loads (once per scene) and instantiates a model. Returns null when the id is unknown or the file cannot be loaded. */
export async function loadModel(scene: Scene, id: string, options: { timeoutMs?: number; priority?: ModelPriority; signal?: AbortSignal } = {}): Promise<ModelHandle | null> {
  const spec = modelSpec(id);
  if (!spec) return null;
  const signal = options.signal ?? sceneSignals.get(scene);
  if (signal?.aborted) return null;
  const entry = await container(scene, id, spec, options.timeoutMs ?? 12000, options.priority ?? "nearby");
  const source = entry?.container;
  if (!entry || !source || scene.isDisposed || signal?.aborted) return null;
  try {
    entry.lastUsed = performance.now();
    entry.handles++;
    const entries = source.instantiateModelsToScene(name => `${id}:${name}`, false);
    const root = new TransformNode(`model-${id}`, scene);
    const fit = new TransformNode(`fit-${id}`, scene);
    const content = new TransformNode(`content-${id}`, scene);
    fit.parent = root; content.parent = fit;
    entries.rootNodes.forEach(n => { n.parent = content; });

    const { min, max } = content.getHierarchyBoundingVectors(true);
    const dx = max.x - min.x, dy = max.y - min.y, dz = max.z - min.z;
    const raw = measureOf(spec) === "length" ? Math.max(dx, dz) : dy;
    const k = raw > 0 ? spec.size / raw : 1;
    content.position.set(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2);
    fit.scaling.set(spec.mirror ? -k : k, k, k);
    // Generated models come out facing +z. Everything except vehicles is turned to face -z, towards the camera.
    fit.rotation.y = baseYaw(spec) + (spec.yaw ?? 0);
    if (spec.offset) fit.position.set(...spec.offset);

    const clips = new Map<string, AnimationGroup>();
    for (const g of entries.animationGroups) { g.stop(); clips.set(g.name.replace(/^.*:/, "").toLowerCase(), g); }
    const meshes = root.getChildMeshes();
    return {
      id, spec, root, meshes, clips, skeletons: entries.skeletons, fit,
      dispose() {
        clips.forEach(g => g.stop()); entries.dispose(); root.dispose(false, false);
        entry.handles = Math.max(0, entry.handles - 1);
        if (entry.evicted && !entry.handles && entry.container && !entry.scene.isDisposed) { entry.container.dispose(); entry.container = null; }
      }
    };
  } catch (e) {
    entry.handles = Math.max(0, entry.handles - 1);
    console.warn(`3D model "${id}" could not be set up; using the built-in shape instead.`, e);
    return null;
  }
}
