// Lazily loaded Babylon.js scene for a witness interview: the player's vehicle pulls up at a venue (so far, a market), the player
// walks up to the witness, and the witness speaks while the words appear as subtitles. Built from primitives and painted textures;
// timing, poses and subtitles are in witness-scene.ts and the venue's look and sound in venue-recipes.ts.
import { Scene } from "@babylonjs/core/scene";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { hex, merge, seeded } from "../shared/chase3d-kit.ts";
import { createStage, type SceneHandle, type Stage } from "../shared/chase3d-stage.ts";
import { danfo, runabout } from "../shared/chase3d-cars.ts";
import { armAngles, legAngles, type CameraShot } from "../shared/scene-core.ts";
import type { AvatarPreset } from "../../avatar/avatar-model.ts";
import { ankara } from "../chase/chase3d-actors.ts";
import { createWitnessAudio } from "./witness-audio.ts";
import { hashOf, type VenueRecipe } from "./venue-recipes.ts";
import {
  MEET, ROAD_Z, VEHICLE_FROM_X, WITNESS, type Arrival, type Page, type SubtitleState, busDoorAt, cameraAt, fadeAt, listenLean, planScene, playerPoseAt, stepsTaken,
  subtitleAt, subtitlePages, vehicleSpeedAt, vehicleXAt, witnessAt, wordTimings, wordsOf
} from "./witness-scene.ts";

export type WitnessFrame = { /** 0 black, 1 fully visible. */ fade: number; subtitle: SubtitleState | null };
export type WitnessOptions = {
  /** The player's avatar. Without one the player is simply not drawn. */
  preset?: AvatarPreset | null;
  hour: number;
  quality?: "high" | "light";
  recipe: VenueRecipe;
  arrival: Arrival;
  /** What the witness says. */
  text: string;
  /** The venue's name, painted on the banner over the market. */
  venueName: string;
  sound: boolean;
  onFrame: (frame: WitnessFrame) => void;
  onSlow?: () => void;
};
export type WitnessHandle = SceneHandle & {
  /** Plays the whole scene; resolves when it ends or is skipped. */
  start(): Promise<void>;
  words: string[];
  pages: Page[];
  duration: number;
  /** Freezes the scene at `seconds` and draws that one frame (previews and tests). */
  seek(seconds: number): void;
};

const HEAD_Y = 1.72;
const WRAP = 20;

type Walker = { root: TransformNode; legs: TransformNode[]; arms: TransformNode[]; x0: number; z: number; speed: number; dir: 1 | -1; phase: number };

/** A lit material carrying a printed cloth texture. */
function printed(scene: Scene, name: string, texture: DynamicTexture): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = texture;
  m.specularColor.set(0.03, 0.03, 0.03);
  return m;
}

/** A passer-by built from a handful of primitives. */
function person(stage: Stage, seed: number, prints: readonly DynamicTexture[]) {
  const { scene, mat, cyl, sphere } = stage;
  const r = seeded(seed);
  const skin = mat(["#5a3a28", "#6e4630", "#8a5a3c", "#a06a45", "#3f2a1e"][Math.floor(r() * 5)]!);
  const palette = ["#c0392b", "#2e6f8f", "#d9822b", "#2f8f5b", "#7a4aa0", "#e0b23a", "#f4ecd8", "#b5483a"];
  const colour = () => mat(palette[Math.floor(r() * palette.length)]!);
  const root = new TransformNode(`person${seed}`, scene);
  const woman = r() < 0.6;
  const legs: TransformNode[] = [], arms: TransformNode[] = [];
  const pivot = (x: number, y: number) => { const n = new TransformNode("pivot", scene); n.parent = root; n.position.set(x, y, 0); return n; };
  const top = colour();
  cyl("torso", 0.3, 0.38, 0.6, top, 0, 1.17, 0, root);
  for (const side of [-1, 1]) {
    const arm = pivot(side * 0.22, 1.42);
    cyl("arm", 0.09, 0.08, 0.56, woman ? top : skin, 0, -0.26, 0, arm);
    arms.push(arm);
  }
  if (woman) {
    cyl("wrapper", 0.34, 0.54, 0.86, printed(scene, `wrapper${seed}`, prints[Math.floor(r() * prints.length)]!), 0, 0.45, 0, root);
  } else {
    const trousers = mat(["#2a3340", "#4a3f35", "#1f2a24"][Math.floor(r() * 3)]!);
    for (const side of [-1, 1]) {
      const leg = pivot(side * 0.1, 0.86);
      cyl("leg", 0.17, 0.13, 0.84, trousers, 0, -0.42, 0, leg);
      legs.push(leg);
    }
  }
  const head = sphere("head", 0.24, skin, 0, 1.64, 0);
  head.parent = root;
  if (woman) {
    const tie = sphere("headtie", 0.3, colour(), 0, 1.72, 0.01);
    tie.parent = root; tie.scaling.set(1, 0.7, 1.1);
    if (r() < 0.45) {
      // A basket of produce carried on the head.
      cyl("basket", 0.42, 0.3, 0.14, mat("#b0803f"), 0, 1.92, 0, root);
      const goods = sphere("goods", 0.34, mat(["#c0392b", "#e0b23a", "#2f8f5b"][Math.floor(r() * 3)]!), 0, 2.0, 0);
      goods.parent = root; goods.scaling.y = 0.55;
    }
  } else {
    cyl("cap", 0.2, 0.24, 0.1, colour(), 0, 1.78, 0, root);
  }
  return { root, legs, arms };
}

export async function createWitnessScene(canvas: HTMLCanvasElement, options: WitnessOptions): Promise<WitnessHandle> {
  const stage = createStage(canvas, { hour: options.hour, quality: options.quality });
  const { scene, camera, palette, mat, box, cyl, sphere, plane, textured, caster, engine } = stage;
  const light = stage.light;
  const r = seeded(hashOf(options.venueName) || 1);
  const night = palette.stars || palette.lamp > 0.5;

  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 24; scene.fogEnd = 70;
  scene.fogColor = hex(palette.skyBottom);
  camera.maxZ = 90;

  /** A flat picture that ignores lighting and fog, for the sky. */
  const backdrop = (name: string, w: number, h: number, draw: Parameters<typeof textured>[3], x: number, y: number, z: number) => {
    const t = textured(name, w, h, draw, 512, 256);
    t.material.emissiveTexture = t.material.diffuseTexture; t.material.disableLighting = true; t.material.fogEnabled = false;
    return plane(name, w, h, t.material, x, y, z);
  };
  backdrop("sky", 180, 70, g => {
    const gradient = g.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, palette.skyTop); gradient.addColorStop(0.75, palette.skyBottom); gradient.addColorStop(1, palette.skyBottom);
    g.fillStyle = gradient; g.fillRect(0, 0, 512, 256);
    const sr = seeded(5);
    if (palette.stars) for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + sr() * 0.5})`; g.fillRect(sr() * 512, sr() * 150, 2, 2); }
    g.fillStyle = palette.orbColor; g.beginPath(); g.arc(palette.orb === "moon" ? 130 : 360, palette.orb === "moon" ? 60 : 85, palette.orb === "moon" ? 14 : 20, 0, Math.PI * 2); g.fill();
    // Soft clouds by day.
    if (!palette.stars) { g.fillStyle = "rgba(255,255,255,.35)"; for (let i = 0; i < 9; i++) g.fillRect(sr() * 480, 40 + sr() * 110, 50 + sr() * 70, 8 + sr() * 8); }
  }, 0, 24, 60);

  // ---- Ground: red earth, a tarred lane along the front and the market floor behind it ----
  const earth = textured("earth", 80, 70, g => {
    g.fillStyle = "#a35f38"; g.fillRect(0, 0, 512, 512);
    const er = seeded(11);
    for (let i = 0; i < 1800; i++) { const v = er(); g.fillStyle = v < 0.5 ? "rgba(120,62,35,.5)" : "rgba(196,128,84,.45)"; g.fillRect(er() * 512, er() * 512, 2 + er() * 4, 2 + er() * 4); }
  }, 512, 512);
  const earthMap = earth.material.diffuseTexture as Texture;
  earthMap.uScale = 10; earthMap.vScale = 9;
  const ground = box("ground", 120, 0.2, 100, earth.material, 0, -0.1, 30);
  ground.receiveShadows = !light;
  const tar = textured("tar", 120, 3.4, g => {
    g.fillStyle = "#3a3b40"; g.fillRect(0, 0, 512, 64);
    g.fillStyle = "#e8e2cf"; for (let x = 0; x < 512; x += 64) g.fillRect(x + 8, 30, 34, 4);
  }, 512, 64);
  box("lane", 120, 0.03, 3.4, tar.material, 0, 0.015, ROAD_Z);
  box("kerb", 120, 0.12, 0.18, mat("#9b9486"), 0, 0.06, ROAD_Z + 1.78);

  // ---- Distant town and palms, hazed by the fog ----
  const skyline: Mesh[] = [];
  for (let i = 0; i < 26; i++) {
    const w = 3 + r() * 5, h = 3 + r() * 8, x = -48 + i * 3.8 + r() * 2;
    skyline.push(box("block", w, h, 3, mat(["#8c8579", "#a8a091", "#7a8a8f", "#b3a58a"][Math.floor(r() * 4)]!), x, h / 2, 38 + r() * 6));
  }
  merge("skyline", skyline);
  const trunk = mat("#6b4a2b"), frond = mat("#2f6b3a");
  for (const [x, z, h] of [[-9, 11, 7], [8.5, 12, 8], [-14, 9, 6.5], [15, 10, 7.5], [-4, 15, 8.5], [3, 16, 7]] as const) {
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
  type Ware = "tomatoes" | "cloth" | "yams" | "fruit";
  const stall = (x: number, z: number, w: number, stripes: readonly [string, string], ware: Ware, backdropColour?: string) => {
    const depth = 1;
    const parts: Mesh[] = [];
    parts.push(box("table", w, 0.78, depth, wood, x, 0.39, z));
    parts.push(box("tableTop", w + 0.06, 0.05, depth + 0.06, mat("#d9cdb0"), x, 0.8, z));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(cyl("pole", 0.07, 0.07, 2.6, pole, x + sx * (w / 2 + 0.05), 1.3, z + sz * 0.8));
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
  stall(WITNESS.x, 1.95, 2.6, ["#2e6f8f", "#f4ecd8"], "tomatoes", "#1f5f55");
  stall(-2.6, 2.3, 2.4, ["#b5483a", "#f2c14e"], "cloth");
  stall(4.4, 2.3, 2.6, ["#2f8f5b", "#f4ecd8"], "yams");
  stall(7.6, 2.5, 2.4, ["#d9822b", "#f4ecd8"], "fruit");
  stall(-6.2, 2.6, 2.6, ["#7a4aa0", "#f4ecd8"], "tomatoes");
  for (const [x, z, a, b, ware] of [[-4, 6, "#c0392b", "#f4ecd8", "fruit"], [0.5, 6.4, "#2e6f8f", "#f2c14e", "cloth"], [5, 6.2, "#b5483a", "#f4ecd8", "yams"], [9, 6, "#2f8f5b", "#f2c14e", "tomatoes"], [-8.5, 6.4, "#d9822b", "#f4ecd8", "cloth"]] as const) stall(x, z, 2.6, [a, b], ware);

  // Sacks, crates and a handcart by the lane.
  const sack = mat("#c9b48a", { specular: 0.02 });
  for (const [x, z] of [[5.8, -1.1], [6.3, -0.9], [6.0, -1.0]] as const) { const s = sphere("sack", 0.7, sack, x, 0.3, z); s.scaling.set(1, 0.7, 0.8); }
  for (const [x, z, y] of [[-6.3, -1.1, 0.2], [-5.8, -1.0, 0.2], [-6.05, -1.05, 0.62]] as const) box("crate", 0.55, 0.4, 0.45, wood, x, y, z);
  box("cartBed", 1.3, 0.1, 0.7, wood, 3.8, 0.6, -1.0);
  for (const s of [-1, 1]) { cyl("cartWheel", 0.6, 0.6, 0.06, mat("#2a2f33"), 3.8 + s * 0.45, 0.3, -0.62).rotation.x = Math.PI / 2; box("cartShaft", 1.0, 0.04, 0.04, wood, 3.1, 0.7, -1.0 + s * 0.25); }

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
  plane("banner", banner.width, banner.height, banner.material, -1.15, 3.55, -0.6);
  for (const x of [-5.1, 2.8]) cyl("bannerPole", 0.12, 0.14, 4.1, pole, x, 2.05, -0.6);

  // ---- Light after dark ----
  if (palette.lamp > 0.3) {
    for (const [x, z] of [[WITNESS.x, 1.2], [-2, 0.5], [4, 0.5]] as const) {
      const lamp = new PointLight("lamp", new Vector3(x, 2.4, z), scene);
      lamp.diffuse = hex("#ffd9a0"); lamp.range = 7; lamp.intensity = 0.55 * palette.lamp;
    }
  }

  // ---- People ----
  const crowd: Walker[] = [];
  const count = light ? 4 : 8;
  for (let i = 0; i < count; i++) {
    const p = person(stage, 100 + i, prints);
    const dir = i % 2 === 0 ? 1 : -1;
    const walker: Walker = { ...p, x0: -9 + (i * 18) / count, z: i % 3 === 0 ? -1.5 : i % 3 === 1 ? -0.1 : 0.55, speed: 0.7 + (i % 4) * 0.2, dir, phase: i * 1.3 };
    walker.root.rotation.y = Math.atan2(-dir, 0);
    crowd.push(walker);
  }
  const shoppers = [person(stage, 300, prints), person(stage, 301, prints), person(stage, 302, prints)];
  [[-2.6, 1.3, 0], [4.4, 1.3, 0.2], [7.6, 1.5, -0.1]].forEach(([x, z, turn], i) => { shoppers[i]!.root.position.set(x!, 0, z!); shoppers[i]!.root.rotation.y = Math.PI + turn!; });

  // ---- The vehicle ----
  const car = options.arrival === "drive" ? runabout(stage) : null;
  const bus = options.arrival === "hitch" ? danfo(stage) : null;
  const vehicle = (car ?? bus)!;
  vehicle.root.position.set(VEHICLE_FROM_X, 0, ROAD_Z);
  vehicle.root.rotation.y = Math.atan2(1, 0);
  const wheelRadius = car ? 0.31 : 0.38;

  // ---- The player and the witness ----
  const player = stage.addFigure(options.preset);
  const witnessLook = options.recipe.witnesses[hashOf(options.text) % options.recipe.witnesses.length]!;
  const witness = stage.addFigure(witnessLook)!;
  witness.root.position.set(WITNESS.x, 0, WITNESS.z);
  const head = witness.root.getChildMeshes().find(m => m.name === "head");
  const mouth = sphere("mouth", 1, mat("#4a1414", { specular: 0.1 }), 0, HEAD_Y - 0.11, -0.25);
  mouth.parent = witness.root;
  void head;

  const plan = planScene(options.arrival, wordsOf(options.text).length);
  const words = wordsOf(options.text);
  const timings = wordTimings(words, plan.speech);
  const pages = subtitlePages(words);

  const audio = options.sound ? createWitnessAudio(options.recipe.sound, car ? "car" : "bus", hashOf(options.text)) : null;
  let spoken = false, lastStep = -1, doorSounded = false;

  const poseFigure = (figure: NonNullable<typeof player>, p: ReturnType<typeof playerPoseAt>, t: number, lean = 0) => {
    figure.root.position.set(p.x, p.y, p.z);
    figure.root.rotation.y = p.heading;
    figure.root.rotation.x = lean;
    const legs = legAngles(p);
    figure.rig.hips.forEach((h, i) => { h.rotation.x = legs.hips[i]!; });
    figure.rig.knees.forEach((k, i) => { k.rotation.x = legs.knees[i]!; });
    const arms = armAngles(p, t);
    figure.rig.shoulders.forEach((s, i) => { s.rotation.x = arms[i]!; });
    figure.setAlpha(p.visible ? p.alpha : 0);
  };

  // A portrait window shows less to the sides, so stand further back to keep the people in the picture.
  const aim = (shot: CameraShot) => {
    const aspect = canvas.clientWidth > 0 && canvas.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1.7;
    const back = aspect < 1.3 ? Math.min(2, 1.3 / Math.max(0.5, aspect)) : 1;
    const [tx, ty, tz] = shot.target;
    stage.aim({ position: [tx + (shot.position[0] - tx) * back, ty + (shot.position[1] - ty) * back + (back - 1) * 0.4, tz + (shot.position[2] - tz) * back], target: shot.target });
  };

  let lastPage = -2, lastSpoken = -2, lastFade = -1;
  const update = (t: number) => {
    const x = vehicleXAt(plan, t);
    vehicle.root.position.x = x;
    vehicle.wheels.forEach(w => { w.rotation.x = (VEHICLE_FROM_X - x) / wheelRadius; });
    if (bus) bus.door.position.z = -1.2 + 0.95 * busDoorAt(plan, t);

    const p = playerPoseAt(plan, t);
    if (player) poseFigure(player, p, t, listenLean(plan, t));

    const w = witnessAt(plan, timings, t);
    witness.root.rotation.y = w.heading;
    witness.root.rotation.x = w.lean;
    witness.root.position.y = w.bob;
    witness.rig.shoulders[0]!.rotation.x = w.arms[0];
    witness.rig.shoulders[1]!.rotation.x = w.arms[1];
    witness.rig.shoulders[1]!.rotation.z = w.wave;
    mouth.scaling.set(0.1, 0.012 + 0.07 * w.mouth, 0.04);

    for (const c of crowd) {
      const along = c.x0 + c.dir * c.speed * t;
      c.root.position.set(((((along + WRAP / 2) % WRAP) + WRAP) % WRAP) - WRAP / 2, Math.abs(Math.sin(t * c.speed * 5 + c.phase)) * 0.02, c.z);
      const swing = Math.sin(t * c.speed * 5 + c.phase) * 0.5;
      c.legs.forEach((l, i) => { l.rotation.x = i ? swing : -swing; });
      c.arms.forEach((a, i) => { a.rotation.x = i ? -swing : swing; });
    }
    shoppers.forEach((s, i) => { s.root.rotation.z = Math.sin(t * 0.9 + i) * 0.015; });

    aim(cameraAt(plan, t));

    if (audio) {
      audio.engine(vehicleSpeedAt(plan, t));
      if (!spoken) { spoken = true; audio.speak(timings, Math.max(0, plan.speechStart - t), witnessLook.pitch, hashOf(options.text) ^ 0x5bd1e995); }
      if (!doorSounded && t >= plan.stopped + (bus ? 0.1 : 0.35)) { doorSounded = true; audio.door(); }
      const step = stepsTaken(p);
      if (step >= 0 && step !== lastStep) audio.step();
      lastStep = step;
    }

    const fade = Math.round(fadeAt(plan, t) * 100) / 100;
    const state = t >= plan.speechStart ? subtitleAt(timings, pages, t - plan.speechStart) : null;
    const page = state ? state.page : -1, count = state ? state.spoken : -1;
    if (fade !== lastFade || page !== lastPage || count !== lastSpoken) {
      lastFade = fade; lastPage = page; lastSpoken = count;
      options.onFrame({ fade, subtitle: state && state.spoken > 0 ? state : null });
    }
  };

  const handle = stage.run({ end: plan.end, update, onSlow: options.onSlow });
  void MEET;
  return {
    ...handle,
    words, pages, duration: plan.end,
    start: () => handle.play({ end: plan.end, update }),
    seek(seconds) { engine.stopRenderLoop(); update(seconds); scene.render(); },
    dispose() { audio?.dispose(); handle.dispose(); }
  };
}
