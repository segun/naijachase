import type { Scene } from "@babylonjs/core/scene";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { loadModel, type ModelPriority } from "../shared/chase3d-models.ts";
import { aimJoint } from "../shared/chase3d-model-figure.ts";
import type { Figure } from "./chase3d-actors.ts";

/** Keep the procedural figure until its replacement and the required in-place clip are ready. */
export async function replaceActor(scene: Scene, fallback: Figure, id: string, movement: "walk" | "run" | "idle", shadows: ShadowGenerator | null, priority: ModelPriority = "critical"): Promise<void> {
  const model = await loadModel(scene, id, { priority });
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
  const joint = (name: string) => nodes.find(n => n.name.endsWith(`:${name}`));
  const legs = ["Left", "Right"].map(side => [joint(`${side}UpLeg`), joint(`${side}Leg`), joint(`${side}Foot`)] as const);
  const arms = ["Left", "Right"].map(side => [joint(`${side}Arm`), joint(`${side}ForeArm`), joint(`${side}Hand`)] as const);
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
  // Point a limb chain (upper → lower → end) along a world direction, by `amount`.
  const aimChain = (chain: readonly [TransformNode | undefined, TransformNode | undefined, TransformNode | undefined], direction: Vector3, amount: number) => {
    const [upper, lower, end] = chain;
    if (!upper || !lower || !end || amount <= 0) return;
    for (const [from, to] of [[upper, lower], [lower, end]] as const) {
      from.computeWorldMatrix(true); to.computeWorldMatrix(true);
      const length = Vector3.Distance(from.getAbsolutePosition(), to.getAbsolutePosition());
      aimJoint(from, to, from.getAbsolutePosition().add(direction.scale(length)), amount);
    }
  };
  fallback.apply = (pose, cycle = 0, extras) => {
    procedural(pose);
    const turn = ((cycle % 1) + 1) % 1;
    clip.goToFrame(clip.from + (movement === "idle" ? 0 : turn) * (clip.to - clip.from));
    // Exports marked "in place" can still translate the hips forward. The timeline owns travel.
    if (hips && origin) { hips.position.x = origin.x; hips.position.z = origin.z; }
    // The raid's endings: the clip only runs, so straighten the legs to stand and lift the arms to give up or take hold.
    if (extras?.stand) legs.forEach(leg => aimChain(leg, Vector3.Down(), extras.stand!));
    if (extras?.raise) arms.forEach(arm => aimChain(arm, new Vector3(0, 1, 0), extras.raise!));
    if (extras?.reach) {
      const ahead = fallback.root.getDirection(Vector3.Right()).normalize();
      arms.forEach(arm => aimChain(arm, ahead.add(new Vector3(0, -0.15, 0)).normalize(), extras.reach!));
    }
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
