// Lazily loaded Babylon.js renderer for the travelling scene. It draws exactly what `frameAt` (journey-scene.ts) describes, from the same
// side-on pinhole camera as the pure timeline. Full uses supplied models; Standard retains primitives and painted textures.
import { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { hex, material } from "../shared/chase3d-kit.ts";
import { createStage, type Stage } from "../shared/chase3d-stage.ts";
import { danfo, runabout } from "../shared/chase3d-cars.ts";
import { contactShadow } from "../shared/chase3d-shapes.ts";
import { armAngles, legAngles, mix, type Pose } from "../shared/scene-core.ts";
import {
  AIR, FOV, HOSTESS, MODEL_AIR, SEAT_Z,
  BUS_DRIVER,
  BUS_DRIVER_X, BUS_DRIVER_Y, BUS_DRIVER_Z,
  coloursAt, frameAt, groundCameraX, mixColour, modelBoardingPosition, propColours, propX, tone, weightAt, type JourneyPlan, type Prop
} from "./journey-scene.ts";
import { createJourneyDriver, type JourneyHandle, type JourneyOptions } from "./journey-driver.ts";
import { loadModel, type ModelHandle } from "../shared/chase3d-models.ts";
import { aimJoint, modelFigure, type ModelFigure } from "../shared/chase3d-model-figure.ts";
import { avatarModelId } from "../shared/model-manifest.ts";

// ImageProcessingConfiguration.TONEMAPPING_ACES, as a plain number: importing that module on its own breaks Babylon's shader loading under the vite dev server.
const TONEMAPPING_ACES = 1;
const BANDS = 24;
/** How high (metres, at the sky's distance) the painted sky reaches above the horizon. */
const SKY_HEIGHT = 160;
const TILE = 6;

type Build = { root: TransformNode; stage: Stage; c: ReturnType<typeof propColours>; p: Prop; plan: JourneyPlan };

const SCENERY_MODELS: Partial<Record<Prop["kind"], string>> = {
  tree: "journey_tree", palm: "journey_palm", pine: "journey_pine", baobab: "journey_baobab", cactus: "journey_cactus",
  rock: "journey_rock", bush: "journey_bush", reed: "journey_reed", crop: "journey_crop_field", hut: "journey_hut",
  stall: "journey_stall", building: "journey_building", boat: "journey_boat", pole: "journey_pole", hill: "journey_hill",
  garage: "journey_garage", busstop: "journey_busstop", billboard: "journey_billboard", terminal: "journey_terminal",
  tower: "journey_tower", hangar: "journey_hangar"
};
const TEXTURED_SIGNS = new Set<Prop["kind"]>(["garage", "busstop", "billboard", "terminal"]);

export async function createJourneyScene3D(canvas: HTMLCanvasElement, options: JourneyOptions): Promise<JourneyHandle & { scene: Scene }> {
  const stage = createStage(canvas, { hour: options.hour, quality: options.quality, models: options.models });
  const abort = () => stage.engine.dispose();
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
  if (options.signal?.aborted) throw new DOMException("Journey setup cancelled", "AbortError");
  const { scene, palette, mat, box, cyl, sphere, plane, textured, light } = stage;
  const driver = createJourneyDriver(options);
  const { plan } = driver;
  const air = plan.mode === "fly";
  const skyOnly = plan.loop && air;
  const [firstX, lastX] = plan.loop ? [-130, plan.period + 130] : air ? [-80, 720] : [-80, plan.distance + 110];

  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 70; scene.fogEnd = 230;
  stage.camera.maxZ = 600;
  stage.camera.fov = FOV;
  const grade = scene.imageProcessingConfiguration;
  grade.toneMappingEnabled = true; grade.toneMappingType = TONEMAPPING_ACES; grade.exposure = 1.1; grade.contrast = 1.12;
  // The lighting follows the hour; the colours of the landscapes already carry the same darkening (journey-scene.ts), so keep the lights gentle.
  stage.ambient.intensity = Math.max(palette.ambientIntensity, 0.85);

  // ---- Sky: stacked unlit bands that follow the camera, recoloured every frame as the landscapes blend ----
  const bandMats: StandardMaterial[] = [];
  const bands: Mesh[] = [];
  for (let i = 0; i < BANDS; i++) {
    const m = material(scene, `band${i}`, "#000000");
    m.disableLighting = true; m.fogEnabled = false;
    bandMats.push(m);
    const b = plane(`band${i}`, 1400, 1, m, 0, 0, 260);
    b.receiveShadows = false; b.isPickable = false;
    bands.push(b);
  }

  // With no ground (the weekly route view of a flight) the lower half of the picture is a bank of haze under the plane.
  const lowMats: StandardMaterial[] = [], lowBands: Mesh[] = [];
  for (let i = 0; skyOnly && i < 10; i++) {
    const m = material(scene, `low${i}`, "#000000");
    m.disableLighting = true; m.fogEnabled = false;
    lowMats.push(m);
    const b = plane(`low${i}`, 1400, 1, m, 0, 0, 255);
    b.receiveShadows = false; b.isPickable = false;
    lowBands.push(b);
  }

  // ---- Ground and road: tiles whose colours follow the landscape at their x ----
  for (let x = firstX; !skyOnly && x < lastX; x += TILE) {
    const c = coloursAt(plan, x + TILE / 2);
    box("ground", TILE + 0.02, 0.2, 260, mat(c.ground, { specular: 0 }), x + TILE / 2, -0.1, 90).receiveShadows = false;
    box("road", TILE + 0.02, 0.04, 5.6, mat(c.road, { specular: 0.02 }), x + TILE / 2, 0.02, 0).receiveShadows = false;
  }
  const dashMat = mat("#e8e2cf", { specular: 0 });
  for (let x = Math.floor(firstX / 8) * 8; !skyOnly && x < lastX; x += 8) box("dash", 4, 0.05, 0.2, dashMat, x + 2, 0.05, 0).receiveShadows = false;

  // ---- Scenery ----
  const label = (root: TransformNode, lines: readonly string[], w: number, h: number, bg: string, fg: string, x: number, y: number, z: number) => {
    const key = lines.join("|");
    const t = textured(`sign-${key}`, w, h, g => {
      g.fillStyle = bg; g.fillRect(0, 0, 512, Math.round(512 * (h / w)));
      g.fillStyle = fg;
      const hpx = Math.round(512 * (h / w));
      lines.forEach((line, i) => {
        const size = Math.min((hpx / lines.length) * 0.66, 512 * 0.92 / Math.max(4, line.length * 0.6));
        g.font = `800 ${size}px system-ui, sans-serif`;
        g.fillText(line, 256 - g.measureText(line).width / 2, (hpx / lines.length) * (i + 0.5) + size * 0.35);
      });
    }, 512, Math.round(512 * (h / w)));
    const s = plane(`sign-${key}`, w, h, t.material, x, y, z);
    s.parent = root; s.receiveShadows = false;
    return s;
  };
  const part = <T extends Mesh>(root: TransformNode, m: T) => { m.parent = root; m.receiveShadows = false; return m; };

  const BUILD: Partial<Record<Prop["kind"], (b: Build) => void>> = {
    tree({ root, c }) { box("trunk", 0.26, 2.4, 0.26, mat(c.trunk), 0, 1.2, 0, root); part(root, sphere("canopy", 3, mat(c.leaf), 0, 3.1, 0)); part(root, sphere("canopy", 1.8, mat(c.leaf), -0.9, 2.6, 0.2)); part(root, sphere("canopy", 2, mat(c.leaf), 0.9, 2.7, -0.2)); },
    palm({ root, c }) {
      const trunk = cyl("trunk", 0.16, 0.3, 6, mat(c.trunk), 0.25, 3, 0, root); trunk.rotation.z = -0.08;
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const f = box("frond", 2.6, 0.06, 0.5, mat(c.leaf), 0.5 + Math.cos(a) * 1.2, 6 - Math.abs(Math.sin(a)) * 0.2, Math.sin(a) * 1.2, root); f.rotation.y = -a; f.rotation.z = -0.25 * Math.cos(a); }
    },
    pine({ root, c }) { box("trunk", 0.2, 1, 0.2, mat(c.trunk), 0, 0.5, 0, root); for (let i = 0; i < 3; i++) cyl("cone", 0, 2.8 - i * 0.5, 1.7, mat(c.leaf), 0, 1.7 + i * 1.3, 0, root); },
    baobab({ root, c }) { cyl("trunk", 1.3, 1.9, 3.4, mat("#8a6a4a"), 0, 1.7, 0, root); for (const a of [-1, 0, 1]) { part(root, sphere("crown", 1.7, mat(c.leaf), a * 1.3, 4.5, 0)); box("limb", 0.2, 1.4, 0.2, mat("#8a6a4a"), a * 0.6, 3.9, 0, root).rotation.z = -a * 0.5; } },
    cactus({ root, c }) { cyl("stem", 0.4, 0.45, 2.8, mat(c.leaf), 0, 1.4, 0, root); for (const s of [-1, 1]) { box("arm", 0.7, 0.26, 0.26, mat(c.leaf), s * 0.55, 1.5 + (s > 0 ? 0.4 : 0), 0, root); box("armUp", 0.26, 0.9, 0.26, mat(c.leaf), s * 0.85, 1.9 + (s > 0 ? 0.4 : 0), 0, root); } },
    rock({ root }) { const r = part(root, sphere("rock", 1.8, mat("#8a8478"), 0, 0.4, 0)); r.scaling.set(1, 0.6, 0.8); const r2 = part(root, sphere("rock", 1, mat("#9a9488"), 0.7, 0.2, -0.2)); r2.scaling.y = 0.6; },
    bush({ root, c }) { part(root, sphere("bush", 1.6, mat(c.leaf), 0, 0.5, 0)).scaling.y = 0.7; part(root, sphere("bush", 1, mat(c.leaf), 0.6, 0.35, 0)); },
    reed({ root, c }) { for (let i = 0; i < 6; i++) { const r = cyl("reed", 0.04, 0.08, 1.7 + (i % 3) * 0.3, mat(c.leaf), -0.5 + i * 0.2, 0.9, (i % 2) * 0.2, root); r.rotation.z = (i % 2 ? 0.1 : -0.08); } },
    crop({ root, c }) { for (let i = 0; i < 8; i++) part(root, sphere("crop", 0.95, mat(i % 2 ? c.leaf : c.accent), -3.2 + i * 0.9, 0.35, 0)).scaling.y = 0.8; },
    hut({ root, c }) { cyl("wall", 2.6, 2.6, 1.7, mat("#c9a878"), 0, 0.85, 0, root); cyl("roof", 0, 4, 1.7, mat(c.accent), 0, 2.5, 0, root); box("door", 0.5, 1.1, 0.06, mat("#5a3a22"), 0, 0.55, -1.32, root); },
    stall({ root, c }) {
      for (const x of [-1.5, 1.5]) box("post", 0.1, 2.2, 0.1, mat(c.trunk), x, 1.1, -0.5, root);
      box("awning", 3.8, 0.12, 1.6, mat(c.accent), 0, 2.3, -0.4, root).rotation.x = 0.12;
      box("table", 2.6, 0.7, 0.8, mat("#8a5a3c"), 0, 0.85, -0.6, root);
      for (let i = 0; i < 5; i++) part(root, sphere("goods", 0.4, mat(i % 2 ? "#d63a2e" : "#f2c14e"), -1 + i * 0.5, 1.4, -0.6));
    },
    building({ root, c, p }) {
      const h = 4.5 + p.v * 4.5, w = 3.6 + p.v * 2;
      box("walls", w, h, 3, mat(c.accent), 0, h / 2, 0, root); box("roof", w + 0.3, 0.3, 3.3, mat("#55565a"), 0, h + 0.15, 0, root);
      const win = mat("#3a5a6b", { specular: 0.3 });
      for (let r = 0; r < Math.floor(h / 1.6); r++) for (let k = 0; k < 3; k++) box("window", 0.6, 0.8, 0.05, win, -w / 2 + 0.7 + k * (w / 3.2), 1.1 + r * 1.5, -1.52, root);
    },
    boat({ root, c }) { const hull = box("hull", 3, 0.6, 1, mat(c.accent), 0, 0.3, 0, root); hull.scaling.z = 0.9; box("mast", 0.08, 3, 0.08, mat(c.trunk), 0, 1.8, 0, root); box("sail", 1.1, 2.2, 0.04, mat("#f4ecd8"), 0.65, 1.8, 0, root); },
    pole({ root }) { cyl("pole", 0.14, 0.18, 5.6, mat("#5a4a3a"), 0, 2.8, 0, root); box("arm", 1.6, 0.1, 0.1, mat("#5a4a3a"), 0, 5.2, 0, root); },
    water({ root, c }) { box("water", 44, 0.04, 46, mat(c.water, { specular: 0.5 }), 0, 0.03, 0, root); },
    hill({ root, c }) { const h = part(root, sphere("hill", 1, mat(c.far, { specular: 0 }), 0, -0.5, 0)); h.scaling.set(28, 14, 20); h.material!.fogEnabled = true; },
    cloud({ root, stage: s, p }) { const m = s.mat(tone("#ffffff", plan.dim), { emissive: tone("#f2f6fa", plan.dim), specular: 0 }); for (const [x, y, r] of [[-3.6, 0, 3.2], [0, 1, 4.2], [3.8, 0, 3.4], [0.4, -0.6, 3.6]] as const) part(root, sphere("puff", r * 2, m, x, y, 0)).scaling.z = 0.4; void p; },
    garage({ root }) {
      box("walls", 9.6, 4.4, 5, mat("#d8d2c4"), 0, 2.2, 0, root); box("roof", 10, 0.35, 5.4, mat("#8a5a3c"), 0, 4.55, 0, root);
      box("opening", 5.4, 3.3, 0.1, mat("#25211e", { specular: 0 }), 0, 1.65, -2.55, root);
      label(root, ["GARAGE"], 4.4, 0.7, "#1f4f9f", "#ffffff", 0, 3.85, -2.56);
    },
    busstop({ root }) {
      for (const x of [-2.2, 2]) box("post", 0.12, 2.5, 0.12, mat("#55565a"), x, 1.25, 0, root);
      box("roof", 5, 0.18, 1.6, mat("#1f4f9f"), 0, 2.6, 0, root); box("bench", 3.6, 0.1, 0.5, mat("#8a5a3c"), 0, 0.55, 0.3, root);
      box("signpost", 0.12, 3.6, 0.12, mat("#55565a"), 3.2, 1.8, -0.5, root);
      label(root, ["BUS PARK"], 2.2, 0.9, "#1f4f9f", "#ffffff", 3.3, 3.75, -0.58);
    },
    parkedbus({ root }) { const b = danfo(stage); b.root.parent = root; b.root.rotation.y = Math.PI / 2; },
    billboard({ root, p }) {
      for (const x of [-2.1, 2]) box("post", 0.18, 3.2, 0.18, mat("#4a4a4a"), x, 1.6, 0, root);
      box("board", 5.5, 2.8, 0.2, mat("#1f6f8f"), 0, 3.3, 0, root);
      label(root, ["WELCOME TO", (p.text ?? "").replace(/^Welcome to /i, "").toUpperCase()], 5.4, 2.7, "#1f6f8f", "#ffffff", 0, 3.3, -0.12);
      box("trim", 5.5, 0.1, 0.24, mat("#f2c14e"), 0, 1.85, 0, root);
    },
    terminal({ root, p }) {
      box("hall", 16, 6, 6, mat("#d8d2c4"), 0, 3, 0, root); box("roof", 16.6, 0.4, 6.6, mat("#55565a"), 0, 6.2, 0, root);
      box("glass", 14, 2.6, 0.1, mat("#7fa6c6", { specular: 0.5 }), 0, 2.3, -3.02, root); box("doors", 2.4, 2.6, 0.12, mat("#2a3a44"), 0, 1.3, -3.04, root);
      label(root, [p.text ?? "Airport"], 14, 1.9, "#1f4f9f", "#ffffff", 0, 4.85, -3.04);
    },
    tower({ root }) { cyl("shaft", 1, 1.2, 11, mat("#c9c4b6"), 0, 5.5, 0, root); cyl("cab", 4.4, 3.4, 1.6, mat("#3a5a6b", { specular: 0.4 }), 0, 11.8, 0, root); cyl("cap", 4.8, 4.8, 0.3, mat("#55565a"), 0, 12.75, 0, root); },
    hangar({ root }) { box("shed", 14, 5, 8, mat("#9aa8b5"), 0, 2.5, 0, root); const r = cyl("roof", 7, 7, 8, mat("#9aa8b5"), 0, 5, 0, root); r.rotation.x = Math.PI / 2; r.scaling.x = 2; r.scaling.z = 0.5; box("door", 6, 3.6, 0.1, mat("#2a3a44"), 0, 1.8, -4.05, root); }
  };
  const extent = (k: Prop["kind"]) => (k === "water" ? 26 : k === "hill" ? 40 : k === "cloud" ? 12 : 12);
  const built = new Map<Prop, TransformNode>();
  const ensure = (p: Prop) => {
    let root = built.get(p);
    if (root) return root;
    root = new TransformNode(`prop-${p.kind}`, scene);
    root.position.set(p.x, p.y, p.kind === "water" ? 37 : p.z);
    BUILD[p.kind]?.({ root, stage, c: propColours(plan, p), p, plan });
    built.set(p, root);
    const modelId = !air && options.models ? SCENERY_MODELS[p.kind] : undefined;
    if (modelId) {
      const fallbackMeshes = root.getChildMeshes();
      void loadModel(scene, modelId).then(model => {
        if (!model) return;
        if (scene.isDisposed) { model.dispose(); return; }
        model.root.parent = root;
        model.meshes.forEach(m => stage.caster(m));
        fallbackMeshes.filter(m => !(TEXTURED_SIGNS.has(p.kind) && m.name.startsWith("sign-"))).forEach(m => m.setEnabled(false));
      }).catch(error => {
        console.error(`Journey scenery model "${modelId}" failed to load; keeping its built-in shape.`, error);
      });
    }
    return root;
  };

  // ---- The vehicle ----
  const car = options.mode === "drive" ? runabout(stage) : null;
  const bus = options.mode === "hitch" ? danfo(stage) : null;
  const ground = car ?? bus;
  if (ground) ground.root.rotation.y = -Math.PI / 2;

  const planeRig = air ? (() => {
    const pivot = new TransformNode("plane", scene);
    const body = new TransformNode("planeBody", scene); body.parent = pivot; body.position.x = 0.5;
    const white = mat("#eef2f4", { specular: 0.3 }), blue = mat("#1f4f9f"), grey = mat("#aab4ba", { specular: 0.2 });
    const fus = cyl("fuselage", 2.7, 2.7, 15, white, 0, 2.7, 0, body); fus.rotation.z = Math.PI / 2;
    part(body, sphere("nose", 2.7, white, 7.5, 2.7, 0)).scaling.x = 1.5;
    const tail = cyl("tail", 0.5, 2.6, 5, white, -9.5, 3.0, 0, body); tail.rotation.z = Math.PI / 2;
    box("stripe", 14, 0.16, 2.76, blue, 0, 2.2, 0, body);
    box("fin", 2.2, 3.2, 0.15, blue, -8.8, 5.6, 0, body).rotation.z = 0.22;
    box("stabiliser", 2, 0.1, 6, grey, -9.6, 3.5, 0, body);
    box("wing", 3.2, 0.15, 4, grey, -2.4, 1.9, 0, body);
    for (const z of [-1.9, 1.9]) { const e = cyl("engine", 0.95, 0.95, 2.2, mat("#8f9aa1"), -1.8, 1.25, z, body); e.rotation.z = Math.PI / 2; }
    const win = mat("#2b4a5e", { specular: 0.5 });
    for (let i = 0; i < 12; i++) box("window", 0.4, 0.4, 0.05, win, -5 + i * 0.85, 3.25, -1.36, body);
    box("cockpit", 1.8, 0.5, 0.05, win, 6.4, 3.5, -1.2, body);
    const doorShut = box("doorShut", 0.9, 1.75, 0.06, mat("#cfd6da"), AIR.doorX, AIR.sill + 0.87, -1.37, body);
    const doorOpen = box("doorOpen", 0.9, 1.75, 0.07, mat("#1b1d20", { specular: 0 }), AIR.doorX, AIR.sill + 0.87, -1.38, body);
    const gear = new TransformNode("gear", scene); gear.parent = body;
    for (const x of [-2.2, 6]) { box("strut", 0.2, 1, 0.2, mat("#3a3f43"), x, 0.95, 0, gear); const w = cyl("tyre", 0.9, 0.9, 0.4, mat("#15191c"), x, 0.45, 0, gear); w.rotation.x = Math.PI / 2; }
    const stairs = new TransformNode("stairs", scene); stairs.parent = body;
    const n = 8, x0 = AIR.stairBottom, x1 = AIR.stairTop;
    for (let i = 0; i < n; i++) { const h = mix(0.2, AIR.sill, (i + 1) / n); box("step", (x1 - x0) / n, h, 1.3, i % 2 ? mat("#9aa4ab") : mat("#b4bdc3"), mix(x0, x1, (i + 0.5) / n), h / 2, -2.3, stairs); }
    box("landing", 1, 0.12, 1.3, mat("#8a8f93"), x1 + 0.5, AIR.sill - 0.06, -2.3, stairs);
    box("rail", 4.3, 0.07, 0.07, mat("#d8d2c4"), (x0 + x1) / 2 + 0.4, AIR.sill / 2 + 0.9, -2.9, stairs).rotation.z = Math.atan2(AIR.sill, x1 - x0);
    return { pivot, body, doorShut, doorOpen, gear, stairs };
  })() : null;

  // ---- The player, the cabin crew, and bus occupants ----
  const player = skyOnly ? null : stage.addFigure(options.preset);
  const crew = air && !skyOnly ? stage.addFigure(HOSTESS) : null;
  const busDriver = bus && !skyOnly ? stage.addFigure(BUS_DRIVER) : null;
  // The boarding pass the player holds up: a card in the right hand, facing the camera.
  const card = air && player ? box("pass", 0.26, 0.17, 0.02, mat("#ffffff"), 0, -0.44, -0.12, player.rig.elbows[1]) : null;
  if (card) { card.setEnabled(false); box("passStripe", 0.26, 0.04, 0.025, mat("#1f4f9f"), 0, 0.05, 0).parent = card; }
  if (player && !light) contactShadow(scene, player.root, 0.9, 0.7);
  const wheelR = car ? 0.31 : bus ? 0.38 : 0.45;
  let playerModel: ModelFigure | null = null, crewModel: ModelFigure | null = null;
  const replacePerson = async (fallback: NonNullable<typeof player>, id: string, seated: boolean) => {
    const model = await loadModel(scene, id);
    if (!model) return null;
    if (!model.clips.has("walk") || (seated && !model.clips.has("sit"))) {
      console.warn(`Journey character "${id}" lacks required Walk${seated ? "/Sit" : ""} clips; retaining the built-in figure.`);
      model.dispose(); return null;
    }
    const figure = modelFigure(model, { pinHorizontalTravel: true, neutralStanding: true });
    const body = fallback.root.getChildMeshes();
    model.root.parent = fallback.root;
    body.filter(m => m !== card && m.parent !== card).forEach(m => m.setEnabled(false));
    model.meshes.forEach(m => stage.caster(m));
    contactShadow(scene, model.root, 0.9, 0.7);
    return figure;
  };
  const replaceVehicle = async (root: TransformNode, id: string, yaw: number, keep: TransformNode[] = []) => {
    const model = await loadModel(scene, id);
    if (!model) return null;
    const meshes = root.getChildMeshes();
    model.root.parent = root; model.root.rotation.y = yaw;
    meshes.filter(m => !keep.some(n => m === n || m.isDescendantOf(n))).forEach(m => m.setEnabled(false));
    model.meshes.forEach(m => stage.caster(m));
    return model;
  };
  let planeModel: ModelHandle | null = null;
  if (options.models) {
    await Promise.all([
      player && options.preset && avatarModelId(options.preset.avatar_id)
        ? replacePerson(player, avatarModelId(options.preset.avatar_id)!, !!(car || bus)).then(m => { playerModel = m; }) : undefined,
      crew ? replacePerson(crew, "witness_woman_uniform", false).then(m => { crewModel = m; }) : undefined,
      ground && car ? replaceVehicle(ground.root, "car_player_runabout", 0) : undefined,
      bus ? replaceVehicle(bus.root, "bus_danfo", Math.PI / 2).then(m => { if (m) bus.door.setEnabled(false); }) : undefined,
      planeRig ? replaceVehicle(planeRig.body, "plane_airliner", 0, [planeRig.stairs, planeRig.doorOpen]).then(m => { planeModel = m; }) : undefined,
      ...plan.props.filter(p => p.kind === "parkedbus").map(async p => {
        const root = ensure(p);
        await replaceVehicle(root, "bus_coach", Math.PI);
      })
    ]);
  }
  if (options.signal?.aborted) throw new DOMException("Journey setup cancelled", "AbortError");
  if (planeModel && planeRig) {
    planeRig.stairs.getChildMeshes().forEach(m => m.dispose());
    const { stairBottom, stairTop, sill, bottomZ, topZ } = MODEL_AIR;
    const stairLength = Math.hypot(stairTop - stairBottom, topZ - bottomZ);
    for (let i = 0; i < 12; i++) {
      const k = (i + 0.5) / 12, height = sill * (i + 1) / 12;
      const step = box("step", stairLength / 12, height, 1.3, mat(i % 2 ? "#9aa4ab" : "#b4bdc3"), mix(stairBottom, stairTop, k), height / 2, mix(bottomZ, topZ, k), planeRig.stairs);
      step.rotation.y = -Math.atan2(topZ - bottomZ, stairTop - stairBottom);
    }
    box("landing", 1.1, 0.12, 1.3, mat("#8a8f93"), MODEL_AIR.doorX, sill - 0.06, topZ, planeRig.stairs);
    planeRig.doorOpen.position.set(MODEL_AIR.doorX, sill + 0.87, topZ + 0.2);
  }
  const joint = (figure: ModelFigure, name: string) => figure.model.root.getDescendants().find(n => n.name.endsWith(`:${name}`));
  const showPass = (figure: ModelFigure, amount: number) => {
    if (!card) return;
    const upper = joint(figure, "RightArm"), lower = joint(figure, "RightForeArm"), hand = joint(figure, "RightHand");
    if (!(upper instanceof TransformNode) || !(lower instanceof TransformNode) || !(hand instanceof TransformNode)) return;
    [upper, lower, hand].forEach(n => n.computeWorldMatrix(true));
    const world = figure.root.computeWorldMatrix(true);
    const shoulder = Vector3.TransformCoordinates(upper.getAbsolutePosition(), Matrix.Invert(world));
    const elbow = Vector3.TransformCoordinates(shoulder.add(new Vector3(0, -0.15, -0.22)), world);
    const wrist = Vector3.TransformCoordinates(shoulder.add(new Vector3(0, -0.05, -0.43)), world);
    aimJoint(upper, lower, elbow, amount); aimJoint(lower, hand, wrist, amount);
    if (card) {
      card.parent = hand; card.position.set(0, 0, 0);
      card.scaling.setAll(1 / Math.abs(figure.model.fit.scaling.y));
      card.rotationQuaternion = hand.absoluteRotationQuaternion.conjugate();
    }
  };

  const frameStep = (t: number) => {
    const f = frameAt(plan, t);
    const { cam, vehicle: v } = f;
    const boarding = planeModel && (f.stage === "boarding" || f.stage === "deplane" || f.stage === "welcome");
    const modelInView = planeModel && f.stage !== "airport";
    const aspect = stage.engine.getRenderWidth() / stage.engine.getRenderHeight();
    const cameraX = ground ? groundCameraX(f, aspect) : cam.x + (boarding ? 4 : 0);
    const cameraY = cam.y + (modelInView ? 1.5 : 0);
    const cameraDistance = cam.d + (modelInView ? boarding ? 5 : 12 : 0);
    stage.aim({ position: [cameraX, cameraY, -cameraDistance], target: [cameraX, cameraY, 100] });
    const col = coloursAt(plan, cam.x);
    scene.clearColor.set(...(hex(col.skyTop).asArray() as [number, number, number]), 1);
    scene.fogColor = hex(col.skyBottom);
    const h = SKY_HEIGHT / BANDS;
    bandMats.forEach((m, i) => { m.emissiveColor = hex(mixColour(col.skyBottom, col.skyTop, Math.pow(i / (BANDS - 1), 0.75))); });
    lowMats.forEach((m, i) => { m.emissiveColor = hex(tone(mixColour(col.skyBottom, "#ffffff", 0.6 * (i / (lowMats.length - 1))), plan.dim)); });
    lowBands.forEach((b, i) => { b.scaling.y = 14; b.position.set(cam.x, cam.y - (i + 0.5) * 12 + 1, 255); });
    bands.forEach((b, i) => { b.scaling.y = h + 0.5; b.position.set(cam.x, cam.y + (i + 0.5) * h - 1, 260); });

    for (const p of plan.props) {
      const reach = 70 + p.z * 0.9 + extent(p.kind);
      const px = propX(plan, p, cam.x);
      const near = Math.abs(px - cam.x) < reach;
      const w = p.span >= 0 ? weightAt(plan, p.span, p.x) : 1;
      if (!near || w < 0.03) { built.get(p)?.setEnabled(false); continue; }
      const root = ensure(p);
      root.setEnabled(true);
      root.position.x = px;
      root.scaling.setAll(p.scale * (p.span >= 0 ? 0.35 + 0.65 * w : 1));
    }

    if (ground) {
      ground.root.position.set(v.x, v.y, 0);
      ground.wheels.forEach(w => { w.rotation.x = -v.spin; });
      if (bus) bus.door.rotation.y = -1.6 * v.door;
      void wheelR;
    }
    if (planeRig) {
      planeRig.pivot.position.set(v.x - 0.5, v.y, 0);
      planeRig.pivot.rotation.z = v.pitch;
      planeRig.gear.setEnabled(!planeModel && v.gearDown > 0.5);
      planeRig.doorOpen.setEnabled(v.door > 0.05); planeRig.doorShut.setEnabled(!planeModel && v.door <= 0.05);
      planeRig.stairs.setEnabled(v.stairs > 0.02);
      planeRig.stairs.scaling.y = Math.max(0.01, v.stairs);
    }

    const pl = f.player;
    if (player) {
      if (pl && pl.visible) {
        const pose: Pose = { x: pl.x, y: pl.y, z: 0, heading: pl.heading, sit: pl.sit, gait: pl.gait, stride: pl.stride, type: pl.type, visible: true };
        const legs = legAngles(pose), arms = armAngles(pose, t);
        const z = pl.z !== undefined ? pl.z : (pl.sit > 0 ? mix(-1.4, SEAT_Z, pl.sit) : air ? -2.3 : -1.4);
        const position = boarding ? modelBoardingPosition(pl.x, pl.y, v.x) : { x: pl.x, y: pl.y, z };
        player.root.position.set(position.x, position.y, position.z);
        player.root.rotation.y = pl.heading;
        player.rig.hips.forEach((hp, i) => { hp.rotation.x = legs.hips[i]!; });
        player.rig.knees.forEach((k, i) => { k.rotation.x = legs.knees[i]!; });
        player.rig.shoulders[0]!.rotation.x = arms[0];
        player.rig.shoulders[1]!.rotation.x = mix(arms[1], 1.7, pl.pass);
        player.rig.elbows[1]!.rotation.x = 0.45 * pl.pass;
        card?.setEnabled(pl.pass > 0.05);
        player.setAlpha(pl.alpha);
        if (playerModel) {
          const hands = car ? [new Vector3(v.x + 0.28, v.y + 1.02, SEAT_Z - 0.14), new Vector3(v.x + 0.28, v.y + 1.02, SEAT_Z + 0.14)] as const : undefined;
          playerModel.apply(pose, t, hands);
          showPass(playerModel, pl.pass);
          playerModel.setAlpha(pl.alpha);
        }
      } else { player.setAlpha(0); playerModel?.setAlpha(0); }
    }
    if (busDriver) {
      const seatedLegs = legAngles({ x: 0, y: 0, z: 0, heading: -Math.PI / 2, sit: 1, gait: 0, stride: 0, type: 1, visible: true });
      busDriver.root.position.set(v.x + BUS_DRIVER_X, v.y + BUS_DRIVER_Y, BUS_DRIVER_Z);
      busDriver.root.rotation.y = -Math.PI / 2;
      busDriver.rig.hips.forEach((hp, i) => { hp.rotation.x = seatedLegs.hips[i]!; });
      busDriver.rig.knees.forEach((k, i) => { k.rotation.x = seatedLegs.knees[i]!; });
      busDriver.rig.shoulders.forEach(s => { s.rotation.x = 0.5; });
      busDriver.rig.elbows.forEach(e => { e.rotation.x = 0.4; });
    }
    if (crew) {
      const hs = f.hostess;
      if (hs) {
        const position = planeModel ? modelBoardingPosition(hs.x, hs.y, v.x) : { x: hs.x, y: hs.y, z: -2.3 };
        crew.root.position.set(position.x, position.y, position.z); crew.root.rotation.y = hs.heading; crew.setAlpha(hs.alpha);
        crewModel?.apply({ x: 0, y: 0, z: 0, heading: 0, sit: 0, gait: 0, stride: 0, type: 0, visible: true }, t);
        crewModel?.setAlpha(hs.alpha);
      } else { crew.setAlpha(0); crewModel?.setAlpha(0); }
    }
    driver.step(f);
  };

  // Report failures once so the caller can offer the functional journey handoff.
  let faulted = false;
  const fault = (why: unknown) => {
    if (faulted) return;
    faulted = true;
    console.error("The 3D journey scene broke.", why);
    options.onFault?.(why instanceof Error ? why.message : String(why));
  };
  const update = (t: number) => { if (faulted) return; try { frameStep(t); } catch (e) { fault(e); } };
  const render = scene.render.bind(scene);
  scene.render = (...args: Parameters<typeof render>) => { if (faulted) return; try { render(...args); } catch (e) { fault(e); } };
  const contextLost = (e: Event) => { e.preventDefault(); fault("the WebGL context was lost"); };
  canvas.addEventListener("webglcontextlost", contextLost);

  const handle = stage.run({ end: plan.end, update, onSlow: options.onSlow });
  return {
    scene, plan, duration: plan.end,
    now: driver.now,
    start: (begin = options.reducedMotion ? plan.settle : 0) => handle.play({ end: plan.end, update }, begin),
    skip: handle.skip,
    seek(seconds) { stage.engine.stopRenderLoop(); update(seconds); scene.render(); },
    dispose() {
      options.signal?.removeEventListener("abort", abort);
      canvas.removeEventListener("webglcontextlost", contextLost);
      handle.dispose();
    }
  };
  } catch (error) {
    options.signal?.removeEventListener("abort", abort);
    stage.engine.dispose();
    throw error;
  }
}
