import { create } from 'zustand';

export type Tool = 'select' | 'plant' | 'drift' | 'row' | 'season' | 'list';

export interface Layers {
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
  lasso: boolean;
  snap: boolean;
  layers: Layers;
  setTool: (t: Tool) => void;
  setActivePlant: (code: string | null) => void;
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  setLasso: (v: boolean) => void;
  setSnap: (v: boolean) => void;
  setLayer: (k: keyof Layers, v: boolean) => void;
}

export const useUi = create<UiState>()((set) => ({
  tool: 'select',
  activePlant: null,
  selected: [],
  lasso: false,
  snap: false,
  layers: { plants: true, spacing: false, grid: true, fixtures: true, zones: true, dimensions: true },
  setTool: (tool) => set((s) => ({ tool, lasso: tool === 'select' ? s.lasso : false })),
  setActivePlant: (activePlant) => set({ activePlant }),
  select: (selected) => set({ selected }),
  toggleSelect: (id) => set((s) => ({ selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] })),
  setLasso: (lasso) => set({ lasso }),
  setSnap: (snap) => set({ snap }),
  setLayer: (k, v) => set((s) => ({ layers: { ...s.layers, [k]: v } })),
}));

/** The canvas registers this so the palette can drop a plant at a screen position. */
export const canvasBridge: { dropAt: ((clientX: number, clientY: number, plantId: string) => boolean) | null } = { dropAt: null };
