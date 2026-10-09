// Draws a venue layout (layout-open-air-kit.ts) in 2D for the witness scene, the counterpart of chase3d-open-air-kit.ts: every prop is painted
// as flat coloured faces projected with the real camera, back to front, so the picture matches the 3D scene piece for piece. Plain Canvas 2D.
import { crowdLimit, type Layout, type LayoutBuilder, sceneSeed, type Person, type Prop, armAngle, armEnd, moveAt, placeAt } from "./layout-open-air-kit.ts";
import { PRINTS, lookOf } from "./market-layout.ts";
import { type Cam, type Item, box, crowdFigure, disc, figure, mixHex, polygon, project, px, py } from "./witness-2d-kit.ts";
import type { Set2D, SetContext2D } from "./witness-2d-sets.ts";

type Shades = { front: string; top: string; side: string; lite: string };
const FONT = (size: number) => `bold ${size}px 'Arial Black', Impact, Arial, sans-serif`;

export function drawLayout2d(layout: Layout, { g, options, palette }: SetContext2D): ReturnType<Set2D> {
  const light = options.quality === "light";
  const night = palette.lamp > 0.3;
  const props = layout.props.filter(p => (!p.hi || !light) && (!p.night || night));
  const near = props.filter(p => !p.far), far = props.filter(p => p.far);
  const people: Person[] = layout.people.slice(0, crowdLimit(light));
  const tmp: [number, number, number] = [0, 0, 0];

  const cache = new Map<string, Shades>();
  const shades = (colour: string, hazed: boolean, glowing: boolean): Shades => {
    const key = `${colour}|${hazed}|${glowing}`;
    let s = cache.get(key);
    if (!s) {
      const base = hazed ? mixHex(colour, palette.skyBottom, 0.45) : colour;
      const m = (a: string, b: string, k: number) => (a.startsWith("#") ? mixHex(a, b, k) : a);
      s = glowing ? { front: colour, top: colour, side: colour, lite: colour }
        : hazed ? { front: base, top: base, side: base, lite: base }
        : { front: base, top: m(colour, "#ffffff", 0.2), side: m(colour, "#000000", 0.28), lite: m(colour, "#ffffff", 0.14) };
      cache.set(key, s);
    }
    return s;
  };
  // Sign text is measured once at a reference size, then scaled to the board.
  const widest = new Map<string, number>();
  const textWidth = (text: string) => {
    let w = widest.get(text);
    if (w === undefined) { g.font = FONT(100); w = Math.max(1, ...text.split("\n").map(l => g.measureText(l).width)); widest.set(text, w); }
    return w;
  };

  const place = (p: Prop, t: number): [number, number, number] => (p.k === "arm" ? (tmp[0] = 0, tmp[1] = 0, tmp[2] = 0, tmp) : moveAt(p.m, t, tmp));

  /** The depth the prop is sorted by: low things sort by their back edge so what stands on them is painted after. */
  const depthZ = (p: Prop) => (p.k === "box" ? (p.h <= 1.1 ? p.z + p.d / 2 : p.z) : p.k === "arm" ? p.z - 0.05 : p.k === "glow" ? p.z - 0.3 : p.z);

  const paintProp = (p: Prop, c: Cam, t: number, hazed: boolean) => {
    const [dx, dy, dz] = place(p, t);
    const x = p.x + dx, y = p.y + dy, z = p.z + dz;
    switch (p.k) {
      case "box": {
        const s = shades(p.c, hazed, !!p.glow && night);
        const x0 = x - p.w / 2, x1 = x + p.w / 2, y1 = y + p.h, z0 = z - p.d / 2, z1 = z + p.d / 2;
        if (c.pos[1] > y1) polygon(g, c, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], s.top);
        if (c.pos[0] < x0) polygon(g, c, [[x0, y, z0], [x0, y, z1], [x0, y1, z1], [x0, y1, z0]], s.side);
        else if (c.pos[0] > x1) polygon(g, c, [[x1, y, z0], [x1, y, z1], [x1, y1, z1], [x1, y1, z0]], s.side);
        polygon(g, c, [[x0, y, z0], [x1, y, z0], [x1, y1, z0], [x0, y1, z0]], s.front);
        break;
      }
      case "cyl": {
        const s = shades(p.c, hazed, !!p.glow && night), top = p.w2 ?? p.w;
        if (p.w2 !== undefined) { polygon(g, c, [[x - p.w / 2, y, z], [x + p.w / 2, y, z], [x + top / 2, y + p.h, z], [x - top / 2, y + p.h, z]], s.front); break; }
        const o = project(c, x, y, z);
        box(g, o, -p.w / 2, 0, p.w * 0.55, p.h, s.front); box(g, o, -p.w / 2 + p.w * 0.55, 0, p.w * 0.45, p.h, s.side);
        if (c.pos[1] > y + p.h) disc(g, o, 0, p.h, p.w / 2, s.top, 1, 0.3);
        break;
      }
      case "cylx": {
        const s = shades(p.c, hazed, !!p.glow && night), o = project(c, x, y, z);
        box(g, o, -p.w / 2, 0, p.w, p.h, s.side); box(g, o, -p.w / 2, p.h * 0.35, p.w, p.h * 0.65, s.front); box(g, o, -p.w / 2, p.h * 0.7, p.w, p.h * 0.18, s.lite);
        disc(g, o, p.w / 2, p.h / 2, p.h / 2, s.side, 0.18, 1); disc(g, o, -p.w / 2, p.h / 2, p.h / 2, s.front, 0.18, 1);
        break;
      }
      case "cylz": {
        const s = shades(p.c, hazed, !!p.glow && night), o = project(c, x, y, z);
        disc(g, o, 0, p.w / 2, p.w / 2, s.front); disc(g, o, 0, p.w / 2, p.w * 0.22, s.lite);
        break;
      }
      case "ball": {
        const s = shades(p.c, hazed, !!p.glow && night), sy = p.sy ?? 1, o = project(c, x, y, z), r = p.w / 2;
        disc(g, o, 0, r * sy, r, s.side, 1, sy); disc(g, o, -r * 0.08, r * sy + r * sy * 0.08, r * 0.88, s.front, 1, sy * 0.92); disc(g, o, -r * 0.25, r * sy + r * sy * 0.3, r * 0.35, s.lite, 1, sy * 0.6);
        break;
      }
      case "arm": {
        const s = shades(p.c, hazed, false), a = armAngle(p, t), end = armEnd({ ...p, x, y, z }, a), h = p.t / 2;
        if (p.axis === "z") { const nx = -Math.sin(a) * h, ny = Math.cos(a) * h; polygon(g, c, [[x + nx, y + ny, z], [end[0] + nx, end[1] + ny, z], [end[0] - nx, end[1] - ny, z], [x - nx, y - ny, z]], s.front); }
        else polygon(g, c, [[x, y - h, z], [end[0], y - h, end[2]], [end[0], y + h, end[2]], [x, y + h, z]], s.front);
        break;
      }
      case "sign": {
        const o = project(c, x, 0, z), wpx = p.w * o.k, hpx = p.h * o.k;
        g.textBaseline = "alphabetic"; g.fillStyle = p.bg; g.fillRect(px(o, -p.w / 2), py(o, y + p.h), wpx, hpx);
        g.strokeStyle = p.fg; g.lineWidth = Math.max(1, hpx * 0.03); g.strokeRect(px(o, -p.w / 2) + hpx * 0.06, py(o, y + p.h) + hpx * 0.06, wpx - hpx * 0.12, hpx - hpx * 0.12);
        const lines = p.text.split("\n");
        const size = Math.min((hpx * 0.72) / lines.length, (wpx * 0.9 * 100) / textWidth(p.text));
        if (size >= 4) {
          g.font = FONT(size); g.fillStyle = p.fg;
          lines.forEach((l, i) => g.fillText(l, px(o, 0) - g.measureText(l).width / 2, py(o, y + p.h / 2) + (i - (lines.length - 1) / 2) * size * 1.12 + size * 0.34));
        }
        break;
      }
      case "glow": {
        const o = project(c, x, y, z), r = p.r * o.k;
        if (r < 2) break;
        const grad = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, r);
        grad.addColorStop(0, `${p.c}dd`); grad.addColorStop(0.35, `${p.c}55`); grad.addColorStop(1, `${p.c}00`);
        g.globalCompositeOperation = "lighter"; g.fillStyle = grad; g.fillRect(o.x - r, o.y - r, r * 2, r * 2); g.globalCompositeOperation = "source-over";
        break;
      }
    }
  };

  const personItem = (c: Cam, p: Person, t: number): Item => {
    const at = placeAt(p, t);
    return { z: project(c, at.x, 0, at.z).z, draw: () => figure(g, project(c, at.x, 0, at.z), crowdFigure(lookOf(p.seed), at.face, at.swing, at.bounce, PRINTS)) };
  };

  return {
    ground: layout.ground,
    backdrop(c, _horizon, t) {
      if (layout.water) {
        const z = layout.water.z;
        polygon(g, c, [[-400, 0, z], [400, 0, z], [400, 0, 4000], [-400, 0, 4000]], layout.water.c);
      }
      const order = far.map(p => ({ p, z: project(c, p.x, 0, depthZ(p)).z })).sort((a, b) => b.z - a.z);
      for (const { p } of order) paintProp(p, c, t, true);
    },
    items(c, t) {
      const items: Item[] = [];
      for (const p of near) items.push({ z: project(c, p.x, 0, depthZ(p)).z, draw: () => paintProp(p, c, t, false) });
      for (const p of people) items.push(personItem(c, p, t));
      return items;
    }
  };
}

/** The 2D set for a layout builder, the counterpart of openAirSet3d. */
export const openAirSet2d = (build: LayoutBuilder): Set2D => ctx =>
  drawLayout2d(build(ctx.options.recipe.variant ?? "", ctx.options.venueName, sceneSeed(ctx.options.text)), ctx);
