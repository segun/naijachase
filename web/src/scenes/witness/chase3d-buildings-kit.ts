// Draws a building layout (layout-buildings-venues.ts) in 3D: the parts of a venue become boxes, cylinders and spheres, static ones merged by
// material so a whole frontage costs a handful of draw calls, and the few moving ones (a bell, flags, beacons, steam, the people) are moved
// each frame by a pure function of `t`.
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { hex, material, merge } from "../shared/chase3d-kit.ts";
import type { Stage } from "../shared/chase3d-stage.ts";
import type { WitnessOptions } from "./witness-driver.ts";
import type { SetResult3D } from "./chase3d-sets.ts";
import { type Part, beaconPhase, neonOn, puffAt, swingAt } from "./layout-buildings-parts.ts";
import { layoutFor } from "./layout-buildings-venues.ts";
import { hashOf } from "./venue-recipes.ts";
import { makePerson3d } from "./chase3d-buildings-people.ts";
import { crowdModelId, type ModelGroup } from "./witness-models.ts";
import { replaceScenery } from "./chase3d-witness-models.ts";

/** A hex colour scaled towards black. */
const dim = (c: string, k: number) => `#${[1, 3, 5].map(i => Math.round(parseInt(c.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("")}`;

/** A triangular prism: a gable end facing the camera, `w` wide at the base and `h` high, `d` deep. */
function prismMesh(stage: Stage, name: string, p: Extract<Part, { k: "prism" }>, mtl: StandardMaterial) {
  const hw = p.w / 2, hd = p.d / 2;
  const a = [-hw, 0, -hd], b = [hw, 0, -hd], c = [0, p.h, -hd], d = [-hw, 0, hd], e = [hw, 0, hd], f = [0, p.h, hd];
  const slope = Math.hypot(p.h, hw);
  const nl = [-p.h / slope, hw / slope, 0], nr = [p.h / slope, hw / slope, 0];
  const faces: [number[][], number[]][] = [
    [[a, b, c], [0, 0, -1]], [[e, d, f], [0, 0, 1]],
    [[a, c, f, d], nl], [[b, e, f, c], nr], [[a, d, e, b], [0, -1, 0]]
  ];
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  for (const [verts, n] of faces) {
    const base = positions.length / 3;
    for (const v of verts) { positions.push(v[0]!, v[1]!, v[2]!); normals.push(n[0]!, n[1]!, n[2]!); }
    for (let i = 1; i < verts.length - 1; i++) indices.push(base, base + i, base + i + 1);
  }
  const mesh = new Mesh(name, stage.scene);
  const data = new VertexData();
  data.positions = positions; data.normals = normals; data.indices = indices;
  data.applyToMesh(mesh);
  mesh.material = mtl; mesh.position.set(p.x, p.y, p.z);
  mesh.receiveShadows = !stage.light;
  return mesh;
}

export function buildLayout3d(stage: Stage, options: WitnessOptions): SetResult3D {
  const { palette, mat, box, cyl, sphere, plane, textured } = stage;
  const night = palette.lamp > 0.3;
  const layout = layoutFor(options.recipe.variant ?? options.recipe.id, { night, light: stage.light, name: options.venueName, seed: hashOf(options.text) });

  const twoSided = new Map<string, StandardMaterial>();
  const solid = (c: string) => {
    let m = twoSided.get(c);
    if (!m) { m = material(stage.scene, `prism${twoSided.size}`, c, { specular: 0.03 }); m.backFaceCulling = false; twoSided.set(c, m); }
    return m;
  };

  if (layout.ground !== "#a35f38") box("groundTint", 120, 0.02, 60, mat(layout.ground, { specular: 0 }), 0, 0.005, 30);

  const groups = new Map<StandardMaterial, Mesh[]>();
  const main: ModelGroup = { id: `${options.recipe.id}_main` };
  const replacements = new Map<ModelGroup, Mesh[]>();
  let current: Part | undefined;
  const keep = (m: Mesh, mtl: StandardMaterial) => {
    if (options.models && current && current.k !== "pave") {
      const group = current.modelGroup ?? main;
      const meshes = replacements.get(group) ?? []; meshes.push(m); replacements.set(group, meshes);
    } else { const g = groups.get(mtl) ?? []; g.push(m); groups.set(mtl, g); }
  };
  const moving: ((t: number) => void)[] = [];
  const lights: PointLight[] = [];
  let paving = 0;

  const surface = (c: string, lit?: string) => (night && lit ? mat(lit, { emissive: dim(lit, 0.6), specular: 0 }) : mat(c));

  for (const p of layout.parts) {
    current = p;
    switch (p.k) {
      case "box": {
        if (p.neon) {
          const bright = mat(p.neon, { emissive: p.neon, specular: 0 }), faint = mat(dim(p.neon, 0.45), { emissive: dim(p.neon, 0.15), specular: 0 });
          const m = box("neon", p.w, p.h, p.d, night ? bright : faint, p.x, p.y + p.h / 2, p.z);
          if (night) moving.push(t => { m.material = neonOn(t, p.ph ?? 0) ? bright : faint; });
        } else keep(box("part", p.w, p.h, p.d, surface(p.c, p.lit), p.x, p.y + p.h / 2, p.z), surface(p.c, p.lit));
        break;
      }
      case "cyl": {
        const mtl = mat(p.c), m = cyl("part", (p.rt ?? p.r) * 2, p.r * 2, p.h, mtl, p.x, p.y + p.h / 2, p.z);
        if (p.swing) { const x0 = p.x; moving.push(t => { m.position.x = x0 + swingAt(p.swing!, t); }); } else keep(m, mtl);
        break;
      }
      case "ball": {
        const mtl = mat(p.c), m = sphere("ball", p.r * 2, mtl, p.x, p.y, p.z);
        m.scaling.y = p.sy ?? 1; keep(m, mtl);
        break;
      }
      case "disc": {
        const mtl = surface(p.c, p.lit), m = cyl("disc", p.r * 2, p.r * 2, 0.08, mtl, p.x, p.y, p.z);
        m.rotation.x = Math.PI / 2; keep(m, mtl);
        break;
      }
      case "prism": { const mtl = solid(p.c); keep(prismMesh(stage, "prism", p, mtl), mtl); break; }
      case "pave": {
        const h = 0.03 + paving++ * 0.004;
        const mtl = mat(p.c, { specular: 0 });
        keep(box("pave", p.x1 - p.x0, h, p.z1 - p.z0, mtl, (p.x0 + p.x1) / 2, h / 2, (p.z0 + p.z1) / 2), mtl);
        break;
      }
      case "sign": {
        box("signBoard", p.w + 0.16, p.h + 0.16, 0.1, mat(p.c), p.x, p.y, p.z);
        const painted = textured(`sign-${p.text}-${p.x}`, p.w, p.h, g => {
          const W = 1024, H = Math.round((1024 * p.h) / p.w);
          g.fillStyle = p.c; g.fillRect(0, 0, W, H);
          g.strokeStyle = "#f2d37b"; g.lineWidth = 6; g.strokeRect(10, 10, W - 20, H - 20);
          const label = p.text.toUpperCase(); let size = Math.round(H * 0.6);
          g.font = `bold ${size}px Arial, sans-serif`;
          while (size > 20 && g.measureText(label).width > W - 80) { size -= 4; g.font = `bold ${size}px Arial, sans-serif`; }
          g.fillStyle = p.fg; g.fillText(label, W / 2 - g.measureText(label).width / 2, H / 2 + size * 0.35);
        }, 1024, Math.round((1024 * p.h) / p.w));
        plane("signText", painted.width, painted.height, painted.material, p.x, p.y, p.z - 0.06).receiveShadows = false;
        break;
      }
      case "flag": {
        const painted = textured(`flag-${p.c}${p.c2}`, p.w, p.h, g => {
          g.fillStyle = p.c; g.fillRect(0, 0, 32, 64); g.fillRect(64, 0, 32, 64);
          g.fillStyle = p.c2; g.fillRect(32, 0, 32, 64);
        }, 96, 64);
        const hinge = new TransformNode("flagHinge", stage.scene);
        hinge.position.set(p.x, p.y + p.h / 2, p.z);
        const cloth = plane("flag", painted.width, painted.height, painted.material, p.w / 2, 0, 0);
        cloth.parent = hinge; cloth.receiveShadows = false;
        moving.push(t => { hinge.rotation.y = Math.sin(t * 3 + p.x) * 0.3; });
        break;
      }
      case "beacon": {
        const a = sphere("beaconA", p.r * 2, mat(p.c, { emissive: p.c, specular: 0 }), p.x, p.y, p.z);
        const b = sphere("beaconB", p.r * 2, mat(p.c2, { emissive: p.c2, specular: 0 }), p.x, p.y, p.z);
        moving.push(t => { const on = beaconPhase(t, p.period); a.setEnabled(on); b.setEnabled(!on); });
        break;
      }
      case "puff": {
        const mtl = mat(p.c, { specular: 0 });
        const puffs = [0, 1, 2].map(() => sphere("puff", p.r * 2, mtl, p.x, p.y, p.z));
        moving.push(t => puffs.forEach((m, i) => {
          const k = puffAt(i, t), s = (0.5 + k * 1.6) * (1 - k * k * k);
          m.position.set(p.x + Math.sin(i * 2 + k * 3) * 0.2 * k, p.y + k * 1.8, p.z);
          m.scaling.setAll(Math.max(0.01, s));
        }));
        break;
      }
      case "lamp": {
        cyl("lampPost", 0.1, 0.14, p.h, mat(p.c), p.x, p.h / 2, p.z);
        sphere("lampGlobe", 0.3, mat(night ? "#fff0bd" : "#e9e4d2", night ? { emissive: "#ffe3a0", specular: 0 } : {}), p.x, p.h, p.z);
        if (night && lights.length < 2) {
          const light = new PointLight("buildingLamp", new Vector3(p.x, p.h - 0.2, p.z), stage.scene);
          light.diffuse = hex("#ffe0a3"); light.range = 8; light.intensity = 0.6 * palette.lamp;
          lights.push(light);
        }
        break;
      }
    }
  }
  for (const [mtl, meshes] of groups) {
    const merged = meshes.length > 1 ? merge("buildingPart", meshes) : meshes[0]!;
    merged.material = mtl; merged.receiveShadows = false;
  }

  const people = layout.people.map((p, i) => makePerson3d(stage, p, i, options.models ? crowdModelId(options.recipe.id, i) : undefined));
  moving.forEach(m => m(0));
  return {
    ready: Promise.all([...people.map(p => p.ready), ...[...replacements].map(([group, meshes]) => replaceScenery(stage, group, meshes, group === main ? 3.1 : -Infinity))]),
    update(t) {
      moving.forEach(m => m(t));
      people.forEach(p => p.apply(t));
    }
  };
}
