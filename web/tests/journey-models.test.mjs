import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MODELS, avatarModelId } from "../src/scenes/shared/model-manifest.ts";
import { AIR, FOV, MODEL_AIR, modelBoardingPosition, frameAt, groundCameraX, planJourney } from "../src/scenes/journey/journey-scene.ts";

const read = file => fs.readFileSync(new URL(`../src/scenes/journey/${file}`, import.meta.url), "utf8");
const asset = id => {
  const spec = MODELS[id];
  assert.ok(spec && spec.size > 0, `${id}: manifest dimension`);
  const bytes = fs.readFileSync(new URL(`../public/assets/3d/${spec.file}`, import.meta.url));
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
};

test("journey vehicles and cabin crew use supplied, sized assets", () => {
  for (const id of ["car_player_runabout", "bus_danfo", "bus_coach", "plane_airliner"]) {
    const model = asset(id);
    assert.ok(model.meshes.length > 0);
    assert.equal(MODELS[id].kind, "vehicle");
  }
  const crew = asset("witness_woman_uniform");
  assert.ok(crew.skins.length);
  assert.ok(crew.animations.some(a => a.name.toLowerCase() === "walk"));
  for (let i = 1; i <= 10; i++) {
    const model = asset(avatarModelId(`avatar-${String(i).padStart(2, "0")}`));
    for (const clip of ["walk", "sit"]) assert.ok(model.animations.some(a => a.name.toLowerCase() === clip));
    assert.ok(model.nodes.some(n => n.name.endsWith(":RightHand")), "boarding pass can follow the hand");
  }
});

test("journey models preserve the timeline and cancel abandoned setup", () => {
  const renderer = read("chase3d-journey.ts");
  assert.match(renderer, /if \(options\.models\) \{\s*await Promise\.all/);
  assert.match(renderer, /pinHorizontalTravel: true, neutralStanding: true/);
  assert.match(renderer, /playerModel\.apply\(pose, t, hands\)/);
  assert.match(renderer, /card\.parent = hand/);
  assert.match(renderer, /car \? 0 : Math\.PI \/ 2/, "runabout and danfo have different authored axes");
  assert.match(renderer, /replaceVehicle\(root, "bus_coach", Math\.PI\)/);
  assert.match(renderer, /signal\?\.addEventListener\("abort", abort/);
  assert.match(renderer, /removeEventListener\("webglcontextlost", contextLost\)/);
  assert.match(renderer, /stage\.engine\.dispose\(\);\s*throw error/);
});

test("Simple skips ordinary journeys but preserves weekly server progress and explicit failures", () => {
  const view = read("JourneyScene.svelte");
  assert.doesNotMatch(view, /import\("\.\/journey-2d\.ts"\)/);
  assert.match(view, /current === "flat"[\s\S]*if \(!loop && !failure\) finish\(\)/);
  assert.match(view, /if \(finished\) return;\s*finished = true/);
  assert.match(view, /if \(loop\) onclose\?\.\(\); else app\.leaveJourney\(\)/);
  assert.match(view, /trip\.arrivesAt - tick/);
  assert.match(view, /aria-valuenow=\{done\}/);
  assert.match(view, /role="alert">The 3D journey is unavailable/);
  assert.match(view, /failure = why/);
  assert.match(view, /lastChoice = choice; broken = false; failure = ""/);
  assert.match(view, /controller\.abort\(\)/);
  assert.match(view, /onFault: \(why: string\) => \{ if \(!cancelled\)/);
  assert.match(view, /closest\("button, input, select, textarea, a, summary"\)/);
});

test("airliner boarding fitting reaches its real sill without walking through the engine", () => {
  const origin = 100;
  assert.deepEqual(modelBoardingPosition(origin + AIR.stairBottom, 0, origin),
    { x: origin + MODEL_AIR.stairBottom, y: 0, z: MODEL_AIR.bottomZ });
  const top = modelBoardingPosition(origin + AIR.stairTop, AIR.sill, origin);
  for (const [key, value] of Object.entries({ x: origin + MODEL_AIR.stairTop, y: MODEL_AIR.sill, z: MODEL_AIR.topZ })) {
    assert.ok(Math.abs(top[key] - value) < 1e-8);
  }
  const door = modelBoardingPosition(origin + AIR.doorX, AIR.sill, origin);
  assert.ok(Math.abs(door.x - origin - MODEL_AIR.doorX) < 0.01);
  assert.ok(MODEL_AIR.stairBottom > 4.5, "stairs begin ahead of the near engine");
  assert.ok(MODEL_AIR.bottomZ < -6, "approaching feet remain outside the engine");
  const plan = planJourney({ mode: "fly", from: "Lagos", to: "Kano", seed: 9 });
  for (let t = 3.6; t < 10.6; t += 0.05) {
    const f = frameAt(plan, t), p = f.player;
    const fitted = modelBoardingPosition(p.x, p.y, f.vehicle.x);
    assert.ok(fitted.y >= 0 && fitted.y <= MODEL_AIR.sill);
    assert.ok(fitted.z >= MODEL_AIR.bottomZ - 1e-8 && fitted.z <= MODEL_AIR.topZ + 1e-8);
    assert.equal(f.hostess.alpha, 1, "fitting does not change choreography");
  }
});

test("portrait cameras keep the walker and seated driver inside the horizontal frustum", () => {
  for (const mode of ["drive", "hitch"]) {
    const plan = planJourney({ mode, from: "Lagos", to: "Kano", seed: 9 });
    for (let t = 0; t < plan.end; t += 0.1) {
      const f = frameAt(plan, t);
      assert.equal(groundCameraX(f, 1.8), f.cam.x, "desktop framing remains unchanged");
      for (const [width, height] of [[320, 568], [360, 640], [390, 844]]) {
        const aspect = width / height, x = groundCameraX(f, aspect);
        const halfWidth = (f.cam.d - 1.4) * Math.tan(FOV / 2) * aspect;
        const target = f.player?.visible ? f.player.x : f.vehicle.x;
        assert.ok(Math.abs(target - x) < halfWidth, `${mode} at ${t}: subject is visible on ${width}x${height}`);
      }
    }
  }
});
