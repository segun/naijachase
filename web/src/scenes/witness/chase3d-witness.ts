// Lazily loaded Babylon.js scene for a witness interview: the player's vehicle pulls up at a venue (each kind of venue adds its own scenery through chase3d-sets.ts), the player
// walks up to the witness, and the witness speaks while the words appear as subtitles. Built from primitives and painted textures;
// timing, poses and subtitles are in witness-scene.ts and the venue's look and sound in venue-recipes.ts.
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { hex, seeded } from "../shared/chase3d-kit.ts";
import { createStage, type Stage } from "../shared/chase3d-stage.ts";
import { danfo, runabout } from "../shared/chase3d-cars.ts";
import { armAngles, legAngles, type CameraShot } from "../shared/scene-core.ts";
import { setFor } from "./chase3d-sets.ts";
import { createDriver, fitShot, type WitnessFrame, type WitnessHandle, type WitnessOptions } from "./witness-driver.ts";
import { ROAD_Z, VEHICLE_FROM_X, WITNESS, busDoorAt, cameraAt, listenLean, playerPoseAt, vehicleXAt, witnessAt } from "./witness-scene.ts";

export type { WitnessFrame, WitnessHandle, WitnessOptions };

const HEAD_Y = 1.72;
/** Where the sun or moon sits across the painted sky, in texture pixels. */
const SKY_ORB_X = 256;

export async function createWitnessScene(canvas: HTMLCanvasElement, options: WitnessOptions): Promise<WitnessHandle> {
  const stage = createStage(canvas, { hour: options.hour, quality: options.quality });
  const { scene, camera, palette, mat, box, cyl, sphere, plane, textured, caster, engine } = stage;
  const light = stage.light;
  const night = palette.stars || palette.lamp > 0.5;

  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 30; scene.fogEnd = 80;
  scene.fogColor = hex(palette.skyBottom);
  camera.maxZ = 400;

  // The sky is a painted dome that follows the camera, so it never runs out however the camera turns.
  const skyPaint = textured("sky", 1, 1, g => {
    const gradient = g.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, palette.skyTop); gradient.addColorStop(0.5, palette.skyBottom); gradient.addColorStop(1, palette.skyBottom);
    g.fillStyle = gradient; g.fillRect(0, 0, 1024, 512);
    const sr = seeded(5);
    if (palette.stars) for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + sr() * 0.5})`; g.fillRect(sr() * 1024, sr() * 240, 2, 2); }
    g.fillStyle = palette.orbColor; g.beginPath(); g.arc(SKY_ORB_X, palette.orb === "moon" ? 150 : 190, palette.orb === "moon" ? 18 : 26, 0, Math.PI * 2); g.fill();
    // Soft clouds by day.
    if (!palette.stars) { g.fillStyle = "rgba(255,255,255,.35)"; for (let i = 0; i < 14; i++) g.fillRect(sr() * 960, 90 + sr() * 120, 60 + sr() * 90, 9 + sr() * 9); }
  }, 1024, 512);
  skyPaint.material.emissiveTexture = skyPaint.material.diffuseTexture; skyPaint.material.disableLighting = true; skyPaint.material.fogEnabled = false;
  const dome = CreateSphere("sky", { diameter: 300, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  dome.material = skyPaint.material; dome.infiniteDistance = true; dome.isPickable = false;

  // ---- Ground: red earth, a tarred lane along the front and the market floor behind it ----
  const earth = textured("earth", 80, 70, g => {
    g.fillStyle = "#a35f38"; g.fillRect(0, 0, 512, 512);
    const er = seeded(11);
    for (let i = 0; i < 1800; i++) { const v = er(); g.fillStyle = v < 0.5 ? "rgba(120,62,35,.5)" : "rgba(196,128,84,.45)"; g.fillRect(er() * 512, er() * 512, 2 + er() * 4, 2 + er() * 4); }
  }, 512, 512);
  const earthMap = earth.material.diffuseTexture as Texture;
  earthMap.uScale = 10; earthMap.vScale = 9;
  const ground = box("ground", 120, 0.2, 100, earth.material, 0, -0.1, 30);
  ground.receiveShadows = !light;
  // The box's top maps u across the lane and v along it, so one dash per tile, repeated along the road.
  const tar = textured("tar", 3.4, 120, g => {
    g.fillStyle = "#3a3b40"; g.fillRect(0, 0, 64, 512);
    g.fillStyle = "#e8e2cf"; g.fillRect(29, 0, 6, 256);
  }, 64, 512);
  (tar.material.diffuseTexture as Texture).vScale = 15;
  box("lane", 120, 0.03, 3.4, tar.material, 0, 0.015, ROAD_Z);
  box("kerb", 120, 0.12, 0.18, mat("#9b9486"), 0, 0.06, ROAD_Z + 1.78);

  // ---- The set: everything that makes this venue look like itself (see chase3d-sets.ts) ----
  const dressing = setFor(options.recipe.set)({ stage, options });

  // ---- The vehicle ----
  const car = options.arrival === "drive" ? runabout(stage) : null;
  const bus = options.arrival === "hitch" ? danfo(stage) : null;
  const vehicle = (car ?? bus)!;
  vehicle.root.position.set(VEHICLE_FROM_X, 0, ROAD_Z);
  vehicle.root.rotation.y = Math.atan2(1, 0);
  const wheelRadius = car ? 0.31 : 0.38;

  // ---- The player and the witness ----
  const driver = createDriver(options);
  const { plan, timings, words, pages } = driver;
  const player = stage.addFigure(options.preset);
  const witnessLook = driver.witness;
  const witness = stage.addFigure(witnessLook)!;
  witness.root.position.set(WITNESS.x, 0, WITNESS.z);
  const head = witness.root.getChildMeshes().find(m => m.name === "head");
  const mouth = sphere("mouth", 1, mat("#4a1414", { specular: 0.1 }), 0, HEAD_Y - 0.11, -0.25);
  mouth.parent = witness.root;
  void head;

  const poseFigure = (figure: NonNullable<typeof player>, p: ReturnType<typeof playerPoseAt>, t: number, lean = 0) => {
    figure.root.position.set(p.x, p.y, p.z);
    figure.root.rotation.y = p.heading;
    figure.root.rotation.x = lean;
    const legs = legAngles(p);
    figure.rig.hips.forEach((h, i) => { h.rotation.x = legs.hips[i]!; });
    figure.rig.knees.forEach((k, i) => { k.rotation.x = legs.knees[i]!; });
    const arms = armAngles(p, t);
    figure.rig.shoulders.forEach((s, i) => { s.rotation.x = arms[i]!; });
    figure.setAlpha(p.visible ? p.alpha : 0);
  };

  const aim = (shot: CameraShot) => {
    const aspect = canvas.clientWidth > 0 && canvas.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1.7;
    stage.aim(fitShot(shot, aspect));
  };

  const frameStep = (t: number) => {
    const x = vehicleXAt(plan, t);
    vehicle.root.position.x = x;
    vehicle.wheels.forEach(w => { w.rotation.x = (VEHICLE_FROM_X - x) / wheelRadius; });
    if (bus) bus.door.rotation.y = -1.6 * busDoorAt(plan, t);

    const p = playerPoseAt(plan, t);
    if (player) poseFigure(player, p, t, listenLean(plan, t));

    const w = witnessAt(plan, timings, t);
    witness.root.rotation.y = w.heading;
    witness.root.rotation.x = w.lean;
    witness.root.position.y = w.bob;
    witness.rig.shoulders[0]!.rotation.x = w.arms[0];
    witness.rig.shoulders[1]!.rotation.x = w.arms[1];
    witness.rig.shoulders[1]!.rotation.z = w.wave;
    mouth.scaling.set(0.1, 0.012 + 0.07 * w.mouth, 0.04);

    dressing.update?.(t);

    aim(cameraAt(plan, t));

    driver.step(t, p);
  };

  // A black screen is the worst outcome, so any failure while drawing is reported once and the caller switches to 2D.
  let faulted = false;
  const fault = (why: unknown) => {
    if (faulted) return;
    faulted = true;
    console.error("The 3D witness scene broke.", why);
    options.onFault?.(why instanceof Error ? why.message : String(why));
  };
  const update = (t: number) => { if (faulted) return; try { frameStep(t); } catch (e) { fault(e); } };
  const render = scene.render.bind(scene);
  scene.render = (...args: Parameters<typeof render>) => { if (faulted) return; try { render(...args); } catch (e) { fault(e); } };
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); fault("the WebGL context was lost"); });

  const handle = stage.run({ end: plan.end, update, onSlow: options.onSlow });
  return {
    words, pages, duration: plan.end,
    now: driver.now,
    start: () => handle.play({ end: plan.end, update }),
    skip: handle.skip,
    seek(seconds) { stage.engine.stopRenderLoop(); update(seconds); scene.render(); },
    dispose() { driver.dispose(); handle.dispose(); }
  };
}
