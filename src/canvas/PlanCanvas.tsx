import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { pointInPolygon, snap } from '../model/geometry';
import { plantMap } from '../model/plants';
import type { Area, Plant, Pt, Settings } from '../model/types';
import { selectItems, useProject } from '../store/projectStore';
import { canvasBridge, useUi } from '../store/uiStore';
import { FixturesLayer, FixtureZonesLayer } from './layers/Fixtures';
import { GridLayer } from './layers/Grid';
import { PlantsLayer, type DragOffset } from './layers/Plants';
import { Rulers, RULER } from './layers/Rulers';
import { fitView, niceStep, pinchView, screenToWorld, zoomAt, type View } from './viewport';

interface Props {
  area: Area;
  settings: Settings;
  plantDb: Plant[];
}

type P2 = { x: number; y: number };

type Gesture =
  | { mode: 'pan'; view: View; start: P2; moved: boolean; onEmpty: boolean; additive: boolean }
  | { mode: 'move'; start: P2; ids: string[]; anchor: Pt; moved: boolean; tappedId: string; additive: boolean; wasSelected: boolean }
  | { mode: 'lasso'; points: Pt[] }
  | { mode: 'pinch'; view: View; start: Map<number, P2> };

const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 8;
export const SNAP_CM = 10;

export function PlanCanvas({ area, settings, plantDb }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const items = useProject(selectItems);
  const tool = useUi((s) => s.tool);
  const activePlant = useUi((s) => s.activePlant);
  const selected = useUi((s) => s.selected);
  const lasso = useUi((s) => s.lasso);
  const layers = useUi((s) => s.layers);
  const plants = useMemo(() => plantMap(plantDb), [plantDb]);

  const pointers = useRef(new Map<number, P2>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<DragOffset | null>(null);
  const [lassoPts, setLassoPts] = useState<Pt[] | null>(null);

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

  const itemPos = (id: string): Pt => {
    const it = items.find((i) => i.id === id);
    return it?.kind === 'plant' ? [it.x, it.y] : [0, 0];
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
      gesture.current = { mode: 'pinch', view, start: new Map(pointers.current) };
      return;
    }

    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const hitId = (e.target as Element).closest?.('[data-id]')?.getAttribute('data-id') ?? null;
    if (tool === 'select' && hitId) {
      const ui = useUi.getState();
      const wasSelected = ui.selected.includes(hitId);
      let ids = ui.selected;
      if (!wasSelected) {
        ids = additive ? [...ids, hitId] : [hitId];
        ui.select(ids);
      }
      gesture.current = { mode: 'move', start: p, ids, anchor: itemPos(hitId), moved: false, tappedId: hitId, additive, wasSelected };
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
    }
  };

  /** World delta for a move; with snapping on, the grabbed plant lands on the grid. */
  const moveDelta = (g: Extract<Gesture, { mode: 'move' }>, dxs: number, dys: number) => {
    const s = viewRef.current!.s;
    const [ax, ay] = g.anchor;
    const [nx, ny] = snapPt([ax + dxs / s, ay + dys / s]);
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
    if (g.mode === 'lasso') {
      setLassoPts(null);
      if (g.points.length > 2) {
        const hit = items.filter((i) => i.kind === 'plant' && pointInPolygon([i.x, i.y], g.points)).map((i) => i.id);
        const cur = useUi.getState().selected;
        useUi.getState().select(e.shiftKey ? [...new Set([...cur, ...hit])] : hit);
      }
      return;
    }
    if (g.mode === 'pan' && !g.moved) onTap(p, g);
  };

  const onTap = (p: P2, g: Extract<Gesture, { mode: 'pan' }>) => {
    if (tool === 'plant') {
      if (activePlant) place(activePlant, toWorld(p));
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
    if (g.onEmpty && !g.additive) useUi.getState().select([]);
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
    else if (k === 'Escape') useUi.getState().select([]);
    else if (mod && k.toLowerCase() === 'a') useUi.getState().select(items.map((i) => i.id));
    else if (mod && k.toLowerCase() === 'd' && sel.length) useUi.getState().select(useProject.getState().duplicateItems(sel, 20, 20));
    else return;
    e.preventDefault();
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
            {layers.zones && <FixtureZonesLayer area={area} settings={settings} />}
            <rect className="area-bed" x={0} y={0} width={area.widthCm} height={area.lengthCm} />
            {layers.grid && <GridLayer w={area.widthCm} h={area.lengthCm} step={niceStep(view.s, 14)} />}
            {layers.fixtures && <FixturesLayer area={area} scale={view.s} />}
            <rect className="area-outline" x={0} y={0} width={area.widthCm} height={area.lengthCm} />
            {layers.plants && (
              <PlantsLayer
                items={items}
                plants={plants}
                selected={selectedSet}
                drag={drag}
                showMature={settings.showMatureSize}
                showSpacing={layers.spacing}
              />
            )}
            {layers.dimensions && <Dimensions area={area} s={view.s} />}
            {lassoPts && <polygon className="lasso" points={lassoPts.map((q) => q.join(',')).join(' ')} vectorEffect="non-scaling-stroke" />}
          </g>
          <Rulers view={view} w={size.w} h={size.h} />
        </svg>
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
