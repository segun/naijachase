import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as room from "../src/scenes/office/room-scene.ts";
import * as core from "../src/scenes/shared/scene-core.ts";
import * as arch from "../src/scenes/archive/archive-scene.ts";
import * as brief from "../src/domain/briefing.ts";
import * as venues from "../src/domain/venues.ts";

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
  for (let h = 0; h < 24; h++) assert.ok(core.PALETTES[core.lightAt(h)], `hour ${h}`);
  assert.equal(core.lightAt(9), "morning");
  assert.equal(core.lightAt(14), "afternoon");
  assert.equal(core.lightAt(18), "dusk");
  assert.equal(core.lightAt(22), "night");
  assert.equal(core.PALETTES.night.stars, true);
  assert.equal(core.PALETTES.afternoon.lamp, 0, "no desk lamp in full daylight");
  assert.ok(core.PALETTES.night.lamp > core.PALETTES.morning.lamp);
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
    assert.ok(p.x > core.ROOM.minX && p.x < core.ROOM.maxX && p.z > core.ROOM.minZ && p.z <= core.ROOM.maxZ, `inside the room at ${t.toFixed(2)}s`);
  }
});

test("the timeline is ordered and the pieces animate in sequence", () => {
  assert.ok(room.T_DOOR < room.T_SIT_START && room.T_SIT_START < room.T_ZOOM_START && room.T_ZOOM_START < room.T_END);
  assert.ok(room.T_END <= 5, "the intro lasts five seconds at most");
  assert.equal(room.doorAt(0), 0);
  assert.equal(room.doorAt(room.T_END), 1);
  assert.equal(room.chairAt(0), 0);
  assert.equal(room.chairAt(room.T_END), 1);
  assert.equal(room.avatarAlpha(room.T_WALK_START - 0.1), 0);
  assert.equal(room.avatarAlpha(room.T_ZOOM_START - 0.01), 1);
  assert.equal(room.avatarAlpha(room.T_END), 0, "the figure fades out as the camera becomes the player's eyes");
});

test("walking swings the legs and sitting folds them", () => {
  const walk = core.legAngles({ ...room.poseAt(room.T_WALK_START + 1.4), gait: Math.PI / 2 });
  assert.ok(walk.hips[0] > 0.3 && walk.hips[1] < -0.3, "legs swing in opposition");
  const sat = core.legAngles(room.poseAt(room.T_END));
  assert.ok(Math.abs(sat.hips[0] - (Math.PI / 2 - 0.04)) < 1e-9, "thighs horizontal");
  assert.ok(Math.abs(sat.hips[0] + sat.knees[0]) < 1e-9, "shins hang straight down");
  const typing = core.armAngles(room.poseAt(room.T_END), 0);
  assert.ok(typing[0] > 1 && typing[1] > 1, "hands reach forward to the keyboard");
});

test("the zoom lands exactly on the terminal glass at every viewport", () => {
  for (const [vw, vh] of [[1440, 900], [1280, 720], [1920, 1080], [1024, 768], [390, 844], [844, 390]]) {
    const end = room.shotAt(room.T_END, vw, vh);
    const distance = room.SCREEN.z - end.position[2];
    assert.ok(Math.abs(distance - room.zoomDistance(vw, vh)) < 1e-9);
    // The glass is SCREEN.w wide in the world; projected it must equal the terminal glass width in pixels.
    const pixels = (room.SCREEN.w * (vh / 2 / Math.tan(core.FOV / 2))) / distance;
    assert.ok(Math.abs(pixels - core.glassWidth(vw, vh)) < 1e-6, `${vw}x${vh}`);
    assert.deepEqual([...end.target], [room.SCREEN.x, room.SCREEN.y, room.SCREEN.z]);
  }
  assert.equal(core.glassWidth(390, 844), 390, "portrait phones use the whole screen");
  assert.ok(core.glassWidth(1440, 900) <= 1440 * 0.88 + 1e-9 && core.glassWidth(1440, 900) / (900 * 0.88) <= 4 / 3 + 1e-9);
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
  const stage = read("scenes/shared/Stage.svelte"), roomView = read("scenes/office/Room.svelte"), archiveView = read("scenes/archive/ArchiveRoom.svelte");
  const desk = read("scenes/office/CaseDesk.svelte"), app = read("App.svelte"), shell = read("ui/Shell.svelte");
  const scenes = ["scenes/office/chase3d-room.ts", "scenes/archive/chase3d-archive.ts", "scenes/shared/chase3d-stage.ts"].map(read).join("\n");
  assert.match(roomView, /import\("\.\/chase3d-room\.ts"\)/);
  assert.match(archiveView, /import\("\.\/chase3d-archive\.ts"\)/);
  for (const view of [stage, roomView, archiveView]) assert.doesNotMatch(view, /^\s*import\s+(?!type\b)[^\n]*chase3d/m, "Babylon.js stays out of the main bundle");
  assert.doesNotMatch(scenes, /\.(glb|gltf)|SceneLoader|ImportMesh|AppendAsync|LoadAssetContainer/i);
  assert.doesNotMatch(scenes, /from "@babylonjs\/core"/, "use deep imports so unused features are tree-shaken");
  assert.match(stage, /Skip intro/);
  assert.match(stage, /decideScene/, "reduced motion, Save-Data, slow networks and low memory skip the intro");
  assert.match(roomView, /nc-desk/, "the desk intro plays once per sign-in");
  assert.match(archiveView, /nc-archive/, "the archive intro plays once per sign-in");
  assert.match(app, /import\("\.\/scenes\/office\/Room\.svelte"\)/, "the room is a lazy chunk: nobody needs it on the sign-in path");
  assert.match(app, /import\("\.\/scenes\/archive\/ArchiveRoom\.svelte"\)/);
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
    assert.ok(p.x > core.ROOM.minX && p.x < core.ROOM.maxX && p.z > core.ROOM.minZ && p.z <= core.ROOM.maxZ, `inside the room at ${t.toFixed(2)}s`);
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
    const pixels = (arch.FILE.w * (vh / 2 / Math.tan(core.FOV / 2))) / distance;
    assert.ok(Math.abs(pixels - core.glassWidth(vw, vh)) < 1e-6, `${vw}x${vh}`);
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

const game = {
  api_version: "v1", case_id: "case-4e090abc", state_version: 1, duplicate: false, attempt_kind: "ordinary", events: [],
  state: { mission_id: "NG-M0427", case_dossier: { title: "The Vanishing Carved Ceremonial Staff \u2014 The Umuahia Case", stolen_item: "a carved ceremonial staff", premise: "Someone has taken a carved ceremonial staff from Umuahia.", opening_briefing: "The local case officer seals the scene at Umuahia." }, difficulty: 3, stage: 0, current_state: "Abia", elapsed: 0, score: 800, career_points: 4200, dossier: {}, visited_venues: [], warrant_suspect: null, outcome: null, opening_budget: 6000, balance: 6000, transport_rules_version: 1 }
};

test("the briefing shows the server's case dossier (title, stolen item, premise, opening briefing), not the suspect profile", () => {
  const lines = brief.dossierLines(game);
  const get = label => lines.find(l => l.label === label)?.value;
  assert.deepEqual(lines.slice(0, 4).map(l => l.label), ["Case", "Stolen", "Premise", "Briefing"], "the opening case file comes first, in the documented order");
  assert.equal(get("Case"), game.state.case_dossier.title);
  assert.equal(get("Stolen"), game.state.case_dossier.stolen_item);
  assert.equal(get("Premise"), game.state.case_dossier.premise);
  assert.equal(get("Briefing"), game.state.case_dossier.opening_briefing);
  assert.match(get("Starting at"), /^Abia/);
  assert.match(get("Case clock"), /Monday 07:00/);
  assert.equal(get("Case funds"), "\u20A66,000");
  assert.equal(get("Attempt"), "Ordinary \u00B7 NG-M0427");
  assert.equal(brief.dossierLines({ ...game, attempt_kind: "replay" }).find(l => l.label === "Attempt").value, "Replay (no points) \u00B7 NG-M0427");
  const text = lines.map(l => l.value).join(" ");
  assert.doesNotMatch(text, /career|warrant|0\/8/i, "the suspect profile (state.dossier) is never substituted for the case dossier");
  const withoutFile = brief.dossierLines({ ...game, state: { ...game.state, case_dossier: undefined } });
  assert.ok(withoutFile.length >= 3 && !withoutFile.some(l => l.label === "Case"), "an older server without a case dossier still gets the facts");
});

test("the dossier types out in a fixed time, label before value, row by row", () => {
  const lines = brief.dossierLines(game);
  const total = brief.totalChars(lines);
  assert.equal(brief.typedRows(lines, 0).rows.length, 0);
  const some = brief.typedRows(lines, lines[0].label.length + 3);
  assert.equal(some.rows.length, 1);
  assert.equal(some.rows[0].label, lines[0].label);
  assert.equal(some.rows[0].value, lines[0].value.slice(0, 3));
  assert.equal(some.done, false);
  const all = brief.typedRows(lines, total);
  assert.deepEqual(all.rows, lines);
  assert.equal(all.done, true);
  const ticks = Math.ceil(total / brief.charsPerTick(total));
  assert.ok(ticks * brief.TICK_MS <= brief.TYPING_SECONDS * 1000 + brief.TICK_MS, `typing takes ${(ticks * brief.TICK_MS / 1000).toFixed(1)}s`);
  assert.ok(brief.TYPING_SECONDS <= 5, "typing is an animation: five seconds or less");
});

test("every venue in the game data has its own drawing, copy, and unknown venues still work", () => {
  const csv = fs.readFileSync(new URL("../../data/gameplay/venues.csv", import.meta.url), "utf8").trim().split("\n").slice(1).map(l => l.split(",")[0]);
  const art = read("scenes/office/VenueArt.svelte");
  assert.ok(csv.length >= 30);
  for (const id of csv) {
    assert.ok(venues.hasFlavour(id), `${id} has briefing copy`);
    assert.match(art, new RegExp(`id === "${id}"`), `${id} has its own drawing`);
    const info = venues.leadInfo(id);
    assert.ok(info.who.length > 3 && info.blurb.length > 10, id);
  }
  assert.equal(venues.leadInfo("market").who, "Traders and loaders", "the witness screens' copy wins for the original three venues");
  assert.ok(venues.leadInfo("something_new").who.length > 0, "an unknown venue still gets generic copy");
  assert.match(art, /\{:else\}[\s\S]*M60 8q-20 0-20 20/, "unknown venues get a map pin");
  assert.doesNotMatch(art, /<(image|img)\b|href=|xlink/, "drawings are inline paths, no files");
});

test("the exit animation: the player stands, walks out of the door and the camera pulls back from the monitor", () => {
  assert.ok(room.T_OUT_END <= 5, `exit is ${room.T_OUT_END.toFixed(2)}s`);
  const first = room.outroPoseAt(0);
  assert.ok(first.sit === 1 && Math.abs(first.x - room.SEAT.x) < 1e-9 && Math.abs(first.z - room.SEAT.z) < 1e-9, "starts seated");
  const standing = room.outroPoseAt(room.T_OUT_WALK_START - 0.01);
  assert.ok(standing.sit < 0.01 && Math.abs(standing.y) < 0.01, "stands before walking");
  const last = room.outroPoseAt(room.T_OUT_END);
  assert.ok(Math.abs(last.x - room.DOOR.x) < 0.02 && last.z > room.DOOR.z - 0.2, "ends in the doorway");
  for (let t = 0; t <= room.T_OUT_END; t += 0.05) {
    const p = room.outroPoseAt(t);
    assert.ok(p.x > core.ROOM.minX && p.x < core.ROOM.maxX && p.z > core.ROOM.minZ && p.z <= core.ROOM.maxZ, `inside the room at ${t.toFixed(2)}s`);
  }
  assert.equal(room.outroGlassAt(0), 1);
  assert.equal(room.outroGlassAt(room.T_OUT_ZOOM), 0, "the glass is gone before the camera is out");
  const start = room.outroShotAt(0, first, 1440, 900), end = room.outroShotAt(room.T_OUT_END, last, 1440, 900);
  assert.ok(Math.abs(start.position[2] - room.shotAt(room.T_END, 1440, 900).position[2]) < 1e-9, "starts exactly where the intro ended");
  assert.ok(end.position[2] < start.position[2] - 3, "the camera has pulled well back");
  assert.equal(room.outroAlphaAt(0), 0, "the figure is hidden while the camera is its eyes");
  assert.equal(room.outroAlphaAt(room.T_OUT_END), 0, "and gone through the door");
});

test("opening a case shows the briefing on the desk; choosing a lead leaves through the scene and then opens it", () => {
  const appSrc = read("state/app.svelte.ts"), desk = read("scenes/office/CaseDesk.svelte"), stage = read("scenes/shared/Stage.svelte"), inv = read("screens/case/Investigate.svelte"), shell = read("ui/Shell.svelte");
  assert.match(appSrc, /this\.briefing = true; this\.pendingLead = "";\s*this\.go\("cases"\)/, "a new case opens on the desk, not the investigation");
  assert.match(appSrc, /finishBriefing\(lead = ""\)/);
  assert.match(desk, /await leave\(\);\s*app\.finishBriefing\(lead\.id\)/, "the exit plays before the investigation opens");
  assert.doesNotMatch(desk, /Skip briefing/, "the briefing has no skip: the dossier is always read");
  assert.doesNotMatch(desk, /setTimeout\(\(\) => \{ step = "leads"/, "the briefing never moves on by itself: the player reads at their own pace");
  assert.match(desk, /step = "leads"; \}\}>/, "an explicit Continue button moves on");
  assert.match(desk, /Take your time/);
  assert.match(desk, /Skip to the case/);
  assert.match(desk, /<VenueArt id=\{lead\.id\} \/>/);
  assert.match(desk, /groupQuotes\(app\.quotes, "local"\)/, "the leads are the server's local quotes");
  assert.match(stage, /LEAVE_MAX_MS/, "leaving can never hang the screen");
  assert.match(appSrc, /lead \? "garage"/, "a chosen lead continues in the garage, where the transport is picked");
  assert.doesNotMatch(desk, /command\(/, "choosing a lead sends no command from the desk");
  assert.match(shell, /app\.screen !== "cases"\) \|\|?[^\n]*|inCase && app\.screen !== "cases"/, "no case HUD over the desk");
});

import * as garage from "../src/scenes/garage/garage-scene.ts";

test("the garage: every animation is five seconds or less", () => {
  for (const [name, t] of [["intro", garage.T_END], ["drive", garage.T_DRIVE_END], ["hitch", garage.T_HITCH_END]]) assert.ok(t <= garage.MAX_SECONDS, `${name} is ${t.toFixed(2)}s`);
});

test("the garage intro: the player comes through the office door and stops beside the car, facing the camera", () => {
  assert.equal(garage.introPoseAt(0).visible, false);
  const first = garage.introPoseAt(garage.T_WALK_START + 0.01);
  assert.ok(Math.abs(first.x - garage.DOOR.x) < 0.05 && first.z > garage.DOOR.z - 0.3, "enters at the door");
  const end = garage.introPoseAt(garage.T_END);
  assert.ok(Math.abs(end.x - garage.STAND.x) < 1e-9 && Math.abs(end.z - garage.STAND.z) < 1e-9 && Math.abs(Math.cos(end.heading) - 1) < 1e-9 && end.stride === 0);
  assert.ok(garage.T_ARRIVE < garage.T_END, "arrives before the options appear");
  for (let t = 0; t <= garage.T_END; t += 0.05) {
    const p = garage.introPoseAt(t);
    assert.ok(p.x > core.ROOM.minX && p.x < core.ROOM.maxX && p.z > core.ROOM.minZ && p.z <= core.ROOM.maxZ, `inside the garage at ${t.toFixed(2)}s`);
  }
  assert.equal(garage.glassAt(0), 0);
  assert.equal(garage.glassAt(garage.T_END), 1, "the transport options are shown by the time the scene settles");
  const a = garage.introShotAt(0), b = garage.introShotAt(garage.T_END);
  assert.ok(a.position[0] < b.position[0] - 3, "the camera pans across the garage");
  b.position.forEach((v, i) => assert.ok(Math.abs(v - garage.wideShot().position[i]) < 1e-9, "settles on the wide shot"));
});

test("driving: the player walks to the car, climbs in, and the car accelerates away with him in it", () => {
  const seat = { x: garage.CAR.x + garage.SEAT.x, z: garage.CAR.z + garage.SEAT.z };
  const seated = garage.drivePoseAt(garage.T_DRIVE_START);
  assert.ok(Math.abs(seated.x - seat.x) < 1e-6 && Math.abs(seated.z - seat.z) < 1e-6 && seated.sit === 1, "in the driver's seat before the car moves");
  assert.ok(Math.abs(seated.y + garage.CAR_SIT_DROP) < 1e-6);
  assert.equal(garage.carZAt(garage.T_DRIVE_START), garage.CAR.z, "the car is still when he gets in");
  let last = garage.CAR.z;
  for (let t = garage.T_DRIVE_START; t <= garage.T_DRIVE_END; t += 0.05) { const z = garage.carZAt(t); assert.ok(z <= last + 1e-9, "only moves forward"); last = z; }
  assert.ok(Math.abs(garage.carZAt(garage.T_DRIVE_END) - garage.CAR_GONE_Z) < 1e-9, "gone by the end");
  assert.ok(garage.CAR_GONE_Z < garage.wideShot().position[2], "the car passes the camera and leaves the picture");
  const rides = garage.drivePoseAt(garage.T_DRIVE_END);
  assert.ok(Math.abs(rides.z - (garage.CAR_GONE_Z + garage.SEAT.z)) < 1e-6, "the player rides with the car");
  assert.ok(garage.wheelAngleAt(garage.T_DRIVE_END) > 20, "the wheels turn as it drives");
  const mid = garage.drivePoseAt(0.9);
  assert.ok(mid.sit > 0 && mid.sit < 1 && mid.y > 0, "he steps up and over the side");
  assert.equal(garage.outroEnd("drive"), garage.T_DRIVE_END);
});

test("hitching a ride: the player turns, sticks a thumb out and heads for the roadside", () => {
  const start = garage.hitchPoseAt(0), mid = garage.hitchPoseAt(1.2), end = garage.hitchPoseAt(garage.T_HITCH_END);
  assert.ok(Math.abs(start.x - garage.STAND.x) < 1e-9 && start.thumb === 0);
  assert.equal(mid.thumb, 1, "a thumb is out while walking");
  assert.ok(end.z < garage.STAND.z - 3 && end.x < garage.STAND.x - 1.5, "he has left the garage towards the road");
  assert.equal(end.alpha, 0, "and is out of sight");
  assert.equal(garage.outroEnd("hitch"), garage.T_HITCH_END);
  assert.deepEqual(garage.MODE_FOR, { drive: "drive", hitch: "hitch_ride" }, "the two cards are the server's two local modes");
});

test("the garage screen offers Drive and Hitch a ride, asks the server first, and only then plays the exit", () => {
  const view = read("scenes/garage/GarageRoom.svelte"), appSrc = read("state/app.svelte.ts"), appView = read("App.svelte"), model = read("domain/model.ts");
  assert.match(view, /import\("\.\/chase3d-garage\.ts"\)/);
  assert.doesNotMatch(view, /^\s*import\s+[^\n]*chase3d/m);
  assert.match(view, /MODE_LABEL\[MODE_FOR\[how\]\]/, "labelled with the server's own mode names");
  assert.match(view, /visit_venue/);
  assert.match(view, /const ok = await app\.command\([^)]*\);\s*if \(!ok\) \{ chosen = ""; failed = true; return; \}\s*await leave\(how\);\s*app\.leaveGarage\(\)/, "command, then exit animation, then the investigation");
  assert.match(view, /quote\.affordable/, "an unaffordable option cannot be chosen");
  assert.match(view, /missesDeadline/);
  assert.match(appSrc, /leaveGarage\(\)/);
  assert.match(appView, /import\("\.\/scenes\/garage\/GarageRoom\.svelte"\)/);
  assert.match(model, /"garage"/);
});
