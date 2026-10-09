// Draws a building layout (layout-buildings-venues.ts) in 2D, the counterpart of chase3d-buildings-kit.ts: every part is painted from its
// own corners with the real camera projection, back to front, so the 2D picture shows the same venue and the same people as the 3D one.
import { type Cam, type Ctx, type Item, box as flatBox, disc, figure, mixHex, polygon, project, px, py, stroke } from "./witness-2d-kit.ts";
import type { Palette } from "../shared/scene-core.ts";
import type { WitnessOptions } from "./witness-driver.ts";
import type { SetResult2D } from "./witness-2d-sets.ts";
import { type Part, WARM, beaconPhase, neonOn, puffAt, swingAt, waveAt } from "./layout-buildings-parts.ts";
import { layoutFor } from "./layout-buildings-venues.ts";
import { hashOf } from "./venue-recipes.ts";
import { type Person, SKINS, poseAt } from "./layout-buildings-people.ts";

const darker = (c: string, k: number) => mixHex(c, "#000000", 1 - k);
const lighter = (c: string, k: number) => mixHex(c, "#ffffff", k - 1);
const PAVING = 1e6;

/**
 * Where a part sorts: the distance along the view axis of its farthest end on the plane z = `z`. A wide wall then always sorts behind the
 * windows on it and behind the people in front of it, whichever way the camera looks along it (the core sorts people and the vehicle by
 * the same distance measured at their feet).
 */
const depthOf = (c: Cam, x0: number, x1: number, z: number) => Math.max(project(c, x0, 0, z).z, project(c, x1, 0, z).z);

function figureOf(p: Person, t: number) {
  const w = poseAt(p, t);
  const skin = SKINS[p.skin % SKINS.length]!;
  return { w, figure: {
    skin, hair: "#15100d", hairStyle: "close_crop", top: p.top, trim: p.top, belt: p.top, trousers: p.skirt ? p.top : p.bottom,
    skirt: p.skirt ? ([p.skirt, p.skirt, p.skirt] as const) : undefined,
    tie: p.head?.kind === "wrap" ? p.head.c : undefined, cap: p.head?.kind === "cap" ? p.head.c : undefined,
    heading: w.heading, hips: [-w.swing, w.swing] as const, knees: [0, 0] as const, arms: [w.swing, -w.swing + w.gesture] as const, lift: w.bounce
  } };
}

export function buildLayout2d(g: Ctx, options: WitnessOptions, palette: Palette): SetResult2D {
  const night = palette.lamp > 0.3;
  const layout = layoutFor(options.recipe.variant ?? options.recipe.id, { night, light: options.quality === "light", name: options.venueName, seed: hashOf(options.text) });

  const quad = (c: Cam, pts: readonly (readonly [number, number, number])[], fill: string) => polygon(g, c, pts as never, fill);
  const glow = (o: ReturnType<typeof project>, x: number, y: number, w: number, h: number, colour: string) => {
    g.save(); g.globalAlpha = 0.22; g.fillStyle = colour;
    g.fillRect(px(o, x - 0.15), py(o, y + h + 0.15), (w + 0.3) * o.k, (h + 0.3) * o.k);
    g.restore();
  };

  const solid = (c: Cam, p: Extract<Part, { k: "box" }>, colour: string) => {
    const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, y1 = p.y + p.h, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2;
    if (c.pos[0] < x0 && p.d > 0.2) quad(c, [[x0, p.y, z0], [x0, p.y, z1], [x0, y1, z1], [x0, y1, z0]], darker(colour, 0.78));
    if (c.pos[0] > x1 && p.d > 0.2) quad(c, [[x1, p.y, z0], [x1, p.y, z1], [x1, y1, z1], [x1, y1, z0]], darker(colour, 0.7));
    if (c.pos[1] > y1) quad(c, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], lighter(colour, 1.1));
    quad(c, [[x0, p.y, z0], [x1, p.y, z0], [x1, y1, z0], [x0, y1, z0]], colour);
  };

  const body = (c: Cam, x: number, y: number, z: number, r: number, rt: number, h: number, colour: string) => {
    const a = project(c, x - r, y, z), b = project(c, x + r, y, z);
    const gradient = g.createLinearGradient(a.x, 0, b.x === a.x ? a.x + 1 : b.x, 0);
    gradient.addColorStop(0, lighter(colour, 1.12)); gradient.addColorStop(0.55, colour); gradient.addColorStop(1, darker(colour, 0.72));
    quad(c, [[x - r, y, z], [x + r, y, z], [x + rt, y + h, z], [x - rt, y + h, z]], gradient as unknown as string);
  };

  return {
    ground: layout.ground,
    items(c, t) {
      const items: Item[] = [];
      const add = (z: number, draw: () => void) => items.push({ z, draw });
      for (const p of layout.parts) {
        switch (p.k) {
          case "pave": add(PAVING, () => quad(c, [[p.x0, 0.01, p.z0], [p.x1, 0.01, p.z0], [p.x1, 0.01, p.z1], [p.x0, 0.01, p.z1]], p.c)); break;
          case "box": {
            const lit = night && p.lit, colour = p.neon ? (night ? p.neon : darker(p.neon, 0.5)) : lit ? p.lit! : p.c;
            add(depthOf(c, p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2), () => {
              solid(c, p, colour);
              if (lit || (p.neon && night && neonOn(t, p.ph ?? 0))) {
                const o = project(c, p.x, p.y, p.z - p.d / 2);
                glow(o, -p.w / 2, 0, p.w, p.h, lit ? WARM : p.neon!);
              }
            });
            break;
          }
          case "cyl": {
            const sx = p.swing ? swingAt(p.swing, t) : 0;
            add(depthOf(c, p.x - p.r, p.x + p.r, p.z - p.r), () => body(c, p.x + sx, p.y, p.z, p.r, p.rt ?? p.r, p.h, p.c));
            break;
          }
          case "ball": add(depthOf(c, p.x - p.r, p.x + p.r, p.z), () => {
            const o = project(c, p.x, p.y, p.z), sy = p.sy ?? 1;
            disc(g, o, 0, 0, p.r, darker(p.c, 0.8), 1, sy);
            disc(g, o, -p.r * 0.08, p.r * sy * 0.1, p.r * 0.88, p.c, 1, sy * 0.88);
            disc(g, o, -p.r * 0.3, p.r * sy * 0.35, p.r * 0.35, lighter(p.c, 1.12), 1, sy * 0.35);
          }); break;
          case "disc": add(depthOf(c, p.x - p.r, p.x + p.r, p.z - 0.05), () => {
            const lit = night && p.lit, o = project(c, p.x, p.y, p.z);
            disc(g, o, 0, 0, p.r, lit ? p.lit! : p.c);
            if (lit) { g.save(); g.globalAlpha = 0.22; disc(g, o, 0, 0, p.r * 1.3, p.lit!); g.restore(); }
          }); break;
          case "prism": add(depthOf(c, p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2), () => quad(c, [[p.x - p.w / 2, p.y, p.z - p.d / 2], [p.x + p.w / 2, p.y, p.z - p.d / 2], [p.x, p.y + p.h, p.z - p.d / 2]], p.c)); break;
          case "sign": add(depthOf(c, p.x - p.w / 2, p.x + p.w / 2, p.z - 0.06), () => {
            const x0 = p.x - p.w / 2 - 0.08, x1 = p.x + p.w / 2 + 0.08, y0 = p.y - p.h / 2 - 0.08, y1 = p.y + p.h / 2 + 0.08, z = p.z - 0.05;
            quad(c, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], darker(p.c, 0.8));
            quad(c, [[x0 + 0.08, y0 + 0.08, z], [x1 - 0.08, y0 + 0.08, z], [x1 - 0.08, y1 - 0.08, z], [x0 + 0.08, y1 - 0.08, z]], p.c);
            const o = project(c, p.x, p.y, z), label = p.text.toUpperCase();
            let size = p.h * 0.6 * o.k;
            g.font = `bold ${size}px Arial, sans-serif`;
            while (size > 7 && g.measureText(label).width > (p.w - 0.3) * o.k) { size -= 2; g.font = `bold ${size}px Arial, sans-serif`; }
            g.fillStyle = p.fg; g.textBaseline = "middle"; g.fillText(label, o.x - g.measureText(label).width / 2, o.y);
          }); break;
          case "flag": add(depthOf(c, p.x, p.x + p.w, p.z), () => {
            const n = 6;
            for (let i = 0; i < n; i++) {
              const u0 = i / n, u1 = (i + 1) / n, x0 = p.x + u0 * p.w, x1 = p.x + u1 * p.w;
              const w0 = waveAt(u0, t) * 1.2 + Math.sin(t * 3 + p.x) * 0.0, w1 = waveAt(u1, t) * 1.2;
              quad(c, [[x0, p.y + w0, p.z], [x1, p.y + w1, p.z], [x1, p.y + p.h + w1, p.z], [x0, p.y + p.h + w0, p.z]], u0 < 1 / 3 || u0 >= 2 / 3 ? p.c : p.c2);
            }
          }); break;
          case "beacon": add(depthOf(c, p.x - p.r, p.x + p.r, p.z), () => {
            const colour = beaconPhase(t, p.period) ? p.c : p.c2, o = project(c, p.x, p.y, p.z);
            g.save(); g.globalAlpha = 0.3; disc(g, o, 0, 0, p.r * 2.4, colour); g.restore();
            disc(g, o, 0, 0, p.r, colour);
          }); break;
          case "puff": add(depthOf(c, p.x - 0.3, p.x + 0.3, p.z - 0.2), () => {
            for (let i = 0; i < 3; i++) {
              const k = puffAt(i, t), o = project(c, p.x + Math.sin(i * 2 + k * 3) * 0.2 * k, p.y + k * 1.8, p.z);
              g.save(); g.globalAlpha = 0.6 * (1 - k); disc(g, o, 0, 0, p.r * (0.5 + k * 1.6), p.c); g.restore();
            }
          }); break;
          case "lamp": {
            if (night) add(PAVING, () => { const o = project(c, p.x, 0, p.z); g.save(); g.globalAlpha = 0.2; disc(g, o, 0, 0, 2.2, "#ffe0a3", 1, 0.22); g.restore(); });
            add(depthOf(c, p.x - 0.2, p.x + 0.2, p.z - 0.1), () => {
              const o = project(c, p.x, 0, p.z);
              stroke(g, o, 0, 0, 0, p.h, 0.11, p.c);
              if (night) { g.save(); g.globalAlpha = 0.3; disc(g, o, 0, p.h, 0.55, "#ffe3a0"); g.restore(); }
              disc(g, o, 0, p.h, 0.16, night ? "#fff0bd" : "#e9e4d2");
            });
            break;
          }
        }
      }
      for (const person of layout.people) {
        const { w, figure: f } = figureOf(person, t);
        add(project(c, w.x, 0, w.z).z, () => {
          const o = project(c, w.x, 0, w.z);
          figure(g, o, f);
          const prop = person.prop;
          if (prop?.kind === "bag") flatBox(g, o, -0.46, 0.7, 0.22, 0.28, prop.c);
          else if (prop?.kind === "staff") stroke(g, o, 0.36, 0, 0.36, 1.7, 0.05, prop.c);
          else if (prop?.kind === "drum") disc(g, o, -0.3, 0.95, 0.2, prop.c, 1, 1.2);
          else if (prop?.kind === "tray") { flatBox(g, o, 0.08, 1.1, 0.46, 0.04, prop.c); flatBox(g, o, 0.26, 1.14, 0.1, 0.1, "#f4f1e6"); }
        });
      }
      return items;
    }
  };
}
