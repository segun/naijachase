// Lazily loaded Babylon.js scene for the disciplinary panel: a courtroom, five judges behind a bench, the player standing before them.
// Each judge raises a paper on a stick with their vote, then the camera cuts to the player accepting judgement.
// Timing and camera are in panel-scene.ts; this file only draws frame `t`.
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { createStage } from "../shared/chase3d-stage.ts";
import { contactShadow } from "../shared/chase3d-shapes.ts";
import { afterBrowserIdle, loadModel } from "../shared/chase3d-models.ts";
import type { ModelFigure } from "../shared/chase3d-model-figure.ts";
import { FOV } from "../shared/scene-core.ts";
import { LAYOUT, SEAT_X, frameAt, panelFov, planPanel, type PanelHandle, type PanelOptions, type Vote } from "./panel-scene.ts";

const SKIN = ["#8a5a3c", "#6b4226", "#a56c47", "#5a3720", "#7c4f33"];
const TONEMAPPING_ACES = 1;

export async function createPanelScene3D(canvas: HTMLCanvasElement, options: PanelOptions): Promise<PanelHandle> {
  options.signal?.throwIfAborted();
  const stage = createStage(canvas, { hour: options.hour, quality: options.quality, models: options.models, signal: options.signal, minLamp: 0.8 });
  const abort = () => { stage.scene.dispose(); stage.engine.dispose(); };
  options.signal?.addEventListener("abort", abort, { once: true });
  stage.scene.onDisposeObservable.addOnce(() => options.signal?.removeEventListener("abort", abort));
  const { scene, camera, mat, box, cyl, sphere, plane, textured, caster, sun } = stage;
  const sunFront = sun.direction.clone();
  const plan = planPanel(options.votes);
  camera.fov = FOV;

  const grade = scene.imageProcessingConfiguration;
  grade.toneMappingEnabled = true; grade.toneMappingType = TONEMAPPING_ACES; grade.exposure = 1.1; grade.contrast = 1.15;
  scene.clearColor.set(0.05, 0.04, 0.035, 1);

  // ---- The hall: a floor, a panelled back wall, side walls and a raised dais with the bench ----
  const floor = textured("hallFloor", 1, 1, g => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? "#6d5a45" : "#5a4836"; g.fillRect(x * 32, y * 32, 32, 32); }
  }, 256, 256);
  const floorMap = floor.material.diffuseTexture as import("@babylonjs/core/Materials/Textures/texture").Texture;
  floorMap.uScale = 8; floorMap.vScale = 12;
  box("hallFloor", 16, 0.2, 24, floor.material, 0, -0.1, 0.4);
  const wall = mat("#d9cfb8", { specular: 0 }), panelling = mat("#4a3019", { specular: 0.1 });
  box("backWall", 16, 9, 0.3, wall, 0, 4.5, 6.4);
  box("wainscot", 16, 1.5, 0.12, panelling, 0, 0.75, 6.2);
  box("frontWall", 16, 9, 0.3, wall, 0, 4.5, -7.6);
  box("leftWall", 0.3, 9, 24, wall, -8, 4.5, 0.4);
  box("rightWall", 0.3, 9, 24, wall, 8, 4.5, 0.4);
  const crest = textured("crest", 1.6, 1.6, g2 => {
    const g = g2 as unknown as CanvasRenderingContext2D;
    g.fillStyle = "#14532d"; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "#e8c660"; g.lineWidth = 6; g.strokeRect(6, 6, 116, 116);
    g.fillStyle = "#e8c660"; g.font = "bold 30px serif"; g.textAlign = "center"; g.fillText("NAIJA", 64, 58); g.fillText("CHASE", 64, 92);
  }, 128, 128);
  crest.material.backFaceCulling = false;
  plane("crest", crest.width, crest.height, crest.material, 0, 3.4, 6.2);
  box("dais", 8.6, LAYOUT.daisY, 2.6, panelling, 0, LAYOUT.daisY / 2, 4.3);
  box("bench", 7.6, 0.95 - LAYOUT.daisY, 0.8, mat("#5b3d22", { specular: 0.15 }), 0, (0.95 + LAYOUT.daisY) / 2, LAYOUT.benchZ);
  box("benchTop", 7.8, 0.06, 0.95, mat("#7a5230", { specular: 0.3 }), 0, 0.95, LAYOUT.benchZ);

  // ---- The judges ----
  const papers: TransformNode[] = [];
  const judgeRoots: TransformNode[] = [];
  const judgeBodies: TransformNode[] = [];
  const judgeRoot = new TransformNode("judges", scene);
  SEAT_X.forEach((x, i) => {
    const node = new TransformNode(`judge${i}`, scene);
    node.parent = judgeRoot;
    node.position.set(x, LAYOUT.daisY, LAYOUT.judgeZ);
    judgeRoots.push(node);
    const body = new TransformNode(`judgeBody${i}`, scene);
    body.parent = node;
    judgeBodies.push(body);
    const robe = mat(i % 2 ? "#1b1b2b" : "#2a1a1a", { specular: 0.05 });
    box(`chair${i}`, 0.7, 1.5, 0.12, mat("#3a2412"), 0, 0.75, 0.45, node);
    caster(cyl(`robe${i}`, 0.42, 0.62, 0.75, robe, 0, 0.9, 0, body));
    const head = sphere(`head${i}`, 0.34, mat(SKIN[i]!), 0, 1.5, -0.02); head.parent = body; caster(head);
    cyl(`collar${i}`, 0.5, 0.5, 0.06, mat("#f2eee0"), 0, 1.27, -0.02, body);
    caster(cyl(`cap${i}`, 0.3, 0.34, 0.1, robe, 0, 1.68, -0.02, body));

    // The paper on a stick: it starts below the bench top and rises beside the judge's head.
    const sign = new TransformNode(`sign${i}`, scene);
    sign.position.set(x + 0.45, LAYOUT.paperHidden, LAYOUT.judgeZ - 0.4);
    const vote: Vote = options.votes[i] ?? "warning";
    const paper = textured(`vote${i}`, 0.7, 0.46, g2 => {
      const g = g2 as unknown as CanvasRenderingContext2D;
      g.fillStyle = vote === "punish" ? "#f4c9c3" : "#cfe9d0"; g.fillRect(0, 0, 256, 168);
      g.strokeStyle = vote === "punish" ? "#8f2a22" : "#1f6b34"; g.lineWidth = 8; g.strokeRect(5, 5, 246, 158);
      g.fillStyle = g.strokeStyle; g.font = "bold 50px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(vote === "punish" ? "PUNISH" : "WARNING", 128, 84);
    }, 256, 168);
    paper.material.backFaceCulling = false;
    const sheet = plane(`paper${i}`, paper.width, paper.height, paper.material, 0, 0, 0);
    sheet.parent = sign;
    cyl(`stick${i}`, 0.035, 0.035, 0.9, mat("#c79a52"), 0, -0.66, 0, sign);
    sphere(`hand${i}`, 0.12, mat(SKIN[i]!), 0, -0.85, 0).parent = sign;
    papers.push(sign);
  });

  // ---- The player, facing the bench ----
  const player = stage.addFigure(options.preset);
  if (player) {
    player.root.position.set(0, 0, LAYOUT.playerZ);
    player.root.rotation.y = Math.PI;
    if (!stage.light) contactShadow(scene, player.root, 0.9, 0.7);
  }
  const playerModel: ModelFigure | null = await stage.addModelFigure(options.preset);
  if (options.signal?.aborted) throw options.signal.reason;
  if (playerModel && player) player.root.setEnabled(false);
  const judgeArms: ({ joint: TransformNode; base: Quaternion } | null)[] = SEAT_X.map(() => null);
  const attachJudge = (model: Awaited<ReturnType<typeof loadModel>>, i: number) => {
    if (!model || scene.isDisposed) { model?.dispose(); return; }
    model.root.parent = judgeRoots[i]!;
    model.meshes.forEach(m => caster(m));
    judgeBodies[i]!.setEnabled(false);
    const joint = model.root.getDescendants().filter((n): n is TransformNode => n instanceof TransformNode).find(n => n.name.endsWith(":RightArm"));
    if (joint?.rotationQuaternion) judgeArms[i] = { joint, base: joint.rotationQuaternion.clone() };
    else console.warn(`Panel judge model ${model.id} has no rigged right arm; its vote paper remains animated.`);
  };
  // Procedural judges make the first frame usable; detailed judges arrive while idle.
  if (options.models) void afterBrowserIdle(async () => {
    const models = await Promise.all(SEAT_X.map((_, i) => loadModel(scene, `judge_${i + 1}`, { priority: "decorative" })));
    models.forEach(attachJudge);
  });

  const aim = (shot: ReturnType<typeof frameAt>["camera"]) => {
    const aspect = stage.engine.getRenderWidth() / Math.max(1, stage.engine.getRenderHeight());
    camera.fov = panelFov(aspect);
    camera.position.set(...shot.position);
    camera.setTarget(new Vector3(...shot.target));
  };

  let lastT = 0, lastFade = -1, lastRevealed = "", lastVerdict = false;
  const frameStep = (t: number) => {
    const f = frameAt(plan, t);
    lastT = f.t;
    papers.forEach((sign, i) => {
      const up = f.raised[i]!;
      sign.position.y = LAYOUT.paperHidden + (LAYOUT.paperRaised - LAYOUT.paperHidden) * up;
      sign.rotation.z = Math.sin(f.t * 4 + i) * 0.05 * up;
    });
    if (player) {
      player.root.rotation.x = -0.22 * f.bow;
      player.rig.hips.forEach(h => { h.rotation.x = 0; });
    }
    if (playerModel) {
      playerModel.root.position.set(0, 0, LAYOUT.playerZ);
      playerModel.root.rotation.set(-0.22 * f.bow, Math.PI, 0);
      playerModel.apply({ x: 0, y: 0, z: LAYOUT.playerZ, heading: Math.PI, sit: 0, gait: 0, stride: 0, type: 0, visible: true });
    }
    judgeArms.forEach((arm, i) => {
      if (!arm) return;
      arm.joint.rotationQuaternion!.copyFrom(arm.base.multiply(Quaternion.RotationAxis(Vector3.Right(), -0.22 * f.raised[i]!)));
    });
    // The accept-judgement shot looks back at the player's front, so the light swings round to meet it.
    if (f.verdict !== lastVerdict) sun.direction = f.verdict ? new Vector3(-0.3, -0.5, -0.8) : sunFront.clone();
    aim(f.camera);
    const key = f.revealed.join("|");
    if (Math.abs(f.fade - lastFade) > 0.004 || key !== lastRevealed || f.verdict !== lastVerdict) {
      lastFade = f.fade; lastRevealed = key; lastVerdict = f.verdict;
      options.onFrame({ fade: f.fade, revealed: f.revealed, verdict: f.verdict });
    }
    options.onTick?.();
  };

  // A black screen is the worst outcome: any failure is reported once and the caller carries on in the 2D panel.
  let faulted = false;
  const fault = (why: unknown) => {
    if (faulted) return;
    faulted = true;
    console.error("The 3D panel scene broke.", why);
    options.onFault?.(why instanceof Error ? why.message : String(why));
  };
  const update = (t: number) => { if (faulted) return; try { frameStep(t); } catch (e) { fault(e); } };
  const render = scene.render.bind(scene);
  scene.render = (...args: Parameters<typeof render>) => { if (faulted) return; try { render(...args); } catch (e) { fault(e); } };
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); fault("the WebGL context was lost"); });

  const handle = stage.run({ end: plan.end, update, onSlow: options.onSlow });
  return {
    scene,
    plan, duration: plan.end,
    now: () => lastT,
    start: (from = 0) => handle.play({ end: plan.end, update }, from),
    skip: handle.skip,
    seek(seconds) { stage.engine.stopRenderLoop(); update(seconds); scene.render(); },
    dispose: handle.dispose
  };
}
