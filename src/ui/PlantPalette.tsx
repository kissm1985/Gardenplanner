import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { activeFilterCount, filterPlants, NO_FILTER } from '../model/plantFilter';
import type { Plant } from '../model/types';
import { useProject } from '../store/projectStore';
import { canvasBridge, useUi } from '../store/uiStore';
import { PlantChip } from './PlantChip';
import { PlantCard } from './PlantTooltip';
import { byPlantName, plantName } from '../model/plants';
import { labels, t } from '../i18n';

const DRAG_START_PX = 12;

const TOOL_HINT: Record<string, string> = labels({
  plant: ['koppints a rajzra', 'tap the plan'],
  drift: ['húzd körbe ujjal a foltot', 'draw around the drift with your finger'],
  row: ['húzz egyenest, vagy koppints a két végére', 'drag a line, or tap both ends'],
  curve: ['húzd végig ujjal az ív mentén', 'trace the curve with your finger'],
});

/**
 * Docked palette above the toolbar (plant tool). Tap a plant to arm it, then tap the plan;
 * or drag the plant upwards onto the plan.
 */
export function PlantPalette({ onOpenDb, onOpenFilters }: { onOpenDb: () => void; onOpenFilters: () => void }) {
  const plantDb = useProject((s) => s.project!.plantDb);
  const active = useUi((s) => s.activePlant);
  const tool = useUi((s) => s.tool);
  const rowMode = useUi((s) => s.rowMode);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(true);
  // The palette has its own search box but shares the database filters.
  const filter = useUi((s) => s.plantFilter);
  const nFilters = activeFilterCount(filter);
  const list = useMemo(
    () => filterPlants(plantDb, { ...filter, q }).sort(byPlantName),
    [plantDb, filter, q],
  );
  const activePlant = plantDb.find((p) => p.code === active);

  const drag = useRef<{ id: number; x: number; y: number; code: string; dragging: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; p: Plant } | null>(null);

  // Info card: after a short hover with the mouse, or a long press with a finger.
  const [tip, setTip] = useState<{ p: Plant; r: DOMRect } | null>(null);
  const tipTimer = useRef<number | undefined>(undefined);
  const showTipLater = (e: PointerEvent, p: Plant, ms: number) => {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    clearTimeout(tipTimer.current);
    tipTimer.current = window.setTimeout(() => setTip({ p, r }), ms);
  };
  const hideTip = () => {
    clearTimeout(tipTimer.current);
    setTip(null);
  };

  const down = (e: PointerEvent, p: Plant) => {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, code: p.code, dragging: false };
    if (e.pointerType !== 'mouse') showTipLater(e, p, 500);
  };
  const move = (e: PointerEvent, p: Plant) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (e.pointerType !== 'mouse' && Math.hypot(dx, dy) > DRAG_START_PX) hideTip();
    if (!d.dragging && -dy > DRAG_START_PX && Math.abs(dy) > Math.abs(dx)) {
      d.dragging = true;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    if (d.dragging) setGhost({ x: e.clientX, y: e.clientY, p });
  };
  const up = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') hideTip();
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d || d.id !== e.pointerId) return;
    useUi.getState().setActivePlant(d.code);
    if (d.dragging) canvasBridge.dropAt?.(e.clientX, e.clientY, d.code);
  };
  const cancel = () => {
    hideTip();
    drag.current = null;
    setGhost(null);
  };

  return (
    <section className={`palette${open ? '' : ' is-collapsed'}`} aria-label={t('Növénypaletta', 'Plant palette')}>
      <div className="palette-head">
        <button type="button" className="icon-btn palette-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? t('Paletta becsukása', 'Collapse palette') : t('Paletta kinyitása', 'Expand palette')}>
          {open ? '▾' : '▴'}
        </button>
        <p className="palette-hint" role="status">
          {activePlant ? (
            <>
              <b>{plantName(activePlant)}</b> · {TOOL_HINT[tool === 'row' ? (rowMode === 'curve' ? 'curve' : 'row') : tool] ?? ''}
            </>
          ) : tool === 'plant' ? (
            t('Válassz növényt, majd koppints a rajzra, vagy húzd fel a rajzra.', 'Pick a plant, then tap the plan or drag it up onto the plan.')
          ) : (
            t('Válassz növényt, aztán rajzolj a tervre.', 'Pick a plant, then draw on the plan.')
          )}
        </p>
        <button type="button" className="btn btn-small" onClick={onOpenDb}>
          {t('Adatbázis', 'Database')}
        </button>
      </div>
      {open && (
        <>
          <div className="palette-searchrow">
            <input className="palette-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Keresés: név, latin név, kód', 'Search: name, Latin name, code')} aria-label={t('Növény keresése', 'Search plants')} />
            <button type="button" className={`btn btn-small${nFilters ? ' btn-primary' : ''}`} onClick={onOpenFilters}>
              {t('Szűrők', 'Filters')}
              {nFilters ? ` (${nFilters})` : ''}
            </button>
            {nFilters > 0 && (
              <button type="button" className="icon-btn" aria-label={t('Szűrők törlése', 'Clear filters')} onClick={() => useUi.getState().setPlantFilter({ ...NO_FILTER, q: filter.q })}>
                ×
              </button>
            )}
          </div>
          <div className="palette-strip" role="listbox" aria-label={t('Növények', 'Plants')}>
            {list.length === 0 && <p className="empty">{nFilters ? t('A szűrőknek egy növény sem felel meg.', 'No plant matches the filters.') : t('Nincs találat. Próbálj rövidebb keresőszót.', 'No match. Try a shorter search.')}</p>}
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
                onPointerEnter={(e) => e.pointerType === 'mouse' && showTipLater(e, p, 300)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && hideTip()}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    useUi.getState().setActivePlant(p.code);
                  }
                }}
              >
                <PlantChip p={p} size={34} />
                <span className="palette-name">{plantName(p)}</span>
                <span className="palette-meta mono">
                  {p.maxHeightCm} cm · {p.spacingCm} cm
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {tip && (
        <div
          className="plant-tip is-fixed"
          role="tooltip"
          style={{
            width: 260,
            left: Math.max(8, Math.min(window.innerWidth - 268, tip.r.left + tip.r.width / 2 - 130)),
            bottom: window.innerHeight - tip.r.top + 8,
          }}
        >
          <PlantCard plant={tip.p} />
        </div>
      )}
      {ghost && (
        <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          <PlantChip p={ghost.p} size={40} />
        </div>
      )}
    </section>
  );
}
