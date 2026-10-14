// Shared plumbing for the "room" scenes (the office and the archive): engine, camera, lights, shadows, material and
// primitive helpers, the room shell, a swinging door, the player's figure and the timeline-driven render loop.
// Lazily loaded with the scenes that use it; everything is built from primitives and painted textures.
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
// Registered up front so the first frame never has to fetch them (see the note in chase3d-garage.ts about lazily loaded shaders).
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";
import "@babylonjs/core/Shaders/postprocess.vertex";
import "@babylonjs/core/Shaders/rgbdDecode.fragment";
import "@babylonjs/core/Shaders/shadowMap.vertex";
import "@babylonjs/core/Shaders/shadowMap.fragment";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import type { ICanvasRenderingContext } from "@babylonjs/core/Engines/ICanvas";
import { hex, material, paint } from "./chase3d-kit.ts";
import { buildAvatar } from "../../avatar/avatar3d.ts";
import { avatarModelId } from "./model-manifest.ts";
import { loadModel } from "./chase3d-models.ts";
import { modelFigure } from "./chase3d-model-figure.ts";
import type { AvatarPreset } from "../../avatar/avatar-model.ts";
import { tooSlow } from "./scene-capability.ts";
import { type CameraShot, FOV, PALETTES, ROOM, lightAt } from "./scene-core.ts";

export type Ctx = ICanvasRenderingContext;
export const WALL_HEIGHT = 3.1;

export type StageOptions = {
  /** Local hour of day, 0-23, which sets the lighting. */
  hour: number;
  quality?: "high" | "light";
  /** Whether the generated GLB models may be downloaded (the Full detail level). Without it the scene uses only the shapes built in code. */
  models?: boolean;
  /** Keeps the lamps at least this bright (a windowless room is lit all day). */
  minLamp?: number;
};

export type Timeline = { end: number; update: (t: number) => void };
export type SceneHandle = {
  look?: (dx: number, dy: number) => void;
  continue?: () => void;
  dispose(): void;
  /** Jump straight to the end of whichever timeline is playing. */
  skip(): void;
  /** Seconds into the timeline that is playing, so the scene can be rebuilt at another detail level and carry on from here. */
  now(): number;
  scene: Scene;
  /** Plays a timeline from its start; resolves when it ends (or is skipped). */
  play(next: Timeline, startAt?: number): Promise<void>;
  /** The scene's exit animation, if it has one (leaving the desk, driving off). `how` picks a variant. */
  leave?: (how?: string) => Promise<void>;
};
export type SceneOptions = {
  /** Optional stop before the terminal zoom, with camera exploration until Continue. */
  exploreAt?: number;
  onExplore?: () => void;
  /** Cancels model-backed scene setup when the view or picture detail changes. */
  signal?: AbortSignal;
  /** The player's avatar. Without one the room is empty, which is fine for the settled shot. */
  preset?: AvatarPreset | null;
  hour: number;
  quality?: "high" | "light";
  /** See StageOptions.models. */
  models?: boolean;
  /** Opacity (0-1) the DOM overlay should have; called every frame of the zoom. */
  onGlass: (opacity: number) => void;
  onSlow?: () => void;
  /** Start part-way through (the settled shot, tests and previews). */
  startSeconds?: number;
};

export function createStage(canvas: HTMLCanvasElement, options: StageOptions) {
  if (!Engine.isSupported()) throw new Error("WebGL is not available");
  const engine = new Engine(canvas, true, { stencil: false, powerPreference: "high-performance", antialias: true }, false);
  const light = options.quality === "light";
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, light ? 1 : 2));
  const scene = new Scene(engine);
  const palette = { ...PALETTES[lightAt(options.hour)] };
  palette.lamp = Math.max(palette.lamp, options.minLamp ?? 0);
  scene.clearColor = new Color4(0.02, 0.04, 0.035, 1);

  const camera = new FreeCamera("camera", new Vector3(0, 2.4, -4.6), scene);
  camera.fov = FOV; camera.minZ = 0.05; camera.maxZ = 60;

  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, -0.5), scene);
  ambient.diffuse = hex(palette.ambient); ambient.groundColor = hex(palette.ambient).scale(0.35); ambient.intensity = palette.ambientIntensity;
  const sun = new DirectionalLight("sun", new Vector3(0.35, -0.7, 0.6), scene);
  sun.diffuse = hex(palette.sun); sun.intensity = palette.sunIntensity;
  sun.position = new Vector3(-3, 7, -3);
  const shadows = light ? null : new ShadowGenerator(1024, sun);
  if (shadows) { shadows.useExponentialShadowMap = true; shadows.darkness = 0.45; }

  const mats = new Map<string, StandardMaterial>();
  const mat = (color: string, o: { emissive?: string; specular?: number } = {}) => {
    const key = `${color}|${o.emissive ?? ""}|${o.specular ?? ""}`;
    let m = mats.get(key);
    if (!m) { m = material(scene, `m${mats.size}`, color, o); mats.set(key, m); }
    return m;
  };
  const caster = <T extends AbstractMesh>(m: T) => { shadows?.addShadowCaster(m); return m; };
  const place = <T extends Mesh>(m: T, mtl: StandardMaterial, x: number, y: number, z: number, parent?: TransformNode): T => {
    m.material = mtl; m.position.set(x, y, z); if (parent) m.parent = parent;
    m.receiveShadows = !light;
    return m;
  };
  const box = (name: string, w: number, h: number, d: number, mtl: StandardMaterial, x: number, y: number, z: number, parent?: TransformNode) =>
    place(CreateBox(name, { width: w, height: h, depth: d }, scene), mtl, x, y, z, parent);
  const cyl = (name: string, dTop: number, dBottom: number, h: number, mtl: StandardMaterial, x: number, y: number, z: number, parent?: TransformNode) =>
    place(CreateCylinder(name, { diameterTop: dTop, diameterBottom: dBottom, height: h, tessellation: 20 }, scene), mtl, x, y, z, parent);
  const sphere = (name: string, d: number, mtl: StandardMaterial, x: number, y: number, z: number) =>
    place(CreateSphere(name, { diameter: d, segments: 8 }, scene), mtl, x, y, z);
  const plane = (name: string, w: number, h: number, mtl: StandardMaterial, x: number, y: number, z: number) =>
    place(CreatePlane(name, { width: w, height: h }, scene), mtl, x, y, z);
  /** A lit material carrying a texture painted with the 2D canvas API. */
  const textured = (name: string, w: number, h: number, draw: (g: Ctx) => void, px: number, py: number) => {
    const m = new StandardMaterial(`${name}Mat`, scene);
    m.diffuseTexture = paint(scene, name, px, py, draw);
    m.specularColor = new Color3(0.03, 0.03, 0.03);
    return { material: m, width: w, height: h };
  };

  const width = ROOM.maxX - ROOM.minX;
  const depth = ROOM.maxZ - ROOM.minZ;
  const centreX = (ROOM.maxX + ROOM.minX) / 2;
  const centreZ = (ROOM.maxZ + ROOM.minZ) / 2;
  const trim = mat("#e8dcc0", { specular: 0.05 });
  const wood = mat("#6d4a2a", { specular: 0.12 });
  const darkWood = mat("#4a3019", { specular: 0.1 });

  /** Floor, three walls (the fourth is cut away for the camera) and skirting. */
  const buildShell = (wallColor: string, floor: { draw: (g: Ctx) => void; tile: number }) => {
    const planks = textured("floor", width, depth, floor.draw, 512, 512);
    const tex = planks.material.diffuseTexture as Texture;
    tex.uScale = width / floor.tile; tex.vScale = depth / floor.tile;
    place(CreateBox("floor", { width: width + 0.4, height: 0.2, depth: depth + 0.3 }, scene), planks.material, centreX, -0.1, centreZ - 0.05);
    const wall = mat(wallColor, { specular: 0 });
    box("backWall", width + 0.4, WALL_HEIGHT, 0.2, wall, centreX, WALL_HEIGHT / 2, ROOM.maxZ + 0.1);
    box("leftWall", 0.2, WALL_HEIGHT, depth + 0.2, wall, ROOM.minX - 0.1, WALL_HEIGHT / 2, centreZ + 0.1);
    box("rightWall", 0.2, WALL_HEIGHT, depth + 0.2, wall, ROOM.maxX + 0.1, WALL_HEIGHT / 2, centreZ + 0.1);
    box("skirting", width, 0.14, 0.03, trim, centreX, 0.07, ROOM.maxZ - 0.015);
    box("skirtingL", 0.03, 0.14, depth, trim, ROOM.minX + 0.015, 0.07, centreZ);
    box("skirtingR", 0.03, 0.14, depth, trim, ROOM.maxX - 0.015, 0.07, centreZ);
  };

  /** A doorway in the back wall: a dark hallway behind a leaf that swings into the room. Returns the hinge to rotate. */
  const buildDoor = (x: number) => {
    const w = 0.95, h = 2.1;
    place(CreatePlane("hall", { width: w, height: h }, scene), mat("#0b100e", { specular: 0 }), x, h / 2, ROOM.maxZ - 0.012);
    box("doorFrameL", 0.1, h + 0.1, 0.08, trim, x - w / 2 - 0.05, (h + 0.1) / 2, ROOM.maxZ - 0.04);
    box("doorFrameR", 0.1, h + 0.1, 0.08, trim, x + w / 2 + 0.05, (h + 0.1) / 2, ROOM.maxZ - 0.04);
    box("doorFrameT", w + 0.3, 0.1, 0.08, trim, x, h + 0.05, ROOM.maxZ - 0.04);
    const hinge = new TransformNode("doorHinge", scene);
    hinge.position.set(x - w / 2, 0, ROOM.maxZ - 0.07);
    box("doorLeaf", w, h, 0.05, wood, w / 2, h / 2, 0, hinge);
    box("doorPanelA", w * 0.7, h * 0.36, 0.02, darkWood, w / 2, h * 0.26, -0.03, hinge);
    box("doorPanelB", w * 0.7, h * 0.36, 0.02, darkWood, w / 2, h * 0.74, -0.03, hinge);
    place(CreateSphere("knob", { diameter: 0.07, segments: 8 }, scene), mat("#f2c14e", { specular: 0.6 }), w - 0.1, h * 0.48, -0.06, hinge);
    return hinge;
  };

  /** The player's avatar, or null when there is none. `setAlpha` fades the whole figure and hides it at zero. */
  const addFigure = (preset: AvatarPreset | null | undefined) => {
    if (!preset) return null;
    const root = buildAvatar(scene, preset);
    const meshes = root.getChildMeshes();
    meshes.forEach(m => caster(m));
    let last = -1;
    return {
      root, rig: root.rig,
      setAlpha(alpha: number) {
        // Small changes are skipped, but never one that shows or hides the figure.
        const shown = alpha > 0.002;
        if (Math.abs(alpha - last) <= 0.004 && shown === last > 0.002) return;
        last = alpha;
        root.setEnabled(shown);
        meshes.forEach(m => { m.visibility = alpha; });
      }
    };
  };

  /** The player's avatar from its GLB model, or null when there is no model or it cannot be loaded (use `addFigure` then). */
  const addModelFigure = async (preset: AvatarPreset | null | undefined) => {
    const id = options.models && preset ? avatarModelId(preset.avatar_id) : null;
    const model = id ? await loadModel(scene, id) : null;
    if (!model) return null;
    model.meshes.forEach(m => caster(m));
    return modelFigure(model);
  };

  /**
   * Drives `update(t)` from a clock, renders, and stops spending GPU once the timeline ends (the picture is then static
   * behind the DOM overlay). Hands over to the caller's fallback if the frame rate stays too low. `play` starts another
   * timeline from the settled picture, such as the exit animation.
   */
  const run = (o: { end: number; update: (t: number) => void; onSlow?: () => void; startSeconds?: number }): SceneHandle => {
    let current: Timeline = { end: o.end, update: o.update };
    let offset = o.startSeconds ?? 0;
    let started = -1, skipped = false, finished = false;
    let done: (() => void) | undefined;
    const draw = (t: number) => { current.update(t); scene.render(); };
    const resize = new ResizeObserver(() => { engine.resize(); if (finished) draw(current.end); });
    resize.observe(canvas);
    const samples: number[] = [];
    let guard: number | undefined = window.setInterval(() => {
      if (finished || document.hidden) return;
      samples.push(engine.getFps());
      if (tooSlow(samples)) { clearInterval(guard); guard = undefined; o.onSlow?.(); }
    }, 1200);
    const frame = () => {
      if (document.hidden) return;
      if (started < 0) started = performance.now() - offset * 1000;
      const t = skipped ? current.end : Math.min(current.end, (performance.now() - started) / 1000);
      draw(t);
      if (t >= current.end) { finished = true; engine.stopRenderLoop(); clearInterval(guard); guard = undefined; done?.(); done = undefined; }
    };
    engine.runRenderLoop(frame);
    scene.executeWhenReady(() => engine.resize());
    return {
      scene,
      now: () => (started < 0 ? offset : skipped ? current.end : Math.min(current.end, (performance.now() - started) / 1000)),
      skip() { skipped = true; },
      play(next, startAt = 0) {
        return new Promise<void>(resolve => {
          done?.();
          current = next; offset = startAt; started = -1; skipped = false; finished = false; done = resolve;
          engine.stopRenderLoop();
          engine.runRenderLoop(frame);
        });
      },
      dispose() { clearInterval(guard); done?.(); resize.disconnect(); engine.stopRenderLoop(); scene.dispose(); engine.dispose(); }
    };
  };

  const aim = (shot: CameraShot) => { camera.position.set(...shot.position); camera.setTarget(new Vector3(...shot.target)); };

  return { engine, scene, camera, palette, ambient, sun, shadows, light, mat, caster, place, box, cyl, sphere, plane, textured, buildShell, buildDoor, addFigure, addModelFigure, run, aim, trim, wood, darkWood, centreX, centreZ };
}

export type Stage = ReturnType<typeof createStage>;
