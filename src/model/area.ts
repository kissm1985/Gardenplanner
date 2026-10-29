import type { Area, Pt } from './types';

/** Corner points of an area (rectangle or free polygon), in cm. */
export function areaPoints(a: Area): Pt[] {
  return a.shape.kind === 'polygon'
    ? a.shape.points
    : [
        [0, 0],
        [a.widthCm, 0],
        [a.widthCm, a.lengthCm],
        [0, a.lengthCm],
      ];
}
