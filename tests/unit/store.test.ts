import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { curvedLawn } from '../../src/data/templates';
import { loadProject, saveProject } from '../../src/store/persist';
import { HISTORY_LIMIT, selectCurrentArea, useProject } from '../../src/store/projectStore';

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
