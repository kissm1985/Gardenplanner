import { useMemo, useState } from 'react';
import { fillPath, fillPolygon, spacingForCount } from '../engine/fill';
import { byPlantName, JUGLONE_LABEL, plantName, SUN_LABEL, TOXIC_LABEL, WATER_LABEL } from '../model/plants';
import type { ItemStatus, PlacedItem, Plant } from '../model/types';
import { selectItems, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { PlantChip } from './PlantChip';
import { labels, t } from '../i18n';

export const STATUS_LABEL: Record<ItemStatus, string> = labels({
  needed: ['kell', 'needed'],
  ordered: ['megrendelve', 'ordered'],
  owned: ['megvan', 'have it'],
  planted: ['beültetve', 'planted'],
});

/** Floating action bar for the current selection. */
export function SelectionBar({ onProps, onReplace }: { onProps: () => void; onReplace: (code: string) => void }) {
  const selected = useUi((s) => s.selected);
  // Hooks before the early return (React needs the same hooks on every render).
  const groups = useProject((s) => selectItems(s).filter((i) => selected.includes(i.id) && i.kind !== 'plant').length);
  if (!selected.length) return null;
  const dup = () => useUi.getState().select(useProject.getState().duplicateItems(selected, 20, 20));
  return (
    <div className="selbar" role="toolbar" aria-label={t('Kijelölés', 'Selection')}>
      <span className="selbar-count mono" aria-label={t(`${selected.length} kijelölve`, `${selected.length} selected`)}>
        {t(`${selected.length} db`, `${selected.length} sel.`)}
      </span>
      <button type="button" className="btn btn-small" onClick={onProps} aria-label={t('Tulajdonságok', 'Properties')}>
        {t('Adatok', 'Details')}
      </button>
      <button type="button" className="btn btn-small" onClick={dup}>
        {t('Másolás', 'Copy')}
      </button>
      {groups > 0 && (
        <button
          type="button"
          className="btn btn-small"
          title={t('A folt vagy sor egyedi tövekre bontása (a helyükön maradnak)', 'Split the drift or row into single plants (they stay in place)')}
          onClick={() => useUi.getState().select(useProject.getState().explodeItems(selected))}
        >
          {t('Bontás', 'Split')}
        </button>
      )}
      <button
        type="button"
        className="btn btn-small"
        title={t('Az összes ilyen növény cseréje egy másikra', 'Replace all of this plant with another')}
        onClick={() => {
          const it = selectItems(useProject.getState()).find((i) => i.id === selected[0]);
          if (it) onReplace(it.plantId);
        }}
      >
        {t('Csere', 'Replace')}
      </button>
      <button type="button" className="btn btn-small btn-danger" onClick={() => useProject.getState().deleteItems(selected)}>
        {t('Törlés', 'Delete')}
      </button>
      <button type="button" className="icon-btn" onClick={() => useUi.getState().select([])} aria-label={t('Kijelölés megszüntetése', 'Clear selection')}>
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
  if (!items.length) return <p className="empty">{t('Nincs kijelölt elem.', 'Nothing selected.')}</p>;

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
        <span>
          {t('Faj', 'Species')}
          {items.length > 1 ? t(` (mind a ${items.length} elemé)`, ` (all ${items.length} items)`) : ''}
        </span>
        <select value={species.size === 1 ? first.plantId : ''} onChange={(e) => e.target.value && upd(ids, { plantId: e.target.value })}>
          {species.size > 1 && <option value="">{t('– vegyes –', '– mixed –')}</option>}
          {sorted.map((p) => (
            <option key={p.code} value={p.code}>
              {p.code} · {plantName(p)}
            </option>
          ))}
        </select>
      </label>
      {plant && (
        <button type="button" className="btn btn-small" onClick={() => onReplace(plant.code)}>
          {t(`Az összes ${plantName(plant).toLowerCase()} cseréje a tervben…`, `Replace every ${plantName(plant).toLowerCase()} in the plan…`)}
        </button>
      )}
      <fieldset className="field-group">
        <legend>{t('Státusz', 'Status')}</legend>
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
          {t('Kész', 'Done')}
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
      <NumField label={t('Kiterjedés (cm)', 'Spread (cm)')} v={item.spreadCm ?? plant.spreadCm} on={(v) => v >= 5 && v <= 5000 && upd([item.id], { spreadCm: Math.round(v) === plant.spreadCm ? undefined : Math.round(v) })} />
      <div className="field">
        <span className="mono muted">{own ? t(`egyedi méret (a faj: ${plant.spreadCm} cm)`, `own size (species: ${plant.spreadCm} cm)`) : t('a faj mérete', 'species size')}</span>
        {own && (
          <button type="button" className="btn btn-small" onClick={() => upd([item.id], { spreadCm: undefined })}>
            {t('Vissza az alapméretre', 'Back to species size')}
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
        <span>{t('Jegyzet', 'Note')}</span>
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
    onNote(
      got === target
        ? ''
        : t(
            `Ennél az alaknál ${target} db nem jön ki egyenletes tőtávval; a legközelebbi: ${got} db (${sp} cm).`,
            `${target} does not fit this shape with even spacing; the closest is ${got} (${sp} cm).`,
          ),
    );
  };
  const countFor = (sp: number) =>
    item.kind === 'drift' ? fillPolygon(item.polygon, sp, item.pattern).length : fillPath(item.path, sp).length;
  return (
    <>
      <div className="field-row">
        <NumField
          label={t('Darabszám', 'Count')}
          v={item.count}
          on={(n) => n >= 1 && setCount(n)}
        />
        <NumField label={t('Tőtáv (cm)', 'Spacing (cm)')} v={item.spacingCm} on={(sp) => sp >= 3 && (onNote(''), upd([item.id], { spacingCm: sp }))} />
      </div>
      {item.kind === 'drift' && (
        <fieldset className="field-group">
          <legend>{t('Kiosztás', 'Layout')}</legend>
          <div className="seg">
            <label className="seg-item">
              <input type="radio" name="pattern" checked={item.pattern === 'staggered'} onChange={() => upd([item.id], { pattern: 'staggered' })} />
              <span>{t('eltolt (háromszög)', 'staggered (triangle)')}</span>
            </label>
            <label className="seg-item">
              <input type="radio" name="pattern" checked={item.pattern === 'grid'} onChange={() => upd([item.id], { pattern: 'grid' })} />
              <span>{t('négyzetes', 'grid')}</span>
            </label>
          </div>
        </fieldset>
      )}
      <p className="mono muted">
        {item.kind === 'drift'
          ? t('Folt: a csúcspontokat Kijelölés módban húzva alakíthatod.', 'Drift: reshape it by dragging its corners with the Select tool.')
          : t('Sor: a csúcspontokat Kijelölés módban húzva alakíthatod.', 'Row: reshape it by dragging its points with the Select tool.')}
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
        <b>{plantName(p)}</b>
        {count > 1 && <span className="mono muted"> · {t(`${count} tő`, `${count} plants`)}</span>}
        <i className="psum-lat">{p.nameLat}</i>
        <span className="mono muted">
          {t(`max. ${p.maxHeightCm} cm · szél. ${p.spreadCm} cm · tőtáv ${p.spacingCm} cm`, `max. ${p.maxHeightCm} cm · wide ${p.spreadCm} cm · spacing ${p.spacingCm} cm`)} ·{' '}
          {p.sun.map((s) => SUN_LABEL[s]).join('/')} · {t('víz', 'water')}: {WATER_LABEL[p.water]} · juglone: {JUGLONE_LABEL[p.juglone]} · {t('mérgező', 'toxic')}:{' '}
          {TOXIC_LABEL[p.toxic]}
          {p.thorny ? t(' · tüskés', ' · thorny') : ''}
        </span>
        {!!p.verify?.length && <span className="mono warn-text">
            {t('Ellenőrizendő adat', 'Data to check')}: {p.verify.length}
          </span>}
      </div>
    </div>
  );
}
