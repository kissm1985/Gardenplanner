import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { curvedLawn } from '../../src/data/templates';
import { loadProject, saveProject } from '../../src/store/persist';
import { HISTORY_LIMIT, selectCurrentArea, selectItems, useProject } from '../../src/store/projectStore';

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
