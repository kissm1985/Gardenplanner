import { create } from 'zustand';
import { itemCount, type Pattern } from '../engine/fill';
import { SEED_PLANTS } from '../data/plants.seed';
import { makeArea, type AreaInput, AREA_TEMPLATES } from '../data/templates';
import { uid } from '../model/ids';
import { DEFAULT_SETTINGS, type Area, type Fixture, type ItemStatus, type PlacedItem, type Plant, type Project, type Pt, type Settings, type Variant } from '../model/types';

export const HISTORY_LIMIT = 100;

export type ItemPatch = Partial<{ plantId: string; status: ItemStatus; note: string; x: number; y: number; pattern: Pattern; spacingCm: number }>;

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
  addDrift: (plantId: string, polygon: Pt[], pattern: Pattern, spacingCm?: number) => string | null;
  addRow: (plantId: string, path: Pt[], spacingCm?: number) => string | null;
  updateShape: (id: string, points: Pt[]) => void;
  moveItems: (ids: string[], dx: number, dy: number) => void;
  updateItems: (ids: string[], patch: ItemPatch) => void;
  deleteItems: (ids: string[]) => void;
  duplicateItems: (ids: string[], dx: number, dy: number) => string[];

  setMuted: (warningId: string, muted: boolean) => void;
  /** Set the status of every item of a species in the chosen variants of the given areas. */
  setSpeciesStatus: (code: string, status: ItemStatus, areaIds: string[], onlyFrom?: ItemStatus | null) => void;

  addFixture: (f: Omit<Fixture, 'id'>) => string | null;
  updateFixture: (id: string, patch: Partial<Omit<Fixture, 'id'>>) => void;
  moveFixture: (id: string, dx: number, dy: number) => void;
  deleteFixture: (id: string) => void;

  renameProject: (name: string) => void;
  setBackground: (bg: Area['background'] | null) => void;
  setScheduleWindow: (start: string, end: string) => void;
  toggleTask: (taskId: string) => void;

  duplicateVariant: (variantId: string) => string | null;
  addEmptyVariant: () => string | null;
  renameVariant: (variantId: string, name: string) => void;
  deleteVariant: (variantId: string) => void;
  setActiveVariant: (variantId: string) => void;
  setChosenVariant: (variantId: string) => void;

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

export const activeVariant = (a: Area): Variant =>
  a.variants.find((v) => v.id === (a.activeVariantId ?? a.chosenVariantId)) ?? a.variants[0];

/** Next free plan name: "A terv", "B terv", … */
export function nextVariantName(vs: Variant[]): string {
  const used = new Set(vs.map((v) => v.name));
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(`${c} terv`)) return `${c} terv`;
  return `${vs.length + 1}. terv`;
}

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

  const mapFixtures = (fn: (fs: Fixture[]) => Fixture[]) => {
    const id = get().currentAreaId;
    if (id) mapArea(id, (a) => ({ ...a, fixtures: fn(a.fixtures) }));
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

    addDrift: (plantId, polygon, pattern, spacingCm) => {
      const sp = spacingCm ?? plantSpacing(plantId);
      if (!get().currentAreaId || polygon.length < 3 || !sp) return null;
      const id = uid('i');
      const it = withCount({ kind: 'drift', id, plantId, polygon: roundPts(polygon), pattern, spacingCm: sp, count: 0, status: 'needed' });
      mapItems((items) => [...items, it]);
      return id;
    },

    addRow: (plantId, path, spacingCm) => {
      const sp = spacingCm ?? plantSpacing(plantId);
      if (!get().currentAreaId || path.length < 2 || !sp) return null;
      const id = uid('i');
      const it = withCount({ kind: 'row', id, plantId, path: roundPts(path), spacingCm: sp, count: 0, status: 'needed' });
      mapItems((items) => [...items, it]);
      return id;
    },

    updateShape: (id, points) =>
      mapItems((items) =>
        items.map((it) => {
          if (it.id !== id) return it;
          if (it.kind === 'drift') return withCount({ ...it, polygon: roundPts(points) });
          if (it.kind === 'row') return withCount({ ...it, path: roundPts(points) });
          return it;
        }),
      ),

    moveItems: (ids, dx, dy) => {
      if (!ids.length || (dx === 0 && dy === 0)) return;
      const set_ = new Set(ids);
      mapItems((items) => items.map((it) => (set_.has(it.id) ? withCount(roundItem(translateItem(it, dx, dy))) : it)));
    },

    updateItems: (ids, patch) => {
      const set_ = new Set(ids);
      mapItems((items) =>
        items.map((it) => {
          if (!set_.has(it.id)) return it;
          const { x, y, pattern, spacingCm, ...rest } = patch;
          let next = { ...it, ...rest } as PlacedItem;
          if (next.kind === 'plant') {
            if (x !== undefined || y !== undefined) next = { ...next, x: round1(x ?? next.x), y: round1(y ?? next.y) };
            return next;
          }
          // A species change on a drift/row adopts the new plant's spacing unless one is given.
          const sp = spacingCm ?? (rest.plantId && rest.plantId !== it.plantId ? plantSpacing(rest.plantId) : undefined);
          if (sp && sp > 0) next = { ...next, spacingCm: Math.round(sp * 10) / 10 };
          if (pattern && next.kind === 'drift') next = { ...next, pattern };
          return withCount(next);
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
            const c = { ...withCount(roundItem(translateItem(i, dx, dy))), id: uid('i') };
            created.push(c.id);
            return c;
          });
        return copies.length ? [...items, ...copies] : items;
      });
      return created;
    },

    setMuted: (wid, muted) => {
      const id = get().currentAreaId;
      if (!id) return;
      mapArea(id, (a) => {
        const v = activeVariant(a);
        const cur = v.muted ?? [];
        if (cur.includes(wid) === muted) return a;
        const next = muted ? [...cur, wid] : cur.filter((x) => x !== wid);
        return { ...a, variants: a.variants.map((x) => (x.id === v.id ? { ...x, muted: next } : x)) };
      });
    },

    setSpeciesStatus: (code, status, areaIds, onlyFrom) =>
      commit((p) => ({
        ...p,
        areas: p.areas.map((a) =>
          !areaIds.includes(a.id)
            ? a
            : {
                ...a,
                variants: a.variants.map((v) =>
                  v.id !== a.chosenVariantId
                    ? v
                    : {
                        ...v,
                        items: v.items.map((it) =>
                          it.plantId === code && (!onlyFrom || it.status === onlyFrom) && it.status !== status ? { ...it, status } : it,
                        ),
                      },
                ),
              },
        ),
      })),

    addFixture: (f) => {
      const areaId = get().currentAreaId;
      if (!areaId) return null;
      const id = uid('f');
      mapArea(areaId, (a) => ({ ...a, fixtures: [...a.fixtures, { ...f, id }] }));
      return id;
    },

    updateFixture: (fid, patch) => mapFixtures((fs) => fs.map((f) => (f.id === fid ? { ...f, ...patch } : f))),

    moveFixture: (fid, dx, dy) => {
      if (dx === 0 && dy === 0) return;
      mapFixtures((fs) =>
        fs.map((f) =>
          f.id === fid
            ? {
                ...f,
                x: round1(f.x + dx),
                y: round1(f.y + dy),
                ...(f.polygon ? { polygon: f.polygon.map(([x, y]) => [round1(x + dx), round1(y + dy)] as Pt) } : {}),
              }
            : f,
        ),
      );
    },

    deleteFixture: (fid) => mapFixtures((fs) => fs.filter((f) => f.id !== fid)),

    setBackground: (bg) => {
      const id = get().currentAreaId;
      if (!id) return;
      mapArea(id, (a) => {
        if (!bg) {
          const { background: _drop, ...rest } = a;
          return rest;
        }
        return { ...a, background: bg };
      });
    },

    renameProject: (name) => {
      const n = name.trim();
      if (n) commit((p) => (p.name === n ? p : { ...p, name: n }));
    },

    setScheduleWindow: (start, end) =>
      commit((p) => ({ ...p, schedule: { start, end, done: p.schedule?.done ?? [] } })),

    toggleTask: (tid) =>
      commit((p) => {
        if (!p.schedule) return p;
        const done = p.schedule.done.includes(tid) ? p.schedule.done.filter((x) => x !== tid) : [...p.schedule.done, tid];
        return { ...p, schedule: { ...p.schedule, done } };
      }),

    duplicateVariant: (vid) => {
      const areaId = get().currentAreaId;
      if (!areaId) return null;
      const id = uid('v');
      mapArea(areaId, (a) => {
        const src = a.variants.find((v) => v.id === vid);
        if (!src) return a;
        const copy: Variant = {
          id,
          name: nextVariantName(a.variants),
          notes: src.notes,
          items: src.items.map((it) => ({ ...it, id: uid('i') })),
          // Muted ids that refer to items no longer match; species-level ones carry over.
          muted: src.muted?.filter((m) => !m.includes('i_')),
        };
        return { ...a, variants: [...a.variants, copy], activeVariantId: id };
      });
      return id;
    },

    addEmptyVariant: () => {
      const areaId = get().currentAreaId;
      if (!areaId) return null;
      const id = uid('v');
      mapArea(areaId, (a) => ({ ...a, variants: [...a.variants, { id, name: nextVariantName(a.variants), items: [], notes: '' }], activeVariantId: id }));
      return id;
    },

    renameVariant: (vid, name) => {
      const areaId = get().currentAreaId;
      const n = name.trim();
      if (!areaId || !n) return;
      mapArea(areaId, (a) => ({ ...a, variants: a.variants.map((v) => (v.id === vid ? { ...v, name: n } : v)) }));
    },

    deleteVariant: (vid) => {
      const areaId = get().currentAreaId;
      if (!areaId) return;
      mapArea(areaId, (a) => {
        if (a.variants.length <= 1 || !a.variants.some((v) => v.id === vid)) return a;
        const variants = a.variants.filter((v) => v.id !== vid);
        const chosen = a.chosenVariantId === vid ? variants[0].id : a.chosenVariantId;
        const active = (a.activeVariantId ?? a.chosenVariantId) === vid ? chosen : a.activeVariantId;
        return { ...a, variants, chosenVariantId: chosen, activeVariantId: active };
      });
    },

    setActiveVariant: (vid) => {
      const areaId = get().currentAreaId;
      if (areaId) mapArea(areaId, (a) => (a.activeVariantId === vid ? a : { ...a, activeVariantId: vid }));
    },

    setChosenVariant: (vid) => {
      const areaId = get().currentAreaId;
      if (areaId) mapArea(areaId, (a) => (a.chosenVariantId === vid ? a : { ...a, chosenVariantId: vid }));
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
});

const roundPts = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [round1(x), round1(y)]);

/** Drifts and rows keep their plant count in sync with their shape and spacing. */
function withCount(it: PlacedItem): PlacedItem {
  return it.kind === 'plant' ? it : { ...it, count: itemCount(it) };
}

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
