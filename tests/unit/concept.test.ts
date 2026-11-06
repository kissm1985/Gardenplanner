import { describe, expect, it } from 'vitest';
import { SEED_PLANTS } from '../../src/data/plants.seed';
import { makeArea } from '../../src/data/templates';
import { generateIdea } from '../../src/engine/generator';
import { itemPositions } from '../../src/engine/fill';
import { evaluate } from '../../src/engine/rules';
import { areaPoints } from '../../src/model/area';
import { polygonArea } from '../../src/model/geometry';
import { blankPlant } from '../../src/model/plants';
import { newProject } from '../../src/store/projectStore';
import { PICTOGRAM_CODES, pictogramOf, sideUrl, topUrl } from '../../src/ui/pictograms';

const proj = newProject(['lawn-garden']);
const round = makeArea({ name: 'Kör', widthCm: 400, lengthCm: 400, orientation: 'S', sunUntil: '', notes: '', round: true });

describe('round areas', () => {
  it('a circle inscribed in its width × length', () => {
    expect(round.shape.kind).toBe('ellipse');
    const pts = areaPoints(round);
    expect(pts.length).toBe(72);
    expect(Math.abs(polygonArea(pts)) / (Math.PI * 200 * 200)).toBeGreaterThan(0.99);
  });

  it('plants outside the circle (in the corner of its box) are flagged', () => {
    const items = [
      { kind: 'plant' as const, id: 'a', plantId: 'LA', x: 200, y: 200, status: 'needed' as const },
      { kind: 'plant' as const, id: 'b', plantId: 'LA', x: 15, y: 15, status: 'needed' as const },
    ];
    const out = evaluate(round, items, SEED_PLANTS, proj.settings).filter((w) => w.rule === 'outside');
    expect(out.map((w) => w.itemIds[0])).toEqual(['b']);
  });

  it('the idea generator fills a round bed', () => {
    const idea = generateIdea(round, SEED_PLANTS, proj.settings, { seed: 3 });
    expect(idea.items.reduce((s, it) => s + itemPositions(it).length, 0)).toBeGreaterThan(15);
    expect(evaluate(round, idea.items, SEED_PLANTS, proj.settings).filter((w) => w.rule === 'outside' || w.rule === 'spacing')).toEqual([]);
  });
});

describe('pictograms', () => {
  it('every built-in species has a top and a side view; own plants can borrow one', () => {
    expect(PICTOGRAM_CODES.length).toBe(SEED_PLANTS.length);
    for (const p of SEED_PLANTS) {
      expect(topUrl(p)).toBeTruthy();
      expect(sideUrl(p)).toBeTruthy();
    }
    const own = { ...blankPlant('ZZ'), nameHu: 'Saját', nameLat: 'X' };
    expect(pictogramOf(own)).toBeNull();
    expect(pictogramOf({ ...own, pictogram: 'EC' })).toBe('EC');
  });
});

describe('idea generator with preferred plants', () => {
  it('uses only the chosen species', () => {
    const strip = newProject(['house-strip']).areas[0];
    const prefer = ['TH', 'LA', 'SA', 'FE'];
    for (let seed = 1; seed <= 4; seed++) {
      const idea = generateIdea(strip, SEED_PLANTS, proj.settings, { seed, prefer });
      const used = new Set(idea.items.map((it) => it.plantId));
      expect([...used].every((c) => prefer.includes(c))).toBe(true);
      expect(used.size).toBeGreaterThanOrEqual(3);
      expect(idea.notes.join(' ')).toContain('A kiválasztott 4 növényből készült');
    }
  });

  it('says which chosen plants were left out, e.g. in the walnut zone', () => {
    const idea = generateIdea(proj.areas[0], SEED_PLANTS, proj.settings, { seed: 1, prefer: ['EC', 'LA', 'SA', 'FE'] });
    const used = new Set(idea.items.map((it) => it.plantId));
    expect(used.has('LA')).toBe(false); // lavender does not tolerate juglone
    expect(idea.notes.join(' ')).toMatch(/Kimaradt: [^.]*levendula[^.]*juglone-zónájában/);
  });
});
