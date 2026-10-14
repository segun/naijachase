// Vehicles shared by the scenes that show a journey: the player's open-top runabout, a shared-ride minibus (a Lagos "danfo") and a closed
// saloon. The bodies are lofted (chase3d-shapes.ts): rounded noses, sloping windscreens, soft corners, with paint, glass and trim colours
// chosen per vertex, so they read as cars rather than stacks of boxes. They face -z (the front is at the camera end) and return their
// wheel hubs, which spin about x. The measurements (length, width, wheel and seat positions) are the ones the scenes' timelines rely on.
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { material } from "./chase3d-kit.ts";
import type { Stage } from "./chase3d-stage.ts";
import { type Rgb, type Rgba, type Zone, contactShadow, loft, rgb, rgba, roundedBox, tyre } from "./chase3d-shapes.ts";

export type Wheels = TransformNode[];

const CHROME = "#b9c0c6", RUBBER = "#121416", GLASS = "#1c2a33";

/** A wheel: a rounded tyre, a silver rim and a centre cap with spokes so its spin can be seen. Turns about x. */
function wheelHub(stage: Stage, parent: TransformNode, x: number, y: number, z: number, radius: number, width: number): TransformNode {
  const { mat, scene } = stage;
  const hub = new TransformNode("wheel", scene);
  hub.parent = parent; hub.position.set(x, y, z);
  const rubber = tyre(scene, "tyre", radius, width);
  rubber.material = mat(RUBBER, { specular: 0.08 }); rubber.parent = hub;
  const face = stage.cyl("rim", radius * 1.14, radius * 1.14, width * 0.88, mat("#c7ced3", { specular: 0.7 }), 0, 0, 0, hub);
  face.rotation.z = Math.PI / 2;
  const outer = Math.sign(x) || 1;
  for (let i = 0; i < 3; i++) {
    const spoke = stage.box("spoke", 0.035, 0.05, radius * 1.5, mat("#8a949b", { specular: 0.5 }), outer * width * 0.46, 0, 0, hub);
    spoke.rotation.x = (i * Math.PI) / 3;
  }
  const cap = stage.cyl("cap", radius * 0.34, radius * 0.34, width * 0.98, mat("#4a5258", { specular: 0.5 }), 0, 0, 0, hub);
  cap.rotation.z = Math.PI / 2;
  return hub;
}

/** The dark ring round a wheel where it meets the body, which is all it takes to read as a wheel arch. */
function arch(stage: Stage, parent: TransformNode, x: number, y: number, z: number, diameter: number) {
  const m = stage.cyl("arch", diameter, diameter, 0.05, stage.mat("#0a0c0d", { specular: 0 }), x, y, z, parent);
  m.rotation.z = Math.PI / 2;
}

const glassMaterial = (stage: Stage, name: string) => material(stage.scene, name, "#7fb4cc", { specular: 0.8, alpha: 0.5 });

/** Paint everywhere except where a rule says otherwise. */
const painted = (paint: Rgb, rule: (x: number, y: number, z: number) => Rgb | null): Zone => (x, y, z) => rule(x, y, z) ?? paint;

/** A small rounded part, parented, positioned and given a material in one go. */
function part(stage: Stage, parent: TransformNode, w: number, h: number, d: number, r: number, mtl: ReturnType<Stage["mat"]>, x: number, y: number, z: number, cast = false) {
  const m = roundedBox(stage.scene, "part", w, h, d, r);
  m.material = mtl; m.parent = parent; m.position.set(x, y, z);
  if (cast) stage.caster(m);
  return m;
}

/** The player's car: a yellow open-top roadster with a black bonnet stripe, so the driver can be seen at the wheel. */
export function runabout(stage: Stage): { root: TransformNode; wheels: Wheels } {
  const { mat, caster, scene, sphere } = stage;
  const root = new TransformNode("runabout", scene);
  const paint = rgb("#f2c14e"), dark = rgb("#14181b"), interior = rgb("#241a15");

  const body = loft(scene, "body", [
    { z: -1.80, y0: 0.36, y1: 0.60, hw: 0.56, n: 3 },
    { z: -1.72, y0: 0.29, y1: 0.73, hw: 0.72, n: 3.5 },
    { z: -1.50, y0: 0.25, y1: 0.83, hw: 0.80, n: 4 },
    { z: -0.90, y0: 0.25, y1: 0.89, hw: 0.82, n: 5 },
    { z: -0.50, y0: 0.25, y1: 0.91, hw: 0.82, n: 5 },
    { z: -0.40, y0: 0.25, y1: 0.62, hw: 0.80, n: 5 },
    { z: 1.00, y0: 0.25, y1: 0.62, hw: 0.80, n: 5 },
    { z: 1.08, y0: 0.25, y1: 0.80, hw: 0.80, n: 5 },
    { z: 1.55, y0: 0.25, y1: 0.86, hw: 0.80, n: 4 },
    { z: 1.74, y0: 0.31, y1: 0.78, hw: 0.70, n: 3.5 },
    { z: 1.80, y0: 0.39, y1: 0.64, hw: 0.58, n: 3 }
  ], {
    zone: painted(paint, (x, y, z) => {
      if (y < 0.36) return dark;
      if (y > 0.5 && z > -0.46 && z < 1.04) return interior;
      if (z < -0.6 && Math.abs(x) < 0.17 && y > 0.78) return dark;
      return null;
    })
  });
  body.material = mat("#ffffff", { specular: 0.55 }); body.parent = root; caster(body);

  // The doors: low walls round the cockpit with a dark rolled edge.
  for (const s of [-1, 1]) {
    part(stage, root, 0.07, 0.36, 1.45, 0.03, mat("#f2c14e", { specular: 0.55 }), s * 0.78, 0.76, 0.34, true);
    part(stage, root, 0.1, 0.05, 1.47, 0.02, mat("#1b1f22", { specular: 0.3 }), s * 0.78, 0.95, 0.34);
  }
  part(stage, root, 1.5, 0.22, 0.3, 0.07, mat("#25292d", { specular: 0.25 }), 0, 0.8, -0.52, true);
  const wheel = CreateTorus("steering", { diameter: 0.34, thickness: 0.035, tessellation: 20 }, scene);
  wheel.material = mat("#15181a", { specular: 0.3 }); wheel.parent = root; wheel.position.set(-0.38, 1.0, -0.28); wheel.rotation.x = 1.15;
  const leather = mat("#4a3426", { specular: 0.2 });
  for (const s of [-1, 1]) {
    part(stage, root, 0.5, 0.14, 0.5, 0.06, leather, s * 0.38, 0.65, 0.25, true);
    part(stage, root, 0.5, 0.52, 0.12, 0.06, leather, s * 0.38, 0.95, 0.56, true).rotation.x = -0.08;
  }

  // The windscreen: a tilted pane in a thin chrome frame.
  const pane = stage.plane("windscreen", 1.4, 0.44, glassMaterial(stage, "runaboutGlass"), 0, 1.28, -0.58);
  pane.rotation.x = -0.25; pane.parent = root; pane.receiveShadows = false;
  const chrome = mat(CHROME, { specular: 0.8 });
  part(stage, root, 1.5, 0.05, 0.05, 0.02, chrome, 0, 1.5, -0.66);
  for (const s of [-1, 1]) part(stage, root, 0.05, 0.64, 0.05, 0.02, chrome, s * 0.72, 1.18, -0.6).rotation.x = -0.25;

  // Lights, bumpers, grille.
  for (const s of [-1, 1]) {
    const bezel = sphere("bezel", 0.3, chrome, s * 0.52, 0.72, -1.7); bezel.parent = root; bezel.scaling.z = 0.5;
    const lamp = sphere("headlight", 0.23, mat("#fff4cf", { emissive: "#fff4cf", specular: 0 }), s * 0.52, 0.72, -1.76); lamp.parent = root; lamp.scaling.z = 0.5;
    part(stage, root, 0.26, 0.11, 0.05, 0.03, mat("#d63a2e", { emissive: "#8a1c14", specular: 0 }), s * 0.55, 0.72, 1.8);
  }
  for (const z of [-1.82, 1.84]) part(stage, root, 1.5, 0.12, 0.12, 0.05, chrome, 0, 0.4, z);
  part(stage, root, 0.56, 0.2, 0.05, 0.04, mat("#101315", { specular: 0.4 }), 0, 0.57, -1.79);

  const wheels: Wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    wheels.push(wheelHub(stage, root, sx * 0.76, 0.31, sz * 1.15, 0.31, 0.22));
    arch(stage, root, sx * 0.815, 0.31, sz * 1.15, 0.76);
  }
  contactShadow(scene, root, 2.3, 4.5);
  return { root, wheels };
}

/** A yellow shared-ride minibus (a Lagos "danfo") with a black stripe, a roof rack and a rear door that swings open about `door`'s y axis (negative angles open it outwards). */
export function danfo(stage: Stage): { root: TransformNode; wheels: Wheels; door: TransformNode } {
  const { mat, caster, scene, sphere } = stage;
  const root = new TransformNode("danfo", scene);
  const paint = rgb("#f2b705"), black = rgb("#15181a"), trim = rgb("#1b1e20");

  const zone: Zone = (x, y, z, i, stations) => {
    const hw = stations[i]!.hw;
    if (y < 0.56) return trim;
    if (z > -1.9 && y > 1.0 && y < 1.2) return black;
    if (z > -1.95 && z < 2.25 && y > 1.5 && y < 2.12 && Math.abs(x) > hw * 0.86) return null;
    if (z > -2.3 && z < -2.0 && y > 1.45 && Math.abs(x) < hw * 0.9) return null;
    return paint;
  };
  const shell = loft(scene, "shell", [
    { z: -2.50, y0: 0.46, y1: 1.30, hw: 0.80, n: 3.5 },
    { z: -2.44, y0: 0.40, y1: 1.60, hw: 0.92, n: 4 },
    { z: -2.25, y0: 0.36, y1: 1.90, hw: 0.98, n: 5 },
    { z: -2.05, y0: 0.36, y1: 2.24, hw: 1.0, n: 5 },
    { z: -1.90, y0: 0.36, y1: 2.30, hw: 1.0, n: 6 },
    { z: 2.20, y0: 0.36, y1: 2.30, hw: 1.0, n: 6 },
    { z: 2.42, y0: 0.38, y1: 2.24, hw: 0.97, n: 5 },
    { z: 2.52, y0: 0.46, y1: 1.95, hw: 0.88, n: 4 }
  ], { zone, ring: 28, cap: paint });
  const shellMat = mat("#ffffff", { specular: 0.45 }); shellMat.backFaceCulling = false; shell.material = shellMat; shell.parent = root; caster(shell);

  // Window pillars, bumpers, grille, lamps, mirrors, rack.
  const yellow = mat("#f2b705", { specular: 0.45 }), chrome = mat(CHROME, { specular: 0.8 }), blackMat = mat("#15181a", { specular: 0.25 });

  // Cabin interior: dark floor, seats, dashboard, steering wheel
  part(stage, root, 1.86, 0.05, 4.2, 0.02, mat("#202428", { specular: 0.1 }), 0, 0.45, 0.15);
  const seatMat = mat("#3a4046", { specular: 0.2 });
  for (const z of [-1.25, 0.1, 1.15]) {
    part(stage, root, 1.7, 0.1, 0.36, 0.03, seatMat, 0, 0.52, z);
    part(stage, root, 1.7, 0.35, 0.06, 0.03, seatMat, 0, 0.72, z + 0.16);
  }
  part(stage, root, 1.7, 0.22, 0.32, 0.04, blackMat, 0, 0.82, -1.8);
  const wheel = tyre(scene, "steeringWheel", 0.16, 0.03);
  wheel.material = blackMat; wheel.parent = root;
  wheel.position.set(0.42, 0.95, -1.65); wheel.rotation.x = Math.PI / 4;

  // Transparent window panes
  const glassMat = glassMaterial(stage, "danfoGlass");
  const nearGlass = stage.plane("nearGlass", 4.1, 0.65, glassMat, -0.99, 1.81, 0.15);
  nearGlass.parent = root; nearGlass.rotation.y = Math.PI / 2; nearGlass.receiveShadows = false;
  const farGlass = stage.plane("farGlass", 4.1, 0.65, glassMat, 0.99, 1.81, 0.15);
  farGlass.parent = root; farGlass.rotation.y = -Math.PI / 2; farGlass.receiveShadows = false;
  const frontGlass = stage.plane("frontGlass", 1.8, 0.65, glassMat, 0, 1.82, -2.12);
  frontGlass.parent = root; frontGlass.rotation.x = 0.35; frontGlass.receiveShadows = false;
  for (const s of [-1, 1]) for (const z of [-1.55, -0.45, 0.65, 1.75]) part(stage, root, 0.05, 0.66, 0.1, 0.02, yellow, s * 1.0, 1.82, z);
  for (const z of [-2.55, 2.56]) part(stage, root, 2.02, 0.2, 0.16, 0.07, blackMat, 0, 0.52, z);
  part(stage, root, 0.9, 0.24, 0.05, 0.05, blackMat, 0, 0.86, -2.5);
  part(stage, root, 0.9, 0.04, 0.06, 0.02, chrome, 0, 0.86, -2.52);
  for (const s of [-1, 1]) {
    const bezel = sphere("bezel", 0.36, chrome, s * 0.66, 0.88, -2.44); bezel.parent = root; bezel.scaling.z = 0.5;
    const lamp = sphere("headlight", 0.28, mat("#fff4cf", { emissive: "#fff4cf", specular: 0 }), s * 0.66, 0.88, -2.5); lamp.parent = root; lamp.scaling.z = 0.5;
    part(stage, root, 0.3, 0.2, 0.05, 0.04, mat("#d63a2e", { emissive: "#8a1c14", specular: 0 }), s * 0.78, 0.95, 2.53);
    part(stage, root, 0.18, 0.04, 0.04, 0.015, blackMat, s * 1.08, 1.5, -2.0);
    part(stage, root, 0.05, 0.22, 0.14, 0.02, blackMat, s * 1.18, 1.5, -2.0);
  }
  part(stage, root, 1.9, 0.04, 3.4, 0.015, blackMat, 0, 2.36, 0.3);
  for (const z of [-1.2, 1.8]) for (const x of [-0.9, 0.9]) part(stage, root, 0.04, 0.14, 0.04, 0.015, blackMat, x, 2.31, z);

  const door = new TransformNode("busDoor", scene);
  door.parent = root; door.position.set(0.85, 0, 2.55);
  part(stage, door, 1.7, 1.45, 0.06, 0.04, mat("#e0a800", { specular: 0.4 }), -0.85, 1.2, 0);
  const pane = stage.plane("doorGlass", 1.3, 0.55, glassMaterial(stage, "danfoGlass"), -0.85, 1.55, 0.04); pane.parent = door; pane.receiveShadows = false;

  const wheels: Wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    wheels.push(wheelHub(stage, root, sx * 0.9, 0.38, sz * 1.6, 0.38, 0.26));
    arch(stage, root, sx * 1.0, 0.38, sz * 1.6, 0.95);
  }
  contactShadow(scene, root, 2.8, 6.2);
  return { root, wheels, door };
}

/** A closed saloon in the given colour, with a rounded cabin of dark glass. Used for the cars parked in the garage. */
export function saloon(stage: Stage, name: string, colour: string, x: number, z: number): { root: TransformNode; wheels: Wheels } {
  const { mat, caster, scene, sphere } = stage;
  const root = new TransformNode(name, scene);
  root.position.set(x, 0, z);
  const paint = rgb(colour), trim = rgb("#14181b"), glass = rgb(GLASS);
  const zone: Zone = (px, y, sz, i, stations) => {
    if (y < 0.34) return trim;
    if (sz > -0.7 && sz < 1.3 && y > 0.97 && (Math.abs(px) > stations[i]!.hw * 0.78 || sz < -0.45 || sz > 0.95)) return glass;
    return paint;
  };
  const cabin = loft(scene, "cabin", [
    { z: -1.80, y0: 0.36, y1: 0.58, hw: 0.56, n: 3 },
    { z: -1.70, y0: 0.29, y1: 0.72, hw: 0.74, n: 3.5 },
    { z: -1.25, y0: 0.25, y1: 0.85, hw: 0.80, n: 4 },
    { z: -0.74, y0: 0.25, y1: 0.90, hw: 0.80, n: 4 },
    { z: -0.68, y0: 0.25, y1: 0.93, hw: 0.79, n: 4 },
    { z: -0.30, y0: 0.25, y1: 1.28, hw: 0.74, n: 3.5 },
    { z: 0.20, y0: 0.25, y1: 1.38, hw: 0.72, n: 3.2 },
    { z: 0.85, y0: 0.25, y1: 1.33, hw: 0.73, n: 3.5 },
    { z: 1.25, y0: 0.25, y1: 0.97, hw: 0.78, n: 4 },
    { z: 1.32, y0: 0.25, y1: 0.93, hw: 0.78, n: 4 },
    { z: 1.70, y0: 0.27, y1: 0.89, hw: 0.78, n: 4 },
    { z: 1.80, y0: 0.35, y1: 0.68, hw: 0.64, n: 3 }
  ], { zone, ring: 28, cap: paint });
  cabin.material = mat("#ffffff", { specular: 0.55 }); cabin.parent = root; caster(cabin);
  const chrome = mat(CHROME, { specular: 0.8 });
  for (const zz of [-1.82, 1.82]) part(stage, root, 1.55, 0.14, 0.12, 0.05, mat("#1a1d20", { specular: 0.3 }), 0, 0.38, zz);
  part(stage, root, 0.7, 0.18, 0.05, 0.04, mat("#101315", { specular: 0.4 }), 0, 0.62, -1.8);
  for (const s of [-1, 1]) {
    const lamp = sphere("headlight", 0.26, mat("#fff4cf", { emissive: "#fff4cf", specular: 0 }), s * 0.56, 0.66, -1.74); lamp.parent = root; lamp.scaling.z = 0.5;
    const bezel = sphere("bezel", 0.31, chrome, s * 0.56, 0.66, -1.72); bezel.parent = root; bezel.scaling.z = 0.45;
    part(stage, root, 0.28, 0.1, 0.05, 0.03, mat("#d63a2e", { emissive: "#8a1c14", specular: 0 }), s * 0.58, 0.68, 1.81);
  }
  const wheels: Wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    wheels.push(wheelHub(stage, root, sx * 0.76, 0.31, sz * 1.15, 0.31, 0.22));
    arch(stage, root, sx * 0.805, 0.31, sz * 1.15, 0.76);
  }
  contactShadow(scene, root, 2.3, 4.5);
  return { root, wheels };
}
