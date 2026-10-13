import type { Scene } from "@babylonjs/core/scene";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { loadModel } from "../shared/chase3d-models.ts";
import type { Figure } from "./chase3d-actors.ts";

/** Keep the procedural figure until its replacement and the required in-place clip are ready. */
export async function replaceActor(scene: Scene, fallback: Figure, id: string, movement: "walk" | "run" | "idle", shadows: ShadowGenerator | null): Promise<void> {
  const model = await loadModel(scene, id);
  if (!model) return;
  const clip = model.clips.get(movement === "idle" ? "walk" : movement);
  if (!clip) {
    console.warn(`Chase model "${id}" has no ${movement} clip; keeping the built-in figure.`);
    model.dispose(); return;
  }
  const nodes = model.root.getDescendants().filter((n): n is TransformNode => n instanceof TransformNode);
  const hand = nodes.find(n => n.name.endsWith(":RightHand"));
  const hips = nodes.find(n => n.name.endsWith(":Hips"));
  const origin = hips?.position.clone();
  const sack = scene.getTransformNodeByName(`${fallback.root.name.replace(/-root$/, "")}-sack`);
  const baton = scene.getMeshByName(`${fallback.root.name.replace(/-root$/, "")}-baton`);
  const body = fallback.root.getChildMeshes();
  model.root.parent = fallback.root;
  // The chase faces +x; the shared person loader faces -z.
  model.root.rotation.y = -Math.PI / 2;
  if (sack) { sack.parent = fallback.root; sack.position.set(-0.3, 1.45, 0); }
  if (baton && hand) baton.parent = fallback.root;
  body.forEach(m => { if (!sack?.getChildMeshes().includes(m) && m !== baton && m.parent !== baton) m.setEnabled(false); });
  model.meshes.forEach(m => shadows?.addShadowCaster(m));
  clip.start(true); clip.pause();
  const procedural = fallback.apply;
  fallback.apply = (pose, cycle = 0) => {
    procedural(pose);
    const turn = ((cycle % 1) + 1) % 1;
    clip.goToFrame(clip.from + (movement === "idle" ? 0 : turn) * (clip.to - clip.from));
    // Exports marked "in place" can still translate the hips forward. The timeline owns travel.
    if (hips && origin) { hips.position.x = origin.x; hips.position.z = origin.z; }
    if (sack && hips) {
      const inverse = Matrix.Invert(fallback.root.computeWorldMatrix(true));
      hips.computeWorldMatrix(true);
      sack.position.copyFrom(Vector3.TransformCoordinates(hips.getAbsolutePosition(), inverse));
      sack.position.addInPlace(new Vector3(-0.28, 0.45, -0.12));
    }
    if (baton && hand) {
      const inverse = Matrix.Invert(fallback.root.computeWorldMatrix(true));
      hand.computeWorldMatrix(true);
      baton.position.copyFrom(Vector3.TransformCoordinates(hand.getAbsolutePosition(), inverse));
      baton.position.y -= 0.18;
    }
  };
}
