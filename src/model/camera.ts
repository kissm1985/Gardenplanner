// Viewpoint of the visualisation brief.
import type { Area } from './types';

/** Horizontal field of view, degrees. */
export const CAMERA_FOV = 60;

/** How far the view cone is drawn, cm: long enough to cross the area. */
export const coneLength = (area: Area) => Math.max(300, Math.hypot(area.widthCm, area.lengthCm) * 0.7);

/** Default viewing direction from a point: towards the middle of the area (degrees, 0 = +x, 90 = +y). */
export const dirTowardsCentre = (area: Area, x: number, y: number) => (Math.atan2(area.lengthCm / 2 - y, area.widthCm / 2 - x) * 180) / Math.PI;
