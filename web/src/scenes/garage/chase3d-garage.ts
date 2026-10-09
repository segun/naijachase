// Lazily loaded Babylon.js scene for the garage that follows the case briefing: the camera pans across a garage of parked cars, the
// player's avatar comes through the office door and waits beside the open-top car while the transport options are shown, then either
// climbs in and drives off or heads for the roadside with a thumb out. Built from primitives and painted textures. Timing and framing live in garage-scene.ts.
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { hex, seeded } from "../shared/chase3d-kit.ts";
import { createStage, type SceneHandle, type SceneOptions } from "../shared/chase3d-stage.ts";
import { runabout, saloon } from "../shared/chase3d-cars.ts";
import { ROOM, armAngles, legAngles } from "../shared/scene-core.ts";
import {
  CAR, DOOR, T_DRIVE_END, T_END, T_HITCH_END, carPitchAt, carZAt, doorAt, drivePoseAt, glassAt, introAlphaAt, introPoseAt, introShotAt, outroGlassAt, outroShotAt,
  hitchPoseAt, wheelAngleAt, wideShot, type GaragePose
} from "./garage-scene.ts";

export type GarageHandle = SceneHandle;
export type GarageOptions = SceneOptions;

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
  hero.root.position.set(CAR.x, 0, CAR.z);
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
