// The market's scenery for the 2D witness scene, the counterpart of chase3d-market.ts: a hazy skyline, palms, rows of striped stalls with
// wares, a banner carrying the venue's name, and a crowd. A set is a function that returns its ground colour, an optional backdrop and the
// billboards to paint this frame; see witness-2d-sets.ts.
import { PRINTS, BANNER, PALMS, SHOPPERS, STALLS, type StallSpec, crowdSize, lookOf, walkerAt } from "./market-layout.ts";
import { hashOf } from "./venue-recipes.ts";
import { type Cam, type Item, crowdFigure, box, disc, figure, mixHex, polygon, project, px, py, stroke } from "./witness-2d-kit.ts";
import type { Set2D } from "./witness-2d-sets.ts";

export const buildMarket2d: Set2D = ({ g, options, palette }) => {
  const prints = PRINTS;
  const count = crowdSize(options.quality === "light");
  const r = (() => { let s = (hashOf(options.venueName) % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  const skyline = Array.from({ length: 26 }, (_, i) => ({ x: -48 + i * 3.8 + r() * 2, w: 3 + r() * 5, h: 3 + r() * 8, tone: ["#8c8579", "#a8a091", "#7a8a8f", "#b3a58a"][Math.floor(r() * 4)]! }));

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

  return {
    ground: "#a35f38",
    backdrop(c) { for (const b of skyline) { const o = project(c, b.x, 0, 40); box(g, o, -b.w / 2, 0, b.w, b.h, mixHex(b.tone, palette.skyBottom, 0.45)); } },
    items(c, t) {
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

      return items;
    }
  };
};
