import { create } from 'zustand';

export type Tool = 'select' | 'plant' | 'drift' | 'row' | 'season' | 'list';

export interface Layers {
  background: boolean;
  warnings: boolean;
  plants: boolean;
  spacing: boolean;
  grid: boolean;
  fixtures: boolean;
  zones: boolean;
  dimensions: boolean;
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
  setCalibrate: (calibrate) => set({ calibrate }),
  setPage: (page) => set({ page, compare: false }),
  setCompare: (compare) => set({ compare }),
  setMonth: (month) => set({ month }),
  setFourUp: (fourUp) => set({ fourUp }),
  setDriftPattern: (driftPattern) => set({ driftPattern }),
  setRowMode: (rowMode) => set({ rowMode }),
  layers: { background: true, warnings: true, plants: true, spacing: false, grid: true, fixtures: true, zones: true, dimensions: true },
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
