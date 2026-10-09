// Where things stand at the water's edge: the beach, the fishing jetty, the passenger jetty, the waterfront and the seaport (set id `water_edge`).
// Pure data, read by both renderers. Water fills everything behind `water.z`; the cone behind the witness (x about -2 at z 9, drifting left)
// is kept to plain shapes (a hull, a fascia, the water itself) so her face reads.
import { type Layout, type Motion, type Prop, awning, ball, box, boat, crates, cyl, cylz, floodlight, gantry, lampPost, nameOf, palm, pick, rng, sign, skyline, standing, stroller, table, variate } from "./layout-open-air-kit.ts";

const PI = Math.PI;
const bob = (ph: number, ay = 0.05, f = 0.32): Motion => ({ ay, ax: 0.03, f, ph });

/** Streaks of lamplight on the water that shake gently after dark. */
const reflect = (x: number, z: number, c = "#ffe2a0"): Prop[] => [
  box(x, 0.04, z, 0.28, 0.01, 2.4, c, { night: true, glow: true, m: { ax: 0.1, f: 0.8, ph: x } }), box(x + 0.3, 0.04, z + 0.4, 0.16, 0.01, 1.6, c, { night: true, glow: true, hi: true, m: { ax: 0.12, f: 0.6, ph: x + 2 } })
];
const foam = (z: number, n: number): Prop[] => Array.from({ length: n }, (_, i) => box(-15 + i * (30 / n), 0.04, z, 3.4, 0.015, 0.2, "#f4f8f8", { m: { az: 0.3, f: 0.22, ph: i * 1.4 } }));
const stand = (x: number, z: number, c: string, goods: string): Prop[] => [
  ...table(x, z, 2, 0.8), cyl(x + 0.8, 0, z - 0.3, 0.07, 2.3, "#f4f4ee"), cyl(x + 0.8, 2.2, z - 0.3, 3, 0.35, c, { w2: 0.3 }),
  box(x - 0.4, 0.8, z, 0.5, 0.25, 0.4, goods), ball(x + 0.2, 0.8, z, 0.4, goods, { sy: 0.7 })
];
const HULLS = [["#2e6f8f", "#f2c14e"], ["#b5483a", "#f4ecd8"], ["#2f8f5b", "#f4ecd8"], ["#d9822b", "#f4ecd8"], ["#7a4aa0", "#f2c14e"], ["#26336b", "#f4ecd8"]] as const;
const lamps = [{ x: 1.2, y: 3, z: 0.8, c: "#ffd9a0" }, { x: -2.5, y: 3, z: 2, c: "#ffd9a0" }];

function beach(name: string, r: () => number): Layout {
  const [h1, s1] = pick(r, HULLS), [h2, s2] = pick(r, HULLS), [h3, s3] = pick(r, HULLS), [h4, s4] = pick(r, HULLS), tower = pick(r, [7.8, 7.8, 10.6]), left = r() < 0.5;
  const out: Prop[] = [
    ...skyline(31, ["#7a8a8f", "#8c9aa0"], 70, 22, 6), ...palm(-15, 6.8, 7.5), ...palm(15.5, 6.5, 7),
    ...gantry(-5.2, 3.7, 5.6, 1.1, 3.6, name, "#0f5f7a", "#f7f1dc", "#6b4a2b"),
    box(0, 0.02, 6.6, 200, 0.01, 2.2, "#c9ae78"), ...foam(7.5, 8),
    // Fishing boats drawn up on the sand and one at sea.
    ...boat(-9 + r() * 1.5, 5.3, 4, h1, s1), ...(tower < 9 ? boat(7.0, 5.6, 3.6, h2, s2) : boat(-5.5, 5.6, 3.6, h2, s2)), ...(r() < 0.65 ? boat(11.8, 6.0, 3.2, h3, s3) : []),
    ...boat(3.4 + r() * 2, 10.5, 4, h4, s4, bob(0.5), 0.0), ...(r() < 0.7 ? boat(-11, 13, 3.6, h1, s1, bob(2.1), 0.0) : []),
    // The lifeguard tower with its flag.
    ...[-0.7, 0.7].flatMap(dx => [-0.5, 0.5].map(dz => cyl(tower + dx, 0, 4.4 + dz, 0.14, 1.6, "#6b4a2b"))), box(tower, 1.6, 4.4, 2.2, 1.5, 1.6, "#f4ecd8"), box(tower, 3.1, 4.4, 2.7, 0.12, 2.1, "#b5483a"),
    box(tower, 2.1, 3.59, 1.2, 0.6, 0.03, "#27414f"), cyl(tower + 1.4, 0, 4.4, 0.07, 4.2, "#e8e2cf"), box(tower + 1.85, 3.6, 4.4, 0.9, 0.5, 0.03, "#d63a2e", { m: { ax: 0.05, f: 0.8 } }),
    // Food stands, and a net drying on a rack.
    ...stand(left ? -11 : -8.5, 4.6, pick(r, ["#f2c14e", "#d9822b", "#f4f4ee"]), "#c0392b"), ...(tower < 9 ? stand(11.8, 4.2, pick(r, ["#2e6f8f", "#2f8f5b"]), "#e0b23a") : stand(7.4, 4.2, "#2e6f8f", "#e0b23a")),
    ...(r() < 0.6 ? [cyl(-12.5, 0, 6.0, 0.1, 2.2, "#6b4a2b"), cyl(-9.6, 0, 6.0, 0.1, 2.2, "#6b4a2b"), box(-11, 0.9, 6.0, 2.9, 1.3, 0.03, "#6b7a5a", { hi: true, m: { ax: 0.03, f: 0.3 } })] : []),
    ...lampPost(-4.6, 3.7), ...lampPost(5.8, 3.4), ...reflect(-5, 9), ...reflect(6, 10)
  ];
  return {
    ground: "#e0c88f", water: { z: 7.7, c: "#2f7fa0" }, props: out,
    people: [stroller(-8, 3.5, 81, -13, 13, 0.6), standing(7.4, 3.5, PI, 82), standing(-8, 4.6, PI * 0.8, 83), stroller(5, 3.6, 84, -13, 13, -0.5), standing(12.6, 5.2, -PI * 0.7, 85), standing(-12.4, 5.2, PI, 86), standing(9.5, 5.3, PI * 0.5, 87), standing(-6.2, 6.5, 0.4, 88) ],
    lamps
  };
}

function fishingJetty(name: string, r: () => number): Layout {
  const [h1, s1] = pick(r, HULLS), [h2, s2] = pick(r, HULLS), [h3, s3] = pick(r, HULLS), [h4, s4] = pick(r, HULLS), crateN = 2 + Math.floor(r() * 3);
  const out: Prop[] = [
    ...skyline(32, ["#7a8a8f", "#8c9aa0"], 70, 22, 6), ...palm(-15, 5, 7), ...gantry(0, 3.8, 6, 1.1, 3.7, name, pick(r, ["#5a3a22", "#14394f", "#3a4a2a"]), "#f7f1dc"),
    // The landing: planks on pilings over the water, with the boats knocking alongside.
    box(0, 0, 7.4, 42, 0.55, 2.8, "#8a6a3a"), box(0, 0.55, 6.1, 42, 0.03, 0.12, "#6e5230"), ...Array.from({ length: 15 }, (_, i) => cyl(-14 + i * 2, 0, 5.95, 0.3, 1.0, "#4a3a2a")),
    ...boat(-9 + r() * 2, 10, 4.2, h1, s1, bob(0.2)), ...boat(5 + r(), 10.2, 3.8, h2, s2, bob(1.4)), ...(r() < 0.75 ? boat(11.5, 10.4, 3.4, h3, s3, bob(2.6)) : []), ...(r() < 0.6 ? boat(-13, 14.5, 3.6, h4, s4, bob(3.3)) : []),
    // Catch and gear on the landing: crates of fish, heaped nets, a ticket hut.
    ...Array.from({ length: crateN }, (_, i) => box(-8 + i * 0.75, 0.55, 7.2, 0.68, 0.35, 0.5, i % 2 ? "#8a6a3a" : "#6e5230")), ...Array.from({ length: crateN }, (_, i) => ball(-7.9 + i * 0.75, 0.9, 7.2, 0.4, "#c9d3d8", { sy: 0.5 })),
    ...(r() < 0.8 ? [ball(-12, 0.55, 7.4, 1.8, "#6b7a5a", { sy: 0.5 }), ball(-10.6, 0.55, 7.8, 1.3, "#566a4a", { sy: 0.5 })] : []), ball(6.2 + r(), 0.55, 7.4, 1.6, "#6b7a5a", { sy: 0.5 }),
    box(10.2, 0.55, 7, 2.4, 2.2, 1.8, pick(r, ["#2f6b8f", "#2f6b4a", "#8a6a3a"])), box(10.2, 2.75, 7, 2.8, 0.16, 2.2, "#3a3d40"), sign(10.2, 1.9, 6.08, 1.8, 0.5, "TICKETS", "#f2b705", "#15191c"),
    cyl(-4.5, 0.55, 6.4, 0.1, 2.6, "#3a3d40"), cyl(4.4, 0.55, 6.4, 0.1, 2.6, "#3a3d40"),
    ...lampPost(-4.5, 6.3, 3.4), ...lampPost(4.4, 6.3, 3.4), ...reflect(-4.5, 10.5), ...reflect(4.4, 11), ...reflect(-9.5, 12),
    ...lampPost(-4.6, 3.6)
  ];
  return {
    ground: "#9b8a64", water: { z: 6.5, c: "#3b6f78" }, props: out,
    people: [stroller(-8, 3.5, 91, -13, 13, 0.5), standing(-8.4, 4.4, PI, 92), standing(9, 4.4, PI * 0.9, 93), stroller(5, 3.6, 94, -13, 13, -0.5), standing(-11, 4.4, PI * 0.8, 95), standing(12.6, 4.6, -PI * 0.7, 96), standing(-6, 4.6, PI * 1.1, 97), standing(7, 4.5, PI, 98) ],
    lamps
  };
}

function passengerJetty(name: string, r: () => number): Layout {
  const launchLen = 7 + Math.floor(r() * 4), launchX = pick(r, [6.5, 7, 7.8]), launchHull = pick(r, ["#f4ecd8", "#e8e2cf", "#d9e4ea"]), cabin = pick(r, ["#2e6f8f", "#2f8f5b", "#b5483a"]);
  const hull = (x: number, z: number, len: number, c: string, ph: number): Prop[] => {
    const m = bob(ph, 0.04, 0.28);
    return [box(x, 0, z, len, 1.1, 2.4, c, { m }), box(x, 0.75, z - 1.21, len, 0.14, 0.04, cabin, { m }), box(x, 1.1, z, len * 0.66, 1.3, 2.2, "#e8e2cf", { m }), box(x, 1.7, z - 1.11, len * 0.6, 0.55, 0.03, "#27414f", { m }),
      box(x, 2.55, z, len * 0.72, 0.1, 2.7, "#f2f2ee", { m }), ...[-1, 1].map(s => box(x + s * len * 0.34, 2.4, z - 1.2, 0.08, 0.2, 0.08, "#5a5f64", { m }))];
  };
  const out: Prop[] = [
    ...skyline(33, ["#7a8a8f", "#8c9aa0"], 70, 22, 6), ...(r() < 0.6 ? palm(14.5, 4.6, 7.5) : []), ...gantry(-4, 3.8, 6.4, 1.1, 3.7, name, pick(r, ["#1f4a7a", "#176b4d", "#5a2a22"]), "#fff8e6", "#3a3d40"),
    // The pier and its steps, a covered passenger launch alongside and a smaller boat.
    box(0, 0, 7.6, 34, 0.5, 2.2, "#8a6a3a"), ...Array.from({ length: 12 }, (_, i) => cyl(-13 + i * 2.4, 0, 6.5, 0.3, 0.9, "#4a3a2a")),
    ...hull(launchX, 11.2, launchLen, launchHull, 0.4), ...(r() < 0.7 ? (([h, st]) => boat(-11, 10.2, 3.6, h, st, bob(2)))(pick(r, HULLS)) : []),
    // The ticket table under an umbrella with the route board, and luggage waiting on the pier.
    ...table(-8, 4.5, 2.2, 0.8), cyl(-7.2, 0, 4.2, 0.07, 2.3, "#f4f4ee"), cyl(-7.2, 2.2, 4.2, 3.2, 0.35, pick(r, ["#f2b705", "#d9822b", "#f4f4ee"]), { w2: 0.3 }), sign(-8, 0.82, 4.1, 1.2, 0.5, "TICKETS", "#15191c", "#f2b705"),
    sign(-12.6, 1.6, 4.2, 2.6, 1.3, pick(r, ["ROUTES\nISLAND - MARKET", "ROUTES\nCREEK - TOWN", "ROUTES\nNORTH BANK - CITY"]), "#176b4d", "#fff8e6"), cyl(-13.7, 0, 4.2, 0.1, 1.6, "#3a3d40"), cyl(-11.5, 0, 4.2, 0.1, 1.6, "#3a3d40"),
    ...[[-1.2, "#2e6f8f"], [-0.5, "#b5483a"], [0.2, "#7a4aa0"]].slice(0, 1 + Math.floor(r() * 3)).map(([dx, c]) => box(9.2 + (dx as number), 0.5, 7.0, 0.55, 0.42, 0.3, c as string)), ball(11, 0.5, 7.2, 0.7, "#c9b48a", { sy: 0.8 }),
    ...lampPost(-4.8, 6.4, 3.4), ...lampPost(3.6, 6.4, 3.4), ...reflect(-4.8, 10), ...reflect(3.6, 10.6), ...lampPost(5.8, 3.4)
  ];
  return {
    ground: "#b59a6a", water: { z: 6.5, c: "#2f7a96" }, props: out,
    people: [standing(-9.5, 4.1, PI, 101), stroller(-8, 3.5, 102, -13, 13, 0.5), standing(8, 4.6, PI * 0.9, 103), standing(10.2, 4.4, PI, 104), stroller(5, 3.6, 105, -13, 13, -0.5), standing(-6.4, 4.5, PI * 0.8, 106), standing(12.2, 4.8, -PI * 0.7, 107), standing(-11.2, 4.6, PI, 108) ],
    lamps
  };
}

function waterfront(name: string, r: () => number): Layout {
  const fish = 2 + Math.floor(r() * 3), [b1h, b1s] = pick(r, HULLS), [b2h, b2s] = pick(r, HULLS), [b3h, b3s] = pick(r, HULLS), [b4h, b4s] = pick(r, HULLS), door = pick(r, ["#3a3d40", "#2f5f4a", "#5a2a22"]);
  const out: Prop[] = [
    ...skyline(34, ["#7a8a8f", "#8c8579", "#a8a091"], 60, 22, 8), ...palm(-15, 5.5, 7), ...palm(16, 5.2, 7.5),
    box(0, 0.02, 6.0, 200, 0.01, 1.1, "#6e5a3c"),
    // Boats pulled up on the mud and floating off the landing.
    ...boat(-11 + r(), 7.4, 4.2, b1h, b1s, bob(0.7, 0.03)), ...(r() < 0.8 ? boat(-6.5, 7.8, 3.6, b2h, b2s, bob(1.9, 0.03)) : []), ...boat(5.6 + r(), 7.6, 3.8, b3h, b3s, bob(2.8, 0.03)), ...(r() < 0.7 ? boat(10.4, 7.4, 3.2, b4h, b4s, bob(3.7, 0.03)) : []),
    ...boat(2 + r() * 2, 12.5, 4.2, b2h, b2s, bob(1.1, 0.06), 0.0), ...(r() < 0.6 ? boat(-14, 14.5, 3.6, b1h, b1s, bob(4.2, 0.06), 0.0) : []),
    ...Array.from({ length: 8 }, (_, i) => cyl(-13 + i * 3.8, 0, 6.2, 0.22, 1.0 + (i % 3) * 0.15, "#4a3a2a")),
    // Fish sellers' baskets, a food stall and a warehouse with the name over its door.
    ...Array.from({ length: fish }, (_, i) => i).flatMap(i => [cyl(-8.8 + i * 0.9, 0, 4.7, 0.7, 0.35, "#b0803f", { w2: 0.78 }), ball(-8.8 + i * 0.9, 0.3, 4.7, 0.5, "#c9d3d8", { sy: 0.5 })]), ...[0, 1, 2].flatMap(i => [cyl(7 + i * 0.9, 0, 4.5, 0.7, 0.35, "#b0803f", { w2: 0.78 }), ball(7 + i * 0.9, 0.3, 4.5, 0.5, "#e8e2cf", { sy: 0.5 })]),
    ...awning(-13, 4.8, 3, 2.6, 2.5, pick(r, ["#2f8f5b", "#d9822b", "#7a4aa0"]), "#f4ecd8", 6), ...table(-13, 4.8, 2.4, 1),
    box(13, 0, 12, 9, 4, 5, "#8a8f94"), box(13, 4, 12, 9.6, 0.2, 5.6, "#6b7075"), box(13, 0, 9.46, 3, 2.8, 0.06, door), sign(13, 2.9, 9.44, 6.6, 1.0, name, pick(r, ["#14394f", "#2f4a2a", "#5a2a22"]), "#f7f1dc"),
    ...crates(9.4, 8.4, 3, 2), ...crates(14.8, 8.2, 3, 2),
    ...lampPost(-4.6, 3.7), ...lampPost(6.4, 3.4), ...reflect(-4.6, 9), ...reflect(6.4, 9.6), ...reflect(-11, 11)
  ];
  return {
    ground: "#8a6e4b", water: { z: 6.6, c: "#4f6a5a" }, props: out,
    people: [stroller(-8, 3.5, 111, -13, 13, 0.6), standing(-7.6, 4.2, PI, 112), standing(8.2, 4.1, PI, 113), stroller(5, 3.6, 114, -13, 13, -0.55), standing(-12, 4.4, PI * 0.6, 115), standing(11, 4.2, PI, 116), standing(-9.6, 6.2, PI * 0.5, 117), standing(6.8, 6.2, -PI * 0.5, 118) ],
    lamps
  };
}

function seaport(name: string, r: () => number): Layout {
  const hullC = pick(r, ["#7a2e2a", "#14394f", "#2a3a2a", "#3a3a42"]), boxes = ["#2e6f8f", "#d9822b", "#2f8f5b", "#b5483a", "#7a4aa0"], rowN = 4 + Math.floor(r() * 3), hang = pick(r, boxes), shedC = pick(r, ["#b9b4a6", "#c9c2a8", "#a9b4b9"]);
  const deck = (x: number, y: number, c: string): Prop => box(x, y, 17.4, 6, 2.5, 2.4, c);
  const stack = (x: number, z: number, cols: readonly string[]): Prop[] => cols.flatMap((c, row) => [box(x, row * 2.6, z, 6, 2.5, 2.4, c), box(x + 6.3, row * 2.6, z, 6, 2.5, 2.4, cols[(row + 1) % cols.length]!)]);
  const sway: Motion = { ax: 3.2, f: 0.06, ph: r() * 6 };
  const out: Prop[] = [
    ...skyline(35, ["#7a8a8f", "#8c9aa0"], 75, 22, 7),
    box(0, 0.02, 10.6, 200, 0.12, 0.6, "#6b7075"), box(0, 0.02, 10.1, 200, 0.012, 0.16, "#f2c14e"), ...[-14, -5, 4, 13].map(x => cyl(x, 0, 10.2, 0.5, 0.45, "#2b2e31")),
    // A ship at the quay to the right: a red hull, a white bridge and funnel, and deck cargo. The water to its left is the witness's backdrop.
    box(21, 0, 17.6, 46, 4.6, 8, hullC), box(21, 3.9, 13.62, 46, 0.2, 0.05, "#e8e2cf"), box(21, 4.6, 17.6, 46, 0.25, 8.2, "#4a4e52"),
    box(4, 4.85, 18.4, 8, 4.4, 6, "#f4f4f0"), box(4, 7.2, 15.38, 7.4, 0.8, 0.03, "#27414f"), box(4, 9.25, 18.4, 8.6, 0.25, 6.4, "#6b7075"), cyl(8.2, 9.2, 18.4, 2.2, 2.6, "#2e6f8f", { w2: 1.8 }),
    ...Array.from({ length: rowN }, (_, i) => deck(11 + i * 6.4, 4.85, pick(r, boxes))), deck(14.2, 7.35, pick(r, boxes)), ...(rowN > 4 ? [deck(27, 7.35, pick(r, boxes))] : []),
    // A portal crane with a container swaying on its trolley.
    ...[2.5, 12.5].flatMap(x => [7.2, 11.6].map(z => box(x, 0, z, 0.7, 8.2, 0.7, "#d9822b"))), ...[7.2, 11.6].map(z => box(7.5, 7.8, z, 11, 0.9, 0.8, "#d9822b")), box(7.5, 8.7, 9.4, 11.4, 0.3, 5.2, "#b86a1c"),
    box(7.5, 5.7, 9.4, 1.2, 0.5, 1.4, "#3a3d40", { m: sway }), box(7.5, 3.4, 9.4, 6, 2.3, 2.4, hang, { m: sway }), box(6.6, 5.7, 9.4, 0.06, 0.3, 0.06, "#3a3d40", { m: sway }), box(8.4, 5.7, 9.4, 0.06, 0.3, 0.06, "#3a3d40", { m: sway }),
    // Container stacks, a customs shed and a lorry waiting on the quay.
    ...stack(-16, 6.6, [pick(r, boxes), pick(r, boxes)]), box(-7, 0, 6.6, 8, 3.2, 4.2, shedC), box(-7, 3.2, 6.6, 8.6, 0.2, 4.8, "#6b7075"), sign(-7, 3.4, 4.48, 6.4, 1.0, name, pick(r, ["#14394f", "#2f4a2a", "#5a2a22"]), "#f7f1dc"), box(-7, 0, 4.47, 1.6, 2.2, 0.05, "#3a3d40"),
    box(14.5, 0.6, 5.4, 6.2, 2.5, 2.4, "#6e5230"), box(19.3, 0.6, 5.4, 2.4, 2.5, 2.4, "#2e6f8f"), ...[13, 15.6, 19.6].map(x => cylz(x, 0, 4.2, 1.0, 0.3, "#15191c")),
    ...floodlight(-12, 4.8, 10), ...floodlight(2, 9.4, 10), ...floodlight(21, 8, 11), ...reflect(-3, 12.5, "#fff7dc"), ...reflect(-9, 13, "#fff7dc")
  ];
  return {
    ground: "#8e9094", water: { z: 10.9, c: "#1f4a6a" }, props: out,
    people: [stroller(-8, 3.5, 121, -13, 13, 0.6), standing(-9.6, 4.2, PI, 122), standing(-3.8, 4.6, PI * 1.2, 123), standing(8.6, 4.2, PI, 124), stroller(6, 3.6, 125, -13, 13, -0.55), standing(11.8, 3.9, PI * 0.8, 126), standing(-12.6, 4.4, PI * 0.7, 127), standing(5.6, 6.8, -PI * 0.3, 128)],
    lamps
  };
}

/** The layout for a water's-edge variant; an unknown variant shows the waterfront. */
export function waterLayout(variant: string, venueName: string, seed = 0): Layout {
  const name = nameOf(venueName || variant.replace(/_/g, " ")), r = rng(seed);
  const build = variant === "beach" ? beach : variant === "fishing_jetty" ? fishingJetty : variant === "jetty" ? passengerJetty : variant === "seaport" ? seaport : waterfront;
  return variate(build(name, r), seed);
}
