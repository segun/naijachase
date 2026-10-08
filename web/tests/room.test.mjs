import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as room from "../src/lib/room-scene.ts";
import * as arch from "../src/lib/archive-scene.ts";

const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const at = hour => new Date(2026, 9, 8, hour, 30);

test("the greeting follows the local time of day", () => {
  assert.equal(room.greeting(at(5)), "Good morning");
  assert.equal(room.greeting(at(11)), "Good morning");
  assert.equal(room.greeting(at(12)), "Good afternoon");
  assert.equal(room.greeting(at(16)), "Good afternoon");
  assert.equal(room.greeting(at(17)), "Good evening");
  assert.equal(room.greeting(at(23)), "Good evening");
  assert.equal(room.greeting(at(2)), "Good evening");
});

test("every hour has a lighting palette and the window sky matches the light", () => {
  for (let h = 0; h < 24; h++) assert.ok(room.PALETTES[room.lightAt(h)], `hour ${h}`);
  assert.equal(room.lightAt(9), "morning");
  assert.equal(room.lightAt(14), "afternoon");
  assert.equal(room.lightAt(18), "dusk");
  assert.equal(room.lightAt(22), "night");
  assert.equal(room.PALETTES.night.stars, true);
  assert.equal(room.PALETTES.afternoon.lamp, 0, "no desk lamp in full daylight");
  assert.ok(room.PALETTES.night.lamp > room.PALETTES.morning.lamp);
});

test("the avatar enters at the door, walks to the desk, sits and ends in the seat", () => {
  assert.equal(room.poseAt(0).visible, false, "nobody is in the room before the door opens");
  const start = room.poseAt(room.T_WALK_START + 0.01);
  assert.ok(Math.abs(start.x - room.DOOR.x) < 0.05 && start.z > room.DOOR.z - 0.3);
  const walking = room.poseAt(room.T_WALK_START + 1.5);
  assert.ok(walking.stride > 0.9 && walking.sit === 0);
  const seated = room.poseAt(room.T_SIT_START + 5);
  assert.ok(Math.abs(seated.x - room.SEAT.x) < 1e-6 && Math.abs(seated.z - room.SEAT.z) < 1e-6);
  assert.ok(Math.abs(seated.y + room.SIT_DROP) < 1e-6 && seated.sit === 1 && seated.type === 1 && seated.stride === 0);
  assert.ok(Math.abs(Math.cos(seated.heading) + 1) < 1e-6, "seated facing the desk (+z)");
  for (let t = 0; t <= room.T_END; t += 0.05) {
    const p = room.poseAt(t);
    assert.ok(p.x > room.ROOM.minX && p.x < room.ROOM.maxX && p.z > room.ROOM.minZ && p.z <= room.ROOM.maxZ, `inside the room at ${t.toFixed(2)}s`);
  }
});

test("the timeline is ordered and the pieces animate in sequence", () => {
  assert.ok(room.T_DOOR < room.T_SIT_START && room.T_SIT_START < room.T_ZOOM_START && room.T_ZOOM_START < room.T_END);
  assert.ok(room.T_END < 12, "the intro stays short");
  assert.equal(room.doorAt(0), 0);
  assert.equal(room.doorAt(room.T_END), 1);
  assert.equal(room.chairAt(0), 0);
  assert.equal(room.chairAt(room.T_END), 1);
  assert.equal(room.avatarAlpha(room.T_WALK_START - 0.1), 0);
  assert.equal(room.avatarAlpha(room.T_ZOOM_START - 0.01), 1);
  assert.equal(room.avatarAlpha(room.T_END), 0, "the figure fades out as the camera becomes the player's eyes");
});

test("walking swings the legs and sitting folds them", () => {
  const walk = room.legAngles({ ...room.poseAt(room.T_WALK_START + 1.4), gait: Math.PI / 2 });
  assert.ok(walk.hips[0] > 0.3 && walk.hips[1] < -0.3, "legs swing in opposition");
  const sat = room.legAngles(room.poseAt(room.T_END));
  assert.ok(Math.abs(sat.hips[0] - (Math.PI / 2 - 0.04)) < 1e-9, "thighs horizontal");
  assert.ok(Math.abs(sat.hips[0] + sat.knees[0]) < 1e-9, "shins hang straight down");
  const typing = room.armAngles(room.poseAt(room.T_END), 0);
  assert.ok(typing[0] > 1 && typing[1] > 1, "hands reach forward to the keyboard");
});

test("the zoom lands exactly on the terminal glass at every viewport", () => {
  for (const [vw, vh] of [[1440, 900], [1280, 720], [1920, 1080], [1024, 768], [390, 844], [844, 390]]) {
    const end = room.shotAt(room.T_END, vw, vh);
    const distance = room.SCREEN.z - end.position[2];
    assert.ok(Math.abs(distance - room.zoomDistance(vw, vh)) < 1e-9);
    // The glass is SCREEN.w wide in the world; projected it must equal the terminal glass width in pixels.
    const pixels = (room.SCREEN.w * (vh / 2 / Math.tan(room.FOV / 2))) / distance;
    assert.ok(Math.abs(pixels - room.glassWidth(vw, vh)) < 1e-6, `${vw}x${vh}`);
    assert.deepEqual([...end.target], [room.SCREEN.x, room.SCREEN.y, room.SCREEN.z]);
  }
  assert.equal(room.glassWidth(390, 844), 390, "portrait phones use the whole screen");
  assert.ok(room.glassWidth(1440, 900) <= 1440 * 0.88 + 1e-9 && room.glassWidth(1440, 900) / (900 * 0.88) <= 4 / 3 + 1e-9);
});

test("the camera dollies in smoothly and the glass fades in only at the end", () => {
  let last = Infinity;
  for (let t = room.T_ZOOM_START; t <= room.T_END; t += 0.05) {
    const d = room.SCREEN.z - room.shotAt(t, 1440, 900).position[2];
    assert.ok(d <= last + 1e-9, "never backs away");
    last = d;
  }
  assert.equal(room.glassAt(room.T_ZOOM_START), 0);
  assert.equal(room.glassAt(room.T_END), 1);
  assert.ok(room.glassAt(room.T_ZOOM_START + (room.T_END - room.T_ZOOM_START) * 0.5) === 0);
});

test("the rooms are lazy, primitive-built enhancements and the screens keep working without them", () => {
  const stage = read("components/Stage.svelte"), roomView = read("components/Room.svelte"), archiveView = read("components/ArchiveRoom.svelte");
  const desk = read("components/CaseDesk.svelte"), app = read("App.svelte"), shell = read("components/Shell.svelte");
  const scenes = ["lib/chase3d-room.ts", "lib/chase3d-archive.ts", "lib/chase3d-stage.ts"].map(read).join("\n");
  assert.match(roomView, /import\("\.\.\/lib\/chase3d-room\.ts"\)/);
  assert.match(archiveView, /import\("\.\.\/lib\/chase3d-archive\.ts"\)/);
  for (const view of [stage, roomView, archiveView]) assert.doesNotMatch(view, /^\s*import\s+(?!type\b)[^\n]*chase3d/m, "Babylon.js stays out of the main bundle");
  assert.doesNotMatch(scenes, /\.(glb|gltf)|SceneLoader|ImportMesh|AppendAsync|LoadAssetContainer/i);
  assert.doesNotMatch(scenes, /from "@babylonjs\/core"/, "use deep imports so unused features are tree-shaken");
  assert.match(stage, /Skip intro/);
  assert.match(stage, /decideScene/, "reduced motion, Save-Data, slow networks and low memory skip the intro");
  assert.match(roomView, /nc-desk/, "the desk intro plays once per sign-in");
  assert.match(archiveView, /nc-archive/, "the archive intro plays once per sign-in");
  assert.match(app, /import\("\.\/components\/Room\.svelte"\)/, "the room is a lazy chunk: nobody needs it on the sign-in path");
  assert.match(app, /import\("\.\/components\/ArchiveRoom\.svelte"\)/);
  assert.doesNotMatch(app, /^\s*import\s+(Room|ArchiveRoom)/m);
  assert.match(shell, /app\.screen !== "cases" && app\.screen !== "archive"/, "the rooms are full-screen: no side rail");
  assert.match(desk, /greeting\(now\)/);
  assert.match(desk, /app\.summary\.rank/);
  for (const label of ["Start new case", "Achievements", "Career file", "Settings", "Log out"]) assert.match(desk, new RegExp(label), label);
  assert.match(archiveView, /<Archive \{app\} \/>/, "the archive list itself is unchanged");
});

test("the archive intro: walk in, take the file, turn round and zoom onto it, in five seconds or less", () => {
  assert.ok(arch.T_END <= arch.MAX_SECONDS, `intro is ${arch.T_END.toFixed(2)}s`);
  assert.ok(room.T_END > 0 && arch.T_DOOR < arch.T_WALK_END && arch.T_WALK_END < arch.T_REACH && arch.T_REACH < arch.T_GRAB && arch.T_GRAB < arch.T_TURN_BACK && arch.T_TURN_BACK < arch.T_ZOOM_START && arch.T_ZOOM_START < arch.T_END);
  assert.equal(arch.poseAt(0).visible, false);
  const start = arch.poseAt(arch.T_WALK_START + 0.01);
  assert.ok(Math.abs(start.x - arch.DOOR.x) < 0.05 && start.z > arch.DOOR.z - 0.3, "enters at the door");
  for (let t = 0; t <= arch.T_END; t += 0.05) {
    const p = arch.poseAt(t);
    assert.ok(p.x > room.ROOM.minX && p.x < room.ROOM.maxX && p.z > room.ROOM.minZ && p.z <= room.ROOM.maxZ, `inside the room at ${t.toFixed(2)}s`);
  }
  const reach = arch.poseAt(arch.T_GRAB - 0.001);
  assert.ok(reach.reach > 0.99 && reach.carry < 0.01, "arm is up at the shelf when the file is taken");
  assert.deepEqual([arch.fileAt(0).x, arch.fileAt(0).y, arch.fileAt(0).z], [arch.SLOT.x, arch.SLOT.y, arch.SLOT.z], "the file starts in its slot");
  assert.equal(arch.fileAt(arch.T_GRAB - 0.01).held, false);
  const end = arch.fileAt(arch.T_END);
  assert.ok(end.held && Math.abs(end.x - arch.FILE_FINAL.x) < 1e-9 && Math.abs(end.z - arch.FILE_FINAL.z) < 1e-9, "the file ends held in front of the player");
  assert.ok(Math.abs(Math.cos(arch.poseAt(arch.T_END).heading) - 1) < 1e-9, "the player ends facing the camera");
  assert.ok(Math.abs(Math.cos(end.heading) - 1) < 1e-9, "the cover faces the camera");
  const hand = arch.armAngles(arch.poseAt(arch.T_GRAB - 0.001), 0);
  assert.ok(hand[1] > 1.6 && hand[0] < 0.1, "only the right arm reaches");
});

test("the archive zoom lands exactly on the file's sheet at every viewport", () => {
  for (const [vw, vh] of [[1440, 900], [1280, 720], [1024, 768], [390, 844], [844, 390]]) {
    const end = arch.shotAt(arch.T_END, vw, vh);
    const distance = arch.FILE_FINAL.z - end.position[2];
    const pixels = (arch.FILE.w * (vh / 2 / Math.tan(room.FOV / 2))) / distance;
    assert.ok(Math.abs(pixels - room.glassWidth(vw, vh)) < 1e-6, `${vw}x${vh}`);
    assert.deepEqual([...end.target], [arch.FILE_FINAL.x, arch.FILE_FINAL.y, arch.FILE_FINAL.z]);
  }
  assert.ok(Math.abs(arch.FILE.w / arch.FILE.h - 4 / 3) < 1e-9, "the file is 4:3 like the sheet");
  let last = Infinity;
  for (let t = arch.T_ZOOM_START; t <= arch.T_END; t += 0.05) {
    const d = arch.FILE_FINAL.z - arch.shotAt(t, 1440, 900).position[2];
    assert.ok(d <= last + 1e-9, "never backs away");
    last = d;
  }
  assert.equal(arch.glassAt(arch.T_ZOOM_START), 0);
  assert.equal(arch.glassAt(arch.T_END), 1);
});
