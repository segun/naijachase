import { chaseFrame, fitChaseFrame, type ChaseFrame } from "./chase-frame.ts";
import { BIOMES, RING, SPEED, smoothstep, type Rgb } from "./chase-biomes.ts";
import { sirenLevels, treadmillX } from "./chase-motion.ts";

const css = (rgb: Rgb) => `rgb(${rgb.map(v => Math.round(v * 255)).join(",")})`;

export function createChase2d(canvas: HTMLCanvasElement, seconds: () => number, reducedMotion: boolean, onFault: (error: unknown) => void, timeline: (seconds: number) => ChaseFrame = chaseFrame) {
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Canvas 2D is unavailable");
  let raf = 0, disposed = false;
  const draw = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
    }
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    const frame = fitChaseFrame(timeline(reducedMotion ? 0 : seconds()), w / h), p = frame.palette;
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, css(p.skyTop)); sky.addColorStop(1, css(p.skyHorizon));
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const [cx, cy, cz] = frame.camera;
    const [tx, ty, tz] = frame.target;
    const length = Math.hypot(tx - cx, ty - cy, tz - cz);
    const forward = [(tx - cx) / length, (ty - cy) / length, (tz - cz) / length];
    const sideLength = Math.hypot(forward[0]!, forward[2]!);
    const right = [forward[2]! / sideLength, 0, -forward[0]! / sideLength];
    const up = [-forward[1]! * right[2]!, forward[2]! * right[0]! - forward[0]! * right[2]!, forward[1]! * right[0]!];
    const focal = h / (2 * Math.tan(0.85 / 2));
    const point = (x: number, y: number, z: number) => {
      const d = [x - cx, y - cy, z - cz];
      const depth = d.reduce((sum, v, i) => sum + v * forward[i]!, 0);
      if (depth <= .1) return { x: -100000, y: -100000, k: 0 };
      return { x: w / 2 + focal * d.reduce((sum, v, i) => sum + v * right[i]!, 0) / depth,
        y: h / 2 - focal * d.reduce((sum, v, i) => sum + v * up[i]!, 0) / depth, k: focal / depth };
    };
    const rect = (x: number, y: number, z: number, width: number, height: number, color: string) => {
      const a = point(x, y + height, z), b = point(x + width, y, z);
      if (!a.k || !b.k) return;
      g.fillStyle = color; g.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    };
    g.fillStyle = css(p.ground); g.fillRect(0, h * .55, w, h * .45);
    g.fillStyle = css(p.road); g.fillRect(0, point(0, 0, 3.5).y, w, h);
    BIOMES.forEach((biome, i) => {
      const presence = smoothstep(.02, .4, frame.weights[i]!);
      if (presence < .001) return;
      g.globalAlpha = presence;
      for (let k = -6; k <= 6; k++) {
        const x = treadmillX(biome.center + k * 12, frame.worldTime, SPEED, RING);
        if (Math.abs(x) > 60) continue;
        if (i === 0) {
          rect(x, -34 * (1 - presence), 80, 8, 24 + (k * k % 4) * 10, "#244d55");
          rect(x, 0, 6.3, .3, 5, "#6b4a2a");
          const top = point(x, 5.2, 6.3); g.fillStyle = "#2f7d3f";
          g.beginPath(); g.ellipse(top.x, top.y, 1.8 * top.k, .5 * top.k, -.2, 0, Math.PI * 2); g.fill();
        } else if (i === 1) {
          rect(x, 0, 10.5, 8, 5 + (k * k % 3), "#9b7040");
          rect(x, .8, 5.6, 2.2, .2, "#cdb98a"); rect(x - .3, 2.5, 5.6, 2.9, .2, "#bd4141");
          rect(x, 0, 5.6, .08, 2.5, "#7a5230"); rect(x + 2, 0, 5.6, .08, 2.5, "#7a5230");
        } else {
          rect(x, 0, 20, 6, 4.2, "#b98a5a"); rect(x + 2, 0, 19.9, 1.2, 2.2, "#2a1a10");
          const a = point(x, 0, 11), b = point(x + 7, 0, 11), c = point(x + 3.5, 6, 11);
          g.fillStyle = "#d4be86"; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.fill();
        }
      }
      const signX = treadmillX(biome.center + 3, frame.worldTime, SPEED, RING);
      rect(signX - 3.6, 1.4, 7.4, 7.2, 3, "#176b4d");
      const sign = point(signX, 3, 7.4);
      g.font = `bold ${Math.max(10, sign.k * .45)}px sans-serif`; g.textAlign = "center";
      g.fillStyle = "#ffd36b"; g.fillText(biome.name, sign.x, sign.y);
    });
    g.globalAlpha = 1;
    for (const r of [...frame.runners].sort((a, b) => b.z - a.z)) {
      const base = point(r.x, r.pose.bodyY, r.z);
      // Seen side-on, a turn shows as narrowing and, past a quarter turn, facing the other way.
      const facing = Math.cos(r.heading ?? 0);
      g.save(); g.translate(base.x, base.y); g.scale(base.k * (facing < 0 ? -1 : 1) * Math.max(0.55, Math.abs(facing)), -base.k);
      g.lineCap = "round";
      const limb = (y: number, upper: number, lower: number, a: number, b: number, color: string, width: number) => {
        const x1 = Math.sin(a) * upper, y1 = y - Math.cos(a) * upper;
        g.strokeStyle = color; g.lineWidth = width;
        g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y1); g.lineTo(x1 + Math.sin(a + b) * lower, y1 - Math.cos(a + b) * lower); g.stroke();
      };
      const thief = r.name === "thief";
      limb(.95, .48, .47, r.pose.thighL, r.pose.shinL, "#161b20", .16);
      limb(.95, .48, .47, r.pose.thighR, r.pose.shinR, "#161b20", .16);
      g.save(); g.translate(0, .95); g.rotate(r.pose.lean);
      g.fillStyle = thief ? "#ece8dc" : "#232a31"; g.fillRect(-.16, 0, .32, .66);
      if (thief) {
        g.fillStyle = "#141414"; for (let i = 0; i < 4; i++) g.fillRect(-.16, .05 + i * .15, .32, .07);
        g.fillStyle = "#8b5a2b"; g.beginPath(); g.ellipse(-.3, .4, .22, .28, 0, 0, Math.PI * 2); g.fill();
      }
      limb(.55, .3, .29, r.pose.armL, r.pose.elbowL, thief ? "#ece8dc" : "#232a31", .12);
      limb(.55, .3, .29, r.pose.armR, r.pose.elbowR, "#5a3820", .1);
      if (r.baton) {
        const x = Math.sin(r.pose.armR) * .3 + Math.sin(r.pose.armR + r.pose.elbowR) * .29;
        const y = .55 - Math.cos(r.pose.armR) * .3 - Math.cos(r.pose.armR + r.pose.elbowR) * .29;
        g.strokeStyle = "#050506"; g.lineWidth = .045;
        g.beginPath(); g.moveTo(x, y - .15); g.lineTo(x, y + .4); g.stroke();
      }
      g.fillStyle = thief ? "#141414" : "#5a3820"; g.beginPath(); g.arc(0, .85 + r.pose.headBob, .15, 0, Math.PI * 2); g.fill();
      g.fillStyle = thief ? "#6b4226" : "#101317"; g.fillRect(.04, (thief ? .85 : .95) + r.pose.headBob, .15, .05);
      g.restore();
      g.restore();
    }
    const siren = sirenLevels(frame.seconds);
    g.fillStyle = siren.red ? "rgba(255,59,48,.05)" : siren.blue ? "rgba(47,123,255,.05)" : "transparent";
    g.fillRect(0, 0, w, h);
  };
  const tick = () => {
    if (disposed) return;
    try { draw(); } catch (error) { disposed = true; onFault(error); return; }
    if (!reducedMotion) raf = requestAnimationFrame(tick);
  };
  const resize = new ResizeObserver(() => { if (reducedMotion && !disposed) tick(); });
  resize.observe(canvas); tick();
  return { dispose() { disposed = true; cancelAnimationFrame(raf); resize.disconnect(); } };
}
