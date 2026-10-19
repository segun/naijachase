// Warms only the tiny, explicit critical set for the next server-confirmed scene.
// This module deliberately cannot enumerate the catalogue.
import { modelSpec, modelUrl } from "./model-manifest.ts";

const warmed = new Set<string>();
const MAX_PER_SCENE = 4;

export function preloadCriticalModels(ids: readonly string[]) {
  for (const id of [...new Set(ids)].slice(0, MAX_PER_SCENE)) {
    if (warmed.has(id)) continue;
    const spec = modelSpec(id);
    if (!spec) continue;
    warmed.add(id);
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "fetch";
    link.href = modelUrl(spec);
    link.crossOrigin = "anonymous";
    link.dataset.naijachaseModel = id;
    document.head.append(link);
  }
}
