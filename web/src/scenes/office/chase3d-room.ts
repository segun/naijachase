// Lazily loaded Babylon.js scene for the post-login "room": the player's avatar walks in, sits at a computer and the camera
// pushes in until the monitor fills the screen, where the DOM terminal takes over. Everything is built from primitives and
// painted textures; there are no model files. Timing and framing live in room-scene.ts so they can be unit-tested.
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { hex, seeded } from "../shared/chase3d-kit.ts";
import { createStage, type SceneHandle, type SceneOptions } from "../shared/chase3d-stage.ts";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { MAP_H, MAP_W, outlinePath, statePoint } from "../../domain/map.ts";
import { ROOM, armAngles, legAngles, type Pose } from "../shared/scene-core.ts";
import {
  DESK, DOOR, SCREEN, SEAT, T_END, T_OUT_END, avatarAlpha, chairAt, doorAt, glassAt, outroAlphaAt, outroChairAt, outroGlassAt, outroPoseAt, outroShotAt, poseAt, shotAt
} from "./room-scene.ts";

export type RoomHandle = SceneHandle;
export type RoomOptions = SceneOptions;

export async function createRoomScene(canvas: HTMLCanvasElement, options: RoomOptions): Promise<RoomHandle> {
  const stage = createStage(canvas, { hour: options.hour, quality: options.quality, models: options.models });
  const { scene, palette, mat, box, cyl, plane, textured, place, caster: casters, trim, wood, darkWood, centreX, light } = stage;

  const lamp = new PointLight("lamp", new Vector3(0.1, 1.45, 3.4), scene);
  lamp.diffuse = hex("#ffb870"); lamp.range = 3.5; lamp.intensity = palette.lamp * 0.9;
  const glow = new PointLight("glow", new Vector3(SCREEN.x, SCREEN.y, SCREEN.z - 0.35), scene);
  glow.diffuse = hex("#7dffb0"); glow.range = 2.2; glow.intensity = 0.3;

  // ---- Room shell: floor, three walls (the fourth is cut away for the camera), skirting and a rug ----
  stage.buildShell("#245a4c", {
    tile: 2.4,
    draw: g => {
      const r = seeded(11);
      g.fillStyle = "#8a5b36"; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 8; i++) {
        const shade = Math.floor(r() * 26) - 13;
        g.fillStyle = `rgb(${138 + shade},${91 + shade},${54 + shade})`; g.fillRect(i * 64, 0, 62, 512);
        g.fillStyle = "rgba(40,20,8,.35)"; g.fillRect(i * 64 + 62, 0, 2, 512);
        for (let y = Math.floor(r() * 200); y < 512; y += 180 + Math.floor(r() * 140)) { g.fillStyle = "rgba(40,20,8,.35)"; g.fillRect(i * 64, y, 62, 2); }
      }
    }
  });
  box("dado", ROOM.maxX - ROOM.minX, 0.05, 0.04, trim, centreX, 1.0, ROOM.maxZ - 0.02);
  box("wainscot", ROOM.maxX - ROOM.minX, 0.86, 0.02, mat("#1b463b", { specular: 0 }), centreX, 0.57, ROOM.maxZ - 0.01);

  const rug = textured("rug", 3.4, 2.4, g => {
    g.fillStyle = "#7a1f2b"; g.fillRect(0, 0, 512, 360);
    g.strokeStyle = "#f2c14e"; g.lineWidth = 8; g.strokeRect(14, 14, 484, 332);
    g.strokeStyle = "#176b4d"; g.lineWidth = 14; g.strokeRect(34, 34, 444, 292);
    // Ankara-style repeating motif: nested diamonds in green and gold.
    for (let x = 80; x < 460; x += 64) for (let y = 78; y < 300; y += 64) {
      for (const [r, c] of [[26, "#f2c14e"], [18, "#176b4d"], [9, "#f4ebd3"]] as const) {
        g.fillStyle = c; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill();
      }
    }
  }, 512, 360);
  place(CreateGround("rug", { width: 3.4, height: 2.4 }, scene), rug.material, DESK.x, 0.008, 2.55);

  const hinge = stage.buildDoor(DOOR.x);

  // ---- Window with a painted sky for the time of day ----
  const win = { x: 3.3, y: 1.75, w: 1.3, h: 1.15 };
  const sky = textured("sky", win.w, win.h, g => {
    const gradient = g.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, palette.skyTop); gradient.addColorStop(1, palette.skyBottom);
    g.fillStyle = gradient; g.fillRect(0, 0, 256, 256);
    const r = seeded(7);
    if (palette.stars) for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.5})`; g.fillRect(r() * 256, r() * 150, 2, 2); }
    g.fillStyle = palette.orbColor; g.beginPath(); g.arc(palette.orb === "moon" ? 70 : 178, palette.orb === "moon" ? 60 : 78, palette.orb === "moon" ? 16 : 22, 0, Math.PI * 2); g.fill();
    // Lagos-style skyline silhouette with lit windows after dark.
    const night = palette.stars || palette.lamp > 0.5;
    g.fillStyle = night ? "#070d1e" : "#3d5a66";
    for (let x = 0, i = 0; x < 256; x += 22 + (i % 3) * 6, i++) { const h = 50 + ((i * 37) % 70); g.fillRect(x, 256 - h, 20 + (i % 2) * 5, h); }
    if (night) { g.fillStyle = "#ffd27a"; for (let i = 0; i < 46; i++) g.fillRect(r() * 250, 190 + r() * 60, 3, 3); }
  }, 256, 256);
  sky.material.emissiveTexture = sky.material.diffuseTexture; sky.material.disableLighting = true;
  plane("window", sky.width, sky.height, sky.material, win.x, win.y, ROOM.maxZ - 0.012);
  for (const [w, h, x, y] of [[win.w + 0.16, 0.08, 0, win.h / 2 + 0.04], [win.w + 0.16, 0.08, 0, -win.h / 2 - 0.04], [0.08, win.h, -win.w / 2 - 0.04, 0], [0.08, win.h, win.w / 2 + 0.04, 0], [0.04, win.h, 0, 0], [win.w, 0.04, 0, 0]] as const)
    box("windowFrame", w, h, 0.07, trim, win.x + x, win.y + y, ROOM.maxZ - 0.04);
  box("windowSill", win.w + 0.3, 0.05, 0.16, trim, win.x, win.y - win.h / 2 - 0.1, ROOM.maxZ - 0.08);

  // ---- Case board: cork, a map of Nigeria, photos and red string ----
  const board = textured("board", 1.7, 1.15, g => {
    g.fillStyle = "#b98a56"; g.fillRect(0, 0, 512, 346);
    const r = seeded(21);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${80 + r() * 60},${50 + r() * 40},20,.18)`; g.fillRect(r() * 512, r() * 346, 2, 2); }
    g.save(); g.translate(150, 28); g.scale(0.3, 0.3);
    g.fillStyle = "#f4ebd3"; g.fillRect(-20, -20, MAP_W + 40, MAP_H + 40);
    g.fillStyle = "#176b4d"; (g as unknown as { fill(p: Path2D): void }).fill(new Path2D(outlinePath()));
    g.restore();
    const pins = ["Lagos", "Oyo", "Kogi", "Federal Capital Territory", "Kaduna", "Kano"].map(s => statePoint(s)!).map(p => [150 + p.x * 0.3, 28 + p.y * 0.3] as const);
    g.strokeStyle = "#d83a2e"; g.lineWidth = 2; g.beginPath(); pins.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.fillStyle = "#d83a2e"; pins.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); });
    for (const [x, y, rot] of [[24, 40, -0.1], [30, 190, 0.08], [440, 60, 0.07], [430, 215, -0.06]] as const) {
      g.save(); g.translate(x + 32, y + 36); g.rotate(rot); g.fillStyle = "#f6f1e1"; g.fillRect(-32, -36, 64, 72); g.fillStyle = "#33413b"; g.fillRect(-26, -30, 52, 46);
      g.fillStyle = "#d83a2e"; g.beginPath(); g.arc(0, -36, 4, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }, 512, 346);
  box("boardFrame", 1.82, 1.27, 0.05, wood, -1.3, 1.85, ROOM.maxZ - 0.03);
  plane("board", board.width, board.height, board.material, -1.3, 1.85, ROOM.maxZ - 0.062);

  // ---- Wall clock showing the real time ----
  const now = new Date();
  const clock = textured("clock", 0.46, 0.46, g => {
    g.fillStyle = "#f6f1e1"; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#1a1a1a"; g.lineWidth = 8; g.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100); g.lineTo(128 + Math.sin(a) * 114, 128 - Math.cos(a) * 114); g.stroke(); }
    const hand = (fraction: number, length: number, thick: number) => { const a = fraction * Math.PI * 2; g.lineWidth = thick; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a) * length, 128 - Math.cos(a) * length); g.stroke(); };
    hand(((now.getHours() % 12) + now.getMinutes() / 60) / 12, 62, 9); hand(now.getMinutes() / 60, 94, 6);
  }, 256, 256);
  plane("clock", clock.width, clock.height, clock.material, DESK.x, 2.45, ROOM.maxZ - 0.02);

  // ---- Desk, monitor, keyboard, lamp and clutter ----
  const metal = mat("#2a2f33", { specular: 0.3 });
  const beige = mat("#d2c7aa", { specular: 0.18 });
  const deskGroup = new TransformNode("desk", scene);
  casters(box("deskTop", 2.1, 0.06, 0.95, wood, DESK.x, DESK.top - 0.03, DESK.z, deskGroup));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) casters(box("deskLeg", 0.07, DESK.top - 0.06, 0.07, darkWood, DESK.x + sx * 0.97, (DESK.top - 0.06) / 2, DESK.z + sz * 0.4, deskGroup));
  box("deskPanel", 2.0, 0.4, 0.03, darkWood, DESK.x, DESK.top - 0.26, DESK.z + 0.42, deskGroup);

  // A chunky CRT monitor: boxy body, tapered back, a stand and a glass that shows a boot prompt.
  const monitor = new TransformNode("monitor", scene);
  monitor.position.set(DESK.x, DESK.top, DESK.z + 0.05);
  casters(box("crtBody", 0.68, 0.56, 0.2, beige, 0, 0.36, 0, monitor));
  casters(box("crtBack", 0.46, 0.38, 0.32, beige, 0, 0.36, 0.26, monitor));
  casters(cyl("crtStand", 0.2, 0.3, 0.08, beige, 0, 0.04, 0, monitor));
  box("crtBezel", 0.58, 0.45, 0.02, mat("#a89d82", { specular: 0.1 }), 0, 0.36, -0.105, monitor);
  const screen = textured("screen", SCREEN.w, SCREEN.h, g => {
    g.fillStyle = "#031a0e"; g.fillRect(0, 0, 512, 384);
    g.fillStyle = "#7dffb0"; g.font = "bold 30px monospace";
    g.fillText("NAIJA CHASE", 36, 70); g.font = "22px monospace";
    g.fillText("AGENCY TERMINAL v1", 36, 106); g.fillText("> badge verified", 36, 170); g.fillText("> case files synced", 36, 204); g.fillText("> _", 36, 238);
    for (let y = 0; y < 384; y += 4) { g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(0, y, 512, 2); }
  }, 512, 384);
  screen.material.emissiveTexture = screen.material.diffuseTexture; screen.material.disableLighting = true;
  plane("screenGlass", screen.width, screen.height, screen.material, SCREEN.x, SCREEN.y, SCREEN.z);
  box("keyboard", 0.5, 0.03, 0.17, beige, DESK.x, DESK.top + 0.015, 3.02);
  box("keys", 0.46, 0.012, 0.13, mat("#55524a", { specular: 0.05 }), DESK.x, DESK.top + 0.035, 3.02);
  box("mouse", 0.06, 0.03, 0.1, beige, DESK.x + 0.45, DESK.top + 0.015, 3.04);
  box("mouseMat", 0.24, 0.006, 0.2, mat("#176b4d", { specular: 0 }), DESK.x + 0.45, DESK.top + 0.003, 3.04);

  const lampBase = cyl("lampBase", 0.12, 0.16, 0.03, metal, 0.1, DESK.top + 0.015, 3.62);
  cyl("lampArm", 0.02, 0.02, 0.5, metal, 0.1, DESK.top + 0.27, 3.62).rotation.z = 0.2;
  casters(lampBase);
  const bulb = cyl("lampShade", 0.07, 0.24, 0.16, mat("#2f6b53", { emissive: palette.lamp > 0.1 ? "#ffb870" : "#000000", specular: 0.1 }), 0.2, DESK.top + 0.5, 3.62);
  bulb.rotation.z = 0.35;
  box("papers", 0.34, 0.03, 0.24, mat("#f4ebd3", { specular: 0 }), DESK.x - 0.65, DESK.top + 0.015, 3.15).rotation.y = 0.2;
  box("folder", 0.28, 0.025, 0.2, mat("#c9a24a", { specular: 0 }), DESK.x - 0.65, DESK.top + 0.04, 3.15).rotation.y = -0.15;
  cyl("mug", 0.08, 0.075, 0.1, mat("#f6f1e1", { specular: 0.3 }), DESK.x + 0.75, DESK.top + 0.05, 3.1);

  // ---- Filing cabinet and plants ----
  casters(box("cabinet", 0.55, 0.95, 0.5, mat("#6b7780", { specular: 0.25 }), 2.75, 0.475, 3.68));
  for (const y of [0.2, 0.5, 0.8]) box("drawer", 0.5, 0.26, 0.02, mat("#8b97a0", { specular: 0.3 }), 2.75, y, 3.42);
  const leaf = mat("#2a9a5a", { specular: 0.05 });
  for (const [px, pz] of [[4.0, 3.5], [-4.05, 3.45]] as const) {
    casters(cyl("pot", 0.36, 0.28, 0.35, mat("#a64b2a", { specular: 0.1 }), px, 0.175, pz));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const l = place(CreateSphere("leaf", { diameter: 0.4, segments: 8 }, scene), leaf, px + Math.cos(a) * 0.2, 0.7 + (i % 3) * 0.2, pz + Math.sin(a) * 0.2);
      l.scaling.set(0.5, 1.5, 0.5); l.rotation.z = Math.cos(a) * 0.45; l.rotation.x = Math.sin(a) * 0.45;
      casters(l);
    }
  }

  // ---- Chair: pulled out at first, then slid in as the player sits ----
  const chair = new TransformNode("chair", scene);
  const fabric = mat("#2d3b4a", { specular: 0.05 });
  casters(box("seat", 0.5, 0.08, 0.5, fabric, 0, 0.34, 0, chair));
  casters(box("back", 0.48, 0.5, 0.07, fabric, 0, 0.66, -0.25, chair));
  casters(cyl("pole", 0.06, 0.06, 0.3, metal, 0, 0.17, 0, chair));
  for (let i = 0; i < 5; i++) {
    const arm = box("caster", 0.32, 0.03, 0.05, metal, 0, 0.03, 0, chair);
    arm.rotation.y = (i / 5) * Math.PI * 2; arm.position.set(Math.sin(arm.rotation.y) * 0.16, 0.04, Math.cos(arm.rotation.y) * 0.16);
    arm.rotation.y -= Math.PI / 2;
  }

  // ---- The player ----
  const figure = stage.addFigure(options.preset);

  const pose = (p: Pose, t: number, alpha: number) => {
    if (!figure) return;
    figure.root.position.set(p.x, p.y, p.z);
    figure.root.rotation.y = p.heading;
    const legs = legAngles(p);
    figure.rig.hips.forEach((h, i) => { h.rotation.x = legs.hips[i]!; });
    figure.rig.knees.forEach((k, i) => { k.rotation.x = legs.knees[i]!; });
    const arms = armAngles(p, t);
    figure.rig.shoulders.forEach((s, i) => { s.rotation.x = arms[i]!; });
    figure.setAlpha(p.visible ? alpha : 0);
  };
  const seat = (slide: number) => {
    chair.position.set(SEAT.x + (1 - slide) * 0.08, 0, SEAT.z - 0.3 * (1 - slide));
    chair.rotation.y = (1 - slide) * -0.7;
  };

  // ---- Intro: walk in, sit, zoom into the monitor ----
  const update = (t: number) => {
    pose(poseAt(t), t, avatarAlpha(t));
    hinge.rotation.y = doorAt(t) * 1.75;
    seat(chairAt(t));
    stage.aim(shotAt(t, stage.engine.getRenderWidth(), stage.engine.getRenderHeight()));
    options.onGlass(glassAt(t));
  };

  // ---- Outro: pull back from the monitor, stand up and walk out of the door ----
  const outro = (t: number) => {
    const p = outroPoseAt(t);
    pose(p, t, outroAlphaAt(t));
    hinge.rotation.y = 1.75;
    seat(outroChairAt(t));
    stage.aim(outroShotAt(t, p, stage.engine.getRenderWidth(), stage.engine.getRenderHeight()));
    options.onGlass(outroGlassAt(t));
  };

  const handle = stage.run({ end: T_END, update, onSlow: options.onSlow, startSeconds: options.startSeconds });
  return { ...handle, leave: () => handle.play({ end: T_OUT_END, update: outro }) };
}
