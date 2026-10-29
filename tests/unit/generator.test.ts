import { describe, expect, it } from 'vitest';
import { SEED_PLANTS } from '../../src/data/plants.seed';
import { candidates, clipRect, colourFamilies, generateIdea, plantKinds, type PlantKind } from '../../src/engine/generator';
import { evaluate } from '../../src/engine/rules';
import { newProject } from '../../src/store/projectStore';

const proj = newProject(['house-strip', 'lawn-garden']);
const [strip, lawn] = proj.areas;
const db = SEED_PLANTS;

describe('idea generator', () => {
  it('colour families from Hungarian colour words', () => {
    const la = db.find((p) => p.code === 'LA')!;
    expect(colourFamilies(la).has('purple')).toBe(true);
  });

  it('clips a polygon to a rectangle', () => {
    const c = clipRect([[0, 0], [100, 0], [100, 100], [0, 100]], 50, -10, 200, 40).map(String).sort();
    expect(c).toEqual(['100,0', '100,40', '50,0', '50,40']);
  });

  it('candidates respect height limit, toxicity, thorns and sun', () => {
    const c = candidates(strip, db);
    expect(c.length).toBeGreaterThan(5);
    for (const p of c) {
      expect(p.maxHeightCm).toBeLessThanOrEqual(50);
      expect(p.toxic).toBe('no');
      expect(p.thorny).toBe(false);
      expect(p.sun).toContain('sun');
    }
  });

  for (const [name, area] of [['house strip', strip], ['lawn garden', lawn]] as const)
    it(`${name}: 20 random ideas, no errors or warnings from the rule engine`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const idea = generateIdea(area, db, proj.settings, { seed });
        expect(idea.items.length).toBeGreaterThan(2);
        expect(idea.species.length).toBeGreaterThanOrEqual(2);
        const bad = evaluate(area, idea.items, db, proj.settings).filter((w) => w.severity !== 'info');
        expect(bad.map((w) => `${seed}: ${w.message}`)).toEqual([]);
      }
    });

  it('same seed → same idea; different seeds differ', () => {
    const a = generateIdea(lawn, db, proj.settings, { seed: 7 });
    const b = generateIdea(lawn, db, proj.settings, { seed: 7 });
    const c = generateIdea(lawn, db, proj.settings, { seed: 8 });
    const key = (i: typeof a) => i.items.map((x) => x.plantId).join();
    expect(key(a)).toBe(key(b));
    expect(key(a) === key(c) && a.palette === c.palette).toBe(false);
  });

  it('tall plants at the back (wall side) of the house strip', () => {
    const idea = generateIdea(strip, db, proj.settings, { seed: 3 });
    const h = new Map(db.map((p) => [p.code, p.maxHeightCm]));
    const xs = idea.items.map((it) => (it.kind === 'drift' ? { x: it.polygon[0][0], h: h.get(it.plantId)! } : null)).filter(Boolean) as { x: number; h: number }[];
    const back = xs.filter((p) => p.x < 30).map((p) => p.h);
    const front = xs.filter((p) => p.x >= 30).map((p) => p.h);
    expect(Math.min(...back)).toBeGreaterThanOrEqual(Math.max(...front));
  });
});

describe('idea generator: plant types', () => {
  // A plain back garden: 8 × 15 m, sunny, no restrictions, a fence at the back (x = 0).
  const back = (() => {
    const p = newProject(['lawn-garden']);
    const a = p.areas[0];
    return {
      ...a,
      name: 'Hátsó kert',
      widthCm: 800,
      lengthCm: 1500,
      constraints: { ...a.constraints, nonToxic: false, noThorns: false, maxTrees: 2 },
      fixtures: [{ id: 'f1', type: 'fence' as const, label: 'Kerítés', x: -6, y: 0, w: 6, h: 1500 }],
    };
  })();
  const kinds = (it: { plantId: string }) => plantKinds(db.find((p) => p.code === it.plantId)!);

  it('classifies the built-in list', () => {
    const k = (c: string) => [...plantKinds(db.find((p) => p.code === c)!)].sort();
    expect(k('LN')).toContain('hedge');
    expect(k('TS')).toContain('hedge');
    expect(k('JH')).toContain('groundcover');
    expect(k('MI')).toEqual(['grass']);
    expect(k('LA')).toEqual(['perennial']);
    expect(k('FA')).toEqual(['tree']);
    expect(k('PH')).toContain('shrub');
  });

  for (const set of [['hedge', 'shrub', 'perennial'], ['tree', 'shrub', 'groundcover'], ['hedge', 'tree', 'shrub', 'perennial', 'grass', 'groundcover'], ['shrub'], ['hedge']] as PlantKind[][])
    it(`back garden with ${set.join(' + ')}: requested types appear, no warnings`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const idea = generateIdea(back, db, proj.settings, { seed, kinds: set });
        expect(idea.items.length).toBeGreaterThan(0);
        const bad = evaluate(back, idea.items, db, proj.settings).filter((w) => w.severity !== 'info');
        expect(bad.map((w) => `${seed}: ${w.message}`)).toEqual([]);
        const got = new Set(idea.items.flatMap((it) => [...kinds(it)]));
        for (const k of set) if (k !== 'grass' && k !== 'groundcover') expect([seed, k, got.has(k)]).toEqual([seed, k, true]);
      }
    });

  it('hedge runs along the fence side; trees stand alone', () => {
    const idea = generateIdea(back, db, proj.settings, { seed: 5, kinds: ['hedge', 'tree', 'perennial'] });
    const rows = idea.items.filter((it) => it.kind === 'row');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) if (r.kind === 'row') expect(r.path[0][0]).toBeLessThan(120);
    expect(idea.items.filter((it) => kinds(it).has('tree')).length).toBeLessThanOrEqual(2);
  });

  it('house strip (max 50 cm, non-toxic) explains why hedges are impossible', () => {
    const idea = generateIdea(strip, db, proj.settings, { seed: 2, kinds: ['hedge', 'perennial'] });
    expect(idea.notes.join(' ')).toContain('Sövény (hátsó sor): ehhez a területhez');
    expect(idea.items.length).toBeGreaterThan(0);
  });
});
