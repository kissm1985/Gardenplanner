import { create } from 'zustand';
import { makeArea, type AreaInput, AREA_TEMPLATES } from '../data/templates';
import { uid } from '../model/ids';
import { DEFAULT_SETTINGS, type Area, type Project } from '../model/types';

export const HISTORY_LIMIT = 100;

export interface ProjectState {
  project: Project | null;
  currentAreaId: string | null;
  past: Project[];
  future: Project[];

  setLoaded: (p: Project | null) => void;
  createProject: (templateKeys: string[]) => void;
  addArea: (input: AreaInput) => string;
  addTemplateArea: (templateKey: string) => string | null;
  updateArea: (id: string, patch: Partial<Omit<Area, 'id'>>) => void;
  deleteArea: (id: string) => void;
  selectArea: (id: string) => void;
  undo: () => void;
  redo: () => void;
}

export function newProject(templateKeys: string[]): Project {
  const areas = AREA_TEMPLATES.filter((t) => templateKeys.includes(t.key)).map((t) => t.build());
  return { schemaVersion: 1, id: uid('p'), name: 'Kertem', areas, plantDb: [], settings: { ...DEFAULT_SETTINGS } };
}

export const useProject = create<ProjectState>()((set, get) => {
  /** Apply an immutable change to the project and record it for undo. */
  const commit = (fn: (p: Project) => Project) => {
    const { project, past } = get();
    if (!project) return;
    const next = fn(project);
    if (next === project) return;
    set({ project: next, past: [...past, project].slice(-HISTORY_LIMIT), future: [] });
  };
  const mapArea = (id: string, fn: (a: Area) => Area) =>
    commit((p) => ({ ...p, areas: p.areas.map((a) => (a.id === id ? fn(a) : a)) }));

  return {
    project: null,
    currentAreaId: null,
    past: [],
    future: [],

    setLoaded: (p) => set({ project: p, currentAreaId: p?.areas[0]?.id ?? null, past: [], future: [] }),

    createProject: (keys) => {
      const p = newProject(keys);
      set({ project: p, currentAreaId: p.areas[0]?.id ?? null, past: [], future: [] });
    },

    addArea: (input) => insertArea(makeArea(input)),

    addTemplateArea: (key) => {
      const t = AREA_TEMPLATES.find((x) => x.key === key);
      return t ? insertArea(t.build()) : null;
    },

    updateArea: (id, patch) => mapArea(id, (a) => ({ ...a, ...patch })),

    deleteArea: (id) => {
      commit((p) => ({ ...p, areas: p.areas.filter((a) => a.id !== id) }));
      const { project, currentAreaId } = get();
      if (currentAreaId === id) set({ currentAreaId: project?.areas[0]?.id ?? null });
    },

    selectArea: (id) => set({ currentAreaId: id }),

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
  };

  function insertArea(area: Area) {
    commit((p) => ({ ...p, areas: [...p.areas, area] }));
    set({ currentAreaId: area.id });
    return area.id;
  }

  function ensureCurrentArea() {
    const { project, currentAreaId } = get();
    if (project && !project.areas.some((a) => a.id === currentAreaId)) set({ currentAreaId: project.areas[0]?.id ?? null });
  }
});

export const selectCurrentArea = (s: ProjectState): Area | null =>
  s.project?.areas.find((a) => a.id === s.currentAreaId) ?? null;
