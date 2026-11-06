import { type Pattern } from '../engine/fill';
import { type MixPart } from '../engine/mix';
import { type AreaInput } from '../data/templates';
import { type Area, type Camera, type Fixture, type ItemStatus, type PlacedItem, type Plant, type Project, type Pt, type Render, type Settings } from '../model/types';

export const HISTORY_LIMIT = 100;

export type ItemPatch = Partial<{ plantId: string; status: ItemStatus; note: string; x: number; y: number; pattern: Pattern; spacingCm: number; spreadCm: number | undefined }>;

/** Where a species replacement applies: the edited variant, every variant of the area, or the whole project. */
export type ReplaceScope = 'variant' | 'area' | 'project';

export interface ProjectState {
  project: Project | null;
  currentAreaId: string | null;
  past: Project[];
  future: Project[];

  setLoaded: (p: Project | null) => void;
  createProject: (templateKeys: string[]) => void;
  addArea: (input: AreaInput) => string;
  addTemplateArea: (templateKey: string) => string | null;
  /** Adds a ready-made example plan as a new area (creating the project if there is none); returns its id. */
  addExampleArea: (key: string) => string | null;
  updateArea: (id: string, patch: Partial<Omit<Area, 'id'>>) => void;
  deleteArea: (id: string) => void;
  selectArea: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  addPlant: (p: Plant) => void;
  updatePlant: (code: string, p: Plant) => void;
  deletePlant: (code: string) => void;
  importPlants: (plants: Plant[], mode: 'merge' | 'replace') => void;
  /** Take the changed built-in data for the given species (all with an update when omitted). */
  adoptSeedUpdates: (codes?: string[]) => void;

  placePlant: (plantId: string, x: number, y: number) => string | null;
  addDrift: (plantId: string, polygon: Pt[], pattern: Pattern, spacingCm?: number) => string | null;
  addRow: (plantId: string, path: Pt[], spacingCm?: number) => string | null;
  updateShape: (id: string, points: Pt[]) => void;
  moveItems: (ids: string[], dx: number, dy: number) => void;
  updateItems: (ids: string[], patch: ItemPatch) => void;
  deleteItems: (ids: string[]) => void;
  /** Split drifts and rows into single plants at their positions; returns the ids of the new plants. */
  explodeItems: (ids: string[]) => string[];
  /** Add plants (and remove some) in the edited variant as one undoable step (zone fill). */
  applyFill: (add: PlacedItem[], removeIds: string[]) => void;
  /**
   * Replace every plant of one species with another in the chosen scope. Drifts and rows take the
   * new plant's spacing (their count is recomputed) unless keepSpacing. With several targets the species are
   * mixed at random in proportion to their weights, per item or (mode 'plant') per single plant.
   * Returns the number of items (or plants) changed.
   */
  replaceSpecies: (from: string, to: string | MixPart[], scope: ReplaceScope, keepSpacing?: boolean, mode?: 'item' | 'plant') => number;
  duplicateItems: (ids: string[], dx: number, dy: number) => string[];

  setMuted: (warningId: string, muted: boolean) => void;
  /** Set the status of every item of a species in the chosen variants of the given areas. */
  setSpeciesStatus: (code: string, status: ItemStatus, areaIds: string[], onlyFrom?: ItemStatus | null) => void;

  addFixture: (f: Omit<Fixture, 'id'>) => string | null;
  updateFixture: (id: string, patch: Partial<Omit<Fixture, 'id'>>) => void;
  moveFixture: (id: string, dx: number, dy: number) => void;
  deleteFixture: (id: string) => void;

  renameProject: (name: string) => void;
  /** Replace the outline with a free polygon; everything is shifted so the outline starts at 0,0. */
  setAreaShape: (areaId: string, points: Pt[]) => void;
  setBackground: (bg: Area['background'] | null) => void;
  /** Viewpoint of the current area for the visualisation (null removes it). */
  setCamera: (cam: Camera | null) => void;
  addRender: (variantId: string, r: Omit<Render, 'id'>) => void;
  deleteRender: (variantId: string, renderId: string) => void;
  setScheduleWindow: (start: string, end: string) => void;
  toggleTask: (taskId: string) => void;

  duplicateVariant: (variantId: string) => string | null;
  addEmptyVariant: () => string | null;
  /** New variant with ready items (e.g. from the idea generator); it becomes the edited one. */
  addVariantWith: (name: string, items: PlacedItem[], notes: string, folderName?: string) => string | null;
  addVariantFolder: (name: string, parentId?: string | null) => string | null;
  renameVariantFolder: (folderId: string, name: string) => void;
  /** Removes the folder only; its contents move up one level. */
  deleteVariantFolder: (folderId: string) => void;
  /** Move a variant or folder under another one (null = top level); refuses cycles. */
  moveVariantNode: (id: string, parentId: string | null) => void;
  /** Replace a variant's items in one undoable step (idea generator "Újra"). */
  setVariantItems: (variantId: string, items: PlacedItem[], notes: string) => void;
  renameVariant: (variantId: string, name: string) => void;
  deleteVariant: (variantId: string) => void;
  setActiveVariant: (variantId: string) => void;
  setChosenVariant: (variantId: string) => void;

  undo: () => void;
  redo: () => void;
}

export type Actions = Omit<ProjectState, 'project' | 'currentAreaId' | 'past' | 'future'>;

/** What every slice gets from the store core. */
export interface StoreCtx {
  set: (s: Partial<ProjectState>) => void;
  get: () => ProjectState;
  /** Apply an immutable change to the project and record it for undo. */
  commit: (fn: (p: Project) => Project) => void;
  mapArea: (id: string, fn: (a: Area) => Area) => void;
  /** Change the item list of the active variant of the current area. */
  mapItems: (fn: (items: PlacedItem[]) => PlacedItem[]) => void;
  mapFixtures: (fn: (fs: Fixture[]) => Fixture[]) => void;
  insertArea: (area: Area) => string;
  ensureCurrentArea: () => void;
  plantSpacing: (code: string) => number;
}
