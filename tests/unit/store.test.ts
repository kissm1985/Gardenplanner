import { SEED_SINCE } from '../../src/data/plants.seed';
import { mixAssign, mixCounts } from '../../src/engine/mix';
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { curvedLawn } from '../../src/data/templates';
import { loadProject, saveProject } from '../../src/store/persist';
import { HISTORY_LIMIT, SEED_VERSION, selectCurrentArea, selectItems, useProject } from '../../src/store/projectStore';

const st = () => useProject.getState();

describe('project store', () => {
  beforeEach(() => useProject.setState({ project: null, currentAreaId: null, past: [], future: [] }));

  it('creates the two starting templates with the spec dimensions and constraints', () => {
    st().createProject(['house-strip', 'lawn-garden']);
    const [strip, garden] = st().project!.areas;
    expect([strip.widthCm, strip.lengthCm, strip.orientation, strip.sunUntil]).toEqual([120, 1200, 'S', '13:00-ig']);
    expect(strip.constraints.maxHeightCm).toBe(50);
    expect([garden.widthCm, garden.lengthCm, garden.orientation, garden.sunUntil]).toEqual([500, 1200, 'E', '12:00-ig']);
    expect(garden.constraints.maxTrees).toBe(2);
    expect(garden.fixtures.some((f) => f.type === 'lawn')).toBe(true);
    expect(garden.fixtures.some((f) => f.type === 'walnut')).toBe(true);
    expect(strip.variants).toHaveLength(1);
    expect(strip.chosenVariantId).toBe(strip.variants[0].id);
    expect(st().project!.settings.walnutRadiusCm).toBe(1500);
    expect(selectCurrentArea(st())?.id).toBe(strip.id);
  });

  it('adds, edits and deletes areas with undo/redo', () => {
    st().createProject([]);
    const id = st().addArea({ name: 'Teszt', widthCm: 120, lengthCm: 1200, orientation: 'S', sunUntil: '13:00-ig', notes: '' });
    expect(st().currentAreaId).toBe(id);
    st().updateArea(id, { name: 'Átnevezve' });
    expect(selectCurrentArea(st())?.name).toBe('Átnevezve');
    st().deleteArea(id);
    expect(st().project!.areas).toHaveLength(0);
    expect(st().currentAreaId).toBeNull();
    st().undo();
    expect(selectCurrentArea(st())?.name).toBe('Átnevezve');
    st().undo();
    expect(selectCurrentArea(st())?.name).toBe('Teszt');
    st().redo();
    expect(selectCurrentArea(st())?.name).toBe('Átnevezve');
  });

  it('keeps at least 50 undo steps', () => {
    st().createProject(['house-strip']);
    const id = st().currentAreaId!;
    for (let i = 0; i < 60; i++) st().updateArea(id, { notes: String(i) });
    expect(st().past.length).toBe(Math.min(60, HISTORY_LIMIT));
    for (let i = 0; i < 50; i++) st().undo();
    expect(selectCurrentArea(st())?.notes).toBe('9');
  });

  it('round-trips a project through IndexedDB unchanged', async () => {
    st().createProject(['house-strip', 'lawn-garden']);
    const p = st().project!;
    await saveProject(p);
    expect(await loadProject()).toEqual(p);
  });
});

describe('curved lawn', () => {
  it('stays inside the area and leaves beds on both sides', () => {
    const poly = curvedLawn(500, 1200);
    for (const [x, y] of poly) {
      expect(x).toBeGreaterThan(50);
      expect(x).toBeLessThan(450);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1200);
    }
  });
});

describe('placed plants', () => {
  beforeEach(() => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip']);
  });
  const items = () => selectItems(st());

  it('places, moves, duplicates and deletes with undo', () => {
    const id = st().placePlant('LA', 60.04, 100)!;
    expect(items()).toEqual([{ kind: 'plant', id, plantId: 'LA', x: 60, y: 100, status: 'needed' }]);
    st().moveItems([id], 10, -20);
    expect(items()[0]).toMatchObject({ x: 70, y: 80 });
    const [copy] = st().duplicateItems([id], 20, 20);
    expect(items().find((i) => i.id === copy)).toMatchObject({ x: 90, y: 100, plantId: 'LA' });
    st().deleteItems([id, copy]);
    expect(items()).toHaveLength(0);
    st().undo();
    st().undo();
    st().undo();
    expect(items()[0]).toMatchObject({ x: 60, y: 100 });
  });

  it('updates species, status and note of several items at once', () => {
    const a = st().placePlant('LA', 10, 10)!;
    const b = st().placePlant('LA', 20, 10)!;
    st().updateItems([a, b], { plantId: 'TH', status: 'planted' });
    expect(items().map((i) => [i.plantId, i.status])).toEqual([
      ['TH', 'planted'],
      ['TH', 'planted'],
    ]);
  });

  it('renaming a plant code follows the placed items; deleting removes them', () => {
    st().placePlant('LA', 10, 10);
    const la = st().project!.plantDb.find((p) => p.code === 'LA')!;
    st().updatePlant('LA', { ...la, code: 'LV' });
    expect(items()[0].plantId).toBe('LV');
    st().deletePlant('LV');
    expect(items()).toHaveLength(0);
    expect(st().project!.plantDb.some((p) => p.code === 'LV')).toBe(false);
  });

  it('seeds the plant list for projects saved before phase 2', () => {
    const old = { ...st().project!, plantDb: [] };
    st().setLoaded(old);
    expect(st().project!.plantDb.length).toBeGreaterThan(25);
  });

  it('handles 300 plants quickly', () => {
    const t = performance.now();
    for (let i = 0; i < 300; i++) st().placePlant('TH', (i % 4) * 30 + 15, Math.floor(i / 4) * 15);
    expect(items()).toHaveLength(300);
    expect(performance.now() - t).toBeLessThan(1000);
  });
});

describe('drifts and rows', () => {
  beforeEach(() => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip']);
  });
  const items = () => selectItems(st());
  const sq: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100]];

  it('a drift stores its count, using the plant spacing by default', () => {
    const id = st().addDrift('FE', sq, 'grid')!; // Festuca, 25 cm
    expect(items()[0]).toMatchObject({ id, kind: 'drift', spacingCm: 25, count: 16 });
  });

  it('count follows spacing, pattern, shape and species changes', () => {
    const id = st().addDrift('FE', sq, 'grid')!;
    st().updateItems([id], { spacingCm: 50 });
    expect(items()[0]).toMatchObject({ count: 4 });
    st().updateItems([id], { pattern: 'staggered' });
    expect((items()[0] as { count: number }).count).toBeGreaterThan(0);
    st().updateShape(id, [[0, 0], [200, 0], [200, 100], [0, 100]]);
    expect(items()[0]).toMatchObject({ kind: 'drift' });
    st().updateItems([id], { plantId: 'LA', pattern: 'grid' }); // lavender 40 cm: 5 × 2
    expect(items()[0]).toMatchObject({ plantId: 'LA', spacingCm: 40, count: 10 });
  });

  it('a row along 1200 cm of lavender at 40 cm has 31 plants; moving keeps the count', () => {
    const id = st().addRow('LA', [[60, 0], [60, 1200]])!;
    expect(items()[0]).toMatchObject({ count: 31 });
    st().moveItems([id], 5, 5);
    expect(items()[0]).toMatchObject({ count: 31, path: [[65, 5], [65, 1205]] });
    st().undo();
    expect(items()[0]).toMatchObject({ path: [[60, 0], [60, 1200]] });
  });
});

describe('plant list migration', () => {
  it('merges the expanded built-in list once into an older project, keeping user edits', () => {
    st().createProject(['house-strip']);
    const p = st().project!;
    const old = {
      ...p,
      settings: { reservePct: 10, walnutRadiusCm: 1500, showMatureSize: true },
      plantDb: p.plantDb.slice(0, 30).map((x) => ({ ...x, soil: undefined, nameHu: x.code === 'LA' ? 'Saját levendula' : x.nameHu })),
    };
    st().setLoaded(old);
    const db = st().project!.plantDb;
    expect(db.length).toBe(p.plantDb.length);
    expect(db.find((x) => x.code === 'LA')!.nameHu).toBe('Saját levendula');
    expect(db.find((x) => x.code === 'LA')!.soil).toContain('sandy');
    expect(st().project!.settings.seedVersion).toBe(SEED_VERSION);
    // A built-in species deleted afterwards does not come back on the next load.
    st().deletePlant('VI');
    st().setLoaded(st().project!);
    expect(st().project!.plantDb.some((x) => x.code === 'VI')).toBe(false);
  });

  it('a version-2 project gets only the back-garden species, deleted older ones stay deleted', () => {
    st().createProject(['house-strip']);
    const p = st().project!;
    const v2 = { ...p, settings: { ...p.settings, seedVersion: 2 }, plantDb: p.plantDb.filter((x) => !SEED_SINCE[x.code] && x.code !== 'VI') };
    st().setLoaded(v2);
    const db = st().project!.plantDb;
    expect(db.some((x) => x.code === 'VI')).toBe(false);
    expect(db.find((x) => x.code === 'PF')!.nameHu).toBe('Korallberkenye');
    expect(db.some((x) => x.code === 'LO')).toBe(true);
    expect(db.length).toBe(p.plantDb.length - 1);
  });
});

describe('replace species', () => {
  it('swaps every plant of a species; drifts take the new spacing; scope and undo', () => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip']);
    st().addDrift('LA', [[0, 0], [120, 0], [120, 200], [0, 200]], 'staggered');
    st().placePlant('LA', 60, 500);
    st().placePlant('SA', 60, 700);
    const a = st().project!.areas[0];
    const other = st().duplicateVariant(a.variants[0].id)!; // B, now edited
    st().setActiveVariant(a.variants[0].id);
    const items = () => st().project!.areas[0].variants.find((v) => v.id === a.variants[0].id)!.items;
    const bItems = () => st().project!.areas[0].variants.find((v) => v.id === other)!.items;

    expect(st().replaceSpecies('LA', 'NE', 'variant')).toBe(2);
    const drift = items().find((i) => i.kind === 'drift')!;
    expect(drift.plantId).toBe('NE');
    expect(drift.kind === 'drift' && drift.spacingCm).toBe(st().project!.plantDb.find((p) => p.code === 'NE')!.spacingCm);
    expect(items().filter((i) => i.plantId === 'SA')).toHaveLength(1);
    expect(bItems().filter((i) => i.plantId === 'LA')).toHaveLength(2); // other variant untouched

    st().undo();
    expect(items().filter((i) => i.plantId === 'LA')).toHaveLength(2);
    expect(st().replaceSpecies('LA', 'NE', 'area', true)).toBe(4);
    expect(bItems().every((i) => i.plantId !== 'LA')).toBe(true);
    const kept = bItems().find((i) => i.kind === 'drift')!;
    expect(kept.kind === 'drift' && kept.spacingCm).toBe(40); // keepSpacing: lavender's 40 cm
    const past = st().past.length;
    expect(st().replaceSpecies('XX', 'NE', 'project')).toBe(0);
    expect(st().past.length).toBe(past);
  });
});

describe('mixed replacement', () => {
  it('mixCounts follows the weights exactly', () => {
    expect(mixCounts(100, [{ code: 'A', weight: 1 }, { code: 'B', weight: 1 }])).toEqual([50, 50]);
    expect(mixCounts(10, [{ code: 'A', weight: 2 }, { code: 'B', weight: 1 }])).toEqual([7, 3]);
    expect(mixAssign(9, [{ code: 'A', weight: 1 }, { code: 'B', weight: 2 }]).filter((c) => c === 'B')).toHaveLength(6);
  });

  it('a row of cherry laurel becomes a random mix of photinia and forsythia, per plant', () => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['lawn-garden']);
    st().addRow('LN', [[100, 100], [100, 1100]]); // one row, many plants
    st().placePlant('LN', 300, 300);
    const before = selectItems(st()).reduce((s, it) => s + (it.kind === 'plant' ? 1 : it.count), 0);
    const n = st().replaceSpecies('LN', [{ code: 'PF', weight: 1 }, { code: 'FO', weight: 1 }], 'variant', false, 'plant');
    expect(n).toBe(before);
    const items = selectItems(st());
    expect(items.every((it) => it.kind === 'plant')).toBe(true);
    expect(items).toHaveLength(before);
    const pf = items.filter((it) => it.plantId === 'PF').length;
    expect(Math.abs(pf - (before - pf))).toBeLessThanOrEqual(1);
    st().undo();
    expect(selectItems(st()).filter((it) => it.kind === 'row')).toHaveLength(1);
  });

  it('per item: each drift or row gets one of the targets, with its spacing', () => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip']);
    for (let i = 0; i < 6; i++) st().addDrift('LA', [[0, i * 200], [120, i * 200], [120, i * 200 + 150], [0, i * 200 + 150]], 'grid');
    expect(st().replaceSpecies('LA', [{ code: 'SA', weight: 1 }, { code: 'NE', weight: 2 }], 'variant')).toBe(6);
    const items = selectItems(st());
    expect(items.filter((it) => it.plantId === 'NE')).toHaveLength(4);
    for (const it of items) if (it.kind === 'drift') expect(it.spacingCm).toBe(st().project!.plantDb.find((p) => p.code === it.plantId)!.spacingCm);
  });
});

describe('split groups', () => {
  it('a drift becomes single plants at the same positions, with its status', () => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip']);
    const id = st().addDrift('LA', [[0, 0], [120, 0], [120, 200], [0, 200]], 'staggered')!;
    st().updateItems([id], { status: 'ordered' });
    const drift = selectItems(st())[0];
    const n = drift.kind === 'drift' ? drift.count : 0;
    const ids = st().explodeItems([id]);
    expect(ids).toHaveLength(n);
    const items = selectItems(st());
    expect(items.every((i) => i.kind === 'plant' && i.plantId === 'LA' && i.status === 'ordered')).toBe(true);
    expect(items).toHaveLength(n);
  });
});
