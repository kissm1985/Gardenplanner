import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Area } from '../model/types';
import { RULER } from './layers/Rulers';
import { fitView, type View } from './viewport';

/** Height of the floating tool row over the top of the plan; fitting keeps the area below it. */
export const OVERLAY_TOP = 52;

/** The plan's viewport: element size, pan/zoom state, and fitting the area into view when it changes. */
export function useViewport(area: Area) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

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

  return { boxRef, size, view, setView, viewRef, fit };
}
