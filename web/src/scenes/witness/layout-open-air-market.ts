// Where things stand at the open-air markets and festivals that share one scenery set: the cattle market, the craft market and the festival
// ground (set id `market_variants`). Pure data, read by both renderers (chase3d-open-air-kit.ts, witness-2d-open-air-kit.ts). The witness stands at
// (1.15, 2.55) and the cone behind her is kept to plain, large shapes so her face reads; see docs/agents/Agent1.md.
import { type Layout, type Prop, awning, ball, box, crates, cyl, fenceX, fenceZ, floodlight, gantry, lampPost, nameOf, palm, pick, rng, skyline, standing, stroller, table, tree, variate } from "./layout-open-air-kit.ts";

const PI = Math.PI;

/** A zebu cow standing along x, nodding its head. */
const cow = (x: number, z: number, dir: 1 | -1, hide: string, patch: string, ph: number, hi = false): Prop[] => [
  box(x, 0.55, z, 1.7, 0.72, 0.62, hide, { hi }), ball(x + dir * 0.55, 1.1, z, 0.55, hide, { sy: 0.8, hi }),
  box(x + dir * 1.1, 0.82, z, 0.52, 0.4, 0.34, hide, { m: { ay: 0.04, f: 0.35, ph }, hi }), box(x + dir * 1.12, 1.22, z - 0.14, 0.05, 0.28, 0.05, "#e8e0cc", { hi }),
  box(x + dir * 1.12, 1.22, z + 0.14, 0.05, 0.28, 0.05, "#e8e0cc", { hi }),
  box(x + 0.62, 0, z - 0.2, 0.14, 0.56, 0.14, hide, { hi }), box(x - 0.62, 0, z - 0.2, 0.14, 0.56, 0.14, hide, { hi }), box(x + 0.62, 0, z + 0.2, 0.14, 0.56, 0.14, hide, { hi }), box(x - 0.62, 0, z + 0.2, 0.14, 0.56, 0.14, hide, { hi }),
  box(x - dir * 0.9, 0.35, z, 0.05, 0.75, 0.05, hide), box(x - 0.1, 0.72, z - 0.32, 0.8, 0.4, 0.02, patch, { hi })
];

const stripes = (x: number, y: number, z: number, w: number, h: number, cols: readonly string[]): Prop[] =>
  cols.map((c, i) => box(x - w / 2 + ((i + 0.5) * w) / cols.length, y, z, w / cols.length + 0.01, h, 0.05, c));

const HIDES = [["#e8e0cc", "#8a5a3c"], ["#8a5a3c", "#e8e0cc"], ["#2b2420", "#6e5a48"], ["#c9a36a", "#e8e0cc"], ["#a0522d", "#e8e0cc"], ["#6e5a48", "#c9a36a"]] as const;
const LEFT_COWS = [[-9.6, 6.2, 1], [-7.4, 8.2, -1], [-10.4, 8.6, 1], [-7.2, 5.9, 1]] as const;
const RIGHT_COWS = [[8.2, 6.4, -1], [10.4, 8.2, 1], [7.6, 8.8, 1], [10.6, 5.8, -1]] as const;

function cattle(name: string, r: () => number): Layout {
  const herd = (slots: readonly (readonly [number, number, 1 | -1])[]) => slots.slice(0, 2 + Math.floor(r() * 3)).flatMap(([x, z, dir], i) => { const [hide, patch] = pick(r, HIDES); return cow(x, z, dir, hide, patch, i * 1.7 + r() * 2, i > 1); });
  // The truck backs up at the right or the left, and the front store (sacks and hay, or a trough) swaps sides.
  const m = r() < 0.5 ? -1 : 1, tx = 11 * m, swap = r() < 0.5, sackX = swap ? 6.8 : -5.2, hayX = swap ? 7.6 : -4.8, troughX = swap ? -5.2 : 5.3;
  const out: Prop[] = [
    ...skyline(11, ["#a89a7c", "#9c8f74", "#b3a58a"], 42, 26, 8),
    ...tree(-14, 14, 6.5, "#5c7a3a", 0.5), ...tree(15, 15, 7, "#5c7a3a", 0.5),
    ...gantry(0, 0.9, 9, 1.15, 4.7, name, pick(r, ["#4a2f18", "#3a4a2a", "#5a2a22"]), "#f3e6c4"),
    // Two pens, left and right, with the middle left open.
    ...fenceX(-12.2, -5.6, 4.8), ...fenceX(-12.2, -5.6, 9.8), ...fenceZ(-12.2, 4.8, 9.8), ...fenceZ(-5.6, 4.8, 9.8),
    ...fenceX(5.6, 12.2, 4.8), ...fenceX(5.6, 12.2, 9.8), ...fenceZ(5.6, 4.8, 9.8), ...fenceZ(12.2, 4.8, 9.8),
    ...herd(LEFT_COWS), ...herd(RIGHT_COWS),
    // A feed shed at the back whose dark wall is the witness's backdrop.
    box(-1, 0, 14.4, 15, 3.3, 0.3, "#5b4a3a"), box(-1, 3.2, 12.4, 15.6, 0.16, 4.6, "#8d9296"),
    ...[-8, 6].flatMap(x => [11, 14].map(z => cyl(x, 0, z, 0.2, 3.2, "#4a3a2a"))),
    ...crates(3.4, 13.5, 4, 2), ...[0, 1, 2, 3].map(i => ball(5.5 + i * 0.8, 0, 12.4, 0.8, "#c9b48a", { sy: 0.7 })),
    // A livestock truck backed up to a ramp.
    box(tx, 0.7, 13, 5, 0.3, 2.3, "#6e5230"), box(tx, 1.0, 12.1, 5, 1.4, 0.1, "#8a6a3a"), box(tx, 1.0, 13.9, 5, 1.4, 0.1, "#8a6a3a"), box(tx - 2.7 * m, 0.7, 13, 1.7, 1.6, 2.2, "#2e6f8f"),
    ...[-1.8, 1.8].map(wx => cyl(tx + wx, 0, 11.8, 0.9, 0.4, "#15191c")),
    // Feed sacks, hay and a trough at the front.
    ...[0, 1, 2].map(i => ball(sackX + i * 0.7, 0, 4.3, 0.8, "#c9b48a", { sy: 0.7 })), box(hayX, 0, 3.8, 1.4, 0.7, 0.8, "#d4b04a"), box(hayX + 1, 0, 3.8, 1.4, 0.7, 0.8, "#c9a23c"),
    box(troughX, 0.3, 4.2, 2.2, 0.35, 0.6, "#6e5230"),
    ...lampPost(-4.6, 3.6), ...lampPost(5.8, 3.6)
  ];
  return {
    ground: "#b08a5c", props: out,
    people: [stroller(-9, 3.6, 21, -13, 13, 0.7), standing(-7.6, 3.9, PI, 22), standing(7.2, 3.7, PI, 23), stroller(5, 3.7, 24, -13, 13, -0.6), standing(-6.2, 7.5, PI * 0.5, 25), standing(6, 7.4, -PI * 0.5, 26), standing(-10.2, 5.6, 0.3, 27), standing(12.2, 6, -0.3, 28)],
    lamps: [{ x: 1.2, y: 3, z: 0.8, c: "#ffd9a0" }, { x: -2.5, y: 3, z: 2, c: "#ffd9a0" }]
  };
}

/** A market stall: a table under a striped awning with its wares. */
const stall = (x: number, z: number, w: number, c1: string, c2: string, wares: Prop[]): Prop[] => [...table(x, z, w, 1), ...awning(x, z + 0.1, w + 0.4, 2.2, 2.5, c1, c2), ...wares];
const bolts = (x: number, z: number, w: number, cols: readonly string[]): Prop[] => cols.map((c, i) => cyl(x - w / 2 + 0.3 + (i * (w - 0.6)) / (cols.length - 1), 0.8, z, 0.28, 0.55, c));
const loom = (x: number, z: number): Prop[] => [
  ...[-0.7, 0.7].flatMap(dx => [-0.4, 0.4].map(dz => box(x + dx, 0, z + dz, 0.1, 1.9, 0.1, "#6b4a2b"))), box(x, 1.8, z - 0.4, 1.5, 0.1, 0.1, "#6b4a2b"), box(x, 0.4, z - 0.4, 1.5, 0.1, 0.1, "#6b4a2b"),
  box(x, 0.5, z - 0.43, 1.3, 1.2, 0.02, "#e9ddc0"), box(x, 0.5, z - 0.45, 1.3, 0.4, 0.03, "#b5483a"), box(x, 0.9, z - 0.45, 1.3, 0.08, 0.03, "#2e6f8f")
];

/** What each craft stall sells, built around its own x so any stall can hold any ware. */
const WARES: readonly ((x: number, hung: readonly string[]) => Prop[])[] = [
  (x, hung) => [...bolts(x, 5.0, 2.6, hung), ...hung.slice(0, 3).map((c, i) => box(x - 0.8 + i * 0.8, 1.0, 5.85, 0.7, 1.4, 0.03, c))],
  x => [...[0, 1, 2, 3].map(i => cyl(x - 0.9 + i * 0.6, 0.8, 5.0, 0.4, 0.38, "#6b4a2b", { w2: 0.28 })), ...[0, 1].map(i => box(x - 0.6 + i * 1.0, 0.8, 5.4, 0.5, 0.2, 0.35, "#4a2f18"))],
  x => [...[0, 1, 2, 3].map(i => cyl(x - 0.9 + i * 0.6, 0.8, 5.0, 0.38, 0.32, "#b0803f", { w2: 0.2 })), ball(x + 1.3, 0.8, 5.2, 0.4, "#c99b4f")],
  x => [...[0, 1, 2].map(i => box(x - 0.8 + i * 0.7, 0.8, 5.0, 0.5, 0.35, 0.3, ["#8a5a2f", "#5a3a28", "#a06a45"][i]!)), box(x + 0.6, 1.0, 5.85, 1.4, 1.2, 0.03, "#8a5a2f")]
];
const AWNINGS = [["#26336b", "#f4ecd8"], ["#7a4a2a", "#e8d9b0"], ["#b0803f", "#f4ecd8"], ["#5a3a28", "#d9822b"], ["#2f6b4a", "#f4ecd8"]] as const;

function craft(name: string, r: () => number): Layout {
  const hung = ["#26336b", "#d9822b", "#2f8f5b", "#b5483a", "#7a4aa0"];
  const turn = Math.floor(r() * hung.length), cloths = hung.map((_, i) => hung[(i + turn) % hung.length]!);
  const kinds = [0, 1, 2, 3];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!]; }
  const front = [-10, -6.6, 5.6, 9].map((x, i) => { const [c1, c2] = pick(r, AWNINGS); return stall(x, 5.2, 2.6, c1, c2, WARES[kinds[i]!]!(x, cloths)); });
  // Either dye vats with cloth swaying on a line, or a second row of stalls.
  const dyeing = r() < 0.65, loomRow = r() < 0.5 ? [[-11.5, 9], [-8.5, 9.4]] : [[-12, 7.8], [-9, 10]];
  const back: Prop[] = dyeing
    ? [...[0, 1, 2].map(i => cyl(7 + i * 1.2, 0, 8.4, 0.9, 0.6, ["#26336b", "#b5483a", "#2f6b3a"][i]!)), cyl(5.2, 0, 10.6, 0.14, 2.8, "#5a3d22"), cyl(12.8, 0, 10.6, 0.14, 2.8, "#5a3d22"), box(9, 2.7, 10.6, 7.8, 0.05, 0.05, "#3a3a3a"),
      ...cloths.map((c, i) => box(5.9 + i * 1.5, 1.2, 10.6, 0.9, 1.5, 0.03, c, { m: { ax: 0.06, f: 0.4, ph: i * 1.3 } }))]
    : [...stall(8, 9.4, 2.6, "#2f6b4a", "#f4ecd8", WARES[kinds[0]!]!(8, cloths).map(p => ({ ...p, z: p.z + 4.4 }))), ...stall(11.8, 9.4, 2.6, "#7a4a2a", "#e8d9b0", WARES[kinds[1]!]!(11.8, cloths).map(p => ({ ...p, z: p.z + 4.4 })))];
  const out: Prop[] = [
    ...skyline(12, undefined, 42), ...palm(-14, 14, 7), ...palm(15, 15, 7.5),
    ...gantry(0, 0.9, 9, 1.15, 4.7, name, pick(r, ["#26336b", "#4a2a5a", "#1f5a4a"]), "#f4ecd8"),
    // The witness's backdrop: a plain adobe wall with a few cloths hung out to dry.
    box(-2, 0, 13.5, 16, 3.2, 0.3, pick(r, ["#c9b68f", "#d9c9a4", "#b9a37a"])), box(-2, 3.2, 13.5, 16.4, 0.18, 0.5, "#8a5a3c"),
    ...[-7.5, -5.2, -2.9, -0.6].map((x, i) => box(x, 0.8, 13.3, 1.4, 2.0, 0.04, cloths[i % 5]!, { hi: i > 1 })),
    ...front.flat(), ...loomRow.flatMap(([x, z]) => loom(x!, z!)), ...back,
    ...lampPost(-4.6, 3.6), ...lampPost(5.8, 3.6)
  ];
  return {
    ground: "#a8663f", props: out,
    people: [standing(loomRow[0]![0]!, loomRow[0]![1]! - 1.1, 0, 31), stroller(-6, 3.7, 32, -13, 13, 0.6), standing(-8.7, 3.9, PI, 33), standing(6.3, 3.9, PI, 34), stroller(7, 3.6, 35, -13, 13, -0.55), standing(8, 7.2, PI * 0.5, 36), standing(-5.2, 3.8, PI, 37), standing(10.4, 3.8, -PI * 0.6, 38)],
    lamps: [{ x: 1.2, y: 3, z: 0.8, c: "#ffd9a0" }, { x: -2.5, y: 3, z: 2, c: "#ffd9a0" }]
  };
}

function festival(name: string, r: () => number): Layout {
  const base = ["#d9822b", "#2f8f5b", "#f2c14e", "#b5483a", "#2e6f8f", "#7a4aa0"], turn = Math.floor(r() * 6), flags = base.map((_, i) => base[(i + turn) % 6]!);
  // The shade pavilion stands left or right, and a second line of bunting is strung across about half the time.
  const pav = r() < 0.5 ? -12.4 : 12.4, second = r() < 0.5;
  const out: Prop[] = [
    ...skyline(13, undefined, 44), ...palm(-15, 12, 7.5), ...palm(16, 13, 7),
    // The stage: a platform, a roof on posts, a banner with the name, speaker stacks, drums and lamps.
    box(-1, 0, 15, 13, 1.0, 5, "#5b4a3a"), ...stripes(-1, 0.2, 12.45, 13, 0.6, ["#b5483a", "#f2c14e", "#2f8f5b", "#2e6f8f"]),
    box(-1, 1, 17.4, 13, 4.2, 0.2, "#4a2030"),
    ...[-7.4, 5.4].flatMap(x => [12.6, 17].map(z => cyl(x, 0, z, 0.3, 5.6, "#3a3d40"))), box(-1, 5.6, 14.8, 13.4, 0.35, 5, "#2d3033"), box(-1, 5.9, 14.8, 13.8, 0.1, 5.4, "#b5483a"),
    ...[-6, -3.5, -1, 1.5, 4].map(x => box(x, 5.35, 12.7, 0.5, 0.25, 0.3, "#fff1c4", { glow: true })),
    ...gantry(-1, 12.3, 8.6, 1.4, 5.5, name, pick(r, ["#176b4d", "#4a2030", "#14394f"]), "#f6f1e1", "#3a3d40").slice(2),
    ...[-7.2, 5.2].map(x => box(x, 1.0, 13.5, 1.2, 2.4, 1.0, "#1a1c1e")), ...[-7.2, 5.2].map(x => cyl(x, 1.4, 12.95, 0.7, 0.2, "#35383b")),
    ...[2.2, 3.1, 4.0].map((x, i) => cyl(x, 1.0, 13.4, 0.55, 0.95 - i * 0.08, "#8a5a2f", { w2: 0.38 })), ...[2.2, 3.1, 4.0].map((x, i) => cyl(x, 1.95 - i * 0.08, 13.4, 0.5, 0.05, "#e8dcb8")),
    ...floodlight(-9.5, 12, 7), ...floodlight(7.6, 12, 7),
    // Bunting across the ground, gently moving.
    cyl(-10.5, 0, 6.8, 0.14, 4, "#5a3d22"), cyl(10.5, 0, 6.8, 0.14, 4, "#5a3d22"), box(0, 3.95, 6.8, 21, 0.03, 0.03, "#444444"),
    ...Array.from({ length: 14 }, (_, i) => box(-9.8 + i * 1.5, 3.55, 6.8, 0.38, 0.4, 0.03, flags[i % 6]!, i % 3 === 0 ? { m: { ax: 0.05, f: 0.7, ph: i } } : {})),
    // Food stalls with a grill glowing after dark, and a shade pavilion.
    ...[-9.5, 8.8].filter(() => r() < 0.85).flatMap((x, i) => [...table(x, 5.2, 2.4, 1), ...awning(x, 5.3, 2.8, 2.2, 2.5, flags[i * 2]!, "#f4ecd8"), box(x - 0.6, 0.86, 5.2, 0.7, 0.2, 0.5, "#2b2f33"), box(x - 0.6, 1.06, 5.2, 0.6, 0.04, 0.4, "#d9822b", { glow: true }), cyl(x + 0.5, 0.8, 5.2, 0.5, 0.3, "#8a8f94", { w2: 0.4 })]),
    ...awning(pav, 9.4, 3.4, 3.4, 2.7, "#f4ecd8", "#e8dcb8", 6), ...crates(pav - Math.sign(pav) * 0.8, 9.6, 3, 2),
    ...(second ? [cyl(-10.5, 0, 8.6, 0.14, 4.4, "#5a3d22"), cyl(10.5, 0, 8.6, 0.14, 4.4, "#5a3d22"), box(0, 4.35, 8.6, 21, 0.03, 0.03, "#444444"), ...Array.from({ length: 14 }, (_, i) => box(-9.8 + i * 1.5, 3.95, 8.6, 0.38, 0.4, 0.03, flags[(i + 3) % 6]!))] : []),
    ...lampPost(-4.6, 3.6), ...lampPost(5.8, 3.6)
  ];
  return {
    ground: "#a35f38", props: out,
    people: [stroller(-8, 3.6, 41, -13, 13, 0.7), standing(-8.4, 10.3, PI, 42), standing(5.6, 10.6, PI, 43), standing(7.4, 10.2, PI, 44), standing(-9.2, 3.8, PI, 45), stroller(6, 3.7, 46, -13, 13, -0.6), standing(8.8, 3.8, PI, 47), standing(-6.6, 9.2, PI, 48)],
    lamps: [{ x: 1.2, y: 3, z: 0.8, c: "#ffd9a0" }, { x: -2.5, y: 3, z: 2, c: "#ffd9a0" }]
  };
}

/** The layout for a market variant; an unknown variant shows the craft market. */
export function marketLayout(variant: string, venueName: string, seed = 0): Layout {
  const name = nameOf(venueName || variant.replace(/_/g, " ")), r = rng(seed);
  return variate(variant === "cattle_market" ? cattle(name, r) : variant === "festival_ground" ? festival(name, r) : craft(name, r), seed);
}
