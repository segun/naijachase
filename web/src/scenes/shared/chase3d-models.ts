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

type Cache = Map<string, Promise<AssetContainer | null>>;
const caches = new WeakMap<Scene, Cache>();
let loaderReady: Promise<unknown> | null = null;
const warned = new Set<string>();

const ready = () => (loaderReady ??= import("@babylonjs/loaders/glTF/2.0"));
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error("timed out")), ms); p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); }); });

function container(scene: Scene, id: string, spec: ModelSpec, timeoutMs: number): Promise<AssetContainer | null> {
  let cache = caches.get(scene);
  if (!cache) { cache = new Map(); caches.set(scene, cache); }
  let hit = cache.get(id);
  if (!hit) {
    let expired = false;
    hit = withTimeout((async () => {
      await ready();
      if (scene.isDisposed) return null;
      const loaded = await LoadAssetContainerAsync(modelUrl(spec), scene);
      if (expired || scene.isDisposed) { loaded.dispose(); return null; }
      return loaded;
    })(), timeoutMs).catch(e => {
      expired = true;
      if (scene.isDisposed) return null;
      if (!warned.has(id)) { warned.add(id); console.warn(`3D model "${id}" could not be loaded; using the built-in shape instead.`, e); }
      return null;
    });
    cache.set(id, hit);
  }
  return hit;
}

/** Loads (once per scene) and instantiates a model. Returns null when the id is unknown or the file cannot be loaded. */
export async function loadModel(scene: Scene, id: string, options: { timeoutMs?: number } = {}): Promise<ModelHandle | null> {
  const spec = modelSpec(id);
  if (!spec) return null;
  const source = await container(scene, id, spec, options.timeoutMs ?? 12000);
  if (!source || scene.isDisposed) return null;
  try {
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
      dispose() { clips.forEach(g => g.stop()); entries.dispose(); root.dispose(false, false); }
    };
  } catch (e) {
    console.warn(`3D model "${id}" could not be set up; using the built-in shape instead.`, e);
    return null;
  }
}
