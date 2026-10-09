// Where things stand at the transport hubs that share one scenery set: the motor park, the railway station and the airport (set id
// `transport_hub`). Pure data, read by both renderers. The lane in front is already the road; everything here stands behind it, and the
// cone behind the witness (x about -4 to 1 at z 5, drifting left further back) is kept to plain, large shapes.
import { type Layout, type Prop, awning, ball, box, cyl, cylx, cylz, floodlight, gantry, glow, lampPost, minibus, nameOf, pick, rng, skyline, sign, standing, stroller, table, variate } from "./layout-open-air-kit.ts";

const PI = Math.PI;
const BUS_COLOURS = ["#f2b705", "#f2b705", "#f2b705", "#e8e2cf", "#2f8f5b", "#d9822b", "#2e6f8f"];
const BOARDS = ["ABUJA - KANO\nENUGU - IBADAN", "LAGOS - BENIN\nASABA - OWERRI", "KADUNA - JOS\nMINNA - ILORIN", "OSOGBO - AKURE\nABEOKUTA - IFE"];

const bag = (x: number, z: number, c: string, s = 1): Prop => box(x, 0, z, 0.5 * s, 0.4 * s, 0.28 * s, c);

function motorPark(name: string, r: () => number): Layout {
  // Buses park differently every time: which spaces are taken, which way they face, what colour they are.
  const row = (xs: readonly number[], z: number, keep: number): Prop[] => xs.flatMap(x => (r() < keep ? minibus(x + (r() - 0.5), z, r() < 0.5 ? 1 : -1, pick(r, BUS_COLOURS), true, r() < 0.7) : []));
  const kioskX = pick(r, [5.6, 5.6, 12.4]), awnA = pick(r, [["#2e6f8f", "#d9822b"], ["#7a4aa0", "#f4ecd8"], ["#2f8f5b", "#f2c14e"]] as const), awnB = pick(r, [["#b5483a", "#f4ecd8"], ["#26336b", "#f2c14e"], ["#d9822b", "#f4ecd8"]] as const);
  const out: Prop[] = [
    ...skyline(21, ["#8c8579", "#a8a091", "#7a8a8f", "#b3a58a"], 44), ...gantry(0, 0.9, 9, 1.15, 4.7, name, pick(r, ["#1f4a7a", "#176b4d", "#5a2a22"]), "#fff8e6", "#3a3d40"),
    // Rows of parked minibuses, kept off the middle so the witness has a plain backdrop.
    ...row([-13, -7.6, 3.8, 9.6], 8.2, 0.92), ...row([-12, 3, 9.5], 12.8, 0.8),
    // Patched awnings over the waiting areas, with benches and luggage.
    ...awning(-9.5, 4.8, 5, 3, 2.6, awnA[0], awnA[1], 6), ...(r() < 0.85 ? awning(10, 4.8, 4.4, 3, 2.6, awnB[0], awnB[1], 6) : []),
    box(-10.5, 0, 4.9, 2.6, 0.45, 0.5, "#6e5230"), box(10, 0, 4.9, 2.4, 0.45, 0.5, "#6e5230"),
    bag(-8.8, 4.2, "#2e6f8f"), bag(-8.2 + r() * 0.6, 4.35, "#b5483a", 1.2), ball(-7.4, 0, 4.3, 0.6, "#c9b48a", { sy: 0.8 }), bag(8.8, 4.2, "#7a4aa0"), bag(11.5, 4.3, "#2f8f5b", 1.1),
    // A ticket kiosk, a destinations board and a generator.
    box(kioskX, 0, 4.6, 2.2, 2.4, 1.8, "#2f6b8f"), box(kioskX, 2.4, 4.6, 2.8, 0.18, 2.3, "#3a3d40"), box(kioskX, 1.1, 3.69, 1.3, 0.7, 0.04, "#15191c"),
    sign(kioskX, 1.7, 3.66, 1.8, 0.5, "TICKETS", "#f2b705", "#15191c"),
    cyl(-6.6, 0, 4.2, 0.12, 2.2, "#3a3d40"), cyl(-3.6, 0, 4.2, 0.12, 2.2, "#3a3d40"),
    sign(-5.05, 2.2, 4.1, 3.4, 1.3, pick(r, BOARDS), pick(r, ["#176b4d", "#1f4a7a", "#4a2a5a"]), "#fff8e6"),
    box(13.4, 0, 4.8, 1.1, 0.8, 0.7, "#b5483a"), cyl(13.0, 0.8, 4.8, 0.1, 0.5, "#3a3d40"),
    // A mechanic's corner: stacked tyres and oil drums, in some visits.
    ...(r() < 0.6 ? [...[0, 1, 2, 3].map(i => cyl(-14.2, i * 0.26, 5.6, 0.9, 0.25, "#15191c")), ...[0, 1].map(i => cyl(-15.4 + i * 0.7, 0, 5.8, 0.6, 0.9, i ? "#b5483a" : "#2e6f8f"))] : [box(-14.5, 0, 5.6, 1.6, 1.0, 1.0, "#6e5230"), box(-14.5, 1.0, 5.6, 1.2, 0.6, 0.8, "#8a6a3a")]),
    ...lampPost(-4.6, 3.7), ...lampPost(6.8, 3.4)
  ];
  return {
    ground: "#8a6f52", props: out,
    people: [stroller(-10, 3.5, 51, -13, 13, 0.7), standing(-8.6, 3.9, PI * 0.8, 52), standing(-7.2, 3.8, PI, 53), standing(8.2, 3.8, PI, 54), stroller(4, 3.6, 55, -13, 13, -0.6), standing(11.2, 3.8, PI * 1.2, 56), standing(-11.8, 6.2, PI * 0.6, 57), standing(7.3, 6.8, -PI * 0.5, 58)],
    lamps: [{ x: 1.2, y: 3, z: 0.8, c: "#ffd9a0" }, { x: -2.5, y: 3, z: 2, c: "#ffd9a0" }]
  };
}

/** The train slides in from the left over the first seconds and stops. */
const ROLL = { vx: 1.0, until: 8 };

function station(name: string, r: () => number): Layout {
  // The train rolls in over the first seconds or is already standing; it has two or three carriages and its own livery.
  const rolling = r() < 0.7, roll = rolling ? { m: ROLL } : {}, cars = 2 + (r() < 0.5 ? 1 : 0), loco = pick(r, ["#1f6f5c", "#8a3a2a", "#2a4a7a", "#4a4a52"]), coach = pick(r, ["#2e6f8f", "#d9d4c4", "#b5483a", "#2f8f5b"]), cart = r() < 0.5;
  const car = (x: number, c: string): Prop[] => [
    box(x, 0.5, 12.4, 11.2, 3.2, 2.8, c, roll), box(x, 0.1, 12.4, 10.6, 0.5, 2.2, "#22262a", roll), box(x, 0.6, 10.99, 11.2, 0.22, 0.03, "#1f6f5c", roll),
    box(x, 1.9, 10.99, 9.6, 0.85, 0.03, "#27414f", roll), box(x, 3.7, 12.4, 10.8, 0.12, 2.2, "#8a8f94", roll)
  ];
  const trainX = rolling ? -6.5 : 1.5;
  const out: Prop[] = [
    ...skyline(22, ["#8c8579", "#a8a091", "#7a8a8f"], 46, 26, 9),
    // The station building, with the name over its door and a clock.
    box(-7.5, 0, 7.6, 11, 4.2, 5, "#c9b68f"), box(-7.5, 4.2, 7.6, 11.8, 0.35, 5.8, "#7a3a2e"), box(-7.5, 0, 4.95, 1.8, 2.5, 0.06, "#3a2a1c"),
    sign(-7.5, 3.05, 4.93, 6.6, 1.0, name, "#1f4a3a", "#f4ecd8"), cylz(-2.9, 3.0, 4.93, 0.9, 0.1, "#f4ecd8"), box(-2.9, 3.45, 4.9, 0.05, 0.3, 0.02, "#222222"), box(-2.78, 3.5, 4.9, 0.25, 0.05, 0.02, "#222222"),
    ...[-11, -5].map(x => box(x, 1.1, 4.94, 1.3, 1.3, 0.05, "#35607a")),
    // The platform, its yellow edge, canopy and furniture.
    box(5, 0, 7.6, 34, 0.9, 4.4, "#aaa49a"), box(5, 0.9, 5.65, 34, 0.02, 0.18, "#f2c14e"),
    box(14, 3.6, 7.6, 16, 0.18, 3.6, "#5b6a72"), ...[7.5, 14, 20.5].flatMap(x => [6.1, 9.1].map(z => cyl(x, 0.9, z, 0.2, 2.7, "#4a4e52"))),
    box(12, 0.9, 9.5, 2.2, 0.45, 0.5, "#6e5230"), box(-3, 0.9, 9.5, 2.2, 0.45, 0.5, "#6e5230"),
    sign(9.4, 1.9, 5.7, 3.2, 1.2, "DEPARTURES\nABUJA 08:40  ON TIME", "#15191c", "#f2c14e"), cyl(7.9, 0.9, 5.8, 0.1, 1.0, "#3a3d40"), cyl(10.9, 0.9, 5.8, 0.1, 1.0, "#3a3d40"),
    cyl(14.2, 0.9, 6.0, 0.1, 2.6, "#3a3d40"), cyl(14.2, 2.5, 6.0, 0.5, 0.45, "#c9a23c", { w2: 0.2 }),
    // The track: ballast, rails and sleepers, and the train rolling in.
    box(0, 0, 12.4, 70, 0.14, 3.4, "#6b645a"), box(0, 0.14, 11.8, 70, 0.1, 0.1, "#8a8f94"), box(0, 0.14, 13.0, 70, 0.1, 0.1, "#8a8f94"),
    ...Array.from({ length: 24 }, (_, i) => box(-28 + i * 2.4, 0.14, 12.4, 0.28, 0.08, 2.3, "#4a3a2a", { hi: true })),
    box(trainX + 6.5, 0.5, 12.4, 8.6, 4.0, 2.8, loco, roll), box(trainX + 9.5, 4.5, 12.4, 2.6, 0.6, 2.4, loco, roll), box(trainX + 6.5, 0.1, 12.4, 8.2, 0.5, 2.2, "#22262a", roll),
    box(trainX + 10.0, 2.4, 10.99, 1.4, 0.9, 0.03, "#27414f", roll), box(trainX + 6.5, 1.2, 10.99, 8.6, 0.12, 0.03, "#f2c14e", roll),
    box(trainX + 10.85, 1.0, 11.4, 0.1, 0.35, 0.4, "#fff4cf", { ...roll, glow: true }), glow(trainX + 11.0, 1.2, 11.2, 1.8, "#fff4cf", rolling ? { m: ROLL } : {}),
    ...Array.from({ length: cars }, (_, i) => car(trainX - 0.8 - i * 11.6, coach)).flat(),
    ...floodlight(-3.4, 6.4, 6.5), ...floodlight(21, 6.4, 6.5),
    // Porters' handcarts and bags on the forecourt.
    box(-4.2, 0.45, 4.4, 1.3, 0.1, 0.7, "#6e5230"), ...[-1, 1].map(s => cylz(-4.2 + s * 0.45, 0.0, 4.0, 0.6, 0.06, "#2a2f33")), bag(-4.4, 4.4, "#2e6f8f"), bag(-3.9, 4.45, "#b5483a", 1.2),
    bag(7.8, 4.2, "#7a4aa0"), bag(8.3, 4.3, "#2f8f5b", 1.2),
    ...(cart ? [...table(8.6, 4.4, 1.6, 0.8), cyl(9.3, 0, 4.1, 0.07, 2.3, "#f4f4ee"), cyl(9.3, 2.2, 4.1, 2.8, 0.3, "#f2b705", { w2: 0.3 })] : []),
    ...lampPost(-6.2, 3.7)
  ];
  return {
    ground: "#9a8a70", props: out,
    people: [stroller(-8, 3.5, 61, -13, 13, 0.6), standing(-5.6, 4.1, PI * 0.7, 62), standing(8.8, 4.0, PI, 63), standing(11, 4.2, PI * 1.2, 64), stroller(6, 3.6, 65, -13, 13, -0.55), standing(-10.5, 4.4, PI * 0.5, 66), standing(14, 4.2, PI, 67), standing(-2, 4.3, -PI * 0.7, 68)],
    lamps: [{ x: 1.2, y: 3, z: 0.8, c: "#fff1c4" }, { x: -2.5, y: 3, z: 2, c: "#fff1c4" }]
  };
}

function airport(name: string, r: () => number): Layout {
  const wall = pick(r, ["#d8d5cc", "#e6e2d6", "#c9cdd0"]), tail = pick(r, ["#2f8f5b", "#2e6f8f", "#b5483a", "#7a4aa0"]), dx = (r() - 0.5) * 3, planeHere = r() < 0.8;
  const plane: Prop[] = [
    cylx(17 + dx, 0.9, 20, 17, 3.2, "#f2f2ee"), ball(25.6 + dx, 0.9, 20, 3.2, "#f2f2ee"), box(9.8 + dx, 3.4, 20, 3, 4.6, 0.4, tail), box(10.4 + dx, 2.7, 20, 2.4, 0.2, 6, "#e6e6e0"),
    box(17 + dx, 1.5, 12.0, 4, 0.3, 14, "#e0e0dc"), cylx(17 + dx, 0.2, 14.4, 2.4, 1.2, "#9aa0a3"), cylx(17 + dx, 0.2, 25.6, 2.4, 1.2, "#9aa0a3"),
    box(17 + dx, 2.7, 18.38, 15, 0.3, 0.02, "#27414f"), box(17 + dx, 2.0, 18.39, 16.5, 0.14, 0.02, tail)
  ];
  // Some visits the apron holds a fuel tanker and a baggage train instead of an aeroplane.
  const apron: Prop[] = [cylx(17, 0.8, 16, 6, 2.2, "#d8d5cc"), box(13.2, 0.7, 16, 1.8, 2.0, 2.2, "#2e6f8f"), box(21, 0, 14, 1.8, 1.1, 1.2, "#b5483a"), box(23.2, 0, 14, 1.8, 1.1, 1.2, "#2e6f8f"), box(25.4, 0, 14, 1.8, 1.1, 1.2, "#d9822b"), cylz(15, 0, 14.9, 1, 0.3, "#15191c"), cylz(19, 0, 14.9, 1, 0.3, "#15191c")];
  const trolleys = [5, 6.2, 7.4, 8.6, 9.8].slice(0, 3 + Math.floor(r() * 3));
  const trolley = (x: number): Prop[] => [box(x, 0.28, 5.2, 0.9, 0.05, 0.5, "#8a8f94"), box(x - 0.45, 0.28, 5.2, 0.05, 0.85, 0.5, "#8a8f94"), box(x, 0.32, 5.2, 0.8, 0.5, 0.05, "#aeb6bb", { hi: true }), cylz(x - 0.3, 0, 4.9, 0.25, 0.04, "#15191c", { hi: true })];
  const out: Prop[] = [
    ...skyline(23, ["#8c8579", "#9aa0a3"], 52, 20, 7),
    // The terminal: a plain pale wall for the witness's backdrop, a glass band lit warm after dark, and the name on the roof.
    box(-7, 0, 13, 27, 5, 7, wall), box(-7, 5, 13, 28, 0.4, 7.6, "#6b7075"), box(-7, 1.1, 9.47, 24, 2.3, 0.04, "#35607a"), box(-7, 1.1, 9.45, 24, 2.3, 0.02, "#ffe9b0", { night: true, glow: true }),
    sign(-7, 5.4, 9.5, 12, 1.5, name, pick(r, ["#1f4a7a", "#14394f", "#3a2a5a"]), "#ffffff"),
    // The check-in canopy with its desks and trolleys.
    box(-6, 3.4, 6.8, 18, 0.25, 3.4, "#f2f2ee"), ...[-14, -9, -4].flatMap(x => [5.3, 8.3].map(z => cyl(x, 0, z, 0.22, 3.4, "#aeb6bb"))),
    ...[-13.5, -11.5, -9.5].flatMap(x => [box(x, 0, 7.4, 1.5, 1.0, 0.7, "#4a5a6a"), box(x, 1.0, 7.4, 1.6, 0.06, 0.8, "#d8d5cc")]),
    sign(-11.5, 2.4, 8.1, 4.8, 0.8, "CHECK-IN", "#15191c", "#f2c14e"),
    ...trolleys.flatMap(trolley),
    bag(-2.2 - r(), 4.4, "#2e6f8f", 1.4), bag(-1.6 - r(), 4.5, "#b5483a", 1.2), bag(10.5 + r() * 2, 4.4, "#2f8f5b", 1.3), bag(11.2 + r() * 2, 4.5, "#7a4aa0", 1.1),
    // The apron: a control tower and a parked aeroplane.
    cyl(18, 0, 30, 2.4, 14, "#d8d5cc", { w2: 1.9 }), box(18, 14, 30, 4.6, 2.2, 4.6, "#35607a"), box(18, 14, 29.65, 4.6, 2.2, 0.02, "#ffe9b0", { night: true, glow: true }), box(18, 16.2, 30, 5.2, 0.3, 5.2, "#6b7075"),
    ...(planeHere ? plane : apron),
    box(14, 0.02, 11.5, 40, 0.01, 0.18, "#e0b23a"),
    ...floodlight(12, 7.5, 8), ...floodlight(-19.5, 7.5, 8), ...lampPost(-4.6, 3.7)
  ];
  return {
    ground: "#8f9296", props: out,
    people: [stroller(-9, 3.5, 71, -13, 13, 0.6), standing(-2.6, 4.3, PI * 0.7, 72), standing(10.2, 4.0, PI, 73), standing(-12.4, 6.0, 0, 74), stroller(6, 3.6, 75, -13, 13, -0.55), standing(11.6, 4.1, PI * 1.1, 76), standing(-8, 6.4, PI * 0.2, 77), standing(-14.6, 6.4, -PI * 0.1, 78)],
    lamps: [{ x: 1.2, y: 3, z: 0.8, c: "#fff1c4" }, { x: -2.5, y: 3, z: 2, c: "#fff1c4" }]
  };
}

/** The layout for a transport variant; an unknown variant shows the motor park. */
export function transportLayout(variant: string, venueName: string, seed = 0): Layout {
  const name = nameOf(venueName || variant.replace(/_/g, " ")), r = rng(seed);
  return variate(variant === "railway_station" ? station(name, r) : variant === "airport" ? airport(name, r) : motorPark(name, r), seed);
}
