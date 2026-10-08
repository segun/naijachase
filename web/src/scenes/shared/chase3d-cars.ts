// Vehicles shared by the scenes that show a journey: the player's open-top runabout and a shared-ride minibus. Built from primitives.
// Both face -z (the front is at the camera end) and return their wheel hubs, which spin about x.
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Stage } from "./chase3d-stage.ts";

export type Wheels = TransformNode[];

/** The player's car: a yellow open-top runabout with a black bonnet stripe, so the driver can be seen at the wheel. */
export function runabout(stage: Stage): { root: TransformNode; wheels: Wheels } {
  const { box, cyl, sphere, mat, caster, scene } = stage;
  const root = new TransformNode("runabout", scene);
  const body = mat("#f2c14e", { specular: 0.4 });
  const dark = mat("#15191c", { specular: 0.1 });
  const trim = mat("#2b2f33", { specular: 0.2 });
  const seat = mat("#3b2a22", { specular: 0.1 });
  caster(box("chassis", 1.5, 0.2, 3.6, trim, 0, 0.2, 0, root));
  box("floor", 1.5, 0.06, 1.9, dark, 0, 0.3, 0.25, root);
  caster(box("hood", 1.6, 0.55, 1.15, body, 0, 0.575, -1.225, root));
  box("stripe", 0.34, 0.012, 1.15, dark, 0, 0.86, -1.225, root);
  caster(box("trunk", 1.6, 0.55, 0.6, body, 0, 0.575, 1.5, root));
  for (const s of [-1, 1]) caster(box("side", 0.07, 0.55, 1.85, body, s * 0.765, 0.575, 0.275, root));
  caster(box("dash", 1.5, 0.25, 0.3, trim, 0, 0.95, -0.5, root));
  for (const s of [-1, 1]) {
    caster(box("seatBase", 0.5, 0.12, 0.5, seat, s * 0.38, 0.59, 0.25, root));
    caster(box("seatBack", 0.5, 0.5, 0.1, seat, s * 0.38, 0.92, 0.55, root));
    box("post", 0.05, 0.5, 0.05, trim, s * 0.72, 1.3, -0.55, root).rotation.x = -0.25;
    sphere("headlight", 0.24, mat("#fff4cf", { emissive: "#fff4cf", specular: 0 }), s * 0.58, 0.7, -1.78).parent = root;
    box("taillight", 0.26, 0.12, 0.04, mat("#d63a2e", { emissive: "#8a1c14", specular: 0 }), s * 0.58, 0.7, 1.81, root);
  }
  box("windscreenTop", 1.5, 0.05, 0.05, trim, 0, 1.52, -0.62, root);
  box("windscreen", 1.4, 0.44, 0.02, mat("#9fd3f0", { specular: 0.7 }), 0, 1.3, -0.6, root).rotation.x = -0.25;
  const wheel = cyl("steering", 0.34, 0.34, 0.03, trim, -0.38, 1.03, -0.28, root);
  wheel.rotation.x = 1.15;
  box("bumperF", 1.62, 0.16, 0.12, dark, 0, 0.36, -1.8, root);
  box("bumperB", 1.62, 0.16, 0.12, dark, 0, 0.36, 1.8, root);
  const wheels: Wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const hub = new TransformNode("wheel", scene);
    hub.parent = root; hub.position.set(sx * 0.8, 0.31, sz * 1.15);
    const tyre = cyl("tyre", 0.62, 0.62, 0.22, dark, 0, 0, 0, hub); tyre.rotation.z = Math.PI / 2;
    const cap = cyl("cap", 0.3, 0.3, 0.24, mat("#aeb6bb", { specular: 0.5 }), 0, 0, 0, hub); cap.rotation.z = Math.PI / 2;
    wheels.push(hub);
  }
  return { root, wheels };
}

/** A yellow shared-ride minibus with a black stripe, a sliding door on its -x side near the front, and a roof rack. `door` slides back as it opens. */
export function danfo(stage: Stage): { root: TransformNode; wheels: Wheels; door: TransformNode } {
  const { box, cyl, mat, caster, scene } = stage;
  const root = new TransformNode("danfo", scene);
  const body = mat("#f2b705", { specular: 0.35 });
  const dark = mat("#15191c", { specular: 0.1 });
  const glass = mat("#27414f", { specular: 0.6 });
  const trim = mat("#2b2f33", { specular: 0.2 });
  caster(box("lower", 2, 1.05, 5, body, 0, 0.9, 0, root));
  caster(box("upper", 1.96, 0.85, 4.4, body, 0, 1.85, 0.25, root));
  box("stripe", 2.02, 0.2, 5.02, dark, 0, 1.12, 0, root);
  for (const s of [-1, 1]) {
    box("windows", 0.02, 0.5, 3.9, glass, s * 0.99, 1.95, 0.3, root);
    box("windscreen", 1.7, 0.55, 0.02, glass, 0, 1.95, -1.96, root);
  }
  box("bumperF", 2.05, 0.22, 0.14, dark, 0, 0.42, -2.55, root);
  box("bumperB", 2.05, 0.22, 0.14, dark, 0, 0.42, 2.55, root);
  for (const s of [-1, 1]) {
    box("headlight", 0.34, 0.2, 0.04, mat("#fff4cf", { emissive: "#fff4cf", specular: 0 }), s * 0.7, 0.85, -2.51, root);
    box("taillight", 0.3, 0.18, 0.04, mat("#d63a2e", { emissive: "#8a1c14", specular: 0 }), s * 0.75, 0.9, 2.51, root);
  }
  box("rack", 1.9, 0.05, 3.4, trim, 0, 2.3, 0.3, root);
  for (const z of [-1.2, 1.8]) for (const x of [-0.9, 0.9]) box("rackPost", 0.04, 0.12, 0.04, trim, x, 2.24, z, root);
  const door = new TransformNode("busDoor", scene);
  door.parent = root; door.position.set(-1.02, 0, -1.2);
  box("doorLeaf", 0.05, 1.45, 0.9, mat("#e0a800", { specular: 0.3 }), 0, 1.2, 0, door);
  box("doorGlass", 0.06, 0.55, 0.7, glass, 0, 1.55, 0, door);
  const wheels: Wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const hub = new TransformNode("wheel", scene);
    hub.parent = root; hub.position.set(sx * 0.9, 0.38, sz * 1.6);
    const tyre = cyl("tyre", 0.76, 0.76, 0.26, dark, 0, 0, 0, hub); tyre.rotation.z = Math.PI / 2;
    const cap = cyl("cap", 0.36, 0.36, 0.28, mat("#aeb6bb", { specular: 0.5 }), 0, 0, 0, hub); cap.rotation.z = Math.PI / 2;
    wheels.push(hub);
  }
  return { root, wheels, door };
}
