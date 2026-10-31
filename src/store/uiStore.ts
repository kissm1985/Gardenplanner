import { create } from 'zustand';
import type { MixPart } from '../engine/mix';
import type { ZoneMode } from '../engine/zoneFill';
import type { PromptOptions } from '../engine/visualPrompt';
import { getLang } from '../i18n';
import type { FixtureType, Pt } from '../model/types';
import { NO_FILTER, type PlantFilter } from '../model/plantFilter';

export interface ZoneConfig {
  parts: MixPart[];
  mode: ZoneMode;
  density: number;
  clear: boolean;
  /** Mixed mode: no two plants of the same species side by side. */
  noSameNeighbour?: boolean;
  /** Extra distance between plants, cm. */
  extraGapCm?: number;
}

export type Tool = 'select' | 'plant' | 'drift' | 'row' | 'fixtures' | 'season' | 'list';

export interface Layers {
  background: boolean;
  warnings: boolean;
  plants: boolean;
  spacing: boolean;
  grid: boolean;
  fixtures: boolean;
  zones: boolean;
  dimensions: boolean;
  /** Visualisation viewpoint; it also shows while placing it or while the Látványterv window is open. */
  camera: boolean;
}

/** Transient UI state: never saved, never part of undo history. */
export interface UiState {
  tool: Tool;
  activePlant: string | null;
  selected: string[];
  selectedFixture: string | null;
  lasso: boolean;
  snap: boolean;
  layers: Layers;
  driftPattern: 'grid' | 'staggered';
  rowMode: 'line' | 'curve';
  /** Season view month (1–12) and side-by-side mode. */
  month: number;
  fourUp: boolean;
  /** Variant comparison view is open. */
  compare: boolean;
  /** Full-screen page opened from a menu (planting schedule & care). */
  page: 'schedule' | null;
  /** Background scale calibration: points tapped so far (cm), or null when off. */
  calibrate: [number, number][] | null;
  /** Options of the visualisation brief (kept while the app is open). */
  vizOptions: PromptOptions;
  setVizOptions: (o: PromptOptions) => void;
  /** The start page is showing (on every launch, and from the logo). */
  home: boolean;
  setHome: (v: boolean) => void;
  /** The start screen asked for an own area: App opens the new-area form once. */
  startWithNewArea: boolean;
  setStartWithNewArea: (v: boolean) => void;
  /** The Látványterv window is open (the viewpoint shows on the plan meanwhile). */
  visualOpen: boolean;
  setVisualOpen: (v: boolean) => void;
  /** Placing the visualisation viewpoint on the plan. */
  cameraEdit: boolean;
  setCameraEdit: (v: boolean) => void;
  /** Plant filters shared by the database list and the palette. */
  plantFilter: PlantFilter;
  /** Fixture type armed in the Elemek tool (tap or drag on the plan to add one). */
  fixtureTool: FixtureType | null;
  setFixtureTool: (t: FixtureType | null) => void;
  /** Zone fill: settings kept while the region is drawn, the region just drawn, and the last fill (for "Újra"). */
  zoneConfig: ZoneConfig;
  setZoneConfig: (c: ZoneConfig) => void;
  zoneDraft: { areaId: string; points: Pt[] } | null;
  setZoneDraft: (z: { areaId: string; points: Pt[] } | null) => void;
  lastZone: { areaId: string; points: Pt[]; ids: string[]; counts: Record<string, number> } | null;
  setLastZone: (z: UiState['lastZone']) => void;
  /** Collapsed nodes of the variant tree. */
  collapsed: string[];
  toggleCollapsed: (id: string) => void;
  /** Area outline editor: drawing a new outline point by point, or editing corners. */
  shapeEdit: {
    areaId: string;
    mode: 'draw' | 'edit';
    points: [number, number][];
    selected: number | null;
    /** What is being shaped: the area outline (default) or a lawn inside it (new or existing fixture). */
    target?: { kind: 'lawn'; fixtureId?: string } | { kind: 'zone' };
  } | null;
  setShapeEdit: (v: UiState['shapeEdit']) => void;
  setPlantFilter: (f: PlantFilter) => void;
  setCalibrate: (v: [number, number][] | null) => void;
  setPage: (p: 'schedule' | null) => void;
  setCompare: (v: boolean) => void;
  setMonth: (m: number) => void;
  setFourUp: (v: boolean) => void;
  setDriftPattern: (p: 'grid' | 'staggered') => void;
  setRowMode: (m: 'line' | 'curve') => void;
  setTool: (t: Tool) => void;
  setActivePlant: (code: string | null) => void;
  select: (ids: string[]) => void;
  selectFixture: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  setLasso: (v: boolean) => void;
  setSnap: (v: boolean) => void;
  setLayer: (k: keyof Layers, v: boolean) => void;
}

export const useUi = create<UiState>()((set) => ({
  tool: 'select',
  activePlant: null,
  selected: [],
  selectedFixture: null,
  lasso: false,
  snap: false,
  driftPattern: 'staggered',
  rowMode: 'line',
  month: new Date().getMonth() + 1,
  fourUp: false,
  compare: false,
  page: null,
  calibrate: null,
  cameraEdit: false,
  visualOpen: false,
  setVisualOpen: (visualOpen) => set({ visualOpen }),
  startWithNewArea: false,
  home: true,
  setHome: (home) => set({ home, compare: false, page: null }),
  setStartWithNewArea: (startWithNewArea) => set({ startWithNewArea }),
  vizOptions: { season: 1, viewpoint: 'camera', lang: getLang(), mature: true, style: 'photo', time: 'afternoon', weather: 'sunny' },
  setVizOptions: (vizOptions) => set({ vizOptions }),
  setCameraEdit: (cameraEdit) => set({ cameraEdit, selected: [], selectedFixture: null }),
  plantFilter: NO_FILTER,
  fixtureTool: null,
  setFixtureTool: (fixtureTool) => set({ fixtureTool }),
  zoneConfig: { parts: [], mode: 'mix', density: 0.95, clear: false },
  setZoneConfig: (zoneConfig) => set({ zoneConfig }),
  zoneDraft: null,
  setZoneDraft: (zoneDraft) => set({ zoneDraft }),
  lastZone: null,
  setLastZone: (lastZone) => set({ lastZone }),
  collapsed: [],
  toggleCollapsed: (id) => set((s) => ({ collapsed: s.collapsed.includes(id) ? s.collapsed.filter((x) => x !== id) : [...s.collapsed, id] })),
  shapeEdit: null,
  setShapeEdit: (shapeEdit) => set({ shapeEdit, selected: [], selectedFixture: null }),
  setPlantFilter: (plantFilter) => set({ plantFilter }),
  setCalibrate: (calibrate) => set({ calibrate }),
  setPage: (page) => set({ page, compare: false }),
  setCompare: (compare) => set({ compare }),
  setMonth: (month) => set({ month }),
  setFourUp: (fourUp) => set({ fourUp }),
  setDriftPattern: (driftPattern) => set({ driftPattern }),
  setRowMode: (rowMode) => set({ rowMode }),
  layers: { background: true, warnings: true, plants: true, spacing: false, grid: true, fixtures: true, zones: true, dimensions: true, camera: false },
  setTool: (tool) => set((s) => ({ tool, lasso: tool === 'select' ? s.lasso : false, compare: false, page: null })),
  setActivePlant: (activePlant) => set({ activePlant }),
  select: (selected) => set((s) => ({ selected, selectedFixture: selected.length ? null : s.selectedFixture })),
  selectFixture: (selectedFixture) => set((s) => ({ selectedFixture, selected: selectedFixture ? [] : s.selected })),
  toggleSelect: (id) => set((s) => ({ selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] })),
  setLasso: (lasso) => set({ lasso }),
  setSnap: (snap) => set({ snap }),
  setLayer: (k, v) => set((s) => ({ layers: { ...s.layers, [k]: v } })),
}));

/** The canvas registers this so the palette can drop a plant at a screen position. */
export const canvasBridge: {
  dropAt: ((clientX: number, clientY: number, plantId: string) => boolean) | null;
  /** Centre the view on a point (cm), zooming in if needed. */
  focus: ((x: number, y: number) => void) | null;
  /** Current view centre in cm (for adding fixtures where the user is looking). */
  center: (() => [number, number]) | null;
} = { dropAt: null, focus: null, center: null };
