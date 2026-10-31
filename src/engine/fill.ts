import { bbox, centroid, pointAlong, pointInPolygon, polylineLength } from '../model/geometry';
import type { PlacedItem, Pt } from '../model/types';

export type Pattern = 'grid' | 'staggered';

/**
 * Planting positions inside a drift polygon.
 * grid: square lattice with `spacing`; staggered: triangular lattice (row pitch spacing·√3/2,
 * every other row shifted by spacing/2), so every neighbour is exactly `spacing` away.
 * The lattice is centred on the polygon's bounding box, leaving ~spacing/2 to the edges. A drift too small for the lattice
 * still gets one plant at its centre.
 */
export function fillPolygon(poly: Pt[], spacing: number, pattern: Pattern): Pt[] {
  if (poly.length < 3 || !(spacing > 0)) return [];
  const { minX, minY, maxX, maxY } = bbox(poly);
  const w = maxX - minX;
  const h = maxY - minY;
  const dy = pattern === 'staggered' ? (spacing * Math.sqrt(3)) / 2 : spacing;
  // Half a spacing between the outer plants and the drift edge.
  const rows = Math.max(1, Math.floor(h / dy));
  const cols = Math.max(1, Math.floor(w / spacing));
  const y0 = minY + (h - (rows - 1) * dy) / 2;
  const x0 = minX + (w - (cols - 1) * spacing) / 2;
  const out: Pt[] = [];
  // One extra column on each side so shifted rows can still reach the edges.
  for (let r = 0; r < rows; r++) {
    const shift = pattern === 'staggered' && r % 2 ? spacing / 2 : 0;
    const y = y0 + r * dy;
    for (let c = -1; c <= cols; c++) {
      const x = x0 + c * spacing + shift;
      if (pointInPolygon([x, y], poly)) out.push([x, y]);
    }
  }
  if (!out.length) out.push(centroid(poly));
  return out;
}

/** Evenly spaced positions along a path (straight row or curve), both ends included. */
export function fillPath(path: Pt[], spacing: number): Pt[] {
  if (!path.length || !(spacing > 0)) return [];
  const len = polylineLength(path);
  if (len < spacing / 2) return [path[0]];
  const n = Math.round(len / spacing) + 1;
  const step = len / (n - 1);
  return Array.from({ length: n }, (_, i) => pointAlong(path, i * step));
}

/** Plant positions of any placed item. */
export function itemPositions(it: PlacedItem): Pt[] {
  if (it.kind === 'plant') return [[it.x, it.y]];
  if (it.kind === 'drift') return fillPolygon(it.polygon, it.spacingCm, it.pattern);
  return fillPath(it.path, it.spacingCm);
}

export const itemCount = (it: PlacedItem) => (it.kind === 'plant' ? 1 : itemPositions(it).length);

/**
 * Spacing that gives (as close as possible) `target` plants. Count falls as spacing grows,
 * so binary search on spacing, then a fine scan nearby; returns the spacing whose count is closest
 * to the target (an exact count is not always possible for a given shape).
 */
export function spacingForCount(count: (spacing: number) => number, target: number, lo = 3, hi = 500): number {
  let best = hi;
  let bestErr = Infinity;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const c = count(mid);
    const err = Math.abs(c - target);
    if (err < bestErr || (err === bestErr && mid > best)) {
      best = mid;
      bestErr = err;
    }
    if (c > target) lo = mid;
    else hi = mid;
  }
  // Counts jump in steps (whole rows appear at once), so the search can skip an exact hit;
  // scan finely around the result and prefer the exact count.
  if (bestErr > 0) {
    for (let sp = best * 0.7; sp <= best * 1.3; sp += 0.1) {
      const err = Math.abs(count(sp) - target);
      if (err < bestErr) {
        best = sp;
        bestErr = err;
        if (!err) break;
      }
    }
  }
  return Math.round(best * 10) / 10;
}
