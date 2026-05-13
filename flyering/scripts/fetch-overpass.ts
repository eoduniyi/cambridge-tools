/**
 * Fetches Cambridge, MA data from the OpenStreetMap Overpass API.
 *
 * Outputs cached JSON files to src/lib/data/overpass/ so we don't
 * hit the API on every page load.
 *
 * Usage: npx tsx scripts/fetch-overpass.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter";

// Cambridge bounding box (approx 6.4 sq mi)
// south, west, north, east
const BBOX = "42.3530,-71.1600,42.4040,-71.0640";

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface POI {
  id: number;
  lat: number;
  lng: number;
  name?: string;
  tags: Record<string, string>;
}

async function fetchOverpass(
  query: string,
  attempt = 1,
): Promise<OverpassResponse> {
  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "flyering-cambridge/0.1 (cambridge-dev.org)",
        Accept: "application/json",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(
        `Overpass error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  } catch (err) {
    if (attempt < 3) {
      console.log(`  retry ${attempt}/3 after ${attempt * 5}s...`);
      await new Promise((r) => setTimeout(r, attempt * 5000));
      return fetchOverpass(query, attempt + 1);
    }
    throw err;
  }
}

function elementsToPOIs(elements: OverpassElement[]): POI[] {
  return elements
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) return null;

      return {
        id: el.id,
        lat,
        lng,
        name: el.tags?.name,
        tags: el.tags ?? {},
      };
    })
    .filter((p): p is POI => p !== null);
}

async function main() {
  const outDir = join(process.cwd(), "src/lib/data/overpass");
  mkdirSync(outDir, { recursive: true });

  // 1. Traffic signals
  console.log("Fetching traffic signals...");
  const signalsQuery = `
		[out:json][timeout:60];
		(
			node["highway"="traffic_signals"](${BBOX});
		);
		out body;
	`;
  const signals = await fetchOverpass(signalsQuery);
  const signalPOIs = elementsToPOIs(signals.elements);
  writeFileSync(
    join(outDir, "traffic-signals.json"),
    JSON.stringify(signalPOIs, null, 2),
  );
  console.log(`  → ${signalPOIs.length} traffic signals`);

  // 2. Plausible bulletin board locations
  // cafes, libraries, community centers, bars, pubs, bookstores
  console.log("Fetching bulletin board candidates...");

  const boardQueries: Array<[string, string]> = [
    [
      "cafes",
      `node["amenity"="cafe"](${BBOX}); way["amenity"="cafe"](${BBOX});`,
    ],
    [
      "libraries",
      `node["amenity"="library"](${BBOX}); way["amenity"="library"](${BBOX});`,
    ],
    [
      "community_centres",
      `node["amenity"="community_centre"](${BBOX}); way["amenity"="community_centre"](${BBOX});`,
    ],
    ["bars_pubs", `node["amenity"~"^(bar|pub)$"](${BBOX});`],
    ["bookstores", `node["shop"="books"](${BBOX});`],
    ["bike_parking", `node["amenity"="bicycle_parking"](${BBOX});`],
  ];

  const allBoards: POI[] = [];
  const seen = new Set<number>();

  for (const [label, body] of boardQueries) {
    console.log(`  → ${label}...`);
    const query = `[out:json][timeout:60];( ${body} ); out center;`;
    const result = await fetchOverpass(query);
    const pois = elementsToPOIs(result.elements);
    for (const p of pois) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        allBoards.push(p);
      }
    }
    console.log(`     ${pois.length} found (${allBoards.length} total unique)`);
    // Be polite to the API
    await new Promise((r) => setTimeout(r, 1000));
  }

  writeFileSync(
    join(outDir, "bulletin-board-candidates.json"),
    JSON.stringify(allBoards, null, 2),
  );
  console.log(`  → ${allBoards.length} plausible board locations`);

  // Breakdown by amenity type
  const byAmenity: Record<string, number> = {};
  for (const p of allBoards) {
    const key = p.tags.amenity ?? p.tags.shop ?? "other";
    byAmenity[key] = (byAmenity[key] ?? 0) + 1;
  }
  console.log("  Breakdown:", byAmenity);

  // 3. MBTA stations (subway/rail stops)
  console.log("Fetching MBTA stations...");
  const transitQuery = `
		[out:json][timeout:60];
		(
			node["railway"="station"](${BBOX});
			node["railway"="subway_entrance"](${BBOX});
			node["public_transport"="station"](${BBOX});
		);
		out body;
	`;
  const transit = await fetchOverpass(transitQuery);
  const transitPOIs = elementsToPOIs(transit.elements);
  writeFileSync(
    join(outDir, "transit.json"),
    JSON.stringify(transitPOIs, null, 2),
  );
  console.log(`  → ${transitPOIs.length} transit points`);

  // Write a summary
  const summary = {
    fetchedAt: new Date().toISOString(),
    bbox: BBOX,
    counts: {
      trafficSignals: signalPOIs.length,
      bulletinBoardCandidates: allBoards.length,
      transit: transitPOIs.length,
      byAmenity,
    },
  };
  writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));

  console.log("\nDone. Files written to src/lib/data/overpass/");
}

main().catch((err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
