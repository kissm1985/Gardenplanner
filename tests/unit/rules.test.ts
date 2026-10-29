import { beforeEach, describe, expect, it } from 'vitest';
import { areaSunLevel, evaluate, partition, sunHours } from '../../src/engine/rules';
import type { Area } from '../../src/model/types';
import { selectCurrentArea, selectItems, useProject } from '../../src/store/projectStore';

const st = () => useProject.getState();
const run = () => {
  const s = st();
  return evaluate(selectCurrentArea(s)!, selectItems(s), s.project!.plantDb, s.project!.settings);
};
const rules = () => run().map((w) => w.rule);

describe('sun level', () => {
  it('parses Hungarian sun notes', () => {
    expect(sunHours('13:00-ig')).toBe(6);
    expect(sunHours('12:00-ig')).toBe(5);
    expect(sunHours('délig')).toBe(5);
    expect(sunHours('14:00-tól')).toBe(5);
    expect(sunHours('')).toBeNull();
  });
  it('the templates: house strip is sunny, lawn garden half-shade', () => {
    st().createProject(['house-strip', 'lawn-garden']);
    const [strip, garden] = st().project!.areas;
    expect(areaSunLevel(strip)).toBe('sun');
    expect(areaSunLevel(garden)).toBe('part');
    expect(areaSunLevel({ ...garden, sunLevel: 'shade' } as Area)).toBe('shade');
  });
});

describe('rules on the house strip (max 50 cm, no thorns, non-toxic)', () => {
  beforeEach(() => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip']);
  });

  it('acceptance: a plant taller than 50 cm warns immediately', () => {
    st().placePlant('NE', 60, 300); // catmint 60 cm
    const w = run().find((x) => x.rule === 'height');
    expect(w?.severity).toBe('error');
    expect(w?.message).toContain('60 cm');
    expect(w?.message).toContain('50 cm');
  });

  it('lavender in the strip is fine', () => {
    st().placePlant('LA', 60, 300);
    expect(rules()).toEqual([]);
  });

  it('thorny and toxic plants are flagged; unknown toxicity is a softer warning', () => {
    st().placePlant('BB', 40, 100); // barberry: thorny, toxicity unknown
    st().placePlant('EF', 60, 400); // euonymus: toxic to humans
    const ws = run();
    expect(ws.find((w) => w.rule === 'thorny')?.severity).toBe('error');
    expect(ws.find((w) => w.id === 'toxic:EF')?.severity).toBe('error');
    expect(ws.find((w) => w.id === 'toxic:BB')?.severity).toBe('warn');
  });

  it('outside the area and spacing conflicts', () => {
    st().placePlant('LA', 200, 300);
    expect(rules()).toContain('outside');
    st().placePlant('LA', 60, 500);
    st().placePlant('LA', 70, 505); // 11 cm apart, lavender needs 40
    const sp = run().find((w) => w.rule === 'spacing')!;
    expect(sp.itemIds).toHaveLength(2);
    expect(sp.message).toContain('túl közel');
  });

  it('a drift laid out at its own spacing does not warn; a squeezed one does', () => {
    const id = st().addDrift('LA', [[0, 0], [120, 0], [120, 200], [0, 200]], 'staggered')!;
    expect(rules()).toEqual([]);
    st().updateItems([id], { spacingCm: 15 });
    expect(rules()).toContain('spacing');
  });

  it('species limit', () => {
    const a = selectCurrentArea(st())!;
    st().updateArea(a.id, { constraints: { ...a.constraints, speciesLimits: { LA: 5 } } });
    st().addRow('LA', [[60, 0], [60, 400]]); // 11 plants
    expect(run().find((w) => w.rule === 'species-limit')?.message).toContain('11');
  });

  it('water mix between neighbours', () => {
    st().placePlant('LA', 30, 300); // low
    st().placePlant('HO', 70, 300); // high (hosta)
    expect(rules()).toContain('water-mix');
  });

  it('muted warnings move to the muted list', () => {
    st().placePlant('NE', 60, 300);
    const w = run().find((x) => x.rule === 'height')!;
    st().setMuted(w.id, true);
    const v = selectCurrentArea(st())!.variants[0];
    const { active, muted } = partition(run(), v.muted);
    expect(active.find((x) => x.id === w.id)).toBeUndefined();
    expect(muted.map((x) => x.id)).toContain(w.id);
  });

  it('plant on the tap / manhole fixture', () => {
    st().addFixture({ type: 'tap', label: 'Csap', x: 40, y: 600, w: 40, h: 40 });
    st().placePlant('TH', 60, 620);
    expect(rules()).toContain('fixture');
  });
});

describe('walnut and juglone (lawn garden)', () => {
  beforeEach(() => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['lawn-garden']);
  });

  it('undocumented tolerance warns (yellow) inside the 15 m zone, tolerant plants do not', () => {
    st().placePlant('SA', 450, 600); // tolerant
    expect(run().filter((w) => w.rule === 'juglone')).toEqual([]);
    st().placePlant('LA', 450, 700); // unknown
    const w = run().find((x) => x.rule === 'juglone')!;
    expect(w.severity).toBe('warn');
    expect(w.hint).toContain('tűrő');
  });

  it('a sensitive plant is an error; shrinking the radius clears it', () => {
    const la = st().project!.plantDb.find((p) => p.code === 'LA')!;
    st().updatePlant('LA', { ...la, juglone: 'sensitive' });
    st().placePlant('LA', 20, 100);
    expect(run().find((x) => x.rule === 'juglone')?.severity).toBe('error');
    st().updateSettings({ walnutRadiusCm: 300 });
    expect(run().find((x) => x.rule === 'juglone')).toBeUndefined();
  });

  it('moving the walnut fixture changes the result', () => {
    const la = st().project!.plantDb.find((p) => p.code === 'LA')!;
    st().updatePlant('LA', { ...la, juglone: 'sensitive' });
    st().updateSettings({ walnutRadiusCm: 400 });
    st().placePlant('LA', 450, 600);
    expect(rules()).toContain('juglone');
    const wal = selectCurrentArea(st())!.fixtures.find((f) => f.type === 'walnut')!;
    st().moveFixture(wal.id, 0, 2000);
    expect(rules()).not.toContain('juglone');
  });

  it('more than two trees', () => {
    st().placePlant('AC', 450, 200);
    st().placePlant('MG', 450, 500);
    expect(rules()).not.toContain('trees');
    st().placePlant('AC', 450, 900);
    expect(rules()).toContain('trees');
  });

  it('a full-sun plant in the half-shaded garden gets a sun warning', () => {
    st().placePlant('LA', 50, 300);
    expect(rules()).toContain('sun');
  });

  it('stays fast with 1000+ positions', () => {
    st().addDrift('TH', [[0, 0], [500, 0], [500, 1200], [0, 1200]], 'staggered', 25);
    const t = performance.now();
    run();
    expect(performance.now() - t).toBeLessThan(300);
  });
});

describe('lawn', () => {
  it('plants on a drawn lawn are warned about; the bed area excludes the lawn', async () => {
    const { useProject, selectCurrentArea, selectItems } = await import('../../src/store/projectStore');
    const { evaluate } = await import('../../src/engine/rules');
    const { bedAreaM2 } = await import('../../src/engine/schedule');
    const st = useProject.getState;
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip']);
    const before = bedAreaM2(selectCurrentArea(st())!);
    st().addFixture({ type: 'lawn', label: 'Gyepsáv', x: 0, y: 600, polygon: [[0, 600], [120, 600], [120, 800], [0, 800]] });
    st().placePlant('LA', 60, 700); // on the lawn
    st().placePlant('LA', 60, 300); // in the bed
    const a = selectCurrentArea(st())!;
    const w = evaluate(a, selectItems(st()), st().project!.plantDb, st().project!.settings).filter((x) => x.rule === 'lawn');
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain('„Gyepsáv” területére esik');
    expect(bedAreaM2(a)).toBeCloseTo(before - 2.4, 5);
  });
});
