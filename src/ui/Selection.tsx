import { useMemo, useState } from 'react';
import { fillPath, fillPolygon, spacingForCount } from '../engine/fill';
import { byPlantName, JUGLONE_LABEL, SUN_LABEL, TOXIC_LABEL, WATER_LABEL } from '../model/plants';
import type { ItemStatus, PlacedItem, Plant } from '../model/types';
import { selectItems, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { PlantChip } from './PlantChip';

export const STATUS_LABEL: Record<ItemStatus, string> = { needed: 'kell', ordered: 'megrendelve', owned: 'megvan', planted: 'beültetve' };

/** Floating action bar for the current selection. */
export function SelectionBar({ onProps, onReplace }: { onProps: () => void; onReplace: (code: string) => void }) {
  const selected = useUi((s) => s.selected);
  // Hooks before the early return (React needs the same hooks on every render).
  const groups = useProject((s) => selectItems(s).filter((i) => selected.includes(i.id) && i.kind !== 'plant').length);
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
      {groups > 0 && (
        <button
          type="button"
          className="btn btn-small"
          title="A folt vagy sor egyedi tövekre bontása (a helyükön maradnak)"
          onClick={() => useUi.getState().select(useProject.getState().explodeItems(selected))}
        >
          Bontás
        </button>
      )}
      <button
        type="button"
        className="btn btn-small"
        title="Az összes ilyen növény cseréje egy másikra"
        onClick={() => {
          const it = selectItems(useProject.getState()).find((i) => i.id === selected[0]);
          if (it) onReplace(it.plantId);
        }}
      >
        Csere
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
export function ItemProps({ plantDb, onDone, onReplace }: { plantDb: Plant[]; onDone: () => void; onReplace: (code: string) => void }) {
  const selected = useUi((s) => s.selected);
  const [note, setNote] = useState('');
  const all = useProject(selectItems);
  const items = useMemo(() => all.filter((i) => selected.includes(i.id)), [all, selected]);
  const byCode = useMemo(() => new Map(plantDb.map((p) => [p.code, p])), [plantDb]);
  const sorted = useMemo(() => [...plantDb].sort(byPlantName), [plantDb]);
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
      {plant && (
        <button type="button" className="btn btn-small" onClick={() => onReplace(plant.code)}>
          Az összes {plant.nameHu.toLowerCase()} cseréje a tervben…
        </button>
      )}
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
      {single && single.kind !== 'plant' && (
        <GroupFields key={`${single.id}:${single.spacingCm}:${single.count}`} item={single} onNote={setNote} />
      )}
      {note && (
        <p className="mono warn-text" role="status">
          {note}
        </p>
      )}
      {single && single.kind === 'plant' && plant && <SpreadField key={`${single.id}:${single.spreadCm ?? ''}`} item={single} plant={plant} />}
      {single && <SingleFields key={single.id} item={single} />}
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={onDone}>
          Kész
        </button>
      </div>
    </div>
  );
}

/** This plant's own spread (bigger or smaller than the species); also draggable on the plan. */
function SpreadField({ item, plant }: { item: Extract<PlacedItem, { kind: 'plant' }>; plant: Plant }) {
  const upd = useProject.getState().updateItems;
  const own = item.spreadCm != null && item.spreadCm !== plant.spreadCm;
  return (
    <div className="field-row spread-row">
      <NumField label="Kiterjedés (cm)" v={item.spreadCm ?? plant.spreadCm} on={(v) => v >= 5 && v <= 5000 && upd([item.id], { spreadCm: Math.round(v) === plant.spreadCm ? undefined : Math.round(v) })} />
      <div className="field">
        <span className="mono muted">{own ? `egyedi méret (a faj: ${plant.spreadCm} cm)` : 'a faj mérete'}</span>
        {own && (
          <button type="button" className="btn btn-small" onClick={() => upd([item.id], { spreadCm: undefined })}>
            Vissza az alapméretre
          </button>
        )}
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

type Group = Extract<PlacedItem, { kind: 'drift' | 'row' }>;

/** Count, spacing and pattern of a drift or row. Setting a count solves for the spacing. */
function GroupFields({ item, onNote }: { item: Group; onNote: (s: string) => void }) {
  const upd = useProject.getState().updateItems;
  const setCount = (n: number) => {
    const target = Math.round(n);
    const sp = spacingForCount(countFor, target);
    const got = countFor(sp);
    upd([item.id], { spacingCm: sp });
    onNote(got === target ? '' : `Ennél az alaknál ${target} db nem jön ki egyenletes tőtávval; a legközelebbi: ${got} db (${sp} cm).`);
  };
  const countFor = (sp: number) =>
    item.kind === 'drift' ? fillPolygon(item.polygon, sp, item.pattern).length : fillPath(item.path, sp).length;
  return (
    <>
      <div className="field-row">
        <NumField
          label="Darabszám"
          v={item.count}
          on={(n) => n >= 1 && setCount(n)}
        />
        <NumField label="Tőtáv (cm)" v={item.spacingCm} on={(sp) => sp >= 3 && (onNote(''), upd([item.id], { spacingCm: sp }))} />
      </div>
      {item.kind === 'drift' && (
        <fieldset className="field-group">
          <legend>Kiosztás</legend>
          <div className="seg">
            <label className="seg-item">
              <input type="radio" name="pattern" checked={item.pattern === 'staggered'} onChange={() => upd([item.id], { pattern: 'staggered' })} />
              <span>eltolt (háromszög)</span>
            </label>
            <label className="seg-item">
              <input type="radio" name="pattern" checked={item.pattern === 'grid'} onChange={() => upd([item.id], { pattern: 'grid' })} />
              <span>négyzetes</span>
            </label>
          </div>
        </fieldset>
      )}
      <p className="mono muted">
        {item.kind === 'drift' ? 'Folt' : 'Sor'}: a csúcspontokat Kijelölés módban húzva alakíthatod.
      </p>
    </>
  );
}

function NumField({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
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
