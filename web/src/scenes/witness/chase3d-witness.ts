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
import { contactShadow, roundedBox } from "../shared/chase3d-shapes.ts";
import { armAngles, headingOf, legAngles, type CameraShot } from "../shared/scene-core.ts";
import { setFor } from "./chase3d-sets.ts";
import { createDriver, fitShot, type WitnessFrame, type WitnessHandle, type WitnessOptions } from "./witness-driver.ts";
import { BUS_SEATS, ROAD_Z, VEHICLE_FROM_X, WITNESS, busDoorAt, busRideAt, cameraAt, listenLean, playerPoseAt, vehicleXAt, witnessAt } from "./witness-scene.ts";
import { loadModel } from "../shared/chase3d-models.ts";
import type { ModelFigure } from "../shared/chase3d-model-figure.ts";
import { replacePerson, gesture } from "./chase3d-witness-models.ts";
import { standingPose, witnessModelId } from "./witness-models.ts";
import { avatarModelId } from "../shared/model-manifest.ts";
import { BUS_DRIVER } from "../journey/journey-scene.ts";

export type { WitnessFrame, WitnessHandle, WitnessOptions };

// ImageProcessingConfiguration.TONEMAPPING_ACES, as a plain number: importing that module on its own breaks Babylon's shader loading under the vite dev server.
const TONEMAPPING_ACES = 1;
const HEAD_Y = 1.72;
/** Where the sun or moon sits across the painted sky, in texture pixels. */
const SKY_ORB_X = 256;

/** The stage's box, but with eased edges for chunky untextured pieces (walls, crates, stalls); thin pieces and textured ones stay sharp. */
function softBox(stage: Stage): Stage["box"] {
  return (name, w, h, d, mtl, x, y, z, parent) => {
    const smallest = Math.min(w, h, d);
    if (smallest < 0.24 || Math.max(w, h, d) > 14 || mtl.diffuseTexture || mtl.emissiveTexture) return stage.box(name, w, h, d, mtl, x, y, z, parent);
    return stage.place(roundedBox(stage.scene, name, w, h, d, Math.min(0.1, smallest / 4), true), mtl, x, y, z, parent);
  };
}

export async function createWitnessScene(canvas: HTMLCanvasElement, options: WitnessOptions): Promise<WitnessHandle & { scene: Scene }> {
  const stage = createStage(canvas, { hour: options.hour, quality: options.quality, models: options.models, signal: options.signal });
  let disposeDriver = () => {};
  const abort = () => stage.engine.dispose();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) { abort(); throw new DOMException("Witness setup cancelled", "AbortError"); }
  try {
  const { scene, camera, palette, mat, box, cyl, sphere, plane, textured, caster, engine } = stage;
  const light = stage.light;
  const night = palette.stars || palette.lamp > 0.5;

  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 30; scene.fogEnd = 80;
  scene.fogColor = hex(palette.skyBottom);
  camera.maxZ = 400;

  // A gentle film grade: tone mapping stops the sun-lit ground blowing out, with a little contrast and a soft vignette. It costs nothing extra on screen.
  const grade = scene.imageProcessingConfiguration;
  grade.toneMappingEnabled = true; grade.toneMappingType = TONEMAPPING_ACES;
  grade.exposure = night ? 1.05 : 1.15; grade.contrast = 1.18;
  if (!light) { grade.vignetteEnabled = true; grade.vignetteWeight = 2.2; grade.vignetteStretch = 0.4; grade.vignetteColor.set(0, 0, 0, 0); }

  // The sky is a painted dome that follows the camera, so it never runs out however the camera turns.
  const skyPaint = textured("sky", 1, 1, g => {
    const gradient = g.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, palette.skyTop); gradient.addColorStop(0.5, palette.skyBottom); gradient.addColorStop(1, palette.skyBottom);
    g.fillStyle = gradient; g.fillRect(0, 0, 1024, 512);
    const sr = seeded(5);
    if (palette.stars) for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + sr() * 0.5})`; g.fillRect(sr() * 1024, sr() * 240, 2, 2); }
    // A soft glow round the sun or moon, then the disc itself.
    const oy = palette.orb === "moon" ? 150 : 190, glow = g.createRadialGradient(SKY_ORB_X, oy, 4, SKY_ORB_X, oy, palette.orb === "moon" ? 90 : 190);
    glow.addColorStop(0, palette.stars ? "rgba(200,215,255,.35)" : "rgba(255,238,190,.75)"); glow.addColorStop(1, "rgba(255,238,190,0)");
    g.fillStyle = glow; g.fillRect(0, 0, 1024, 512);
    g.fillStyle = palette.orbColor; g.beginPath(); g.arc(SKY_ORB_X, oy, palette.orb === "moon" ? 18 : 26, 0, Math.PI * 2); g.fill();
    // Cloud puffs by day: a few overlapping soft blobs each, flatter underneath.
    if (!palette.stars) for (let i = 0; i < 9; i++) {
      const cx = sr() * 1000, cy = 100 + sr() * 110, sz = 26 + sr() * 36;
      for (let k = 0; k < 6; k++) {
        const px = cx + (k - 2.5) * sz * 0.7, py = cy + Math.sin(k * 1.7) * sz * 0.2, rr = sz * (0.7 + 0.4 * Math.sin(k * 1.3 + 1));
        const puff = g.createRadialGradient(px, py, 0, px, py, rr);
        puff.addColorStop(0, "rgba(255,255,255,.62)"); puff.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = puff; g.fillRect(px - rr, py - rr, rr * 2, rr * 2);
      }
    }
  }, 1024, 512);
  skyPaint.material.emissiveTexture = skyPaint.material.diffuseTexture; skyPaint.material.disableLighting = true; skyPaint.material.fogEnabled = false;
  const dome = CreateSphere("sky", { diameter: 300, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  dome.material = skyPaint.material; dome.infiniteDistance = true; dome.isPickable = false;

  // ---- Ground: red earth, a tarred lane along the front and the market floor behind it ----
  const earth = textured("earth", 80, 70, g => {
    g.fillStyle = "#a35f38"; g.fillRect(0, 0, 512, 512);
    const er = seeded(11);
    for (let i = 0; i < 40; i++) { const x = er() * 512, y = er() * 512, rr = 30 + er() * 60, patch = g.createRadialGradient(x, y, 0, x, y, rr); patch.addColorStop(0, er() < 0.5 ? "rgba(110,55,32,.28)" : "rgba(214,150,100,.25)"); patch.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = patch; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 1800; i++) { const v = er(); g.fillStyle = v < 0.5 ? "rgba(120,62,35,.5)" : "rgba(196,128,84,.45)"; g.fillRect(er() * 512, er() * 512, 2 + er() * 4, 2 + er() * 4); }
  }, 512, 512);
  const earthMap = earth.material.diffuseTexture as Texture;
  earthMap.uScale = 10; earthMap.vScale = 9;
  const ground = box("ground", 120, 0.2, 100, earth.material, 0, -0.1, 30);
  ground.receiveShadows = !light;
  // The box's top maps u across the lane and v along it, so one dash per tile, repeated along the road.
  const tar = textured("tar", 3.4, 120, g => {
    g.fillStyle = "#3a3b40"; g.fillRect(0, 0, 64, 512);
    const tr = seeded(3);
    for (let i = 0; i < 260; i++) { g.fillStyle = tr() < 0.5 ? "rgba(20,20,24,.35)" : "rgba(95,95,100,.3)"; g.fillRect(tr() * 64, tr() * 512, 1 + tr() * 3, 1 + tr() * 6); }
    g.fillStyle = "rgba(15,15,18,.28)"; g.fillRect(12, 0, 8, 512); g.fillRect(44, 0, 8, 512);
    g.fillStyle = "#e8e2cf"; g.fillRect(29, 0, 6, 256);
    g.fillStyle = "rgba(232,226,207,.8)"; g.fillRect(0, 0, 2, 512); g.fillRect(62, 0, 2, 512);
  }, 64, 512);
  (tar.material.diffuseTexture as Texture).vScale = 15;
  box("lane", 120, 0.03, 3.4, tar.material, 0, 0.015, ROAD_Z);
  box("kerb", 120, 0.12, 0.18, mat("#9b9486"), 0, 0.06, ROAD_Z + 1.78);

  // ---- The set: everything that makes this venue look like itself (see chase3d-sets.ts) ----
  const dressing = setFor(options.recipe.set)({ stage: light ? stage : { ...stage, box: softBox(stage) }, options });

  // ---- The vehicle ----
  const car = options.arrival === "drive" ? runabout(stage) : null;
  const bus = options.arrival === "hitch" ? danfo(stage) : null;
  const vehicle = (car ?? bus)!;
  vehicle.root.position.set(VEHICLE_FROM_X, 0, ROAD_Z);
  vehicle.root.rotation.y = Math.atan2(1, 0);
  const wheelRadius = car ? 0.31 : 0.38;

  // ---- The player and the witness ----
  const driver = createDriver(options);
  disposeDriver = driver.dispose;
  const { plan, timings, words, pages } = driver;
  const player = stage.addFigure(options.preset);
  const witnessLook = driver.witness;
  const busDriver = bus ? stage.addFigure(BUS_DRIVER) : null;
  const busRider = bus ? stage.addFigure(options.preset) : null;
  const witness = stage.addFigure(witnessLook)!;
  witness.root.position.set(WITNESS.x, 0, WITNESS.z);
  contactShadow(scene, witness.root, 0.9, 0.7);
  if (player && !light) contactShadow(scene, player.root, 0.9, 0.7);
  const head = witness.root.getChildMeshes().find(m => m.name === "head");
  const mouth = sphere("mouth", 1, mat("#4a1414", { specular: 0.1 }), 0, HEAD_Y - 0.11, -0.25);
  mouth.parent = witness.root;
  void head;
  let playerModel: ModelFigure | null = null, riderModel: ModelFigure | null = null, witnessModel: ModelFigure | null = null;
  if (options.models) {
    await Promise.all([
      player && options.preset && avatarModelId(options.preset.avatar_id) ? replacePerson(stage, player.root, avatarModelId(options.preset.avatar_id)!, "critical").then(m => {
        playerModel = m;
      }) : undefined,
      replacePerson(stage, witness.root, witnessModelId(witnessLook), "critical").then(m => { witnessModel = m; }),
      loadModel(scene, car ? "car_player_runabout" : "bus_danfo", { priority: "critical" }).then(m => {
        if (!m) return;
        const bounds = m.root.getHierarchyBoundingVectors(true), size = bounds.max.subtract(bounds.min);
        if (size.x > size.z) m.root.rotation.y = Math.PI / 2;
        m.root.parent = vehicle.root;
        vehicle.root.getChildMeshes().filter(mesh => !m.meshes.includes(mesh)).forEach(mesh => mesh.setEnabled(false));
        m.meshes.forEach(mesh => caster(mesh));
      })
    ]);
    // The procedural set is already usable. Nearby scenery and background crowds
    // continue replacing it without delaying the first rendered frame.
    void dressing.ready?.catch(error => console.warn("Witness background models could not be completed.", error));
    if (busRider && options.preset && avatarModelId(options.preset.avatar_id)) {
      void replacePerson(stage, busRider.root, avatarModelId(options.preset.avatar_id)!, "decorative").then(m => { riderModel = m; });
    }
  }
  if (options.signal?.aborted) throw new DOMException("Witness setup cancelled", "AbortError");

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
    if (figure === player && playerModel) {
      playerModel.apply(p, t); playerModel.setAlpha(p.visible ? p.alpha : 0);
      playerModel.root.position.set(0, 0, 0);
    }
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

    if (bus && busDriver && busRider) {
      const seat = (figure: typeof busDriver, at: { x: number; z: number }, alpha: number) => {
        const sat = { x: 0, y: 0, z: 0, heading: 0, sit: 1, gait: 0, stride: 0, type: 1, visible: true };
        const legs = legAngles(sat);
        figure.root.position.set(x + at.x, BUS_SEATS.y, ROAD_Z + at.z);
        figure.root.rotation.y = headingOf(-1, 0);
        figure.rig.hips.forEach((h, i) => { h.rotation.x = legs.hips[i]!; });
        figure.rig.knees.forEach((k, i) => { k.rotation.x = legs.knees[i]!; });
        figure.rig.shoulders.forEach(s => { s.rotation.x = 0.5; });
        figure.rig.elbows.forEach(e => { e.rotation.x = 0.4; });
        figure.setAlpha(alpha);
        if (figure === busRider && riderModel) { riderModel.apply(sat, t); riderModel.setAlpha(alpha); riderModel.root.position.set(0, 0, 0); }
      };
      seat(busDriver, BUS_SEATS.driver, 1);
      seat(busRider, BUS_SEATS.player, busRideAt(plan, t));
    }

    const p = playerPoseAt(plan, t);
    if (player) poseFigure(player, p, t, listenLean(plan, t));

    const w = witnessAt(plan, timings, t);
    witness.root.rotation.y = w.heading;
    witness.root.rotation.x = w.lean;
    witness.root.position.y = w.bob;
    witness.rig.shoulders[0]!.rotation.x = w.arms[0];
    witness.rig.shoulders[1]!.rotation.x = w.arms[1];
    witness.rig.shoulders[1]!.rotation.z = w.wave * 0.5;
    witness.rig.elbows[0]!.rotation.x = w.elbows[0];
    witness.rig.elbows[1]!.rotation.x = w.elbows[1];
    witness.rig.elbows[1]!.rotation.z = w.wave * 0.6;
    mouth.scaling.set(0.1, 0.012 + 0.07 * w.mouth, 0.04);
    if (witnessModel) {
      witnessModel.apply(standingPose(), t);
      gesture(witnessModel, w.arms, w.elbows, w.wave);
    }

    dressing.update?.(t);

    aim(cameraAt(plan, t));

    driver.step(t, p);
  };

  // Report drawing failures once so the caller can open the readable witness account.
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
  const contextLost = (e: Event) => { e.preventDefault(); fault("the WebGL context was lost"); };
  canvas.addEventListener("webglcontextlost", contextLost);

  const handle = stage.run({ end: plan.end, update, onSlow: options.onSlow });
  return {
    scene, words, pages, duration: plan.end,
    now: driver.now,
    start: (begin = 0) => handle.play({ end: plan.end, update }, begin),
    skip: handle.skip,
    seek(seconds) { stage.engine.stopRenderLoop(); update(seconds); scene.render(); },
    dispose() {
      options.signal?.removeEventListener("abort", abort);
      disposeDriver();
      canvas.removeEventListener("webglcontextlost", contextLost);
      handle.dispose();
    }
  };
  } catch (e) {
    options.signal?.removeEventListener("abort", abort);
    disposeDriver();
    stage.engine.dispose();
    throw e;
  }
}
