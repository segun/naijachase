// Draws a venue layout (layout-open-air-kit.ts) in 3D for the witness scene: static solids are merged into a few meshes, the few things that move
// get a mesh each, and the people are the shared passers-by. A set is only data plus this function; see chase3d-open-air.ts.
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { hex, merge, paint } from "../shared/chase3d-kit.ts";
import { roundedBox } from "../shared/chase3d-shapes.ts";
import type { Ctx } from "../shared/chase3d-stage.ts";
import { ankara } from "../chase/chase3d-actors.ts";
import { PRINTS } from "./market-layout.ts";
import { type Walker, person } from "./chase3d-people.ts";
import type { Set3D, SetContext3D } from "./chase3d-sets.ts";
import { type Layout, type LayoutBuilder, type Prop, armAngle, sceneSeed, crowdLimit, moveAt, placeAt } from "./layout-open-air-kit.ts";

type Mover = { mesh: Mesh | TransformNode; x: number; y: number; z: number; prop: Prop };
const ALPHA_ADD = 1;

/** Paints a sign: the text fitted to the board, one line per "\n". */
function paintSign(g: Ctx, p: Extract<Prop, { k: "sign" }>, wpx: number, hpx: number) {
  g.fillStyle = p.bg; g.fillRect(0, 0, wpx, hpx);
  g.strokeStyle = p.fg; g.lineWidth = Math.max(2, hpx * 0.03); g.strokeRect(hpx * 0.06, hpx * 0.06, wpx - hpx * 0.12, hpx - hpx * 0.12);
  const lines = p.text.split("\n");
  let size = (hpx * 0.72) / lines.length;
  const font = (s: number) => `bold ${s}px 'Arial Black', Impact, Arial, sans-serif`;
  g.font = font(size);
  while (size > 10 && lines.some(l => g.measureText(l).width > wpx * 0.9)) { size -= 3; g.font = font(size); }
  g.fillStyle = p.fg;
  lines.forEach((l, i) => g.fillText(l, wpx / 2 - g.measureText(l).width / 2, hpx / 2 + (i - (lines.length - 1) / 2) * size * 1.12 + size * 0.34));
}

export function drawLayout3d(layout: Layout, { stage, options }: SetContext3D) {
  const { scene, palette, mat, box, cyl, sphere, plane, textured } = stage;
  const light = stage.light;
  const night = palette.lamp > 0.3;
  const wanted = (p: Prop) => (!p.hi || !light) && (!p.night || night);

  // The ground and any water cover the common red earth, just under the lane.
  stage.box("groundCover", 400, 0.04, 200, mat(layout.ground, { specular: 0 }), 0, 0.0, 70).receiveShadows = false;
  if (layout.water) {
    const w = stage.box("water", 400, 0.04, 300, mat(layout.water.c, { specular: 0.45 }), 0, 0.01, layout.water.z + 150);
    w.receiveShadows = false;
  }

  const statics: Mesh[] = [];
  const movers: Mover[] = [];
  const halos = new Map<string, StandardMaterial>();
  const halo = (c: string) => {
    let m = halos.get(c);
    if (!m) {
      const tex: DynamicTexture = paint(scene, `halo${halos.size}`, 64, 64, g => {
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, `${c}ee`); grad.addColorStop(0.35, `${c}66`); grad.addColorStop(1, `${c}00`);
        g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      }, false);
      tex.hasAlpha = true;
      m = new StandardMaterial(`haloMat${halos.size}`, scene);
      m.diffuseTexture = tex; m.useAlphaFromDiffuseTexture = true; m.emissiveColor = hex("#ffffff"); m.disableLighting = true;
      m.backFaceCulling = false; m.alphaMode = ALPHA_ADD; m.fogEnabled = false;
      halos.set(c, m);
    }
    return m;
  };

  const add = (mesh: Mesh, p: Prop, y: number) => {
    if ("m" in p && p.m) movers.push({ mesh, x: mesh.position.x, y, z: mesh.position.z, prop: p });
    else statics.push(mesh);
    return mesh;
  };

  for (const p of layout.props) {
    if (!wanted(p)) continue;
    if (p.k === "sign") {
      const wpx = 512, hpx = Math.max(64, Math.round((512 * p.h) / p.w));
      const board = textured(`sign${movers.length}${statics.length}`, p.w, p.h, g => paintSign(g, p, wpx, hpx), wpx, hpx);
      const m = plane("sign", p.w, p.h, board.material, p.x, p.y + p.h / 2, p.z);
      m.receiveShadows = false;
      if (p.m) movers.push({ mesh: m, x: p.x, y: p.y + p.h / 2, z: p.z, prop: p }); // a sign never has to be merged
      continue;
    }
    if (p.k === "glow") {
      const m = plane("halo", p.r * 2, p.r * 2, halo(p.c), p.x, p.y, p.z);
      m.billboardMode = Mesh.BILLBOARDMODE_ALL; m.isPickable = false;
      if (p.m) movers.push({ mesh: m, x: p.x, y: p.y, z: p.z, prop: p });
      continue;
    }
    const glowing = !!p.glow && night;
    const m = mat(p.c, glowing ? { emissive: p.c, specular: 0 } : {});
    switch (p.k) {
      case "box": add(p.soft && !light ? stage.place(roundedBox(scene, "p", p.w, p.h, p.d, p.soft, true), m, p.x, p.y + p.h / 2, p.z) : box("p", p.w, p.h, p.d, m, p.x, p.y + p.h / 2, p.z), p, p.y + p.h / 2); break;
      case "cyl": add(cyl("p", p.w2 ?? p.w, p.w, p.h, m, p.x, p.y + p.h / 2, p.z), p, p.y + p.h / 2); break;
      case "cylx": { const c = cyl("p", p.h, p.h, p.w, m, p.x, p.y + p.h / 2, p.z); c.rotation.z = Math.PI / 2; add(c, p, p.y + p.h / 2); break; }
      case "cylz": { const c = cyl("p", p.w, p.w, p.d, m, p.x, p.y + p.w / 2, p.z); c.rotation.x = Math.PI / 2; add(c, p, p.y + p.w / 2); break; }
      case "ball": { const sy = p.sy ?? 1; const s = sphere("p", p.w, m, p.x, p.y + (p.w * sy) / 2, p.z); s.scaling.y = sy; add(s, p, p.y + (p.w * sy) / 2); break; }
      case "arm": {
        if (p.amp) {
          const pivot = new TransformNode("pivot", scene);
          pivot.position.set(p.x, p.y, p.z);
          box("arm", p.len, p.t, p.t, m, p.len / 2, 0, 0, pivot);
          movers.push({ mesh: pivot, x: p.x, y: p.y, z: p.z, prop: p });
        } else {
          const a = p.a, bar = box("arm", p.len, p.t, p.t, m, p.x + (p.len / 2) * Math.cos(a), p.axis === "z" ? p.y + (p.len / 2) * Math.sin(a) : p.y, p.axis === "z" ? p.z : p.z - (p.len / 2) * Math.sin(a));
          if (p.axis === "z") bar.rotation.z = a; else bar.rotation.y = a;
          statics.push(bar);
        }
        break;
      }
    }
  }
  if (statics.length > 1) merge("openAirStatic", statics);

  // ---- Light after dark: a couple of real lights near the witness's side of the scene, the rest is painted ----
  if (night) {
    for (const l of layout.lamps.slice(0, 2)) {
      const lamp = new PointLight("lamp", new Vector3(l.x, l.y, l.z), scene);
      lamp.diffuse = hex(l.c); lamp.range = 9; lamp.intensity = 0.55 * palette.lamp;
    }
  }

  // ---- People ----
  const prints = PRINTS.map((p, i) => ankara(scene, `print${i}`, p[0], p[1], p[2]));
  const crowd = layout.people.slice(0, crowdLimit(light));
  const folk: Walker[] = crowd.map(p => {
    const w = person(stage, p.seed + 1, prints);
    return { ...w, dir: p.walk && p.walk.v < 0 ? -1 : 1 };
  });
  const tmp: [number, number, number] = [0, 0, 0];

  return {
    update(t: number) {
      for (const mv of movers) {
        const p = mv.prop;
        if (p.k === "arm") {
          const a = armAngle(p, t);
          if (p.axis === "z") (mv.mesh as TransformNode).rotation.z = a; else (mv.mesh as TransformNode).rotation.y = a;
          continue;
        }
        moveAt(p.m, t, tmp);
        mv.mesh.position.set(mv.x + tmp[0], mv.y + tmp[1], mv.z + tmp[2]);
      }
      crowd.forEach((p, i) => {
        const c = folk[i]!, at = placeAt(p, t);
        c.root.position.set(at.x, at.bounce, at.z);
        c.root.rotation.y = at.face;
        c.legs.forEach((l, j) => { l.rotation.x = j ? at.swing : -at.swing; });
        c.arms.forEach((a, j) => { a.rotation.x = j ? -at.swing : at.swing; });
      });
    }
  };
}

/** The 3D set for a layout builder: `build` makes the layout for this venue's variant and name. */
export const openAirSet3d = (build: LayoutBuilder): Set3D => ctx =>
  drawLayout3d(build(ctx.options.recipe.variant ?? "", ctx.options.venueName, sceneSeed(ctx.options.text)), ctx);
