/**
 * TSP Solvers for the Traveling Flyerperson problem.
 *
 * We implement multiple approaches so the interactive page can compare them:
 * 1. Brute force (exact, only feasible for small n)
 * 2. Nearest neighbor heuristic (greedy, O(n²))
 * 3. 2-opt local search (improvement heuristic)
 *
 * All solvers return a route as an ordered array of location indices,
 * starting from the anchor (index 0).
 */

import { routeDistance } from "./graph";

export interface SolverResult {
  route: number[];
  distance: number;
  algorithm: string;
  iterations?: number;
}

/**
 * Brute force: try all permutations. O(n!) — only use for n <= 12ish.
 * Fixes startIdx as start, permutes the rest.
 */
export function bruteForce(
  matrix: number[][],
  startIdx: number = 0,
): SolverResult {
  const n = matrix.length;
  const rest = Array.from({ length: n }, (_, i) => i).filter(
    (i) => i !== startIdx,
  );

  let bestRoute = [startIdx, ...rest];
  let bestDist = routeDistance(bestRoute, matrix);
  let iterations = 0;

  function permute(arr: number[], l: number): void {
    if (l === arr.length - 1) {
      iterations++;
      const candidate = [startIdx, ...arr];
      const d = routeDistance(candidate, matrix);
      if (d < bestDist) {
        bestDist = d;
        bestRoute = [...candidate];
      }
      return;
    }
    for (let i = l; i < arr.length; i++) {
      [arr[l], arr[i]] = [arr[i], arr[l]];
      permute(arr, l + 1);
      [arr[l], arr[i]] = [arr[i], arr[l]];
    }
  }

  permute(rest, 0);

  return {
    route: bestRoute,
    distance: bestDist,
    algorithm: "Brute Force (Exact)",
    iterations,
  };
}

/**
 * Nearest Neighbor heuristic: always go to the closest unvisited node.
 * O(n²), fast but often suboptimal.
 */
export function nearestNeighbor(
  matrix: number[][],
  startIdx: number = 0,
): SolverResult {
  const n = matrix.length;
  const visited = new Set<number>([startIdx]);
  const route = [startIdx];

  let current = startIdx;
  while (visited.size < n) {
    let nearest = -1;
    let nearestDist = Infinity;

    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && matrix[current][j] < nearestDist) {
        nearest = j;
        nearestDist = matrix[current][j];
      }
    }

    route.push(nearest);
    visited.add(nearest);
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
 * Starts from a given route (e.g., nearest neighbor output).
 */
export function twoOpt(
  matrix: number[][],
  initialRoute: number[],
): SolverResult {
  let route = [...initialRoute];
  let improved = true;
  let iterations = 0;

  while (improved) {
    improved = false;
    for (let i = 1; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        iterations++;
        const newRoute = twoOptSwap(route, i, j);
        const newDist = routeDistance(newRoute, matrix);
        const oldDist = routeDistance(route, matrix);
        if (newDist < oldDist) {
          route = newRoute;
          improved = true;
        }
      }
    }
  }

  return {
    route,
    distance: routeDistance(route, matrix),
    algorithm: "2-Opt Local Search",
    iterations,
  };
}

function twoOptSwap(route: number[], i: number, j: number): number[] {
  const newRoute = route.slice(0, i);
  // Reverse the segment between i and j
  for (let k = j; k >= i; k--) {
    newRoute.push(route[k]);
  }
  // Add the rest
  for (let k = j + 1; k < route.length; k++) {
    newRoute.push(route[k]);
  }
  return newRoute;
}
