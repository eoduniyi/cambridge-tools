/**
 * Flyering locations in Cambridge, MA.
 * Coordinates are [latitude, longitude].
 */

export interface FlyerLocation {
  id: string;
  name: string;
  coords: [number, number]; // [lat, lng]
  neighborhood: string;
  type:
    | "library"
    | "cafe"
    | "coworking"
    | "grocery"
    | "university"
    | "brewery"
    | "park";
  legal: "permitted" | "ask-permission" | "restricted";
  confirmed: boolean; // has a flyer been physically verified here?
  evidence?: string; // photo filename in static/evidence/
  confirmedDate?: string; // ISO date string
  notes: string;
}

// Cambridge bounding box (approx 6.4 sq mi)
export const CAMBRIDGE_BOUNDS = {
  north: 42.404,
  south: 42.353,
  east: -71.064,
  west: -71.16,
  center: [42.3736, -71.1097] as [number, number],
  areaSqMi: 6.43,
};

/**
 * Estimated total flyers placed across Cambridge.
 * Based on volunteer activity reports — adjust as new info comes in.
 */
export const FLYER_POPULATION_ESTIMATE = 60;

export const ANCHOR: FlyerLocation = {
  id: "cpl-main",
  name: "Cambridge Public Library - Main Branch",
  coords: [42.3731, -71.1097],
  neighborhood: "Mid-Cambridge",
  type: "library",
  legal: "permitted",
  confirmed: true,
  notes: "305 Broadway. Submit flyers to staff for approval. Home base.",
};

export const LOCATIONS: FlyerLocation[] = [
  ANCHOR,
  {
    id: "sennott-park",
    name: "Sennott Park",
    coords: [42.3728, -71.104],
    neighborhood: "Mid-Cambridge",
    type: "park",
    legal: "ask-permission",
    confirmed: false,
    notes: "Near Broadway & Columbia. Community board at park entrance.",
  },
  {
    id: "binney-street-park",
    name: "Binney Street Park",
    coords: [42.3673, -71.0883],
    neighborhood: "Kendall Square",
    type: "park",
    legal: "permitted",
    confirmed: true,
    evidence: "binney-street-park.jpg",
    confirmedDate: "2025-05-13",
    notes: "Galileo Galilei Way at Fulkerson St. Poster confirmed on site.",
  },
  {
    id: "cic-cambridge",
    name: "CIC Cambridge",
    coords: [42.3626, -71.0819],
    neighborhood: "Kendall Square",
    type: "coworking",
    legal: "ask-permission",
    confirmed: false,
    notes: "Premier startup hub. Community boards near kitchens/elevators.",
  },
  {
    id: "cpl-valente",
    name: "Cambridge Public Library - Valente Branch",
    coords: [42.37, -71.081],
    neighborhood: "East Cambridge",
    type: "library",
    legal: "permitted",
    confirmed: false,
    notes: "Near East Cambridge tech offices. Submit to staff.",
  },
  {
    id: "1369-coffee",
    name: "1369 Coffee House",
    coords: [42.3654, -71.1032],
    neighborhood: "Central Square",
    type: "cafe",
    legal: "ask-permission",
    confirmed: false,
    notes: "Staple for remote workers and local professionals.",
  },
  {
    id: "andala-coffee",
    name: "Andala Coffee House",
    coords: [42.365, -71.104],
    neighborhood: "Central Square",
    type: "cafe",
    legal: "ask-permission",
    confirmed: false,
    notes: "High foot traffic, strong neighborhood community feel.",
  },
  {
    id: "lamplighter-broadway",
    name: "Lamplighter Brewing Co. - Broadway",
    coords: [42.368, -71.092],
    neighborhood: "Central Square",
    type: "brewery",
    legal: "ask-permission",
    confirmed: false,
    notes: "Functionally a co-working space during the day.",
  },
  {
    id: "smith-center",
    name: "Smith Campus Center",
    coords: [42.3725, -71.117],
    neighborhood: "Harvard Square",
    type: "university",
    legal: "restricted",
    confirmed: false,
    notes: "Harvard Square hub. University-affiliated groups get priority.",
  },
  {
    id: "broadsheet-coffee",
    name: "Broadsheet Coffee Roasters",
    coords: [42.376, -71.115],
    neighborhood: "Harvard Square",
    type: "cafe",
    legal: "ask-permission",
    confirmed: false,
    notes: "High concentration of academic and technical patrons.",
  },
  {
    id: "whole-foods-river",
    name: "Whole Foods Market (River St)",
    coords: [42.366, -71.112],
    neighborhood: "Cambridgeport",
    type: "grocery",
    legal: "ask-permission",
    confirmed: false,
    notes: "Competitive but high-visibility community board.",
  },
  {
    id: "star-market-porter",
    name: "Star Market (Porter Square)",
    coords: [42.388, -71.128],
    neighborhood: "Porter Square",
    type: "grocery",
    legal: "ask-permission",
    confirmed: false,
    notes: "Targets commuters using the Red Line.",
  },
];
