// Fixed (non-plant) elements: labels and default sizes for new ones.
import type { Fixture, FixtureType } from './types';
import { labels } from '../i18n';

/** Default element names in both languages (also used to translate stored default labels). */
export const FIXTURE_LABEL_PAIRS: Record<FixtureType, [hu: string, en: string]> = {
  walnut: ['Diófa', 'Walnut'],
  tree: ['Fa', 'Tree'],
  window: ['Ablak', 'Window'],
  tap: ['Csap', 'Tap'],
  manhole: ['Akna', 'Manhole'],
  paving: ['Burkolat', 'Paving'],
  fence: ['Kerítés', 'Fence'],
  lawn: ['Gyep', 'Lawn'],
  wall: ['Fal', 'Wall'],
  gravel: ['Kavicságy', 'Gravel bed'],
  path: ['Ösvény', 'Path'],
  pond: ['Kerti tó', 'Pond'],
  well: ['Kút', 'Well'],
  shed: ['Tároló', 'Shed'],
  compost: ['Komposztáló', 'Compost bin'],
  rainBarrel: ['Esővízgyűjtő', 'Rain barrel'],
  bench: ['Pad', 'Bench'],
  raisedBed: ['Magaságyás', 'Raised bed'],
  other: ['Egyéb', 'Other'],
};

export const FIXTURE_LABEL: Record<FixtureType, string> = labels(FIXTURE_LABEL_PAIRS);

/** Round (drawn as an ellipse in their box). */
export const ROUND = new Set<FixtureType>(['pond', 'well', 'rainBarrel']);
/** No plants on these: the rules warn, the idea generator and zone fill leave them free. Gravel and raised beds can be planted. */
export const KEEP_CLEAR = new Set<FixtureType>(['tap', 'manhole', 'paving', 'path', 'pond', 'well', 'shed', 'compost', 'rainBarrel', 'bench']);
/** Long or large elements: they only move once selected, so dragging the plan does not shift them by accident. */
export const MOVE_WHEN_SELECTED = new Set<FixtureType>(['wall', 'fence', 'paving', 'lawn', 'gravel', 'path', 'pond', 'shed', 'raisedBed']);

/** Strip-like elements drawn by dragging on the plan; thickness for the walls/fences. */
export const STRIP_THICKNESS: Partial<Record<FixtureType, number>> = { wall: 16, fence: 6, path: 80 };
export const DRAG_DRAWN = new Set<FixtureType>(['paving', 'wall', 'fence', 'gravel', 'path', 'pond', 'shed', 'raisedBed']);

/** Default box (w × h, cm) of the box-shaped elements, placed centred on a tap. */
const BOX: Partial<Record<FixtureType, [number, number]>> = {
  window: [120, 20],
  paving: [100, 100],
  fence: [6, 200],
  wall: [16, 200],
  gravel: [150, 100],
  path: [80, 300],
  pond: [200, 140],
  well: [100, 100],
  shed: [200, 150],
  compost: [100, 100],
  rainBarrel: [60, 60],
  bench: [150, 50],
  raisedBed: [120, 240],
};

/** Defaults for a new fixture, centred on (x, y). */
export function newFixture(type: FixtureType, x: number, y: number): Omit<Fixture, 'id'> {
  const label = FIXTURE_LABEL[type];
  if (type === 'walnut') return { type, label, x, y, radius: 450 };
  if (type === 'tree') return { type, label, x, y, radius: 150 };
  const [w, h] = BOX[type] ?? [40, 40];
  return { type, label, x: x - w / 2, y: y - h / 2, w, h };
}

/** Change an element's type, keeping its place; size fields are converted between box and circle. */
export function retype(f: Fixture, type: FixtureType): Partial<Fixture> {
  const label = !f.label || f.label === FIXTURE_LABEL[f.type] ? FIXTURE_LABEL[type] : f.label;
  const toCircle = type === 'walnut' || type === 'tree';
  if (toCircle && f.radius == null) {
    const r = Math.round(Math.max(f.w ?? 0, f.h ?? 0) / 2) || (type === 'walnut' ? 450 : 150);
    return { type, label, x: f.x + (f.w ?? 0) / 2, y: f.y + (f.h ?? 0) / 2, radius: r, w: undefined, h: undefined };
  }
  if (!toCircle && f.radius != null) {
    const [w, h] = BOX[type] ?? [40, 40];
    return { type, label, x: f.x - w / 2, y: f.y - h / 2, w, h, radius: undefined };
  }
  return { type, label };
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
