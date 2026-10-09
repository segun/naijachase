// Recipes for the open-air, transport, water and work venues (Agent1's venues; see docs/agents/Agent1.md). Each entry is keyed by the
// venue id in data/exports/witness-location-scenes.json. Witnesses and their names are fictional; the scenery they stand in is in the
// `market_variants`, `transport_hub`, `water_edge` and `work_and_land` sets (chase3d-open-air.ts and witness-2d-open-air.ts).
import { type VenueRecipe, look } from "./recipe-kit.ts";

export const OPEN_AIR_RECIPES: Readonly<Record<string, VenueRecipe>> = {
  cattle_market: {
    id: "cattle_market", set: "market_variants", variant: "cattle_market",
    sound: { crowd: 0.45, calls: 0.6, hum: 0.2, clinks: 0.15, extras: [{ kind: "tone", freq: 140, every: 7, length: 1.4, level: 0.12, shape: "sawtooth", slide: 0.85, vibrato: true }, { kind: "swell", freq: 300, rate: 0.1, level: 0.08, filter: "lowpass" }] },
    witnesses: [
      look("w-cattle-1", "Cattle trader", "masculine", "#5a3a28", "low_cut", "#15100d", "#8a6a3a", "#f4ecd8", "#b5483a", 112),
      look("w-cattle-2", "Herder", "masculine", "#6e4630", "close_crop", "#0e0a08", "#4a6a3a", "#d9cdb0", "#c98a1b", 104),
      look("w-cattle-3", "Veterinary worker", "feminine", "#7a4f35", "braided_bun", "#1c1410", "#f4ecd8", "#2f6b4a", "#2e6f8f", 214),
      look("w-cattle-4", "Loader", "masculine", "#4a3022", "fade", "#0e0a08", "#2e6f8f", "#c9b48a", "#d9822b", 100),
      look("w-cattle-5", "Livestock buyer", "feminine", "#8a5a3c", "head_wrap", "#241812", "#7a4aa0", "#f2c14e", "#2f8f5b", 208)
    ]
  },
  craft_market: {
    id: "craft_market", set: "market_variants", variant: "craft_market",
    sound: { crowd: 0.7, calls: 0.6, hum: 0.15, clinks: 0.6, extras: [{ kind: "pulse", bpm: 84, freq: 170, level: 0.1 }] },
    witnesses: [
      look("w-craft-1", "Weaver", "feminine", "#6e4630", "head_wrap", "#2a1a12", "#26336b", "#f4ecd8", "#d9822b", 212),
      look("w-craft-2", "Dyer", "masculine", "#5a3a28", "short_waves", "#15100d", "#26336b", "#c9b48a", "#2f8f5b", 116),
      look("w-craft-3", "Carver", "masculine", "#8a5a3c", "low_cut", "#1c1410", "#8a5a2f", "#f4ecd8", "#b5483a", 108),
      look("w-craft-4", "Bronze caster", "masculine", "#4a3022", "close_crop", "#0e0a08", "#b0803f", "#3b4a5a", "#e8e2cf", 102),
      look("w-craft-5", "Leather seller", "feminine", "#a06a45", "braided_bun", "#241812", "#5a3a28", "#f2c14e", "#2a6f9f", 218)
    ]
  },
  festival_ground: {
    id: "festival_ground", set: "market_variants", variant: "festival_ground",
    sound: { crowd: 0.9, calls: 0.6, hum: 0.3, clinks: 0.2, extras: [{ kind: "pulse", bpm: 112, freq: 80, level: 0.26 }] },
    witnesses: [
      look("w-festival-1", "Drummer", "masculine", "#4a3022", "short_coils", "#0e0a08", "#b5483a", "#f2c14e", "#2f8f5b", 106),
      look("w-festival-2", "Dancer", "feminine", "#7a4f35", "short_locs", "#1b130e", "#2f8f5b", "#f2c14e", "#d9822b", 222),
      look("w-festival-3", "Food vendor", "feminine", "#6e4630", "head_wrap", "#241812", "#d9822b", "#f4ecd8", "#7a4aa0", 216),
      look("w-festival-4", "Festival organiser", "masculine", "#5a3a28", "fade", "#15100d", "#176b4d", "#f6f1e1", "#f2c14e", 118),
      look("w-festival-5", "Stage hand", "masculine", "#8a5a3c", "low_cut", "#1c1410", "#2b2f33", "#e8e2cf", "#d9822b", 110)
    ]
  },
  motor_park: {
    id: "motor_park", set: "transport_hub", variant: "motor_park",
    sound: { crowd: 0.8, calls: 1, hum: 0.6, clinks: 0.3, extras: [{ kind: "tone", freq: 340, every: 8, length: 0.35, level: 0.15, shape: "square" }, { kind: "swell", freq: 200, rate: 0.3, level: 0.15, filter: "lowpass" }] },
    witnesses: [
      look("w-park-1", "Agbero", "masculine", "#5a3a28", "fade", "#0e0a08", "#2e6f8f", "#e8e2cf", "#f2c14e", 108),
      look("w-park-2", "Bus driver", "masculine", "#6e4630", "low_cut", "#15100d", "#3b4a5a", "#f2b705", "#e8e2cf", 114),
      look("w-park-3", "Conductor", "masculine", "#8a5a3c", "close_crop", "#1c1410", "#f2b705", "#15191c", "#b5483a", 124),
      look("w-park-4", "Ticket seller", "feminine", "#7a4f35", "head_wrap", "#241812", "#2f8f5b", "#f4ecd8", "#d9822b", 214),
      look("w-park-5", "Mechanic", "masculine", "#4a3022", "short_waves", "#0e0a08", "#2a3340", "#c9b48a", "#d9822b", 100),
      look("w-park-6", "Passenger", "feminine", "#a06a45", "bob", "#1b130e", "#c0568a", "#f4ecd8", "#2a6f9f", 210)
    ]
  },
  railway_station: {
    id: "railway_station", set: "transport_hub", variant: "railway_station",
    sound: { crowd: 0.6, calls: 0.4, hum: 0.3, clinks: 0.25, extras: [{ kind: "tone", freq: 700, every: 16, length: 1.5, level: 0.16, shape: "sawtooth", slide: 1.25, vibrato: true }, { kind: "tone", freq: 520, every: 9, length: 0.7, level: 0.08 }] },
    witnesses: [
      look("w-rail-1", "Ticket seller", "feminine", "#6e4630", "braided_bun", "#1c1410", "#1f6f5c", "#f4ecd8", "#f2c14e", 212),
      look("w-rail-2", "Railway worker", "masculine", "#5a3a28", "low_cut", "#15100d", "#2b3a4a", "#f2c14e", "#e8e2cf", 110),
      look("w-rail-3", "Platform porter", "masculine", "#4a3022", "close_crop", "#0e0a08", "#8a5a2f", "#e8e2cf", "#b5483a", 102),
      look("w-rail-4", "Security guard", "masculine", "#8a5a3c", "fade", "#1c1410", "#2a3340", "#f4ecd8", "#d9822b", 116),
      look("w-rail-5", "Passenger", "feminine", "#7a4f35", "head_wrap", "#241812", "#7a4aa0", "#f2c14e", "#2f8f5b", 208)
    ]
  },
  airport: {
    id: "airport", set: "transport_hub", variant: "airport",
    sound: { crowd: 0.6, calls: 0.2, hum: 0.35, clinks: 0.5, extras: [{ kind: "tone", freq: 880, every: 11, length: 0.5, level: 0.1 }, { kind: "swell", freq: 700, rate: 0.06, level: 0.08, filter: "lowpass" }] },
    witnesses: [
      look("w-air-1", "Check-in agent", "feminine", "#6e4630", "braided_bun", "#1c1410", "#1f4a7a", "#f4ecd8", "#d9822b", 216),
      look("w-air-2", "Baggage handler", "masculine", "#4a3022", "low_cut", "#0e0a08", "#2b3a4a", "#f2c14e", "#e8e2cf", 104),
      look("w-air-3", "Pilot", "masculine", "#5a3a28", "fade", "#15100d", "#1f2a4a", "#f4ecd8", "#f2c14e", 118),
      look("w-air-4", "Traveller", "feminine", "#8a5a3c", "short_locs", "#241812", "#c0568a", "#f4ecd8", "#2a6f9f", 210),
      look("w-air-5", "Security officer", "masculine", "#7a4f35", "close_crop", "#0e0a08", "#2a3340", "#aeb6bb", "#d9822b", 112)
    ]
  },
  beach: {
    id: "beach", set: "water_edge", variant: "beach",
    sound: { crowd: 0.35, calls: 0.35, hum: 0.1, clinks: 0.15, extras: [{ kind: "swell", freq: 600, rate: 0.16, level: 0.25, filter: "lowpass" }, { kind: "chirps", freq: 2400, rate: 0.25, level: 0.1 }] },
    witnesses: [
      look("w-beach-1", "Lifeguard", "masculine", "#5a3a28", "low_cut", "#15100d", "#d63a2e", "#f4ecd8", "#f2c14e", 114),
      look("w-beach-2", "Fish seller", "feminine", "#6e4630", "head_wrap", "#2a1a12", "#2e6f8f", "#f4ecd8", "#d9822b", 214),
      look("w-beach-3", "Boat operator", "masculine", "#4a3022", "short_waves", "#0e0a08", "#2f6b4a", "#c9b48a", "#e8e2cf", 106),
      look("w-beach-4", "Food vendor", "feminine", "#8a5a3c", "braided_bun", "#241812", "#f2c14e", "#2e6f8f", "#b5483a", 220),
      look("w-beach-5", "Beach trader", "masculine", "#a06a45", "close_crop", "#1c1410", "#0f5f7a", "#f4ecd8", "#d9822b", 120)
    ]
  },
  fishing_jetty: {
    id: "fishing_jetty", set: "water_edge", variant: "fishing_jetty",
    sound: { crowd: 0.3, calls: 0.45, hum: 0.1, clinks: 0.3, extras: [{ kind: "swell", freq: 400, rate: 0.2, level: 0.2, filter: "lowpass" }, { kind: "chirps", freq: 2200, rate: 0.15, level: 0.08 }] },
    witnesses: [
      look("w-fjetty-1", "Fisherman", "masculine", "#4a3022", "close_crop", "#0e0a08", "#4a6a3a", "#c9b48a", "#d9822b", 100),
      look("w-fjetty-2", "Boat operator", "masculine", "#5a3a28", "low_cut", "#15100d", "#2e6f8f", "#e8e2cf", "#f2c14e", 110),
      look("w-fjetty-3", "Fish seller", "feminine", "#6e4630", "head_wrap", "#2a1a12", "#b5483a", "#f4ecd8", "#2f8f5b", 212),
      look("w-fjetty-4", "Ticket seller", "feminine", "#7a4f35", "bob", "#1b130e", "#2f6b8f", "#f2b705", "#e8e2cf", 218),
      look("w-fjetty-5", "Net mender", "masculine", "#8a5a3c", "short_coils", "#1c1410", "#6b7a5a", "#e8e2cf", "#b5483a", 108)
    ]
  },
  jetty: {
    id: "jetty", set: "water_edge", variant: "jetty",
    sound: { crowd: 0.5, calls: 0.6, hum: 0.2, clinks: 0.3, extras: [{ kind: "swell", freq: 450, rate: 0.18, level: 0.18, filter: "lowpass" }, { kind: "tone", freq: 220, every: 15, length: 1, level: 0.12, shape: "sawtooth" }] },
    witnesses: [
      look("w-jetty-1", "Boat operator", "masculine", "#5a3a28", "fade", "#0e0a08", "#1f4a7a", "#e8e2cf", "#f2c14e", 112),
      look("w-jetty-2", "Ticket seller", "feminine", "#6e4630", "braided_bun", "#1c1410", "#2f8f5b", "#f4ecd8", "#d9822b", 216),
      look("w-jetty-3", "Passenger", "feminine", "#8a5a3c", "short_locs", "#241812", "#c0568a", "#f4ecd8", "#2a6f9f", 208),
      look("w-jetty-4", "Fish seller", "feminine", "#7a4f35", "head_wrap", "#2a1a12", "#d9822b", "#f4ecd8", "#2e6f8f", 220),
      look("w-jetty-5", "Deckhand", "masculine", "#4a3022", "low_cut", "#15100d", "#3b4a5a", "#c9b48a", "#b5483a", 104)
    ]
  },
  waterfront: {
    id: "waterfront", set: "water_edge", variant: "waterfront",
    sound: { crowd: 0.6, calls: 0.6, hum: 0.2, clinks: 0.35, extras: [{ kind: "swell", freq: 450, rate: 0.18, level: 0.18, filter: "lowpass" }, { kind: "chirps", freq: 2400, rate: 0.2, level: 0.08 }] },
    witnesses: [
      look("w-wfront-1", "Boatman", "masculine", "#4a3022", "short_waves", "#0e0a08", "#2e6f8f", "#c9b48a", "#f2c14e", 102),
      look("w-wfront-2", "Fish seller", "feminine", "#6e4630", "head_wrap", "#2a1a12", "#2f8f5b", "#f4ecd8", "#d9822b", 214),
      look("w-wfront-3", "Dockworker", "masculine", "#5a3a28", "close_crop", "#15100d", "#8a6a3a", "#2b3a4a", "#e8e2cf", 108),
      look("w-wfront-4", "Food vendor", "feminine", "#8a5a3c", "braided_bun", "#241812", "#b5483a", "#f2c14e", "#2f6b4a", 218),
      look("w-wfront-5", "Crate carrier", "masculine", "#7a4f35", "fade", "#1c1410", "#7a4aa0", "#e8e2cf", "#d9822b", 112)
    ]
  },
  seaport: {
    id: "seaport", set: "water_edge", variant: "seaport",
    sound: { crowd: 0.3, calls: 0.3, hum: 0.5, clinks: 0.45, extras: [{ kind: "tone", freq: 110, every: 18, length: 3, level: 0.22, shape: "sawtooth", slide: 0.94 }, { kind: "swell", freq: 250, rate: 0.15, level: 0.15, filter: "lowpass" }] },
    witnesses: [
      look("w-port-1", "Dockworker", "masculine", "#4a3022", "close_crop", "#0e0a08", "#d9822b", "#2b3a4a", "#e8e2cf", 100),
      look("w-port-2", "Clearing agent", "feminine", "#6e4630", "braided_bun", "#1c1410", "#14394f", "#f4ecd8", "#f2c14e", 212),
      look("w-port-3", "Customs officer", "masculine", "#5a3a28", "fade", "#15100d", "#2a3340", "#aeb6bb", "#d9822b", 116),
      look("w-port-4", "Sailor", "masculine", "#8a5a3c", "low_cut", "#1c1410", "#1f4a7a", "#f4ecd8", "#b5483a", 108),
      look("w-port-5", "Crane operator", "feminine", "#7a4f35", "short_locs", "#241812", "#d9822b", "#3b4a5a", "#e8e2cf", 206)
    ]
  },
  farm: {
    id: "farm", set: "work_and_land", variant: "farm",
    sound: { crowd: 0.15, calls: 0.35, hum: 0.1, clinks: 0.15, extras: [{ kind: "chirps", freq: 3800, rate: 1.2, level: 0.12 }, { kind: "swell", freq: 350, rate: 0.1, level: 0.1, filter: "lowpass" }] },
    witnesses: [
      look("w-farm-1", "Farmer", "masculine", "#5a3a28", "close_crop", "#0e0a08", "#6b7a4a", "#d9cdb0", "#b5483a", 104),
      look("w-farm-2", "Produce buyer", "feminine", "#6e4630", "head_wrap", "#2a1a12", "#2e6f8f", "#f4ecd8", "#d9822b", 214),
      look("w-farm-3", "Farmhand", "masculine", "#4a3022", "low_cut", "#15100d", "#8a6a3a", "#c9b48a", "#2f8f5b", 100),
      look("w-farm-4", "Extension worker", "feminine", "#8a5a3c", "bob", "#1b130e", "#2f6b4a", "#f4ecd8", "#f2c14e", 210),
      look("w-farm-5", "Seed seller", "masculine", "#7a4f35", "short_waves", "#1c1410", "#b0803f", "#f4ecd8", "#2e6f8f", 114)
    ]
  },
  mining_site: {
    id: "mining_site", set: "work_and_land", variant: "mining_site",
    sound: { crowd: 0.2, calls: 0.2, hum: 0.6, clinks: 0.45, extras: [{ kind: "swell", freq: 140, rate: 0.3, level: 0.2, filter: "lowpass" }, { kind: "pulse", bpm: 52, freq: 70, level: 0.12 }] },
    witnesses: [
      look("w-mine-1", "Miner", "masculine", "#4a3022", "close_crop", "#0e0a08", "#d9822b", "#3b4a5a", "#e8e2cf", 100),
      look("w-mine-2", "Quarry worker", "masculine", "#5a3a28", "fade", "#15100d", "#8a8378", "#2b3a4a", "#f2c14e", 106),
      look("w-mine-3", "Mineral trader", "masculine", "#8a5a3c", "low_cut", "#1c1410", "#f4ecd8", "#6b4a2b", "#c98a1b", 116),
      look("w-mine-4", "Site engineer", "feminine", "#6e4630", "braided_bun", "#1c1410", "#f2c14e", "#2b3a4a", "#e8e2cf", 210),
      look("w-mine-5", "Gate checker", "feminine", "#7a4f35", "short_locs", "#241812", "#2f8f5b", "#f4ecd8", "#d9822b", 206)
    ]
  },
  refinery: {
    id: "refinery", set: "work_and_land", variant: "refinery",
    sound: { crowd: 0.1, calls: 0.1, hum: 0.85, clinks: 0.2, extras: [{ kind: "swell", freq: 220, rate: 0.08, level: 0.18, filter: "lowpass" }] },
    witnesses: [
      look("w-ref-1", "Engineer", "feminine", "#6e4630", "braided_bun", "#1c1410", "#e8e2cf", "#2b3a4a", "#d9822b", 208),
      look("w-ref-2", "Security man", "masculine", "#5a3a28", "fade", "#15100d", "#2a3340", "#f4ecd8", "#f2c14e", 110),
      look("w-ref-3", "Tanker driver", "masculine", "#4a3022", "low_cut", "#0e0a08", "#2e6f8f", "#c9b48a", "#d9822b", 102),
      look("w-ref-4", "Shift worker", "masculine", "#8a5a3c", "close_crop", "#1c1410", "#d9822b", "#3b4a5a", "#e8e2cf", 114),
      look("w-ref-5", "Safety officer", "feminine", "#7a4f35", "bob", "#1b130e", "#f2c14e", "#2b3a4a", "#d63a2e", 212)
    ]
  },
  factory_gate: {
    id: "factory_gate", set: "work_and_land", variant: "factory_gate",
    sound: { crowd: 0.3, calls: 0.3, hum: 0.6, clinks: 0.4, extras: [{ kind: "pulse", bpm: 88, freq: 90, level: 0.14 }, { kind: "tone", freq: 520, every: 22, length: 1.4, level: 0.12, shape: "sawtooth" }] },
    witnesses: [
      look("w-fact-1", "Factory worker", "masculine", "#5a3a28", "close_crop", "#0e0a08", "#2e6f8f", "#e8e2cf", "#f2c14e", 106),
      look("w-fact-2", "Security man", "masculine", "#4a3022", "fade", "#15100d", "#2a3340", "#f4ecd8", "#d9822b", 112),
      look("w-fact-3", "Artisan", "feminine", "#6e4630", "head_wrap", "#2a1a12", "#7a4aa0", "#f4ecd8", "#2f8f5b", 214),
      look("w-fact-4", "Tanker driver", "masculine", "#8a5a3c", "low_cut", "#1c1410", "#d9822b", "#3b4a5a", "#e8e2cf", 100),
      look("w-fact-5", "Line supervisor", "feminine", "#7a4f35", "short_locs", "#241812", "#176b4d", "#f4ecd8", "#f2c14e", 208)
    ]
  },
  conservation_office: {
    id: "conservation_office", set: "work_and_land", variant: "conservation_office",
    sound: { crowd: 0.12, calls: 0.15, hum: 0.1, clinks: 0.15, extras: [{ kind: "chirps", freq: 3000, rate: 0.6, level: 0.14 }, { kind: "swell", freq: 350, rate: 0.12, level: 0.1, filter: "lowpass" }, { kind: "tone", freq: 1300, every: 14, length: 0.25, level: 0.06, shape: "square" }] },
    witnesses: [
      look("w-cons-1", "Park ranger", "masculine", "#5a3a28", "low_cut", "#15100d", "#4a6a3a", "#d9cdb0", "#c98a1b", 112),
      look("w-cons-2", "Wildlife officer", "feminine", "#6e4630", "braided_bun", "#1c1410", "#2f6b4a", "#f4ecd8", "#f2c14e", 210),
      look("w-cons-3", "Researcher", "feminine", "#8a5a3c", "short_locs", "#241812", "#f4ecd8", "#4a6a3a", "#2e6f8f", 216),
      look("w-cons-4", "Tour guide", "masculine", "#7a4f35", "short_waves", "#1c1410", "#c98a1b", "#f4ecd8", "#2f6b4a", 118),
      look("w-cons-5", "Duty ranger", "masculine", "#4a3022", "close_crop", "#0e0a08", "#3a4a3a", "#c9b48a", "#e8e2cf", 104)
    ]
  }
};
