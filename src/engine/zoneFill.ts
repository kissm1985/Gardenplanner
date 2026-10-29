// Fill a region drawn on the plan with single plants picked at random from the user's list.
// Plants keep a distance of `density` × the average of the two spacings from each other and from
// what is already planted, stay inside the area and off lawns, paving, taps and manholes.
import { areaPoints } from '../model/area';
import { bbox, centroid, pointInPolygon, polygonArea } from '../model/geometry';
import { uid } from '../model/ids';
import type { Area, PlacedItem, Plant, Pt } from '../model/types';
import { itemPositions } from './fill';
import { fixturePoly, rng } from './generator';
import { mixAssign, type MixPart } from './mix';

export type ZoneMode = 'mix' | 'groups';

export interface ZoneFillInput {
  area: Area;
  polygon: Pt[];
  parts: MixPart[];
  plantDb: Plant[];
  /** Items already in the edited variant. */
  existing: PlacedItem[];
  mode: ZoneMode;
  /** Distance factor relative to the spacing: 0.8 dense … 1.2 loose. */
  density?: number;
  /** Remove what is planted in the region first. */
  clear?: boolean;
  seed?: number;
}

export interface ZoneFillResult {
  items: PlacedItem[];
  removeIds: string[];
  /** Plants added per species code. */
  counts: Record<string, number>;
}

const MAX_PLANTS = 3000;

const anchor = (it: PlacedItem): Pt => (it.kind === 'plant' ? [it.x, it.y] : centroid(it.kind === 'drift' ? it.polygon : it.path));

export function fillZone(inp: ZoneFillInput): ZoneFillResult {
  const r = rng(inp.seed ?? Math.floor(Math.random() * 2 ** 31));
  const density = inp.density ?? 0.95;
  const byCode = new Map(inp.plantDb.map((p) => [p.code, p]));
  const parts = inp.parts.filter((x) => byCode.has(x.code) && x.weight > 0);
  const empty: ZoneFillResult = { items: [], removeIds: [], counts: {} };
  if (!parts.length || inp.polygon.length < 3) return empty;

  const areaPts = areaPoints(inp.area);
  const blockers = inp.area.fixtures.map(fixturePoly).filter((p): p is Pt[] => !!p);
  const ok = (q: Pt) => pointInPolygon(q, inp.polygon) && pointInPolygon(q, areaPts) && !blockers.some((b) => pointInPolygon(q, b));

  const removeIds = inp.clear ? inp.existing.filter((it) => pointInPolygon(anchor(it), inp.polygon)).map((it) => it.id) : [];
  const removed = new Set(removeIds);

  // Spatial hash of every plant that is already there (spacing-aware).
  const maxSp = Math.max(...parts.map((p) => byCode.get(p.code)!.spacingCm), ...inp.existing.map((it) => byCode.get(it.plantId)?.spacingCm ?? 0));
  const cell = Math.max(10, maxSp * density);
  const grid = new Map<string, { q: Pt; sp: number }[]>();
  const key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const put = (q: Pt, sp: number) => {
    const k = key(q[0], q[1]);
    const arr = grid.get(k);
    if (arr) arr.push({ q, sp });
    else grid.set(k, [{ q, sp }]);
  };
  for (const it of inp.existing) {
    if (removed.has(it.id)) continue;
    const sp = byCode.get(it.plantId)?.spacingCm ?? 30;
    for (const q of itemPositions(it)) put(q, sp);
  }
  const free = (q: Pt, sp: number) => {
    const cx = Math.floor(q[0] / cell);
    const cy = Math.floor(q[1] / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const o of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          const need = (density * (sp + o.sp)) / 2;
          if ((q[0] - o.q[0]) ** 2 + (q[1] - o.q[1]) ** 2 < need * need) return false;
        }
    return true;
  };

  const b = bbox(inp.polygon);
  const rand = (): Pt => [b.minX + r() * (b.maxX - b.minX), b.minY + r() * (b.maxY - b.minY)];

  // Species for a point: weighted at random ("mix"), or that of the nearest group seed ("groups").
  const total = parts.reduce((s, p) => s + p.weight, 0);
  const counts: Record<string, number> = {};
  let pick: (q: Pt) => string;
  if (inp.mode === 'groups') {
    const avg = parts.reduce((s, p) => s + byCode.get(p.code)!.spacingCm * p.weight, 0) / total;
    const regionM2 = Math.abs(polygonArea(inp.polygon));
    // About 5–9 plants per group.
    const nSeeds = Math.max(parts.length * 2, Math.round(regionM2 / (avg * avg * 7)));
    const codes = mixAssign(nSeeds, parts, r);
    const seeds: { q: Pt; code: string }[] = [];
    for (let i = 0, tries = 0; seeds.length < nSeeds && tries < nSeeds * 200; tries++) {
      const q = rand();
      if (ok(q)) seeds.push({ q, code: codes[i++] });
    }
    pick = (q) => {
      let best = seeds[0];
      let bd = Infinity;
      for (const s of seeds) {
        const d = (s.q[0] - q[0]) ** 2 + (s.q[1] - q[1]) ** 2;
        if (d < bd) [bd, best] = [d, s];
      }
      return best?.code ?? parts[0].code;
    };
  } else {
    // Weighted pick, nudged towards species that are behind their share (big plants fail more often).
    pick = () => {
      const n = Object.values(counts).reduce((a, x) => a + x, 0) + 1;
      const w = parts.map((p) => (p.weight / total) * (1 + Math.max(0, p.weight / total - (counts[p.code] ?? 0) / n) * 4));
      let t = r() * w.reduce((a, x) => a + x, 0);
      for (let i = 0; i < parts.length; i++) if ((t -= w[i]) <= 0) return parts[i].code;
      return parts[parts.length - 1].code;
    };
  }

  // Dart throwing: many random tries give a natural, fairly even cover.
  const minSp = Math.min(...parts.map((p) => byCode.get(p.code)!.spacingCm));
  const regionArea = Math.max(1, Math.abs(polygonArea(inp.polygon)));
  const tries = Math.min(80000, Math.max(3000, Math.round((regionArea / (minSp * minSp)) * 40)));
  const items: PlacedItem[] = [];
  for (let i = 0; i < tries && items.length < MAX_PLANTS; i++) {
    const [x, y] = rand().map(Math.round);
    const q: Pt = [x, y];
    if (!ok(q)) continue;
    const code = pick(q);
    const sp = byCode.get(code)!.spacingCm;
    // Half a spacing inside the area's edge, so the plant does not hang over the wall or path.
    const m = sp / 2;
    if (![[m, 0], [-m, 0], [0, m], [0, -m]].every(([dx, dy]) => pointInPolygon([x + dx, y + dy], areaPts))) continue;
    if (!free(q, sp)) continue;
    put(q, sp);
    counts[code] = (counts[code] ?? 0) + 1;
    items.push({ kind: 'plant', id: uid('i'), plantId: code, x, y, status: 'needed' });
  }
  return { items, removeIds, counts };
}
