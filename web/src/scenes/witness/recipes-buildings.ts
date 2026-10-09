// Recipes for the buildings: religious, civic, cultural, learning and hospitality venues (Agent2's venues; see docs/agents/Agent2.md).
// Each entry is keyed by the venue id in data/exports/witness-location-scenes.json. Witnesses wear what people in that place wear (a
// uniform, scrubs, a robe), modestly, and differ in age, build and voice; their names and the venue names are fictional.
import { type VenueRecipe, look } from "./recipe-kit.ts";

type Sound = VenueRecipe["sound"];
/** A witness: role, "f" or "m" (the avatar's presentation), and the uniform's main, second and accent colours. */
type Role = readonly [label: string, who: "f" | "m", primary: string, secondary: string, accent: string];

const BODIES = {
  f: [["#6e4630", "head_wrap", "#20150f", 210], ["#8a5a3c", "braided_bun", "#1b120e", 224], ["#5a3a28", "bob", "#17100c", 218], ["#a06a45", "shoulder_twists", "#22160f", 205]],
  m: [["#503425", "low_cut", "#120d0a", 112], ["#9a6745", "fade", "#100b09", 124], ["#704735", "short_coils", "#14100d", 108], ["#3e251d", "close_crop", "#0e0a08", 118]]
} as const;

const recipe = (id: string, set: string, roles: readonly [Role, Role, Role, Role], sound: Sound): VenueRecipe => ({
  id, set, variant: id, sound,
  witnesses: roles.map(([label, who, primary, secondary, accent], i) => {
    const [skin, hair, hairColor, pitch] = BODIES[who][(i + id.length) % 4]!;
    return look(`w-${id}-${i + 1}`, label, who === "f" ? "feminine" : "masculine", skin, hair, hairColor, primary, secondary, accent, pitch);
  })
});

const quiet = (extras: Sound["extras"] = []): Sound => ({ crowd: 0.24, calls: 0.08, hum: 0.12, clinks: 0.08, extras });
const busy = (hum = 0.35): Sound => ({ crowd: 0.52, calls: 0.18, hum, clinks: 0.2 });

export const BUILDING_RECIPES: Readonly<Record<string, VenueRecipe>> = {
  church: recipe("church", "worship", [
    ["Pastor", "m", "#2b2b33", "#f2f2f2", "#7a2f3a"], ["Usher", "f", "#f4f1e6", "#d8cfb8", "#2f5a7a"], ["Choir member", "f", "#6b2f7a", "#f0e2b0", "#d1a43a"], ["Church elder", "m", "#4a3a2a", "#e8dfc8", "#8a6a3a"]
  ], quiet([{ kind: "tone", freq: 196, every: 6, length: 1.4, level: 0.16, shape: "sine" }])),
  mosque: recipe("mosque", "worship", [
    ["Imam", "m", "#f4f1e6", "#e0d6bc", "#2f6a52"], ["Teacher", "f", "#2f6a7a", "#f0ebde", "#d1a43a"], ["Attendant", "m", "#e8dcc0", "#bfa97a", "#2f6a52"], ["Worshipper", "f", "#7a2f3e", "#f0e2d0", "#d1a43a"]
  ], quiet([{ kind: "tone", freq: 294, every: 8, length: 1.1, level: 0.1, vibrato: true }])),
  sacred_grove: recipe("sacred_grove", "worship", [
    ["Grove custodian", "m", "#f0ebde", "#8a6a3a", "#4a6a3a"], ["Priestess", "f", "#f0ebde", "#c9a24a", "#2f6a42"], ["Local guide", "m", "#3a6a3f", "#e8dcc0", "#8a5a2f"], ["Devotee", "f", "#e8e1cf", "#6b4a30", "#c97a3a"]
  ], quiet([{ kind: "chirps", freq: 1900, rate: 1.2, level: 0.18 }, { kind: "swell", freq: 650, rate: 0.18, level: 0.1 }])),

  police_station: recipe("police_station", "civic", [
    ["Desk officer", "m", "#26385c", "#e4e8ee", "#c9a24a"], ["Detective", "f", "#4a4a52", "#e8e8e8", "#8a2f2f"], ["Security guard", "m", "#1f2933", "#8fa0aa", "#c9a24a"], ["Complainant", "f", "#c46a3a", "#f0e2d0", "#4a6a8a"]
  ], busy(0.3)),
  hospital: recipe("hospital", "civic", [
    ["Doctor", "f", "#f4f6f6", "#2a8f8a", "#2a5f8f"], ["Nurse", "f", "#2a8f8a", "#f4f6f6", "#c9d6d6"], ["Hospital porter", "m", "#3b6aa6", "#e8e8e8", "#d1a43a"], ["Records clerk", "m", "#5a6a7a", "#f0f0ea", "#8a8a8a"]
  ], busy(0.38)),
  community_hall: recipe("community_hall", "civic", [
    ["Community leader", "m", "#2f7a52", "#f0e2b0", "#d1a43a"], ["Elder", "m", "#6b4a30", "#e8dcc0", "#8a6a3a"], ["Youth organiser", "f", "#d3772c", "#f0ebde", "#2f6a52"], ["Dance instructor", "f", "#6b4a92", "#f0e2b0", "#d1a43a"]
  ], busy(0.28)),
  traditional_council: recipe("traditional_council", "civic", [
    ["Council elder", "m", "#7e2f3e", "#f0e2b0", "#d1a43a"], ["Court secretary", "f", "#2f5a7a", "#f0ebde", "#c9a24a"], ["Historian", "m", "#f0ebde", "#6b4a30", "#a33a2f"], ["Petitioner", "f", "#3b6aa6", "#f0ebde", "#d1a43a"]
  ], quiet()),
  emir_palace: recipe("emir_palace", "civic", [
    ["Palace guard", "m", "#f0ebde", "#a8362e", "#2f6a52"], ["Horse groom", "m", "#6b4a30", "#c9b48a", "#a8362e"], ["Palace messenger", "f", "#2f6a7a", "#f0ebde", "#d1a43a"], ["Court historian", "m", "#e8e1cf", "#2f5a7a", "#d1a43a"]
  ], quiet()),
  palace: recipe("palace", "civic", [
    ["Palace guard", "m", "#8f2f2b", "#f1e9d5", "#d1a43a"], ["Court historian", "f", "#2f5a7a", "#f0ebde", "#d1a43a"], ["Chief", "m", "#d1a43a", "#7e2f3e", "#f1e9d5"], ["Royal drummer", "m", "#2f7a52", "#d1a43a", "#f0e2b0"]
  ], quiet([{ kind: "pulse", bpm: 72, freq: 95, level: 0.1 }])),

  museum: recipe("museum", "culture_learning", [
    ["Curator", "f", "#4a3a63", "#f0ebde", "#c9a24a"], ["Museum guide", "m", "#2f7a7a", "#f0ebde", "#d1a43a"], ["Conservator", "f", "#e8ecec", "#7a8a8a", "#c9a24a"], ["Visitor", "m", "#3b6aa6", "#f0ebde", "#8a6a3a"]
  ], quiet()),
  library: recipe("library", "culture_learning", [
    ["Librarian", "f", "#2d4a3a", "#f0ebde", "#c9a24a"], ["Archivist", "m", "#6b4a30", "#e8dcc0", "#2d4a3a"], ["Researcher", "f", "#4a6a8a", "#f0ebde", "#c9a24a"], ["Student", "m", "#c46a3a", "#f0ebde", "#2f4a7a"]
  ], quiet()),
  university: recipe("university", "culture_learning", [
    ["Lecturer", "m", "#4a3a63", "#f0ebde", "#c9a24a"], ["Student", "f", "#d3772c", "#f0ebde", "#2f6a52"], ["Researcher", "f", "#f0f0ea", "#4a6a8a", "#c9a24a"], ["Campus guard", "m", "#26385c", "#8fa0aa", "#c9a24a"]
  ], busy(0.22)),
  monument: recipe("monument", "culture_learning", [
    ["Monument guide", "m", "#2f6a52", "#f0ebde", "#d1a43a"], ["Photographer", "f", "#3b3f46", "#c46a3a", "#d1a43a"], ["Caretaker", "m", "#6b4a30", "#c9b48a", "#8a6a3a"], ["Visitor", "f", "#c46a8d", "#f0ebde", "#6b4a30"]
  ], quiet()),
  radio_station: recipe("radio_station", "culture_learning", [
    ["Radio presenter", "f", "#c8372d", "#f0ebde", "#26385c"], ["Producer", "m", "#26385c", "#e8e8e8", "#d1a43a"], ["Reporter", "f", "#2a8f8a", "#f0ebde", "#c9a24a"], ["Studio engineer", "m", "#3b3f46", "#8fa0aa", "#d1a43a"]
  ], { crowd: 0.22, calls: 0.1, hum: 0.35, clinks: 0.12, extras: [{ kind: "tone", freq: 880, every: 7, length: 0.25, level: 0.08 }] }),
  carnival_workshop: recipe("carnival_workshop", "culture_learning", [
    ["Costume maker", "f", "#c8372d", "#efb62f", "#2a8f8a"], ["Dancer", "f", "#7a4aa0", "#efb62f", "#d65a4a"], ["Workshop welder", "m", "#5a5f63", "#c9b48a", "#d1a43a"], ["Drummer", "m", "#2a8f8a", "#efb62f", "#d65a4a"]
  ], { crowd: 0.42, calls: 0.14, hum: 0.3, clinks: 0.48, extras: [{ kind: "pulse", bpm: 108, freq: 110, level: 0.16 }] }),

  hotel: recipe("hotel", "hospitality", [
    ["Receptionist", "f", "#285a6c", "#f0ebde", "#c9a24a"], ["Concierge", "m", "#7e2f3e", "#f0ebde", "#c9a24a"], ["Housekeeper", "f", "#e8e1cf", "#2f6a7a", "#c9a24a"], ["Hotel guest", "m", "#c9b48a", "#f0ebde", "#6b4a30"]
  ], busy(0.28)),
  restaurant: recipe("restaurant", "hospitality", [
    ["Cook", "m", "#f4f1e6", "#e8e1cf", "#c8372d"], ["Server", "f", "#8f3d32", "#f4f1e6", "#d1a43a"], ["Cashier", "f", "#2f6a52", "#f4f1e6", "#d1a43a"], ["Restaurant manager", "m", "#3b3f46", "#f4f1e6", "#c9a24a"]
  ], { crowd: 0.55, calls: 0.2, hum: 0.35, clinks: 0.52 }),
  nightclub: recipe("nightclub", "hospitality", [
    ["Bouncer", "m", "#1f2124", "#3a3d44", "#7a7f88"], ["Bartender", "f", "#2a2540", "#ff7bd5", "#3fd0ff"], ["Waiter", "m", "#26234a", "#f0ebde", "#ff7bd5"], ["Performer", "f", "#c0359a", "#3fd0ff", "#efb62f"]
  ], { crowd: 0.65, calls: 0.24, hum: 0.42, clinks: 0.35, extras: [{ kind: "pulse", bpm: 122, freq: 68, level: 0.2 }] })
};
