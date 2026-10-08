// Everything the briefing knows about a local lead's place, keyed by the venue id the server quotes. The labels, roles and
// arrival lines come from data/gameplay/venues.csv and venue-experiences.csv, so a new venue only needs an entry here (and a
// drawing in scenes/office/VenueArt.svelte; unknown venues get a map-pin card and still work).
import { venueInfo } from "./model.ts";

export type Flavour = { label: string; who: string; blurb: string };

const FLAVOUR: Record<string, Flavour> = {
  market: { label: "Market", who: "Market woman, produce seller and textile trader", blurb: "Traders call across crowded aisles while handcarts squeeze between stalls." },
  library: { label: "Library", who: "Librarian, archivist and researcher", blurb: "Ceiling fans turn above readers, catalogues and carefully labelled shelves." },
  nightclub: { label: "Nightclub", who: "Bouncer, bartender and waiter", blurb: "Cleaners and sound technicians prepare the room for the evening crowd." },
  church: { label: "Church", who: "Pastor, priest and usher", blurb: "Ushers arrange seats while quiet conversations echo through the hall." },
  mosque: { label: "Mosque", who: "Imam, muezzin and teacher", blurb: "Worshippers and attendants move quietly through the shaded compound." },
  museum: { label: "Museum", who: "Curator, guide and conservator", blurb: "Guides lead small groups past cases, maps and carefully conserved objects." },
  motor_park: { label: "Motor park", who: "Agbero, driver and conductor", blurb: "Conductors shout destinations as buses load beneath patched awnings." },
  hotel: { label: "Hotel", who: "Receptionist, concierge and housekeeper", blurb: "Guests cross the lobby while reception staff juggle keys, calls and luggage." },
  restaurant: { label: "Restaurant", who: "Cook, server and cashier", blurb: "Steam and spice drift from the kitchen as servers move between tables." },
  airport: { label: "Airport", who: "Check-in agent, baggage handler and pilot", blurb: "Announcements compete with trolley wheels, greetings and security checks." },
  radio_station: { label: "Radio station", who: "Presenter, producer and reporter", blurb: "Presenters move between a live studio and a corridor lined with notices." },
  hospital: { label: "Hospital", who: "Doctor, nurse and porter", blurb: "Nurses, relatives and orderlies move quickly through the reception area." },
  beach: { label: "Beach", who: "Lifeguard, fish seller and boat operator", blurb: "Fishing boats, food stands and wind off the water animate the shoreline." },
  carnival_workshop: { label: "Carnival workshop", who: "Costume maker, dancer and welder", blurb: "Fabric, wire, paint and feathers cover every available worktable." },
  cattle_market: { label: "Cattle market", who: "Cattle trader, herder and veterinary worker", blurb: "Herders negotiate over restless animals amid dust, ropes and feed sacks." },
  community_hall: { label: "Community hall", who: "Community leader, elder and youth organiser", blurb: "Plastic chairs, noticeboards and a humming generator frame a local meeting." },
  conservation_office: { label: "Conservation office", who: "Park ranger, wildlife officer and researcher", blurb: "Maps, field boots and wildlife posters crowd the practical office." },
  craft_market: { label: "Craft market", who: "Weaver, dyer and carver", blurb: "Dyers, carvers and weavers work beside displays arranged by material." },
  emir_palace: { label: "Emir's palace", who: "Palace guard, horse groom and palace messenger", blurb: "Messengers and guards cross a formal courtyard shaped by long protocol." },
  factory_gate: { label: "Factory gate", who: "Factory worker, security man and artisan", blurb: "Shift workers pass the gatehouse as trucks queue for inspection." },
  farm: { label: "Farm", who: "Farmer, produce buyer and farmhand", blurb: "Workers move between rows, sheds and produce laid out for sorting." },
  festival_ground: { label: "Festival ground", who: "Drummer, dancer and food vendor", blurb: "Vendors mark out spaces while drummers test rhythms near the stage." },
  fishing_jetty: { label: "Fishing jetty", who: "Fisherman, boat operator and fish seller", blurb: "Boats knock against the landing while fish sellers sort the morning catch." },
  mining_site: { label: "Mining site", who: "Miner, quarry worker and mineral trader", blurb: "Dusty vehicles pass a checkpoint near heaps of rock and safety notices." },
  monument: { label: "Monument", who: "Guide, photographer and caretaker", blurb: "Visitors circle the structure while guides point out weathered details." },
  palace: { label: "Royal palace", who: "Palace guard, court historian and chief", blurb: "Chiefs, messengers and visitors wait beneath the shade of a formal courtyard." },
  police_station: { label: "Police station", who: "Desk officer, detective and security guard", blurb: "Officers move between the report desk, radio room and crowded benches." },
  railway_station: { label: "Railway station", who: "Ticket seller, railway worker and passenger", blurb: "Passengers study the board while vendors and porters work the platform." },
  refinery: { label: "Refinery", who: "Engineer, security man and tanker driver", blurb: "Pipes, warning signs and the distant hum of processing surround the gatehouse." },
  sacred_grove: { label: "Sacred grove", who: "Custodian, priestess and guide", blurb: "Filtered light, old trees and quiet paths give the grove a guarded stillness." },
  seaport: { label: "Seaport", who: "Dockworker, clearing agent and customs officer", blurb: "Cranes move above stacked cargo as customs agents and drivers trade paperwork." },
  traditional_council: { label: "Traditional council", who: "Chief, elder and court secretary", blurb: "Elders and petitioners wait around a chamber arranged for formal discussion." },
  university: { label: "University", who: "Lecturer, student and researcher", blurb: "Students cross busy walkways between lecture halls, offices and food stalls." },
  waterfront: { label: "Waterfront", who: "Boatman, fish seller and dockworker", blurb: "Boats, fish sellers and waterside traffic crowd the muddy landing." },
  jetty: { label: "Passenger jetty", who: "Boat operator, ticket seller and passenger", blurb: "Passengers balance bags as boat operators call routes from the landing." },
};

/** Who you'd meet there and what it feels like. Prefers the player-facing copy the witness screens already use. */
export function leadInfo(id: string): { who: string; blurb: string } {
  const known = FLAVOUR[id];
  const base = venueInfo(id);
  const generic = base.who === "Local people";
  return {
    who: generic ? (known?.who ?? base.who) : base.who,
    blurb: generic ? (known?.blurb || base.blurb) : base.blurb
  };
}

export const hasFlavour = (id: string) => id in FLAVOUR;
