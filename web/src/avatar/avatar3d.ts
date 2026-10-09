// Lazily loaded Babylon.js renderer for the procedural avatars. One shared character function builds every preset from
// primitives with the same camera, lighting, pose and scale; previews are rendered once to still images so the picker
// needs a single short-lived WebGL context and no animation.
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { material } from "../scenes/shared/chase3d-kit.ts";
import { build, hairParts, tintColor, type AvatarPreset, type Part, type Tint } from "./avatar-model.ts";

/** Joints a caller can pose: hips and knees swing about x (positive swings forward, i.e. towards -z), as do the shoulders and elbows (an elbow bends the forearm forward). */
export type AvatarRig = { hips: TransformNode[]; knees: TransformNode[]; shoulders: TransformNode[]; elbows: TransformNode[] };

export type SnapshotOptions = {
  width?: number;
  height?: number;
  /** Called as each preview finishes so cards can fill in progressively. */
  onSnapshot: (avatarId: string, dataUrl: string) => void;
  isCancelled?: () => boolean;
};

const HEAD_DIAMETER = 0.56;
const HEAD_Y = 1.72;

function mesh(scene: Scene, name: string, part: Pick<Part, "shape" | "size">): Mesh {
  const [w, h, d] = part.size;
  switch (part.shape) {
    case "box": return CreateBox(name, { width: w, height: h, depth: d }, scene);
    case "capsule": return CreateCapsule(name, { radius: w / 2, height: Math.max(h, w), tessellation: 12, capSubdivisions: 4 }, scene);
    case "cylinder": return CreateCylinder(name, { diameter: w, height: h, tessellation: 24 }, scene);
    default: {
      const s = CreateSphere(name, { diameter: 1, segments: 16 }, scene);
      s.scaling = new Vector3(w, h, d);
      return s;
    }
  }
}

/** The one character function every preview uses. Returns the root so the caller can dispose the whole figure. */
export function buildAvatar(scene: Scene, preset: AvatarPreset): TransformNode & { rig: AvatarRig } {
  const root = new TransformNode(`avatar-${preset.avatar_id}`, scene);
  const mats = new Map<Tint, StandardMaterial>();
  const paint = (tint: Tint) => {
    let m = mats.get(tint);
    if (!m) { m = material(scene, `${preset.avatar_id}-${tint}`, tintColor(preset, tint), { specular: tint === "skin" ? 0.12 : 0.06 }); mats.set(tint, m); }
    return m;
  };
  const add = (m: Mesh, tint: Tint, x: number, y: number, z: number) => {
    m.parent = root; m.position = new Vector3(x, y, z); m.material = paint(tint);
    return m;
  };
  const shape = build(preset);

  // Legs and boots. Each leg is a thigh and a shin on their own pivots so the figure can walk and sit; at rest it looks identical to a straight leg.
  const rig: AvatarRig = { hips: [], knees: [], shoulders: [], elbows: [] };
  const pivot = (name: string, x: number, y: number, parent: TransformNode) => {
    const node = new TransformNode(name, scene);
    node.parent = parent; node.position = new Vector3(x, y, 0);
    return node;
  };
  const attach = (m: Mesh, tint: Tint, parent: TransformNode, x: number, y: number, z: number) => {
    m.parent = parent; m.position = new Vector3(x, y, z); m.material = paint(tint);
    return m;
  };
  for (const side of [-1, 1]) {
    const hip = pivot("hip", side * 0.12, 0.84, root);
    const knee = pivot("knee", 0, -0.39, hip);
    attach(CreateCylinder("thigh", { diameter: 0.2, height: 0.39, tessellation: 16 }, scene), "primary", hip, 0, -0.195, 0);
    attach(CreateCylinder("shin", { diameter: 0.2, height: 0.39, tessellation: 16 }, scene), "primary", knee, 0, -0.195, 0);
    attach(CreateBox("boot", { width: 0.2, height: 0.12, depth: 0.32 }, scene), "hair", knee, 0, -0.39, -0.05);
    rig.hips.push(hip); rig.knees.push(knee);
  }
  // Jacket: a tapered, slightly flattened torso with a lighter front panel, collar, accent belt and badge.
  const torso = add(CreateCylinder("torso", { height: 0.72, diameterTop: shape.shoulder, diameterBottom: shape.waist, tessellation: 24 }, scene), "primary", 0, 1.2, 0);
  torso.scaling.z = 0.58;
  add(CreateBox("panel", { width: 0.1, height: 0.5, depth: 0.02 }, scene), "secondary", 0, 1.15, -shape.shoulder * 0.29 - 0.005);
  const belt = add(CreateCylinder("belt", { height: 0.07, diameter: shape.waist * 1.04, tessellation: 24 }, scene), "accent", 0, 0.88, 0);
  belt.scaling.z = 0.6;
  add(CreateSphere("badge", { diameter: 0.07, segments: 8 }, scene), "accent", 0.12, 1.34, -shape.shoulder * 0.29 - 0.01);
  add(CreateCylinder("collar", { height: 0.08, diameter: 0.26, tessellation: 16 }, scene), "secondary", 0, 1.57, 0);
  add(CreateCylinder("neck", { height: 0.14, diameter: 0.13, tessellation: 12 }, scene), "skin", 0, 1.6, 0);
  // Arms, cuffs and hands, hung from shoulder pivots.
  for (const side of [-1, 1]) {
    const x = side * (shape.shoulder / 2 + shape.arm / 2 + 0.01);
    const shoulder = pivot("shoulder", x, 1.5, root);
    const elbow = pivot("elbow", side * 0.02, -0.32, shoulder);
    const upper = attach(CreateCapsule("arm", { radius: shape.arm / 2, height: 0.36, tessellation: 12, capSubdivisions: 4 }, scene), "primary", shoulder, 0, -0.16, 0);
    upper.rotation.z = side * 0.06;
    attach(CreateCapsule("forearm", { radius: shape.arm / 2, height: 0.4, tessellation: 12, capSubdivisions: 4 }, scene), "primary", elbow, 0, -0.18, 0);
    attach(CreateCylinder("cuff", { height: 0.05, diameter: shape.arm * 1.08, tessellation: 12 }, scene), "secondary", elbow, 0, -0.28, 0);
    attach(CreateSphere("hand", { diameter: shape.arm * 0.95, segments: 10 }, scene), "skin", elbow, 0.005, -0.36, 0);
    rig.elbows.push(elbow);
    rig.shoulders.push(shoulder);
  }
  // Head, eyes and hair.
  add(CreateSphere("head", { diameter: HEAD_DIAMETER, segments: 20 }, scene), "skin", 0, HEAD_Y, 0);
  for (const side of [-1, 1]) {
    const eye = add(CreateSphere("eye", { diameter: 0.055, segments: 6 }, scene), "hair", side * 0.1, HEAD_Y + 0.02, -HEAD_DIAMETER / 2 + 0.01);
    eye.scaling.y = 1.25;
  }
  hairParts(preset.hair_style).forEach((part, i) => {
    const size = part.size.map(v => v * HEAD_DIAMETER) as Part["size"];
    add(mesh(scene, `hair-${i}`, { shape: part.shape, size }), part.tint, part.at[0] * HEAD_DIAMETER, HEAD_Y + part.at[1] * HEAD_DIAMETER, part.at[2] * HEAD_DIAMETER);
  });
  return Object.assign(root, { rig });
}

export function webglAvailable(): boolean {
  try { return Engine.isSupported(); } catch { return false; }
}

/** Renders every preset with identical camera, lights and pose, then releases the WebGL context. */
export async function renderAvatarSnapshots(presets: readonly AvatarPreset[], options: SnapshotOptions): Promise<void> {
  if (!webglAvailable()) throw new Error("WebGL is not available");
  const canvas = document.createElement("canvas");
  canvas.width = options.width ?? 280;
  canvas.height = options.height ?? 350;
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: false, alpha: true, antialias: true }, false);
  const scene = new Scene(engine);
  try {
    scene.clearColor = new Color4(0, 0, 0, 0);
    const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 2.9, new Vector3(0, 1.0, 0), scene);
    camera.minZ = 0.1;
    const fill = new HemisphericLight("fill", new Vector3(0, 1, -0.4), scene);
    fill.intensity = 0.85; fill.groundColor = new Color3(0.35, 0.34, 0.33);
    const key = new DirectionalLight("key", new Vector3(0.45, -0.55, 0.75), scene);
    key.intensity = 0.65;
    const shadow = CreateCylinder("floor", { diameter: 1.15, height: 0.01, tessellation: 32 }, scene);
    shadow.material = material(scene, "floor", "#000000", { alpha: 0.28, specular: 0 });
    shadow.position.y = 0.002;

    for (const preset of presets) {
      if (options.isCancelled?.()) return;
      const figure = buildAvatar(scene, preset);
      await scene.whenReadyAsync();
      scene.render();
      options.onSnapshot(preset.avatar_id, canvas.toDataURL("image/png"));
      figure.dispose(false, true);
    }
  } finally {
    scene.dispose();
    engine.dispose();
  }
}
