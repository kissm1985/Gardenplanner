import type { Area, Pt } from './types';

/** Corners used for an elliptic (round) area: enough for a smooth outline and exact-enough area sums. */
const ELLIPSE_STEPS = 72;

/** Outline points of an area (rectangle, ellipse / circle or free polygon), in cm. */
export function areaPoints(a: Area): Pt[] {
  if (a.shape.kind === 'ellipse') {
    const [rx, ry] = [a.widthCm / 2, a.lengthCm / 2];
    return Array.from({ length: ELLIPSE_STEPS }, (_, i) => {
      const t = (i / ELLIPSE_STEPS) * 2 * Math.PI;
      return [Math.round((rx + rx * Math.cos(t)) * 10) / 10, Math.round((ry + ry * Math.sin(t)) * 10) / 10] as Pt;
    });
  }
  return a.shape.kind === 'polygon'
    ? a.shape.points
    : [
        [0, 0],
        [a.widthCm, 0],
        [a.widthCm, a.lengthCm],
        [0, a.lengthCm],
      ];
}
