// Fixed (non-plant) elements: labels and default sizes for new ones.
import type { Fixture, FixtureType } from './types';
import { labels } from '../i18n';

export const FIXTURE_LABEL: Record<FixtureType, string> = labels({
  walnut: ['Diófa', 'Walnut'],
  tree: ['Fa', 'Tree'],
  window: ['Ablak', 'Window'],
  tap: ['Csap', 'Tap'],
  manhole: ['Akna', 'Manhole'],
  paving: ['Burkolat', 'Paving'],
  fence: ['Kerítés', 'Fence'],
  lawn: ['Gyep', 'Lawn'],
  wall: ['Fal', 'Wall'],
  other: ['Egyéb', 'Other'],
});

/** Strip-like elements drawn by dragging on the plan; thickness for the walls/fences. */
export const STRIP_THICKNESS: Partial<Record<FixtureType, number>> = { wall: 16, fence: 6 };
export const DRAG_DRAWN = new Set<FixtureType>(['paving', 'wall', 'fence']);

/** Defaults for a new fixture, centred on (x, y). */
export function newFixture(type: FixtureType, x: number, y: number): Omit<Fixture, 'id'> {
  const label = FIXTURE_LABEL[type];
  switch (type) {
    case 'walnut':
      return { type, label, x, y, radius: 450 };
    case 'tree':
      return { type, label, x, y, radius: 150 };
    case 'window':
      return { type, label, x: x - 60, y: y - 10, w: 120, h: 20 };
    case 'paving':
      return { type, label, x: x - 50, y: y - 50, w: 100, h: 100 };
    case 'fence':
      return { type, label, x: x - 3, y: y - 100, w: 6, h: 200 };
    case 'wall':
      return { type, label, x: x - 8, y: y - 100, w: 16, h: 200 };
    default:
      return { type, label, x: x - 20, y: y - 20, w: 40, h: 40 };
  }
}

/** Element dragged from a to b: paving is the rectangle a–b; a wall/fence runs along the longer axis. */
export function dragFixture(type: FixtureType, a: [number, number], b: [number, number]): Omit<Fixture, 'id'> {
  const label = FIXTURE_LABEL[type];
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])].map(Math.round);
  const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])].map(Math.round);
  const t = STRIP_THICKNESS[type];
  if (t == null) return { type, label, x: x0, y: y0, w: Math.max(10, x1 - x0), h: Math.max(10, y1 - y0) };
  if (x1 - x0 >= y1 - y0) return { type, label, x: x0, y: Math.round(a[1] - t / 2), w: Math.max(t, x1 - x0), h: t };
  return { type, label, x: Math.round(a[0] - t / 2), y: y0, w: t, h: Math.max(t, y1 - y0) };
}
