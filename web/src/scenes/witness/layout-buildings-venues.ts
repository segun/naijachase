// The 18 building venues as lists of parts and people (see layout-buildings-parts.ts for the vocabulary). Each function returns the
// scenery for one venue; `layoutFor` adds the common ground and the far trees and trims the crowd for a light scene.
// Rules every venue keeps (the tests check them): nothing stands in the camera's keep-out box (x 1.5 to 6, z -3 to 0.5), the lane and the
// walk to the witness, or the sight line to her (x 0 to 3, z 0 to 2.3, below 2 m); the front wall is at FRONT; the witness's own backdrop
// is plain wall and the entrance sits to her left.
import {
  FRONT, type Part, seededRandom, ball, bench, barredWindows, box, bunting, columns, cyl, door, farTrees, flagpole, horse, lamp, pave, palm, panel, shrub, sign, steps, tree, vehicle, wall, windows, WARM
} from "./layout-buildings-parts.ts";
import { COLOURS as C, type Person, crowd, pace, stand, toward } from "./layout-buildings-people.ts";
import { hashOf } from "./venue-recipes.ts";

export type Layout = { parts: Part[]; people: Person[]; ground: string; lampLights: readonly (readonly [number, number])[] };
/** What a layout is built from. `seed` comes from the account's text, so the same account always meets the same scene, and others differ. */
export type Input = { night: boolean; light: boolean; name: string; seed?: number };
/** The input plus the seeded choices a venue makes: colours, small shifts of position and trees. */
type Ctx = Input & {
  pick: <T>(options: readonly T[]) => T;
  /** `x` moved by up to ±`amount` metres. */
  j: (x: number, amount?: number) => number;
  tree: (x: number, z: number, h: number) => Part[];
  chance: (p: number) => boolean;
};
type Venue = (o: Ctx) => { parts: Part[]; people: Person[]; ground?: string };

const STONE = "#b9ae96";
const PAVE = "#bfb49b";
const fwd = 0;

// ---- Worship ----

const church: Venue = o => {
  const A = -3, tf = FRONT - 0.9;
  const roof = o.pick(["#8a4b38", "#6f3b30", "#7a5a3a", "#5a4a44"]), cream = o.pick(["#e8dfc8", "#f0e6d0", "#e0d6bb", "#ece6da"]), glass = o.pick(["#4a6fa5", "#5a8a6a", "#8a5a7a", "#c9873f"]), leaf = o.pick(["#4a3123", "#2f4a3a", "#6b2f2f", "#3a3a44"]), board = o.pick(["#6d4330", "#2f4a5a", "#4a3a5a", "#3a5a3f"]);
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#c4b79c"),
    wall(-9.5, 4, 5, cream), { k: "prism", x: -2.75, y: 5, z: FRONT + 3, w: 13.8, h: 2.9, d: 6, c: roof },
    { k: "prism", x: -2.75, y: 5, z: FRONT - 0.1, w: 13, h: 2.7, d: 0.3, c: cream },
    box(A, 0, tf + 1.1, 3.2, 9, 2.2, cream),
    box(A, 6.0, tf - 0.05, 1.5, 2.0, 0.1, "#2b2220"),
    box(A, 5.9, tf - 0.12, 1.7, 0.2, 0.12, "#d8cdb2"),
    { k: "cyl", x: A, y: 6.1, z: tf + 0.4, r: 0.5, rt: 0.2, h: 0.85, c: "#b88a33", swing: 0.15 },
    cyl(A, 9, tf + 1.1, 1.85, 3.4, roof, 0),
    { k: "disc", x: A, y: 4.5, z: tf - 0.05, r: 0.62, c: glass, lit: WARM },
    ...door(A, 1.7, 2.7, leaf, "#e7dcc3", undefined, tf),
    ...steps(A, 2.6, STONE, 2, tf),
    ...windows([-7.6, -5.7, 2.9], 1.5, 0.9, 2.5, glass, "#e7dcc3", "#ffc979"),
    sign(o.name, 0.9, 4.2, 4.2, board),
    ...o.tree(-11, 2.6, 7), ...o.tree(7.5, 3.6, 6.5), ...shrub2(-8.2, 2.2), ...shrub2(5.3, 3.3),
    lamp(o.j(-9.6), 2.2), lamp(o.j(5.0), 2.4)
  ];
  const people = [
    stand(-3.9, 2.1, fwd, { top: C.white, bottom: C.navy, head: { kind: "cap", c: C.navy } }),
    stand(-2.2, 2.2, toward(-2.2, 2.2, -3.9, 2.1), { top: C.maroon, skirt: C.maroon, head: { kind: "wrap", c: C.gold } }),
    stand(-6.6, 2.0, toward(-6.6, 2.0, -5.7, 2.0), { top: C.blue, skirt: C.cream, head: { kind: "wrap", c: C.pink } }),
    pace(-9.8, 1.5, -5.2, 1.6, 15, { top: C.green, bottom: C.black, prop: { kind: "bag", c: C.brown } }),
    stand(-5.7, 2.0, toward(-5.7, 2.0, -6.6, 2.0), { top: C.cream, bottom: C.brown, prop: { kind: "staff", c: C.brown } }),
    stand(6.4, 2.4, toward(6.4, 2.4, 7.6, 2.4), { top: C.purple, skirt: C.purple, head: { kind: "wrap", c: C.white } }),
    stand(7.6, 2.4, toward(7.6, 2.4, 6.4, 2.4), { top: C.white, bottom: C.grey, head: { kind: "cap", c: C.white } }),
    pace(9.4, 1.8, 5.6, 1.9, 17, { top: C.orange, skirt: C.brown, head: { kind: "wrap", c: C.orange } }, 1.5)
  ];
  return { parts, people: crowd(people, 1) };
};
const shrub2 = (x: number, z: number): Part[] => [shrub(x, z, 0.6), shrub(x + 0.7, z + 0.1, 0.45, "#4a8a4a")];

const mosque: Venue = o => {
  const A = -3, cream = o.pick(["#efe6cf", "#f4eee0", "#e8dcc2", "#f0ebe0"]), green = o.pick(["#3f8a6a", "#3a7a9a", "#6a8a4a", "#8a6a3a"]), door2 = o.pick(["#2f6a52", "#2f5a7a", "#4a6a2f", "#6a4a2f"]);
  const m = -10.8;
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#cbbfa5"),
    wall(-10, 4, 4.6, cream),
    ...Array.from({ length: 15 }, (_, i) => box(-9.6 + i * 0.95, 4.6, FRONT + 0.2, 0.5, 0.4, 0.4, cream)),
    panel(A, 0, 4.0, 4.4, "#e2d6b4", 0.35),
    { k: "disc", x: A, y: 3.0, z: FRONT - 0.42, r: 1.3, c: door2 },
    panel(A, 0, 2.6, 3.0, door2, 0.4),
    cyl(A, 4.6, FRONT + 1.8, 2.0, 1.3, cream), ball(A, 5.9, FRONT + 1.8, 2.0, green, 0.95),
    cyl(A, 7.8, FRONT + 1.8, 0.07, 0.8, "#d1a43a", 0.03),
    cyl(-8.2, 4.6, FRONT + 0.7, 0.8, 0.8, cream), ball(-8.2, 5.4, FRONT + 0.7, 0.85, green, 0.9),
    cyl(2.2, 4.6, FRONT + 0.7, 0.8, 0.8, cream), ball(2.2, 5.4, FRONT + 0.7, 0.85, green, 0.9),
    cyl(m, 0, FRONT + 1.0, 0.75, 6.9, cream, 0.62), cyl(m, 6.9, FRONT + 1.0, 0.95, 0.25, "#e0d3b0"),
    cyl(m, 7.15, FRONT + 1.0, 0.5, 1.5, cream, 0.45), ball(m, 8.75, FRONT + 1.0, 0.58, green, 1.2),
    cyl(m, 9.5, FRONT + 1.0, 0.05, 0.7, "#d1a43a", 0.03),
    ...[1.3, 3.1, 5.0].map(y => box(m, y, FRONT + 1.0 - 0.76, 0.22, 0.8, 0.05, "#4a5a4e")),
    ...windows([-8.1, -6.2, -0.4 + 3.4], 1.4, 0.9, 2.1, "#5f8a82", "#e2d6b4", "#ffd88a"),
    box(-5.6, 0, FRONT - 0.35, 1.5, 0.35, 0.5, "#6b4a30"),
    ...[0, 1, 2, 3, 4].map(i => box(-6.1 + i * 0.25, 0.35, FRONT - 0.35, 0.16, 0.08, 0.3, i % 2 ? "#2f4a7a" : "#8a5a3c")),
    sign(o.name, 0.9, 3.7, 4.2, door2),
    ...o.tree(-12.5, 2.6, 6.5), ...o.tree(7.6, 3.4, 6),
    lamp(o.j(-9.4), 2.3), lamp(o.j(5.0), 2.4)
  ];
  const people = [
    stand(-3.9, 2.1, fwd, { top: C.white, skirt: C.white, head: { kind: "cap", c: C.white } }),
    stand(-2.3, 2.2, toward(-2.3, 2.2, -3.9, 2.1), { top: C.teal, skirt: C.teal, head: { kind: "wrap", c: C.white } }),
    pace(-9.8, 1.6, -6.4, 1.7, 13, { top: C.cream, skirt: C.cream, head: { kind: "cap", c: C.white } }),
    stand(-7.3, 2.3, toward(-7.3, 2.3, -6.3, 2.3), { top: C.maroon, skirt: C.maroon, head: { kind: "wrap", c: C.cream } }),
    stand(-6.3, 2.3, toward(-6.3, 2.3, -7.3, 2.3), { top: C.white, skirt: C.grey, head: { kind: "cap", c: C.white } }),
    stand(6.3, 2.4, 0.3, { top: C.green, skirt: C.green, head: { kind: "wrap", c: C.green }, prop: { kind: "bag", c: C.brown } }),
    pace(9.6, 1.9, 5.8, 2.0, 16, { top: C.white, skirt: C.white, head: { kind: "cap", c: C.white } }, 2),
    stand(7.7, 2.4, -0.3, { top: C.blue, bottom: C.black, head: { kind: "cap", c: C.white } })
  ];
  return { parts, people: crowd(people, 2) };
};

const sacredGrove: Venue = o => {
  const A = -3, dark = o.pick(["#245a36", "#2a5a2a", "#1f4f3a", "#3a5a2a"]), wood = o.pick(["#6b4a2b", "#5a3d22", "#7a5a38"]);
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#9c7a4c"), pave(A - 1.6, A + 1.6, -1.2, FRONT + 1.5, "#b08a58"),
    ...[[-10, 5, 12], [-6.5, 7.5, 13], [0.5, 8.5, 14], [4.5, 6.5, 12], [8.5, 7.5, 13], [-3, 10, 15], [-13, 8, 11], [12, 9, 12]].flatMap(([x, z, h]) => tree(x!, z!, h!, dark)),
    wall(-9.6, -5.2, 1.5, "#8a6a3e", 0.3), wall(-0.8, 6.8, 1.5, "#8a6a3e", 0.3),
    box(A - 2.0, 0, FRONT - 0.2, 0.4, 3.3, 0.4, wood), box(A + 2.0, 0, FRONT - 0.2, 0.4, 3.3, 0.4, wood),
    box(A, 3.3, FRONT - 0.2, 4.8, 0.3, 0.45, wood),
    ...(o.night
      ? [box(A, 0, FRONT - 0.1, 3.7, 2.6, 0.12, "#5a3d22"), box(A, 1.2, FRONT - 0.18, 3.7, 0.1, 0.06, "#3d2916")]
      : [box(A - 1.85, 0, FRONT + 0.6, 0.1, 2.5, 1.1, "#5a3d22"), box(A + 1.85, 0, FRONT + 0.6, 0.1, 2.5, 1.1, "#5a3d22")]),
    sign(o.name, A, 3.95, 4.6, o.pick(["#4f3320", "#3a3a2a", "#5a2f22"]), "#f0e2b5", FRONT - 0.38, 0.7),
    box(-8.4, 0, 2.0, 2.4, 0.22, 1.3, "#9a9488"), ball(-8.9, 0.45, 2.0, 0.35, "#8c867a", 0.8), ball(-8.0, 0.4, 2.1, 0.3, "#a29c90", 0.8),
    ...bench(5.4, 2.4, "#6b4a2b"),
    lamp(o.j(-6.0), 2.3), lamp(o.j(5.0), 2.4)
  ];
  const people = [
    stand(A + 1.7, 2.2, toward(A + 1.7, 2.2, A, 2.4), { top: C.white, skirt: C.white, head: { kind: "cap", c: C.white }, prop: { kind: "staff", c: C.brown } }),
    pace(-9.6, 1.4, -5.6, 1.5, 15, { top: C.white, skirt: C.white, head: { kind: "wrap", c: C.white } }),
    stand(-7.0, 2.4, toward(-7.0, 2.4, -8.0, 2.3), { top: C.green, bottom: C.brown, prop: { kind: "bag", c: C.brown } }),
    stand(-7.9, 2.4, toward(-7.9, 2.4, -7.0, 2.4), { top: C.cream, skirt: C.orange, head: { kind: "wrap", c: C.orange } }),
    stand(6.6, 2.5, toward(6.6, 2.5, 5.6, 2.5), { top: C.blue, bottom: C.black })
  ];
  return { parts, people: crowd(people, 0), ground: "#9b6b42" };
};

// ---- Civic ----

const policeStation: Venue = o => {
  const A = -4, navy = o.pick(["#274a78", "#1f3f5f", "#2a4a5f", "#33405f"]), wallC = o.pick(["#d9e0d3", "#e4e4da", "#d3dce0", "#e0dcc8"]);
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, PAVE),
    wall(-10.5, 4.5, 6.4, wallC), box(-3, 6.4, FRONT + 1.5, 15.4, 0.3, 3.3, navy),
    panel(-3, 3.1, 15, 0.4, navy, 0.1),
    ...windows([-9, -6.8, -4.6, -1.4, 0.8, 3], 3.85, 1.1, 1.3, "#6f93a3", "#f2f2ea", "#bfe0ff"),
    ...barredWindows([-8.4, -6.3, 3.0], 1.3, 1.1, 1.3),
    ...door(A, 2.0, 2.7, "#2a4a6a", "#eef0e8", "#9ccbe0"),
    ...steps(A, 2.6, "#aaa79d", 2),
    box(A, 3.0, FRONT - 0.9, 4.4, 0.2, 1.8, navy), cyl(A - 2.0, 0, FRONT - 1.7, 0.07, 3.0, "#9aa0a4"), cyl(A + 2.0, 0, FRONT - 1.7, 0.07, 3.0, "#9aa0a4"),
    { k: "beacon", x: A, y: 3.3, z: FRONT - 0.9, r: 0.24, c: "#2f6bff", c2: "#ff3b3b", period: 0.9 },
    panel(-6.6, 0.9, 1.5, 1.2, "#1d3f66", 0.1), panel(-6.9, 1.0, 0.4, 0.5, "#f1f1e6", 0.14), panel(-6.35, 1.2, 0.4, 0.5, "#f1f1e6", 0.14),
    sign(o.name, -2.6, 5.85, 7.4, navy),
    ...flagpole(5.6, 2.6, 6.2, "#1d3f66", "#8fb8e0", 1.7),
    ...vehicle(-8.4, 1.9, -1, o.pick(["#f1f3f0", "#e8ecef", "#dfe6ea"]), { stripe: o.pick([navy, "#2f6bff", "#2a8f4a"]) }), { k: "beacon", x: -7.5, y: 2.0, z: 1.9, r: 0.13, c: "#2f6bff", c2: "#ff3b3b", period: 0.7 },
    ...bench(-0.2 + 6.2, 2.3, "#5b5b5b"),
    ...o.tree(8.5, 3.8, 6.5), lamp(o.j(-5.5), 2.5), lamp(o.j(5.0), 2.5)
  ];
  const people = [
    stand(A + 1.7, 2.2, fwd, { top: C.navy, bottom: C.navy, head: { kind: "cap", c: C.navy } }),
    stand(A - 2.2, 2.1, toward(A - 2.2, 2.1, A, 2.1), { top: C.grey, bottom: C.black, prop: { kind: "bag", c: C.black } }),
    pace(-10.0, 1.2, -6.2, 1.3, 14, { top: C.khaki, bottom: C.brown }),
    stand(6.7, 2.4, toward(6.7, 2.4, 7.6, 2.4), { top: C.maroon, skirt: C.maroon, head: { kind: "wrap", c: C.gold } }),
    stand(7.6, 2.4, toward(7.6, 2.4, 6.7, 2.4), { top: C.navy, bottom: C.navy, head: { kind: "cap", c: C.navy } }),
    stand(-9.4, 2.9, 0.4, { top: C.blue, bottom: C.black })
  ];
  return { parts, people: crowd(people, 3) };
};

const hospital: Venue = o => {
  const A = -4.5, teal = o.pick(["#1f8a84", "#2a7aa0", "#3a8a4a", "#5a6aa0"]), wallC = o.pick(["#eef1ec", "#f2f0e6", "#e8eef0", "#f0ece4"]);
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#c9c3b3"),
    wall(-11, 5, 6.4, wallC), panel(-3, 2.95, 16, 0.4, teal, 0.1),
    ...windows([-9.4, -7.4, -5.4, -1.0, 1.0, 3.0], 3.5, 1.1, 1.3, "#7fb1c0", "#ffffff", "#e8f6ff"),
    ...windows([-9.2, -7.2, 3.2], 1.2, 1.1, 1.3, "#7fb1c0", "#ffffff", "#e8f6ff"),
    ...door(A, 2.6, 2.7, "#9ccbd0", "#ffffff", "#e8f6ff"),
    box(A, 3.1, FRONT - 1.0, 5.0, 0.25, 2.0, teal), cyl(A - 2.3, 0, FRONT - 1.9, 0.08, 3.1, "#c5c9cc"), cyl(A + 2.3, 0, FRONT - 1.9, 0.08, 3.1, "#c5c9cc"),
    panel(A, 3.9, 0.4, 1.5, "#1f9a58", 0.1), panel(A, 4.45, 1.5, 0.4, "#1f9a58", 0.1),
    sign(o.name, 1.2, 5.75, 5.2, teal),
    ...vehicle(-8.4, 1.9, -1, "#fbfbf8", { stripe: o.pick(["#c63a32", "#2a8f4a", "#2f6bff"]) }), { k: "beacon", x: -7.5, y: 2.0, z: 1.9, r: 0.14, c: "#ff3b3b", c2: "#2f6bff", period: 0.6 },
    ...bench(6.2, 2.4, "#5b6b6b"), shrub(7.8, 3.0), shrub(-1.0, 2.9, 0.45),
    ...o.tree(9, 3.8, 6), lamp(o.j(-5.6), 2.4), lamp(o.j(5.0), 2.4)
  ];
  const people = [
    stand(A + 2.0, 2.2, fwd, { top: C.white, bottom: C.teal, head: { kind: "cap", c: C.white } }),
    stand(A - 2.0, 2.2, toward(A - 2.0, 2.2, A, 2.2), { top: C.white, bottom: C.navy }),
    pace(-10.0, 1.4, -5.9, 1.5, 12, { top: C.teal, bottom: C.teal, head: { kind: "cap", c: C.white } }),
    stand(6.7, 2.5, toward(6.7, 2.5, 7.7, 2.5), { top: C.orange, skirt: C.brown, head: { kind: "wrap", c: C.orange }, prop: { kind: "bag", c: C.brown } }),
    stand(7.7, 2.5, toward(7.7, 2.5, 6.7, 2.5), { top: C.blue, bottom: C.grey }),
    pace(9.8, 1.7, 5.9, 1.8, 14, { top: C.green, bottom: C.black }, 1)
  ];
  return { parts, people: crowd(people, 4) };
};

const communityHall: Venue = o => {
  const A = -3;
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#c4b89a"),
    wall(-10, 4, 4.8, o.pick(["#d8c394", "#d9b98a", "#cfd4b0", "#d8a98a"])), box(-3, 3.4, FRONT - 0.5, 14.6, 0.18, 2.0, o.pick(["#6f8590", "#8a5a4a", "#5a7a6a", "#7a7a85"])),
    ...[-9, -7, -5.2, 3.6].map(x => cyl(x, 0, FRONT - 1.4, 0.09, 3.4, "#6b4a30")),
    ...door(A, 2.4, 2.6, o.pick(["#4f6a3a", "#3a5a7a", "#7a3a3a", "#5a4a6a"]), "#efe4c8"), ...windows([-8, -6, 3.2], 1.4, 1.1, 1.2, "#6f93a3", "#efe4c8", WARM),
    panel(-5.6, 1.1, 1.6, 1.2, "#6b4a30", 0.1), panel(-6.0, 1.2, 0.4, 0.5, "#f1f1e6", 0.14), panel(-5.4, 1.3, 0.4, 0.45, "#e9c74a", 0.14),
    ...[0, 1, 2, 3].map(i => box(-9.5 + (i % 2) * 0.55, i < 2 ? 0 : 0.5, FRONT - 0.5, 0.5, 0.5, 0.5, o.pick(["#376c91", "#bb563d", "#e0b23a", "#2f8f5b", "#7a4aa0", "#d65a4a"]))),
    box(6.4, 0, 2.0, 1.1, 0.8, 0.7, "#c1432d"), { k: "puff", x: 6.4, y: 0.95, z: 2.0, r: 0.22, c: "#8c8c8c" },
    ...bunting(-9.4, 3.4, 3.35, FRONT - 1.4, o.pick([["#d65a4a", "#e9c74a", "#2f8f5b", "#3b6aa6"], ["#7a4aa0", "#efb62f", "#2a8f8a", "#d65a4a"], ["#3b6aa6", "#f2e3c0", "#c8372d", "#2f8f5b"]])),
    sign(o.name, -3, 4.2, 6.6, o.pick(["#244f68", "#4a2f5f", "#2f5f3a", "#5f3a2f"]), "#fff8df", FRONT - 0.06, 0.8),
    ...o.tree(-11.5, 2.8, 6), ...o.tree(8.6, 3.6, 6.5), lamp(o.j(-6.4), 2.5), lamp(o.j(5.2), 2.6)
  ];
  const people = [
    stand(-4.2, 2.1, toward(-4.2, 2.1, -2.2, 2.2), { top: C.green, skirt: C.green, head: { kind: "cap", c: C.red } }),
    stand(-2.2, 2.2, toward(-2.2, 2.2, -4.2, 2.1), { top: C.cream, bottom: C.brown, prop: { kind: "staff", c: C.brown } }),
    pace(-9.6, 1.6, -6.3, 2.0, 9, { top: C.orange, skirt: C.orange, head: { kind: "wrap", c: C.orange } }),
    pace(-9.0, 2.2, -6.0, 1.7, 9, { top: C.orange, skirt: C.orange, head: { kind: "wrap", c: C.gold } }, 0.4),
    stand(6.9, 2.4, toward(6.9, 2.4, 7.9, 2.4), { top: C.purple, bottom: C.black }),
    stand(7.9, 2.4, toward(7.9, 2.4, 6.9, 2.4), { top: C.red, skirt: C.red, head: { kind: "wrap", c: C.white } }),
    stand(-7.2, 2.5, fwd, { top: C.blue, bottom: C.black, prop: { kind: "drum", c: "#8a5a2f" } })
  ];
  return { parts, people: crowd(people, 1) };
};

const traditionalCouncil: Venue = o => {
  const A = -3;
  const ochre = o.pick(["#b8744a", "#c08a5a", "#a8643a", "#b8845a"]);
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#c2a47c"),
    wall(-9, 3.5, 3.4, ochre), panel(-2.75, 2.15, 12.5, 0.5, "#e8d3a0", 0.1),
    ...Array.from({ length: 15 }, (_, i) => panel(-8.6 + i * 0.8, 2.3, 0.3, 0.2, "#2a1a12", 0.14)),
    { k: "prism", x: -2.75, y: 3.4, z: FRONT + 1.5, w: 14.6, h: 1.9, d: 4.2, c: o.pick(["#6b5a3a", "#7a6a42", "#5a4a3a", "#6a5a52"]) },
    ...[-8.5, -6.0, 4.0].map(x => cyl(x, 0, FRONT - 1.4, 0.13, 3.4, "#5a3a22")),
    box(-3, 3.3, FRONT - 0.7, 14, 0.15, 1.5, "#6b5a3a"),
    ...door(A, 1.8, 2.5, "#5a3a22", "#e8d3a0"),
    sign(o.name, -3, 2.95, 6, "#4a2a1a", "#f0e2b5", FRONT - 0.06, 0.6),
    ...[[-8.3, 2.6], [-7.2, 3.0], [-6.1, 2.6]].map(([x, z]) => cyl(x!, 0, z!, 0.28, 0.5, "#7a5430")),
    cyl(-7.2, 0, 2.0, 0.04, 2.6, "#d1a43a"), ball(-7.2, 2.7, 2.0, 1.4, o.pick(["#a8362e", "#d1a43a", "#2f6a7a", "#6b2f7a"]), 0.28),
    shrub(5.6, 3.0), ...o.tree(9, 3.4, 6.5), ...o.tree(-11.5, 3, 6), lamp(o.j(-5.5), 2.4), lamp(o.j(5.0), 2.5)
  ];
  const people = [
    stand(A + 1.6, 2.3, toward(A + 1.6, 2.3, A, 2.3), { top: C.white, skirt: C.white, head: { kind: "cap", c: C.red }, prop: { kind: "staff", c: C.brown } }),
    stand(A - 2.0, 2.2, toward(A - 2.0, 2.2, A, 2.2), { top: C.blue, skirt: C.blue, head: { kind: "cap", c: C.red } }),
    stand(-9.0, 2.4, toward(-9.0, 2.4, -8.0, 2.6), { top: C.maroon, skirt: C.maroon, head: { kind: "cap", c: C.gold } }),
    pace(9.8, 1.8, 5.8, 1.9, 15, { top: C.cream, bottom: C.brown, prop: { kind: "bag", c: C.black } }),
    stand(6.5, 2.4, toward(6.5, 2.4, 7.5, 2.4), { top: C.green, skirt: C.green, head: { kind: "wrap", c: C.gold } }),
    stand(7.5, 2.4, toward(7.5, 2.4, 6.5, 2.4), { top: C.white, skirt: C.white, head: { kind: "cap", c: C.white } })
  ];
  return { parts, people: crowd(people, 2) };
};

const emirPalace: Venue = o => {
  const A = -4.5, sand = o.pick(["#d9b98a", "#d4a97a", "#dcc49a", "#cfb08a"]), trim = o.pick(["#f2e7cc", "#f4efe0", "#efe0c0"]);
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#cdb48a"),
    wall(-11, 5, 4.2, sand),
    ...Array.from({ length: 17 }, (_, i) => box(-10.6 + i * 0.93, 4.2, FRONT + 0.15, 0.45, 0.5, 0.4, sand)),
    panel(-3, 3.0, 16, 0.25, trim, 0.08),
    panel(A, 0, 4.0, 4.4, trim, 0.35),
    { k: "disc", x: A, y: 3.0, z: FRONT - 0.42, r: 1.3, c: "#3a2a1d" }, panel(A, 0, 2.6, 3.0, "#3a2a1d", 0.4),
    cyl(A - 3.4, 0, FRONT + 0.5, 0.95, 5.6, sand, 0.8), cyl(A + 3.4, 0, FRONT + 0.5, 0.95, 5.6, sand, 0.8),
    ball(A - 3.4, 5.7, FRONT + 0.5, 0.9, trim, 0.55), ball(A + 3.4, 5.7, FRONT + 0.5, 0.9, trim, 0.55),
    sign(o.name, A, 4.95, 4.6, "#5a3a22", "#f0e2b5", FRONT - 0.4, 0.7),
    ...horse(o.j(-8.3, 0.4), 2.0, 1, o.pick(["#7a4a2c", "#3a2a22", "#a8845a", "#d8d2c4"])), ...o.tree(9, 3.6, 6.5), shrub(6.0, 3.0), lamp(o.j(-6.0), 2.5), lamp(o.j(5.0), 2.5)
  ];
  const people = [
    stand(A + 1.7, 2.3, fwd, { top: C.white, skirt: C.white, head: { kind: "cap", c: C.red }, prop: { kind: "staff", c: C.brown } }),
    stand(A - 1.7, 2.3, fwd, { top: C.white, skirt: C.white, head: { kind: "cap", c: C.red }, prop: { kind: "staff", c: C.brown } }),
    stand(-6.1, 2.1, toward(-6.1, 2.1, -7.0, 2.0), { top: C.brown, bottom: C.brown, head: { kind: "cap", c: C.khaki } }),
    pace(9.8, 1.9, 5.9, 2.0, 15, { top: C.cream, skirt: C.cream, head: { kind: "cap", c: C.white } }),
    stand(6.6, 2.6, toward(6.6, 2.6, 7.6, 2.6), { top: C.blue, skirt: C.blue, head: { kind: "cap", c: C.white } }),
    stand(7.6, 2.6, toward(7.6, 2.6, 6.6, 2.6), { top: C.white, skirt: C.white, head: { kind: "cap", c: C.red } })
  ];
  return { parts, people: crowd(people, 0) };
};

const palace: Venue = o => {
  const A = -5, cream = o.pick(["#f1e9d5", "#f4efe2", "#ece2c8"]), gold = o.pick(["#d1a43a", "#c9a24a", "#d8b44a"]), red = o.pick(["#8f2f2b", "#6f2f3a", "#2f5a6a", "#4a5a3a"]);
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#c9bfa6"),
    wall(-10, 4.5, 5.0, cream), box(-3, 5.0, FRONT + 2.3, 12.8, 1.8, 4.6, red),
    box(A, 3.9, FRONT - 0.4, 7.8, 0.7, 2.0, gold),
    { k: "prism", x: A, y: 4.6, z: FRONT - 1.0, w: 7.8, h: 1.5, d: 0.5, c: cream },
    ...columns([A - 3.2, A - 1.6, A + 1.6, A + 3.2], FRONT - 1.4, 3.9),
    ...door(A, 2.2, 3.1, o.pick(["#7a3a2a", "#3a2a22", "#2f4a3a"]), "#efe4c8"), ...windows([2.8], 1.5, 1.0, 2.3, "#6f93a3", "#efe4c8", WARM),
    ...steps(A, 5.0, STONE, 2, FRONT - 1.0),
    sign(o.name, A, 4.25, 6.4, "#6e2a24", "#f4e4b0", FRONT - 1.42, 0.55),
    ...flagpole(5.2, 2.6, 6.4, o.pick(["#c8372d", "#8a2f4a", "#2f5a9a"]), "#f1e9d5", 1.5), ...flagpole(-10.4, 2.6, 6.4, o.pick(["#c8372d", "#8a2f4a", "#2f5a9a"]), "#f1e9d5", 1.5),
    box(5.2 + 1.5, 0, 3.0, 0.5, 1.4, 0.5, cream), ball(6.7, 1.6, 3.0, 0.28, gold),
    ...o.tree(8.5, 3.6, 6.5), shrub(3.0, 2.95, 0.5), lamp(o.j(-9.0), 2.4), lamp(o.j(5.0), 2.4)
  ];
  const people = [
    stand(A + 3.3, 2.2, fwd, { top: C.red, bottom: C.white, head: { kind: "cap", c: C.gold }, prop: { kind: "staff", c: C.brown } }),
    stand(A - 3.5, 2.0, fwd, { top: C.red, bottom: C.white, head: { kind: "cap", c: C.gold }, prop: { kind: "staff", c: C.brown } }),
    pace(-10.0, 1.4, -6.2, 1.5, 13, { top: C.gold, skirt: C.maroon, head: { kind: "cap", c: C.maroon }, prop: { kind: "drum", c: "#8a5a2f" } }),
    stand(6.7, 2.4, toward(6.7, 2.4, 7.7, 2.4), { top: C.blue, skirt: C.blue, head: { kind: "cap", c: C.blue } }),
    stand(7.7, 2.4, toward(7.7, 2.4, 6.7, 2.4), { top: C.cream, skirt: C.cream, head: { kind: "wrap", c: C.gold } }),
    pace(9.8, 1.8, 6.0, 1.9, 16, { top: C.white, bottom: C.brown, prop: { kind: "bag", c: C.black } }, 1.4)
  ];
  return { parts, people: crowd(people, 3) };
};

// ---- Culture, learning and media ----

const museum: Venue = o => {
  const A = -5;
  const stone = o.pick(["#e3d6b8", "#ddd2bc", "#e8dcc0", "#d8cfc0"]), banner = o.pick(["#b2503a", "#2f5a7a", "#6b3a7a", "#3a6a4a"]);
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#cfc5ad"),
    wall(-10, 4, 5.2, stone),
    box(A, 3.9, FRONT - 0.4, 7.8, 0.7, 2.0, "#d5c7a6"), { k: "prism", x: A, y: 4.6, z: FRONT - 1.0, w: 7.8, h: 1.5, d: 0.5, c: stone },
    ...columns([A - 3.2, A - 1.6, A, A + 1.6, A + 3.2], FRONT - 1.4, 3.9),
    ...steps(A, 5.6, "#cfc5ad", 2, FRONT - 1.0),
    ...door(A, 2.2, 3.0, "#5a3d28", "#efe4c8", WARM), ...windows([2.7], 1.5, 1.0, 2.4, "#6f93a3", "#efe4c8"),
    panel(A - 2.4, 1.0, 0.7, 2.7, banner, 0.1), panel(A + 2.4, 1.0, 0.7, 2.7, banner, 0.1),
    sign(o.name, A, 4.25, 7.0, o.pick(["#4d3a28", "#2f3a4d", "#4d2f3a"]), "#f4e4b0", FRONT - 1.42, 0.55),
    box(-10.4, 0, 2.3, 0.9, 0.9, 0.9, "#a89a80"), cyl(-10.4, 0.9, 2.3, 0.3, 1.3, "#8a6a3a", 0.18), ball(-10.4, 2.4, 2.3, 0.28, "#8a6a3a"),
    ...o.tree(8.4, 3.6, 6.5), shrub(3.4, 2.95, 0.5), lamp(o.j(-0.9), 2.7), lamp(o.j(5.2), 2.4)
  ];
  const people = [
    pace(-9.6, 1.9, -5.4, 2.0, 18, { top: C.maroon, skirt: C.maroon, head: { kind: "wrap", c: C.gold } }),
    pace(-10.6, 1.9, -6.4, 2.0, 18, { top: C.blue, bottom: C.black }),
    pace(-11.4, 1.9, -7.2, 2.0, 18, { top: C.orange, skirt: C.cream, head: { kind: "wrap", c: C.orange } }),
    stand(A + 3.8, 2.3, toward(A + 3.8, 2.3, A, 2.3), { top: C.navy, bottom: C.navy, head: { kind: "cap", c: C.navy } }),
    stand(6.6, 2.5, toward(6.6, 2.5, 7.6, 2.5), { top: C.green, bottom: C.brown, prop: { kind: "bag", c: C.brown } }),
    stand(7.6, 2.5, toward(7.6, 2.5, 6.6, 2.5), { top: C.pink, skirt: C.purple, head: { kind: "wrap", c: C.pink } })
  ];
  return { parts, people: crowd(people, 1) };
};

const library: Venue = o => {
  const A = -3, brick = o.pick(["#a85d47", "#b0704a", "#945a4a", "#a8654f"]), books = o.pick([["#79513b", "#3c6676", "#8a463b", "#c9a24a"], ["#2f5a7a", "#8a3a3a", "#c9a24a", "#4a6a3a"], ["#6b3a7a", "#d1a43a", "#3a6a5a", "#a8643a"]]);
  const shelves = (x: number) => [
    panel(x, 0.7, 2.3, 2.9, "#e9e1cf", 0.1), panel(x, 0.85, 1.9, 2.6, "#3a2a20", 0.14, { lit: "#ffd98a" }),
    ...[0, 1, 2].flatMap(r => [0, 1, 2, 3].map(i => panel(x - 0.75 + i * 0.5, 1.0 + r * 0.8, 0.4, 0.55, books[(i + r) % 4]!, 0.2)))
  ];
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, PAVE),
    wall(-10, 4, 6.1, brick), panel(-3, 3.0, 14.2, 0.3, "#e9e1cf", 0.1), box(-3, 6.1, FRONT + 1.5, 14.6, 0.25, 3.2, "#e9e1cf"),
    ...shelves(-8), ...shelves(-5.2), ...windows([3.0], 1.5, 1.0, 2.2, "#6f93a3", "#e9e1cf"), ...windows([-8, -5.2, -1.2, 1.0, 3.0], 3.6, 0.9, 1.3, "#6f93a3", "#e9e1cf"),
    ...door(A + 0.9, 1.8, 2.7, o.pick(["#2d4a3a", "#3a3a5a", "#5a2f2f"]), "#e9e1cf", WARM), ...steps(A + 0.9, 2.6, "#c4b79c", 2),
    sign(o.name, -2.0, 5.5, 6.0, "#2d4a3a", "#fff8df", FRONT - 0.06, 0.7),
    box(-2.9, 0, 2.3, 0.6, 1.1, 0.5, o.pick(["#2a5a8a", "#8a2f2f", "#2a6a4a"])), box(-2.9, 0.75, 2.04, 0.4, 0.06, 0.02, "#0d1a26"),
    ...bench(6.0, 2.5, "#6b4a2b"), ...o.tree(8.8, 3.6, 6), ...o.tree(-11.2, 3.0, 6), lamp(o.j(-10.0), 2.4), lamp(o.j(5.0), 2.4)
  ];
  const people = [
    stand(-1.7, 2.2, toward(-1.7, 2.2, A + 0.9, 2.2), { top: C.teal, skirt: C.grey, head: { kind: "wrap", c: C.teal }, prop: { kind: "bag", c: C.brown } }),
    pace(-10.0, 1.6, -6.1, 1.7, 14, { top: C.blue, bottom: C.black, prop: { kind: "bag", c: C.brown } }),
    stand(6.7, 2.5, toward(6.7, 2.5, 7.7, 2.5), { top: C.orange, bottom: C.black, prop: { kind: "bag", c: C.red } }),
    stand(7.7, 2.5, toward(7.7, 2.5, 6.7, 2.5), { top: C.pink, skirt: C.navy, head: { kind: "wrap", c: C.pink } }),
    stand(A - 1.8, 2.3, 0.2, { top: C.cream, bottom: C.brown }),
    pace(9.8, 1.8, 6.0, 1.9, 15, { top: C.navy, bottom: C.navy, head: { kind: "cap", c: C.navy } }, 1.2)
  ];
  return { parts, people: crowd(people, 4) };
};

const university: Venue = o => {
  const stone = o.pick(["#e9e2d0", "#e0dccc", "#ece4d0", "#ddd6c4"]);
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#cdc5b0"),
    wall(-8, 5, 6.4, stone), box(-9.2, 0, FRONT + 0.9, 2.6, 8.0, 2.6, "#d8c9a8"), cyl(-9.2, 8.0, FRONT + 0.9, 1.7, 1.3, "#7a4a38", 0),
    { k: "disc", x: -9.2, y: 6.6, z: FRONT - 0.42, r: 0.7, c: "#f4f4ee" }, box(-9.2, 6.6, FRONT - 0.46, 0.08, 0.55, 0.04, "#26292c"), box(-9.0, 6.65, FRONT - 0.46, 0.4, 0.08, 0.04, "#26292c"),
    ...windows([-6.8, -4.9, -1.2, 2.9], 1.3, 1.1, 1.4, "#6f93a3", stone, WARM), ...windows([-6.8, -4.9, -1.2, 0.8, 2.9], 3.8, 1.1, 1.4, "#6f93a3", stone, WARM),
    ...columns([-4.6, -3.2, -1.8], FRONT - 1.3, 3.6), box(-3.2, 3.6, FRONT - 0.8, 4.4, 0.35, 1.8, "#d1c7ac"),
    ...door(-3.2, 1.8, 2.6, "#4a3a2a", stone),
    sign(o.name, 0.2, 5.85, 6.8, o.pick(["#4a3a63", "#2f4a63", "#3a5a3f", "#633a3a"]), "#fff8df", FRONT - 0.06, 0.7),
    cyl(7.3, 0, 2.5, 0.05, 2.5, "#bdbdbd"), ball(7.3, 2.5, 2.5, 1.2, o.pick(["#d65a4a", "#e9c74a", "#2a8f8a", "#7a4aa0", "#3b6aa6"]), 0.3), box(7.3, 0, 2.5, 0.9, 0.7, 0.6, "#7a5430"),
    ...o.tree(-12.5, 3.2, 6), ...o.tree(9.3, 3.6, 6.5), lamp(o.j(-6.5), 2.4), lamp(o.j(5.4), 2.5)
  ];
  const people = [
    pace(-10.2, 1.5, -5.4, 1.7, 13, { top: C.blue, bottom: C.black, prop: { kind: "bag", c: C.brown } }),
    pace(9.8, 1.8, 5.8, 1.9, 14, { top: C.orange, skirt: C.cream, head: { kind: "wrap", c: C.orange }, prop: { kind: "bag", c: C.red } }, 1.0),
    stand(-4.4, 2.2, toward(-4.4, 2.2, -3.3, 2.2), { top: C.green, bottom: C.black, prop: { kind: "bag", c: C.black } }),
    stand(-3.3, 2.2, toward(-3.3, 2.2, -4.4, 2.2), { top: C.pink, skirt: C.white, head: { kind: "wrap", c: C.pink } }),
    stand(4.6, 2.4, 0.2, { top: C.navy, bottom: C.navy, head: { kind: "cap", c: C.navy } }),
    pace(-9.8, 2.5, -6.0, 2.6, 17, { top: C.purple, bottom: C.black, prop: { kind: "bag", c: C.brown } }, 2.0),
    stand(8.0, 2.8, toward(8.0, 2.8, 7.3, 2.4), { top: C.red, skirt: C.cream, head: { kind: "wrap", c: C.red } })
  ];
  return { parts, people: crowd(people, 2) };
};

const monument: Venue = o => {
  const stone = o.pick(["#cbbd9f", "#c4c0b4", "#d4c4a4", "#b8b4a4"]);
  const parts: Part[] = [
    pave(-14, 14, -1.2, 11, "#cfc3a8"),
    box(-3.5, 0, 6.2, 8.2, 0.25, 5.8, "#b9aa8f"), box(-3.5, 0.25, 6.2, 6.4, 0.25, 4.6, "#c4b698"),
    box(-3.5, 0.5, 6.2, 2.8, 2.3, 2.8, "#b9aa8f"), cyl(-3.5, 2.8, 6.2, 0.95, 5.2, stone, 0.5), cyl(-3.5, 8.0, 6.2, 0.5, 1.0, "#a99a7c", 0), ball(-3.5, 9.1, 6.2, 0.26, "#d1a43a"),
    sign(o.name, -3.5, 1.7, 2.5, "#2f2e2a", "#f0e2b5", 6.2 - 1.45, 0.75),
    ...[-7.4, -6.0, -4.6, -3.2, -1.8, -0.4].map(x => cyl(x, 0, 3.4, 0.11, 0.6, "#4a4a4a")),
    shrub(-6.4, 4.3, 0.5, o.pick(["#c9503f", "#e0b23a", "#c46a8d", "#e8e0d0"])), shrub(-0.7, 4.3, 0.5, o.pick(["#e0b23a", "#c9503f", "#d3772c", "#b06ac4"])), shrub(-5.6, 4.1, 0.4, "#3b7a44"), shrub(-1.4, 4.1, 0.4, "#3b7a44"),
    ...bench(-9.2, 2.4), ...bench(5.0, 3.0), lamp(o.j(-7.0), 4.0, 0.7), lamp(o.j(0.2), 4.0, 0.7),
    ...o.tree(9, 5, 7), ...o.tree(-11, 5, 7)
  ];
  const people = [
    pace(-10.0, 1.6, -5.4, 1.7, 15, { top: C.teal, skirt: C.cream, head: { kind: "wrap", c: C.teal } }),
    pace(-11.0, 1.7, -6.4, 1.8, 15, { top: C.orange, bottom: C.black }),
    stand(-8.0, 2.5, toward(-8.0, 2.5, -4.5, 5), { top: C.blue, bottom: C.black, prop: { kind: "bag", c: C.black } }),
    stand(6.4, 2.6, toward(6.4, 2.6, -3.5, 5), { top: C.green, bottom: C.brown, prop: { kind: "staff", c: C.brown } }),
    stand(7.4, 2.7, toward(7.4, 2.7, -3.5, 5), { top: C.pink, skirt: C.maroon, head: { kind: "wrap", c: C.pink } }),
    pace(9.8, 1.9, 6.0, 2.0, 16, { top: C.cream, bottom: C.navy }, 1)
  ];
  return { parts, people: crowd(people, 0) };
};

const radioStation: Venue = o => {
  const A = -3;
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, PAVE),
    wall(-10, 4.5, 4.4, o.pick(["#cfd6d9", "#d9d6cf", "#c9d9d0", "#d6cfd9"])), panel(-3, 4.2, 14.8, 0.3, "#2f4350", 0.1),
    panel(-7.2, 0.9, 5.0, 2.2, "#e9eef0", 0.1), panel(-7.2, 1.0, 4.6, 2.0, "#34505e", 0.14, { lit: "#a8e4ff" }),
    panel(-7.2, 1.0, 0.1, 2.0, "#e9eef0", 0.2), panel(-7.2, 1.9, 4.6, 0.08, "#e9eef0", 0.2),
    ...door(A + 0.5, 1.8, 2.6, "#2f4350", "#e9eef0", "#a8e4ff"),
    sign("ON AIR", A + 0.5, 3.0, 1.5, "#4a1210", "#ff4a3d", FRONT - 0.06, 0.5),
    sign(o.name, -0.2, 3.8, 6.4, o.pick(["#263f55", "#3a2f55", "#2f553f", "#55302f"]), "#fff8df", FRONT - 0.06, 0.6),
    cyl(2.6, 4.4, FRONT + 1.2, 0.07, 0.7, "#8a9094"), { k: "disc", x: 2.6, y: 5.3, z: FRONT + 1.0, r: 0.85, c: "#aab2b6" }, { k: "disc", x: 2.6, y: 5.3, z: FRONT + 0.95, r: 0.7, c: "#e4e8ea" }, { k: "disc", x: 2.6, y: 5.3, z: FRONT + 0.9, r: 0.12, c: "#7d858a" },
    cyl(-9.6, 0, FRONT + 1.6, 0.13, 8.6, "#9aa0a4", 0.08), ...[2.5, 4.8, 7.1].map(y => box(-9.6, y, FRONT + 1.6, 1.3, 0.09, 0.09, "#9aa0a4")),
    { k: "beacon", x: -9.6, y: 8.8, z: FRONT + 1.6, r: 0.24, c: "#ff2a2a", c2: "#5a0f0f", period: 1.4 },
    ...vehicle(7.6, 2.3, -1, o.pick(["#f4f6f6", "#e8ecef", "#f0ece0"]), { stripe: o.pick(["#2f6bb0", "#c8372d", "#2a8f4a", "#d1a43a"]) }),
    ...o.tree(-12.3, 3, 6), shrub(-0.2, 2.95, 0.45), lamp(o.j(-5.2), 2.5), lamp(o.j(5.0), 2.5)
  ];
  const people = [
    stand(A - 1.7, 2.2, toward(A - 1.7, 2.2, A + 0.5, 2.2), { top: C.pink, skirt: C.navy, head: { kind: "wrap", c: C.pink } }),
    stand(A + 1.6, 2.2, toward(A + 1.6, 2.2, A + 0.5, 2.2), { top: C.blue, bottom: C.black, prop: { kind: "bag", c: C.black } }),
    pace(-9.8, 1.5, -6.2, 1.6, 12, { top: C.orange, bottom: C.black }),
    stand(5.8, 2.6, toward(5.8, 2.6, 6.6, 2.6), { top: C.green, bottom: C.brown }),
    stand(9.4, 2.6, toward(9.4, 2.6, 8.6, 2.6), { top: C.grey, bottom: C.navy, head: { kind: "cap", c: C.grey } })
  ];
  return { parts, people: crowd(people, 3) };
};

const carnivalWorkshop: Venue = o => {
  const feather = (x: number, z: number, a: string, b: string, c: string, h = 1.7): Part[] => [
    cyl(x, 0, z, 0.05, h, "#3d3d3d"), { k: "disc", x, y: h + 0.5, z: z - 0.05, r: 0.95, c: a }, { k: "disc", x, y: h + 0.5, z: z - 0.1, r: 0.62, c: b }, { k: "disc", x, y: h + 0.5, z: z - 0.15, r: 0.3, c }
  ];
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#bba98a"),
    wall(-10, 3.5, 4.4, o.pick(["#7a8a8f", "#8a7a6f", "#6f8a7a", "#8f7a8a"])), ...Array.from({ length: 17 }, (_, i) => panel(-9.6 + i * 0.8, 0, 0.08, 4.4, "#6d7c80", 0.1)),
    panel(-4, 0, 7.6, 3.2, "#2b2520", 0.12),
    ...[0, 1, 2, 3].map(i => box(-7.1 + i * 2.1, 3.3, FRONT - 0.9, 2.1, 0.14, 1.8, o.pick(["#d65a4a", "#e9c74a", "#2a8f8a", "#7a4aa0", "#3b6aa6", "#d3772c"]))),
    ...feather(-6.9, FRONT - 0.5, "#efb62f", "#d65a4a", "#2f8f5b"), ...feather(-5.3, FRONT - 0.5, "#3a83a6", "#f2e3c0", "#a44374"), ...feather(-3.7, FRONT - 0.5, "#a44374", "#efb62f", "#3a83a6"), ...feather(-2.1, FRONT - 0.5, "#2f8f5b", "#d65a4a", "#efb62f"),
    ...feather(-9.2, 2.4, "#d65a4a", "#efb62f", "#7a4aa0", 1.4),
    sign(o.name, -4, 4.05, 7.2, o.pick(["#7e3850", "#2f5a7a", "#5a2f7a", "#7a5a2f"]), "#fff8df", FRONT - 0.06, 0.65),
    box(-8.7, 0, 2.3, 1.1, 0.8, 0.6, "#5a5f63"), box(-8.5, 0.85, 2.3, 0.28, 0.28, 0.28, "#fff4c0", { neon: "#ffb347", ph: 1 }),
    ...bunting(-7.0, -0.9, 3.3, FRONT - 1.75, ["#efb62f", "#d65a4a", "#2a8f8a", "#7a4aa0"]),
    panel(2.75, 0.7, 1.4, 2.4, "#e9e2cf", 0.08), panel(2.75, 1.1, 1.1, 1.6, "#a44374", 0.12), panel(2.75, 2.0, 1.1, 0.5, "#efb62f", 0.14),
    ...o.tree(8.8, 3.6, 6), lamp(o.j(-6.0), 2.5), lamp(o.j(5.0), 2.5)
  ];
  const people = [
    stand(-1.6, 2.2, toward(-1.6, 2.2, -2.9, 2.3), { top: C.purple, skirt: C.gold, head: { kind: "wrap", c: C.orange }, prop: { kind: "bag", c: C.red } }),
    pace(-9.6, 1.5, -6.0, 1.6, 6, { top: C.red, skirt: C.gold, head: { kind: "wrap", c: C.pink } }),
    stand(-7.6, 2.3, toward(-7.6, 2.3, -8.6, 2.3), { top: C.grey, bottom: C.grey, head: { kind: "cap", c: C.black } }),
    stand(6.4, 2.5, toward(6.4, 2.5, 7.4, 2.5), { top: C.blue, bottom: C.black, prop: { kind: "drum", c: "#8a5a2f" } }),
    stand(7.4, 2.5, toward(7.4, 2.5, 6.4, 2.5), { top: C.orange, skirt: C.green, head: { kind: "wrap", c: C.gold } })
  ];
  return { parts, people: crowd(people, 1) };
};

// ---- Hospitality ----

const hotel: Venue = o => {
  const A = -4.5, sand = o.pick(["#e3d6bd", "#e8dcc8", "#d8d2c0", "#e0d0b8"]), canopy = o.pick(["#2f5f73", "#6f2f3a", "#2f5a3a", "#4a3a6f"]);
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#c9c1ac"),
    wall(-11, 5, 6.9, sand), panel(-3, 2.95, 16, 0.14, "#cdbf9f", 0.9), panel(-3, 4.35, 16, 0.14, "#cdbf9f", 0.9),
    ...windows([-9.6, -7.6, -5.6, -3.6, -1.6, 0.4, 2.4], 3.25, 1.0, 1.0, "#6f93a3", "#f4ecd9", WARM), ...windows([-9.6, -7.6, -5.6, -3.6, -1.6, 0.4, 2.4], 4.65, 1.0, 1.0, "#6f93a3", "#f4ecd9", WARM),
    panel(-9.0, 0.6, 3.0, 2.4, "#f4ecd9", 0.1), panel(-9.0, 0.7, 2.6, 2.2, "#7fa7b6", 0.14, { lit: WARM }),
    ...door(A, 2.6, 2.7, o.pick(["#35505c", "#4a3a2f", "#2f3a4a"]), "#f4ecd9", WARM),
    box(A, 3.0, FRONT - 0.8, 5.2, 0.22, 1.6, canopy), cyl(A - 2.4, 0, FRONT - 1.5, 0.1, 3.0, "#e9e2cf"), cyl(A + 2.4, 0, FRONT - 1.5, 0.1, 3.0, "#e9e2cf"),
    sign(o.name, -3, 6.2, 8.4, canopy, "#fff8df", FRONT - 0.06, 0.8),
    ...palm(7.2, 3.4, 5), ...palm(-12.2, 2.6, 5), shrub(-1.0, 2.9, 0.5), shrub(-8.2, 2.9, 0.5),
    box(-8.2, 0.12, 2.0, 1.0, 0.1, 0.6, "#b8953f"), box(-8.4, 0.25, 2.0, 0.5, 0.4, 0.4, "#6b4a30"), box(-7.9, 0.25, 2.0, 0.4, 0.3, 0.4, "#2f4a7a"), box(-8.2, 0.9, 2.0, 0.05, 0.9, 0.05, "#b8953f"),
    lamp(o.j(-1.5), 2.2), lamp(o.j(5.0), 2.5)
  ];
  const people = [
    stand(A + 3.0, 2.0, fwd, { top: C.maroon, bottom: C.maroon, head: { kind: "cap", c: C.maroon } }),
    pace(-11.0, 1.7, -6.9, 1.8, 14, { top: C.blue, bottom: C.black, prop: { kind: "bag", c: C.brown } }),
    stand(-7.4, 2.4, toward(-7.4, 2.4, -8.2, 2.1), { top: C.maroon, bottom: C.maroon, head: { kind: "cap", c: C.maroon } }),
    stand(6.6, 2.5, toward(6.6, 2.5, 7.6, 2.5), { top: C.pink, skirt: C.navy, head: { kind: "wrap", c: C.pink }, prop: { kind: "bag", c: C.black } }),
    stand(7.6, 2.5, toward(7.6, 2.5, 6.6, 2.5), { top: C.cream, bottom: C.khaki }),
    pace(10.0, 1.8, 6.1, 1.9, 16, { top: C.teal, skirt: C.teal, head: { kind: "wrap", c: C.white } }, 1.1)
  ];
  return { parts, people: crowd(people, 2) };
};

const restaurant: Venue = o => {
  const A = -3, stripe = o.pick(["#8f3d32", "#2f5a7a", "#2f6a3a", "#6a3a7a", "#c9863a"]), wallC = o.pick(["#d98d57", "#d9a05a", "#c9a07a", "#d98a6a"]);
  const awning = (i: number) => box(-9.2 + i * 1.1, 3.0, FRONT - 0.85, 1.1, 0.13, 1.7, i % 2 ? "#f2e3c0" : stripe);
  const table = (x: number, z: number, umbrella: string): Part[] => [
    cyl(x, 0, z, 0.06, 0.7, "#4c382a"), cyl(x, 0.7, z, 0.5, 0.05, "#68472f"),
    box(x - 0.75, 0, z, 0.4, 0.5, 0.4, "#a8592f"), box(x + 0.75, 0, z, 0.4, 0.5, 0.4, "#a8592f"),
    cyl(x, 0, z + 0.4, 0.04, 2.4, "#bdbdbd"), ball(x, 2.4, z + 0.4, 1.1, umbrella, 0.25)
  ];
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#c4b89a"),
    wall(-10, 2.5, 4.2, wallC), ...Array.from({ length: 12 }, (_, i) => awning(i)),
    ...door(A, 1.9, 2.6, "#5a3a22", "#f2e3c0", WARM), ...windows([-7.4, -5.4], 1.3, 1.5, 1.4, "#7a9aa6", "#f2e3c0", WARM),
    panel(-0.7, 1.0, 0.9, 1.3, "#2a3a33", 0.1), panel(-0.7, 1.1, 0.6, 0.1, "#f2e3c0", 0.14), panel(-0.7, 1.4, 0.6, 0.1, "#f2e3c0", 0.14),
    sign(o.name, -3.5, 3.8, 6.4, stripe, "#fff8df", FRONT - 0.06, 0.7),
    ...Array.from({ length: 12 }, (_, i) => box(-9.4 + i * 0.8, 2.75, FRONT - 1.6, 0.14, 0.14, 0.14, "#d9d2c0", { lit: "#ffe9a8" })),
    box(-8.0, 4.2, FRONT + 1.5, 0.8, 1.8, 0.8, "#7a4a38"), { k: "puff", x: -8.0, y: 6.1, z: FRONT + 1.5, r: 0.35, c: "#e8e8e8" },
    ...table(o.j(-8.4), 2.1, o.pick(["#d65a4a", "#e9c74a", "#2a8f8a", "#7a4aa0"])), ...table(o.j(-6.4), 2.4, o.pick(["#e9c74a", "#d65a4a", "#3b6aa6"])), ...table(o.j(5.8), 2.4, o.pick(["#2a8f8a", "#d3772c", "#c46a8d"])), ...table(o.j(7.9), 2.1, o.pick(["#d65a4a", "#e9c74a", "#2f8f5b"])),
    ...o.tree(10, 3.6, 6), lamp(o.j(-10.2), 2.4), lamp(o.j(4.8), 2.6)
  ];
  const people = [
    stand(A + 1.7, 2.3, fwd, { top: C.white, bottom: C.black, head: { kind: "cap", c: C.white } }),
    pace(-10.0, 1.6, -5.2, 1.7, 9, { top: C.red, bottom: C.black, prop: { kind: "tray", c: "#c9c9c9" } }),
    stand(-7.4, 2.1, toward(-7.4, 2.1, -8.4, 2.1), { top: C.orange, skirt: C.brown, head: { kind: "wrap", c: C.orange } }),
    stand(-9.4, 2.1, toward(-9.4, 2.1, -8.4, 2.1), { top: C.blue, bottom: C.black }),
    stand(6.8, 2.3, toward(6.8, 2.3, 7.9, 2.1), { top: C.purple, skirt: C.purple, head: { kind: "wrap", c: C.gold } }),
    stand(9.0, 2.1, toward(9.0, 2.1, 7.9, 2.1), { top: C.green, bottom: C.grey }),
    pace(10.0, 1.7, 6.1, 1.8, 10, { top: C.maroon, bottom: C.black, prop: { kind: "tray", c: "#c9c9c9" } }, 1.5)
  ];
  return { parts, people: crowd(people, 0) };
};

const nightclub: Venue = o => {
  const A = -3, pink = o.pick(["#ff3fb4", "#ff6a3f", "#a63fff", "#3fff9a"]), cyan = o.pick(["#3fd0ff", "#ffd03f", "#3f9aff", "#ff3f6a"]), pinkText = o.pick(["#ff7bd5", "#ffb27b", "#d57bff", "#7bffb2"]);
  const parts: Part[] = [
    pave(-14, 14, -1.2, FRONT, "#9c968c"),
    wall(-9, 3, 5.0, o.pick(["#2a2540", "#2a3040", "#3a2a40", "#2a2a2a"])),
    panel(-3, 4.45, 5.6, 0.14, pink, 0.1, { neon: pink, ph: 0.5 }), panel(-3, 4.15, 4.4, 0.12, cyan, 0.1, { neon: cyan, ph: 2.1 }),
    ...door(A, 2.2, 2.8, "#1b1730", "#3a3358"),
    panel(A - 1.45, 0, 0.12, 3.1, cyan, 0.14, { neon: cyan, ph: 3.3 }), panel(A + 1.45, 0, 0.12, 3.1, cyan, 0.14, { neon: cyan, ph: 3.3 }), panel(A, 3.05, 3.0, 0.12, cyan, 0.14, { neon: cyan, ph: 3.3 }),
    sign(o.name, A, 3.65, 5.4, "#120f22", pinkText, FRONT - 0.06, 0.7),
    ...[-8.3, -7.1, -5.9, -4.7].flatMap(x => [cyl(x, 0, 2.2, 0.05, 0.95, "#c9a24a"), ball(x, 1.0, 2.2, 0.08, "#c9a24a")]),
    ...[-8.3, -7.1, -5.9].map(x => box(x + 0.6, 0.8, 2.2, 1.2, 0.05, 0.05, "#a01830")),
    box(4.4, 0, 2.6, 1.0, 1.6, 0.8, "#15151a"), box(5.6, 0, 2.6, 1.0, 1.2, 0.8, "#15151a"),
    ...o.tree(8.6, 3.6, 6), lamp(o.j(-9.6), 2.4, 3.0), lamp(o.j(5.0), 2.6, 3.0)
  ];
  const people = [
    stand(A + 1.9, 2.3, fwd, { top: C.black, bottom: C.black }),
    stand(-7.9, 2.2, toward(-7.9, 2.2, A - 1.0, 2.3), { top: C.pink, skirt: C.black, head: { kind: "wrap", c: C.pink } }),
    stand(-6.7, 2.2, toward(-6.7, 2.2, A - 1.0, 2.3), { top: C.purple, bottom: C.black }),
    stand(-5.5, 2.2, toward(-5.5, 2.2, A - 1.0, 2.3), { top: C.orange, skirt: C.maroon, head: { kind: "wrap", c: C.gold } }),
    pace(10.0, 1.7, 6.2, 1.8, 11, { top: C.white, bottom: C.black, prop: { kind: "tray", c: "#c9c9c9" } }),
    stand(-9.6, 2.8, toward(-9.6, 2.8, -8.0, 2.2), { top: C.teal, bottom: C.black })
  ];
  return { parts, people: crowd(people, 3), ground: "#6e5a4a" };
};

export const VENUES: Readonly<Record<string, Venue>> = {
  church, mosque, sacred_grove: sacredGrove,
  police_station: policeStation, hospital, community_hall: communityHall, traditional_council: traditionalCouncil, emir_palace: emirPalace, palace,
  museum, library, university, monument, radio_station: radioStation, carnival_workshop: carnivalWorkshop,
  hotel, restaurant, nightclub
};

/** The most people on screen: a lighter scene shows fewer. */
export const crowdLimit = (light: boolean) => (light ? 4 : 8);

// ---- Seeded variety: the same venue looks a little different for every account ----

const CLOTH = ["#3b6aa6", "#2f7a52", "#d3772c", "#6b4a92", "#b8483b", "#c46a8d", "#26767a", "#7e2f3e", "#d1a43a", "#6b4a30", "#a8602c", "#3f5fa8", "#4a7a2f", "#8a3d8f"];
/** Colours that are clothes people choose; whites, navy, black, grey and khaki are uniforms and stay as they are. */
const CHOSEN = new Set(["#3b6aa6", "#2f7a52", "#d3772c", "#6b4a92", "#b8483b", "#c46a8d", "#26767a", "#7e2f3e", "#d1a43a", "#6b4a30"]);
const BAGS = ["#6b4a30", "#a8362e", "#2f4a7a", "#3b3f46", "#c9a24a", "#2f6a52", "#7a4aa0"];

function varyPeople(people: readonly Person[], ctx: Ctx, r: () => number): Person[] {
  return people.map(p => {
    const swaps = new Map<string, string>();
    const recolour = (c: string) => {
      if (!CHOSEN.has(c)) return c;
      if (!swaps.has(c)) swaps.set(c, ctx.pick(CLOTH));
      return swaps.get(c)!;
    };
    const dx = (r() - 0.5) * 0.5, dz = (r() - 0.5) * 0.3;
    return {
      ...p,
      x: p.x + dx, z: p.z + dz,
      to: p.to ? ([p.to[0] + dx, p.to[1] + dz] as const) : undefined,
      period: p.period ? p.period * (0.85 + r() * 0.3) : undefined,
      phase: (p.phase ?? 0) + r() * 2,
      top: recolour(p.top), bottom: recolour(p.bottom), skirt: p.skirt ? recolour(p.skirt) : undefined,
      head: p.head ? { ...p.head, c: recolour(p.head.c) } : undefined,
      prop: p.prop?.kind === "bag" ? { ...p.prop, c: ctx.pick(BAGS) } : p.prop
    };
  });
}

type Extra = (x: number, z: number, ctx: Ctx) => Part[];
/** Small things left by the kerb: a motorbike, a bicycle, parcels, a planter... each at most 1.2 m high and half a metre deep or so. */
const EXTRAS: readonly Extra[] = [
  (x, z, o) => {
    const c = o.pick(["#c8372d", "#2f5a9a", "#3b3f46", "#2f7a52", "#d3772c"]);
    return [box(x, 0.45, z, 1.2, 0.3, 0.3, c), box(x - 0.1, 0.75, z, 0.6, 0.12, 0.3, "#26292c"), box(x + 0.6, 0.9, z, 0.08, 0.5, 0.45, "#9aa0a4"), { k: "disc", x: x - 0.5, y: 0.33, z: z - 0.17, r: 0.33, c: "#1b1d20" }, { k: "disc", x: x + 0.5, y: 0.33, z: z - 0.17, r: 0.33, c: "#1b1d20" }];
  },
  (x, z, o) => {
    const c = o.pick(["#3b6aa6", "#b8483b", "#2f7a52", "#26292c"]);
    return [{ k: "disc", x: x - 0.45, y: 0.35, z: z - 0.05, r: 0.35, c: "#26292c" }, { k: "disc", x: x + 0.45, y: 0.35, z: z - 0.05, r: 0.35, c: "#26292c" }, box(x, 0.55, z, 0.9, 0.05, 0.05, c), box(x + 0.3, 0.8, z, 0.05, 0.5, 0.05, c)];
  },
  (x, z, o) => [box(x, 0, z, 0.8, 0.5, 0.6, o.pick(["#c9a24a", "#b08a5a", "#9a7a5a"])), box(x + 0.1, 0.5, z, 0.6, 0.4, 0.5, o.pick(["#d9c9a0", "#a8b0b8", "#c98a5a"])), box(x - 0.9, 0, z, 0.6, 0.4, 0.5, o.pick(["#b08a5a", "#7a8a9a"]))],
  (x, z, o) => [box(x, 0.1, z, 1.2, 0.5, 0.45, o.pick(["#8a5a3a", "#7a7a7a", "#c9a24a"])), shrub(x - 0.3, z, 0.38, o.pick(["#3b7a44", "#4a8a4a"])), shrub(x + 0.3, z, 0.34, o.pick(["#3b7a44", "#c9503f", "#e0b23a"]))],
  (x, z, o) => [box(x, 0, z, 0.9, 1.0, 0.1, o.pick(["#f2e3c0", "#2a3a33", "#e9c74a"])), box(x - 0.35, 0, z, 0.06, 0.8, 0.3, "#5a4a3a"), box(x + 0.35, 0, z, 0.06, 0.8, 0.3, "#5a4a3a")],
  (x, z, o) => [ball(x, 0.4, z, 0.38, o.pick(["#a8602c", "#8a5a3a", "#b8764a"]), 1), cyl(x, 0.7, z, 0.14, 0.2, o.pick(["#a8602c", "#8a5a3a"]), 0.18), ball(x + 0.8, 0.35, z, 0.3, o.pick(["#a8602c", "#8a5a3a"]), 1)],
  (x, z) => [cyl(x, 0, z, 0.2, 0.6, "#e07a2a", 0.05), box(x, 0, z, 0.5, 0.04, 0.5, "#3b3f46"), cyl(x + 0.8, 0, z, 0.2, 0.6, "#e07a2a", 0.05)],
  (x, z, o) => [cyl(x, 0, z, 0.3, 0.8, o.pick(["#2f7a52", "#3b6aa6", "#6b6f75"]), 0.28)],
  (x, z, o) => [ball(x, 0.25, z, 0.35, o.pick(["#d9c9a0", "#c9b48a", "#bfae90"]), 0.7), ball(x + 0.6, 0.22, z + 0.05, 0.3, o.pick(["#d9c9a0", "#c9b48a"]), 0.7), ball(x + 0.3, 0.5, z, 0.3, o.pick(["#d9c9a0", "#c9b48a"]), 0.7)]
];

/** The venue's scenery, people and the lamps that give light after dark. Unknown ids fall back to the church so a bad id never leaves a bare lane. */
export function layoutFor(variant: string, input: Input): Layout {
  const build = VENUES[variant] ?? church;
  const seed = ((input.seed ?? 0) ^ hashOf(input.name)) >>> 0 || 1;
  const r = seededRandom(seed);
  const ctx: Ctx = {
    ...input,
    pick: options => options[Math.floor(r() * options.length) % options.length]!,
    j: (x, amount = 0.3) => x + (r() - 0.5) * 2 * amount,
    chance: p => r() < p,
    tree: (x, z, h) => tree(x + (r() - 0.5) * 1.2, z + (r() - 0.5) * 0.8, h * (0.85 + r() * 0.35), ["#2f6b3a", "#3a7a3a", "#2a5f3a", "#4a7a3a"][Math.floor(r() * 4) % 4]!)
  };
  const v = build(ctx);

  // One to three things at the kerb, none repeated, on the outer sides where nobody walks or is filmed.
  const extras: Part[] = [];
  const order = [...EXTRAS];
  for (let i = order.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [order[i], order[k]] = [order[k]!, order[i]!]; }
  const count = input.light ? 1 : 1 + Math.floor(r() * 3);
  const startLeft = r() < 0.5;
  for (let i = 0; i < count; i++) {
    const left = (i % 2 === 0) === startLeft;
    extras.push(...order[i]!(left ? -12.2 + r() * 2.2 : 8.2 + r() * 2.4, 0.7 + r() * 0.2, ctx));
  }

  const parts = [...v.parts, ...extras, ...farTrees(seed, input.light)];
  const lampLights = parts.filter(p => p.k === "lamp").map(p => [p.x, p.z] as const);
  return { parts, people: varyPeople(v.people, ctx, r).slice(0, crowdLimit(input.light)), ground: v.ground ?? "#a35f38", lampLights };
}

export const BUILDING_IDS = Object.keys(VENUES);
