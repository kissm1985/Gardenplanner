import { useMemo, useRef, useState } from 'react';
import { activeFilterCount, filterPlants } from '../model/plantFilter';
import { blankPlant, JUGLONE_LABEL, plantsFromCsv, plantsFromJson, plantsToCsv, SOIL_LABEL, SUN_LABEL, suggestCode, TOXIC_LABEL } from '../model/plants';
import type { Plant } from '../model/types';
import { useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { downloadText } from './download';
import { PlantChip } from './PlantChip';
import { PlantForm } from './PlantForm';
import { PlantFilterForm } from './PlantFilterForm';

/** Plant database: search, filters, add / edit / delete, JSON & CSV import/export. */
export function PlantDbPanel({ onPick }: { onPick?: (code: string) => void }) {
  const project = useProject((s) => s.project)!;
  const db = project.plantDb;
  const f = useUi((s) => s.plantFilter);
  const [editing, setEditing] = useState<{ plant: Plant; isNew: boolean } | null>(null);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of project.areas) for (const v of a.variants) for (const i of v.items) m.set(i.plantId, (m.get(i.plantId) ?? 0) + 1);
    return m;
  }, [project.areas]);
  const list = useMemo(() => filterPlants(db, f).sort((a, b) => a.nameHu.localeCompare(b.nameHu, 'hu')), [db, f]);

  if (editing) {
    const { plant, isNew } = editing;
    return (
      <PlantForm
        initial={plant}
        isNew={isNew}
        others={db.filter((p) => p.code !== plant.code || isNew)}
        usedCount={usage.get(plant.code) ?? 0}
        onCancel={() => setEditing(null)}
        onDelete={isNew ? undefined : () => (useProject.getState().deletePlant(plant.code), setEditing(null))}
        onSave={(p) => {
          if (isNew) useProject.getState().addPlant(p);
          else useProject.getState().updatePlant(plant.code, p);
          setEditing(null);
        }}
      />
    );
  }

  const importFile = async (file: File) => {
    const text = await file.text();
    const res = file.name.toLowerCase().endsWith('.csv') ? plantsFromCsv(text) : plantsFromJson(text);
    if (res.plants.length) useProject.getState().importPlants(res.plants, 'merge');
    setMsg(
      `${res.plants.length} növény betöltve (azonos kódnál felülírva).` +
        (res.errors.length ? ` ${res.errors.length} hibás sor kimaradt: ${res.errors.slice(0, 3).join(' ')}` : ''),
    );
  };

  const nFilters = activeFilterCount(f);
  const unchecked = db.filter((p) => p.verify?.length).length;

  return (
    <div className="plantdb">
      <input className="palette-search" type="search" value={f.q} onChange={(e) => useUi.getState().setPlantFilter({ ...f, q: e.target.value })} placeholder="Keresés: név, latin név, kód" aria-label="Keresés az adatbázisban" />
      <details className="filters" open={nFilters > 0 || undefined}>
        <summary>Szűrők{nFilters ? ` (${nFilters} aktív)` : ''}</summary>
        <PlantFilterForm />
      </details>

      <p className="mono muted">
        {list.length} / {db.length} növény{unchecked ? ` · ${unchecked} fajnál van ellenőrizendő adat` : ''}
      </p>
      {list.length === 0 && <p className="empty">Ezekkel a szűrőkkel nincs találat.</p>}
      <ul className="plant-list">
        {list.map((p) => (
          <li key={p.code}>
            <button type="button" className="plant-row" onClick={() => (onPick ? onPick(p.code) : setEditing({ plant: p, isNew: false }))}>
              <PlantChip p={p} size={36} />
              <span className="plant-row-text">
                <b>{p.nameHu}</b>
                <i>{p.nameLat}</i>
                <span className="mono muted">
                  {p.maxHeightCm} cm magas · {p.spreadCm} cm széles · {p.sun.map((s) => SUN_LABEL[s]).join('/')}
                  {p.soil?.length ? ` · ${p.soil.map((x) => SOIL_LABEL[x]).join('/')}` : ''} · mérgező: {TOXIC_LABEL[p.toxic]} · juglone:{' '}
                  {JUGLONE_LABEL[p.juglone]}
                  {p.thorny ? ' · tüskés' : ''}
                  {usage.get(p.code) ? ` · ${usage.get(p.code)} tő` : ''}
                </span>
              </span>
              {!!p.verify?.length && (
                <span className="verify-dot" title={`Ellenőrizendő: ${p.verify.length} adat`}>
                  !
                </span>
              )}
            </button>
            {onPick && (
              <button type="button" className="btn btn-small" onClick={() => setEditing({ plant: p, isNew: false })}>
                Szerk.
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setEditing({ plant: blankPlant(suggestCode('', new Set(db.map((p) => p.code)))), isNew: true })}
        >
          + Új növény
        </button>
      </div>
      <h3 className="sub-h">Import és export</h3>
      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-small" onClick={() => downloadText('novenyek.json', JSON.stringify(db, null, 2), 'application/json')}>
          Export JSON
        </button>
        <button type="button" className="btn btn-small" onClick={() => downloadText('novenyek.csv', plantsToCsv(db), 'text/csv;charset=utf-8')}>
          Export CSV
        </button>
        <button type="button" className="btn btn-small" onClick={() => fileRef.current?.click()}>
          Import (JSON / CSV)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {msg && (
        <p className="toast" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
