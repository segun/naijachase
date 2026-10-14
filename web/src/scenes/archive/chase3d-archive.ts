// Lazily loaded Babylon.js scene for the case archive: the player walks into a records room, takes a file off a shelf and turns
// to show it, and the camera zooms onto the file where the DOM sheet takes over. Built from primitives and painted textures.
// Timing and framing live in archive-scene.ts so they can be unit-tested.
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { hex, seeded } from "../shared/chase3d-kit.ts";
import { createStage, type Ctx, type SceneHandle, type SceneOptions } from "../shared/chase3d-stage.ts";
import { ROOM, legAngles, type Pose } from "../shared/scene-core.ts";
import { DOOR, FILE, SLOT, T_END, armAngles, avatarAlpha, doorAt, fileAt, glassAt, poseAt, shotAt } from "./archive-scene.ts";

export type ArchiveHandle = SceneHandle;
export type ArchiveOptions = SceneOptions;

const UNIT = { w: 1.5, h: 2.8, d: 0.45 };
const UNIT_X = [-0.05, 1.45, 2.95];
const PLANKS = [0.1, 0.7, 1.4, 2.1, 2.75];
/** Window left empty on the first unit so the file is seen standing alone before it is taken. */
const GAP = { unit: 0, row: 2, u: 1.35 / UNIT.w, half: 0.26 / UNIT.w };

export async function createArchiveScene(canvas: HTMLCanvasElement, options: ArchiveOptions): Promise<ArchiveHandle> {
  options.signal?.throwIfAborted();
  const stage = createStage(canvas, { hour: options.hour, quality: options.quality, models: options.models, minLamp: 0.85 });
  const abort = () => { stage.scene.dispose(); stage.engine.dispose(); };
  options.signal?.addEventListener("abort", abort, { once: true });
  stage.scene.onDisposeObservable.addOnce(() => options.signal?.removeEventListener("abort", abort));
  const { scene, palette, mat, box, cyl, sphere, plane, textured, place, caster: casters, trim, wood, darkWood } = stage;

  for (const x of [0.5, 2.8]) {
    const pendant = new PointLight(`pendant${x}`, new Vector3(x, 2.45, 2.6), scene);
    pendant.diffuse = hex("#ffc880"); pendant.range = 4.5; pendant.intensity = palette.lamp * 0.65;
  }

  // ---- Shell: stone floor, slate walls, a runner along the walking line and a sign over the door ----
  stage.buildShell("#2f4352", {
    tile: 2.0,
    draw: g => {
      const r = seeded(31);
      g.fillStyle = "#6a6258"; g.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const shade = Math.floor(r() * 22) - 11;
        g.fillStyle = `rgb(${106 + shade},${98 + shade},${88 + shade})`; g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
      }
    }
  });
  const runner = textured("runner", 4.6, 1.0, g => {
    g.fillStyle = "#6f1d2b"; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = "#e0b04a"; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
    g.fillStyle = "#e0b04a";
    for (let x = 40; x < 480; x += 48) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 14, 50); g.lineTo(x + 28, 64); g.lineTo(x + 14, 78); g.closePath(); g.fill(); }
  }, 512, 128);
  place(CreateGround("runner", { width: 4.6, height: 1.0 }, scene), runner.material, -0.2, 0.008, 3.0);

  const sign = textured("sign", 0.9, 0.24, g => {
    g.fillStyle = "#1c2630"; g.fillRect(0, 0, 256, 68);
    g.strokeStyle = "#e0b04a"; g.lineWidth = 4; g.strokeRect(4, 4, 248, 60);
    g.fillStyle = "#e0b04a"; g.font = "bold 34px monospace"; g.fillText("ARCHIVE", 56, 47);
  }, 256, 68);
  plane("sign", sign.width, sign.height, sign.material, DOOR.x, 2.45, ROOM.maxZ - 0.02);
  const hinge = stage.buildDoor(DOOR.x);

  // ---- Shelving along the back wall: real frames and planks over a painted back panel of books and archive boxes ----
  const bookRows = [0, 1, 2, 3];
  UNIT_X.forEach((cx, unit) => {
    const spines = textured(`books${unit}`, UNIT.w, UNIT.h, g => {
      const r = seeded(101 + unit * 17);
      g.fillStyle = "#1a1612"; g.fillRect(0, 0, 256, 512);
      const rowSpan = PLANKS.slice(1).map((top, i) => [PLANKS[i]!, top] as const);
      bookRows.forEach(row => {
        const [low, high] = rowSpan[row]!;
        const floorY = 512 - ((low + 0.04) / UNIT.h) * 512;
        const maxH = ((high - low - 0.08) / UNIT.h) * 512;
        let x = 6;
        while (x < 250) {
          const w = 8 + Math.floor(r() * 12);
          const boxLike = r() < 0.22;
          const h = boxLike ? maxH * 0.78 : maxH * (0.62 + r() * 0.36);
          const bw = boxLike ? w * 2.4 : w;
          const inGap = unit === GAP.unit && row === GAP.row && Math.abs(x / 256 - GAP.u) < GAP.half;
          if (!inGap) {
            const hue = Math.floor(r() * 360);
            g.fillStyle = boxLike ? "#c9b48a" : `hsl(${hue},${35 + r() * 30}%,${28 + r() * 18}%)`;
            g.fillRect(x, floorY - h, bw, h);
            g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(x + bw - 2, floorY - h, 2, h);
            if (boxLike) { g.fillStyle = "#f4ebd3"; g.fillRect(x + 4, floorY - h * 0.7, bw - 8, h * 0.22); }
            else { g.fillStyle = "rgba(255,235,180,.55)"; g.fillRect(x + 2, floorY - h * 0.8, w - 4, 3); }
          }
          x += bw + 1 + (r() < 0.12 ? 10 : 0);
        }
      });
    }, 256, 512);
    plane(`shelfBack${unit}`, UNIT.w, UNIT.h, spines.material, cx, UNIT.h / 2, ROOM.maxZ - 0.012);
    for (const side of [-1, 1]) box("shelfSide", 0.05, UNIT.h, UNIT.d, darkWood, cx + side * (UNIT.w / 2 - 0.025), UNIT.h / 2, ROOM.maxZ - UNIT.d / 2);
    for (const y of PLANKS) box("plank", UNIT.w, 0.05, UNIT.d, wood, cx, y, ROOM.maxZ - UNIT.d / 2);
  });

  // ---- Ladder, cabinets, stacked boxes, a reading table ----
  const metal = mat("#2a2f33", { specular: 0.3 });
  for (const x of [3.55, 3.85]) box("ladderRail", 0.05, 2.6, 0.05, darkWood, x, 1.3, 3.3).rotation.x = -0.1;
  for (let i = 0; i < 7; i++) box("rung", 0.35, 0.04, 0.05, darkWood, 3.7, 0.3 + i * 0.35, 3.3 + (0.3 + i * 0.35) * 0.1);
  for (const [x, h] of [[-3.7, 1.3], [-3.15, 1.3]] as const) {
    casters(box("cabinet", 0.5, h, 0.5, mat("#5f6c75", { specular: 0.25 }), x, h / 2, 3.68));
    for (const y of [0.25, 0.65, 1.05]) box("drawer", 0.44, 0.34, 0.02, mat("#7f8d97", { specular: 0.3 }), x, y, 3.42);
  }
  const cardboard = mat("#c9b48a", { specular: 0.02 });
  for (const [x, z, n] of [[-3.9, 2.8, 3], [-3.35, 2.75, 2], [4.0, 2.4, 2]] as const)
    for (let i = 0; i < n; i++) {
      const b = casters(box("archiveBox", 0.55, 0.32, 0.4, cardboard, x, 0.16 + i * 0.33, z));
      b.rotation.y = (i % 2 ? 0.1 : -0.06);
      box("boxLabel", 0.2, 0.1, 0.01, mat("#f4ebd3", { specular: 0 }), x, 0.17 + i * 0.33, z - 0.206).rotation.y = b.rotation.y;
    }

  casters(box("tableTop", 1.6, 0.06, 0.8, wood, 2.9, 0.78, 1.2));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) casters(box("tableLeg", 0.06, 0.75, 0.06, darkWood, 2.9 + sx * 0.72, 0.375, 1.2 + sz * 0.33));
  box("tablePapers", 0.4, 0.03, 0.3, mat("#f4ebd3", { specular: 0 }), 2.5, 0.825, 1.2).rotation.y = 0.2;
  box("tableFolder", 0.32, 0.04, 0.24, mat("#c9a24a", { specular: 0 }), 3.2, 0.84, 1.3).rotation.y = -0.2;
  cyl("tableLampBase", 0.1, 0.14, 0.03, metal, 2.9, 0.825, 1.05);
  cyl("tableLampShade", 0.08, 0.22, 0.15, mat("#2f6b53", { emissive: "#ffb870", specular: 0.1 }), 2.9, 1.05, 1.05);
  cyl("tableLampArm", 0.02, 0.02, 0.25, metal, 2.9, 0.95, 1.05);

  // Pendant lamps over the aisle.
  for (const x of [0.5, 2.8]) {
    cyl("cord", 0.015, 0.015, 0.6, metal, x, 2.8, 2.6);
    cyl("pendantShade", 0.12, 0.42, 0.22, mat("#1f3b30", { emissive: "#ffc880", specular: 0.1 }), x, 2.4, 2.6);
    sphere("pendantBulb", 0.12, mat("#fff2cc", { emissive: "#fff2cc", specular: 0 }), x, 2.32, 2.6);
  }

  // ---- The case file: manila with a label, standing in the shelf until the player takes it ----
  const cover = textured("fileCover", FILE.w, FILE.h, g => {
    g.fillStyle = "#e6cd8f"; g.fillRect(0, 0, 512, 384);
    g.strokeStyle = "#b99a55"; g.lineWidth = 6; g.strokeRect(6, 6, 500, 372);
    g.fillStyle = "#b99a55"; g.fillRect(0, 0, 512, 12);
    g.fillStyle = "#f6f1e1"; g.fillRect(64, 96, 384, 96); g.strokeStyle = "#8a6d33"; g.lineWidth = 4; g.strokeRect(64, 96, 384, 96);
    g.fillStyle = "#2b2518"; g.font = "bold 44px monospace"; g.fillText("CASE ARCHIVE", 97, 158);
    g.fillStyle = "#8a6d33"; g.font = "28px monospace"; g.fillText("CLOSED CASES", 155, 250);
    g.save(); g.translate(370, 310); g.rotate(-0.18); g.strokeStyle = "#a63a2c"; g.lineWidth = 5; g.strokeRect(-70, -26, 140, 52);
    g.fillStyle = "#a63a2c"; g.font = "bold 30px monospace"; g.fillText("FILED", -45, 10); g.restore();
  }, 512, 384);
  const file = new TransformNode("file", scene);
  casters(box("fileBody", FILE.w, FILE.h, FILE.d, mat("#e6cd8f", { specular: 0.05 }), 0, 0, 0, file));
  plane("fileFront", FILE.w, FILE.h, cover.material, 0, 0, -(FILE.d / 2 + 0.001)).parent = file;

  // ---- The player ----
  const model = await stage.addModelFigure(options.preset);
  if (options.signal?.aborted) throw options.signal.reason;
  const figure = model ? null : stage.addFigure(options.preset);

  const update = (t: number) => {
    const pose = poseAt(t);
    if (model) {
      model.root.position.set(pose.x, pose.y, pose.z);
      model.root.rotation.y = pose.heading;
      const held = fileAt(t);
      const raised = Math.max(pose.reach, pose.carry);
      const modelPose: Pose = { ...pose, type: raised };
      const right = new Vector3(Math.cos(held.heading), 0, -Math.sin(held.heading));
      const frontZ = -Math.cos(held.heading) * (FILE.d / 2 + 0.04);
      const hand = (side: number) => new Vector3(
        held.x + right.x * side * FILE.w * 0.32,
        held.y - FILE.h * 0.2,
        held.z + frontZ + right.z * side * FILE.w * 0.32
      );
      const hands: readonly [Vector3 | null, Vector3 | null] | undefined = pose.reach > 0
        ? [null, new Vector3(SLOT.x, SLOT.y - 0.05, SLOT.z + 0.04)]
        : pose.carry > 0 ? [hand(-1), hand(1)] : undefined;
      model.apply(modelPose, t, hands);
      model.setAlpha(pose.visible ? avatarAlpha(t) : 0);
    } else if (figure) {
      figure.root.position.set(pose.x, pose.y, pose.z);
      figure.root.rotation.y = pose.heading;
      const legs = legAngles(pose);
      figure.rig.hips.forEach((h, i) => { h.rotation.x = legs.hips[i]!; });
      figure.rig.knees.forEach((k, i) => { k.rotation.x = legs.knees[i]!; });
      const arms = armAngles(pose, t);
      figure.rig.shoulders.forEach((s, i) => { s.rotation.x = arms[i]!; });
      figure.setAlpha(pose.visible ? avatarAlpha(t) : 0);
    }
    hinge.rotation.y = doorAt(t) * 1.75;
    const f = fileAt(t);
    file.position.set(f.x, f.y, f.z);
    file.rotation.y = f.heading;
    stage.aim(shotAt(t, stage.engine.getRenderWidth(), stage.engine.getRenderHeight()));
    options.onGlass(glassAt(t));
  };

  update(options.startSeconds ?? 0);
  stage.scene.render();
  return stage.run({ end: T_END, update, onSlow: options.onSlow, startSeconds: options.startSeconds });
}
