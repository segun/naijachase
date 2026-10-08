// The market's scenery for the 3D witness scene: a distant town and palms, rows of stalls with wares, a banner carrying the venue's name,
// string lights after dark and a crowd. Everything stands behind the lane and away from the camera's sight line to the witness
// (market-layout.ts keeps the witness's own stall open at the front). A set is a function that builds scenery and returns what has to
// move each frame; see chase3d-sets.ts.
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { hex, merge, seeded } from "../shared/chase3d-kit.ts";
import { ankara } from "../chase/chase3d-actors.ts";
import { hashOf } from "./venue-recipes.ts";
import { PALMS, SHOPPERS, STALLS, type Ware, crowdSize, walkerAt } from "./market-layout.ts";
import { WITNESS } from "./witness-scene.ts";
import { type Walker, person, printed } from "./chase3d-people.ts";
import type { Set3D } from "./chase3d-sets.ts";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";

export const buildMarket3d: Set3D = ({ stage, options }) => {
  const { scene, palette, mat, box, cyl, sphere, plane, textured, caster } = stage;
  const light = stage.light;
  const r = seeded(hashOf(options.venueName) || 1);
  // ---- Distant town and palms, hazed by the fog ----
  const skyline: Mesh[] = [];
  for (let i = 0; i < 26; i++) {
    const w = 3 + r() * 5, h = 3 + r() * 8, x = -48 + i * 3.8 + r() * 2;
    skyline.push(box("block", w, h, 3, mat(["#8c8579", "#a8a091", "#7a8a8f", "#b3a58a"][Math.floor(r() * 4)]!), x, h / 2, 38 + r() * 6));
  }
  merge("skyline", skyline);
  const trunk = mat("#6b4a2b"), frond = mat("#2f6b3a");
  for (const [x, z, h] of PALMS) {
    cyl("palmTrunk", 0.25, 0.4, h, trunk, x, h / 2, z).rotation.z = (x % 3) * 0.03;
    for (let i = 0; i < 6; i++) {
      const leaf = box("frond", 3.2, 0.05, 0.6, frond, x + Math.cos(i * 1.05) * 1.4, h + 0.1, z + Math.sin(i * 1.05) * 1.4);
      leaf.rotation.y = -i * 1.05; leaf.rotation.z = -0.35;
    }
  }

  // ---- Market stalls ----
  const prints = [ankara(scene, "printA", "#2e6f8f", "#f4ecd8", "#d9822b"), ankara(scene, "printB", "#b5483a", "#f2c14e", "#1f3a2a"), ankara(scene, "printC", "#2f8f5b", "#f4ecd8", "#7a4aa0"), ankara(scene, "printD", "#d9822b", "#2a1a12", "#f4ecd8")];
  const wood = mat("#7a5430", { specular: 0.1 }), pole = mat("#5a3d22", { specular: 0.1 });
  const sphereAt = (parts: Mesh[], d: number, m: StandardMaterial, x: number, y: number, z: number) => { parts.push(sphere("ware", d, m, x, y, z)); };
  const mound = (parts: Mesh[], m: StandardMaterial, x: number, y: number, z: number, d = 0.13) => {
    for (let i = 0; i < 7; i++) sphereAt(parts, d, m, x + (i === 0 ? 0 : Math.cos(i * 1.047) * d * 0.95), y, z + (i === 0 ? 0 : Math.sin(i * 1.047) * d * 0.95));
    for (let i = 0; i < 3; i++) sphereAt(parts, d, m, x + Math.cos(i * 2.094) * d * 0.5, y + d * 0.8, z + Math.sin(i * 2.094) * d * 0.5);
    sphereAt(parts, d, m, x, y + d * 1.5, z);
  };
  const stall = (x: number, z: number, w: number, stripes: readonly [string, string], ware: Ware, backdropColour?: string, frontPoles = true) => {
    const depth = 1;
    const parts: Mesh[] = [];
    parts.push(box("table", w, 0.78, depth, wood, x, 0.39, z));
    parts.push(box("tableTop", w + 0.06, 0.05, depth + 0.06, mat("#d9cdb0"), x, 0.8, z));
    for (const sx of [-1, 1]) for (const sz of frontPoles ? [-1, 1] : [1]) parts.push(cyl("pole", 0.07, 0.07, 2.6, pole, x + sx * (w / 2 + 0.05), 1.3, z + sz * 0.8));
    merge(`stall${x}`, parts);
    const awning = textured(`awning${x}`, w + 0.4, 2, g => {
      for (let i = 0; i < 12; i++) { g.fillStyle = stripes[i % 2]!; g.fillRect(i * 22, 0, 22, 256); }
    }, 256, 256);
    const roof = box("awning", w + 0.4, 0.05, 2, awning.material, x, 2.62, z + 0.2);
    roof.rotation.x = 0.1; caster(roof);
    if (backdropColour) box("tarp", w, 2, 0.04, mat(backdropColour, { specular: 0 }), x, 1.1, z + 0.85);
    const goods: Mesh[] = [];
    const top = 0.9;
    if (ware === "tomatoes") {
      for (let i = 0; i < 3; i++) mound(goods, mat(i === 1 ? "#d9822b" : "#c0392b"), x - w / 3 + (i * w) / 3, top + 0.02, z - 0.1, 0.14);
      for (let i = 0; i < 2; i++) { const bowl = cyl("basin", 0.46, 0.36, 0.14, mat(i ? "#2e6f8f" : "#e8e2cf"), x - w / 6 + i * (w / 3), top - 0.03, z + 0.28); goods.push(bowl); mound(goods, mat(i ? "#2f8f5b" : "#c0392b"), x - w / 6 + i * (w / 3), top + 0.1, z + 0.28, 0.09); }
    } else if (ware === "yams") {
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
        const yam = cyl("yam", 0.13, 0.11, 0.55, mat("#8a5a2f"), x - w / 2 + 0.4 + i * 0.24 + row * 0.12, top + 0.09 + row * 0.12, z - 0.1);
        yam.rotation.z = Math.PI / 2; yam.rotation.y = 0.2; goods.push(yam);
      }
      for (let i = 0; i < 3; i++) mound(goods, mat("#e0b23a"), x + 0.2 + i * 0.4, top + 0.02, z + 0.2, 0.1);
    } else if (ware === "fruit") {
      for (let i = 0; i < 4; i++) mound(goods, mat(["#e8a02b", "#8fbf3a", "#e8a02b", "#c0392b"][i]!), x - w / 2 + 0.4 + (i * (w - 0.8)) / 3, top + 0.02, z, 0.13);
    } else {
      // Bolts of printed cloth standing on the table and a length hung behind.
      for (let i = 0; i < 6; i++) goods.push(cyl("bolt", 0.2, 0.2, 0.5, mat(["#2e6f8f", "#b5483a", "#2f8f5b", "#d9822b", "#7a4aa0", "#f2c14e"][i]!), x - w / 2 + 0.3 + i * ((w - 0.6) / 5), top + 0.22, z - 0.1));
      for (let i = 0; i < 2; i++) {
        const hang = plane("hanging", 0.9, 1.4, printed(scene, `hang${x}${i}`, prints[(i + 1 + (x > 0 ? 1 : 0)) & 3]!), x - w / 4 + i * (w / 2), 1.7, z + 0.7);
        hang.rotation.y = Math.PI;
      }
    }
    if (goods.length > 1) merge(`goods${x}`, goods);
    // String lights after dark.
    if (palette.lamp > 0.3) for (let i = 0; i <= 5; i++) box("bulb", 0.07, 0.07, 0.07, mat("#fff1c4", { emissive: "#fff1c4", specular: 0 }), x - w / 2 + (i * w) / 5, 2.52, z - 0.78);
  };

  // The witness's own stall is the middle of the picture; the others are scenery.
  for (const spec of STALLS) stall(spec.x, spec.z, spec.w, spec.stripes, spec.ware, spec.tarp, spec.frontPoles);

  // Sacks, crates and a handcart by the lane.
  const sack = mat("#c9b48a", { specular: 0.02 });
  for (const [x, z] of [[5.8, -1.1], [6.3, -0.9], [6.0, -1.0]] as const) { const s = sphere("sack", 0.7, sack, x, 0.3, z); s.scaling.set(1, 0.7, 0.8); }
  for (const [x, z, y] of [[-6.3, -1.1, 0.2], [-5.8, -1.0, 0.2], [-6.05, -1.05, 0.62]] as const) box("crate", 0.55, 0.4, 0.45, wood, x, y, z);
  box("cartBed", 1.3, 0.1, 0.7, wood, -7.4, 0.6, -1.0);
  for (const s of [-1, 1]) { cyl("cartWheel", 0.6, 0.6, 0.06, mat("#2a2f33"), -7.4, 0.3, -1.0 + s * 0.4).rotation.x = Math.PI / 2; box("cartShaft", 1.0, 0.04, 0.04, wood, -8.2, 0.7, -1.0 + s * 0.25); }

  // The banner over the lane carries the venue's name.
  const banner = textured("banner", 7.6, 1.1, g => {
    g.fillStyle = "#176b4d"; g.fillRect(0, 0, 1024, 148);
    g.strokeStyle = "#f2c14e"; g.lineWidth = 8; g.strokeRect(10, 10, 1004, 128);
    const name = options.venueName.toUpperCase();
    let px = 84;
    g.font = `bold ${px}px 'Arial Black', Impact, Arial, sans-serif`;
    while (px > 28 && g.measureText(name).width > 900) { px -= 4; g.font = `bold ${px}px 'Arial Black', Impact, Arial, sans-serif`; }
    g.fillStyle = "#f6f1e1"; g.fillText(name, 512 - g.measureText(name).width / 2, 74 + px * 0.34);
  }, 1024, 148);
  plane("banner", banner.width, banner.height, banner.material, -0.2, 3.55, -0.6).receiveShadows = false;
  for (const x of [-4.1, 3.7]) cyl("bannerPole", 0.12, 0.14, 4.1, pole, x, 2.05, -0.6);

  // ---- Light after dark ----
  if (palette.lamp > 0.3) {
    for (const [x, z] of [[WITNESS.x, 1.2], [-2, 0.5], [4, 0.5]] as const) {
      const lamp = new PointLight("lamp", new Vector3(x, 2.4, z), scene);
      lamp.diffuse = hex("#ffd9a0"); lamp.range = 7; lamp.intensity = 0.55 * palette.lamp;
    }
  }

  // ---- People ----
  const crowd: Walker[] = [];
  const count = crowdSize(light);
  for (let i = 0; i < count; i++) {
    const p = person(stage, 100 + i, prints);
    const dir = i % 2 === 0 ? 1 : -1;
    p.root.rotation.y = Math.atan2(-dir, 0);
    crowd.push({ ...p, dir });
  }
  const shoppers = SHOPPERS.map((_, i) => person(stage, 300 + i, prints));
  SHOPPERS.forEach(([x, z, turn], i) => { shoppers[i]!.root.position.set(x, 0, z); shoppers[i]!.root.rotation.y = Math.PI + turn; });

  return {
    update(t) {
      crowd.forEach((c, i) => {
        const w = walkerAt(i, count, t);
        c.root.position.set(w.x, w.bounce, w.z);
        c.legs.forEach((l, j) => { l.rotation.x = j ? w.swing : -w.swing; });
        c.arms.forEach((a, j) => { a.rotation.x = j ? -w.swing : w.swing; });
      });
      shoppers.forEach((s, i) => { s.root.rotation.z = Math.sin(t * 0.9 + i) * 0.015; });
    }
  };
};
