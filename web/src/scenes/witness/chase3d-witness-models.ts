import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Stage } from "../shared/chase3d-stage.ts";
import { loadModel } from "../shared/chase3d-models.ts";
import { aimJoint, modelFigure, type ModelFigure } from "../shared/chase3d-model-figure.ts";
import { contactShadow } from "../shared/chase3d-shapes.ts";
import { sceneryFit, type ModelGroup } from "./witness-models.ts";

/** Fit scenery uniformly to its footprint or explicit height; retain procedural objects on load failure. */
export async function replaceScenery(stage: Stage, group: ModelGroup, meshes: AbstractMesh[], front = -Infinity) {
  if (!meshes.length || stage.scene.isDisposed) return;
  const model = await loadModel(stage.scene, group.id);
  if (!model) return;
  const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    min.minimizeInPlace(box.minimumWorld); max.maximizeInPlace(box.maximumWorld);
  }
  model.root.rotation.y = group.yaw ?? 0;
  const bounds = model.root.getHierarchyBoundingVectors(true);
  const fit = sceneryFit([min.x, min.y, min.z], [max.x, max.y, max.z],
    [bounds.min.x, bounds.min.y, bounds.min.z], [bounds.max.x, bounds.max.y, bounds.max.z], front, group.height);
  model.root.scaling.setAll(fit.scale);
  model.root.position.set(...fit.position);
  model.meshes.forEach(m => { stage.caster(m); m.receiveShadows = !stage.light; });
  meshes.forEach(m => m.setEnabled(false));
  return model;
}

export async function replacePerson(stage: Stage, root: TransformNode, id: string): Promise<ModelFigure | null> {
  const model = await loadModel(stage.scene, id);
  if (!model) return null;
  if (!model.clips.has("walk")) {
    console.warn(`Witness character "${id}" has no Walk clip; retaining the procedural character.`);
    model.dispose(); return null;
  }
  const figure = modelFigure(model, { pinHorizontalTravel: true, neutralStanding: true });
  model.root.parent = root;
  root.getChildMeshes().filter(m => !model.meshes.includes(m)).forEach(m => m.setEnabled(false));
  model.meshes.forEach(m => stage.caster(m));
  contactShadow(stage.scene, model.root, 0.9, 0.7);
  return figure;
}

export function gesture(figure: ModelFigure, arms: readonly number[], elbows: readonly number[], wave: number) {
  const joints = figure.model.root.getDescendants();
  const world = figure.root.computeWorldMatrix(true), inverse = Matrix.Invert(world);
  for (const [i, side] of ["Left", "Right"].entries()) {
    const upper = joints.find(n => n.name.endsWith(`:${side}Arm`));
    const lower = joints.find(n => n.name.endsWith(`:${side}ForeArm`));
    const hand = joints.find(n => n.name.endsWith(`:${side}Hand`));
    if (!(upper instanceof TransformNode) || !(lower instanceof TransformNode) || !(hand instanceof TransformNode) ||
      !upper.rotationQuaternion || !lower.rotationQuaternion) continue;
    [upper, lower, hand].forEach(n => n.computeWorldMatrix(true));
    const a = Vector3.Distance(upper.getAbsolutePosition(), lower.getAbsolutePosition());
    const b = Vector3.Distance(lower.getAbsolutePosition(), hand.getAbsolutePosition());
    const shoulder = Vector3.TransformCoordinates(upper.getAbsolutePosition(), inverse);
    const angle = arms[i] ?? 0, bend = angle + (elbows[i] ?? 0), sway = i ? wave : 0;
    const elbow = shoulder.add(new Vector3(sway * a, -Math.cos(angle) * a, -Math.sin(angle) * a));
    const wrist = elbow.add(new Vector3(sway * b, -Math.cos(bend) * b, -Math.sin(bend) * b));
    aimJoint(upper, lower, Vector3.TransformCoordinates(elbow, world), 1);
    aimJoint(lower, hand, Vector3.TransformCoordinates(wrist, world), 1);
  }
}
