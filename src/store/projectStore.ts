import { create } from 'zustand';
import { SEED_PLANTS } from '../data/plants.seed';
import { makeArea, type AreaInput, AREA_TEMPLATES } from '../data/templates';
import { uid } from '../model/ids';
import { DEFAULT_SETTINGS, type Area, type ItemStatus, type PlacedItem, type Plant, type Project, type Settings, type Variant } from '../model/types';

export const HISTORY_LIMIT = 100;

export type ItemPatch = Partial<{ plantId: string; status: ItemStatus; note: string; x: number; y: number }>;

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
  updateSettings: (patch: Partial<Settings>) => void;

  addPlant: (p: Plant) => void;
  updatePlant: (code: string, p: Plant) => void;
  deletePlant: (code: string) => void;
  importPlants: (plants: Plant[], mode: 'merge' | 'replace') => void;

  placePlant: (plantId: string, x: number, y: number) => string | null;
  moveItems: (ids: string[], dx: number, dy: number) => void;
  updateItems: (ids: string[], patch: ItemPatch) => void;
  deleteItems: (ids: string[]) => void;
  duplicateItems: (ids: string[], dx: number, dy: number) => string[];

  undo: () => void;
  redo: () => void;
}

export function newProject(templateKeys: string[]): Project {
  const areas = AREA_TEMPLATES.filter((t) => templateKeys.includes(t.key)).map((t) => t.build());
  return { schemaVersion: 1, id: uid('p'), name: 'Kertem', areas, plantDb: seedPlants(), settings: { ...DEFAULT_SETTINGS } };
}

const seedPlants = () => SEED_PLANTS.map((p) => ({ ...p }));

/** Upgrade projects saved by earlier builds. */
export function migrate(p: Project): Project {
  let out = p;
  if (!out.plantDb?.length) out = { ...out, plantDb: seedPlants() };
  if (!out.settings) out = { ...out, settings: { ...DEFAULT_SETTINGS } };
  else out = { ...out, settings: { ...DEFAULT_SETTINGS, ...out.settings } };
  return out;
}

export const activeVariant = (a: Area): Variant => a.variants.find((v) => v.id === a.chosenVariantId) ?? a.variants[0];

function translateItem(it: PlacedItem, dx: number, dy: number): PlacedItem {
  switch (it.kind) {
    case 'plant':
      return { ...it, x: it.x + dx, y: it.y + dy };
    case 'drift':
      return { ...it, polygon: it.polygon.map(([x, y]) => [x + dx, y + dy]) };
    case 'row':
      return { ...it, path: it.path.map(([x, y]) => [x + dx, y + dy]) };
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

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

  return {
    project: null,
    currentAreaId: null,
    past: [],
    future: [],

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

    updateArea: (id, patch) => mapArea(id, (a) => ({ ...a, ...patch })),

    deleteArea: (id) => {
      commit((p) => ({ ...p, areas: p.areas.filter((a) => a.id !== id) }));
      const { project, currentAreaId } = get();
      if (currentAreaId === id) set({ currentAreaId: project?.areas[0]?.id ?? null });
    },

    selectArea: (id) => set({ currentAreaId: id }),

    updateSettings: (patch) => commit((p) => ({ ...p, settings: { ...p.settings, ...patch } })),

    // ---------- plant database ----------
    addPlant: (plant) => commit((p) => ({ ...p, plantDb: [...p.plantDb, plant] })),

    updatePlant: (code, plant) =>
      commit((p) => ({
        ...p,
        plantDb: p.plantDb.map((x) => (x.code === code ? plant : x)),
        // A code change must follow the placed items.
        areas:
          code === plant.code
            ? p.areas
            : p.areas.map((a) => ({
                ...a,
                variants: a.variants.map((v) => ({
                  ...v,
                  items: v.items.map((it) => (it.plantId === code ? { ...it, plantId: plant.code } : it)),
                })),
              })),
      })),

    deletePlant: (code) =>
      commit((p) => ({
        ...p,
        plantDb: p.plantDb.filter((x) => x.code !== code),
        areas: p.areas.map((a) => ({
          ...a,
          variants: a.variants.map((v) => ({ ...v, items: v.items.filter((it) => it.plantId !== code) })),
        })),
      })),

    importPlants: (plants, mode) =>
      commit((p) => {
        if (mode === 'replace') {
          // Keep species that are still placed somewhere, so no item loses its plant.
          const used = new Set(p.areas.flatMap((a) => a.variants.flatMap((v) => v.items.map((i) => i.plantId))));
          const incoming = new Set(plants.map((x) => x.code));
          return { ...p, plantDb: [...plants, ...p.plantDb.filter((x) => used.has(x.code) && !incoming.has(x.code))] };
        }
        const byCode = new Map(p.plantDb.map((x) => [x.code, x]));
        for (const x of plants) byCode.set(x.code, x);
        return { ...p, plantDb: [...byCode.values()] };
      }),

    // ---------- placed items ----------
    placePlant: (plantId, x, y) => {
      if (!get().currentAreaId) return null;
      const id = uid('i');
      mapItems((items) => [...items, { kind: 'plant', id, plantId, x: round1(x), y: round1(y), status: 'needed' }]);
      return id;
    },

    moveItems: (ids, dx, dy) => {
      if (!ids.length || (dx === 0 && dy === 0)) return;
      const set_ = new Set(ids);
      mapItems((items) => items.map((it) => (set_.has(it.id) ? roundItem(translateItem(it, dx, dy)) : it)));
    },

    updateItems: (ids, patch) => {
      const set_ = new Set(ids);
      mapItems((items) =>
        items.map((it) => {
          if (!set_.has(it.id)) return it;
          const { x, y, ...rest } = patch;
          let next = { ...it, ...rest } as PlacedItem;
          if (next.kind === 'plant' && (x !== undefined || y !== undefined))
            next = { ...next, x: round1(x ?? next.x), y: round1(y ?? next.y) };
          return next;
        }),
      );
    },

    deleteItems: (ids) => {
      if (!ids.length) return;
      const set_ = new Set(ids);
      mapItems((items) => (items.some((i) => set_.has(i.id)) ? items.filter((i) => !set_.has(i.id)) : items));
    },

    duplicateItems: (ids, dx, dy) => {
      const set_ = new Set(ids);
      const created: string[] = [];
      mapItems((items) => {
        const copies = items
          .filter((i) => set_.has(i.id))
          .map((i) => {
            const c = { ...roundItem(translateItem(i, dx, dy)), id: uid('i') };
            created.push(c.id);
            return c;
          });
        return copies.length ? [...items, ...copies] : items;
      });
      return created;
    },

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

function roundItem(it: PlacedItem): PlacedItem {
  if (it.kind === 'plant') return { ...it, x: round1(it.x), y: round1(it.y) };
  if (it.kind === 'drift') return { ...it, polygon: it.polygon.map(([x, y]) => [round1(x), round1(y)]) };
  return { ...it, path: it.path.map(([x, y]) => [round1(x), round1(y)]) };
}

export const selectCurrentArea = (s: ProjectState): Area | null =>
  s.project?.areas.find((a) => a.id === s.currentAreaId) ?? null;

const EMPTY: PlacedItem[] = [];
export const selectItems = (s: ProjectState): PlacedItem[] => {
  const a = selectCurrentArea(s);
  return a ? activeVariant(a).items : EMPTY;
};
