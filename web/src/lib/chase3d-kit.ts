// Small helpers shared by the 3D chase modules. Lazy-loaded with the rest of the Babylon.js code.
import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { ICanvasRenderingContext } from "@babylonjs/core/Engines/ICanvas";

export const hex = (value: string) => Color3.FromHexString(value);

export type MaterialOptions = { emissive?: string; texture?: DynamicTexture; specular?: number; alpha?: number };

export function material(scene: Scene, name: string, color: string, o: MaterialOptions = {}) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = hex(color);
  const s = o.specular ?? 0.08;
  m.specularColor = new Color3(s, s, s);
  if (o.emissive) m.emissiveColor = hex(o.emissive);
  if (o.texture) m.diffuseTexture = o.texture;
  if (o.alpha !== undefined) m.alpha = o.alpha;
  return m;
}

/** A texture painted with the 2D canvas API. */
export function paint(scene: Scene, name: string, width: number, height: number, draw: (g: ICanvasRenderingContext) => void, mipmaps = true): DynamicTexture {
  const t = new DynamicTexture(name, { width, height }, scene, mipmaps);
  draw(t.getContext());
  t.update();
  return t;
}

export function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/** Merges parts into one mesh (one draw call per material) so it can be instanced cheaply. */
export function merge(name: string, parts: Mesh[]): Mesh {
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
  if (!merged) throw new Error(`could not merge ${name}`);
  merged.name = name;
  return merged;
}
