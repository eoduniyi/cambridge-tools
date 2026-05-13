# The Traveling Flyerperson

An interactive exploration of the locally generic problem: **where do I place these flyers in Cambridge, MA?**

Built for [cambridge-dev.org](https://www.cambridge-dev.org/).

## The Problem

Given a set of valid flyering locations across Cambridge (~6.4 sq mi), anchored at the Cambridge Public Library, find the optimal route to visit all locations and return home. This is a variant of the Traveling Salesman Problem (TSP) with real-world constraints:

- **Legal constraints**: Cambridge municipal code prohibits posting on public infrastructure ($300/violation)
- **Permission requirements**: Most private locations require explicit permission
- **Geographic bounds**: The city's shape and road network constrain movement
- **Time dynamics**: Population flow varies by time of day and season

## Algorithms

The page lets you compare three approaches:

1. **Brute Force** — Exact solution via exhaustive permutation search. O(n!) so only feasible for our ~10 locations.
2. **Nearest Neighbor** — Greedy heuristic. Always go to the closest unvisited stop. Fast but often suboptimal.
3. **2-Opt** — Local search improvement. Start from nearest neighbor, iteratively reverse route segments to reduce total distance.

## Stack

- SvelteKit (static adapter)
- Leaflet (OpenStreetMap + CARTO dark tiles)
- TypeScript

## Development

```bash
npm install
npm run dev
```

## What's Next

- Real walking/biking distances (OSRM or GraphHopper)
- Population density / foot traffic heatmap overlay
- Time-of-day simulation
- Confirmed vs. estimated placement visualization
- Abstract/artistic route visualizations
