import { useMemo, useState } from 'react';
import { JUGLONE_LABEL, SUN_LABEL, TOXIC_LABEL, WATER_LABEL } from '../model/plants';
import type { ItemStatus, PlacedItem, Plant } from '../model/types';
import { selectItems, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { PlantChip } from './PlantChip';

export const STATUS_LABEL: Record<ItemStatus, string> = { needed: 'kell', ordered: 'megrendelve', owned: 'megvan', planted: 'beültetve' };

/** Floating action bar for the current selection. */
export function SelectionBar({ onProps }: { onProps: () => void }) {
  const selected = useUi((s) => s.selected);
  if (!selected.length) return null;
  const dup = () => useUi.getState().select(useProject.getState().duplicateItems(selected, 20, 20));
  return (
    <div className="selbar" role="toolbar" aria-label="Kijelölés">
      <span className="selbar-count mono" aria-label={`${selected.length} kijelölve`}>
        {selected.length} db
      </span>
      <button type="button" className="btn btn-small" onClick={onProps} aria-label="Tulajdonságok">
        Adatok
      </button>
      <button type="button" className="btn btn-small" onClick={dup}>
        Másolás
      </button>
      <button type="button" className="btn btn-small btn-danger" onClick={() => useProject.getState().deleteItems(selected)}>
        Törlés
      </button>
      <button type="button" className="icon-btn" onClick={() => useUi.getState().select([])} aria-label="Kijelölés megszüntetése">
        ×
      </button>
    </div>
  );
}

/** Properties of the selected item(s): species, status, note, position. */
export function ItemProps({ plantDb, onDone }: { plantDb: Plant[]; onDone: () => void }) {
  const selected = useUi((s) => s.selected);
  const all = useProject(selectItems);
  const items = useMemo(() => all.filter((i) => selected.includes(i.id)), [all, selected]);
  const byCode = useMemo(() => new Map(plantDb.map((p) => [p.code, p])), [plantDb]);
  const sorted = useMemo(() => [...plantDb].sort((a, b) => a.nameHu.localeCompare(b.nameHu, 'hu')), [plantDb]);
  if (!items.length) return <p className="empty">Nincs kijelölt elem.</p>;

  const ids = items.map((i) => i.id);
  const first = items[0];
  const single = items.length === 1 ? first : null;
  const species = new Set(items.map((i) => i.plantId));
  const statuses = new Set(items.map((i) => i.status));
  const plant = species.size === 1 ? byCode.get(first.plantId) : undefined;
  const upd = useProject.getState().updateItems;

  return (
    <div className="form">
      {plant && <PlantSummary p={plant} count={items.length} />}
      <label className="field">
        <span>Faj{items.length > 1 ? ` (mind a ${items.length} elemé)` : ''}</span>
        <select value={species.size === 1 ? first.plantId : ''} onChange={(e) => e.target.value && upd(ids, { plantId: e.target.value })}>
          {species.size > 1 && <option value="">– vegyes –</option>}
          {sorted.map((p) => (
            <option key={p.code} value={p.code}>
              {p.code} · {p.nameHu}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="field-group">
        <legend>Státusz</legend>
        <div className="seg">
          {(Object.keys(STATUS_LABEL) as ItemStatus[]).map((s) => (
            <label key={s} className="seg-item">
              <input type="radio" name="status" checked={statuses.size === 1 && statuses.has(s)} onChange={() => upd(ids, { status: s })} />
              <span>{STATUS_LABEL[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {single && <SingleFields key={single.id} item={single} />}
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={onDone}>
          Kész
        </button>
      </div>
    </div>
  );
}

function SingleFields({ item }: { item: PlacedItem }) {
  // Local drafts so typing isn't one undo step per keystroke; committed on blur.
  const [note, setNote] = useState(item.note ?? '');
  const upd = useProject.getState().updateItems;
  return (
    <>
      {item.kind === 'plant' && (
        <div className="field-row">
          <CoordField label="x (cm)" v={item.x} on={(x) => upd([item.id], { x })} />
          <CoordField label="y (cm)" v={item.y} on={(y) => upd([item.id], { y })} />
        </div>
      )}
      <label className="field">
        <span>Jegyzet</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (item.note ?? '') && upd([item.id], { note })} />
      </label>
    </>
  );
}

function CoordField({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  const [s, setS] = useState(String(v));
  const commit = () => {
    const n = parseFloat(s.replace(',', '.'));
    if (Number.isFinite(n) && n !== v) on(n);
    else setS(String(v));
  };
  return (
    <label className="field">
      <span>{label}</span>
      <input inputMode="decimal" value={s} onChange={(e) => setS(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
    </label>
  );
}

function PlantSummary({ p, count }: { p: Plant; count: number }) {
  return (
    <div className="psum">
      <PlantChip p={p} size={44} />
      <div>
        <b>{p.nameHu}</b>
        {count > 1 && <span className="mono muted"> · {count} tő</span>}
        <i className="psum-lat">{p.nameLat}</i>
        <span className="mono muted">
          max. {p.maxHeightCm} cm · szél. {p.spreadCm} cm · tőtáv {p.spacingCm} cm · {p.sun.map((s) => SUN_LABEL[s]).join('/')} · víz:{' '}
          {WATER_LABEL[p.water]} · juglone: {JUGLONE_LABEL[p.juglone]} · mérgező: {TOXIC_LABEL[p.toxic]}
          {p.thorny ? ' · tüskés' : ''}
        </span>
        {!!p.verify?.length && <span className="mono warn-text">Ellenőrizendő adat: {p.verify.length}</span>}
      </div>
    </div>
  );
}
