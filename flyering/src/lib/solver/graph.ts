/**
 * Graph utilities for the Traveling Flyerperson problem.
 *
 * We model the placement locations as nodes in a complete weighted graph.
 * Edge weights are distances (haversine for now, could be walking/biking distance later).
 */

import type { FlyerLocation } from "../data/locations";

/**
 * Haversine distance between two lat/lng points in miles.
 */
export function haversine(a: [number, number], b: [number, number]): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Build a complete distance matrix from a list of locations.
 * Returns a 2D array where matrix[i][j] = distance from location i to location j.
 */
export function buildDistanceMatrix(locations: FlyerLocation[]): number[][] {
  const n = locations.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversine(locations[i].coords, locations[j].coords);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }

  return matrix;
}

/**
 * Total route distance given an ordered list of indices and a distance matrix.
 * Assumes the route returns to the start (Hamiltonian cycle).
 */
export function routeDistance(route: number[], matrix: number[][]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += matrix[route[i]][route[i + 1]];
  }
  // Return to start
  total += matrix[route[route.length - 1]][route[0]];
  return total;
}
