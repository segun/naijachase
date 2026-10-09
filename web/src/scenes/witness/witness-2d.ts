// The 2D renderer for the witness scene: the same venue, the same people and the same timeline as chase3d-witness.ts, drawn with the
// plain Canvas 2D API. It needs no WebGL and no download beyond this file, so it runs where the 3D scene cannot (no WebGL, Save-Data, a
// slow network, low memory, a low frame rate). It reads the same pure rules (witness-scene.ts) and layout (market-layout.ts), so the
// two renderers always show the same events: they are renderers, not separate games.
//
// How it draws: every object is a flat picture that always faces the camera (a billboard), placed with a real perspective projection
// of the same camera path the 3D scene uses, and the pictures are painted from the back to the front.
import { PALETTES, armAngles, legAngles, lightAt, type Pose } from "../shared/scene-core.ts";
import { hashOf } from "./venue-recipes.ts";
import { createDriver, fitShot, type WitnessHandle, type WitnessOptions } from "./witness-driver.ts";
import { setFor } from "./witness-2d-sets.ts";
import { ROAD_Z, VEHICLE_FROM_X, WITNESS, busDoorAt, cameraAt, listenLean, playerPoseAt, vehicleXAt, witnessAt } from "./witness-scene.ts";
import type { AvatarPreset } from "../../avatar/avatar-model.ts";
import { type Ctx, type Item, type Proj, box, disc, figure, fromPreset, makeCam, norm, polygon, project, px, py, stroke, wheel } from "./witness-2d-kit.ts";

export async function createWitnessScene2D(canvas: HTMLCanvasElement, options: WitnessOptions): Promise<WitnessHandle> {
  const g = canvas.getContext("2d");
  if (!g) throw new Error("The 2D canvas is not available");
  const driver = createDriver(options);
  const { plan, timings, words, pages } = driver;
  const palette = PALETTES[lightAt(options.hour)];
  const night = palette.stars || palette.lamp > 0.5;
  const shade = palette.lamp > 0.9 ? 0.4 : palette.lamp > 0.3 ? 0.2 : 0;
  const r = (() => { let s = (hashOf(options.venueName) % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  const stars = Array.from({ length: 120 }, () => [r(), r() * 0.8, 0.4 + r() * 0.5] as const);
  // The venue's scenery (see witness-2d-sets.ts); everything else here is common to every venue.
  const dressing = setFor(options.recipe.set)({ g, options, palette });
  const lane = dressing.lane ?? { road: "#3a3b40", kerb: "#9b9486", dash: "#e8e2cf" };
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
    g.fillStyle = dressing.ground ?? "#a35f38"; g.fillRect(0, horizon, W, H - horizon);
    dressing.backdrop?.(c, horizon, t);
    const haze = g.createLinearGradient(0, horizon - 30, 0, horizon + 50);
    haze.addColorStop(0, "rgba(255,255,255,0)"); haze.addColorStop(0.5, `${palette.skyBottom}99`); haze.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = haze; g.fillRect(0, horizon - 30, W, 80);
    const strip = (z0: number, z1: number, fill: string) => polygon(g, c, [[-60, 0, z0], [60, 0, z0], [60, 0, z1], [-60, 0, z1]], fill);
    strip(ROAD_Z - 1.7, ROAD_Z + 1.7, lane.road); strip(ROAD_Z + 1.7, ROAD_Z + 1.85, lane.kerb);
    for (let dx = -56; dx < 56; dx += 8) polygon(g, c, [[dx, 0.01, ROAD_Z - 0.07], [dx + 4, 0.01, ROAD_Z - 0.07], [dx + 4, 0.01, ROAD_Z + 0.07], [dx, 0.01, ROAD_Z + 0.07]], lane.dash);

    const items: Item[] = [...(dressing.items?.(c, t) ?? [])];

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
