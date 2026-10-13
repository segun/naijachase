// Small 3D building blocks any witness set can use: a passer-by with a few primitives and a printed-cloth material. Lazily loaded with the
// 3D renderer, so it may import Babylon.js. New sets should reuse these before inventing their own.
import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { seeded } from "../shared/chase3d-kit.ts";
import type { Stage } from "../shared/chase3d-stage.ts";
import { replacePerson } from "./chase3d-witness-models.ts";
import type { ModelFigure } from "../shared/chase3d-model-figure.ts";
import { standingPose } from "./witness-models.ts";

export type Walker = ReturnType<typeof person> & { dir: 1 | -1 };

/** A lit material carrying a printed cloth texture. */
export function printed(scene: Scene, name: string, texture: DynamicTexture): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = texture;
  m.specularColor.set(0.03, 0.03, 0.03);
  return m;
}

/** A passer-by built from a handful of primitives. */
export function person(stage: Stage, seed: number, prints: readonly DynamicTexture[], modelId?: string) {
  const { scene, mat, cyl, sphere } = stage;
  const r = seeded(seed);
  const skin = mat(["#5a3a28", "#6e4630", "#8a5a3c", "#a06a45", "#3f2a1e"][Math.floor(r() * 5)]!);
  const palette = ["#c0392b", "#2e6f8f", "#d9822b", "#2f8f5b", "#7a4aa0", "#e0b23a", "#f4ecd8", "#b5483a"];
  const colour = () => mat(palette[Math.floor(r() * palette.length)]!);
  const root = new TransformNode(`person${seed}`, scene);
  const woman = r() < 0.6;
  const legs: TransformNode[] = [], arms: TransformNode[] = [];
  const pivot = (x: number, y: number) => { const n = new TransformNode("pivot", scene); n.parent = root; n.position.set(x, y, 0); return n; };
  const top = colour();
  cyl("torso", 0.3, 0.38, 0.6, top, 0, 1.17, 0, root);
  for (const side of [-1, 1]) {
    const arm = pivot(side * 0.22, 1.42);
    cyl("arm", 0.09, 0.08, 0.56, woman ? top : skin, 0, -0.26, 0, arm);
    arms.push(arm);
  }
  if (woman) {
    cyl("wrapper", 0.34, 0.54, 0.86, printed(scene, `wrapper${seed}`, prints[Math.floor(r() * prints.length)]!), 0, 0.45, 0, root);
  } else {
    const trousers = mat(["#2a3340", "#4a3f35", "#1f2a24"][Math.floor(r() * 3)]!);
    for (const side of [-1, 1]) {
      const leg = pivot(side * 0.1, 0.86);
      cyl("leg", 0.17, 0.13, 0.84, trousers, 0, -0.42, 0, leg);
      legs.push(leg);
    }
  }
  const head = sphere("head", 0.24, skin, 0, 1.64, 0);
  head.parent = root;
  if (woman) {
    const tie = sphere("headtie", 0.3, colour(), 0, 1.72, 0.01);
    tie.parent = root; tie.scaling.set(1, 0.7, 1.1);
    if (r() < 0.45) {
      // A basket of produce carried on the head.
      cyl("basket", 0.42, 0.3, 0.14, mat("#b0803f"), 0, 1.92, 0, root);
      const goods = sphere("goods", 0.34, mat(["#c0392b", "#e0b23a", "#2f8f5b"][Math.floor(r() * 3)]!), 0, 2.0, 0);
      goods.parent = root; goods.scaling.y = 0.55;
    }
  } else {
    cyl("cap", 0.2, 0.24, 0.1, colour(), 0, 1.78, 0, root);
  }
  let model: ModelFigure | null = null;
  const ready = modelId ? replacePerson(stage, root, modelId).then(m => { model = m; }) : Promise.resolve();
  return {
    root, legs, arms, ready,
    applyModel(t: number, walking: boolean, gait = t * 6 + seed) {
      model?.apply(standingPose(gait, walking ? 1 : 0), t);
    }
  };
}
