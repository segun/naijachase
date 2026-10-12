import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector.js";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@babylonjs/core/") && !specifier.endsWith(".js")) return next(`${specifier}.js`, context);
    return next(specifier, context);
  }
});
const { modelFigure } = await import("../src/scenes/shared/chase3d-model-figure.ts");

function fixture(t, clips = true) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  t.after(() => { scene.dispose(); engine.dispose(); });
  const root = new TransformNode("person", scene);
  const fit = new TransformNode("fit", scene); fit.parent = root;
  const converted = new TransformNode("gltf", scene); converted.parent = fit; converted.scaling.z = -1;
  const node = (name, parent, position) => {
    const n = new TransformNode(`person:mixamorig:${name}`, scene);
    n.parent = parent; n.position.copyFrom(position); n.rotationQuaternion = Quaternion.Identity();
    return n;
  };
  const hips = node("Hips", converted, new Vector3(0, 0.84, 0));
  const arms = ["Left", "Right"].map((side, i) => {
    const upper = node(`${side}Arm`, hips, new Vector3(i ? 0.18 : -0.18, 0.38, 0));
    const lower = node(`${side}ForeArm`, upper, new Vector3(0, -0.28, 0));
    const hand = node(`${side}Hand`, lower, new Vector3(0, -0.25, 0));
    return { upper, lower, hand };
  });
  const clip = (from, to, sample) => ({ from, to, start() {}, pause() {}, goToFrame: sample });
  const walk = clip(0, 60, frame => { hips.position.y = 0.84; hips.rotationQuaternion.copyFrom(Quaternion.RotationAxis(Vector3.Up(), frame / 100)); });
  const sit = clip(0, 30, () => { hips.position.y = 0.55; hips.rotationQuaternion.copyFrom(Quaternion.RotationAxis(Vector3.Up(), 0.1)); });
  const model = { root, fit, meshes: [], skeletons: [], clips: new Map(clips ? [["walk", walk], ["sit", sit]] : []) };
  return { figure: modelFigure(model), hips, root, fit, arms };
}
const pose = { x: 0, y: 0, z: 0, heading: 0, sit: 0, gait: 0, stride: 0, type: 0, visible: true };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);

test("the model blends sitting continuously and aligns its hip to the scene's seat", t => {
  const { figure, hips, root } = fixture(t);
  for (const amount of [0, 0.1, 0.49, 0.51, 0.9, 1]) {
    root.position.y = -0.36 * amount;
    figure.apply({ ...pose, sit: amount });
    hips.computeWorldMatrix(true);
    near(hips.getAbsolutePosition().y, 0.84 - 0.36 * amount);
  }
});

test("seeking repeats the same pose after walking, sitting and typing", t => {
  const { figure, hips, arms } = fixture(t);
  const hands = [new Vector3(-0.18, 1, -0.4), new Vector3(0.18, 1, -0.4)];
  const seated = { ...pose, sit: 1, type: 1 };
  const snapshot = () => [hips, ...arms.flatMap(a => [a.upper, a.lower, a.hand])].map(n => [...n.position.asArray(), ...n.rotationQuaternion.asArray()]);
  figure.apply(seated, 2.8, hands);
  const first = snapshot();
  figure.apply({ ...pose, stride: 1, gait: 2.3 }, 4);
  figure.apply(seated, 2.8, hands);
  assert.deepEqual(snapshot(), first);
});

test("walk clip follows gait rather than elapsed wall time", t => {
  const { figure, hips } = fixture(t);
  figure.apply({ ...pose, stride: 1, gait: Math.PI }, 0);
  const first = hips.rotationQuaternion.asArray();
  figure.apply({ ...pose, stride: 1, gait: Math.PI }, 1000);
  assert.deepEqual(hips.rotationQuaternion.asArray(), first);
  figure.apply({ ...pose, stride: 1, gait: 2 * Math.PI }, 1000);
  assert.notDeepEqual(hips.rotationQuaternion.asArray(), first);
});

test("typing reaches the keyboard even through the glTF reflected coordinate system", t => {
  const { figure, arms } = fixture(t);
  const hands = [new Vector3(-0.18, 1, -0.4), new Vector3(0.18, 1, -0.4)];
  figure.apply({ ...pose, sit: 1, type: 1 }, 0, hands);
  arms.forEach((arm, i) => {
    arm.hand.computeWorldMatrix(true);
    assert.ok(Vector3.Distance(arm.hand.getAbsolutePosition(), hands[i]) < 0.012);
  });
});

test("a model without clips remains in its original pose and can be hidden", t => {
  const { figure, hips, root } = fixture(t, false);
  figure.apply({ ...pose, sit: 1 }, 3);
  near(hips.position.y, 0.84);
  figure.setAlpha(0); assert.equal(root.isEnabled(), false);
  figure.setAlpha(1); assert.equal(root.isEnabled(), true);
});
