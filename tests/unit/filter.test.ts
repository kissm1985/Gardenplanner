import { describe, expect, it } from 'vitest';
import { SEED_PLANTS } from '../../src/data/plants.seed';
import { evaluate } from '../../src/engine/rules';
import { activeFilterCount, filterPlants, NO_FILTER } from '../../src/model/plantFilter';
import { useProject, selectCurrentArea, selectItems } from '../../src/store/projectStore';

const codes = (f: Partial<typeof NO_FILTER>) => filterPlants(SEED_PLANTS, { ...NO_FILTER, ...f }).map((p) => p.code);

describe('plant filters', () => {
  it('toxic / non-toxic / unknown', () => {
    const non = codes({ toxic: 'no' });
    const tox = codes({ toxic: 'yes' });
    expect(non).toContain('LA');
    expect(non).not.toContain('EF');
    expect(tox).toEqual(expect.arrayContaining(['EF', 'IR', 'HL', 'BX']));
    expect(codes({ toxic: 'unknown' })).toContain('BB');
    expect(non.length + tox.length + codes({ toxic: 'unknown' }).length).toBe(SEED_PLANTS.length);
  });

  it('height and spread ranges', () => {
    for (const p of filterPlants(SEED_PLANTS, { ...NO_FILTER, hMin: '30', hMax: '50' })) expect(p.maxHeightCm).toBeGreaterThanOrEqual(30), expect(p.maxHeightCm).toBeLessThanOrEqual(50);
    for (const p of filterPlants(SEED_PLANTS, { ...NO_FILTER, sMin: '50' })) expect(p.spreadCm).toBeGreaterThanOrEqual(50);
    expect(codes({ hMax: '50' })).toContain('LA');
    expect(codes({ hMax: '50' })).not.toContain('NE');
  });

  it('sun and soil', () => {
    expect(codes({ sun: 'shade' })).toEqual(expect.arrayContaining(['HO', 'AS', 'EP', 'VI']));
    expect(codes({ sun: 'shade' })).not.toContain('LA');
    expect(codes({ soil: 'clay' })).toContain('BE');
    expect(codes({ soil: 'clay' })).not.toContain('LA');
    expect(codes({ sun: 'shade', soil: 'acidic', toxic: 'no' })).toEqual(expect.arrayContaining(['AS']));
  });

  it('counts active criteria without the search text', () => {
    expect(activeFilterCount({ ...NO_FILTER, q: 'leven' })).toBe(0);
    expect(activeFilterCount({ ...NO_FILTER, toxic: 'no', hMax: '50' })).toBe(2);
  });
});

describe('soil rule', () => {
  it('flags a plant that does not like the area soil (info)', () => {
    const st = useProject.getState;
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip']);
    st().placePlant('LA', 60, 200);
    const a = selectCurrentArea(st())!;
    const run = () => evaluate(selectCurrentArea(st())!, selectItems(st()), st().project!.plantDb, st().project!.settings);
    expect(run().some((w) => w.rule === 'soil')).toBe(false); // no soil set
    st().updateArea(a.id, { soil: 'clay' });
    const w = run().find((x) => x.rule === 'soil')!;
    expect(w.severity).toBe('info');
    expect(w.message).toContain('agyagos');
    st().updateArea(a.id, { soil: 'sandy' });
    expect(run().some((x) => x.rule === 'soil')).toBe(false);
  });
});
