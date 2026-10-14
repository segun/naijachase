// Procedurally animated people for the 3D chase: the police and thief, and the passers-by of each city.
import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { DynamicTexture as Dyn } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { material, paint } from "../shared/chase3d-kit.ts";
import type { Pose } from "./chase-motion.ts";

export type HeadKind = "none" | "mask" | "cap" | "gele" | "redcap" | "fula" | "kufi";
export type Carry = "none" | "baton" | "sack" | "basket" | "hoe" | "briefcase" | "handbag" | "shoulderSack";

export type FigureSpec = {
  name: string;
  skin: string;
  top: string | DynamicTexture;
  bottom: string;
  head?: HeadKind;
  headColor?: string;
  /** Long wrapper skirt (market women) or ankle-length gown (Hausa farmers); hides the legs. */
  skirt?: string | DynamicTexture;
  gown?: string;
  carry?: Carry;
  uniform?: boolean;
  scale?: number;
};

/** How a model figure leaves its running clip: straight legs, hands up or arms out (see ChaseRunner). Built-in figures read it all from the pose. */
export type FigureExtras = { stand?: number; raise?: number; reach?: number };
export type Figure = { root: TransformNode; meshes: Mesh[]; apply(pose: Pose, cycle?: number, extras?: FigureExtras): void };

function limb(scene: Scene, parent: TransformNode, name: string, at: Vector3, upper: [number, number, number], lower: [number, number, number], mats: { upper: StandardMaterial; lower: StandardMaterial }) {
  const joint = new TransformNode(`${name}-joint`, scene);
  joint.parent = parent; joint.position = at;
  const top = CreateBox(`${name}-top`, { width: upper[0], height: upper[1], depth: upper[2] }, scene);
  top.parent = joint; top.position.y = -upper[1] / 2; top.material = mats.upper;
  const knee = new TransformNode(`${name}-knee`, scene);
  knee.parent = joint; knee.position.y = -upper[1];
  const bottom = CreateBox(`${name}-bottom`, { width: lower[0], height: lower[1], depth: lower[2] }, scene);
  bottom.parent = knee; bottom.position.y = -lower[1] / 2; bottom.material = mats.lower;
  return { joint, knee, top, bottom };
}

function textured(scene: Scene, name: string, value: string | DynamicTexture, specular = 0.12) {
  return typeof value === "string" ? material(scene, name, value, { specular }) : material(scene, name, "#ffffff", { texture: value });
}

/** Ankara-style printed cloth for market wrappers and head-ties. */
export function ankara(scene: Scene, name: string, base: string, accent: string, dot: string): DynamicTexture {
  return paint(scene, name, 64, 64, g => {
    g.fillStyle = base; g.fillRect(0, 0, 64, 64);
    g.fillStyle = accent;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.arc(8 + x * 16 + (y % 2) * 8, 8 + y * 16, 5, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = dot;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) g.fillRect(14 + x * 16 - (y % 2) * 8, 14 + y * 16, 3, 3);
  });
}

export function makeFigure(scene: Scene, o: FigureSpec): Figure {
  const root = new TransformNode(`${o.name}-root`, scene);
  root.scaling.setAll(o.scale ?? 1);
  const meshes: Mesh[] = [];
  const track = <T extends Mesh>(m: T) => { meshes.push(m); return m; };
  const skin = material(scene, `${o.name}-skin`, o.skin);
  const top = textured(scene, `${o.name}-top`, o.top, 0.18);
  const bottom = material(scene, `${o.name}-bottom`, o.bottom);
  const dark = material(scene, `${o.name}-dark`, "#050506", { specular: 0.3 });
  const gold = material(scene, `${o.name}-gold`, "#f2c14e", { emissive: "#6b4f12", specular: 0.6 });
  const headKind = o.head ?? "none";

  const hips = new TransformNode(`${o.name}-hips`, scene);
  hips.parent = root; hips.position.y = 0.95;
  const torsoPivot = new TransformNode(`${o.name}-torso`, scene);
  torsoPivot.parent = hips;
  const torso = track(CreateBox(`${o.name}-chest`, { width: 0.3, height: 0.66, depth: 0.52 }, scene));
  torso.parent = torsoPivot; torso.position.y = 0.33; torso.material = top;

  if (o.uniform) {
    const belt = track(CreateBox(`${o.name}-belt`, { width: 0.32, height: 0.07, depth: 0.54 }, scene));
    belt.parent = torsoPivot; belt.position.y = 0.04; belt.material = dark;
    const buckle = CreateBox(`${o.name}-buckle`, { width: 0.02, height: 0.06, depth: 0.08 }, scene);
    buckle.parent = torsoPivot; buckle.position.set(0.16, 0.04, 0); buckle.material = gold;
  }

  const head = new TransformNode(`${o.name}-head`, scene);
  head.parent = torsoPivot; head.position.y = 0.86;
  const skull = track(CreateSphere(`${o.name}-skull`, { diameter: 0.3, segments: 12 }, scene));
  skull.parent = head; skull.material = headKind === "mask" ? material(scene, `${o.name}-balaclava`, "#101012") : skin;
  const headMat = material(scene, `${o.name}-headwear`, o.headColor ?? "#101317", { specular: 0.2 });
  switch (headKind) {
    case "mask": {
      const slit = CreateBox(`${o.name}-slit`, { width: 0.04, height: 0.06, depth: 0.2 }, scene);
      slit.parent = head; slit.position.set(0.13, 0.03, 0); slit.material = skin;
      const eyes = CreateBox(`${o.name}-eyes`, { width: 0.01, height: 0.02, depth: 0.14 }, scene);
      eyes.parent = head; eyes.position.set(0.155, 0.035, 0); eyes.material = material(scene, `${o.name}-eyes`, "#ffffff", { emissive: "#ffffff" });
      break;
    }
    case "cap": {
      const crown = CreateCylinder(`${o.name}-crown`, { height: 0.1, diameterTop: 0.28, diameterBottom: 0.33, tessellation: 20 }, scene);
      crown.parent = head; crown.position.y = 0.13; crown.material = headMat;
      const brim = CreateBox(`${o.name}-brim`, { width: 0.16, height: 0.025, depth: 0.28 }, scene);
      brim.parent = head; brim.position.set(0.18, 0.09, 0); brim.material = dark;
      const badge = CreateSphere(`${o.name}-badge`, { diameter: 0.05, segments: 6 }, scene);
      badge.parent = head; badge.position.set(0.15, 0.15, 0); badge.material = gold;
      break;
    }
    case "gele": {
      const wrap = CreateSphere(`${o.name}-gele`, { diameter: 0.4, segments: 8 }, scene);
      wrap.parent = head; wrap.scaling.set(1.05, 0.62, 1.25); wrap.position.y = 0.15; wrap.material = headMat;
      const knot = CreateSphere(`${o.name}-knot`, { diameter: 0.2, segments: 6 }, scene);
      knot.parent = head; knot.position.set(-0.04, 0.27, 0.1); knot.material = headMat;
      break;
    }
    case "redcap": {
      const cap = CreateCylinder(`${o.name}-okpu`, { height: 0.13, diameterTop: 0.26, diameterBottom: 0.32, tessellation: 16 }, scene);
      cap.parent = head; cap.position.y = 0.15; cap.material = headMat;
      const feather = CreateBox(`${o.name}-feather`, { width: 0.02, height: 0.22, depth: 0.06 }, scene);
      feather.parent = head; feather.position.set(-0.08, 0.3, 0.08); feather.rotation.x = 0.4; feather.material = material(scene, `${o.name}-feather`, "#f4f1e6");
      break;
    }
    case "fula": {
      const hat = CreateCylinder(`${o.name}-fula`, { height: 0.16, diameterTop: 0.06, diameterBottom: 0.7, tessellation: 20 }, scene);
      hat.parent = head; hat.position.y = 0.17; hat.material = material(scene, `${o.name}-straw`, "#c9a45a");
      break;
    }
    case "kufi": {
      const cap = CreateCylinder(`${o.name}-kufi`, { height: 0.11, diameterTop: 0.27, diameterBottom: 0.3, tessellation: 16 }, scene);
      cap.parent = head; cap.position.y = 0.14; cap.material = headMat;
      break;
    }
  }

  const legMats = { upper: bottom, lower: bottom };
  const legL = limb(scene, hips, `${o.name}-legL`, new Vector3(0, 0, -0.13), [0.19, 0.48, 0.19], [0.16, 0.47, 0.16], legMats);
  const legR = limb(scene, hips, `${o.name}-legR`, new Vector3(0, 0, 0.13), [0.19, 0.48, 0.19], [0.16, 0.47, 0.16], legMats);
  for (const leg of [legL, legR]) {
    const foot = CreateBox(`${o.name}-foot`, { width: 0.3, height: 0.09, depth: 0.15 }, scene);
    foot.parent = leg.knee; foot.position.set(0.06, -0.5, 0); foot.material = dark;
    meshes.push(leg.top, leg.bottom, foot);
  }

  const wide = o.gown !== undefined;
  const armMats = { upper: top, lower: wide ? top : skin };
  const sleeve: [number, number, number] = wide ? [0.17, 0.32, 0.17] : [0.13, 0.32, 0.13];
  const armL = limb(scene, torsoPivot, `${o.name}-armL`, new Vector3(0, 0.6, -0.31), sleeve, [0.11, 0.3, 0.11], armMats);
  const armR = limb(scene, torsoPivot, `${o.name}-armR`, new Vector3(0, 0.6, 0.31), sleeve, [0.11, 0.3, 0.11], armMats);
  meshes.push(armL.top, armL.bottom, armR.top, armR.bottom);

  let skirt: TransformNode | null = null;
  if (o.skirt !== undefined || o.gown !== undefined) {
    skirt = new TransformNode(`${o.name}-skirt`, scene);
    skirt.parent = hips; skirt.position.y = 0.12;
    const long = o.gown !== undefined;
    const cloth = long ? CreateCylinder(`${o.name}-gown`, { height: 1.3, diameterTop: 0.5, diameterBottom: 0.7, tessellation: 14 }, scene)
      : CreateCylinder(`${o.name}-wrapper`, { height: 0.85, diameterTop: 0.4, diameterBottom: 0.62, tessellation: 14 }, scene);
    cloth.parent = skirt; cloth.position.y = long ? -0.4 : -0.3;
    cloth.material = long ? material(scene, `${o.name}-gownMat`, o.gown!, { specular: 0.1 }) : textured(scene, `${o.name}-wrapperMat`, o.skirt!);
    meshes.push(cloth);
  }

  const carry = o.carry ?? "none";
  const hand = (m: Mesh | TransformNode) => { m.parent = armR.knee; };
  let swaying: TransformNode | null = null;
  switch (carry) {
    case "baton": {
      const stick = CreateCylinder(`${o.name}-baton`, { height: 0.55, diameter: 0.045, tessellation: 8 }, scene);
      hand(stick); stick.position.set(0, -0.3, 0); stick.rotation.z = 0.4; stick.material = dark;
      const grip = CreateCylinder(`${o.name}-grip`, { height: 0.14, diameter: 0.05, tessellation: 8 }, scene);
      grip.parent = stick; grip.position.y = -0.2; grip.material = gold;
      break;
    }
    case "sack": {
      swaying = new TransformNode(`${o.name}-sack`, scene);
      swaying.parent = torsoPivot; swaying.position.set(-0.3, 0.55, 0);
      const bag = CreateSphere(`${o.name}-bag`, { diameter: 0.55, segments: 10 }, scene);
      bag.parent = swaying; bag.scaling.set(0.8, 1, 0.9); bag.material = material(scene, `${o.name}-bag`, "#8b5a2b");
      const tie = CreateCylinder(`${o.name}-tie`, { height: 0.18, diameterTop: 0.02, diameterBottom: 0.14, tessellation: 8 }, scene);
      tie.parent = swaying; tie.position.y = 0.3; tie.material = material(scene, `${o.name}-tie`, "#6f451d");
      const label = new Dyn(`${o.name}-naira`, { width: 128, height: 128 }, scene, true);
      label.hasAlpha = true;
      label.drawText("\u20A6", 24, 100, "bold 96px Arial, sans-serif", "#f6f1e1", "transparent", true);
      const mark = CreatePlane(`${o.name}-mark`, { size: 0.34, sideOrientation: 2 }, scene);
      mark.parent = swaying; mark.position.z = -0.25;
      mark.material = Object.assign(new StandardMaterial(`${o.name}-markMat`, scene), { diffuseTexture: label, useAlphaFromDiffuseTexture: true, emissiveColor: new Color3(0.4, 0.4, 0.4), backFaceCulling: false });
      meshes.push(bag);
      break;
    }
    case "shoulderSack": {
      swaying = new TransformNode(`${o.name}-shoulderSack`, scene);
      swaying.parent = torsoPivot; swaying.position.set(-0.08, 0.78, 0.2);
      const bag = CreateSphere(`${o.name}-sackBag`, { diameter: 0.48, segments: 8 }, scene);
      bag.parent = swaying; bag.scaling.set(1.5, 0.8, 0.9); bag.material = material(scene, `${o.name}-sackMat`, "#cdb98a");
      meshes.push(bag);
      break;
    }
    case "basket": {
      const basket = new TransformNode(`${o.name}-basket`, scene);
      basket.parent = head; basket.position.y = (headKind === "gele" ? 0.36 : 0.2);
      const tub = CreateCylinder(`${o.name}-tub`, { height: 0.2, diameterTop: 0.56, diameterBottom: 0.4, tessellation: 14 }, scene);
      tub.parent = basket; tub.material = material(scene, `${o.name}-tubMat`, "#b9833d");
      const goods = ["#e8742c", "#d8d03a", "#3a9a3f"];
      goods.forEach((c, i) => {
        const g = CreateSphere(`${o.name}-good${i}`, { diameter: 0.2, segments: 6 }, scene);
        g.parent = basket; g.position.set(Math.cos(i * 2.1) * 0.11, 0.16, Math.sin(i * 2.1) * 0.11); g.material = material(scene, `${o.name}-goodMat${i}`, c);
      });
      meshes.push(tub);
      break;
    }
    case "hoe": {
      const shaft = CreateCylinder(`${o.name}-hoe`, { height: 1.15, diameter: 0.04, tessellation: 6 }, scene);
      hand(shaft); shaft.position.set(0.1, -0.1, 0); shaft.rotation.z = -0.5; shaft.material = material(scene, `${o.name}-wood`, "#6b4a2a");
      const blade = CreateBox(`${o.name}-blade`, { width: 0.2, height: 0.04, depth: 0.16 }, scene);
      blade.parent = shaft; blade.position.y = -0.58; blade.material = dark;
      break;
    }
    case "briefcase": {
      const box = CreateBox(`${o.name}-case`, { width: 0.1, height: 0.26, depth: 0.36 }, scene);
      hand(box); box.position.set(0, -0.34, 0); box.material = material(scene, `${o.name}-caseMat`, "#2b1d14");
      break;
    }
    case "handbag": {
      const box = CreateBox(`${o.name}-bag`, { width: 0.1, height: 0.2, depth: 0.28 }, scene);
      hand(box); box.position.set(0, -0.3, 0); box.material = material(scene, `${o.name}-bagMat`, "#a3262a");
      break;
    }
  }

  const apply = (p: Pose) => {
    hips.position.y = 0.95 + p.bodyY;
    torsoPivot.rotation.z = p.lean;
    head.rotation.z = -p.lean * 0.6 + p.headBob;
    legL.joint.rotation.z = p.thighL; legR.joint.rotation.z = p.thighR;
    legL.knee.rotation.z = p.shinL; legR.knee.rotation.z = p.shinR;
    armL.joint.rotation.z = p.armL; armR.joint.rotation.z = p.armR;
    armL.knee.rotation.z = p.elbowL; armR.knee.rotation.z = p.elbowR;
    if (swaying) swaying.rotation.z = -p.bodyY * 4;
    if (skirt) skirt.rotation.z = (p.thighL - p.thighR) * 0.08;
  };
  return { root, meshes, apply };
}
