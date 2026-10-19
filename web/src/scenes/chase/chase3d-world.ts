// The looping street for the 3D chase: Lagos waterfront, Onitsha-style market in Anambra, and Kano's groundnut
// pyramids, each with its own passers-by. Scenery sits on a ring that scrolls past the runners.
import type { Scene } from "@babylonjs/core/scene";
import "@babylonjs/core/Meshes/instancedMesh";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { TransformNode as Holder } from "@babylonjs/core/Meshes/transformNode";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { treadmillX, idlePose, walkPose, cycleAt, type Pose } from "./chase-motion.ts";
import { BIOMES, RING, SEGMENT, SPEED, smoothstep, type Palette } from "./chase-biomes.ts";
import { hex, material, merge, paint, seeded } from "../shared/chase3d-kit.ts";
import { ankara, makeFigure, type FigureSpec } from "./chase3d-actors.ts";
import { buildSign, type SignKind } from "./chase3d-signs.ts";
import { afterBrowserIdle, loadModel } from "../shared/chase3d-models.ts";
import { replaceActor } from "./chase3d-model-actor.ts";

type Node = TransformNode | Mesh | ReturnType<Mesh["createInstance"]>;

// Far layers (f < 0.6) belong to one city; they sink into the ground as that city fades out so nothing from the previous one lingers.
type Item = { node: Node; base: number; f: number; y: number; z: number; rotY: number; biome: number; sink: number; off?: boolean };
type Walker = { item: Item; figure: ReturnType<typeof makeFigure>; modelId: string; mode: "walk" | "idle"; phase: number; cycle: number };

export type World = {
  ready: Promise<void>;
  /** `t` is the eased world time (drives the scenery); `gait` is the clock for walking animation. */
  update(t: number, palette: Palette, weights: readonly number[], gait: number): void;
  sea: DynamicTexture;
};

const LAGOS = 0, ANAMBRA = 1, KANO = 2;
const WINDOW_RANGE = 95;
/** The danfo driver's seat as fractions of the model: along its length from the centre (+ is the front), hip height, and across (0 is the camera side). */
const DRIVER_SEAT = { x: 0.22, y: 0.34, z: 0.3 } as const;

export function buildWorld(scene: Scene, shadows: ShadowGenerator | null, models = false): World {
  const items: Item[] = [];
  const walkers: Walker[] = [];
  const shops: { parts: Item[]; id: string; height: number }[] = [];
  const rand = seeded(2024);
  const between = (a: number, b: number) => a + (b - a) * rand();
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const center = (biome: number) => BIOMES[biome]!.center;

  // Roadside scenery within this many metres of a city centre is left clear so that city's signboard can be seen.
  const SIGN_CLEAR = 15;
  const place = (node: Node, biome: number, offset: number, z: number, o: { f?: number; y?: number; rotY?: number; scale?: [number, number, number]; keep?: boolean } = {}) => {
    const f = o.f ?? 1;
    if (f === 1 && z > 3 && z < 40 && Math.abs(offset) < SIGN_CLEAR && o.keep !== true) { node.setEnabled(false); return { node, base: 0, f, y: 0, z, rotY: 0, biome, sink: 0, off: true } as Item; }
    const item: Item = { node, base: center(biome) + offset, f, y: o.y ?? 0, z, rotY: o.rotY ?? 0, biome, sink: f < 0.6 ? 34 : 0 };
    if (o.scale) node.scaling.set(...o.scale);
    items.push(item);
    return item;
  };
  const hide = <T extends Mesh>(m: T) => { m.isVisible = false; return m; };
  const proto = (m: Mesh) => hide(m);
  let n = 0;
  const instance = (source: Mesh) => source.createInstance(`i${n++}`);
  const baseBox = (name: string, mat: StandardMaterial) => {
    const b = CreateBox(name, { size: 1 }, scene);
    b.bakeTransformIntoVertices(Matrix.Translation(0, 0.5, 0));
    b.material = mat;
    return proto(b);
  };
  const box = (name: string, w: number, h: number, d: number, mat: StandardMaterial, x = 0, y = 0, z = 0) => {
    const b = CreateBox(name, { width: w, height: h, depth: d }, scene);
    b.position.set(x, y, z); b.material = mat;
    return b;
  };
  const cyl = (name: string, h: number, top: number, bottom: number, mat: StandardMaterial, x = 0, y = 0, z = 0, tess = 10) => {
    const c = CreateCylinder(name, { height: h, diameterTop: top, diameterBottom: bottom, tessellation: tess }, scene);
    c.position.set(x, y, z); c.material = mat;
    return c;
  };
  const ball = (name: string, d: number, mat: StandardMaterial, x = 0, y = 0, z = 0, seg = 8) => {
    const s = CreateSphere(name, { diameter: d, segments: seg }, scene);
    s.position.set(x, y, z); s.material = mat;
    return s;
  };

  // ---- Textures and shared, palette-driven materials -----------------------------------------
  const grain = paint(scene, "grain", 128, 128, g => {
    g.fillStyle = "#7d7d7d"; g.fillRect(0, 0, 128, 128);
    const r = seeded(3);
    for (let i = 0; i < 700; i++) { const v = 90 + Math.floor(r() * 90); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * 128, r() * 128, 2, 2); }
  });
  const tiles = paint(scene, "tiles", 128, 64, g => {
    g.fillStyle = "#bdbdbd"; g.fillRect(0, 0, 128, 64);
    g.fillStyle = "#8a8a8a";
    for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 2, 64);
    g.fillRect(0, 30, 128, 2);
  });
  grain.uScale = 30; tiles.uScale = 60;
  const roadMat = material(scene, "road", "#ffffff", { texture: grain, specular: 0.05 });
  const kerbMat = material(scene, "kerb", "#ffffff", { texture: tiles, specular: 0.05 });
  const groundMat = material(scene, "ground", "#ffffff", { specular: 0 });

  const road = CreateBox("road", { width: 260, height: 0.1, depth: 7 }, scene);
  road.position.y = -0.05; road.material = roadMat; road.receiveShadows = true;
  for (const side of [-1, 1]) {
    const k = CreateBox(`kerb${side}`, { width: 260, height: 0.18, depth: 2.4 }, scene);
    k.position.set(0, 0.04, side * 4.7); k.material = kerbMat; k.receiveShadows = true;
  }
  const farGround = CreateGround("groundFar", { width: 520, height: 240 }, scene);
  farGround.position.set(0, -0.04, 126); farGround.material = groundMat; farGround.receiveShadows = true;
  const nearGround = CreateGround("groundNear", { width: 520, height: 80 }, scene);
  nearGround.position.set(0, -0.04, -46); nearGround.material = groundMat;

  const glowMats: StandardMaterial[] = [];
  const glowing = (m: StandardMaterial, base: string) => { (m as StandardMaterial & { glowBase?: Color3 }).glowBase = hex(base); glowMats.push(m); return m; };

  // Shared building facades.
  const facade = (seed: number, wall: string, lit: string, dark: string, cols = 5, rows = 12, chance = 0.32) => paint(scene, `facade${seed}`, 128, 256, g => {
    g.fillStyle = wall; g.fillRect(0, 0, 128, 256);
    const r = seeded(seed);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      g.fillStyle = r() < chance ? lit : dark;
      g.fillRect(8 + col * (112 / cols), 10 + row * (236 / rows), 112 / cols - 8, 236 / rows - 8);
    }
  });
  const towerMats = [1, 2, 3].map(i => glowing(material(scene, `tower${i}`, "#ffffff", { texture: facade(i, "#0c2430", "#bfe4ff", "#06141b", 6, 16, 0.3), specular: 0.3 }), "#d9d9d9"));
  const shopFacade = [1, 2, 3, 4].map(i => glowing(material(scene, `shop${i}`, "#ffffff", { texture: facade(10 + i, pick(["#7a5230", "#5b3d6e", "#2f6a5b", "#8a3b2e"]), "#ffd98a", "#2a1b12", 4, 5, 0.6) }), "#cfcfcf"));

  // ===========================================================================================
  // LAGOS: Atlantic seafront, palms, towers, a long bridge, danfo buses and commuters
  // ===========================================================================================
  const sea = paint(scene, "sea", 256, 256, g => {
    g.fillStyle = "#0d7587"; g.fillRect(0, 0, 256, 256);
    const r = seeded(8);
    g.strokeStyle = "#3fd0d8"; g.lineWidth = 2;
    for (let i = 0; i < 34; i++) { const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 5, x + 30, y); g.stroke(); }
    g.fillStyle = "#cfeaf0";
    for (let i = 0; i < 90; i++) g.fillRect(r() * 256, r() * 256, 2, 1);
  });
  sea.uScale = 3; sea.vScale = 6;
  const seaMat = material(scene, "seaMat", "#ffffff", { texture: sea, specular: 0.9 });
  seaMat.specularPower = 48;
  seaMat.emissiveColor = new Color3(0.1, 0.17, 0.2);
  seaMat.emissiveTexture = sea;
  const seaTile = proto(CreatePlane("seaTile", { width: 14.4, height: 1, sideOrientation: 2 }, scene));
  seaTile.rotation.x = Math.PI / 2; seaTile.bakeCurrentTransformIntoVertices(); seaTile.material = seaMat;
  for (let off = -72; off <= 72; off += 14) {
    const depth = 4 + 74 * (1 - smoothstep(0.35, 1, Math.abs(off) / 72));
    const tile = instance(seaTile);
    place(tile, LAGOS, off, 7.6 + depth / 2, { y: 0.1, scale: [1, 1, depth] });
  }

  const concrete = material(scene, "seawall", "#9aa3a0", { specular: 0.05 });
  const wall = baseBox("wallProto", concrete);
  for (let off = -64; off <= 64; off += 8) place(instance(wall), LAGOS, off, 7.4, { scale: [8, 0.3, 0.7] });

  const trunkMat = material(scene, "trunk", "#6b4a2a");
  const frondMat = material(scene, "frond", "#2f7d3f", { specular: 0.1 });
  const palmParts: Mesh[] = [cyl("palm-trunk", 5.4, 0.22, 0.4, trunkMat, 0, 2.7, 0, 8)];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const frond = box("palm-frond", 2.6, 0.06, 0.5, frondMat, Math.cos(a) * 1.15, 5.35, Math.sin(a) * 1.15);
    frond.rotation.y = -a; frond.rotation.z = -0.45;
    palmParts.push(frond);
  }
  const palm = proto(merge("palm", palmParts));
  for (let off = -66; off <= 66; off += 12) place(instance(palm), LAGOS, off + between(-2, 2), 6.3, { rotY: between(0, 6), scale: [1, 1, 1].map(() => between(0.85, 1.2)) as [number, number, number] });

  const towerProtos = towerMats.map((m, i) => baseBox(`towerProto${i}`, m));
  for (let off = -75; off <= 75; off += 10) {
    const w = between(7, 12), h = between(28, 85);
    place(instance(pick(towerProtos)), LAGOS, off + between(-3, 3), between(78, 100), { f: 0.38, scale: [w, h, w] });
  }

  // Fishing boats and a lighthouse so the water reads as the Atlantic, not just a dark strip.
  const hull = material(scene, "hull", "#2c6fb0", { specular: 0.3 }), sail = material(scene, "sail", "#f4f1e6");
  const boat = proto(merge("boat", [box("hull", 5, 0.8, 1.7, hull, 0, 0.1, 0), box("bow", 1.4, 0.7, 1.2, hull, 3.0, 0.3, 0), box("cabin", 1.2, 0.9, 1.1, sail, -1, 1.0, 0), cyl("mast", 4.5, 0.08, 0.1, wood0(), 0.8, 2.6, 0, 6)]));
  function wood0() { return material(scene, "mastWood", "#6b4a2a"); }
  [[-44, 17], [-8, 26], [30, 21], [58, 34]].forEach(([off, z], i) => place(instance(boat), LAGOS, off!, z!, { y: -0.05, rotY: i % 2 ? 0.2 : -0.15 }));
  const lighthouse = proto(merge("lighthouse", [cyl("lhBody", 16, 2.2, 3.6, material(scene, "lhWhite", "#f4f1e6"), 0, 8, 0, 12), cyl("lhBand", 3, 3, 3, material(scene, "lhRed", "#c8281f"), 0, 9, 0, 12), ball("lhLamp", 2.2, glowing(material(scene, "lhLampMat", "#fff3c4", { emissive: "#fff3c4" }), "#fff3c4"), 0, 16.8, 0, 8)]));
  place(instance(lighthouse), LAGOS, 20, 48, { f: 0.5 });
  const deckMat = material(scene, "deck", "#37454a", { specular: 0.1 });
  const deck = baseBox("bridgeDeck", deckMat), pier = baseBox("bridgePier", concrete);
  for (let off = -72; off <= 72; off += 12) {
    place(instance(deck), LAGOS, off, 62, { f: 0.7, y: 3.2, scale: [12.1, 0.9, 7] });
    if ((off / 12) % 2 === 0) place(instance(pier), LAGOS, off, 62, { f: 0.7, scale: [1.6, 3.2, 3] });
  }
  const bridgeLamp = proto(ball("bridgeLamp", 0.5, glowing(material(scene, "bridgeLampMat", "#ffd98a", { emissive: "#ffd98a" }), "#ffd98a"), 0, 0, 0, 4));
  for (let off = -72; off <= 72; off += 6) place(instance(bridgeLamp), LAGOS, off, 58.6, { f: 0.7, y: 4.6 });

  // Danfo: the yellow-and-black Lagos minibus.
  const danfoParts = (() => {
    const yellow = material(scene, "danfoYellow", "#f2b705", { specular: 0.4 });
    const black = material(scene, "danfoBlack", "#0d0d0d", { specular: 0.3 });
    const glass = glowing(material(scene, "danfoGlass", "#1b2a30", { emissive: "#3d3322", specular: 0.7 }), "#4a3d28");
    const lamp = material(scene, "danfoLamp", "#fff3c4", { emissive: "#fff3c4" });
    const tail = material(scene, "danfoTail", "#ff3b30", { emissive: "#7a1812" });
    const parts: Mesh[] = [
      box("body", 5.6, 1.5, 2.0, yellow, 0, 1.15, 0), box("stripe1", 5.62, 0.28, 2.02, black, 0, 0.8, 0), box("stripe2", 5.62, 0.1, 2.02, black, 0, 1.55, 0),
      box("cab", 1.2, 1.0, 1.9, yellow, 2.5, 0.9, 0), box("roof", 4.2, 0.12, 1.9, yellow, -0.4, 2.0, 0),
      box("windowsL", 3.7, 0.55, 2.03, glass, -0.5, 1.5, 0), box("windshield", 0.05, 0.6, 1.7, glass, 3.08, 1.3, 0),
      box("bumperF", 0.2, 0.25, 2.1, black, 3.15, 0.4, 0), box("bumperB", 0.2, 0.25, 2.1, black, -2.85, 0.4, 0),
      box("rack", 2.2, 0.4, 1.4, black, -0.8, 2.3, 0), box("luggage1", 0.9, 0.5, 0.8, material(scene, "lug1", "#8b5a2b"), -0.4, 2.6, 0.1), box("luggage2", 0.8, 0.4, 0.7, material(scene, "lug2", "#3d6b9c"), -1.4, 2.55, -0.1),
      ball("headL", 0.28, lamp, 3.12, 0.75, 0.7, 6), ball("headR", 0.28, lamp, 3.12, 0.75, -0.7, 6),
      ball("tailL", 0.22, tail, -2.85, 0.8, 0.7, 6), ball("tailR", 0.22, tail, -2.85, 0.8, -0.7, 6)
    ];
    for (const x of [-1.8, 1.9]) for (const z of [-1.0, 1.0]) {
      const w = cyl("wheel", 0.28, 0.82, 0.82, black, x, 0.41, z, 14);
      w.rotation.x = Math.PI / 2; parts.push(w);
    }
    for (let i = 0; i < 4; i++) parts.push(ball("rider", 0.34, material(scene, "riderSkin", "#4a2f1a"), -1.9 + i * 1.0, 1.75, 1.0, 6));
    return merge("danfo", parts);
  })();
  proto(danfoParts);
  for (const off of [-38, 28]) place(instance(danfoParts), LAGOS, off, 2.4, { f: 0.45 });

  // ===========================================================================================
  // ANAMBRA: Onitsha-style market and the Niger Bridge
  // ===========================================================================================
  const stripe = (a: string, b: string) => paint(scene, `canopy${a}`, 64, 64, g => { for (let x = 0; x < 64; x += 16) { g.fillStyle = (x / 16) % 2 ? b : a; g.fillRect(x, 0, 16, 64); } });
  const wood = material(scene, "stallWood", "#7a5230");
  const stallProtos = ([["#c8281f", "#f4f1e6"], ["#1f5fb5", "#f4f1e6"], ["#e8b21a", "#2f7d3f"]] as const).map(([a, b], v) => {
    const canopy = material(scene, `stallCanopy${v}`, "#ffffff", { texture: stripe(a, b), specular: 0.1 });
    const parts: Mesh[] = [box("table", 2.2, 0.15, 1.1, wood, 0, 0.9, 0), box("front", 2.2, 0.8, 0.06, wood, 0, 0.45, -0.55)];
    for (const x of [-1.05, 1.05]) for (const z of [-0.5, 0.5]) parts.push(cyl("post", 2.5, 0.07, 0.07, wood, x, 1.25, z, 6));
    const roof = box("canopy", 2.9, 0.07, 2.0, canopy, 0, 2.55, 0); roof.rotation.x = 0.16; parts.push(roof);
    const palette = ["#e8742c", "#d8d03a", "#3a9a3f", "#b3191f", "#f4f1e6"];
    for (let i = 0; i < 6; i++) parts.push(ball("goods", 0.3, material(scene, `goods${v}${i}`, palette[(i + v) % palette.length]!), -0.9 + i * 0.36, 1.12, 0.1, 6));
    for (let i = 0; i < 3; i++) parts.push(box("sackpile", 0.5, 0.5, 0.4, material(scene, `sack${v}${i}`, "#cdb98a"), -1.5 + i * 0.1, 0.25 + i * 0.5, 0.7 - i * 0.05));
    return proto(merge(`stall${v}`, parts));
  });
  for (let off = -66, k = 0; off <= 66; off += 10, k++) {
    place(instance(stallProtos[k % 3]!), ANAMBRA, off + between(-1, 1), 5.6, { rotY: 0 });
  }

  const concreteColors = ["#d9b36a", "#c76f8a", "#7fb6a0", "#e9d9b8", "#6aa0c8"];
  const shopMats = concreteColors.map((c, i) => material(scene, `shopWall${i}`, c));
  const roofMat = material(scene, "tinRoof", "#4a4f55", { specular: 0.35 });
  const shopProtos = shopMats.map((m, i) => baseBox(`shopProto${i}`, m)), tin = baseBox("tinProto", roofMat);
  const shopFrontProtos = shopFacade.map((m, i) => baseBox(`shopFront${i}`, m));
  for (let off = -68; off <= 68; off += 9) {
    const h = between(4.2, 7), w = between(7.5, 9);
    const parts = [
      place(instance(pick(shopProtos)), ANAMBRA, off, 10.5, { scale: [w, h, 5] }),
      place(instance(tin), ANAMBRA, off, 10.1, { y: h, scale: [w + 0.4, 0.25, 6] }),
      place(instance(pick(shopFrontProtos)), ANAMBRA, off, 7.85, { scale: [w - 1.2, Math.min(h - 1.4, 3.2), 0.1], y: 0.9 })
    ];
    shops.push({ parts, id: shops.length % 2 ? "anambra_shopfront_b" : "anambra_shopfront_a", height: h });
  }
  for (let off = -66; off <= 66; off += 13) {
    place(instance(pick(shopFrontProtos)), ANAMBRA, off + between(-2, 2), between(17, 22), { scale: [between(9, 12), between(11, 18), 7] });
  }

  const crateMat = material(scene, "crate", "#9b7040"), basketMat = material(scene, "wicker", "#b9833d");
  const crate = baseBox("crateProto", crateMat);
  const basketProto = proto(merge("basketPile", [cyl("b1", 0.55, 0.7, 0.55, basketMat, 0, 0.28, 0, 12), cyl("b2", 0.5, 0.65, 0.5, basketMat, 0.7, 0.25, 0.1, 12), ball("yam", 0.4, material(scene, "yamMat", "#c2874c"), 0.0, 0.7, 0, 6)]));
  for (let off = -66; off <= 66; off += 14) place(instance(basketProto), ANAMBRA, off + 4, 4.3, { rotY: between(0, 3) });

  // The Niger Bridge, far away across the river: a deck with three steel arches.
  const steel = material(scene, "steel", "#8a96a0", { specular: 0.3 });
  const bridgeDeck = baseBox("nigerDeck", steel);
  for (let off = -72; off <= 72; off += 12) place(instance(bridgeDeck), ANAMBRA, off, 120, { f: 0.25, y: 5, scale: [12.1, 0.8, 5] });
  const arcSeg = baseBox("arcSeg", steel);
  for (const arcCenter of [-48, 0, 48]) for (let i = 0; i <= 16; i++) {
    const u = i / 16 * 2 - 1;
    const item = place(instance(arcSeg), ANAMBRA, arcCenter + u * 22, 120, { f: 0.25, y: 5 + (1 - u * u) * 16, scale: [3, 0.7, 5] });
    item.rotY = 0;
    if (i % 2 === 0) place(instance(arcSeg), ANAMBRA, arcCenter + u * 22, 120, { f: 0.25, y: 5.4, scale: [0.3, (1 - u * u) * 16, 4.6] });
  }

  // ===========================================================================================
  // KANO: groundnut pyramids, mud-brick architecture, Dala Hill, baobabs and farmland
  // ===========================================================================================
  const sacks = paint(scene, "sacks", 128, 64, g => {
    g.fillStyle = "#d4be86"; g.fillRect(0, 0, 128, 64);
    const r = seeded(21);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const x = col * 32 + (row % 2) * 16, y = row * 16;
      g.fillStyle = `rgb(${190 + Math.floor(r() * 30)},${165 + Math.floor(r() * 30)},${110 + Math.floor(r() * 25)})`; g.fillRect(x + 1, y + 1, 30, 14);
      g.fillStyle = "#8a7448"; g.fillRect(x, y + 14, 32, 2); g.fillRect(x + 30, y, 2, 16);
    }
  });
  sacks.uScale = 4;
  const sackMat = material(scene, "groundnutSacks", "#ffffff", { texture: sacks, specular: 0.04 });
  const pyramid = (() => {
    const parts: Mesh[] = [];
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const bottom = 8.4 - i * 1.55, top = bottom - 1.3;
      const tier = cyl(`tier${i}`, 1.5, top, bottom, sackMat, 0, i * 1.5 + 0.75, 0, 4);
      tier.rotation.y = Math.PI / 4; parts.push(tier);
    }
    return proto(merge("groundnutPyramid", parts));
  })();
  // Pyramids line the roadside, with mud-brick houses and baobabs behind them.
  for (let off = -60, k = 0; off <= 64; off += 30, k++) {
    place(instance(pyramid), KANO, off + between(-3, 3), 11.5, { rotY: between(-0.15, 0.15), scale: [0.95, 0.95, 0.95] });
    place(instance(pyramid), KANO, off + 15 + between(-2, 2), 9.2, { rotY: between(-0.15, 0.15), scale: [0.55, 0.55, 0.55] });
  }

  const mudTex = paint(scene, "mud", 128, 128, g => {
    g.fillStyle = "#b98a5a"; g.fillRect(0, 0, 128, 128);
    const r = seeded(5);
    for (let i = 0; i < 500; i++) { g.fillStyle = r() > 0.5 ? "#a47649" : "#c99a68"; g.fillRect(r() * 128, r() * 128, 2 + r() * 5, 1 + r() * 2); }
    for (let i = 0; i < 12; i++) { g.fillStyle = "rgba(90,60,35,0.25)"; g.fillRect(r() * 128, 0, 2, 40 + r() * 80); }
  });
  const mudMat = material(scene, "mudBrick", "#ffffff", { texture: mudTex, specular: 0.02 });
  const doorMat = material(scene, "mudDoor", "#2a1a10");
  const houseProto = (name: string, w: number, h: number, d: number) => {
    const parts: Mesh[] = [box("walls", w, h, d, mudMat, 0, h / 2, 0), box("parapet", w + 0.2, 0.3, d + 0.2, mudMat, 0, h + 0.15, 0), box("door", 1.3, 2.2, 0.1, doorMat, 0, 1.1, -d / 2 - 0.02)];
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) parts.push(cyl("pinnacle", 0.9, 0.05, 0.5, mudMat, x, h + 0.7, z, 6));
    parts.push(box("window", 1.0, 0.8, 0.1, doorMat, w * 0.28, h * 0.62, -d / 2 - 0.02), box("window2", 1.0, 0.8, 0.1, doorMat, -w * 0.28, h * 0.62, -d / 2 - 0.02));
    return proto(merge(name, parts));
  };
  const houses = [houseProto("mudA", 6, 4.2, 5), houseProto("mudB", 8, 5.4, 5.5), houseProto("mudC", 5, 3.4, 4.5)];
  for (let off = -66; off <= 66; off += 13) place(instance(pick(houses)), KANO, off + between(-2, 2), between(19, 21), { rotY: 0 });

  const rock = material(scene, "dala", "#8a6f4e", { specular: 0.02 });
  for (const [off, w, h] of [[-30, 70, 26], [48, 52, 18]] as const) {
    const hill = ball("dalaHill", 1, rock, 0, 0, 0, 12);
    place(hill, KANO, off, 135, { f: 0.2, y: 0, scale: [w, h, 40] });
  }

  const baobab = proto((() => {
    const bark = material(scene, "baobabBark", "#7d6a55");
    const leaf = material(scene, "baobabLeaf", "#5a7a35");
    const parts: Mesh[] = [cyl("bTrunk", 5, 1.7, 2.4, bark, 0, 2.5, 0, 12)];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, arm = cyl("bArm", 3, 0.2, 0.5, bark, Math.cos(a) * 1.3, 5.6, Math.sin(a) * 1.3, 6);
      arm.rotation.z = Math.cos(a) * 0.9; arm.rotation.x = -Math.sin(a) * 0.9; parts.push(arm);
      parts.push(ball("bLeaf", 1.8, leaf, Math.cos(a) * 2.5, 7.1, Math.sin(a) * 2.5, 6));
    }
    return merge("baobab", parts);
  })());
  const acacia = proto((() => {
    const bark = material(scene, "acaciaBark", "#5b4a33");
    const leaf = material(scene, "acaciaLeaf", "#6b8a3a");
    const canopy = ball("aCanopy", 4.2, leaf, 0.3, 3.8, 0, 8);
    canopy.scaling.set(1, 0.32, 1);
    return merge("acacia", [cyl("aTrunk", 3.6, 0.15, 0.3, bark, 0, 1.8, 0, 6), canopy]);
  })());
  for (let off = -64; off <= 64; off += 32) place(instance(baobab), KANO, off + between(-6, 6), between(30, 38), { scale: [1, 1, 1].map(() => between(0.9, 1.4)) as [number, number, number] });
  for (let off = -64; off <= 64; off += 19) place(instance(acacia), KANO, off + between(-5, 5), 7.6 + between(0, 3), { scale: [1, 1, 1].map(() => between(0.8, 1.2)) as [number, number, number] });

  const farm = paint(scene, "farm", 128, 128, g => {
    g.fillStyle = "#7b5a38"; g.fillRect(0, 0, 128, 128);
    const r = seeded(31);
    for (let row = 0; row < 8; row++) {
      g.fillStyle = "#5a3d24"; g.fillRect(0, row * 16 + 11, 128, 4);
      for (let i = 0; i < 18; i++) { g.fillStyle = r() > 0.4 ? "#5f8f3a" : "#7aa845"; g.fillRect(i * 7 + r() * 3, row * 16 + 3, 4, 7); }
    }
  });
  const farmMat = material(scene, "farmMat", "#ffffff", { texture: farm, specular: 0 });
  const farmTile = proto(CreatePlane("farmTile", { width: 14.4, height: 11, sideOrientation: 2 }, scene));
  farmTile.rotation.x = Math.PI / 2; farmTile.bakeCurrentTransformIntoVertices(); farmTile.material = farmMat;
  for (let off = -72; off <= 72; off += 14) place(instance(farmTile), KANO, off, 12.4, { y: 0.015 });

  // ---- Street furniture shared by every city ------------------------------------------------
  const poleMat = material(scene, "pole", "#1a2a24");
  const bulbMat = glowing(material(scene, "bulb", "#f2c14e", { emissive: "#ffd36b" }), "#ffd36b");
  const lamp = proto(merge("lamp", [cyl("pole", 4.6, 0.1, 0.14, poleMat, 0, 2.3, 0, 8), box("arm", 0.1, 0.08, 1.0, poleMat, 0, 4.5, -0.5), ball("bulb", 0.3, bulbMat, 0, 4.4, -1.0, 6)]));
  for (let off = -SEGMENT * 1.5 + 17.5; off < SEGMENT * 1.5; off += 35) place(instance(lamp), LAGOS, off, 3.7);
  const dashMat = material(scene, "dash", "#f2c14e", { emissive: "#7a5f20" });
  const dash = proto(box("dash", 1.6, 0.02, 0.14, dashMat));
  for (let off = -SEGMENT * 1.5; off < SEGMENT * 1.5; off += 7.5) place(instance(dash), LAGOS, off, -1.8, { y: 0.01 });

  // ---- Signboards that name each city (centred on the city, so they pass during the slow part of the journey) ----
  const SIGN = { width: 7.2, height: 3.0, bottom: 1.4 };
  (["lagos", "anambra", "kano"] as SignKind[]).forEach((kind, biome) => {
    place(buildSign(scene, kind, SIGN), biome, 3, 7.4, { keep: true });
  });

  // ---- People ---------------------------------------------------------------------------------
  const skins = ["#4a2f1a", "#5a3820", "#6b4226", "#3b2415", "#7a4e2d"] as const;
  const addPerson = (biome: number, offset: number, z: number, o: { spec: FigureSpec; mode: "walk" | "idle"; dir?: 1 | -1; speed?: number; faceZ?: boolean }) => {
    const figure = makeFigure(scene, o.spec);
    figure.meshes.forEach(m => shadows?.addShadowCaster(m));
    const dir = o.dir ?? 1, speed = o.speed ?? 1.3;
    const f = o.mode === "walk" ? 1 - (dir * speed) / SPEED : 1;
    const item = place(figure.root, biome, offset, z, { f, rotY: o.faceZ ? Math.PI / 2 : dir === 1 ? 0 : Math.PI });
    const woman = o.spec.skirt !== undefined;
    const modelId = biome === LAGOS ? woman ? "crowd_commuter_woman" : "crowd_commuter_man"
      : biome === ANAMBRA ? woman ? "crowd_trader_woman" : "crowd_trader_man" : "crowd_farmer";
    walkers.push({ item, figure, modelId, mode: o.mode, phase: between(0, 6.28), cycle: between(0.95, 1.25) });
  };
  let id = 0;
  const base = (skin = pick(skins)) => ({ name: `p${id++}`, skin });

  // Lagos commuters.
  const shirts = ["#f4f1e6", "#6aa0c8", "#d98a3a", "#7ab87a"] as const;
  for (let k = 0; k < 7; k++) {
    const off = -62 + k * 20 + between(-4, 4), side = k % 3 === 0 ? 4.6 : 5.6;
    const woman = k % 2 === 1;
    addPerson(LAGOS, off, side, {
      mode: "walk", dir: k % 2 ? 1 : -1,
      spec: woman
        ? { ...base(), top: pick(["#d9a13a", "#c0392b", "#2f7d6e"]), bottom: "#201a2b", skirt: pick(["#2b2040", "#7a1f2b"]), carry: "handbag", head: "none" }
        : { ...base(), top: pick(shirts), bottom: pick(["#1a1f2b", "#3a342a"]), carry: k % 3 === 0 ? "briefcase" : "none", head: k % 4 === 0 ? "cap" : "none", headColor: "#222" }
    });
  }

  // Anambra market: vendors at their stalls and traders walking with goods.
  const wrapperPrints = [ankara(scene, "ank1", "#1f5fb5", "#f2c14e", "#ffffff"), ankara(scene, "ank2", "#c8281f", "#f4f1e6", "#1a1a1a"), ankara(scene, "ank3", "#2f7d3f", "#e8b21a", "#ffffff")];
  const geleColors = ["#e8b21a", "#c8281f", "#9b3fa8", "#1f9a8a"] as const;
  for (let k = 0, off = -66; off <= 66; off += 20, k++) {
    const woman = k % 2 === 0;
    addPerson(ANAMBRA, off + 1, 6.4, {
      mode: "idle", faceZ: true,
      spec: woman
        ? { ...base(), top: pick(["#f4f1e6", "#e8b21a", "#c8281f"]), bottom: "#222", skirt: pick(wrapperPrints), head: "gele", headColor: pick(geleColors) }
        : { ...base(), top: pick(["#f4f1e6", "#4a6fb0", "#7a1f2b"]), bottom: "#1a1a22", head: "redcap", headColor: "#b3191f" }
    });
  }
  for (let k = 0; k < 8; k++) {
    const off = -64 + k * 17 + between(-3, 3), woman = k % 3 !== 2, side = k % 2 === 0 ? 5.2 : 4.4;
    addPerson(ANAMBRA, off, side, {
      mode: "walk", dir: k % 2 ? -1 : 1,
      spec: woman
        ? { ...base(), top: pick(["#e8b21a", "#f4f1e6", "#1f9a8a"]), bottom: "#222", skirt: pick(wrapperPrints), head: "gele", headColor: pick(geleColors), carry: "basket" }
        : { ...base(), top: pick(["#4a6fb0", "#f4f1e6", "#7a1f2b"]), bottom: "#1a1a22", head: "redcap", headColor: "#b3191f", carry: "shoulderSack" }
    });
  }

  // Kano farmers.
  const gowns = ["#f4f1e6", "#7fb6d6", "#2c3f7a", "#d8c9a0"] as const;
  for (let k = 0; k < 9; k++) {
    const off = -64 + k * 15.5 + between(-3, 3), onFarm = k % 3 !== 0;
    addPerson(KANO, off, onFarm ? between(6.8, 11) : (k % 2 ? 5.2 : 4.5), {
      mode: "walk", dir: k % 2 ? 1 : -1, speed: 1.1,
      spec: { ...base(), top: pick(gowns), bottom: "#e9e2cf", gown: pick(gowns), head: k % 3 === 1 ? "kufi" : "fula", headColor: "#f4f1e6", carry: k % 4 === 0 ? "shoulderSack" : "hoe" }
    });
  }

  // ---- Per-frame update ----------------------------------------------------------------------
  const replacements: Record<string, string> = {
    palm: "lagos_palm", towerProto0: "lagos_tower_a", towerProto1: "lagos_tower_b", towerProto2: "lagos_tower_c",
    boat: "lagos_fishing_boat", lighthouse: "lagos_lighthouse", danfo: "bus_danfo",
    stall0: "anambra_market_stall", stall1: "anambra_market_stall", stall2: "anambra_market_stall",
    groundnutPyramid: "kano_pyramid", mudA: "kano_house_a", mudB: "kano_house_b", mudC: "kano_house_a",
    baobab: "kano_baobab", acacia: "tree_neem", lamp: "lamp_post"
  };
  // The danfo model has see-through windows, so it gets a driver at the wheel (the built-in danfo shows riders' heads instead).
  const SEATED: Pose = { bodyY: 0, lean: 0, headBob: 0, thighL: 1.45, thighR: 1.45, shinL: -1.45, shinR: -1.45, armL: 1.1, armR: 1.1, elbowL: 0.5, elbowR: 0.5 };
  let drivers = 0;
  const seatDriver = (holder: TransformNode) => {
    const { min, max } = holder.getHierarchyBoundingVectors(true);
    const local = (v: Vector3) => v.subtract(holder.position);
    const lo = local(min), hi = local(max), length = hi.x - lo.x, height = hi.y - lo.y, scale = length / 4.4;
    const driver = makeFigure(scene, { name: `danfoDriver${drivers++}`, skin: "#5c3826", top: "#2c3e50", bottom: "#1a1a22", head: "redcap", headColor: "#1b130e", scale });
    driver.apply(SEATED);
    driver.root.parent = holder;
    driver.root.position.set(lo.x + length * (0.5 + DRIVER_SEAT.x), lo.y + height * DRIVER_SEAT.y - 0.95 * scale, lo.z + (hi.z - lo.z) * DRIVER_SEAT.z);
    driver.meshes.forEach(m => shadows?.addShadowCaster(m));
  };
  const setup = async () => {
    await Promise.all([
      ...shops.filter(shop => !shop.parts[0]!.off).map(async shop => {
        const model = await loadModel(scene, shop.id, { priority: "nearby" });
        if (!model) return;
        const { min, max } = model.root.getHierarchyBoundingVectors(true);
        const k = shop.height / (max.y - min.y);
        if (!Number.isFinite(k) || k <= 0) {
          console.warn(`Chase shop "${shop.id}" has invalid bounds; keeping the built-in shape.`);
          model.dispose(); return;
        }
        model.root.scaling.setAll(k);
        shop.parts.forEach(part => { part.node.setEnabled(false); });
        shop.parts.slice(1).forEach(part => { part.off = true; });
        shop.parts[0]!.node = model.root;
        model.meshes.forEach(m => { m.receiveShadows = true; shadows?.addShadowCaster(m); });
      }),
      ...items.filter(item => !item.off && item.node instanceof InstancedMesh && replacements[item.node.sourceMesh.name]).map(async item => {
        const old = item.node;
        if (!(old instanceof InstancedMesh)) return;
        const model = await loadModel(scene, replacements[old.sourceMesh.name]!, { priority: "decorative" });
        if (!model) return;
        const bounds = old.getBoundingInfo().boundingBox;
        const size = bounds.maximum.subtract(bounds.minimum).multiply(old.scaling);
        const { min, max } = model.root.getHierarchyBoundingVectors(true);
        const extent = max.subtract(min);
        const horizontal = old.sourceMesh.name === "danfo" || old.sourceMesh.name === "boat";
        const k = horizontal ? Math.max(size.x, size.z) / Math.max(extent.x, extent.z) : size.y / extent.y;
        if (!Number.isFinite(k) || k <= 0) {
          console.warn(`Chase scenery "${model.id}" has invalid bounds; keeping the built-in shape.`);
          model.dispose(); return;
        }
        model.root.scaling.setAll(k);
        if (horizontal) model.root.rotation.y = extent.x >= extent.z ? 0 : Math.PI / 2;
        const holder = new Holder(`chase-${model.id}`, scene);
        model.root.parent = holder;
        holder.position.copyFrom(old.position); holder.rotation.copyFrom(old.rotation);
        old.setEnabled(false); item.node = holder;
        model.meshes.forEach(m => { m.receiveShadows = true; shadows?.addShadowCaster(m); });
        if (old.sourceMesh.name === "danfo") seatDriver(holder);
      }),
      ...walkers.map(w => replaceActor(scene, w.figure, w.modelId, w.mode, shadows, "decorative"))
    ]);
  };
  return {
    ready: models ? afterBrowserIdle(setup) : Promise.resolve(),
    sea,
    update(t, palette, weights, gait) {
      const presence = weights.map(w => smoothstep(0.02, 0.4, w));
      for (const item of items) {
        if (item.off) continue;
        const x = item.f * treadmillX(item.base, t, SPEED, RING);
        const here = presence[item.biome]!;
        const on = Math.abs(x) < WINDOW_RANGE && (item.sink === 0 || here > 0.001);
        if (item.node.isEnabled() !== on) item.node.setEnabled(on);
        if (on) { item.node.position.set(x, item.y - item.sink * (1 - here), item.z); item.node.rotation.y = item.rotY; }
      }
      for (const w of walkers) {
        if (!w.item.node.isEnabled()) continue;
        w.figure.apply(w.mode === "walk" ? walkPose(gait, w.phase, w.cycle) : idlePose(gait, w.phase), cycleAt(gait, w.phase, w.cycle));
      }
      const [rr, rg, rb] = palette.road, [kr, kg, kb] = palette.kerb, [gr, gg, gb] = palette.ground;
      roadMat.diffuseColor.set(rr * 1.9, rg * 1.9, rb * 1.9);
      kerbMat.diffuseColor.set(kr * 1.5, kg * 1.5, kb * 1.5);
      groundMat.diffuseColor.set(gr, gg, gb);
      grain.uOffset = (t * SPEED) / 8.7;
      tiles.uOffset = (t * SPEED) / 4.3;
      sea.vOffset = t * 0.015; sea.uOffset = t * 0.01;
      for (const m of glowMats) {
        const base = (m as StandardMaterial & { glowBase?: Color3 }).glowBase!;
        m.emissiveColor.set(base.r * palette.glow, base.g * palette.glow, base.b * palette.glow);
      }
    }
  };
}
