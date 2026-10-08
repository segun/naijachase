// The 2D renderer for the witness scene: the same market, the same people and the same timeline as chase3d-witness.ts, drawn with the
// plain Canvas 2D API. It needs no WebGL and no download beyond this file, so it runs where the 3D scene cannot (no WebGL, Save-Data, a
// slow network, low memory, a low frame rate). It reads the same pure rules (witness-scene.ts) and layout (market-layout.ts), so the
// two renderers always show the same events: they are renderers, not separate games.
//
// How it draws: every object is a flat picture that always faces the camera (a billboard), placed with a real perspective projection
// of the same camera path the 3D scene uses, and the pictures are painted from the back to the front.
import { FOV, PALETTES, armAngles, legAngles, lightAt, type CameraShot, type Pose, type Vec } from "../shared/scene-core.ts";
import type { AvatarPreset } from "../../avatar/avatar-model.ts";
import { BANNER, PALMS, PRINTS, SHOPPERS, STALLS, type StallSpec, crowdSize, lookOf, walkerAt } from "./market-layout.ts";
import { hashOf } from "./venue-recipes.ts";
import { createDriver, fitShot, type WitnessHandle, type WitnessOptions } from "./witness-driver.ts";
import { ROAD_Z, VEHICLE_FROM_X, WITNESS, busDoorAt, cameraAt, listenLean, playerPoseAt, vehicleXAt, witnessAt } from "./witness-scene.ts";

type Ctx = CanvasRenderingContext2D;
type Cam = { pos: Vec; r: Vec; u: Vec; f: Vec; focal: number; cx: number; cy: number };
type Proj = { x: number; y: number; /** Pixels per metre at this depth. */ k: number; z: number };
type Item = { z: number; draw: () => void };

const NEAR = 0.3;
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec): Vec => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** A pinhole camera looking from `shot.position` at `shot.target` (the engine's left-handed axes: x right, y up, z forward). */
function makeCam(shot: CameraShot, w: number, h: number): Cam {
  const f = norm(sub(shot.target, shot.position));
  const r = norm(cross([0, 1, 0], f));
  return { pos: shot.position, f, r, u: cross(f, r), focal: h / 2 / Math.tan(FOV / 2), cx: w / 2, cy: h / 2 };
}
function project(c: Cam, x: number, y: number, z: number): Proj {
  const v = sub([x, y, z], c.pos);
  const zc = Math.max(NEAR, dot(v, c.f));
  const k = c.focal / zc;
  return { x: c.cx + dot(v, c.r) * k, y: c.cy - dot(v, c.u) * k, k, z: zc };
}
/** A filled polygon in the world, clipped to the front of the camera so a quad that passes behind it still draws. */
function polygon(g: Ctx, c: Cam, points: readonly Vec[], fill: string) {
  const cam = points.map(p => { const v = sub(p, c.pos); return [dot(v, c.r), dot(v, c.u), dot(v, c.f)] as Vec; });
  const out: Vec[] = [];
  cam.forEach((a, i) => {
    const b = cam[(i + 1) % cam.length]!;
    if (a[2] >= NEAR) out.push(a);
    if ((a[2] >= NEAR) !== (b[2] >= NEAR)) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
  });
  if (out.length < 3) return;
  g.beginPath();
  out.forEach((p, i) => { const k = c.focal / p[2]; const x = c.cx + p[0] * k, y = c.cy - p[1] * k; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  g.closePath();
  g.fillStyle = fill; g.fill();
}

/** Metres on a billboard whose feet are at `foot`: x to the right, y up. */
const px = (o: Proj, x: number) => o.x + x * o.k;
const py = (o: Proj, y: number) => o.y - y * o.k;
function box(g: Ctx, o: Proj, x: number, y: number, w: number, h: number, fill: string) {
  g.fillStyle = fill; g.fillRect(px(o, x), py(o, y + h), w * o.k, h * o.k);
}
function disc(g: Ctx, o: Proj, x: number, y: number, r: number, fill: string, sx = 1, sy = 1) {
  g.beginPath(); g.ellipse(px(o, x), py(o, y), r * o.k * sx, r * o.k * sy, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
}
function stroke(g: Ctx, o: Proj, x1: number, y1: number, x2: number, y2: number, width: number, colour: string) {
  g.beginPath(); g.moveTo(px(o, x1), py(o, y1)); g.lineTo(px(o, x2), py(o, y2));
  g.lineWidth = width * o.k; g.lineCap = "round"; g.strokeStyle = colour; g.stroke();
}
const mixHex = (a: string, b: string, k: number) => {
  const p = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map(i => Math.round(p(a, i) + (p(b, i) - p(a, i)) * k)).join(",")})`;
};

// ---- People ----

type Figure = {
  skin: string; hair: string; hairStyle: string; top: string; trim: string; belt: string; trousers: string;
  /** A wrapper skirt (market women) instead of legs. */
  skirt?: readonly [string, string, string];
  tie?: string; cap?: string; basket?: { basket: string; goods: string };
  heading: number; hips: readonly [number, number]; knees: readonly [number, number]; arms: readonly [number, number];
  wave?: number; sit?: number; mouth?: number; lean?: number; lift?: number; alpha?: number; talker?: boolean;
};

function figure(g: Ctx, o: Proj, f: Figure) {
  const facingX = -Math.sin(f.heading); // which way they face along x
  const face = Math.cos(f.heading); // 1 towards the camera, -1 away
  const s = Math.min(1, Math.abs(Math.sin(f.heading)));
  const wf = 1 - 0.5 * s;
  const sgn = face >= 0 ? 1 : -1;
  const dir = facingX >= 0 ? 1 : -1;
  const lift = f.lift ?? 0;
  const lean = (f.lean ?? 0) * 0.6;
  g.save();
  g.globalAlpha = f.alpha ?? 1;

  const leg = (index: number) => {
    const side = index === 0 ? -1 : 1;
    const hx = side * 0.11 * (1 - s) * sgn, hy = 0.84 + lift;
    const a = f.hips[index]!, b = a + f.knees[index]!;
    const kx = hx + dir * Math.sin(a) * 0.42 * s, ky = hy - Math.cos(a) * 0.42;
    const fx = kx + dir * Math.sin(b) * 0.42 * s, fy = ky - Math.cos(b) * 0.42;
    stroke(g, o, hx, hy, kx, ky, 0.18, f.trousers);
    stroke(g, o, kx, ky, fx, fy, 0.16, f.trousers);
    disc(g, o, fx + dir * 0.04 * s, fy - 0.02, 0.09, f.hair, 1.3, 0.7);
  };
  const arm = (index: number) => {
    const side = (index === 0 ? -1 : 1) * sgn;
    const a = f.arms[index]!;
    const shoulderX = side * (0.3 * wf) * (1 - 0.6 * s), shoulderY = 1.5 + lift;
    const out = (f.wave && index === 1 ? f.wave : 0) + a * 0.9;
    const hx = shoulderX + dir * Math.sin(a) * 0.62 * s + side * Math.sin(out) * 0.62 * (1 - s);
    const hy = shoulderY - Math.cos(Math.min(1.9, Math.abs(a) + (index === 1 ? Math.abs(f.wave ?? 0) : 0))) * 0.62;
    stroke(g, o, shoulderX, shoulderY, hx, hy, 0.15, f.top);
    disc(g, o, hx, hy - 0.03, 0.075, f.skin);
  };

  // Far arm and legs first, then the body, then the near arm.
  if (s > 0.5) arm(dir > 0 ? 0 : 1); else arm(0);
  if (f.skirt) {
    const [base, accent] = f.skirt;
    g.beginPath(); g.moveTo(px(o, -0.17), py(o, 0.9)); g.lineTo(px(o, 0.17), py(o, 0.9)); g.lineTo(px(o, 0.27 * (1 - 0.3 * s)), py(o, 0)); g.lineTo(px(o, -0.27 * (1 - 0.3 * s)), py(o, 0)); g.closePath();
    g.fillStyle = base; g.fill();
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) disc(g, o, (col - 1) * 0.11 + (row % 2) * 0.05, 0.12 + row * 0.19, 0.035, accent);
  } else { leg(0); leg(1); }
  // Jacket: tapered, with a lighter front panel, an accent belt and a collar.
  const top = 1.56 + lift, bottom = 0.84 + lift, shoulderW = 0.56 * wf, waistW = 0.46 * wf;
  g.beginPath();
  g.moveTo(px(o, -shoulderW / 2 + lean), py(o, top)); g.lineTo(px(o, shoulderW / 2 + lean), py(o, top)); g.lineTo(px(o, waistW / 2), py(o, bottom)); g.lineTo(px(o, -waistW / 2), py(o, bottom)); g.closePath();
  g.fillStyle = f.top; g.fill();
  if (face > 0.5 && !f.skirt) box(g, o, -0.05, bottom + 0.1, 0.1, 0.52, f.trim);
  if (!f.skirt) box(g, o, -waistW / 2, bottom, waistW, 0.07, f.belt);
  box(g, o, -0.1 * wf + lean * 0.5, top - 0.02, 0.2 * wf, 0.07, f.trim);
  if (s > 0.5) arm(dir > 0 ? 1 : 0); else arm(1);

  // Head: skin, hair or head-tie, and a face when they face the camera.
  const hx = lean * 1.1, hy = 1.72 + lift;
  disc(g, o, hx, hy, 0.27, f.skin);
  if (f.tie) { disc(g, o, hx, hy + 0.1, 0.3, f.tie, 1, 0.7); disc(g, o, hx - 0.02, hy + 0.24, 0.12, f.tie); }
  else if (f.cap) box(g, o, hx - 0.2, hy + 0.17, 0.4, 0.1, f.cap);
  else {
    g.beginPath(); g.ellipse(px(o, hx), py(o, hy + 0.01), 0.285 * o.k, 0.275 * o.k, 0, face < -0.5 ? 0 : Math.PI, Math.PI * 2); g.closePath();
    g.fillStyle = f.hair; g.fill();
    if (f.hairStyle === "braided_bun") disc(g, o, hx, hy + 0.34, 0.11, f.hair);
    if (f.hairStyle === "bob" || f.hairStyle === "shoulder_twists") { box(g, o, hx - 0.31, hy - 0.22, 0.1, 0.4, f.hair); box(g, o, hx + 0.21, hy - 0.22, 0.1, 0.4, f.hair); }
    if (f.hairStyle === "head_wrap") box(g, o, hx - 0.28, hy + 0.05, 0.56, 0.06, f.trim);
  }
  if (f.basket) { box(g, o, hx - 0.2, hy + 0.27, 0.4, 0.1, f.basket.basket); disc(g, o, hx, hy + 0.4, 0.2, f.basket.goods, 1, 0.55); }
  if (face > 0.5) {
    disc(g, o, hx - 0.1, hy + 0.03, 0.028, "#120c0a", 1, 1.25); disc(g, o, hx + 0.1, hy + 0.03, 0.028, "#120c0a", 1, 1.25);
    disc(g, o, hx, hy - 0.11, 0.05, "#4a1414", 1, Math.max(0.15, 0.1 + (f.mouth ?? 0) * 1.4));
  } else if (face > -0.5) {
    disc(g, o, hx + dir * 0.14, hy + 0.03, 0.026, "#120c0a", 1, 1.25);
    disc(g, o, hx + dir * 0.2, hy - 0.11, 0.035, "#4a1414", 1, Math.max(0.15, 0.1 + (f.mouth ?? 0) * 1.4));
  }
  g.restore();
}

const fromPreset = (p: AvatarPreset): Pick<Figure, "skin" | "hair" | "hairStyle" | "top" | "trim" | "belt" | "trousers"> =>
  ({ skin: p.skin_color, hair: p.hair_color, hairStyle: p.hair_style, top: p.uniform_primary, trim: p.uniform_secondary, belt: p.uniform_accent, trousers: p.uniform_primary });

// ---- The scene ----

export async function createWitnessScene2D(canvas: HTMLCanvasElement, options: WitnessOptions): Promise<WitnessHandle> {
  const g = canvas.getContext("2d");
  if (!g) throw new Error("The 2D canvas is not available");
  const driver = createDriver(options);
  const { plan, timings, words, pages } = driver;
  const palette = PALETTES[lightAt(options.hour)];
  const night = palette.stars || palette.lamp > 0.5;
  const shade = palette.lamp > 0.9 ? 0.4 : palette.lamp > 0.3 ? 0.2 : 0;
  const count = crowdSize(options.quality === "light");
  const r = (() => { let s = (hashOf(options.venueName) % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  const skyline = Array.from({ length: 26 }, (_, i) => ({ x: -48 + i * 3.8 + r() * 2, w: 3 + r() * 5, h: 3 + r() * 8, tone: ["#8c8579", "#a8a091", "#7a8a8f", "#b3a58a"][Math.floor(r() * 4)]! }));
  const stars = Array.from({ length: 120 }, () => [r(), r() * 0.8, 0.4 + r() * 0.5] as const);
  const prints = PRINTS;
  const wanted = (look: AvatarPreset | null | undefined) => (look ? fromPreset(look) : null);
  const playerLook = wanted(options.preset);
  const witnessLook = fromPreset(driver.witness);

  let W = 0, H = 0, dpr = 1, lastT = 0;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, options.quality === "light" ? 1 : 2);
    W = Math.max(1, canvas.clientWidth); H = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  };
  resize();

  const stallItems = (c: Cam, spec: StallSpec, items: Item[]) => {
    const { x, z, w } = spec;
    const table = project(c, x, 0, z);
    items.push({ z: table.z + 0.85, draw: () => { const o = project(c, x, 0, z + 0.85); if (spec.tarp) box(g, o, -w / 2, 0.8, w, 1.7, spec.tarp); for (const sx of [-1, 1]) box(g, o, sx * (w / 2 + 0.05) - 0.035, 0, 0.07, 2.6, "#5a3d22"); } });
    if (spec.frontPoles) items.push({ z: project(c, x, 0, z - 0.8).z, draw: () => { const o = project(c, x, 0, z - 0.8); for (const sx of [-1, 1]) box(g, o, sx * (w / 2 + 0.05) - 0.035, 0, 0.07, 2.6, "#5a3d22"); } });
    items.push({ z: table.z, draw: () => {
      const o = project(c, x, 0, z);
      box(g, o, -w / 2, 0, w, 0.78, "#7a5430"); box(g, o, -w / 2 - 0.03, 0.78, w + 0.06, 0.05, "#d9cdb0");
      const top = 0.83;
      if (spec.ware === "tomatoes") for (let m = 0; m < 3; m++) for (const [dx, dy, col] of [[-0.14, 0, 0], [0, 0, 0], [0.14, 0, 0], [-0.07, 0.12, 0], [0.07, 0.12, 0], [0, 0.24, 0]] as const) disc(g, o, -w / 3 + (m * w) / 3 + dx, top + 0.07 + dy, 0.075, m === 1 ? "#d9822b" : col === 0 ? "#c0392b" : "#c0392b");
      else if (spec.ware === "fruit") for (let m = 0; m < 4; m++) for (const [dx, dy] of [[-0.12, 0], [0.12, 0], [0, 0.13], [0, 0.26]] as const) disc(g, o, -w / 2 + 0.4 + (m * (w - 0.8)) / 3 + dx, top + 0.07 + dy, 0.07, ["#e8a02b", "#8fbf3a", "#e8a02b", "#c0392b"][m]!);
      else if (spec.ware === "yams") for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) box(g, o, -w / 2 + 0.3 + i * 0.26 + row * 0.13, top + row * 0.12, 0.5, 0.12, "#8a5a2f");
      else {
        for (let i = 0; i < 6; i++) box(g, o, -w / 2 + 0.2 + i * ((w - 0.6) / 5), top, 0.2, 0.5, ["#2e6f8f", "#b5483a", "#2f8f5b", "#d9822b", "#7a4aa0", "#f2c14e"][i]!);
      }
    } });
    items.push({ z: project(c, x, 0, z - 0.8).z, draw: () => {
      // The awning slopes down towards the front, drawn in strips so it keeps its stripes in perspective.
      const half = (w + 0.4) / 2, strips = 12;
      for (let i = 0; i < strips; i++) {
        const x0 = x - half + (i * half * 2) / strips, x1 = x - half + ((i + 1) * half * 2) / strips;
        polygon(g, c, [[x0, 2.52, z - 0.8], [x1, 2.52, z - 0.8], [x1, 2.72, z + 1.2], [x0, 2.72, z + 1.2]], spec.stripes[i % 2]!);
      }
      if (palette.lamp > 0.3) for (let i = 0; i <= 5; i++) { const o = project(c, x - w / 2 + (i * w) / 5, 2.5, z - 0.78); disc(g, o, 0, 0, 0.06, "#fff1c4"); g.globalAlpha = 0.25; disc(g, o, 0, 0, 0.18, "#ffe9a8"); g.globalAlpha = 1; }
    } });
  };

  const paint = (t: number) => {
    lastT = t;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = makeCam(fitShot(cameraAt(plan, t), W / H), W, H);
    const flat = norm([c.f[0], 0, c.f[2]]);
    const horizon = Math.min(H, Math.max(0, project(c, c.pos[0] + flat[0] * 400, 0, c.pos[2] + flat[2] * 400).y));

    // Sky, sun or moon, stars and a haze at the horizon.
    const sky = g.createLinearGradient(0, 0, 0, Math.max(1, horizon));
    sky.addColorStop(0, palette.skyTop); sky.addColorStop(1, palette.skyBottom);
    g.fillStyle = sky; g.fillRect(0, 0, W, horizon);
    if (palette.stars) { for (const [sx, sy, a] of stars) { g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(sx * W, sy * horizon, 2, 2); } }
    const orb = project(c, c.pos[0] - 40, 60, c.pos[2] + 160);
    if (orb.x > -50 && orb.x < W + 50) disc(g, { x: orb.x, y: Math.min(orb.y, horizon - 30), k: 1, z: 1 }, 0, 0, palette.orb === "moon" ? 18 : 26, palette.orbColor);
    // Ground: red earth with the tarred lane, a kerb and the lane's dashes.
    g.fillStyle = "#a35f38"; g.fillRect(0, horizon, W, H - horizon);
    for (const b of skyline) { const o = project(c, b.x, 0, 40); box(g, o, -b.w / 2, 0, b.w, b.h, mixHex(b.tone, palette.skyBottom, 0.45)); }
    const haze = g.createLinearGradient(0, horizon - 30, 0, horizon + 50);
    haze.addColorStop(0, "rgba(255,255,255,0)"); haze.addColorStop(0.5, `${palette.skyBottom}99`); haze.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = haze; g.fillRect(0, horizon - 30, W, 80);
    const strip = (z0: number, z1: number, fill: string) => polygon(g, c, [[-60, 0, z0], [60, 0, z0], [60, 0, z1], [-60, 0, z1]], fill);
    strip(ROAD_Z - 1.7, ROAD_Z + 1.7, "#3a3b40"); strip(ROAD_Z + 1.7, ROAD_Z + 1.85, "#9b9486");
    for (let dx = -56; dx < 56; dx += 8) polygon(g, c, [[dx, 0.01, ROAD_Z - 0.07], [dx + 4, 0.01, ROAD_Z - 0.07], [dx + 4, 0.01, ROAD_Z + 0.07], [dx, 0.01, ROAD_Z + 0.07]], "#e8e2cf");

    const items: Item[] = [];
    for (const [x, z, h] of PALMS) items.push({ z: project(c, x, 0, z).z, draw: () => {
      const o = project(c, x, 0, z);
      stroke(g, o, 0, 0, (x % 3) * 0.1, h, 0.35, "#6b4a2b");
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; stroke(g, o, (x % 3) * 0.1, h, Math.cos(a) * 1.7, h - 0.5 + Math.sin(a) * 0.35, 0.18, "#2f6b3a"); }
    } });
    STALLS.forEach(spec => stallItems(c, spec, items));
    items.push({ z: project(c, BANNER.x, 0, BANNER.z).z, draw: () => {
      const o = project(c, BANNER.x, 0, BANNER.z);
      for (const sx of [-4.1 - BANNER.x, 3.7 - BANNER.x]) box(g, o, sx - 0.07, 0, 0.14, 4.1, "#5a3d22");
      box(g, o, -BANNER.w / 2, BANNER.y - BANNER.h / 2, BANNER.w, BANNER.h, "#176b4d");
      g.strokeStyle = "#f2c14e"; g.lineWidth = Math.max(1, 0.05 * o.k); g.strokeRect(px(o, -BANNER.w / 2 + 0.07), py(o, BANNER.y + BANNER.h / 2 - 0.07), (BANNER.w - 0.14) * o.k, (BANNER.h - 0.14) * o.k);
      const name = options.venueName.toUpperCase();
      let size = 0.62 * o.k;
      g.font = `bold ${size}px 'Arial Black', Impact, Arial, sans-serif`;
      while (size > 8 && g.measureText(name).width > (BANNER.w - 0.6) * o.k) { size -= 2; g.font = `bold ${size}px 'Arial Black', Impact, Arial, sans-serif`; }
      g.fillStyle = "#f6f1e1"; g.textBaseline = "middle"; g.fillText(name, px(o, 0) - g.measureText(name).width / 2, py(o, BANNER.y));
    } });

    // Passers-by.
    for (let i = 0; i < count; i++) {
      const w = walkerAt(i, count, t), look = lookOf(100 + i);
      items.push({ z: project(c, w.x, 0, w.z).z, draw: () => figure(g, project(c, w.x, 0, w.z), crowdFigure(look, Math.atan2(-w.dir, 0), w.swing, w.bounce, prints)) });
    }
    SHOPPERS.forEach(([x, z, turn], i) => {
      const look = lookOf(300 + i);
      items.push({ z: project(c, x, 0, z).z, draw: () => figure(g, project(c, x, 0, z), crowdFigure(look, Math.PI + turn, 0, 0, prints)) });
    });

    // The vehicle, the player and the witness.
    const vx = vehicleXAt(plan, t);
    const spin = (VEHICLE_FROM_X - vx) / (options.arrival === "drive" ? 0.31 : 0.38);
    const near = ROAD_Z - (options.arrival === "drive" ? 0.8 : 1);
    items.push({ z: project(c, vx, 0, near).z, draw: () => (options.arrival === "drive" ? drawCar(g, project(c, vx, 0, near), spin) : drawBus(g, project(c, vx, 0, near), spin, busDoorAt(plan, t))) });
    const pose = playerPoseAt(plan, t);
    if (playerLook && pose.visible && pose.alpha > 0.01) {
      const legs = legAngles(pose), arms = armAngles(pose, t);
      items.push({ z: project(c, pose.x, 0, pose.z).z, draw: () => figure(g, project(c, pose.x, 0, pose.z), { ...playerLook, heading: pose.heading, hips: legs.hips, knees: legs.knees, arms, lift: pose.y, lean: listenLean(plan, t), alpha: pose.alpha }) });
    }
    const w = witnessAt(plan, timings, t);
    items.push({ z: project(c, WITNESS.x, 0, WITNESS.z).z, draw: () => figure(g, project(c, WITNESS.x, 0, WITNESS.z), { ...witnessLook, heading: w.heading, hips: [0, 0], knees: [0, 0], arms: w.arms, wave: w.wave, mouth: w.mouth, lean: w.lean, lift: w.bob }) });

    items.sort((a, b) => b.z - a.z).forEach(i => i.draw());
    if (shade > 0) { g.fillStyle = `rgba(6,12,40,${shade})`; g.fillRect(0, 0, W, H); }
    driver.step(t, pose as Pose);
  };

  let faulted = false;
  const draw = (t: number) => {
    if (faulted) return;
    try { paint(t); } catch (e) {
      faulted = true;
      console.error("The 2D witness scene broke.", e);
      options.onFault?.(e instanceof Error ? e.message : String(e));
    }
  };

  // ---- The clock ----
  let raf = 0, started = -1, from = 0, skipped = false, running = false;
  let done: (() => void) | undefined;
  const samples: number[] = [];
  let frames = 0, sampleAt = 0;
  const frame = (now: number) => {
    if (started < 0) { started = now - from * 1000; sampleAt = now; }
    const t = skipped ? plan.end : Math.min(plan.end, (now - started) / 1000);
    draw(t);
    frames++;
    if (now - sampleAt > 1200) {
      samples.push((frames * 1000) / (now - sampleAt)); frames = 0; sampleAt = now;
      if (samples.length >= 3 && samples.slice(-3).reduce((a, b) => a + b, 0) / 3 < 20) { samples.length = 0; options.onSlow?.(); }
    }
    if (t >= plan.end) { running = false; done?.(); done = undefined; return; }
    raf = requestAnimationFrame(frame);
  };
  const observer = new ResizeObserver(() => { resize(); if (!running) draw(lastT); });
  observer.observe(canvas);

  return {
    words, pages, duration: plan.end,
    now: () => lastT,
    start(begin = options.reducedMotion ? plan.walkEnd : 0) {
      return new Promise<void>(resolve => { done = resolve; from = begin; started = -1; skipped = false; running = true; raf = requestAnimationFrame(frame); });
    },
    skip() { skipped = true; },
    seek(seconds) { cancelAnimationFrame(raf); running = false; draw(seconds); },
    dispose() { cancelAnimationFrame(raf); observer.disconnect(); driver.dispose(); done?.(); }
  };
}

function crowdFigure(look: ReturnType<typeof lookOf>, heading: number, swing: number, bounce: number, prints: readonly (readonly [string, string, string])[]): Figure {
  return {
    skin: look.skin, hair: "#15100d", hairStyle: "close_crop", top: look.top, trim: look.top, belt: look.top, trousers: look.bottom,
    skirt: look.woman ? prints[look.print]! : undefined, tie: look.woman ? look.tie : undefined, cap: look.woman ? undefined : look.tie,
    basket: look.basket ? { basket: look.basket, goods: look.goods } : undefined,
    heading, hips: [-swing, swing], knees: [0, 0], arms: [swing, -swing], lift: bounce
  };
}

/** The open-top runabout, side on, facing left. */
function drawCar(g: Ctx, o: Proj, spin: number) {
  box(g, o, -1.8, 0.22, 3.6, 0.62, "#f2c14e");
  box(g, o, -1.8, 0.22, 1.2, 0.62, "#e0b23a"); box(g, o, -1.5, 0.84, 0.9, 0.03, "#15191c");
  box(g, o, -1.82, 0.3, 0.1, 0.2, "#15191c"); box(g, o, 1.72, 0.3, 0.1, 0.2, "#15191c");
  box(g, o, 1.78, 0.5, 0.05, 0.14, "#d63a2e"); disc(g, o, -1.76, 0.58, 0.1, "#fff4cf");
  box(g, o, 0.2, 0.84, 0.18, 0.4, "#3b2a22");
  g.beginPath(); g.moveTo(px(o, -0.55), py(o, 0.84)); g.lineTo(px(o, -0.25), py(o, 1.3)); g.lineTo(px(o, -0.18), py(o, 1.3)); g.lineTo(px(o, -0.45), py(o, 0.84)); g.closePath();
  g.fillStyle = "rgba(159,211,240,.55)"; g.fill();
  for (const wx of [-1.15, 1.15]) wheel(g, o, wx, 0.31, 0.31, spin);
}
/** The shared-ride minibus, side on, facing left, with its rear door opening at the right-hand end. */
function drawBus(g: Ctx, o: Proj, spin: number, door: number) {
  box(g, o, -2.5, 0.45, 5, 1.95, "#f2b705"); box(g, o, -2.5, 1.0, 5, 0.2, "#15191c");
  for (let i = 0; i < 4; i++) box(g, o, -2.2 + i * 1.1, 1.55, 0.95, 0.6, "#27414f");
  box(g, o, -2.5, 2.4, 5, 0.05, "#2b2f33"); box(g, o, -2.15, 2.45, 4.2, 0.05, "#2b2f33");
  disc(g, o, -2.45, 0.85, 0.12, "#fff4cf"); box(g, o, 2.42, 0.7, 0.08, 0.18, "#d63a2e");
  if (door > 0.02) { box(g, o, 2.3, 0.45, 0.2, 1.5, "#15191c"); g.globalAlpha = door; box(g, o, 2.5, 0.45, 0.5 * door, 1.5, "#e0a800"); g.globalAlpha = 1; }
  for (const wx of [-1.6, 1.6]) wheel(g, o, wx, 0.38, 0.38, spin);
}
function wheel(g: Ctx, o: Proj, x: number, y: number, r: number, spin: number) {
  disc(g, o, x, y, r, "#15191c"); disc(g, o, x, y, r * 0.5, "#aeb6bb");
  for (let i = 0; i < 3; i++) { const a = spin + (i * Math.PI) / 3; stroke(g, o, x - Math.cos(a) * r * 0.45, y - Math.sin(a) * r * 0.45, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, 0.04, "#5b6368"); }
}
