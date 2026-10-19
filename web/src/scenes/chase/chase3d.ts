// Lazily loaded Babylon.js scene: three officers in black uniforms chase a masked thief through Lagos, Anambra and
// Kano and back again. Imports are deep (tree-shakeable) and this module is only loaded with a dynamic import().
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";
import "@babylonjs/core/Shaders/postprocess.vertex";
import "@babylonjs/core/Shaders/rgbdDecode.fragment";
import "@babylonjs/core/Shaders/shadowMap.vertex";
import "@babylonjs/core/Shaders/shadowMap.fragment";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { sirenLevels } from "./chase-motion.ts";
import { tooSlow } from "../shared/scene-capability.ts";
import { type Rgb } from "./chase-biomes.ts";
import { chaseFrame, OFFICERS, type ChaseFrame } from "./chase-frame.ts";
import { hex, material, paint, seeded } from "../shared/chase3d-kit.ts";
import { makeFigure } from "./chase3d-actors.ts";
import { buildWorld } from "./chase3d-world.ts";
import { replaceActor } from "./chase3d-model-actor.ts";
import { bindModelLoadSignal } from "../shared/chase3d-models.ts";

export type ChaseHandle = { dispose(): void; now(): number; /** The Babylon scene, exposed for tests and tooling. */ scene: Scene };
export type ChaseOptions = {
  models?: boolean;
  signal?: AbortSignal;
  onFault?: (error: unknown) => void;
  /** "light" renders at lower resolution without shadows or glow, for weaker devices. */
  quality?: "high" | "light";
  /** Called once if the frame rate stays below the floor; the caller should switch to 2D. */
  onSlow?: () => void;
  /** Jump ahead in the looping journey (used by tests and previews). */
  startSeconds?: number;
  seconds?: () => number;
  /** The timeline to draw; the endless login chase unless a scene (such as the hideout raid) supplies its own. */
  frame?: (seconds: number) => ChaseFrame;
  /** Called after each rendered frame, so a caller knows the picture is moving. */
  onTick?: () => void;
};

const rgb = (c: Rgb) => new Color3(c[0], c[1], c[2]);

export async function createChaseScene(canvas: HTMLCanvasElement, options: ChaseOptions = {}): Promise<ChaseHandle> {
  if (!Engine.isSupported()) throw new Error("WebGL is not available");
  const engine = new Engine(canvas, true, { stencil: false, powerPreference: "high-performance", antialias: true }, false);
  const light = options.quality === "light";
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, light ? 1 : 2));
  const scene = new Scene(engine);
  bindModelLoadSignal(scene, options.signal);
  const abort = () => { scene.dispose(); engine.dispose(); };
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) { abort(); throw new DOMException("Chase setup cancelled", "AbortError"); }
  scene.fogMode = Scene.FOGMODE_EXP2;

  const camera = new FreeCamera("camera", new Vector3(3, 1.9, -8.2), scene);
  camera.fov = 0.85; camera.minZ = 0.1; camera.maxZ = 400;

  const fill = new HemisphericLight("fill", new Vector3(0, 1, -0.3), scene);
  const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.6), scene);
  sun.position = new Vector3(10, 24, -12);
  const rim = new DirectionalLight("rim", new Vector3(0.35, -0.25, -1), scene);
  const sirenRed = new PointLight("sirenRed", new Vector3(-4, 3.2, -3), scene);
  sirenRed.diffuse = hex("#ff3b30"); sirenRed.range = 16; sirenRed.intensity = 0;
  const sirenBlue = new PointLight("sirenBlue", new Vector3(-4, 3.2, 3), scene);
  sirenBlue.diffuse = hex("#2f7bff"); sirenBlue.range = 16; sirenBlue.intensity = 0;

  // Only the sun or moon, lamps and road studs glow; letting the lit buildings bloom washes the scene out.
  const glow = light ? null : new GlowLayer("glow", scene, { mainTextureSamples: 2, blurKernelSize: 32 });
  if (glow) glow.intensity = 0.9;

  // Sky: a vertical gradient that is repainted as the locations blend, plus a star dome that fades out in daylight.
  const gradient = new DynamicTexture("skyGradient", { width: 4, height: 256 }, scene, false);
  const gradientCtx = gradient.getContext();
  const dome = CreateSphere("dome", { diameter: 300, segments: 16, sideOrientation: 1 }, scene);
  const domeMat = new StandardMaterial("domeMat", scene);
  domeMat.emissiveTexture = gradient; domeMat.disableLighting = true; domeMat.fogEnabled = false; domeMat.backFaceCulling = false;
  dome.material = domeMat; dome.infiniteDistance = true;

  const starTexture = paint(scene, "stars", 1024, 512, g => {
    const r = seeded(5);
    for (let i = 0; i < 280; i++) { g.fillStyle = `rgba(255,255,255,${0.35 + (i % 5) * 0.13})`; g.fillRect(r() * 1024, r() * 280, 1.6, 1.6); }
  }, false);
  starTexture.hasAlpha = true;
  const starDome = CreateSphere("starDome", { diameter: 290, segments: 16, sideOrientation: 1 }, scene);
  const starMat = new StandardMaterial("starMat", scene);
  starMat.diffuseTexture = starTexture; starMat.useAlphaFromDiffuseTexture = true; starMat.emissiveColor = new Color3(1, 1, 1);
  starMat.disableLighting = true; starMat.fogEnabled = false; starMat.backFaceCulling = false;
  starDome.material = starMat; starDome.infiniteDistance = true;

  const disc = CreateSphere("disc", { diameter: 7, segments: 16 }, scene);
  const discMat = material(scene, "discMat", "#f4ecc4", { emissive: "#f4ecc4" });
  discMat.fogEnabled = false; disc.material = discMat;
  glow?.addIncludedOnlyMesh(disc);

  const shadows = light ? null : new ShadowGenerator(1024, sun);
  if (shadows) { shadows.useExponentialShadowMap = true; shadows.darkness = 0.35; }

  const world = buildWorld(scene, shadows, options.models);
  for (const name of ["lamp", "dash", "bridgeLamp"]) { const m = scene.getMeshByName(name); if (m && glow) glow.addIncludedOnlyMesh(m as never); }

  const police = { top: "#232a31", bottom: "#161b20", head: "cap" as const, headColor: "#101317", skin: "#5a3820", uniform: true };
  const officers = OFFICERS.map(o => {
    const figure = makeFigure(scene, { ...police, name: o.name, carry: o.baton ? "baton" : "none" });
    figure.meshes.forEach(m => shadows?.addShadowCaster(m));
    return { ...o, figure };
  });
  const stripes = paint(scene, "stripes", 64, 64, g => {
    g.fillStyle = "#f4f1e6"; g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#151515";
    for (let y = 0; y < 64; y += 16) g.fillRect(0, y + 8, 64, 8);
  });
  const thief = makeFigure(scene, { name: "thief", skin: "#6b4226", top: stripes, bottom: "#141414", head: "mask", carry: "sack" });
  thief.meshes.forEach(m => shadows?.addShadowCaster(m));

  try {
    if (options.models) await Promise.all([
      replaceActor(scene, thief, "masked_thief", "run", shadows),
      ...officers.map(o => replaceActor(scene, o.figure, "crowd_police", "run", shadows))
    ]);
    if (options.models) void world.ready.catch(error => console.warn("Chase background models could not be completed.", error));
  } catch (error) {
    options.signal?.removeEventListener("abort", abort); abort(); throw error;
  }
  options.signal?.removeEventListener("abort", abort);
  if (scene.isDisposed) throw new DOMException("Chase setup cancelled", "AbortError");

  let visible = true;
  const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(e => { visible = e[0]?.isIntersecting ?? true; }) : null;
  observer?.observe(canvas);
  const resize = new ResizeObserver(() => engine.resize());
  resize.observe(canvas);

  let start = -1; // Previews without a shared clock start on their first rendered frame.
  let frame = 0;
  const now = () => options.seconds?.() ?? (start < 0 ? options.startSeconds ?? 0 : (performance.now() - start) / 1000);
  const lookTarget = new Vector3(0.2, 1.05, 0);
  scene.onBeforeRenderObservable.add(() => {
    if (start < 0) start = performance.now() - (options.startSeconds ?? 0) * 1000;
    const t = now();
    // The world eases down while a city's sign passes. Running cadence follows half of that change, so the chase
    // reads as a slightly slower pace rather than slow motion.
    const frameState = (options.frame ?? chaseFrame)(t);
    const { gait, weights, palette } = frameState;

    scene.clearColor = new Color4(...palette.fog, 1);
    scene.fogColor = rgb(palette.fog); scene.fogDensity = palette.fogDensity;
    scene.ambientColor = rgb(palette.hemiGround);
    fill.diffuse = rgb(palette.hemi); fill.groundColor = rgb(palette.hemiGround); fill.intensity = palette.hemiIntensity;
    sun.diffuse = rgb(palette.sun); sun.intensity = palette.sunIntensity;
    sun.direction.set(...palette.sunDir).normalize();
    rim.diffuse = rgb(palette.rim); rim.specular = rgb(palette.rim); rim.intensity = palette.rimIntensity;
    discMat.emissiveColor = rgb(palette.disc);
    disc.position.set(...palette.discPos); disc.scaling.setAll(palette.discSize / 7);
    starMat.alpha = palette.stars; starDome.setEnabled(palette.stars > 0.02);
    if (frame++ % 3 === 0) {
      const g = gradientCtx.createLinearGradient(0, 0, 0, 256);
      const css = (c: Rgb) => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
      g.addColorStop(0, css(palette.skyTop)); g.addColorStop(0.5, css(palette.skyTop)); g.addColorStop(0.62, css(palette.skyHorizon)); g.addColorStop(1, css(palette.fog));
      gradientCtx.fillStyle = g; gradientCtx.fillRect(0, 0, 4, 256);
      gradient.update();
    }

    for (const runner of frameState.runners) {
      const figure = runner.name === "thief" ? thief : officers.find(o => o.name === runner.name)!.figure;
      figure.root.position.set(runner.x, 0, runner.z);
      figure.root.rotation.y = runner.heading ?? 0;
      figure.apply(runner.pose, runner.cycle, runner);
    }
    world.update(frameState.worldTime, palette, weights, gait);
    const s = sirenLevels(t);
    sirenRed.intensity = s.red * 2.2; sirenBlue.intensity = s.blue * 2.2;
    camera.position.set(...frameState.camera);
    camera.setTarget(lookTarget.set(...frameState.target));
  });
  scene.onAfterRenderObservable.add(() => options.onTick?.());

  // One-way fallback: if the device cannot hold a usable frame rate, hand back to the 2D scene (never oscillates).
  const samples: number[] = [];
  const guard = window.setInterval(() => {
    if (!visible || document.hidden) return;
    samples.push(engine.getFps());
    if (tooSlow(samples)) { clearInterval(guard); options.onSlow?.(); }
  }, 1500);

  let faulted = false;
  const fault = (error: unknown) => {
    if (faulted) return;
    faulted = true;
    console.error("The login chase failed; switching to 2D.", error);
    engine.stopRenderLoop(); options.onFault?.(error);
  };
  const lost = (event: Event) => { event.preventDefault(); fault(new Error("WebGL context lost")); };
  canvas.addEventListener("webglcontextlost", lost);
  engine.runRenderLoop(() => { if (visible && !document.hidden && !faulted) { try { scene.render(); } catch (error) { fault(error); } } });
  scene.executeWhenReady(() => engine.resize());

  return {
    scene,
    now,
    dispose() {
      canvas.removeEventListener("webglcontextlost", lost);
      clearInterval(guard);
      observer?.disconnect();
      resize.disconnect();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    }
  };
}
