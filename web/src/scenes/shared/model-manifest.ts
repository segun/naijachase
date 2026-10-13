// Which GLB model each thing in the game uses, and how big it really is. Pure data, no graphics library, so it is unit-tested.
// Files live under public/assets/3d/ and are served as plain static files; a scene asks for a model by id and only then downloads it.
// Every generated model comes out about one unit tall and facing +z, so `size` (real metres) and `yaw` (radians turned to face the
// game's -z, towards the camera) are what make a model fit the scene. See docs/3d-asset-progress.md for what exists.

export type ModelKind = "person" | "animal" | "vehicle" | "prop" | "item" | "scenery" | "building" | "room";

/** Which way a model is measured to give it its real size: its height, or its longest horizontal side (vehicles, rooms, bridges, fields...). */
export type Measure = "height" | "length";

export type ModelSpec = {
  /** Path under public/assets/3d/. */
  file: string;
  kind: ModelKind;
  /** Real size in metres, measured as `measure` says. */
  size: number;
  /** Defaults to the length for vehicles and rooms and to the height for everything else. */
  measure?: Measure;
  /** Extra turn in radians on top of the default for the kind (everything except vehicles is turned to face -z, towards the camera). */
  yaw?: number;
  /** Flips the model left to right (for example to put a steering wheel on the other side). */
  mirror?: boolean;
  /** Slides the model inside its holder, metres, after scaling (x right, y up, z away from the camera). */
  offset?: readonly [number, number, number];
  /** True once someone has looked at the model in the scene and confirmed size, facing and position. */
  checked?: boolean;
};

export const ASSET_ROOT = "/assets/3d/";
export const modelUrl = (spec: ModelSpec) => ASSET_ROOT + spec.file;

const person = (folder: string, name: string, size: number): [string, ModelSpec] => [name, { file: `characters/${folder}/${name}.glb`, kind: "person", size }];
const animal = (name: string, size: number): [string, ModelSpec] => [name, { file: `animals/${name}.glb`, kind: "animal", size }];
const vehicle = (name: string, size: number, extra: Partial<ModelSpec> = {}): [string, ModelSpec] => [name, { file: `vehicles/${name}.glb`, kind: "vehicle", size, ...extra }];

// ---- Props, scenery, buildings, rooms and small items. Sizes are real-world dimensions (metres) or what the scene code needs. A bare number is
// measured by the kind's default; `[n, "length"]` measures the longest horizontal side, `[n, "height"]` the height. ----
type Sized = number | readonly [number, Measure];
const group = (kind: ModelKind, folder: string, sizes: Record<string, Sized>, extra: Partial<ModelSpec> = {}): [string, ModelSpec][] =>
  Object.entries(sizes).map(([name, v]) => {
    const [size, measure] = typeof v === "number" ? [v, undefined] : v;
    return [name, { file: `${folder}/${name}.glb`, kind, size, ...(measure ? { measure } : {}), ...extra }];
  });
const L = (n: number): Sized => [n, "length"];
const CHASE_CHECKED = new Set([
  "masked_thief", "crowd_police", "crowd_commuter_man", "crowd_commuter_woman", "crowd_trader_man", "crowd_trader_woman", "crowd_farmer",
  "lagos_palm", "lagos_tower_a", "lagos_tower_b", "lagos_tower_c", "lagos_fishing_boat", "lagos_lighthouse", "bus_danfo",
  "anambra_market_stall", "anambra_shopfront_a", "anambra_shopfront_b", "kano_pyramid", "kano_house_a", "kano_house_b", "kano_baobab", "tree_neem", "lamp_post"
]);

const PLACES = [
  ...group("prop", "props/street", {
    barrier_road: L(3), bench_wood: L(1.8), bin: 0.9, bollard: 0.8, bunting: L(6), chair_plastic: 0.85, cone_traffic: 0.7, crates_plastic: 0.9, crates_wood: 0.9,
    drum_oil: 0.9, fence_chainlink: L(3), fence_wood: L(3), generator: 0.6, kiosk_small: 2.4, lamp_post: 5, market_cloth_stall: 2.4, market_pots_stall: 2.2,
    market_produce_table: L(2), market_scale: 0.8, market_stall_a: 2.5, market_stall_b: 2.5, market_umbrella: 2.6, pallet: L(1.2), pole_electric: 9, sacks_stack: 1.2,
    signboard_blank: 2.2, standpipe: 1, stool_wood: 0.45, table_plastic: 0.75, tent_shade: 3, tyres_stack: 1, water_tank_stand: 3
  }),
  ...group("scenery", "chase", {
    anambra_bridge: L(60), anambra_market_stall: 2.6, anambra_shopfront_a: 8, anambra_shopfront_b: 8, bus_stop_shelter: 2.8, bush_a: 1, gantry_city_gate: L(14),
    kano_baobab: 14, kano_dala_hill: L(80), kano_house_a: 5, kano_house_b: 7, kano_minaret: 14, kano_pyramid: 7, lagos_billboard: 7, lagos_bridge: L(120),
    lagos_fishing_boat: L(7), lagos_lighthouse: 30, lagos_palm: 12, lagos_seawall: L(8), lagos_tower_a: 40, lagos_tower_b: 50, lagos_tower_c: 34, road_sign_a: 3,
    rock_a: 1.6, tree_flame: 9, tree_mango: 10, tree_neem: 9
  }),
  ...group("scenery", "journey", {
    journey_baobab: 14, journey_billboard: 7, journey_boat: L(7), journey_building: 8, journey_bus_parked: L(4.4), journey_bush: 1.2, journey_busstop: 2.8, journey_cactus: 3,
    journey_cloud_a: L(40), journey_cloud_b: L(60), journey_crop_field: L(20), journey_garage: 5, journey_hangar: 16, journey_hill: L(80), journey_hut: 3.5, journey_palm: 12,
    journey_pine: 14, journey_pole: 8, journey_reed: 2, journey_rock: 3, journey_stall: 2.5, journey_terminal: 14, journey_tower: 30, journey_tree: 8
  }),
  // The cutaway rooms are the width of the scenes' shared room (scene-core.ts ROOM: 8.8 m).
  ...group("room", "interiors/office", { office_room: 8.8 }),
  ...group("prop", "interiors/office", { office_chair: 1 }, { yaw: -Math.PI / 2, checked: true }),
  ...group("prop", "interiors/office", {
    office_corkboard: L(1.2), office_desk: L(1.4), office_filing_cabinet: 1.3, office_lamp: 0.45, office_monitor: L(0.6), office_papers: L(0.4), office_plant: 1, office_window: 1.4
  }, { checked: true }),
  ...group("room", "interiors/garage", { garage_room: 8.8 }),
  ...group("prop", "interiors/garage", { garage_shelf: 1.8, garage_shutter: L(4.9), garage_tool_rack: L(1.5), garage_workbench: L(1.8) }),
  ...group("room", "interiors/archive", { archive_room: 8.8 }),
  ...group("prop", "interiors/archive", { archive_box: L(0.35), archive_cabinet: L(1.2), archive_ladder: 2.6, archive_pendant_lamp: 0.6, archive_shelf: 2.4, archive_table: L(1.4) }),
  ...group("room", "interiors/panel", { panel_hall: 8.8 }),
  ...group("prop", "interiors/panel", { panel_bench: L(6), panel_chair: 1.2, panel_flag: 2.4, panel_gavel: L(0.3), panel_water_jug: 0.3 }),
  ...group("item", "interiors/items", {
    item_coins: L(0.1), item_evidence_bag: L(0.25), item_folder: L(0.33), item_keys: L(0.1), item_magnifier: L(0.25), item_map: L(0.3), item_notebook: L(0.15),
    item_passport: L(0.125), item_photographs: L(0.15), item_tickets: L(0.12)
  }),
  // Held items (props/held/) are added when they are made.
  ...group("building", "venues/airport", { airport_main: L(60), airport_hangar: L(40) }),
  ...group("prop", "venues/airport", { airport_checkin: L(10), airport_security_gate: 2.4, airport_tower: 30, airport_trolley: 1.1 }),
  ...group("building", "venues/beach", { beach_main: L(14) }),
  ...group("prop", "venues/beach", { beach_lifeguard_tower: 4, beach_net_rack: L(3), beach_palm: 10, beach_umbrella: 2.4 }),
  ...group("building", "venues/carnival_workshop", { carnival_workshop_main: L(20) }),
  ...group("room", "venues/carnival_workshop", { carnival_workshop_interior: 12 }),
  ...group("prop", "venues/carnival_workshop", { carnival_workshop_mannequin: 1.9 }),
  ...group("building", "venues/cattle_market", { cattle_market_main: L(14) }),
  ...group("prop", "venues/cattle_market", { cattle_market_hay: 1.6, cattle_market_trough: L(2.5) }),
  ...group("building", "venues/church", { church_main: L(18) }),
  ...group("room", "venues/church", { church_interior: 18 }),
  ...group("prop", "venues/church", { church_noticeboard: 2 }),
  ...group("building", "venues/community_hall", { community_hall_main: L(20) }),
  ...group("room", "venues/community_hall", { community_hall_interior: 16 }),
  ...group("building", "venues/conservation_office", { conservation_office_main: L(14) }),
  ...group("prop", "venues/conservation_office", { conservation_office_mast: 20, conservation_office_noticeboard: 2 }),
  ...group("building", "venues/craft_market", { craft_market_main: L(14) }),
  ...group("prop", "venues/craft_market", { craft_market_dye_vat: L(3.5), craft_market_forge: 1.5, craft_market_loom: L(1.8), craft_market_masks: 1.8 }),
  ...group("building", "venues/emir_palace", { emir_palace_main: L(30), emir_palace_courtyard: L(20) }),
  ...group("prop", "venues/emir_palace", { emir_palace_umbrella: 2.8 }),
  ...group("building", "venues/factory_gate", { factory_gate_main: L(60) }),
  ...group("prop", "venues/factory_gate", { factory_gate_chimney: 40, factory_gate_guardhouse: L(3) }),
  ...group("building", "venues/farm", { farm_main: L(20) }),
  ...group("prop", "venues/farm", { farm_crop_rows: L(12), farm_goat_pen: L(4), farm_scarecrow: 2.2, farm_yam_mounds: L(8) }),
  ...group("building", "venues/festival_ground", { festival_ground_main: L(16), festival_ground_pavilion: L(7) }),
  ...group("prop", "venues/festival_ground", { festival_ground_drum_set: L(3), festival_ground_grill: L(2.5), festival_ground_speakers: 2.2 }),
  ...group("building", "venues/fishing_jetty", { fishing_jetty_main: L(16), fishing_jetty_hut: L(3) }),
  ...group("prop", "venues/fishing_jetty", { fishing_jetty_fish_crates: L(1.5) }),
  ...group("building", "venues/hospital", { hospital_main: L(30) }),
  ...group("room", "venues/hospital", { hospital_interior: 14 }),
  ...group("prop", "venues/hospital", { hospital_stretcher: L(2), hospital_wheelchair: 1 }),
  ...group("building", "venues/hotel", { hotel_main: L(25) }),
  ...group("room", "venues/hotel", { hotel_interior: 10 }),
  ...group("prop", "venues/hotel", { hotel_trolley: 1.5 }),
  ...group("building", "venues/jetty", { jetty_main: L(18) }),
  ...group("prop", "venues/jetty", { jetty_luggage: L(1.2), jetty_route_board: 2.2 }),
  ...group("building", "venues/library", { library_main: L(22) }),
  ...group("room", "venues/library", { library_interior: 14 }),
  ...group("prop", "venues/library", { library_bookshelf: 2.2 }),
  ...group("building", "venues/market", { market_main: L(14), market_shopfront: L(10) }),
  ...group("building", "venues/mining_site", { mining_site_main: L(30), mining_site_cabin: L(6) }),
  ...group("prop", "venues/mining_site", { mining_site_conveyor: L(18), mining_site_crusher: L(6), mining_site_rock_heap: L(5) }),
  ...group("building", "venues/monument", { monument_main: L(30) }),
  ...group("prop", "venues/monument", { monument_plaque: L(0.6) }),
  ...group("building", "venues/mosque", { mosque_main: L(22) }),
  ...group("room", "venues/mosque", { mosque_interior: 18 }),
  ...group("prop", "venues/mosque", { mosque_ablution: L(5) }),
  ...group("building", "venues/motor_park", { motor_park_main: L(12) }),
  ...group("prop", "venues/motor_park", { motor_park_board: 2.5, motor_park_kiosk: 2.6, motor_park_mechanic: L(4) }),
  ...group("building", "venues/museum", { museum_main: L(30) }),
  ...group("room", "venues/museum", { museum_interior: 14 }),
  ...group("prop", "venues/museum", { museum_bronze_head: 1.4, museum_display_case: 1.2 }),
  ...group("building", "venues/nightclub", { nightclub_main: L(18) }),
  ...group("room", "venues/nightclub", { nightclub_interior: 12 }),
  ...group("prop", "venues/nightclub", { nightclub_dj_booth: L(3) }),
  ...group("building", "venues/palace", { palace_main: L(40) }),
  ...group("room", "venues/palace", { palace_interior: 18 }),
  ...group("prop", "venues/palace", { palace_guard_box: 2.4 }),
  ...group("building", "venues/police_station", { police_station_main: L(18) }),
  ...group("room", "venues/police_station", { police_station_interior: 10 }),
  ...group("prop", "venues/police_station", { police_station_barrier: L(5) }),
  ...group("building", "venues/radio_station", { radio_station_main: L(16) }),
  ...group("room", "venues/radio_station", { radio_station_interior: 6 }),
  ...group("prop", "venues/radio_station", { radio_station_mast: 40 }),
  ...group("building", "venues/railway_station", { railway_station_main: L(25) }),
  ...group("prop", "venues/railway_station", { railway_station_platform_bench: L(2), railway_station_signal: 5, railway_station_track: L(20), railway_station_trolley: L(1.8) }),
  ...group("building", "venues/refinery", { refinery_main: L(60), refinery_cabin: L(6) }),
  ...group("prop", "venues/refinery", { refinery_flare_stack: 40, refinery_pipes: L(20), refinery_tank: L(20) }),
  ...group("building", "venues/restaurant", { restaurant_main: L(12) }),
  ...group("room", "venues/restaurant", { restaurant_interior: 10, restaurant_kitchen: 5 }),
  ...group("building", "venues/sacred_grove", { sacred_grove_main: L(30), sacred_grove_shelter: L(5) }),
  ...group("prop", "venues/sacred_grove", { sacred_grove_shrine: L(3) }),
  ...group("building", "venues/seaport", { seaport_main: L(60), seaport_customs_shed: L(25) }),
  ...group("prop", "venues/seaport", { seaport_containers: L(12), seaport_crane: 40, seaport_forklift: L(3) }),
  ...group("building", "venues/traditional_council", { traditional_council_main: L(24) }),
  ...group("room", "venues/traditional_council", { traditional_council_interior: 12 }),
  ...group("prop", "venues/traditional_council", { traditional_council_throne: 1.4 }),
  ...group("building", "venues/university", { university_main: L(40) }),
  ...group("room", "venues/university", { university_interior: 16 }),
  ...group("prop", "venues/university", { university_lectern: 1.2 }),
  ...group("building", "venues/waterfront", { waterfront_main: L(40) }),
  ...group("prop", "venues/waterfront", { waterfront_baskets: L(2), waterfront_bollards: L(6) })
];

export const MODELS: Readonly<Record<string, ModelSpec>> = Object.fromEntries([
  person("chase", "masked_thief", 1.78),
  // Player avatars: the five feminine presets are 1.65 m, the five masculine ones 1.78 m (see the prompts in docs/3d-generator-prompts.md).
  person("avatars", "avatar_01_emerald_braids", 1.65), person("avatars", "avatar_02_midnight_low_cut", 1.78), person("avatars", "avatar_03_burgundy_wrap", 1.65),
  person("avatars", "avatar_04_forest_coils", 1.78), person("avatars", "avatar_05_cobalt_bob", 1.65), person("avatars", "avatar_06_copper_fade", 1.78),
  person("avatars", "avatar_07_teal_twists", 1.65), person("avatars", "avatar_08_gold_crop", 1.78), person("avatars", "avatar_09_plum_locs", 1.65),
  person("avatars", "avatar_10_slate_waves", 1.78),
  // Witnesses
  person("witnesses", "witness_woman_trader", 1.62), person("witnesses", "witness_woman_young", 1.65), person("witnesses", "witness_woman_professional", 1.67),
  person("witnesses", "witness_woman_elder", 1.55), person("witnesses", "witness_woman_uniform", 1.65), person("witnesses", "witness_man_trader", 1.72),
  person("witnesses", "witness_man_young", 1.76), person("witnesses", "witness_man_professional", 1.78), person("witnesses", "witness_man_agbada", 1.76),
  person("witnesses", "witness_man_northern", 1.75), person("witnesses", "witness_man_elder", 1.66), person("witnesses", "witness_man_worker", 1.75),
  person("witnesses", "witness_man_security", 1.78), person("witnesses", "witness_man_farmer", 1.72), person("witnesses", "witness_man_cleric", 1.74),
  person("witnesses", "witness_child", 1.35),
  // The five judges sit; their size is the standing height of the model.
  ...[1, 2, 3, 4, 5].map(n => person("judges", `judge_${n}`, 1.72)),
  // Background people
  ...["bouncer", "chef", "chief", "commuter_man", "commuter_woman", "dancer_festival", "doctor", "drummer", "farmer", "fisherman", "imam", "mechanic", "miner",
    "nurse", "pilot", "police", "priest", "ranger", "receptionist", "sailor_docker", "student", "trader_man", "trader_woman", "waiter"]
    .map(n => person("crowd", `crowd_${n}`, n === "student" ? 1.6 : 1.72)),
  // Animals (height at the back)
  animal("camel", 2.1), animal("chicken", 0.4), animal("cow_black", 1.4), animal("cow_brown", 1.4), animal("cow_white", 1.4), animal("dog", 0.6),
  animal("donkey_cart", 1.5), animal("goat", 0.8), animal("horse_royal", 1.6), animal("sheep", 0.8),
  // Vehicles (length). The runabout is the player's car in the garage: the garage's CAR is 3.6 m long with its nose towards the camera.
  vehicle("car_player_runabout", 3.6, { yaw: Math.PI, mirror: true }), vehicle("bus_danfo", 4.4), vehicle("bus_coach", 11), vehicle("car_saloon_white", 4.5), vehicle("car_saloon_dark", 4.5),
  vehicle("car_hatchback", 3.9), vehicle("car_suv", 4.7), vehicle("car_jeep_ranger", 4.2), vehicle("truck_pickup", 5.3), vehicle("truck_livestock", 7.5),
  vehicle("truck_mining_haul", 9), vehicle("digger_excavator", 8), vehicle("truck_tanker", 12), vehicle("truck_container", 12), vehicle("van_delivery", 5.5),
  vehicle("keke_tricycle", 2.7), vehicle("okada_motorbike", 2), vehicle("bicycle", 1.8), vehicle("handcart", 1.8), vehicle("wheelbarrow", 1.5),
  vehicle("car_police", 4.6), vehicle("van_police", 5.5), vehicle("ambulance", 5.5), vehicle("train_locomotive", 18), vehicle("train_carriage", 20),
  vehicle("plane_airliner", 27), vehicle("airport_baggage_tractor", 8), vehicle("airport_stairs", 4.5), vehicle("airport_fuel_truck", 9),
  vehicle("boat_canoe", 6), vehicle("boat_launch", 8), vehicle("boat_dinghy", 3), vehicle("boat_barge", 20), vehicle("boat_tug", 12), vehicle("ship_cargo", 120),
  ...PLACES
].map(([id, spec]): [string, ModelSpec] => [id, CHASE_CHECKED.has(id) ? { ...spec, checked: true } : spec]));

/** The avatar picker's ids ("avatar-01" ...) map onto the files by their number. */
export function avatarModelId(avatarId: string): string | null {
  const n = /^avatar-(\d{2})$/.exec(avatarId)?.[1];
  return n ? Object.keys(MODELS).find(k => k.startsWith(`avatar_${n}_`)) ?? null : null;
}

export const modelSpec = (id: string): ModelSpec | null => MODELS[id] ?? null;

/** How a model is measured: the spec's own choice, else the length for vehicles and rooms and the height for everything else. */
export const measureOf = (spec: ModelSpec): Measure => spec.measure ?? (spec.kind === "vehicle" || spec.kind === "room" ? "length" : "height");
/** Vehicles are left as they come; everything else is turned to face -z, towards the camera (generated models face +z). */
export const baseYaw = (spec: ModelSpec) => (spec.kind === "vehicle" ? 0 : Math.PI);
