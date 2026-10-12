// Drives a person loaded from a GLB model (chase3d-models.ts) from the same `Pose` the procedural figure uses, so a scene's timeline
// does not change: walking follows the pose's gait (footsteps stay in step with the sound), a seated pose plays the sit movement, and
// anything else stands in the model's rest pose. Missing movements are simply skipped.
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Pose } from "./scene-core.ts";
import type { ModelHandle } from "./chase3d-models.ts";

/** A standing hip is this high in the game's own figure; the seated pose is lifted so the hips end up at the same height. */
const HIP_HEIGHT = 0.84;

export type ModelFigure = {
  root: TransformNode;
  /** The model's own node, for scenes that want to add shadows or parents. */
  model: ModelHandle;
  /** Poses the figure for this instant. Cheap; call it every frame. */
  apply(pose: Pose): void;
  setAlpha(alpha: number): void;
};

type State = "idle" | "walk" | "sit";

export function modelFigure(model: ModelHandle): ModelFigure {
  const walk = model.clips.get("walk"), sit = model.clips.get("sit");
  const hips = model.root.getDescendants(false, n => /hips$/i.test(n.name))[0] as TransformNode | undefined;

  // Hip height of the seated pose, in metres, so a seated figure can be lifted onto a seat.
  let seatedHip = 0;
  if (sit && hips) {
    sit.start(false); sit.goToFrame(sit.from); sit.pause();
    model.root.computeWorldMatrix(true); hips.computeWorldMatrix(true);
    seatedHip = hips.getAbsolutePosition().y - model.root.getAbsolutePosition().y;
    sit.stop();
    model.skeletons.forEach(k => k.returnToRest());
  }
  const lift = seatedHip > 0 ? HIP_HEIGHT - seatedHip : 0;
  const baseY = model.fit.position.y;

  let state: State = "idle";
  const enter = (next: State) => {
    if (next === state) return;
    for (const g of [walk, sit]) g?.stop();
    const clip: AnimationGroup | undefined = next === "walk" ? walk : next === "sit" ? sit : undefined;
    if (clip) { clip.start(true); clip.pause(); }
    else model.skeletons.forEach(s => s.returnToRest());
    state = next;
  };

  let last = -1;
  const meshes = model.meshes;
  return {
    root: model.root, model,
    apply(pose) {
      const next: State = pose.sit > 0.5 && sit ? "sit" : pose.stride > 0.12 && walk ? "walk" : "idle";
      enter(next);
      model.fit.position.y = baseY + (next === "sit" ? lift * pose.sit : 0);
      if (next === "walk" && walk) {
        // One walk cycle is two steps, and the game counts a step every PI of gait.
        const turn = (((pose.gait / (Math.PI * 2)) % 1) + 1) % 1;
        walk.goToFrame(walk.from + turn * (walk.to - walk.from));
      } else if (next === "sit" && sit) {
        sit.goToFrame(sit.from + ((performance.now() / 1000 / 7) % 1) * (sit.to - sit.from));
      }
    },
    setAlpha(alpha) {
      if (Math.abs(alpha - last) <= 0.004) return;
      last = alpha;
      model.root.setEnabled(alpha > 0.002);
      meshes.forEach(m => { m.visibility = alpha; });
    }
  };
}
