import { describe, expect, it } from 'vitest';
import { SEED_PLANTS } from '../../src/data/plants.seed';
import { evaluate } from '../../src/engine/rules';
import { fillZone } from '../../src/engine/zoneFill';
import { pointInPolygon } from '../../src/model/geometry';
import type { Pt } from '../../src/model/types';
import { newProject } from '../../src/store/projectStore';

const proj = newProject(['house-strip', 'lawn-garden']);
const [strip, lawn] = proj.areas;
const db = SEED_PLANTS;
const zone: Pt[] = [[0, 100], [120, 100], [120, 500], [0, 500]];
const parts = [{ code: 'LA', weight: 1 }, { code: 'SA', weight: 1 }, { code: 'CO', weight: 1 }];

describe('zone fill', () => {
  it('fills only the drawn region, from the list, without spacing warnings', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const res = fillZone({ area: strip, polygon: zone, parts, plantDb: db, existing: [], mode: 'mix', seed });
      expect(res.items.length).toBeGreaterThan(15);
      for (const it of res.items) {
        expect(['LA', 'SA', 'CO']).toContain(it.plantId);
        if (it.kind === 'plant') expect(pointInPolygon([it.x, it.y], zone)).toBe(true);
      }
      const bad = evaluate(strip, res.items, db, proj.settings).filter((w) => w.rule === 'spacing' || w.rule === 'outside');
      expect(bad).toEqual([]);
      for (const c of ['LA', 'SA', 'CO']) expect(res.counts[c]).toBeGreaterThan(2);
    }
  });

  it('keeps away from plants already there; "clear" removes them first', () => {
    const existing = [{ kind: 'plant' as const, id: 'old', plantId: 'NE', x: 60, y: 300, status: 'needed' as const }];
    const kept = fillZone({ area: strip, polygon: zone, parts, plantDb: db, existing, mode: 'mix', seed: 3 });
    expect(kept.removeIds).toEqual([]);
    expect(evaluate(strip, [...existing, ...kept.items], db, proj.settings).filter((w) => w.rule === 'spacing')).toEqual([]);
    const cleared = fillZone({ area: strip, polygon: zone, parts, plantDb: db, existing, mode: 'mix', seed: 3, clear: true });
    expect(cleared.removeIds).toEqual(['old']);
  });

  it('groups: neighbours are mostly the same species; no plants on the lawn', () => {
    const big: Pt[] = [[0, 0], [500, 0], [500, 1200], [0, 1200]];
    const res = fillZone({ area: lawn, polygon: big, parts, plantDb: db, existing: [], mode: 'groups', seed: 4 });
    const lawnFx = lawn.fixtures.find((f) => f.type === 'lawn')!;
    for (const it of res.items) if (it.kind === 'plant') expect(pointInPolygon([it.x, it.y], lawnFx.polygon!)).toBe(false);
    // Nearest neighbour of the same species in most cases.
    const pts = res.items.filter((i) => i.kind === 'plant') as { x: number; y: number; plantId: string }[];
    let same = 0;
    for (const a of pts) {
      let best = pts[0] === a ? pts[1] : pts[0];
      for (const b of pts) if (b !== a && (b.x - a.x) ** 2 + (b.y - a.y) ** 2 < (best.x - a.x) ** 2 + (best.y - a.y) ** 2) best = b;
      if (best.plantId === a.plantId) same++;
    }
    expect(same / pts.length).toBeGreaterThan(0.6);
  });

  it('no same neighbours: same species are never side by side; extra distance thins it out', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const res = fillZone({ area: strip, polygon: zone, parts, plantDb: db, existing: [], mode: 'mix', seed, noSameNeighbour: true });
      const ps = res.items.flatMap((it) => (it.kind === 'plant' ? [{ q: [it.x, it.y] as Pt, c: it.plantId }] : []));
      const sp = new Map(db.map((p) => [p.code, p.spacingCm]));
      // Two of the same species are never side by side: at least 1.6 × the planting gap apart.
      for (const a of ps)
        for (const b of ps)
          if (a !== b && a.c === b.c) expect(Math.hypot(a.q[0] - b.q[0], a.q[1] - b.q[1])).toBeGreaterThanOrEqual(1.6 * 0.95 * sp.get(a.c)! - 1);
      const sparse = fillZone({ area: strip, polygon: zone, parts, plantDb: db, existing: [], mode: 'mix', seed, extraGapCm: 30 });
      expect(sparse.items.length).toBeLessThan(res.items.length * 0.7);
      const pts = sparse.items.flatMap((it) => (it.kind === 'plant' ? [[it.x, it.y]] : []));
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])).toBeGreaterThan(30);
    }
  });
});
