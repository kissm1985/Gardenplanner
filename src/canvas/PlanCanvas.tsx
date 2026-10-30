import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { fillPath, fillPolygon } from '../engine/fill';
import { bbox, centroid, dist, pointInPolygon, polygonArea, simplify, snap } from '../model/geometry';
import { effectivePlant, plantMap } from '../model/plants';
import { DRAG_DRAWN, dragFixture, FIXTURE_LABEL, MOVE_WHEN_SELECTED, newFixture } from '../model/fixtures';
import type { Area, Camera, Fixture, FixtureType, Plant, Pt, Settings } from '../model/types';
import { dirTowardsCentre } from '../model/camera';
import { CameraMark } from './layers/Camera';
import { selectItems, useProject } from '../store/projectStore';
import { canvasBridge, useUi } from '../store/uiStore';
import type { Warning } from '../engine/rules';
import { AreaClip, AreaShapeEl } from './AreaShape';
import { FixturesLayer, FixtureZonesLayer, RESIZE_OFFSET_PX, type FixtureDrag } from './layers/Fixtures';
import { GridLayer } from './layers/Grid';
import { CountLabel, GroupLabels, PlantsLayer, plantRadius, VertexHandles, type DragOffset, type ShapeOverride } from './layers/Plants';
import { Rulers, RULER } from './layers/Rulers';
import { WarningsLayer } from './layers/Warnings';
import { PlantTooltip } from '../ui/PlantTooltip';
import { fitView, niceStep, pinchView, screenToWorld, zoomAt, type View } from './viewport';
import { locale, t } from '../i18n';

interface Props {
  area: Area;
  settings: Settings;
  plantDb: Plant[];
  warnings: Warning[];
}

type P2 = { x: number; y: number };

type Gesture =
  | { mode: 'pan'; view: View; start: P2; moved: boolean; onEmpty: boolean; additive: boolean; fx?: string }
  | { mode: 'move'; start: P2; ids: string[]; anchor: Pt; moved: boolean; tappedId: string; additive: boolean; wasSelected: boolean }
  | { mode: 'lasso'; points: Pt[] }
  | { mode: 'draw'; kind: 'drift' | 'curve' | 'line'; points: Pt[]; startPx: P2; moved: boolean }
  | { mode: 'fixture'; id: string; start: P2; anchor: Pt; moved: boolean }
  | { mode: 'shapeVertex'; index: number; start: P2; moved: boolean }
  | { mode: 'vertex'; id: string; index: number; points: Pt[]; start: P2; moved: boolean }
  | { mode: 'pinch'; view: View; start: Map<number, P2> }
  | { mode: 'fxrect'; type: FixtureType; a: Pt; startPx: P2; moved: boolean }
  | { mode: 'resize'; id: string; center: Pt; plant: Plant; start: P2; moved: boolean }
  | { mode: 'fxresize'; f: Fixture; start: P2; moved: boolean }
  | { mode: 'camera'; at: Pt; start: P2; moved: boolean };

const DOUBLE_TAP_MS = 300;
/** Height of the floating tool row over the top of the plan; fitting keeps the area below it. */
const OVERLAY_TOP = 52;
const TAP_SLOP_PX = 8;
export const SNAP_CM = 10;

/** Spread (cm, in 5 cm steps) whose drawn radius is r — the inverse of plantRadius. */
const spreadFromRadius = (r: number, mature: boolean) => Math.min(5000, Math.max(5, Math.round((mature ? r * 2 : r / 0.2) / 5) * 5));

export function PlanCanvas({ area, settings, plantDb, warnings }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const items = useProject(selectItems);
  const tool = useUi((s) => s.tool);
  const activePlant = useUi((s) => s.activePlant);
  const selected = useUi((s) => s.selected);
  const selectedFixture = useUi((s) => s.selectedFixture);
  const [fxDrag, setFxDrag] = useState<FixtureDrag | null>(null);
  // Plant info card: follows the mouse; on touch it opens on a long press and stays until the next touch.
  const [hover, setHover] = useState<{ id: string; x: number; y: number; pinned: boolean } | null>(null);
  const pressTimer = useRef<number | undefined>(undefined);
  const clearPress = () => window.clearTimeout(pressTimer.current);
  const lasso = useUi((s) => s.lasso);
  const layers = useUi((s) => s.layers);
  const month = useUi((s) => (s.tool === 'season' ? s.month : null));
  const calibrate = useUi((s) => s.calibrate);
  const cameraEdit = useUi((s) => s.cameraEdit);
  const visualOpen = useUi((s) => s.visualOpen);
  const [camDraft, setCamDraft] = useState<Camera | null>(null);
  const shapeEditAll = useUi((s) => s.shapeEdit);
  const shapeEdit = shapeEditAll?.areaId === area.id ? shapeEditAll : null;
  const setShapePts = (points: [number, number][], selected: number | null = shapeEdit?.selected ?? null) =>
    shapeEdit && useUi.getState().setShapeEdit({ ...shapeEdit, points, selected });
  const plants = useMemo(() => plantMap(plantDb), [plantDb]);

  const pointers = useRef(new Map<number, P2>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<DragOffset | null>(null);
  const [lassoPts, setLassoPts] = useState<Pt[] | null>(null);
  const [draft, setDraft] = useState<{ kind: 'drift' | 'curve' | 'line'; points: Pt[] } | null>(null);
  const [fxDraft, setFxDraft] = useState<Omit<Fixture, 'id'> | null>(null);
  const fixtureTool = useUi((s) => s.fixtureTool);
  const [shape, setShape] = useState<ShapeOverride | null>(null);
  /** Live spread while a single plant's size handle is dragged. */
  const [resize, setResize] = useState<{ id: string; spreadCm: number } | null>(null);
  const pendingLineStart = useRef<Pt | null>(null);
  const [pendingStart, setPendingStart] = useState<Pt | null>(null);
  const driftPattern = useUi((s) => s.driftPattern);
  const rowMode = useUi((s) => s.rowMode);

  // Drop selections that no longer exist (after undo, delete, area switch).
  useEffect(() => {
    const ids = new Set(items.map((i) => i.id));
    const sel = useUi.getState().selected;
    if (sel.some((id) => !ids.has(id))) useUi.getState().select(sel.filter((id) => ids.has(id)));
  }, [items]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const fit = useCallback(
    (w = size.w, h = size.h) => {
      if (!w || !h) return;
      // Leave room for the rulers (top/left) and the floating tool row.
      const v = fitView(area.widthCm, area.lengthCm, w - RULER, h - RULER - OVERLAY_TOP - 12, 18);
      setView({ ...v, tx: v.tx + RULER, ty: v.ty + RULER + OVERLAY_TOP });
    },
    [area.widthCm, area.lengthCm, size.w, size.h],
  );

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    // React's wheel listener is passive; stop browser page-zoom (ctrl+wheel) natively.
    const stop = (e: globalThis.WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', stop, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', stop);
    };
  }, []);

  // Re-fit when the area (or its size) changes, or on first layout.
  const fittedFor = useRef('');
  useEffect(() => {
    const key = `${area.id}:${area.widthCm}x${area.lengthCm}`;
    if (size.w && size.h && fittedFor.current !== key) {
      fittedFor.current = key;
      fit();
    }
  }, [area.id, area.widthCm, area.lengthCm, size.w, size.h, fit]);

  const local = (e: { clientX: number; clientY: number }): P2 => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toWorld = (p: P2): Pt => screenToWorld(viewRef.current!, p.x, p.y);
  const snapPt = ([x, y]: Pt): Pt => (useUi.getState().snap ? [snap(x, SNAP_CM), snap(y, SNAP_CM)] : [x, y]);

  const place = (plantId: string, w: Pt) => {
    const [x, y] = snapPt(w);
    const id = useProject.getState().placePlant(plantId, x, y);
    if (id) useUi.getState().select([id]);
  };

  // Palette drag-and-drop lands here.
  useEffect(() => {
    canvasBridge.dropAt = (cx, cy, plantId) => {
      const el = boxRef.current;
      if (!el || !viewRef.current) return false;
      const r = el.getBoundingClientRect();
      if (cx < r.left + RULER || cx > r.right || cy < r.top + RULER || cy > r.bottom) return false;
      place(plantId, toWorld({ x: cx - r.left, y: cy - r.top }));
      return true;
    };
    return () => {
      canvasBridge.dropAt = null;
    };
  });

  // Warning list jumps and "add fixture here" use these.
  useEffect(() => {
    canvasBridge.focus = (x, y) => {
      const v = viewRef.current;
      if (!v) return;
      const s = Math.max(v.s, 1.2);
      setView({ s, tx: size.w / 2 - x * s, ty: size.h / 2 - y * s });
    };
    canvasBridge.center = () => {
      const v = viewRef.current;
      return v ? screenToWorld(v, size.w / 2, size.h / 2) : [area.widthCm / 2, area.lengthCm / 2];
    };
    return () => {
      canvasBridge.focus = null;
      canvasBridge.center = null;
    };
  });

  const itemPos = (id: string): Pt => {
    const it = items.find((i) => i.id === id);
    if (!it) return [0, 0];
    if (it.kind === 'plant') return [it.x, it.y];
    return it.kind === 'drift' ? it.polygon[0] : it.path[0];
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!view) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    clearPress();
    if (e.pointerType !== 'mouse') {
      setHover(null);
      const id = (e.target as Element).closest?.('[data-id]')?.getAttribute('data-id');
      if (id) pressTimer.current = window.setTimeout(() => setHover({ id, x: p.x, y: p.y, pinned: true }), 500);
    }

    if (pointers.current.size >= 2) {
      // Second finger: abandon move / lasso and pinch instead.
      setDrag(null);
      setLassoPts(null);
      setDraft(null);
      setShape(null);
      setFxDrag(null);
      gesture.current = { mode: 'pinch', view, start: new Map(pointers.current) };
      return;
    }

    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const target = e.target as Element;
    const hitId = target.closest?.('[data-id]')?.getAttribute('data-id') ?? null;
    const handle = target.getAttribute?.('data-handle');
    // An armed Elemek tool draws or places over existing elements instead of grabbing them.
    const armedFx = tool === 'fixtures' ? fixtureTool : null;
    const fxId = hitId || armedFx ? null : (target.closest?.('[data-fixture]')?.getAttribute('data-fixture') ?? null);
    const fxResize = armedFx ? null : (target.getAttribute?.('data-fx-resize') ?? null);
    const editing = editable();
    const sv = target.getAttribute?.('data-shape-vertex');
    const sm = target.getAttribute?.('data-shape-mid');
    if (cameraEdit) {
      // Viewpoint: press where you stand, drag towards where you look.
      const at = toWorld(p);
      const dir = area.camera && dist(at, [area.camera.x, area.camera.y]) * viewRef.current!.s < 24 ? area.camera.dir : dirTowardsCentre(area, at[0], at[1]);
      const c = area.camera && dist(at, [area.camera.x, area.camera.y]) * viewRef.current!.s < 24 ? area.camera : { x: at[0], y: at[1], dir };
      setCamDraft(c);
      gesture.current = { mode: 'camera', at: [c.x, c.y], start: p, moved: false };
    } else if (shapeEdit && sv != null) {
      setShapePts(shapeEdit.points, +sv);
      gesture.current = { mode: 'shapeVertex', index: +sv, start: p, moved: false };
    } else if (shapeEdit && sm != null) {
      // Insert a corner in the middle of the edge and drag it straight away.
      const i = +sm;
      const a = shapeEdit.points[i];
      const b = shapeEdit.points[(i + 1) % shapeEdit.points.length];
      const pts = [...shapeEdit.points];
      pts.splice(i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      setShapePts(pts, i + 1);
      gesture.current = { mode: 'shapeVertex', index: i + 1, start: p, moved: false };
    } else if (shapeEdit) {
      gesture.current = { mode: 'pan', view, start: p, moved: false, onEmpty: true, additive: false };
    } else if (useUi.getState().calibrate) {
      gesture.current = { mode: 'pan', view, start: p, moved: false, onEmpty: true, additive: false };
    } else if (tool === 'select' && target.getAttribute?.('data-resize')) {
      const it = items.find((i) => i.id === target.getAttribute('data-resize'));
      const pl = it && plants.get(it.plantId);
      if (it?.kind === 'plant' && pl) gesture.current = { mode: 'resize', id: it.id, center: [it.x, it.y], plant: pl, start: p, moved: false };
    } else if ((tool === 'select' || tool === 'fixtures') && fxResize) {
      const f = area.fixtures.find((x) => x.id === fxResize);
      if (f) gesture.current = { mode: 'fxresize', f, start: p, moved: false };
    } else if (tool === 'select' && handle != null && editing) {
      gesture.current = { mode: 'vertex', id: editing.id, index: +handle, points: editing.points, start: p, moved: false };
    } else if ((tool === 'drift' || tool === 'row') && activePlant) {
      const kind = tool === 'drift' ? 'drift' : rowMode === 'curve' ? 'curve' : 'line';
      const w = kind === 'line' ? snapPt(toWorld(p)) : toWorld(p);
      gesture.current = { mode: 'draw', kind, points: [w], startPx: p, moved: false };
    } else if (tool === 'select' && hitId) {
      const ui = useUi.getState();
      const wasSelected = ui.selected.includes(hitId);
      let ids = ui.selected;
      if (!wasSelected) {
        ids = additive ? [...ids, hitId] : [hitId];
        ui.select(ids);
      }
      gesture.current = { mode: 'move', start: p, ids, anchor: itemPos(hitId), moved: false, tappedId: hitId, additive, wasSelected };
    } else if (armedFx && DRAG_DRAWN.has(armedFx)) {
      gesture.current = { mode: 'fxrect', type: armedFx, a: snapPt(toWorld(p)), startPx: p, moved: false };
    } else if (tool === 'select' && lasso) {
      gesture.current = { mode: 'lasso', points: [toWorld(p)] };
      setLassoPts([toWorld(p)]);
    } else if ((tool === 'select' || tool === 'fixtures') && fxId) {
      const f = area.fixtures.find((x) => x.id === fxId);
      if (f && MOVE_WHEN_SELECTED.has(f.type) && useUi.getState().selectedFixture !== fxId) {
        // Large elements: a tap selects, a drag pans the plan; once selected they can be dragged.
        gesture.current = { mode: 'pan', view, start: p, moved: false, onEmpty: false, additive: false, fx: fxId };
      } else {
        useUi.getState().selectFixture(fxId);
        gesture.current = { mode: 'fixture', id: fxId, start: p, anchor: f ? [f.x, f.y] : [0, 0], moved: false };
      }
    } else {
      gesture.current = { mode: 'pan', view, start: p, moved: false, onEmpty: !hitId, additive };
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && !pointers.current.size) {
      const id = (e.target as Element).closest?.('[data-id]')?.getAttribute('data-id');
      const q = local(e);
      setHover(id ? { id, x: q.x, y: q.y, pinned: false } : null);
      return;
    }
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    const p = local(e);
    const s0 = pointers.current.get(e.pointerId);
    if (s0 && Math.hypot(p.x - s0.x, p.y - s0.y) > TAP_SLOP_PX) clearPress();
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (g.mode === 'pinch') {
      const [a, b] = [...pointers.current.keys()];
      const a0 = g.start.get(a);
      const b0 = b === undefined ? undefined : g.start.get(b);
      if (!a0 || !b0) return;
      const a1 = pointers.current.get(a)!;
      const b1 = pointers.current.get(b)!;
      setView(pinchView(g.view, [a0.x, a0.y], [b0.x, b0.y], [a1.x, a1.y], [b1.x, b1.y]));
    } else if (g.mode === 'pan') {
      const dx = p.x - g.start.x;
      const dy = p.y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) < TAP_SLOP_PX) return;
      g.moved = true;
      setView({ ...g.view, tx: g.view.tx + dx, ty: g.view.ty + dy });
    } else if (g.mode === 'move') {
      const dxs = p.x - g.start.x;
      const dys = p.y - g.start.y;
      if (!g.moved && Math.hypot(dxs, dys) < TAP_SLOP_PX) return;
      g.moved = true;
      setDrag({ ids: new Set(g.ids), ...moveDelta(g, dxs, dys) });
    } else if (g.mode === 'lasso') {
      g.points.push(toWorld(p));
      setLassoPts([...g.points]);
    } else if (g.mode === 'draw') {
      if (!g.moved && Math.hypot(p.x - g.startPx.x, p.y - g.startPx.y) < TAP_SLOP_PX) return;
      g.moved = true;
      const w = toWorld(p);
      if (g.kind === 'line') g.points = [g.points[0], snapPt(w)];
      else if (dist(g.points[g.points.length - 1], w) * viewRef.current!.s > 3) g.points.push(w);
      setDraft({ kind: g.kind, points: [...g.points] });
    } else if (g.mode === 'resize') {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 3) return;
      g.moved = true;
      setResize({ id: g.id, spreadCm: spreadFromRadius(dist(toWorld(p), g.center), settings.showMatureSize) });
    } else if (g.mode === 'fxrect') {
      if (!g.moved && Math.hypot(p.x - g.startPx.x, p.y - g.startPx.y) < TAP_SLOP_PX) return;
      g.moved = true;
      setFxDraft(dragFixture(g.type, g.a, snapPt(toWorld(p))));
    } else if (g.mode === 'shapeVertex') {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 3) return;
      g.moved = true;
      const se = useUi.getState().shapeEdit;
      if (!se) return;
      const pts = [...se.points];
      pts[g.index] = snapPt(toWorld(p));
      useUi.getState().setShapeEdit({ ...se, points: pts, selected: g.index });
    } else if (g.mode === 'fixture') {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < TAP_SLOP_PX) return;
      g.moved = true;
      setFxDrag({ id: g.id, ...fixtureDelta(g, p) });
    } else if (g.mode === 'camera') {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < TAP_SLOP_PX) return;
      g.moved = true;
      const w = toWorld(p);
      setCamDraft({ x: g.at[0], y: g.at[1], dir: (Math.atan2(w[1] - g.at[1], w[0] - g.at[0]) * 180) / Math.PI });
    } else if (g.mode === 'fxresize') {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 3) return;
      g.moved = true;
      setFxDrag({ id: g.f.id, dx: 0, dy: 0, ...fixtureSize(g.f, p) });
    } else if (g.mode === 'vertex') {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 3) return;
      g.moved = true;
      const pts = g.points.slice();
      pts[g.index] = snapPt(toWorld(p));
      setShape({ id: g.id, points: pts });
    }
  };

  /** World delta for a move; with snapping on, the grabbed plant lands on the grid. */
  const moveDelta = (g: Extract<Gesture, { mode: 'move' }>, dxs: number, dys: number) => {
    const s = viewRef.current!.s;
    const [ax, ay] = g.anchor;
    const [nx, ny] = snapPt([ax + dxs / s, ay + dys / s]);
    return { dx: nx - ax, dy: ny - ay };
  };

  const fixtureDelta = (g: Extract<Gesture, { mode: 'fixture' }>, p: P2) => {
    const s = viewRef.current!.s;
    const [ax, ay] = g.anchor;
    const [nx, ny] = snapPt([ax + (p.x - g.start.x) / s, ay + (p.y - g.start.y) / s]);
    return { dx: nx - ax, dy: ny - ay };
  };

  /** New size of a fixture whose corner (or crown edge) is dragged to p. */
  const fixtureSize = (f: Fixture, p: P2): { w: number; h: number } | { radius: number } => {
    const o = RESIZE_OFFSET_PX / viewRef.current!.s;
    const w = toWorld(p);
    if (f.radius != null) return { radius: Math.max(20, Math.round(dist(w, [f.x, f.y]) - o)) };
    const [cx, cy] = snapPt([w[0] - o, w[1] - o]);
    return { w: Math.max(5, Math.round(cx - f.x)), h: Math.max(5, Math.round(cy - f.y)) };
  };

  const onPointerUp = (e: PointerEvent) => {
    clearPress();
    const p = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g || !p) return;

    if (g.mode === 'pinch') {
      // Continue panning with the remaining finger without a jump.
      const rest = [...pointers.current.values()][0];
      gesture.current =
        rest && viewRef.current ? { mode: 'pan', view: viewRef.current, start: rest, moved: true, onEmpty: false, additive: false } : null;
      return;
    }
    gesture.current = null;

    if (g.mode === 'move') {
      setDrag(null);
      if (g.moved) {
        const { dx, dy } = moveDelta(g, p.x - g.start.x, p.y - g.start.y);
        useProject.getState().moveItems(g.ids, dx, dy);
      } else if (g.additive && g.wasSelected) {
        // Shift/Ctrl+tap on an already selected plant removes it from the selection.
        useUi.getState().toggleSelect(g.tappedId);
      } else if (!g.additive) {
        useUi.getState().select([g.tappedId]);
      }
      return;
    }
    if (g.mode === 'shapeVertex') return;
    if (g.mode === 'resize') {
      setResize(null);
      if (g.moved) {
        const sp = spreadFromRadius(dist(toWorld(p), g.center), settings.showMatureSize);
        useProject.getState().updateItems([g.id], { spreadCm: sp === g.plant.spreadCm ? undefined : sp });
      }
      return;
    }
    if (g.mode === 'fxrect') {
      setFxDraft(null);
      const w = snapPt(toWorld(p));
      addFixtureAt(g.moved ? dragFixture(g.type, g.a, w) : newFixture(g.type, Math.round(w[0]), Math.round(w[1])));
      return;
    }
    if (g.mode === 'camera') {
      if (camDraft) useProject.getState().setCamera(camDraft);
      setCamDraft(null);
      return;
    }
    if (g.mode === 'fxresize') {
      setFxDrag(null);
      if (g.moved) useProject.getState().updateFixture(g.f.id, fixtureSize(g.f, p));
      return;
    }
    if (g.mode === 'fixture') {
      setFxDrag(null);
      if (g.moved) {
        const { dx, dy } = fixtureDelta(g, p);
        useProject.getState().moveFixture(g.id, dx, dy);
      }
      return;
    }
    if (g.mode === 'vertex') {
      setShape(null);
      if (g.moved) {
        const pts = g.points.slice();
        pts[g.index] = snapPt(toWorld(p));
        useProject.getState().updateShape(g.id, pts);
      }
      return;
    }
    if (g.mode === 'draw') {
      setDraft(null);
      finishDraw(g, p);
      return;
    }
    if (g.mode === 'lasso') {
      setLassoPts(null);
      if (g.points.length > 2) {
        const anchor = (i: (typeof items)[number]): Pt => (i.kind === 'plant' ? [i.x, i.y] : centroid(i.kind === 'drift' ? i.polygon : i.path));
        const hit = items.filter((i) => pointInPolygon(anchor(i), g.points)).map((i) => i.id);
        const cur = useUi.getState().selected;
        useUi.getState().select(e.shiftKey ? [...new Set([...cur, ...hit])] : hit);
      }
      return;
    }
    if (g.mode === 'pan' && !g.moved && g.fx) return useUi.getState().selectFixture(g.fx);
    if (g.mode === 'pan' && !g.moved) onTap(p, g);
  };

  /** The single selected drift/row whose vertices can be dragged. */
  const editable = (): { id: string; points: Pt[] } | null => {
    const sel = useUi.getState().selected;
    if (sel.length !== 1) return null;
    const it = items.find((i) => i.id === sel[0]);
    if (it?.kind === 'drift') return { id: it.id, points: it.polygon };
    if (it?.kind === 'row') return { id: it.id, points: it.path };
    return null;
  };

  const finishDraw = (g: Extract<Gesture, { mode: 'draw' }>, p: P2) => {
    const st = useProject.getState();
    const plantId = activePlant!;
    const tol = 4 / viewRef.current!.s; // ~4 px simplification tolerance
    if (g.kind === 'line') {
      // Drag A→B, or tap A then tap B.
      if (!g.moved) {
        const here = snapPt(toWorld(p));
        const start = pendingLineStart.current;
        if (start && dist(start, here) > 1) {
          pendingLineStart.current = null;
          setPendingStart(null);
          const id = st.addRow(plantId, [start, here]);
          if (id) useUi.getState().select([id]);
        } else {
          pendingLineStart.current = here;
          setPendingStart(here);
        }
        return;
      }
      const id = st.addRow(plantId, g.points);
      if (id) useUi.getState().select([id]);
      return;
    }
    if (!g.moved) {
      if (g.kind === 'drift') hint(t('Húzd körbe ujjal a folt területét.', 'Draw around the drift with your finger.'));
      else hint(t('Húzz egy vonalat ujjal az ív mentén.', 'Trace a line along the curve with your finger.'));
      return;
    }
    const pts = simplify(g.points, tol);
    if (g.kind === 'drift') {
      if (pts.length < 3 || polygonArea(pts) < 100) return hint(t('Ez a folt túl kicsi. Rajzolj nagyobbat.', 'This drift is too small. Draw a bigger one.'));
      const id = st.addDrift(plantId, pts, useUi.getState().driftPattern);
      if (id) useUi.getState().select([id]);
    } else {
      if (pts.length < 2) return;
      const id = st.addRow(plantId, pts);
      if (id) useUi.getState().select([id]);
    }
  };

  const [toast, setToast] = useState('');
  const hint = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 2500);
  };

  // Forget a half-made straight row when the tool or plant changes.
  useEffect(() => {
    pendingLineStart.current = null;
    setPendingStart(null);
  }, [tool, activePlant, rowMode]);

  /** Background scale from two tapped points whose real distance the user knows. */
  const calibrateTap = (w: Pt) => {
    const ui = useUi.getState();
    const pts = [...(ui.calibrate ?? []), w];
    if (pts.length < 2) return ui.setCalibrate(pts as [number, number][]);
    ui.setCalibrate(null);
    const bg = area.background;
    const measured = dist(pts[0], pts[1]);
    if (!bg || measured < 1) return;
    const input = prompt(
      t(`Mekkora a valódi távolság a két pont között (cm)? A kép szerint most ${Math.round(measured)} cm.`, `What is the real distance between the two points (cm)? The image now says ${Math.round(measured)} cm.`),
    );
    const real = input ? parseFloat(input.replace(',', '.')) : NaN;
    if (!(real > 0)) return hint(t('A méretarány nem változott.', 'The scale did not change.'));
    // Scale the image about the first point so that point stays put.
    const k = real / measured;
    const [ax, ay] = pts[0];
    useProject.getState().setBackground({ ...bg, widthCm: bg.widthCm * k, x: ax - (ax - bg.x) * k, y: ay - (ay - bg.y) * k });
    const kk = k.toLocaleString(locale(), { maximumFractionDigits: 2 });
    hint(t(`Méretarány beállítva (×${kk}).`, `Scale set (×${kk}).`));
  };

  /** Add a fixture from the Elemek tool and select it, so it can be moved or edited at once. */
  const addFixtureAt = (f: Omit<Fixture, 'id'>) => {
    const id = useProject.getState().addFixture(f);
    if (id) {
      useUi.getState().selectFixture(id);
      hint(t(`${FIXTURE_LABEL[f.type]} hozzáadva. Húzással mozgathatod, a sarkánál méretezheted; pontos adatok az Adatok gombbal.`, `${FIXTURE_LABEL[f.type]} added. Drag to move it, resize it at its corner; exact values under Details.`));
    }
  };

  const onTap = (p: P2, g: Extract<Gesture, { mode: 'pan' }>) => {
    if (useUi.getState().calibrate) return calibrateTap(toWorld(p));
    const se = useUi.getState().shapeEdit;
    if (se && se.areaId === area.id) {
      if (se.mode !== 'draw') return useUi.getState().setShapeEdit({ ...se, selected: null });
      const w = snapPt(toWorld(p));
      const first = se.points[0];
      // Tapping the first corner again closes the outline.
      if (first && se.points.length >= 3 && dist(first, w) * viewRef.current!.s < 16) return useUi.getState().setShapeEdit({ ...se, mode: 'edit', selected: null });
      return useUi.getState().setShapeEdit({ ...se, points: [...se.points, w] });
    }
    if (tool === 'fixtures') {
      const ft = useUi.getState().fixtureTool;
      if (!ft) return useUi.getState().selectFixture(null);
      const w = snapPt(toWorld(p));
      return addFixtureAt(newFixture(ft, Math.round(w[0]), Math.round(w[1])));
    }
    if (tool === 'plant' || tool === 'drift' || tool === 'row') {
      if (!activePlant) hint(t('Előbb válassz növényt a palettán.', 'Pick a plant in the palette first.'));
      else if (tool === 'plant') place(activePlant, toWorld(p));
      return;
    }
    const now = performance.now();
    const lt = lastTap.current;
    if (lt && now - lt.t < DOUBLE_TAP_MS && Math.hypot(p.x - lt.x, p.y - lt.y) < 30) {
      lastTap.current = null;
      fit();
      return;
    }
    lastTap.current = { t: now, x: p.x, y: p.y };
    if (g.onEmpty && !g.additive) {
      useUi.getState().select([]);
      useUi.getState().selectFixture(null);
    }
  };

  const onWheel = (e: WheelEvent) => {
    if (!view) return;
    const p = local(e);
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
      setView(zoomAt(view, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y));
    } else {
      setView({ ...view, tx: view.tx - e.deltaX, ty: view.ty - e.deltaY });
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!view) return;
    const cx = size.w / 2;
    const cy = size.h / 2;
    const k = e.key;
    const mod = e.ctrlKey || e.metaKey;
    const sel = useUi.getState().selected;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (k === '+' || k === '=') setView(zoomAt(view, 1.25, cx, cy));
    else if (k === '-' || k === '_') setView(zoomAt(view, 0.8, cx, cy));
    else if (k === '0') fit();
    else if (arrows[k] && sel.length) {
      // Nudge the selection: 1 cm, or 10 cm with Shift.
      const step = e.shiftKey ? 10 : 1;
      useProject.getState().moveItems(sel, arrows[k][0] * step, arrows[k][1] * step);
    } else if (arrows[k]) setView({ ...view, tx: view.tx - arrows[k][0] * 40, ty: view.ty - arrows[k][1] * 40 });
    else if ((k === 'Delete' || k === 'Backspace') && sel.length) useProject.getState().deleteItems(sel);
    else if ((k === 'Delete' || k === 'Backspace') && selectedFixture) useProject.getState().deleteFixture(selectedFixture);
    else if (k === 'Escape') {
      useUi.getState().select([]);
      useUi.getState().selectFixture(null);
    }
    else if (mod && k.toLowerCase() === 'a') useUi.getState().select(items.map((i) => i.id));
    else if (mod && k.toLowerCase() === 'd' && sel.length) useUi.getState().select(useProject.getState().duplicateItems(sel, 20, 20));
    else return;
    e.preventDefault();
  };

  const viewItems = resize ? items.map((i) => (i.id === resize.id && i.kind === 'plant' ? { ...i, spreadCm: resize.spreadCm } : i)) : items;

  const Handles = () => {
    const e = editable();
    if (!e && !drag) {
      // A single plant: a handle on its right edge sets its own spread.
      const sel = useUi.getState().selected;
      const it = sel.length === 1 ? viewItems.find((i) => i.id === sel[0]) : undefined;
      const pl = it && plants.get(it.plantId);
      if (it?.kind !== 'plant' || !pl) return null;
      const r = plantRadius(effectivePlant(pl, it), settings.showMatureSize);
      const k = 9 / view!.s;
      return (
        <g className="handles">
          <line className="resize-line" x1={it.x} y1={it.y} x2={it.x + r} y2={it.y} vectorEffect="non-scaling-stroke" />
          <circle className="handle resize-handle" data-resize={it.id} cx={it.x + r} cy={it.y} r={k} vectorEffect="non-scaling-stroke" />
          {resize && <CountLabel x={it.x} y={it.y - r - 10 / view!.s} fs={11 / view!.s} text={`⌀ ${resize.spreadCm} cm`} />}
        </g>
      );
    }
    if (!e || drag) return null;
    const pts = shape?.id === e.id ? shape.points : e.points;
    return <VertexHandles points={pts} s={view!.s} />;
  };

  const zoomBtn = (f: number) => view && setView(zoomAt(view, f, size.w / 2, size.h / 2));

  return (
    <div className="canvas-box" ref={boxRef}>
      {view && size.w > 0 && (
        <svg
          className={`plan-svg tool-${tool}${lasso && tool === 'select' ? ' is-lasso' : ''}${shapeEdit ? ' is-shape-edit' : ''}`}
          width={size.w}
          height={size.h}
          role="application"
          aria-label={t(
            `${area.name} felülnézet, ${area.widthCm} × ${area.lengthCm} cm. Nagyítás: plusz és mínusz, illesztés: 0, mozgatás: nyilak, törlés: Delete.`,
            `${area.name} plan view, ${area.widthCm} × ${area.lengthCm} cm. Zoom: plus and minus, fit: 0, move: arrows, delete: Delete.`,
          )}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover((h) => (h?.pinned ? h : null))}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          data-scale={view.s.toFixed(4)}
        >
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
            {layers.zones && <FixtureZonesLayer area={area} settings={settings} drag={fxDrag} />}
            <defs>
              <AreaClip area={area} id={`clip-${area.id}`} />
            </defs>
            <AreaShapeEl area={area} className={`area-bed kind-${area.kind ?? 'bed'}`} />
            {layers.background && area.background && (
              <image
                className="bg-image"
                href={area.background.dataUrl}
                x={area.background.x}
                y={area.background.y}
                width={area.background.widthCm}
                height={area.background.widthCm * area.background.aspect}
                opacity={area.background.opacity}
                preserveAspectRatio="none"
                pointerEvents="none"
              />
            )}
            {layers.grid && (
              <g clipPath={`url(#clip-${area.id})`}>
                <GridLayer w={area.widthCm} h={area.lengthCm} step={niceStep(view.s, 14)} />
              </g>
            )}
            {layers.fixtures && (
              <FixturesLayer area={area} scale={view.s} drag={fxDrag} selected={selectedFixture} interactive={tool === 'select' || tool === 'fixtures'} />
            )}
            {fxDraft && <rect className={`fx-draft fx-draft-${fxDraft.type}`} x={fxDraft.x} y={fxDraft.y} width={fxDraft.w} height={fxDraft.h} vectorEffect="non-scaling-stroke" />}
            <AreaShapeEl area={area} className={`area-outline${shapeEdit && !shapeEdit.target ? ' is-editing' : ''}`} />
            {layers.plants && (
              <PlantsLayer
                items={viewItems}
                plants={plants}
                selected={selectedSet}
                drag={drag}
                shape={shape}
                showMature={settings.showMatureSize}
                showSpacing={layers.spacing}
                month={month}
              />
            )}
            {layers.plants && <GroupLabels items={items} plants={plants} drag={drag} shape={shape} s={view.s} />}
            {tool === 'select' && <Handles />}
            {draft && activePlant && plants.get(activePlant) && (
              <Draft draft={draft} plant={plants.get(activePlant)!} pattern={driftPattern} s={view.s} mature={settings.showMatureSize} />
            )}
            {pendingStart && <circle className="pending-start" cx={pendingStart[0]} cy={pendingStart[1]} r={7 / view.s} vectorEffect="non-scaling-stroke" />}
            {layers.dimensions && !shapeEdit && <Dimensions area={area} s={view.s} />}
            {shapeEdit && <ShapeEditor points={shapeEdit.points} mode={shapeEdit.mode} selected={shapeEdit.selected} s={view.s} lawn={shapeEdit.target?.kind === 'lawn'} zone={shapeEdit.target?.kind === 'zone'} />}
            {layers.warnings && !month && !drag && !fxDrag && <WarningsLayer warnings={warnings} s={view.s} />}
            {(cameraEdit || visualOpen || layers.camera) && (camDraft ?? area.camera) && <CameraMark cam={(camDraft ?? area.camera)!} area={area} scale={view.s} editing={cameraEdit} />}
            {calibrate?.map(([x, y], i) => <circle key={i} className="pending-start" cx={x} cy={y} r={7 / view.s} vectorEffect="non-scaling-stroke" />)}
            {lassoPts && <polygon className="lasso" points={lassoPts.map((q) => q.join(',')).join(' ')} vectorEffect="non-scaling-stroke" />}
          </g>
          <Rulers view={view} w={size.w} h={size.h} />
        </svg>
      )}
      {hover &&
        !drag &&
        (() => {
          const it = items.find((i) => i.id === hover.id);
          const pl = it && plants.get(it.plantId);
          return it && pl ? <PlantTooltip plant={pl} item={it} x={hover.x} y={hover.y} boxW={size.w} boxH={size.h} /> : null;
        })()}
      {toast && (
        <p className="canvas-toast" role="status">
          {toast}
        </p>
      )}
      {cameraEdit && !toast && (
        <p className="canvas-toast" role="status">
          {t('Nézőpont: nyomd meg ott, ahol állsz (pl. a teraszon), és húzd a nézés irányába.', 'Viewpoint: press where you stand (e.g. on the terrace) and drag towards where you look.')}
        </p>
      )}
      {calibrate && !toast && (
        <p className="canvas-toast" role="status">
          {calibrate.length
            ? t('Méretarány: koppints a kép második pontjára (pl. egy ismert hosszúságú fal két végére).', 'Scale: tap the second point on the image (e.g. both ends of a wall of known length).')
            : t('Méretarány: koppints a kép első pontjára (pl. egy ismert hosszúságú fal két végére).', 'Scale: tap the first point on the image (e.g. both ends of a wall of known length).')}
        </p>
      )}
      {pendingStart && !toast && (
        <p className="canvas-toast" role="status">
          {t('Koppints a sor végpontjára.', 'Tap the end of the row.')}
        </p>
      )}
      <div className="zoom-ctl" aria-label={t('Nagyítás', 'Zoom')}>
        <button type="button" onClick={() => zoomBtn(1.25)} aria-label={t('Nagyítás', 'Zoom in')}>+</button>
        <button type="button" onClick={() => zoomBtn(0.8)} aria-label={t('Kicsinyítés', 'Zoom out')}>−</button>
        <button type="button" onClick={() => fit()} aria-label={t('Illesztés a képernyőhöz', 'Fit to screen')}>⤢</button>
      </div>
    </div>
  );
}

/** Width/length dimension labels, placed outside edge strips (wall, fence, paving); font size is constant on screen. */
function Dimensions({ area, s }: { area: Area; s: number }) {
  const fs = 11 / s;
  const off = 16 / s;
  const strips = area.fixtures.filter((f) => f.type === 'wall' || f.type === 'fence' || f.type === 'paving');
  const right = Math.max(area.widthCm, ...strips.map((f) => f.x + (f.w ?? 0)));
  const bottom = Math.max(area.lengthCm, ...strips.map((f) => f.y + (f.h ?? 0)));
  return (
    <g className="dims" fontSize={fs}>
      <text x={area.widthCm / 2} y={bottom + off + fs * 0.4} textAnchor="middle">
        {area.widthCm} cm
      </text>
      <text transform={`translate(${right + off} ${area.lengthCm / 2}) rotate(90)`} textAnchor="middle" dominantBaseline="middle">
        {area.lengthCm} cm
      </text>
    </g>
  );
}

/** Live preview while drawing a drift / row: outline, planting positions and count. */
function Draft({ draft, plant, pattern, s, mature }: {
  draft: { kind: 'drift' | 'curve' | 'line'; points: Pt[] };
  plant: Plant;
  pattern: 'grid' | 'staggered';
  s: number;
  mature: boolean;
}) {
  const pts = draft.points;
  const isDrift = draft.kind === 'drift';
  const positions = isDrift ? (pts.length >= 3 ? fillPolygon(pts, plant.spacingCm, pattern) : []) : fillPath(pts, plant.spacingCm);
  const r = plantRadius(plant, mature);
  const b = bbox(pts);
  const line = pts.map((q) => q.join(',')).join(' ');
  return (
    <g className="draft" pointerEvents="none">
      {isDrift ? (
        <polygon className="draft-shape" points={line} vectorEffect="non-scaling-stroke" />
      ) : (
        <polyline className="draft-shape" points={line} vectorEffect="non-scaling-stroke" />
      )}
      {positions.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={plant.color} fillOpacity={0.55} />
      ))}
      <CountLabel x={(b.minX + b.maxX) / 2} y={b.minY - 6 / s} fs={12 / s} text={`${plant.code} × ${positions.length}`} />
    </g>
  );
}

/** Outline being drawn/edited: corners, edge midpoints (tap to insert), edge lengths in cm. */
function ShapeEditor({ points, mode, selected, s, lawn, zone }: { points: Pt[]; mode: 'draw' | 'edit'; selected: number | null; s: number; lawn?: boolean; zone?: boolean }) {
  const closed = mode === 'edit' && points.length >= 3;
  const line = points.map((p) => p.join(',')).join(' ');
  const edges = points.map((a, i) => [a, points[(i + 1) % points.length]] as const).slice(0, closed ? points.length : Math.max(0, points.length - 1));
  const r = 10 / s;
  return (
    <g className={`shape-editor${lawn ? ' is-lawn' : ''}${zone ? ' is-zone' : ''}`}>
      {closed ? <polygon className="shape-line" points={line} vectorEffect="non-scaling-stroke" /> : <polyline className="shape-line" points={line} vectorEffect="non-scaling-stroke" />}
      {edges.map(([a, b], i) => {
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        return (
          <g key={`e${i}`}>
            <CountLabel x={mx} y={my - 8 / s} fs={10 / s} text={`${Math.round(dist(a, b))} cm`} />
            {mode === 'edit' && <circle className="shape-mid" data-shape-mid={i} cx={mx} cy={my} r={r * 0.7} vectorEffect="non-scaling-stroke" />}
          </g>
        );
      })}
      {points.map(([x, y], i) => (
        <circle key={i} className={`shape-vertex${i === selected ? ' is-selected' : ''}${i === 0 && mode === 'draw' ? ' is-first' : ''}`} data-shape-vertex={i} cx={x} cy={y} r={r} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
}
