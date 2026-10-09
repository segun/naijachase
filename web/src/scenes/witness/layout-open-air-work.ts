// Where things stand at the farm, the mining site, the refinery, the factory gate and the conservation office (set id `work_and_land`).
// Pure data, read by both renderers. The cone behind the witness (x about 0 at z 5, drifting left further back) is kept to plain, large shapes:
// bare earth, a storage tank, a factory wall, an office wall, a heap of rock.
import { type Layout, type Motion, type Prop, arm, ball, box, crates, cyl, cylx, cylz, fenceX, fenceZ, floodlight, gantry, glow, lampPost, nameOf, pick, rng, sign, skyline, standing, stroller, table, tree, variate } from "./layout-open-air-kit.ts";

const PI = Math.PI;
const lamps = [{ x: 1.2, y: 3, z: 0.8, c: "#ffd9a0" }, { x: -2.5, y: 3, z: 2, c: "#ffd9a0" }];
/** A gatehouse beside a gate with a barrier boom that slowly lifts and drops. */
const gate = (x: number, z: number, ph: number, name: string, c = "#c9b68f"): Prop[] => [
  ...gantry(x - 3.3, z - 0.7, 6.2, 1.1, 4.6, name, "#14394f", "#f7f1dc", "#3a3d40"),
  box(x, 0, z, 2.2, 2.5, 2.2, c), box(x, 2.5, z, 2.8, 0.18, 2.8, "#4a4e52"), box(x, 1.2, z - 1.11, 1.2, 0.7, 0.03, "#27414f"),
  arm(x - 1.2, 1.1, z - 1.4, 4.6, 0.2, "z", PI - 0.3, "#d63a2e", { amp: -0.27, m: { f: 0.05, ph } }), cyl(x - 6.0, 0, z - 1.4, 0.2, 1.1, "#e8e2cf")
];
const tanker = (x: number, z: number, tank = "#c9ced2"): Prop[] => [
  box(x + 3.2, 0.6, z, 9, 0.4, 2, "#22262a"), cylx(x + 3.7, 1.0, z, 6.8, 2.3, tank), box(x - 0.1, 0.7, z, 1.9, 2.5, 2.4, "#2e6f8f"), box(x - 0.1, 1.9, z - 1.21, 1.5, 0.8, 0.03, "#27414f"),
  ...[0, 3.4, 5.4].map(dx => cylz(x + dx + 0.2, 0, z - 1.0, 1.0, 0.3, "#15191c")), box(x - 1.1, 0.8, z - 0.7, 0.1, 0.25, 0.4, "#fff4cf", { glow: true })
];

function farm(name: string, r: () => number): Layout {
  const [c1, c2] = pick(r, [["#3f8a3a", "#4f9a3a"], ["#8a9a3a", "#a0b04a"], ["#4a8a4a", "#3f7a3a"], ["#b8a23c", "#c9b24a"]] as const), goatN = 2 + Math.floor(r() * 3), house = pick(r, ["#e8dcc0", "#efe6cf", "#d9c9a4"]), tankC = pick(r, ["#2b3a4a", "#4a5a3a", "#8a8f94"]);
  const rows = (x: number, w: number, zs: readonly number[]) => zs.map((z, i) => box(x, 0, z, w, 0.7, 0.6, i % 2 ? c2 : c1, { hi: i > 4 }));
  const out: Prop[] = [
    ...skyline(41, ["#6f8a5a", "#7a9460", "#8aa070"], 60, 22, 5), ...tree(-15, 13, 7.5, "#3f7a3a", 0.6), ...tree(16, 14, 7.5, "#3f7a3a", 0.6), ...tree(-11, 18, 6.5, "#4a8a3a", 0.6),
    ...gantry(-4.6, 3.8, 6, 1.1, 3.7, name, pick(r, ["#2f5f2f", "#5a3a22", "#14394f"]), "#f4ecd8", "#6b4a2b"),
    // Crop rows either side of a bare strip, so the middle stays plain.
    ...rows(-9.5, 9, [4.9, 6.1, 7.3, 8.5, 9.7, 10.9].slice(0, 4 + Math.floor(r() * 3))), ...rows(10.5, 9, [8.1, 9.3, 10.5, 11.7].slice(0, 2 + Math.floor(r() * 3))),
    // The sorting shed: tomatoes, yams and crates laid out under a tin roof.
    ...[-1, 1].flatMap(sx => [-1, 1].map(sz => cyl(10.2 + sx * 2.6, 0, 5.2 + sz * 1.2, 0.14, 2.7, "#5a3d22"))), box(10.2, 2.7, 5.2, 6, 0.12, 3, "#9aa0a3"),
    ...table(8.8, 5.2, 1.8, 0.9), ...[0, 1, 2, 3, 4, 5].map(i => ball(8.2 + (i % 3) * 0.3, 0.8 + Math.floor(i / 3) * 0.2, 5.1 + (i % 2) * 0.15, 0.3, "#c0392b")),
    ...[0, 1, 2].map(i => box(10.6 + i * 0.5, 0, 5.0, 0.7, 0.25, 0.3, "#8a5a2f")), ...crates(11.3, 5.6, 3, 2), ball(7.2, 0, 4.4, 0.8, "#c9b48a", { sy: 0.7 }), ball(7.9, 0, 4.2, 0.8, "#c9b48a", { sy: 0.7 }),
    // A water tank on a stand and a farmhouse with a lamp in the window.
    ...[-0.7, 0.7].flatMap(dx => [-0.7, 0.7].map(dz => box(-14 + dx, 0, 5.4 + dz, 0.12, 2.2, 0.12, "#5a3d22"))), cyl(-14, 2.2, 5.4, 2, 1.5, tankC),
    box(-14, 0, 18, 8, 3.2, 5, house), box(-14, 3.2, 18, 8.8, 0.3, 5.8, "#8a4a2a"), box(-14, 0, 15.46, 1.2, 2.1, 0.06, "#3a2a1c"), box(-11.6, 1.1, 15.46, 1.2, 1, 0.06, "#35607a"), box(-11.6, 1.1, 15.44, 1.2, 1, 0.02, "#ffd9a0", { night: true, glow: true }),
    // A goat pen with a lantern.
    ...fenceX(5.5, 12.5, 15.5, 1.1), ...fenceX(5.5, 12.5, 19.5, 1.1), ...fenceZ(5.5, 15.5, 19.5, 1.1), ...fenceZ(12.5, 15.5, 19.5, 1.1),
    ...[[7.6, 17, "#e8e0cc"], [9.8, 17.8, "#8a5a3c"], [11, 16.4, "#2b2420"], [8.6, 18.6, "#c9a36a"]].slice(0, goatN).flatMap(([x, z, c]) => [box(x as number, 0.35, z as number, 0.7, 0.4, 0.28, c as string), box((x as number) + 0.42, 0.55, z as number, 0.22, 0.3, 0.2, c as string), ...[-0.25, 0.25].map(dx => box((x as number) + dx, 0, z as number, 0.07, 0.38, 0.07, c as string))]),
    ...lampPost(7, 15, 2.6, "#ffd9a0"), ...lampPost(-4.6, 3.6, 3.6)
  ];
  return {
    ground: "#8f7a4a", props: out,
    people: [stroller(-8, 3.5, 131, -13, 13, 0.55), standing(8.4, 4.1, PI, 132), standing(-9.4, 6.4, PI, 133), standing(6.8, 4.6, PI * 0.7, 134), stroller(5, 3.6, 135, -13, 13, -0.5), standing(12.2, 4.4, PI, 136), standing(-6.6, 5.2, PI * 0.8, 137), standing(11, 9.4, PI * 0.5, 138)],
    lamps
  };
}

function mining(name: string, r: () => number): Layout {
  const rock = ["#8a8378", "#a39580", "#6f6a60", "#b09878"], truckC = pick(r, ["#c98a1b", "#e8e2cf", "#2e6f8f"]), digger = r() < 0.8, jit = () => (r() - 0.5) * 2;
  const heap = (x: number, z: number, w: number, h: number, c: string): Prop[] => [cyl(x, 0, z, w, h, c, { w2: w * 0.14 }), ball(x - w * 0.18, 0, z - w * 0.12, w * 0.3, "#6f6a60", { sy: 0.6, hi: true })];
  const flap: Motion = { f: 0.12 };
  const out: Prop[] = [
    ...skyline(42, ["#8a7a62", "#9a8a70", "#7a6a54"], 62, 22, 8),
    ...gate(-4, 4.8, 1.0, name, pick(r, ["#c9b68f", "#d8d5cc", "#b9c4a8"])),
    sign(5.2, 1.1, 3.9, 1.7, 1.1, "HARD HATS\nREQUIRED", "#f2c14e", "#15191c"), cyl(4.5, 0, 3.95, 0.09, 1.2, "#3a3d40"), cyl(5.9, 0, 3.95, 0.09, 1.2, "#3a3d40"),
    sign(8, 1.1, 3.9, 1.7, 1.1, "SAFETY\nFIRST", "#2f8f5b", "#ffffff"), cyl(7.3, 0, 3.95, 0.09, 1.2, "#3a3d40"), cyl(8.7, 0, 3.95, 0.09, 1.2, "#3a3d40"),
    // Heaps of rock, a conveyor climbing out of the pit, a dozer-sized digger and a haul truck.
    ...heap(-13.5 + jit(), 10.5, 8, 4 + r() * 2, pick(r, rock)), ...heap(10 + jit(), 9.5, 8, 4 + r() * 2.5, pick(r, rock)), ...heap(5.5 + jit(), 15, 7, 5 + r() * 2.5, pick(r, rock)), ...(r() < 0.75 ? heap(-8 + jit(), 15, 7.5, 4 + r() * 2, pick(r, rock)) : []),
    arm(3, 0.8, 12.5, 15, 0.7, "z", 0.42, "#4a4e52"), ...[5, 9, 13].map(x => cyl(x, 0, 12.5, 0.2, 1.8 + (x - 3) * 0.45, "#3a3d40")),
    box(-2, 0, 19, 12, 0.08, 2, "#6f6a60", { hi: true }),
    ...(digger ? [box(-15.4, 0, 6.8, 4.2, 0.8, 2.2, "#3a3d40"), box(-15.4, 0.8, 6.8, 3, 1.8, 2.6, "#c98a1b"), arm(-14.2, 2.2, 6.8, 5.2, 0.5, "z", 0.7, "#c98a1b", { amp: 0.1, m: flap }), arm(-10.6, 5.8, 6.8, 3, 0.35, "z", -0.8, "#c98a1b")] : [box(-14, 0, 7, 3, 1.3, 2, "#c98a1b"), box(-14, 1.3, 7, 1.4, 0.8, 1.4, "#27414f")]),
    box(11, 0.9, 5.6, 6.2, 0.5, 3, truckC), box(12.1, 1.4, 5.6, 4.2, 1.6, 2.9, truckC), box(8.6, 1.4, 5.6, 1.8, 1.8, 2.5, truckC), ball(12.1, 3.0, 5.6, 3.6, "#8a8378", { sy: 0.45 }),
    ...[8.8, 12.4].map(x => cylz(x, 0, 4.1, 1.9, 0.4, "#15191c")), box(7.65, 1.0, 5.1, 0.1, 0.25, 0.4, "#fff4cf", { glow: true }),
    ...(r() < 0.7 ? fenceX(-18, 18, 20.5, 2.0, "#6b7075") : []), ...floodlight(-17, 4.8, 8), ...floodlight(15, 4.4, 8), ...lampPost(-4.6, 3.7)
  ];
  return {
    ground: "#8d7b62", props: out,
    people: [stroller(-8, 3.5, 141, -13, 13, 0.5), standing(-6.6, 3.8, PI * 0.9, 142), standing(-9.8, 3.8, PI, 143), standing(8, 3.9, PI * 1.1, 144), stroller(5, 3.6, 145, -13, 13, -0.5), standing(13.6, 4.3, -PI * 0.6, 146), standing(-13, 4.2, PI * 0.7, 147), standing(4.4, 5.2, PI, 148)],
    lamps
  };
}

function refinery(name: string, r: () => number): Layout {
  const tankC = pick(r, ["#e3e5e6", "#d8d0b8", "#c9d3d8"]), tankerC = pick(r, ["#c9ced2", "#e8e2cf", "#d9822b"]), flareH = 8 + r() * 2, third = r() < 0.7, pipes = pick(r, [["#8a8f94", "#b5483a", "#2e6f8f"], ["#8a8f94", "#d9822b", "#2f8f5b"], ["#aeb6bb", "#b5483a", "#7a8a8f"]] as const);
  const tank = (x: number, z: number, w: number, h: number): Prop[] => [cyl(x, 0, z, w, h, tankC), cyl(x, h, z, w + 0.2, 0.35, "#b5b9bd"), box(x - w / 2 + 0.2, 0, z - w / 2 - 0.02, 0.5, h, 0.06, "#8a8f94", { hi: true }), cyl(x, 0, z, w + 0.1, 0.5, "#8a8f94")];
  const flare: Motion = { ay: 0.12, f: 2.3 };
  const out: Prop[] = [
    ...skyline(43, ["#8c9aa0", "#9aa5aa"], 62, 20, 7),
    ...gate(-4, 4.8, 2.0, name, pick(r, ["#d8d5cc", "#c9c2a8", "#cfd8dc"])),
    sign(5, 1.1, 3.9, 1.7, 1.1, "NO NAKED\nFLAME", "#f2c14e", "#15191c"), cyl(4.3, 0, 3.95, 0.09, 1.2, "#3a3d40"), cyl(5.7, 0, 3.95, 0.09, 1.2, "#3a3d40"),
    sign(8.6, 1.1, 3.9, 2.1, 1.1, "AUTHORISED\nPERSONNEL ONLY", "#d63a2e", "#ffffff"), cyl(7.6, 0, 3.95, 0.09, 1.2, "#3a3d40"), cyl(9.6, 0, 3.95, 0.09, 1.2, "#3a3d40"),
    // Storage tanks: a plain white wall behind the witness, a pipe rack, a flare stack.
    ...tank(-4, 14, 10, 7 + r() * 2), ...tank(9.5 + r(), 15, 8, 6 + r() * 2), ...(third ? tank(-17, 15, 8, 5 + r() * 2) : []),
    cylx(-2, 3.0, 8, 36, 0.45, pipes[0]), cylx(-2, 3.7, 8, 36, 0.4, pipes[1]), cylx(-2, 4.4, 8, 36, 0.5, pipes[2]), ...[-18, -12, -6, 0, 6, 12, 18].map(x => box(x, 0, 8, 0.3, 4.6, 0.3, "#4a4e52")),
    cyl(15.5, 0, 12, 0.8, flareH, "#8a8f94", { w2: 0.45 }), ball(15.5, flareH - 0.1, 12, 1.4, "#ff9a3a", { glow: true, m: flare }), glow(15.5, flareH + 0.6, 12, 5, "#ff9a3a"),
    ...(r() < 0.85 ? tanker(8, 5.6, tankerC) : crates(8, 5.4, 4, 2)), ...fenceX(-20, -12.6, 3.7, 2.2, "#6b7075"), ...fenceX(7, 19, 3.7, 2.2, "#6b7075"),
    ...lampPost(-14, 3.4, 3, "#ff9a3a"), ...lampPost(-4.6, 3.6, 3.6, "#ff9a3a"), ...lampPost(18, 3.4, 3, "#ff9a3a"), ...floodlight(-19, 6, 9)
  ];
  return {
    ground: "#9c9a92", props: out,
    people: [stroller(-8, 3.5, 151, -13, 13, 0.5), standing(-6.6, 3.8, PI * 0.9, 152), standing(-9.8, 3.8, PI, 153), standing(4.6, 4.4, PI * 1.2, 154), stroller(5, 3.6, 155, -13, 13, -0.5), standing(13.8, 3.8, PI, 156), standing(-14, 4.2, PI * 0.7, 157), standing(7, 7.4, PI * 0.5, 158)],
    lamps: [{ x: 1.2, y: 3, z: 0.8, c: "#ffc98a" }, { x: -2.5, y: 3, z: 2, c: "#ffc98a" }]
  };
}

function factory(name: string, r: () => number): Layout {
  const wall = pick(r, ["#a39d90", "#9aa0a3", "#b0a48a"]), teeth = pick(r, [["#7a8a8f", "#8a9a9f"], ["#7a3a2e", "#8a4a3a"], ["#4a5a6a", "#5a6a7a"]] as const), chimney = r() < 0.8, tk1 = pick(r, ["#c9ced2", "#e8e2cf"]), tk2 = pick(r, ["#d9822b", "#2e6f8f", "#2f8f5b"]), doors = pick(r, ["#3a3d40", "#2f4a5a", "#5a2a22"]);
  const puff: Motion = { ay: 0.35, ax: 0.2, f: 0.12 };
  const out: Prop[] = [
    ...skyline(44, ["#8c8579", "#9aa0a3"], 62, 20, 7),
    ...gate(-4, 4.8, 0.4, name, pick(r, ["#d8d5cc", "#c9c2a8", "#cfd8dc"])),
    // The factory: a long plain wall, a sawtooth roof, loading doors and a chimney.
    box(2, 0, 16, 32, 7, 9, wall), ...[-10, -4, 2, 8, 14].map((x, i) => box(x, 7, 16, 5.6, 1.8, 9, teeth[i % 2]!)), ...[-10, 8, 13].map(x => box(x, 0, 11.46, 3.2, 3.4, 0.06, doors)),
    ...(chimney ? [cyl(-14, 0, 20, 2.2, 12, "#a0522d", { w2: 1.5 }), ball(-14, 12.2, 20, 2.2, "#d5d5d5", { sy: 0.8, m: puff }), ball(-13.4, 13.4, 20, 2.6, "#e0e0e0", { sy: 0.8, hi: true, m: { ...puff, ph: 2 } })] : [box(-14, 7, 20, 3, 2.4, 3, "#7a8a8f")]),
    sign(5.6, 1.1, 3.9, 2.2, 1.1, "SHIFT\n06:00 - 18:00", "#176b4d", "#ffffff"), cyl(4.6, 0, 3.95, 0.09, 1.2, "#3a3d40"), cyl(6.6, 0, 3.95, 0.09, 1.2, "#3a3d40"),
    // Tankers queuing for inspection at the right.
    ...tanker(6.4, 5.4, tk1), ...(r() < 0.8 ? tanker(15.4, 5.6, tk2) : []), ...crates(-12, 5.4, 3, 2), ...[0, 1].map(i => cyl(-10.4 + i * 0.7, 0, 5.4, 0.6, 0.9, i ? "#b5483a" : "#2e6f8f")),
    ...floodlight(-17.5, 7, 9), ...floodlight(19, 9, 9), ...floodlight(2, 10.2, 8), ...lampPost(-4.6, 3.6)
  ];
  return {
    ground: "#85807a", props: out,
    people: [stroller(-8, 3.5, 161, -13, 13, 0.6), stroller(-6, 3.7, 162, -13, 13, 0.5), standing(-6.6, 3.9, PI * 0.9, 163), standing(-10, 3.8, PI, 164), stroller(5, 3.6, 165, -13, 13, -0.55), standing(4, 4.2, PI * 1.2, 166), standing(-13, 4.4, PI * 0.7, 167), standing(11, 4.4, -PI * 0.7, 168)],
    lamps
  };
}

function conservation(name: string, r: () => number): Layout {
  const wall = pick(r, ["#efe6cf", "#f4f1e6", "#dfe6cf"]), roof = pick(r, ["#2f6b4a", "#6b3a2e", "#3a4a6a"]), jeepC = pick(r, ["#4a6a3a", "#e8e2cf", "#a89060"]), mast = r() < 0.7, wild = pick(r, [["PROTECT\nWILDLIFE", "#e0b23a"], ["KEEP TO\nTHE TRAILS", "#d9822b"], ["NO\nPOACHING", "#e0b23a"]] as const), spot = pick(r, [["REPORT\nSIGHTINGS", "#2e6f8f"], ["BIRDS OF\nTHE PARK", "#2f8f5b"], ["FIRE\nWARNING", "#d63a2e"]] as const);
  const out: Prop[] = [
    ...skyline(45, ["#8aa070", "#7a9460", "#9aa87a"], 62, 22, 5), ...tree(-13 + r() * 2, 9, 6.5, "#6b8a3a", 0.35), ...tree(14 + r() * 2, 11, 7, "#6b8a3a", 0.35), ...(r() < 0.7 ? tree(17, 18, 6.5, "#6b8a3a", 0.35) : []), ...tree(-12, 18, 7, "#6b8a3a", 0.35),
    // The office: a plain cream wall under a green roof and a veranda, with notice boards beside the door.
    box(0, 0, 8.4, 11, 3.2, 5.4, wall), box(0, 3.2, 8.4, 12, 0.3, 6.2, roof), box(0, 2.8, 5.0, 11.6, 0.14, 1.6, roof), ...[-5.2, -3.2, 3.2, 5.2].map(x => cyl(x, 0, 4.4, 0.16, 2.8, "#6b4a2b")),
    box(0, 0, 5.68, 1.4, 2.2, 0.06, "#3a2a1c"), box(-3.2, 1.0, 5.68, 1.6, 1.2, 0.06, "#35607a"), box(-3.2, 1.0, 5.66, 1.6, 1.2, 0.02, "#ffd9a0", { night: true, glow: true }), box(3.4, 1.0, 5.68, 1.6, 1.2, 0.06, "#35607a"),
    sign(-1.9, 1.3, 5.66, 1.5, 1.1, "PARK MAP\n& NOTICES", "#4a6a4a", "#f4ecd8"), sign(1.9, 1.3, 5.66, 1.3, 1.1, wild[0], wild[1], "#2a1a12"), sign(5.2, 1.3, 5.66, 1.1, 0.9, spot[0], spot[1], "#ffffff"),
    sign(0, 3.55, 5.2, 6.4, 1.1, name, "#2f6b4a", "#f4ecd8"), box(-0.9, 0, 5.3, 0.3, 0.25, 0.12, "#4a3a2a"), box(-0.5, 0, 5.3, 0.3, 0.25, 0.12, "#4a3a2a"), ...lampPost(-6.2, 3.8, 3.4, "#ffd9a0"),
    // A field jeep with a roof rack and a spare wheel, and the radio mast.
    box(9.6, 0.7, 4.8, 4.2, 1.0, 1.9, jeepC), box(9.3, 1.7, 4.8, 2.4, 0.9, 1.8, jeepC), box(9.3, 1.85, 3.89, 2.2, 0.55, 0.03, "#27414f"), box(9.3, 2.62, 4.8, 2.6, 0.06, 1.6, "#3a3d40"),
    box(11.7, 0.7, 4.8, 0.3, 0.3, 1.2, "#2b2f33", { hi: true }), box(7.55, 0.95, 4.2, 0.1, 0.25, 0.4, "#fff4cf", { glow: true }), glow(7.4, 1.0, 4.0, 1.5, "#fff4cf"),
    ...[8.4, 10.8].map(x => cylz(x, 0, 3.85, 1.0, 0.3, "#15191c")),
    ...(mast ? [cyl(-9.5, 0, 6.5, 0.25, 9.5, "#8a8f94", { w2: 0.12 }), box(-9.5, 7.6, 6.5, 1.6, 0.06, 0.06, "#8a8f94"), box(-9.5, 8.6, 6.5, 1.1, 0.06, 0.06, "#8a8f94"), box(-9.5, 0, 6.5, 1.2, 0.8, 1, "#c9b68f")] : [...tree(-9.5, 6.8, 6, "#6b8a3a", 0.35)]),
    cyl(7.6, 0, 3.9, 0.08, 6, "#e8e2cf"), box(8.05, 5.3, 3.9, 0.9, 0.55, 0.03, "#2f6b4a", { m: { ax: 0.04, f: 0.7 } }), cyl(-7.4, 0, 4.4, 0.7, 0.9, "#2e6f8f")
  ];
  return {
    ground: "#a79867", props: out,
    people: [stroller(-8, 3.5, 171, -13, 13, 0.5), standing(-2.4, 4.0, PI * 0.9, 172), standing(6.6, 3.9, PI * 1.2, 173), standing(-6.2, 4.1, PI, 174), stroller(5, 3.6, 175, -13, 13, -0.5), standing(11.8, 3.8, PI * 0.8, 176), standing(-11, 4.4, PI * 0.7, 177), standing(14, 4.4, -PI * 0.7, 178)],
    lamps
  };
}

/** The layout for a work-and-land variant; an unknown variant shows the farm. */
export function workLayout(variant: string, venueName: string, seed = 0): Layout {
  const name = nameOf(venueName || variant.replace(/_/g, " ")), r = rng(seed);
  const build = variant === "mining_site" ? mining : variant === "refinery" ? refinery : variant === "factory_gate" ? factory : variant === "conservation_office" ? conservation : farm;
  return variate(build(name, r), seed);
}
