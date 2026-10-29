import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { fillPath, fillPolygon } from '../engine/fill';
import { bbox, centroid, dist, pointInPolygon, polygonArea, simplify, snap } from '../model/geometry';
import { plantMap } from '../model/plants';
import type { Area, Plant, Pt, Settings } from '../model/types';
import { selectItems, useProject } from '../store/projectStore';
import { canvasBridge, useUi } from '../store/uiStore';
import type { Warning } from '../engine/rules';
import { FixturesLayer, FixtureZonesLayer, type FixtureDrag } from './layers/Fixtures';
import { GridLayer } from './layers/Grid';
import { CountLabel, GroupLabels, PlantsLayer, plantRadius, VertexHandles, type DragOffset, type ShapeOverride } from './layers/Plants';
import { Rulers, RULER } from './layers/Rulers';
import { WarningsLayer } from './layers/Warnings';
import { fitView, niceStep, pinchView, screenToWorld, zoomAt, type View } from './viewport';

interface Props {
  area: Area;
  settings: Settings;
  plantDb: Plant[];
  warnings: Warning[];
}

type P2 = { x: number; y: number };

type Gesture =
  | { mode: 'pan'; view: View; start: P2; moved: boolean; onEmpty: boolean; additive: boolean }
  | { mode: 'move'; start: P2; ids: string[]; anchor: Pt; moved: boolean; tappedId: string; additive: boolean; wasSelected: boolean }
  | { mode: 'lasso'; points: Pt[] }
  | { mode: 'draw'; kind: 'drift' | 'curve' | 'line'; points: Pt[]; startPx: P2; moved: boolean }
  | { mode: 'fixture'; id: string; start: P2; anchor: Pt; moved: boolean }
  | { mode: 'vertex'; id: string; index: number; points: Pt[]; start: P2; moved: boolean }
  | { mode: 'pinch'; view: View; start: Map<number, P2> };

const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 8;
export const SNAP_CM = 10;

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
  const lasso = useUi((s) => s.lasso);
  const layers = useUi((s) => s.layers);
  const plants = useMemo(() => plantMap(plantDb), [plantDb]);

  const pointers = useRef(new Map<number, P2>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<DragOffset | null>(null);
  const [lassoPts, setLassoPts] = useState<Pt[] | null>(null);
  const [draft, setDraft] = useState<{ kind: 'drift' | 'curve' | 'line'; points: Pt[] } | null>(null);
  const [shape, setShape] = useState<ShapeOverride | null>(null);
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
      // Leave room for the rulers on the top/left.
      const v = fitView(area.widthCm, area.lengthCm, w - RULER, h - RULER, 24);
      setView({ ...v, tx: v.tx + RULER, ty: v.ty + RULER });
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
    const fxId = hitId ? null : (target.closest?.('[data-fixture]')?.getAttribute('data-fixture') ?? null);
    const editing = editable();
    if (tool === 'select' && handle != null && editing) {
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
    } else if (tool === 'select' && fxId) {
      const f = area.fixtures.find((x) => x.id === fxId);
      useUi.getState().selectFixture(fxId);
      gesture.current = { mode: 'fixture', id: fxId, start: p, anchor: f ? [f.x, f.y] : [0, 0], moved: false };
    } else if (tool === 'select' && lasso) {
      gesture.current = { mode: 'lasso', points: [toWorld(p)] };
      setLassoPts([toWorld(p)]);
    } else {
      gesture.current = { mode: 'pan', view, start: p, moved: false, onEmpty: !hitId, additive };
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    const p = local(e);
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
    } else if (g.mode === 'fixture') {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < TAP_SLOP_PX) return;
      g.moved = true;
      setFxDrag({ id: g.id, ...fixtureDelta(g, p) });
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

  const onPointerUp = (e: PointerEvent) => {
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
      if (g.kind === 'drift') hint('Húzd körbe ujjal a folt területét.');
      else hint('Húzz egy vonalat ujjal az ív mentén.');
      return;
    }
    const pts = simplify(g.points, tol);
    if (g.kind === 'drift') {
      if (pts.length < 3 || polygonArea(pts) < 100) return hint('Ez a folt túl kicsi. Rajzolj nagyobbat.');
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

  const onTap = (p: P2, g: Extract<Gesture, { mode: 'pan' }>) => {
    if (tool === 'plant' || tool === 'drift' || tool === 'row') {
      if (!activePlant) hint('Előbb válassz növényt a palettán.');
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

  const Handles = () => {
    const e = editable();
    if (!e || drag) return null;
    const pts = shape?.id === e.id ? shape.points : e.points;
    return <VertexHandles points={pts} s={view!.s} />;
  };

  const zoomBtn = (f: number) => view && setView(zoomAt(view, f, size.w / 2, size.h / 2));

  return (
    <div className="canvas-box" ref={boxRef}>
      {view && size.w > 0 && (
        <svg
          className={`plan-svg tool-${tool}${lasso && tool === 'select' ? ' is-lasso' : ''}`}
          width={size.w}
          height={size.h}
          role="application"
          aria-label={`${area.name} felülnézet, ${area.widthCm} × ${area.lengthCm} cm. Nagyítás: plusz és mínusz, illesztés: 0, mozgatás: nyilak, törlés: Delete.`}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          data-scale={view.s.toFixed(4)}
        >
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
            {layers.zones && <FixtureZonesLayer area={area} settings={settings} drag={fxDrag} />}
            <rect className="area-bed" x={0} y={0} width={area.widthCm} height={area.lengthCm} />
            {layers.grid && <GridLayer w={area.widthCm} h={area.lengthCm} step={niceStep(view.s, 14)} />}
            {layers.fixtures && (
              <FixturesLayer area={area} scale={view.s} drag={fxDrag} selected={selectedFixture} interactive={tool === 'select'} />
            )}
            <rect className="area-outline" x={0} y={0} width={area.widthCm} height={area.lengthCm} />
            {layers.plants && (
              <PlantsLayer
                items={items}
                plants={plants}
                selected={selectedSet}
                drag={drag}
                shape={shape}
                showMature={settings.showMatureSize}
                showSpacing={layers.spacing}
              />
            )}
            {layers.plants && <GroupLabels items={items} plants={plants} drag={drag} shape={shape} s={view.s} />}
            {tool === 'select' && <Handles />}
            {draft && activePlant && plants.get(activePlant) && (
              <Draft draft={draft} plant={plants.get(activePlant)!} pattern={driftPattern} s={view.s} mature={settings.showMatureSize} />
            )}
            {pendingStart && <circle className="pending-start" cx={pendingStart[0]} cy={pendingStart[1]} r={7 / view.s} vectorEffect="non-scaling-stroke" />}
            {layers.dimensions && <Dimensions area={area} s={view.s} />}
            {layers.warnings && !drag && !fxDrag && <WarningsLayer warnings={warnings} s={view.s} />}
            {lassoPts && <polygon className="lasso" points={lassoPts.map((q) => q.join(',')).join(' ')} vectorEffect="non-scaling-stroke" />}
          </g>
          <Rulers view={view} w={size.w} h={size.h} />
        </svg>
      )}
      {toast && (
        <p className="canvas-toast" role="status">
          {toast}
        </p>
      )}
      {pendingStart && !toast && (
        <p className="canvas-toast" role="status">
          Koppints a sor végpontjára.
        </p>
      )}
      <div className="zoom-ctl" aria-label="Nagyítás">
        <button type="button" onClick={() => zoomBtn(1.25)} aria-label="Nagyítás">+</button>
        <button type="button" onClick={() => zoomBtn(0.8)} aria-label="Kicsinyítés">−</button>
        <button type="button" onClick={() => fit()} aria-label="Illesztés a képernyőhöz">⤢</button>
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
