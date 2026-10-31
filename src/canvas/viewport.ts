// Pure viewport math. `s` = screen px per cm, (tx, ty) = screen position of world origin.
export interface View {
  s: number;
  tx: number;
  ty: number;
}

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 20;

export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** Fit a w×h cm rectangle into a viewW×viewH px viewport, centred, with padding in px. */
export function fitView(w: number, h: number, viewW: number, viewH: number, pad = 24): View {
  const availW = Math.max(1, viewW - 2 * pad);
  const availH = Math.max(1, viewH - 2 * pad);
  const s = clampScale(Math.min(availW / w, availH / h));
  return { s, tx: (viewW - w * s) / 2, ty: (viewH - h * s) / 2 };
}

/** Zoom by `factor` keeping the screen point (cx, cy) fixed. */
export function zoomAt(v: View, factor: number, cx: number, cy: number): View {
  const s = clampScale(v.s * factor);
  const k = s / v.s;
  return { s, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
}

export const screenToWorld = (v: View, sx: number, sy: number): [number, number] => [(sx - v.tx) / v.s, (sy - v.ty) / v.s];
export const worldToScreen = (v: View, x: number, y: number): [number, number] => [x * v.s + v.tx, y * v.s + v.ty];

/**
 * Two-finger gesture: given the start view and the start/current positions of both fingers,
 * return the view that keeps the world points under the fingers under them (pinch + pan).
 */
export function pinchView(start: View, a0: [number, number], b0: [number, number], a1: [number, number], b1: [number, number]): View {
  const d0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1;
  const d1 = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]) || 1;
  const s = clampScale(start.s * (d1 / d0));
  const m0: [number, number] = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2];
  const m1: [number, number] = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2];
  const [wx, wy] = screenToWorld(start, m0[0], m0[1]);
  return { s, tx: m1[0] - wx * s, ty: m1[1] - wy * s };
}

const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];

/** Smallest "nice" cm step whose on-screen length is at least minPx. */
export function niceStep(s: number, minPx: number): number {
  return NICE.find((n) => n * s >= minPx) ?? NICE[NICE.length - 1];
}
