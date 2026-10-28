import { useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Plant } from '../model/types';
import { useProject } from '../store/projectStore';
import { canvasBridge, useUi } from '../store/uiStore';
import { PlantChip } from './PlantChip';

const DRAG_START_PX = 12;

export const matchesQuery = (p: Plant, q: string) => {
  const s = q.trim().toLowerCase();
  return !s || p.code.toLowerCase().includes(s) || p.nameHu.toLowerCase().includes(s) || p.nameLat.toLowerCase().includes(s);
};

/**
 * Docked palette above the toolbar (plant tool). Tap a plant to arm it, then tap the plan;
 * or drag the plant upwards onto the plan.
 */
export function PlantPalette({ onOpenDb }: { onOpenDb: () => void }) {
  const plantDb = useProject((s) => s.project!.plantDb);
  const active = useUi((s) => s.activePlant);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(true);
  const list = useMemo(
    () => plantDb.filter((p) => matchesQuery(p, q)).sort((a, b) => a.nameHu.localeCompare(b.nameHu, 'hu')),
    [plantDb, q],
  );
  const activePlant = plantDb.find((p) => p.code === active);

  const drag = useRef<{ id: number; x: number; y: number; code: string; dragging: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; p: Plant } | null>(null);

  const down = (e: PointerEvent, p: Plant) => {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, code: p.code, dragging: false };
  };
  const move = (e: PointerEvent, p: Plant) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.dragging && -dy > DRAG_START_PX && Math.abs(dy) > Math.abs(dx)) {
      d.dragging = true;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    if (d.dragging) setGhost({ x: e.clientX, y: e.clientY, p });
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d || d.id !== e.pointerId) return;
    useUi.getState().setActivePlant(d.code);
    if (d.dragging) canvasBridge.dropAt?.(e.clientX, e.clientY, d.code);
  };
  const cancel = () => {
    drag.current = null;
    setGhost(null);
  };

  return (
    <section className={`palette${open ? '' : ' is-collapsed'}`} aria-label="Növénypaletta">
      <div className="palette-head">
        <button type="button" className="icon-btn palette-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Paletta becsukása' : 'Paletta kinyitása'}>
          {open ? '▾' : '▴'}
        </button>
        <p className="palette-hint" role="status">
          {activePlant ? (
            <>
              <b>{activePlant.nameHu}</b> · koppints a rajzra
            </>
          ) : (
            'Válassz növényt, majd koppints a rajzra, vagy húzd fel a rajzra.'
          )}
        </p>
        <button type="button" className="btn btn-small" onClick={onOpenDb}>
          Adatbázis
        </button>
      </div>
      {open && (
        <>
          <input className="palette-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keresés: név, latin név, kód" aria-label="Növény keresése" />
          <div className="palette-strip" role="listbox" aria-label="Növények">
            {list.length === 0 && <p className="empty">Nincs találat. Próbálj rövidebb keresőszót.</p>}
            {list.map((p) => (
              <button
                key={p.code}
                type="button"
                role="option"
                aria-selected={p.code === active}
                className="palette-item"
                onPointerDown={(e) => down(e, p)}
                onPointerMove={(e) => move(e, p)}
                onPointerUp={up}
                onPointerCancel={cancel}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    useUi.getState().setActivePlant(p.code);
                  }
                }}
              >
                <PlantChip p={p} size={34} />
                <span className="palette-name">{p.nameHu}</span>
                <span className="palette-meta mono">
                  {p.maxHeightCm} cm · {p.spacingCm} cm
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {ghost && (
        <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          <PlantChip p={ghost.p} size={40} />
        </div>
      )}
    </section>
  );
}
