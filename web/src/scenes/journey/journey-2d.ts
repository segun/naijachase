// The 2D renderer for the travelling scene: the same journey as chase3d-journey.ts, drawn with the plain Canvas 2D API so it runs where
// WebGL cannot. It draws exactly what `frameAt` (journey-scene.ts) describes, using the same pinhole camera: a thing z metres behind the
// road is drawn at 1 / (z + cam.d) of its size and the horizon is the middle of the screen.
import { armAngles, legAngles, mix, type Pose } from "../shared/scene-core.ts";
import { mixColour, AIR, FOV, HOSTESS, coloursAt, frameAt, propColours, propX, tone, weightAt, type JourneyFrame, type Prop } from "./journey-scene.ts";
import { createJourneyDriver, type JourneyHandle, type JourneyOptions } from "./journey-driver.ts";
import { type Ctx, type Proj, box, disc, figure, fromPreset, px, py, stroke } from "../witness/witness-2d-kit.ts";
import { drawBus, drawCar } from "../witness/witness-2d.ts";

type Cols = ReturnType<typeof propColours>;
const sky = (g: Ctx, W: number, H: number, top: string, bottom: string) => {
  const grad = g.createLinearGradient(0, 0, 0, H / 2);
  grad.addColorStop(0, top); grad.addColorStop(1, bottom);
  g.fillStyle = grad; g.fillRect(0, 0, W, H / 2 + 1);
};
const poly = (g: Ctx, o: Proj, pts: readonly (readonly [number, number])[], fill: string) => {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(px(o, x), py(o, y)) : g.moveTo(px(o, x), py(o, y)))); g.closePath(); g.fillStyle = fill; g.fill();
};
/** A sign: a filled panel with text fitted to its width. */
function sign(g: Ctx, o: Proj, x: number, y: number, w: number, h: number, bg: string, fg: string, lines: readonly string[]) {
  box(g, o, x, y, w, h, bg);
  const size = Math.min(h / lines.length * 0.62, ...lines.map(l => (w * 0.92) / Math.max(4, l.length * 0.6)));
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  lines.forEach((line, i) => {
    g.font = `800 ${Math.max(6, size * o.k)}px system-ui, sans-serif`;
    g.fillText(line, px(o, x + w / 2), py(o, y + h - (h / lines.length) * (i + 0.5)));
  });
}

const DRAW: Partial<Record<Prop["kind"], (g: Ctx, o: Proj, p: Prop, c: Cols) => void>> = {
  tree(g, o, p, c) { box(g, o, -0.13, 0, 0.26, 2.4, c.trunk); disc(g, o, 0, 3.1, 1.5, c.leaf, 1, 0.9); disc(g, o, -0.8, 2.6, 0.9, c.leaf); disc(g, o, 0.8, 2.7, 1, c.leaf); },
  palm(g, o, p, c) {
    stroke(g, o, 0, 0, 0.5, 6, 0.24, c.trunk);
    for (let i = 0; i < 7; i++) { const a = -0.4 + (i / 6) * 3.7; stroke(g, o, 0.5, 6, 0.5 + Math.cos(a) * 2.2, 6 + Math.sin(a) * 1.3 - (i % 2) * 0.4, 0.2, c.leaf); }
  },
  pine(g, o, p, c) { box(g, o, -0.1, 0, 0.2, 1, c.trunk); for (let i = 0; i < 3; i++) poly(g, o, [[-1.3 + i * 0.25, 0.9 + i * 1.3], [1.3 - i * 0.25, 0.9 + i * 1.3], [0, 2.8 + i * 1.3]], c.leaf); },
  baobab(g, o, p, c) { poly(g, o, [[-0.9, 0], [0.9, 0], [0.65, 3.4], [-0.65, 3.4]], "#8a6a4a"); for (const a of [-1, 0, 1]) { stroke(g, o, 0, 3.3, a * 1.2, 4.4, 0.2, "#8a6a4a"); disc(g, o, a * 1.3, 4.6, 0.7, c.leaf); } },
  cactus(g, o, p, c) { box(g, o, -0.2, 0, 0.4, 2.8, c.leaf); stroke(g, o, -0.2, 1.4, -0.8, 1.4, 0.26, c.leaf); stroke(g, o, -0.8, 1.4, -0.8, 2.2, 0.26, c.leaf); stroke(g, o, 0.2, 1.8, 0.8, 1.8, 0.26, c.leaf); stroke(g, o, 0.8, 1.8, 0.8, 2.5, 0.26, c.leaf); },
  rock(g, o, p, c) { disc(g, o, 0, 0.4, 0.9, tone("#8a8478", 0), 1, 0.62); disc(g, o, 0.5, 0.25, 0.5, tone("#9a9488", 0), 1, 0.6); void c; },
  bush(g, o, p, c) { disc(g, o, 0, 0.5, 0.8, c.leaf, 1, 0.7); disc(g, o, 0.5, 0.35, 0.5, c.leaf, 1, 0.8); },
  reed(g, o, p, c) { for (let i = 0; i < 6; i++) stroke(g, o, -0.5 + i * 0.2, 0, -0.4 + i * 0.2 + (i % 2) * 0.1, 1.6 + (i % 3) * 0.3, 0.06, c.leaf); },
  crop(g, o, p, c) { for (let i = 0; i < 8; i++) { disc(g, o, -3.2 + i * 0.9, 0.35, 0.5, i % 2 ? c.leaf : c.accent, 1, 0.8); } },
  hut(g, o, p, c) { box(g, o, -1.3, 0, 2.6, 1.7, "#c9a878"); poly(g, o, [[-1.8, 1.6], [1.8, 1.6], [0, 3.3]], c.accent); box(g, o, -0.25, 0, 0.5, 1.1, "#5a3a22"); },
  stall(g, o, p, c) { box(g, o, -1.5, 0, 0.1, 2.2, c.trunk); box(g, o, 1.4, 0, 0.1, 2.2, c.trunk); box(g, o, -1.8, 2.1, 3.6, 0.35, c.accent); for (let i = 0; i < 6; i++) box(g, o, -1.8 + i * 0.6, 2.1, 0.3, 0.35, "#f4ecd8"); box(g, o, -1.3, 0.5, 2.6, 0.7, "#8a5a3c"); for (let i = 0; i < 5; i++) disc(g, o, -1 + i * 0.5, 1.4, 0.2, i % 2 ? "#d63a2e" : "#f2c14e"); },
  building(g, o, p, c) {
    const h = 4.5 + p.v * 4.5, w = 3.6 + p.v * 2;
    box(g, o, -w / 2, 0, w, h, c.accent); box(g, o, -w / 2 - 0.1, h, w + 0.2, 0.3, "#55565a");
    for (let r = 0; r < Math.floor(h / 1.6); r++) for (let k = 0; k < 3; k++) box(g, o, -w / 2 + 0.4 + k * (w / 3.2), 0.7 + r * 1.5, 0.6, 0.8, "#3a5a6b");
  },
  boat(g, o, p, c) { poly(g, o, [[-1.6, 0.5], [1.6, 0.5], [1.1, -0.1], [-1.1, -0.1]], c.accent); stroke(g, o, 0, 0.5, 0, 3.2, 0.08, c.trunk); poly(g, o, [[0.1, 0.8], [0.1, 3], [1.2, 0.8]], "#f4ecd8"); },
  pole(g, o) { stroke(g, o, 0, 0, 0, 5.6, 0.14, "#5a4a3a"); stroke(g, o, -0.8, 5.2, 0.8, 5.2, 0.1, "#5a4a3a"); },
  hill(g, o, p, c) { disc(g, o, 0, -0.5, 14, c.far, 1, 0.5); },
  cloud(g, o) { for (const [x, y, r] of [[-1.8, 0, 1.6], [0, 0.5, 2.1], [1.9, 0, 1.7], [0.2, -0.3, 1.8]] as const) disc(g, o, x * 2, y * 2, r * 2, "rgba(255,255,255,.82)", 1, 0.62); },
  garage(g, o) {
    box(g, o, -4.8, 0, 9.6, 4.4, "#d8d2c4"); box(g, o, -5, 4.4, 10, 0.35, "#8a5a3c"); box(g, o, -2.7, 0, 5.4, 3.3, "#25211e");
    for (let i = 0; i < 5; i++) box(g, o, -2.7, 2.6 + i * 0.14, 5.4, 0.04, "#3a3430");
    sign(g, o, -2.2, 3.5, 4.4, 0.7, "#1f4f9f", "#ffffff", ["GARAGE"]);
  },
  busstop(g, o) {
    box(g, o, -2.2, 0, 0.12, 2.5, "#55565a"); box(g, o, 2.0, 0, 0.12, 2.5, "#55565a"); box(g, o, -2.5, 2.5, 5, 0.18, "#1f4f9f"); box(g, o, -1.9, 0.5, 3.6, 0.1, "#8a5a3c");
    stroke(g, o, 3.2, 0, 3.2, 3.6, 0.12, "#55565a"); sign(g, o, 2.2, 3.3, 2.2, 0.9, "#1f4f9f", "#ffffff", ["BUS PARK"]);
  },
  parkedbus(g, o) { g.save(); g.translate(o.x, 0); g.scale(-1, 1); g.translate(-o.x, 0); drawBus(g, o, 0, 0); g.restore(); },
  billboard(g, o, p) {
    box(g, o, -2.1, 0, 0.18, 3.2, "#4a4a4a"); box(g, o, 1.9, 0, 0.18, 3.2, "#4a4a4a");
    sign(g, o, -2.7, 1.9, 5.4, 2.7, "#1f6f8f", "#ffffff", ["WELCOME TO", (p.text ?? "").replace(/^Welcome to /i, "").toUpperCase()]);
    box(g, o, -2.7, 1.8, 5.4, 0.1, "#f2c14e");
  },
  terminal(g, o, p) {
    box(g, o, -8, 0, 16, 6, "#d8d2c4"); box(g, o, -8.3, 6, 16.6, 0.4, "#55565a"); box(g, o, -7, 1, 14, 2.6, "#7fa6c6"); box(g, o, -1.2, 0, 2.4, 2.6, "#2a3a44");
    for (let i = 0; i < 13; i++) box(g, o, -6.9 + i, 1, 0.08, 2.6, "#5f7f94");
    sign(g, o, -7, 3.9, 14, 1.9, "#1f4f9f", "#ffffff", [p.text ?? "Airport"]);
  },
  tower(g, o) { box(g, o, -0.5, 0, 1, 11, "#c9c4b6"); poly(g, o, [[-1.7, 11], [1.7, 11], [2.2, 12.6], [-2.2, 12.6]], "#3a5a6b"); box(g, o, -2.2, 12.6, 4.4, 0.3, "#55565a"); },
  hangar(g, o) { box(g, o, -7, 0, 14, 5, "#9aa8b5"); disc(g, o, 0, 5, 7, "#9aa8b5", 1, 0.32); box(g, o, -3, 0, 6, 3.6, "#2a3a44"); }
};

/** The airliner, nose to the right, with its main wheels at y = 0. Drawn about its own origin so it can pitch. */
function drawPlane(g: Ctx, o: Proj, v: JourneyFrame["vehicle"], stairs: boolean) {
  const [gx, gy] = [px(o, -0.5), py(o, 0)];
  g.save();
  g.translate(gx, gy); g.rotate(-v.pitch); g.translate(-gx, -gy);
  if (v.gearDown > 0.02) disc(g, o, 0, 0.02, 7, "rgba(20,10,5,.18)", 1, 0.03);
  if (v.gearDown > 0.02) {
    g.globalAlpha = v.gearDown;
    for (const x of [-2.2, 6]) { stroke(g, o, x, 1.4, x, 0.5, 0.2, "#3a3f43"); disc(g, o, x, 0.45, 0.45, "#15191c"); disc(g, o, x, 0.45, 0.2, "#aeb6bb"); }
    g.globalAlpha = 1;
  }
  poly(g, o, [[-7.7, 3.9], [-5.6, 3.9], [-7.2, 6.6], [-8.4, 6.6]], "#1f4f9f");
  poly(g, o, [[-7.8, 3.6], [-5, 3.4], [-6.6, 3.9]], "#c9d1d6");
  const fus = g.createLinearGradient(0, py(o, 4.05), 0, py(o, 1.35));
  fus.addColorStop(0, "#ffffff"); fus.addColorStop(0.6, "#e4e9ec"); fus.addColorStop(1, "#aab4ba");
  g.beginPath(); g.moveTo(px(o, -8), py(o, 3.8)); g.lineTo(px(o, 4.5), py(o, 4.05));
  g.quadraticCurveTo(px(o, 8.3), py(o, 4.0), px(o, 8.3), py(o, 2.8)); g.quadraticCurveTo(px(o, 8.0), py(o, 1.4), px(o, 4.5), py(o, 1.35));
  g.lineTo(px(o, -4), py(o, 1.35)); g.quadraticCurveTo(px(o, -7), py(o, 1.6), px(o, -8), py(o, 3.1)); g.closePath();
  g.fillStyle = fus; g.fill();
  box(g, o, -7.5, 2.15, 14.8, 0.18, "#1f4f9f"); box(g, o, -7.2, 1.95, 14.2, 0.07, "#f2c14e");
  for (let i = 0; i < 12; i++) disc(g, o, -5.4 + i * 0.85, 3.25, 0.17, "#2b4a5e");
  poly(g, o, [[6.2, 3.7], [7.9, 3.4], [7.6, 3.0], [6.2, 3.1]], "#2b4a5e");
  poly(g, o, [[-4.2, 2.0], [-0.4, 2.0], [-5.8, 1.55], [-7.6, 1.55]], "#b4bdc3");
  disc(g, o, -1.8, 1.45, 0.62, "#8f9aa1", 1.5, 0.85); disc(g, o, -1.1, 1.45, 0.3, "#4a5258", 0.6, 0.8);
  // The door sits just in front of the stairs; it is dark when open.
  const open = v.door;
  box(g, o, AIR.doorX - 0.45, AIR.sill, 0.9, 1.75, open > 0.05 ? "#1b1d20" : "#cfd6da");
  if (open > 0.05) box(g, o, AIR.doorX - 0.45, AIR.sill, 0.9, 0.2, "#8a8f93");
  if (stairs && v.stairs > 0.02) {
    g.globalAlpha = v.stairs;
    const x0 = AIR.stairBottom, x1 = AIR.stairTop, n = 8;
    for (let i = 0; i < n; i++) { const x = mix(x0, x1, i / n), h = mix(0.2, AIR.sill, (i + 1) / n); box(g, o, x, 0, (x1 - x0) / n, h, i % 2 ? "#9aa4ab" : "#b4bdc3"); }
    box(g, o, x1, AIR.sill - 0.12, 1.0, 0.12, "#8a8f93");
    stroke(g, o, x0, 1.0, x1 + 0.9, AIR.sill + 0.9, 0.07, "#d8d2c4");
    box(g, o, x1 + 0.9, 0, 0.1, AIR.sill - 0.1, "#6a7278");
    g.globalAlpha = 1;
  }
  g.restore();
}

export async function createJourneyScene2D(canvas: HTMLCanvasElement, options: JourneyOptions): Promise<JourneyHandle> {
  const g = canvas.getContext("2d");
  if (!g) throw new Error("The 2D canvas is not available");
  const driver = createJourneyDriver(options);
  const { plan } = driver;
  const look = options.preset ? fromPreset(options.preset) : null;
  const crew = fromPreset(HOSTESS);
  let W = 0, H = 0, dpr = 1, lastT = 0;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, options.quality === "light" ? 1 : 2);
    W = Math.max(1, canvas.clientWidth); H = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  };
  resize();

  const paint = (t: number) => {
    lastT = t;
    const f = frameAt(plan, t);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const focal = H / 2 / Math.tan(FOV / 2);
    const { cam } = f;
    const at = (x: number, z: number, y = 0): Proj => { const k = focal / (z + cam.d); return { x: W / 2 + (x - cam.x) * k, y: H / 2 + (cam.y - y) * k, k, z }; };
    const col = coloursAt(plan, cam.x);
    sky(g, W, H, col.skyTop, col.skyBottom);
    // The ground and the road change colour along the screen as one landscape blends into the next.
    const half = W / 2 / (focal / cam.d);
    const strip = (yTop: number, yBottom: number, key: "ground" | "road") => {
      const grad = g.createLinearGradient(0, 0, W, 0);
      for (let i = 0; i <= 8; i++) grad.addColorStop(i / 8, coloursAt(plan, cam.x + (i / 4 - 1) * half)[key]);
      g.fillStyle = grad; g.fillRect(0, yTop, W, yBottom - yTop);
    };
    // Flying with no ground (the weekly route view): the lower half is a bank of haze under the plane.
    const skyOnly = plan.loop && plan.mode === "fly";
    if (skyOnly) {
      const haze = g.createLinearGradient(0, H / 2, 0, H);
      haze.addColorStop(0, col.skyBottom); haze.addColorStop(1, tone(mixColour(col.skyBottom, "#ffffff", 0.55), plan.dim));
      g.fillStyle = haze; g.fillRect(0, H / 2, W, H / 2);
    } else strip(H / 2, H, "ground");

    const items: { z: number; draw: () => void }[] = [];
    for (const p of plan.props) {
      const w = p.span >= 0 ? weightAt(plan, p.span, p.x) : 1;
      if (w < 0.03) continue;
      const o0 = at(propX(plan, p, cam.x), p.z, p.y);
      const reach = (p.kind === "water" ? 26 : p.kind === "hill" ? 16 : 11) * p.scale * w;
      if (Math.abs(o0.x - W / 2) - reach * o0.k > W / 2) continue;
      const cols = propColours(plan, p);
      items.push({
        z: p.z,
        draw: () => {
          if (p.kind === "water") {
            const a = at(p.x - 22, 14), b = at(p.x + 22, 60);
            g.fillStyle = cols.water; g.fillRect(a.x, b.y, b.x - a.x + 2, a.y - b.y); return;
          }
          const o = { ...o0, k: o0.k * p.scale * (p.span >= 0 ? 0.35 + 0.65 * w : 1) };
          g.globalAlpha = p.span >= 0 ? Math.min(1, w * 1.6) : 1;
          DRAW[p.kind]?.(g, o, p, cols);
          g.globalAlpha = 1;
        }
      });
    }
    // The road, with its kerb lines and centre dashes.
    if (!skyOnly) items.push({
      z: 2.9, draw: () => {
        const far = at(cam.x, 2.8), near = at(cam.x, -2.8);
        strip(far.y, near.y, "road");
        g.fillStyle = "rgba(232,226,207,.8)";
        const dash = 4, mid = at(cam.x, 0).y;
        for (let x = Math.floor((cam.x - half) / 8) * 8; x < cam.x + half; x += 8) g.fillRect(at(x, 0).x, mid - 0.04 * at(0, 0).k, dash * at(0, 0).k, 0.1 * at(0, 0).k);
      }
    });
    const v = f.vehicle;
    const pl = f.player;
    items.push({
      z: 0, draw: () => {
        const o = at(v.x, 0, v.y);
        if (v.kind === "plane") { drawPlane(g, o, v, true); return; }
        g.save(); g.translate(o.x, 0); g.scale(-1, 1); g.translate(-o.x, 0);
        const seatedInBus = v.kind === "bus" && pl && pl.sit > 0.5;
        if (v.kind === "car") drawCar(g, o, -v.spin);
        else drawBus(g, o, -v.spin, v.door, seatedInBus && look ? { skin: look.skin, hair: look.hair, top: look.top } : null);
        g.restore();
      }
    });
    if (f.hostess) {
      const h = f.hostess;
      items.push({ z: -0.2, draw: () => figure(g, at(h.x, -0.2, h.y), { ...crew, heading: h.heading, hips: [0, 0], knees: [0, 0], arms: [0, 0], alpha: h.alpha }) });
    }
    const insideBus = v.kind === "bus" && pl && pl.sit > 0.5;
    if (pl && look && pl.visible && pl.alpha > 0.01 && !insideBus) {
      items.push({
        z: pl.sit > 0.5 ? 0.2 : -0.5, draw: () => {
          const pose: Pose = { x: pl.x, y: pl.y, z: 0, heading: pl.heading, sit: pl.sit, gait: pl.gait, stride: pl.stride, type: pl.type, visible: true };
          const legs = legAngles(pose), arms = armAngles(pose, t);
          const o = at(pl.x + (pl.sit > 0.5 ? 0.05 : 0), 0, pl.sit > 0.5 ? -0.14 : 0);
          const raised = pl.pass;
          const handArm = mix(arms[1], 1.7, raised);
          const driving = pl.sit > 0.5;
          if (!driving) disc(g, o, 0, 0, 0.45, "rgba(20,10,5,.25)", 1, 0.2);
          // Seated in the car the shins tuck up under the dashboard so no feet show below the bodywork.
          const knees = driving ? ([legs.knees[0] - 1.4, legs.knees[1] - 1.4] as const) : legs.knees;
          figure(g, o, { ...look, heading: pl.heading, hips: legs.hips, knees, arms: [arms[0], handArm], elbows: [0, 0.45 * raised], lift: pl.y, alpha: pl.alpha });
          if (raised > 0.05) {
            g.globalAlpha = raised;
            const cx = 0.6 * (pl.heading < 0 ? 1 : -1);
            box(g, o, cx - 0.12, 1.62, 0.26, 0.18, "#ffffff"); box(g, o, cx - 0.12, 1.7, 0.26, 0.04, "#1f4f9f");
            g.globalAlpha = 1;
          }
        }
      });
    }
    items.sort((a, b) => b.z - a.z).forEach(i => i.draw());
    if (plan.dim > 0) { g.fillStyle = `rgba(6,12,40,${plan.dim * 0.35})`; g.fillRect(0, 0, W, H); }
    driver.step(f);
  };

  let faulted = false;
  const draw = (t: number) => {
    if (faulted) return;
    try { paint(t); } catch (e) {
      faulted = true;
      console.error("The 2D journey scene broke.", e);
      options.onFault?.(e instanceof Error ? e.message : String(e));
    }
  };

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
    plan, duration: plan.end,
    now: () => lastT,
    start(begin = options.reducedMotion ? plan.settle : 0) {
      // Reduced motion: the endless route is one still picture, never an animation.
      if (options.reducedMotion && plan.loop) { draw(1); return new Promise<void>(resolve => { done = resolve; }); }
      return new Promise<void>(resolve => { done = resolve; from = begin; started = -1; skipped = false; running = true; raf = requestAnimationFrame(frame); });
    },
    skip() { skipped = true; },
    seek(seconds) { cancelAnimationFrame(raf); running = false; draw(seconds); },
    dispose() { cancelAnimationFrame(raf); observer.disconnect(); done?.(); }
  };
}
