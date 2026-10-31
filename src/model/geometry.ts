import type { Pt } from './types';

/** Ray-casting point-in-polygon test. */
export function pointInPolygon([x, y]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const snap = (v: number, step: number) => Math.round(v / step) * step;

export const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function polylineLength(path: Pt[]): number {
  let l = 0;
  for (let i = 1; i < path.length; i++) l += dist(path[i - 1], path[i]);
  return l;
}

/** Shoelace area (absolute), cm². */
export function polygonArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  return Math.abs(a) / 2;
}

export function centroid(poly: Pt[]): Pt {
  const n = poly.length || 1;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}

export function bbox(pts: Pt[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Ramer–Douglas–Peucker simplification of a freehand stroke. */
export function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  let maxD = 0;
  let idx = 0;
  const last = pts.length - 1;
  for (let i = 1; i < last; i++) {
    const d = segDist(pts[i], pts[0], pts[last]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [pts[0], pts[last]];
  const left = simplify(pts.slice(0, idx + 1), tol);
  return [...left.slice(0, -1), ...simplify(pts.slice(idx), tol)];
}

/** Point at distance `d` along a polyline. */
export function pointAlong(path: Pt[], d: number): Pt {
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const l = dist(path[i - 1], path[i]);
    if (acc + l >= d || i === path.length - 1) {
      const t = l ? Math.min(1, Math.max(0, (d - acc) / l)) : 0;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
    }
    acc += l;
  }
  return path[0];
}
