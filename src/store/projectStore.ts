// The project store: the plan being edited, the open area and the undo history.
// The actions live in slices (./slices), the pure helpers in ./projectModel, the types in ./projectState.
import { create } from 'zustand';
import type { Area, Fixture, PlacedItem, Project } from '../model/types';
import { activeVariant, onePlan } from './projectModel';
import { HISTORY_LIMIT, type ProjectState, type StoreCtx } from './projectState';
import { projectSlice } from './slices/projectSlice';
import { plantDbSlice } from './slices/plantDbSlice';
import { itemSlice } from './slices/itemSlice';
import { variantSlice } from './slices/variantSlice';

export * from './projectState';
export * from './projectModel';

export const useProject = create<ProjectState>()((set, get) => {
  /** Apply an immutable change to the project and record it for undo. */
  const commit = (fn: (p: Project) => Project) => {
    const { project, past } = get();
    if (!project) return;
    const next = fn(project);
    if (next === project) return;
    set({ project: next, past: [...past, project].slice(-HISTORY_LIMIT), future: [] });
  };
  const mapArea = (id: string, fn: (a: Area) => Area) => commit((p) => ({ ...p, areas: p.areas.map((a) => (a.id === id ? onePlan(fn(a)) : a)) }));
  /** Change the item list of the active variant of the current area. */
  const mapItems = (fn: (items: PlacedItem[]) => PlacedItem[]) => {
    const id = get().currentAreaId;
    if (!id) return;
    mapArea(id, (a) => {
      const v = activeVariant(a);
      const items = fn(v.items);
      if (items === v.items) return a;
      return { ...a, variants: a.variants.map((x) => (x.id === v.id ? { ...x, items } : x)) };
    });
  };

  const mapFixtures = (fn: (fs: Fixture[]) => Fixture[]) => {
    const id = get().currentAreaId;
    if (id) mapArea(id, (a) => ({ ...a, fixtures: fn(a.fixtures) }));
  };

  function plantSpacing(code: string): number {
    return get().project?.plantDb.find((p) => p.code === code)?.spacingCm ?? 0;
  }

  function insertArea(area: Area) {
    commit((p) => ({ ...p, areas: [...p.areas, area] }));
    set({ currentAreaId: area.id });
    return area.id;
  }

  function ensureCurrentArea() {
    const { project, currentAreaId } = get();
    if (project && !project.areas.some((a) => a.id === currentAreaId)) set({ currentAreaId: project.areas[0]?.id ?? null });
  }

  const ctx: StoreCtx = { set, get, commit, mapArea, mapItems, mapFixtures, insertArea, ensureCurrentArea, plantSpacing };
  return {
    project: null,
    currentAreaId: null,
    past: [],
    future: [],
    ...projectSlice(ctx),
    ...plantDbSlice(ctx),
    ...itemSlice(ctx),
    ...variantSlice(ctx),
  };
});
