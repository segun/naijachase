// Drawing tools for the 2D witness renderer: a pinhole camera that projects the same world the 3D scene uses, filled polygons clipped to the
// front of the camera, billboard shapes sized in metres, people, wheels. Scenery sets (witness-2d-market.ts and the others) are built from
// these. Plain Canvas 2D: no graphics library, so it runs where WebGL does not.
import { FOV, type CameraShot, type Vec } from "../shared/scene-core.ts";
import type { AvatarPreset } from "../../avatar/avatar-model.ts";
import { lookOf } from "./market-layout.ts";

export type Ctx = CanvasRenderingContext2D;
export type Cam = { pos: Vec; r: Vec; u: Vec; f: Vec; focal: number; cx: number; cy: number };
export type Proj = { x: number; y: number; /** Pixels per metre at this depth. */ k: number; z: number };
export type Item = { z: number; draw: () => void };

export const NEAR = 0.3;
export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: Vec): Vec => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** A pinhole camera looking from `shot.position` at `shot.target` (the engine's left-handed axes: x right, y up, z forward). */
export function makeCam(shot: CameraShot, w: number, h: number): Cam {
  const f = norm(sub(shot.target, shot.position));
  const r = norm(cross([0, 1, 0], f));
  return { pos: shot.position, f, r, u: cross(f, r), focal: h / 2 / Math.tan(FOV / 2), cx: w / 2, cy: h / 2 };
}
export function project(c: Cam, x: number, y: number, z: number): Proj {
  const v = sub([x, y, z], c.pos);
  const zc = Math.max(NEAR, dot(v, c.f));
  const k = c.focal / zc;
  return { x: c.cx + dot(v, c.r) * k, y: c.cy - dot(v, c.u) * k, k, z: zc };
}
/** A filled polygon in the world, clipped to the front of the camera so a quad that passes behind it still draws. */
export function polygon(g: Ctx, c: Cam, points: readonly Vec[], fill: string) {
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
export const px = (o: Proj, x: number) => o.x + x * o.k;
export const py = (o: Proj, y: number) => o.y - y * o.k;
export function box(g: Ctx, o: Proj, x: number, y: number, w: number, h: number, fill: string) {
  g.fillStyle = fill; g.fillRect(px(o, x), py(o, y + h), w * o.k, h * o.k);
}
export function disc(g: Ctx, o: Proj, x: number, y: number, r: number, fill: string, sx = 1, sy = 1) {
  g.beginPath(); g.ellipse(px(o, x), py(o, y), r * o.k * sx, r * o.k * sy, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
}
export function stroke(g: Ctx, o: Proj, x1: number, y1: number, x2: number, y2: number, width: number, colour: string) {
  g.beginPath(); g.moveTo(px(o, x1), py(o, y1)); g.lineTo(px(o, x2), py(o, y2));
  g.lineWidth = width * o.k; g.lineCap = "round"; g.strokeStyle = colour; g.stroke();
}
export const mixHex = (a: string, b: string, k: number) => {
  const p = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map(i => Math.round(p(a, i) + (p(b, i) - p(a, i)) * k)).join(",")})`;
};

// ---- People ----

export type Figure = {
  skin: string; hair: string; hairStyle: string; top: string; trim: string; belt: string; trousers: string;
  /** A wrapper skirt (market women) instead of legs. */
  skirt?: readonly [string, string, string];
  tie?: string; cap?: string; basket?: { basket: string; goods: string };
  heading: number; hips: readonly [number, number]; knees: readonly [number, number]; arms: readonly [number, number];
  wave?: number; sit?: number; mouth?: number; lean?: number; lift?: number; alpha?: number; talker?: boolean;
};

export function figure(g: Ctx, o: Proj, f: Figure) {
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

export const fromPreset = (p: AvatarPreset): Pick<Figure, "skin" | "hair" | "hairStyle" | "top" | "trim" | "belt" | "trousers"> =>
  ({ skin: p.skin_color, hair: p.hair_color, hairStyle: p.hair_style, top: p.uniform_primary, trim: p.uniform_secondary, belt: p.uniform_accent, trousers: p.uniform_primary });

export function crowdFigure(look: ReturnType<typeof lookOf>, heading: number, swing: number, bounce: number, prints: readonly (readonly [string, string, string])[]): Figure {
  return {
    skin: look.skin, hair: "#15100d", hairStyle: "close_crop", top: look.top, trim: look.top, belt: look.top, trousers: look.bottom,
    skirt: look.woman ? prints[look.print]! : undefined, tie: look.woman ? look.tie : undefined, cap: look.woman ? undefined : look.tie,
    basket: look.basket ? { basket: look.basket, goods: look.goods } : undefined,
    heading, hips: [-swing, swing], knees: [0, 0], arms: [swing, -swing], lift: bounce
  };
}

export function wheel(g: Ctx, o: Proj, x: number, y: number, r: number, spin: number) {
  disc(g, o, x, y, r, "#15191c"); disc(g, o, x, y, r * 0.5, "#aeb6bb");
  for (let i = 0; i < 3; i++) { const a = spin + (i * Math.PI) / 3; stroke(g, o, x - Math.cos(a) * r * 0.45, y - Math.sin(a) * r * 0.45, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, 0.04, "#5b6368"); }
}
