// The people of the building sets in 3D: a few primitives each, in the clothes the layout gives them (layout-buildings-people.ts).
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Stage } from "../shared/chase3d-stage.ts";
import { type Person, SKINS, poseAt } from "./layout-buildings-people.ts";

export type Figure3D = { apply: (t: number) => void };

export function makePerson3d(stage: Stage, p: Person, index: number): Figure3D {
  const { scene, mat, cyl, sphere, box } = stage;
  const root = new TransformNode(`person${index}`, scene);
  const legs: TransformNode[] = [], arms: TransformNode[] = [];
  const pivot = (x: number, y: number) => { const n = new TransformNode("pivot", scene); n.parent = root; n.position.set(x, y, 0); return n; };
  const skin = mat(SKINS[p.skin % SKINS.length]!), top = mat(p.top);

  cyl("torso", 0.3, 0.38, 0.6, top, 0, 1.17, 0, root);
  for (const side of [-1, 1]) {
    const arm = pivot(side * 0.22, 1.42);
    cyl("arm", 0.09, 0.08, 0.56, p.skirt ? top : skin, 0, -0.26, 0, arm);
    arms.push(arm);
  }
  if (p.skirt) cyl("wrapper", 0.34, 0.56, 0.86, mat(p.skirt), 0, 0.45, 0, root);
  else {
    const trousers = mat(p.bottom);
    for (const side of [-1, 1]) {
      const leg = pivot(side * 0.1, 0.86);
      cyl("leg", 0.17, 0.13, 0.84, trousers, 0, -0.42, 0, leg);
      legs.push(leg);
    }
  }
  sphere("head", 0.3, skin, 0, 1.66, 0).parent = root;
  if (p.head?.kind === "wrap") { const w = sphere("headtie", 0.36, mat(p.head.c), 0, 1.76, 0.01); w.parent = root; w.scaling.set(1, 0.7, 1.1); }
  if (p.head?.kind === "cap") cyl("cap", 0.22, 0.28, 0.1, mat(p.head.c), 0, 1.83, 0, root);
  const prop = p.prop;
  if (prop?.kind === "bag") box("bag", 0.22, 0.28, 0.1, mat(prop.c), -0.34, 0.85, 0.02, root);
  if (prop?.kind === "staff") cyl("staff", 0.04, 0.04, 1.7, mat(prop.c), 0.36, 0.85, -0.05, root);
  if (prop?.kind === "drum") { const d = cyl("drum", 0.34, 0.26, 0.4, mat(prop.c), -0.3, 0.95, -0.12, root); d.rotation.z = 0.5; }
  if (prop?.kind === "tray") { box("tray", 0.46, 0.03, 0.32, mat(prop.c), 0.3, 1.12, -0.2, root); cyl("cup", 0.07, 0.06, 0.12, mat("#f4f1e6"), 0.3, 1.2, -0.2, root); }

  return {
    apply(t) {
      const w = poseAt(p, t);
      root.position.set(w.x, w.bounce, w.z);
      root.rotation.y = w.heading;
      legs.forEach((l, j) => { l.rotation.x = j ? w.swing : -w.swing; });
      arms.forEach((a, j) => { a.rotation.x = (j ? -w.swing : w.swing) + (j ? w.gesture : 0); });
    }
  };
}
