/**
 * TSP Solvers for the Traveling Flyerperson problem.
 *
 * 1. Brute force (exact, cached per startIdx)
 * 2. Nearest neighbor heuristic (greedy, O(n²))
 * 3. 2-opt local search (improvement heuristic)
 */

import { routeDistance } from "./graph";

export interface SolverResult {
  route: number[];
  distance: number;
  algorithm: string;
  iterations?: number;
}

// Cache brute force results by startIdx to avoid recomputing 40M permutations
const bfCache = new Map<number, SolverResult>();

/**
 * Brute force: try all permutations. O(n!).
 * Results are cached per startIdx since the optimal cycle is the same
 * regardless of start (just rotated), but we cache the specific representation.
 */
export function bruteForce(
  matrix: number[][],
  startIdx: number = 0,
): SolverResult {
  if (bfCache.has(startIdx)) return bfCache.get(startIdx)!;

  const n = matrix.length;
  const rest: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i !== startIdx) rest.push(i);
  }

  let bestDist = Infinity;
  let bestRoute: number[] = [];
  let iterations = 0;

  // Iterative Heap's algorithm to avoid deep recursion overhead
  const c = new Array(rest.length).fill(0);
  let perm = [...rest];

  // Evaluate initial permutation
  iterations++;
  let d = routeDistanceFast(startIdx, perm, matrix);
  bestDist = d;
  bestRoute = [startIdx, ...perm];

  let i = 0;
  while (i < perm.length) {
    if (c[i] < i) {
      if (i % 2 === 0) {
        [perm[0], perm[i]] = [perm[i], perm[0]];
      } else {
        [perm[c[i]], perm[i]] = [perm[i], perm[c[i]]];
      }
      iterations++;
      d = routeDistanceFast(startIdx, perm, matrix);
      if (d < bestDist) {
        bestDist = d;
        bestRoute = [startIdx, ...perm];
      }
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }

  const result: SolverResult = {
    route: bestRoute,
    distance: bestDist,
    algorithm: "Brute Force (Exact)",
    iterations,
  };

  bfCache.set(startIdx, result);
  return result;
}

/**
 * Fast route distance: avoids array allocation.
 * Computes distance for [startIdx, ...perm] as a cycle.
 */
function routeDistanceFast(
  startIdx: number,
  perm: number[],
  matrix: number[][],
): number {
  let total = matrix[startIdx][perm[0]];
  for (let i = 0; i < perm.length - 1; i++) {
    total += matrix[perm[i]][perm[i + 1]];
  }
  total += matrix[perm[perm.length - 1]][startIdx];
  return total;
}

/**
 * Nearest Neighbor heuristic: always go to the closest unvisited node.
 * O(n²), fast.
 */
export function nearestNeighbor(
  matrix: number[][],
  startIdx: number = 0,
): SolverResult {
  const n = matrix.length;
  const visited = new Uint8Array(n);
  visited[startIdx] = 1;
  const route = [startIdx];

  let current = startIdx;
  for (let step = 1; step < n; step++) {
    let nearest = -1;
    let nearestDist = Infinity;

    for (let j = 0; j < n; j++) {
      if (!visited[j] && matrix[current][j] < nearestDist) {
        nearest = j;
        nearestDist = matrix[current][j];
      }
    }

    route.push(nearest);
    visited[nearest] = 1;
    current = nearest;
  }

  return {
    route,
    distance: routeDistance(route, matrix),
    algorithm: "Nearest Neighbor",
    iterations: n - 1,
  };
}

/**
 * 2-opt improvement: iteratively reverse segments to reduce total distance.
 * Optimized: caches current distance, uses delta evaluation.
 */
export function twoOpt(
  matrix: number[][],
  initialRoute: number[],
): SolverResult {
  let route = [...initialRoute];
  let currentDist = routeDistance(route, matrix);
  let improved = true;
  let iterations = 0;

  while (improved) {
    improved = false;
    for (let i = 1; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        iterations++;

        // Delta evaluation: only check the edges that change
        const a = route[i - 1];
        const b = route[i];
        const c = route[j];
        const d = j + 1 < route.length ? route[j + 1] : route[0]; // wrap for cycle

        const oldEdges = matrix[a][b] + matrix[c][d];
        const newEdges = matrix[a][c] + matrix[b][d];

        if (newEdges < oldEdges) {
          // Reverse segment [i..j]
          let left = i;
          let right = j;
          while (left < right) {
            [route[left], route[right]] = [route[right], route[left]];
            left++;
            right--;
          }
          currentDist -= oldEdges - newEdges;
          improved = true;
        }
      }
    }
  }

  return {
    route,
    distance: currentDist,
    algorithm: "2-Opt Local Search",
    iterations,
  };
}
