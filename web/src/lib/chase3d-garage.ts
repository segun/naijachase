// Lazily loaded Babylon.js scene for the garage that follows the case briefing: the camera pans across a garage of parked cars, the
// player's avatar comes through the office door and waits beside the open-top car while the transport options are shown, then either
// climbs in and drives off or heads for the roadside with a thumb out. Built from primitives and painted textures. Timing and framing live in garage-scene.ts.
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { hex, seeded } from "./chase3d-kit.ts";
import { createStage, type SceneHandle, type SceneOptions, type Stage } from "./chase3d-stage.ts";
import { ROOM, armAngles, legAngles } from "./room-scene.ts";
import {
  CAR, DOOR, T_DRIVE_END, T_END, T_HITCH_END, carPitchAt, carZAt, doorAt, drivePoseAt, glassAt, introAlphaAt, introPoseAt, introShotAt, outroGlassAt, outroShotAt,
  hitchPoseAt, wheelAngleAt, wideShot, type GaragePose
} from "./garage-scene.ts";

export type GarageHandle = SceneHandle;
export type GarageOptions = SceneOptions;

type Wheels = TransformNode[];

/** A closed saloon in the given colour. The car faces -z, so its front (and headlights) are at the camera end. */
function saloon(stage: Stage, name: string, colour: string, x: number, z: number): { root: TransformNode; wheels: Wheels } {
  const { box, cyl, mat, caster, textured, plane, scene } = stage;
  const root = new TransformNode(name, scene);
  root.position.set(x, 0, z);
  const body = mat(colour, { specular: 0.35 });
  const dark = mat("#15191c", { specular: 0.1 });
  const glass = mat("#1b2f3d", { specular: 0.6 });
  caster(box("lower", 1.6, 0.5, 3.6, body, 0, 0.55, 0, root));
  caster(box("cabin", 1.4, 0.55, 1.9, body, 0, 1.07, 0.25, root));
  box("windows", 1.43, 0.3, 1.78, glass, 0, 1.08, 0.25, root);
  box("bumperF", 1.62, 0.16, 0.12, dark, 0, 0.36, -1.8, root);
  box("bumperB", 1.62, 0.16, 0.12, dark, 0, 0.36, 1.8, root);
  box("grille", 0.7, 0.18, 0.04, dark, 0, 0.62, -1.81, root);
  for (const s of [-1, 1]) {
    box("headlight", 0.3, 0.14, 0.04, mat("#fff4cf", { emissive: "#fff4cf", specular: 0 }), s * 0.55, 0.64, -1.81, root);
    box("taillight", 0.26, 0.12, 0.04, mat("#d63a2e", { emissive: "#8a1c14", specular: 0 }), s * 0.58, 0.64, 1.81, root);
  }
  const plate = textured(`${name}Plate`, 0.5, 0.13, g => {
    g.fillStyle = "#f6f1e1"; g.fillRect(0, 0, 256, 64); g.fillStyle = "#176b4d"; g.fillRect(0, 0, 256, 12);
    g.fillStyle = "#1b1b1b"; g.font = "bold 28px monospace"; g.fillText("KJA 482 AB", 28, 48);
  }, 256, 64);
  const front = plane("plate", plate.width, plate.height, plate.material, 0, 0.42, -1.815);
  front.parent = root;
  const wheels: Wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const hub = new TransformNode("wheel", scene);
    hub.parent = root; hub.position.set(sx * 0.8, 0.31, sz * 1.15);
    const tyre = cyl("tyre", 0.62, 0.62, 0.22, dark, 0, 0, 0, hub); tyre.rotation.z = Math.PI / 2;
    const cap = cyl("cap", 0.3, 0.3, 0.24, mat("#aeb6bb", { specular: 0.5 }), 0, 0, 0, hub); cap.rotation.z = Math.PI / 2;
    wheels.push(hub);
  }
  return { root, wheels };
}

/** The player's car: a yellow open-top runabout with a black bonnet stripe, so the driver can be seen at the wheel. */
function runabout(stage: Stage): { root: TransformNode; wheels: Wheels } {
  const { box, cyl, sphere, mat, caster, scene } = stage;
  const root = new TransformNode("runabout", scene);
  root.position.set(CAR.x, 0, CAR.z);
  const body = mat("#f2c14e", { specular: 0.4 });
  const dark = mat("#15191c", { specular: 0.1 });
  const trim = mat("#2b2f33", { specular: 0.2 });
  const seat = mat("#3b2a22", { specular: 0.1 });
  caster(box("chassis", 1.5, 0.2, 3.6, trim, 0, 0.2, 0, root));
  box("floor", 1.5, 0.06, 1.9, dark, 0, 0.3, 0.25, root);
  caster(box("hood", 1.6, 0.55, 1.15, body, 0, 0.575, -1.225, root));
  box("stripe", 0.34, 0.012, 1.15, dark, 0, 0.86, -1.225, root);
  caster(box("trunk", 1.6, 0.55, 0.6, body, 0, 0.575, 1.5, root));
  for (const s of [-1, 1]) caster(box("side", 0.07, 0.55, 1.85, body, s * 0.765, 0.575, 0.275, root));
  caster(box("dash", 1.5, 0.25, 0.3, trim, 0, 0.95, -0.5, root));
  for (const s of [-1, 1]) {
    caster(box("seatBase", 0.5, 0.12, 0.5, seat, s * 0.38, 0.59, 0.25, root));
    caster(box("seatBack", 0.5, 0.5, 0.1, seat, s * 0.38, 0.92, 0.55, root));
    box("post", 0.05, 0.5, 0.05, trim, s * 0.72, 1.3, -0.55, root).rotation.x = -0.25;
    sphere("headlight", 0.24, mat("#fff4cf", { emissive: "#fff4cf", specular: 0 }), s * 0.58, 0.7, -1.78).parent = root;
    box("taillight", 0.26, 0.12, 0.04, mat("#d63a2e", { emissive: "#8a1c14", specular: 0 }), s * 0.58, 0.7, 1.81, root);
  }
  box("windscreenTop", 1.5, 0.05, 0.05, trim, 0, 1.52, -0.62, root);
  box("windscreen", 1.4, 0.44, 0.02, mat("#9fd3f0", { specular: 0.7 }), 0, 1.3, -0.6, root).rotation.x = -0.25;
  const wheel = cyl("steering", 0.34, 0.34, 0.03, trim, -0.38, 1.03, -0.28, root);
  wheel.rotation.x = 1.15;
  box("bumperF", 1.62, 0.16, 0.12, dark, 0, 0.36, -1.8, root);
  box("bumperB", 1.62, 0.16, 0.12, dark, 0, 0.36, 1.8, root);
  const wheels: Wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const hub = new TransformNode("wheel", scene);
    hub.parent = root; hub.position.set(sx * 0.8, 0.31, sz * 1.15);
    const tyre = cyl("tyre", 0.62, 0.62, 0.22, dark, 0, 0, 0, hub); tyre.rotation.z = Math.PI / 2;
    const cap = cyl("cap", 0.3, 0.3, 0.24, mat("#aeb6bb", { specular: 0.5 }), 0, 0, 0, hub); cap.rotation.z = Math.PI / 2;
    wheels.push(hub);
  }
  return { root, wheels };
}

export async function createGarageScene(canvas: HTMLCanvasElement, options: GarageOptions): Promise<GarageHandle> {
  const stage = createStage(canvas, { hour: options.hour, quality: options.quality, minLamp: 0.6 });
  const { scene, mat, box, cyl, plane, textured, place, caster, trim, centreX } = stage;
  const shell = mat("#5d6770", { specular: 0 });
  void shell;

  for (const x of [-1.6, 1.8]) {
    const tube = new PointLight(`tube${x}`, new Vector3(x, 2.7, 1.8), scene);
    tube.diffuse = hex("#fff1d6"); tube.range = 6.5; tube.intensity = 0.55;
    box("tube", 1.4, 0.07, 0.12, mat("#fffbe8", { emissive: "#fffbe8", specular: 0 }), x, 2.95, 1.8);
    box("tubeBracket", 1.5, 0.03, 0.2, mat("#2a2f33"), x, 3.0, 1.8);
  }

  // ---- Shell: concrete floor, breeze-block walls, shutter, hazard strip and bay lines ----
  stage.buildShell("#66727c", {
    tile: 2.2,
    draw: g => {
      const r = seeded(77);
      g.fillStyle = "#4d5256"; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 1400; i++) { const v = 60 + Math.floor(r() * 40); g.fillStyle = `rgba(${v},${v + 3},${v + 6},.5)`; g.fillRect(r() * 512, r() * 512, 3, 3); }
      g.fillStyle = "rgba(20,20,20,.55)"; g.fillRect(0, 254, 512, 3); g.fillRect(254, 0, 3, 512);
      g.fillStyle = "rgba(15,15,15,.35)"; g.beginPath(); g.arc(130, 140, 38, 0, Math.PI * 2); g.fill();
    }
  });
  const blocks = textured("blocks", ROOM.maxX - ROOM.minX, 3.1, g => {
    g.fillStyle = "#66727c"; g.fillRect(0, 0, 512, 128);
    g.fillStyle = "rgba(20,25,30,.38)";
    for (let y = 0; y < 128; y += 16) { g.fillRect(0, y, 512, 2); for (let x = (y / 16) % 2 ? 0 : 16; x < 512; x += 32) g.fillRect(x, y, 2, 16); }
  }, 512, 128);
  plane("blocks", blocks.width, blocks.height, blocks.material, centreX, 1.55, ROOM.maxZ - 0.008);
  const shutter = textured("shutter", 4.9, 2.4, g => {
    g.fillStyle = "#9aa6ad"; g.fillRect(0, 0, 256, 128);
    for (let y = 0; y < 128; y += 8) { g.fillStyle = y % 16 ? "#8b979e" : "#a9b4ba"; g.fillRect(0, y, 256, 7); }
    g.fillStyle = "#2b2f33"; g.fillRect(0, 0, 256, 6); g.fillRect(0, 122, 256, 6);
  }, 256, 128);
  plane("shutter", shutter.width, shutter.height, shutter.material, 1.2, 1.25, ROOM.maxZ - 0.02);
  box("shutterBox", 5.1, 0.25, 0.14, mat("#2b2f33"), 1.2, 2.55, ROOM.maxZ - 0.07);
  const hazard = textured("hazard", ROOM.maxX - ROOM.minX, 0.14, g => {
    g.fillStyle = "#f2c14e"; g.fillRect(0, 0, 512, 16);
    g.fillStyle = "#15191c"; for (let x = -16; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 16); g.closePath(); g.fill(); }
  }, 512, 16);
  plane("hazard", hazard.width, hazard.height, hazard.material, centreX, 0.21, ROOM.maxZ - 0.03);
  const sign = textured("sign", 1.3, 0.34, g => {
    g.fillStyle = "#1c2630"; g.fillRect(0, 0, 256, 68); g.strokeStyle = "#f2c14e"; g.lineWidth = 4; g.strokeRect(4, 4, 248, 60);
    g.fillStyle = "#f2c14e"; g.font = "bold 36px monospace"; g.fillText("GARAGE", 60, 47);
  }, 256, 68);
  plane("sign", sign.width, sign.height, sign.material, -1.1, 2.5, ROOM.maxZ - 0.03);
  const door = stage.buildDoor(DOOR.x);

  const line = mat("#e8e2cf", { specular: 0 });
  for (const x of [-2.95, -1.0, 0.925, 2.85]) box("bayLine", 0.07, 0.01, 3.8, line, x, 0.012, 2.1);

  // ---- The parked cars and the player's runabout ----
  const hero = runabout(stage);
  const parked = [saloon(stage, "maroon", "#7a2a3a", -0.05, 2.1), saloon(stage, "teal", "#1d6b7a", 1.9, 2.1)];

  // ---- Garage clutter: tyres, drums, a shelf of cans ----
  const rubber = mat("#17191b", { specular: 0.15 });
  for (let i = 0; i < 4; i++) caster(cyl("tyreStack", 0.62, 0.62, 0.22, rubber, 3.75, 0.11 + i * 0.22, 3.45)).rotation.y = i * 0.5;
  for (const [x, z, c] of [[3.9, 2.4, "#c0392b"], [3.35, 2.6, "#1d6b7a"]] as const) {
    caster(cyl("drum", 0.55, 0.55, 0.85, mat(c, { specular: 0.3 }), x, 0.425, z));
    cyl("drumBand", 0.57, 0.57, 0.05, mat("#2a2f33"), x, 0.55, z);
  }
  box("shelf", 0.9, 0.05, 0.4, mat("#6d4a2a"), 3.55, 1.5, ROOM.maxZ - 0.25);
  box("shelf2", 0.9, 0.05, 0.4, mat("#6d4a2a"), 3.55, 1.1, ROOM.maxZ - 0.25);
  for (let i = 0; i < 4; i++) { cyl("can", 0.14, 0.14, 0.22, mat(i % 2 ? "#c0392b" : "#f2c14e"), 3.25 + i * 0.2, 1.64, ROOM.maxZ - 0.25); cyl("can2", 0.14, 0.14, 0.22, mat("#1d6b7a"), 3.25 + i * 0.2, 1.24, ROOM.maxZ - 0.25); }
  void place; void trim;

  // ---- The player ----
  const figure = stage.addFigure(options.preset);
  const pose = (p: GaragePose, t: number) => {
    if (!figure) return;
    figure.root.position.set(p.x, p.y, p.z);
    figure.root.rotation.y = p.heading;
    const legs = legAngles(p);
    figure.rig.hips.forEach((h, i) => { h.rotation.x = legs.hips[i]!; });
    figure.rig.knees.forEach((k, i) => { k.rotation.x = legs.knees[i]!; });
    const arms = armAngles(p, t);
    figure.rig.shoulders.forEach((s, i) => { s.rotation.x = i === 1 ? arms[i]! + (2.7 - arms[i]!) * p.thumb : arms[i]!; });
    figure.setAlpha(p.visible ? p.alpha : 0);
  };
  const park = () => { hero.root.position.z = CAR.z; hero.root.rotation.x = 0; };
  const aim = (shot: ReturnType<typeof wideShot>) => stage.aim(shot);

  // Intro: pan across the garage while the player comes through the door.
  const intro = (t: number) => {
    pose(introPoseAt(t), t);
    door.rotation.y = doorAt(t) * 1.75;
    park();
    aim(introShotAt(t));
    options.onGlass(glassAt(t));
  };
  void introAlphaAt;

  // Drive: climb in, start up, leave. The player rides with the car.
  const drive = (t: number) => {
    pose(drivePoseAt(t), t);
    door.rotation.y = 1.75;
    hero.root.position.z = carZAt(t);
    hero.root.rotation.x = carPitchAt(t);
    hero.wheels.forEach(w => { w.rotation.x = wheelAngleAt(t); });
    aim(outroShotAt("drive", t));
    options.onGlass(outroGlassAt(t));
  };

  // Hitch a ride: turn and head for the roadside with a thumb out.
  const hitch = (t: number) => {
    pose(hitchPoseAt(t), t);
    door.rotation.y = 1.75;
    park();
    aim(outroShotAt("hitch", t));
    options.onGlass(outroGlassAt(t));
  };

  const handle = stage.run({ end: T_END, update: intro, onSlow: options.onSlow, startSeconds: options.startSeconds });
  void parked;
  return {
    ...handle,
    leave: how => handle.play(how === "hitch" ? { end: T_HITCH_END, update: hitch } : { end: T_DRIVE_END, update: drive })
  };
}

export type { StandardMaterial };
