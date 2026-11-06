import { makeArea, AREA_TEMPLATES } from '../../data/templates';
import { buildExample, EXAMPLE_PLANS, exampleCodes } from '../../data/examples';
import { newProject, seedPlants, migrate } from '../projectModel';
import type { Actions, StoreCtx } from '../projectState';

export const projectSlice = ({ set, get, commit, mapArea, insertArea, ensureCurrentArea }: StoreCtx) =>
  ({
    setLoaded: (p) => {
      const m = p && migrate(p);
      set({ project: m, currentAreaId: m?.areas[0]?.id ?? null, past: [], future: [] });
    },

    createProject: (keys) => {
      const p = newProject(keys);
      set({ project: p, currentAreaId: p.areas[0]?.id ?? null, past: [], future: [] });
    },

    addArea: (input) => insertArea(makeArea(input)),

    addTemplateArea: (key) => {
      const t = AREA_TEMPLATES.find((x) => x.key === key);
      return t ? insertArea(t.build()) : null;
    },

    addExampleArea: (key) => {
      const ex = EXAMPLE_PLANS.find((x) => x.key === key);
      if (!ex) return null;
      if (!get().project) get().createProject([]);
      const area = buildExample(ex);
      // Species the user deleted from the database come back, so the example's list is complete.
      const have = new Set(get().project!.plantDb.map((x) => x.code));
      const missing = exampleCodes(area).filter((c) => !have.has(c));
      if (missing.length) {
        const seeds = seedPlants().filter((x) => missing.includes(x.code));
        commit((p) => ({ ...p, plantDb: [...p.plantDb, ...seeds] }));
      }
      return insertArea(area);
    },

    updateArea: (id, patch) => mapArea(id, (a) => ({ ...a, ...patch })),

    deleteArea: (id) => {
      commit((p) => ({ ...p, areas: p.areas.filter((a) => a.id !== id) }));
      const { project, currentAreaId } = get();
      if (currentAreaId === id) set({ currentAreaId: project?.areas[0]?.id ?? null });
    },

    selectArea: (id) => set({ currentAreaId: id }),

    updateSettings: (patch) => commit((p) => ({ ...p, settings: { ...p.settings, ...patch } })),

    renameProject: (name) => {
      const n = name.trim();
      if (n) commit((p) => (p.name === n ? p : { ...p, name: n }));
    },

    setScheduleWindow: (start, end) => commit((p) => ({ ...p, schedule: { start, end, done: p.schedule?.done ?? [] } })),

    toggleTask: (tid) =>
      commit((p) => {
        if (!p.schedule) return p;
        const done = p.schedule.done.includes(tid) ? p.schedule.done.filter((x) => x !== tid) : [...p.schedule.done, tid];
        return { ...p, schedule: { ...p.schedule, done } };
      }),

    undo: () => {
      const { past, project, future } = get();
      const prev = past[past.length - 1];
      if (!prev || !project) return;
      set({ project: prev, past: past.slice(0, -1), future: [project, ...future] });
      ensureCurrentArea();
    },

    redo: () => {
      const { past, project, future } = get();
      const next = future[0];
      if (!next || !project) return;
      set({ project: next, past: [...past, project], future: future.slice(1) });
      ensureCurrentArea();
    },
  }) satisfies Partial<Actions>;
