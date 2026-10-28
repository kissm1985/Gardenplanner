import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import type { Area, Settings } from '../model/types';
import { FixturesLayer, FixtureZonesLayer } from './layers/Fixtures';
import { GridLayer } from './layers/Grid';
import { Rulers, RULER } from './layers/Rulers';
import { fitView, niceStep, pinchView, zoomAt, type View } from './viewport';

export interface Layers {
  grid: boolean;
  fixtures: boolean;
  zones: boolean;
  dimensions: boolean;
}

interface Props {
  area: Area;
  settings: Settings;
  layers: Layers;
}

type Pointer = { x: number; y: number };

const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 10;

export function PlanCanvas({ area, settings, layers }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);

  const pointers = useRef(new Map<number, Pointer>());
  const gesture = useRef<{ view: View; start: Map<number, Pointer>; moved: boolean } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

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

  const local = (e: { clientX: number; clientY: number }): Pointer => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!view) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    gesture.current = { view, start: new Map(pointers.current), moved: false };
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    const ids = [...pointers.current.keys()];
    if (ids.length === 1) {
      const p0 = g.start.get(ids[0]);
      const p1 = pointers.current.get(ids[0])!;
      if (!p0) return;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      if (!g.moved && Math.hypot(dx, dy) < TAP_SLOP_PX) return;
      g.moved = true;
      setView({ ...g.view, tx: g.view.tx + dx, ty: g.view.ty + dy });
    } else if (ids.length >= 2) {
      const [a, b] = ids;
      const a0 = g.start.get(a);
      const b0 = g.start.get(b);
      if (!a0 || !b0) return;
      const a1 = pointers.current.get(a)!;
      const b1 = pointers.current.get(b)!;
      g.moved = true;
      setView(pinchView(g.view, [a0.x, a0.y], [b0.x, b0.y], [a1.x, a1.y], [b1.x, b1.y]));
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    const g = gesture.current;
    const p = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (g && p && !g.moved && pointers.current.size === 0) {
      const now = performance.now();
      const lt = lastTap.current;
      if (lt && now - lt.t < DOUBLE_TAP_MS && Math.hypot(p.x - lt.x, p.y - lt.y) < 30) {
        lastTap.current = null;
        fit();
      } else {
        lastTap.current = { t: now, x: p.x, y: p.y };
      }
    }
    // Restart the gesture with the remaining finger(s) so lifting one finger of a pinch doesn't jump.
    gesture.current = view && pointers.current.size ? { view, start: new Map(pointers.current), moved: true } : null;
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
    const step = 40;
    const k = e.key;
    if (k === '+' || k === '=') setView(zoomAt(view, 1.25, cx, cy));
    else if (k === '-' || k === '_') setView(zoomAt(view, 0.8, cx, cy));
    else if (k === '0') fit();
    else if (k === 'ArrowLeft') setView({ ...view, tx: view.tx + step });
    else if (k === 'ArrowRight') setView({ ...view, tx: view.tx - step });
    else if (k === 'ArrowUp') setView({ ...view, ty: view.ty + step });
    else if (k === 'ArrowDown') setView({ ...view, ty: view.ty - step });
    else return;
    e.preventDefault();
  };

  const zoomBtn = (f: number) => view && setView(zoomAt(view, f, size.w / 2, size.h / 2));

  return (
    <div className="canvas-box" ref={boxRef}>
      {view && size.w > 0 && (
        <svg
          className="plan-svg"
          width={size.w}
          height={size.h}
          role="application"
          aria-label={`${area.name} felülnézet, ${area.widthCm} × ${area.lengthCm} cm. Nagyítás: plusz és mínusz, illesztés: 0, mozgatás: nyilak.`}
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
            {layers.dimensions && <Dimensions area={area} s={view.s} />}
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
