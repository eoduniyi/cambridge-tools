/**
 * Loaded Overpass data, available statically at build time.
 * Run `npm run fetch:overpass` to refresh.
 */

import signals from "./overpass/traffic-signals.json";
import boards from "./overpass/bulletin-board-candidates.json";
import transit from "./overpass/transit.json";
import summary from "./overpass/summary.json";

export interface OverpassPOI {
  id: number;
  lat: number;
  lng: number;
  name?: string;
  tags: Record<string, string>;
}

export const TRAFFIC_SIGNALS = signals as OverpassPOI[];
export const TRANSIT_POINTS = transit as OverpassPOI[];

// Filter out bike parking from board candidates — they don't typically have flyer boards
export const BOARD_CANDIDATES = (boards as OverpassPOI[]).filter(
  (p) => p.tags.amenity !== "bicycle_parking",
);

export const OVERPASS_SUMMARY = summary as {
  fetchedAt: string;
  bbox: string;
  counts: {
    trafficSignals: number;
    bulletinBoardCandidates: number;
    transit: number;
    byAmenity: Record<string, number>;
  };
};
