import { beforeEach, describe, expect, it } from 'vitest';
import { buildExample, EXAMPLE_PLANS, exampleCodes } from '../../src/data/examples';
import { SEED_PLANTS } from '../../src/data/plants.seed';
import { evaluate } from '../../src/engine/rules';
import { itemCount } from '../../src/engine/fill';
import { validateProject } from '../../src/engine/validate';
import { localName } from '../../src/i18n/names';
import { DEFAULT_SETTINGS } from '../../src/model/types';
import { useProject } from '../../src/store/projectStore';

describe('example plans', () => {
  it('ten distinct, planted examples', () => {
    expect(EXAMPLE_PLANS).toHaveLength(10);
    expect(new Set(EXAMPLE_PLANS.map((e) => e.key)).size).toBe(10);
    for (const ex of EXAMPLE_PLANS) {
      const a = buildExample(ex);
      const n = a.variants[0].items.reduce((s, it) => s + itemCount(it), 0);
      expect(n, ex.key).toBeGreaterThan(40);
      expect(a.variants[0].notes.length, ex.key).toBeGreaterThan(40);
      // Stored counts match the drawing.
      for (const it of a.variants[0].items) if (it.kind !== 'plant') expect(it.count).toBe(itemCount(it));
    }
  });

  it('follow the rules: no errors or warnings, only soil hints', () => {
    for (const ex of EXAMPLE_PLANS) {
      const a = buildExample(ex);
      const ws = evaluate(a, a.variants[0].items, SEED_PLANTS, DEFAULT_SETTINGS);
      expect(ws.filter((w) => w.severity !== 'info').map((w) => w.message), ex.key).toEqual([]);
    }
  });

  it('use built-in species only and pass the backup check', () => {
    const codes = new Set(SEED_PLANTS.map((p) => p.code));
    const areas = EXAMPLE_PLANS.map(buildExample);
    for (const a of areas) for (const c of exampleCodes(a)) expect(codes.has(c), c).toBe(true);
    expect(() => validateProject({ id: 'p', name: 'x', areas, plantDb: SEED_PLANTS, settings: DEFAULT_SETTINGS })).not.toThrow();
  });

  it('names and element labels follow the language', () => {
    expect(localName('Kastélykert', 'en')).toBe('Château garden');
    expect(localName('Round pollinator garden', 'hu')).toBe('Kerek pillangókert');
    expect(localName('Szökőkút', 'en')).toBe('Fountain');
  });
});

describe('adding an example', () => {
  beforeEach(() => useProject.setState({ project: null, currentAreaId: null, past: [], future: [] }));

  it('creates the project when there is none and opens the new area', () => {
    const id = useProject.getState().addExampleArea('japanese');
    const s = useProject.getState();
    expect(s.project?.areas).toHaveLength(1);
    expect(s.currentAreaId).toBe(id);
    expect(s.project!.areas[0].shape.kind).toBe('rect');
    expect(s.project!.areas[0].variants[0].items.length).toBeGreaterThan(5);
  });

  it('brings back species deleted from the database', () => {
    const st = useProject.getState();
    st.createProject([]);
    st.deletePlant('LA');
    expect(useProject.getState().project!.plantDb.some((p) => p.code === 'LA')).toBe(false);
    st.addExampleArea('mediterranean');
    expect(useProject.getState().project!.plantDb.some((p) => p.code === 'LA')).toBe(true);
    expect(useProject.getState().addExampleArea('nope')).toBeNull();
  });

  it('the round example is round', () => {
    useProject.getState().addExampleArea('pollinator');
    expect(useProject.getState().project!.areas[0].shape.kind).toBe('ellipse');
  });
});
