import { describe, expect, it } from 'vitest';
import { SEED_PLANTS } from '../../src/data/plants.seed';
import { candidates, clipRect, colourFamilies, generateIdea } from '../../src/engine/generator';
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
