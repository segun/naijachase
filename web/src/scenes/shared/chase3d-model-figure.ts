// Drives a person loaded from a GLB model (chase3d-models.ts) from the same `Pose` the procedural figure uses, so a scene's timeline
// does not change: walking follows gait, sitting blends into the seated clip's pose, and optional hand targets reach the keyboard.
// Idle uses the first walk frame (or rest pose without a walk clip). Missing movements are simply skipped.
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Pose } from "./scene-core.ts";
import type { ModelHandle } from "./chase3d-models.ts";

/** A standing hip is this high in the game's own figure; the seated pose is lifted so the hips end up at the same height. */
const HIP_HEIGHT = 0.84;

export type ModelFigure = {
  root: TransformNode;
  /** The model's own node, for scenes that want to add shadows or parents. */
  model: ModelHandle;
  /** Poses the figure for this instant. Cheap; call it every frame. */
  apply(pose: Pose, seconds?: number, hands?: readonly [Vector3 | null, Vector3 | null]): void;
  setAlpha(alpha: number): void;
};

export function aimJoint(node: TransformNode, child: TransformNode, target: Vector3, amount: number) {
  node.computeWorldMatrix(true); child.computeWorldMatrix(true);
  const parent = node.parent instanceof TransformNode ? node.parent : undefined;
  const inverse = parent ? Matrix.Invert(parent.computeWorldMatrix(true)) : Matrix.Identity();
  // Work in the parent's coordinates: glTF's handedness conversion can include a reflected axis.
  const from = Vector3.TransformCoordinates(child.getAbsolutePosition(), inverse).subtract(node.position).normalize();
  const to = Vector3.TransformCoordinates(target, inverse).subtract(node.position).normalize();
  const delta = Quaternion.Identity();
  Quaternion.FromUnitVectorsToRef(from, to, delta);
  const local = delta.multiply(node.rotationQuaternion!);
  Quaternion.SlerpToRef(node.rotationQuaternion!, local, amount, node.rotationQuaternion!);
  node.computeWorldMatrix(true);
}

export function modelFigure(model: ModelHandle, options: { pinHorizontalTravel?: boolean; neutralStanding?: boolean } = {}): ModelFigure {
  const walk = model.clips.get("walk"), sit = model.clips.get("sit");
  const nodes = model.root.getDescendants().filter((n): n is TransformNode => n instanceof TransformNode && !!n.rotationQuaternion);
  const joint = (name: string) => nodes.find(n => n.name.endsWith(`:${name}`));
  const hips = joint("Hips");
  const rest = nodes.map(n => ({ position: n.position.clone(), rotation: n.rotationQuaternion!.clone() }));
  const standing = rest.map(p => ({ position: p.position.clone(), rotation: p.rotation.clone() }));
  const sample = (clip: AnimationGroup | undefined, frame: number) => {
    clip?.goToFrame(frame);
  };
  for (const clip of [walk, sit]) { clip?.start(true); clip?.pause(); }

  // Hip height of the seated pose, in metres, so a seated figure can be lifted onto a seat.
  let seatedHip = 0;
  if (sit && hips) {
    sample(sit, sit.from);
    model.root.computeWorldMatrix(true); hips.computeWorldMatrix(true);
    seatedHip = hips.getAbsolutePosition().y - model.root.getAbsolutePosition().y;
  }
  const lift = seatedHip > 0 ? HIP_HEIGHT - seatedHip : 0;
  const baseY = model.fit.position.y;

  const arms = ["Left", "Right"].map(side => [joint(`${side}Arm`), joint(`${side}ForeArm`), joint(`${side}Hand`)] as const);
  const legs = ["Left", "Right"].map(side => [joint(`${side}UpLeg`), joint(`${side}Leg`), joint(`${side}Foot`)] as const);

  let last = -1;
  const meshes = model.meshes;
  return {
    root: model.root, model,
    apply(pose, seconds = 0, hands) {
      nodes.forEach((n, i) => {
        n.position.copyFrom(rest[i]!.position);
        n.rotationQuaternion!.copyFrom(rest[i]!.rotation);
      });
      // Sample paused clips from the shared timeline, not the wall clock. Seeking and detail changes reproduce the same pose.
      const turn = (((pose.gait / (Math.PI * 2)) % 1) + 1) % 1;
      sample(walk, walk ? walk.from + (pose.stride > 0.12 ? turn : 0) * (walk.to - walk.from) : 0);
      nodes.forEach((n, i) => {
        standing[i]!.position.copyFrom(n.position);
        standing[i]!.rotation.copyFrom(n.rotationQuaternion!);
      });
      if (sit && pose.sit > 0) {
        sample(sit, sit.from);
        nodes.forEach((n, i) => {
          Vector3.LerpToRef(standing[i]!.position, n.position, pose.sit, n.position);
          Quaternion.SlerpToRef(standing[i]!.rotation, n.rotationQuaternion!, pose.sit, n.rotationQuaternion!);
        });
      }
      if (options.pinHorizontalTravel && hips) {
        const initial = rest[nodes.indexOf(hips)]!.position;
        hips.position.x = initial.x; hips.position.z = initial.z;
      }
      if (options.neutralStanding && pose.stride < 1 && pose.sit < 1) {
        for (const [upper, lower, foot] of legs) {
          if (!upper || !lower || !foot) continue;
          for (const [from, to] of [[upper, lower], [lower, foot]] as const) {
            from.computeWorldMatrix(true); to.computeWorldMatrix(true);
            const target = from.getAbsolutePosition().add(Vector3.Down().scale(Vector3.Distance(from.getAbsolutePosition(), to.getAbsolutePosition())));
            aimJoint(from, to, target, (1 - pose.stride) * (1 - pose.sit));
          }
        }
      }
      model.fit.position.y = baseY + (sit ? lift * pose.sit : 0);
      if (hands && pose.type > 0) {
        arms.forEach(([upper, lower, hand], i) => {
          if (!upper || !lower || !hand || !hands[i]) return;
          upper.computeWorldMatrix(true); lower.computeWorldMatrix(true); hand.computeWorldMatrix(true);
          const shoulder = upper.getAbsolutePosition().clone();
          const a = Vector3.Distance(shoulder, lower.getAbsolutePosition());
          const b = Vector3.Distance(lower.getAbsolutePosition(), hand.getAbsolutePosition());
          const target = hands[i]!.clone();
          target.y += Math.sin(seconds * 17 + i * Math.PI) * 0.008;
          const direction = target.subtract(shoulder);
          const distance = Math.min(direction.length(), (a + b) * 0.995);
          direction.normalize();
          const along = (a * a - b * b + distance * distance) / (2 * distance);
          const bend = Vector3.Down().subtract(direction.scale(Vector3.Dot(Vector3.Down(), direction))).normalize();
          const elbow = shoulder.add(direction.scale(along)).add(bend.scale(Math.sqrt(Math.max(0, a * a - along * along))));
          aimJoint(upper, lower, elbow, pose.type);
          aimJoint(lower, hand, shoulder.add(direction.scale(distance)), pose.type);
        });
      }
    },
    setAlpha(alpha) {
      // Small changes are skipped, but never one that shows or hides the figure: glTF materials are opaque, so a figure left enabled
      // at a tiny alpha would still be drawn in full.
      const shown = alpha > 0.002;
      if (Math.abs(alpha - last) <= 0.004 && shown === last > 0.002) return;
      last = alpha;
      model.root.setEnabled(shown);
      meshes.forEach(m => { m.visibility = alpha; });
    }
  };
}
