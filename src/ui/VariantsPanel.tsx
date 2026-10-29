import { useMemo, useState } from 'react';
import { fmtFt } from '../engine/bom';
import { variantStats } from '../engine/compare';
import type { Variant } from '../model/types';
import { activeVariant, selectCurrentArea, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';

/** Plan variants of the current area: open, choose, copy, rename, delete, compare. */
export function VariantsPanel({ onDone }: { onDone: () => void }) {
  const project = useProject((s) => s.project)!;
  const area = useProject(selectCurrentArea);
  const [renaming, setRenaming] = useState<string | null>(null);
  const stats = useMemo(() => (area ? area.variants.map((v) => variantStats(project, area, v)) : []), [project, area]);
  if (!area) return null;
  const active = activeVariant(area).id;
  const st = useProject.getState();

  return (
    <div className="form">
      <p className="mono muted">A „választott” változatból készül a növénylista és a nyomtatás. A rajzon mindig a „szerkesztett” változatot látod.</p>
      <ul className="variant-list">
        {stats.map(({ variant: v, bom, warnings, errors }) => (
          <li key={v.id} className={`variant-card${v.id === active ? ' is-active' : ''}`}>
            <div className="variant-top">
              {renaming === v.id ? (
                <RenameField v={v} onDone={() => setRenaming(null)} />
              ) : (
                <b className="variant-name">{v.name}</b>
              )}
              <span className="variant-badges">
                {v.id === area.chosenVariantId && <span className="badge badge-chosen">★ választott</span>}
                {v.id === active && <span className="badge">szerkesztett</span>}
              </span>
            </div>
            <span className="mono muted">
              {bom.planted} tő · {fmtFt(bom.total)} · {warnings.length} figyelmeztetés{errors ? ` (${errors} hiba)` : ''}
            </span>
            <div className="card-actions wrap">
              {v.id !== active && (
                <button
                  type="button"
                  className="btn btn-small btn-primary"
                  onClick={() => {
                    st.setActiveVariant(v.id);
                    onDone();
                  }}
                >
                  Szerkesztés
                </button>
              )}
              {v.id !== area.chosenVariantId && (
                <button type="button" className="btn btn-small" onClick={() => st.setChosenVariant(v.id)}>
                  Legyen a választott
                </button>
              )}
              <button type="button" className="btn btn-small" onClick={() => st.duplicateVariant(v.id)}>
                Másolás
              </button>
              <button type="button" className="btn btn-small" onClick={() => setRenaming(v.id)}>
                Átnevezés
              </button>
              {area.variants.length > 1 && (
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => confirm(`Törlöd a(z) „${v.name}” változatot? Visszavonással visszahozható.`) && st.deleteVariant(v.id)}
                >
                  Törlés
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="form-actions">
        <button type="button" className="btn" onClick={() => st.addEmptyVariant()}>
          + Üres változat
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={area.variants.length < 2}
          onClick={() => {
            useUi.getState().setTool('select');
            useUi.getState().setCompare(true);
            onDone();
          }}
        >
          Összehasonlítás
        </button>
      </div>
    </div>
  );
}

function RenameField({ v, onDone }: { v: Variant; onDone: () => void }) {
  const [name, setName] = useState(v.name);
  const save = () => {
    useProject.getState().renameVariant(v.id, name);
    onDone();
  };
  return (
    <input
      className="variant-rename"
      value={name}
      autoFocus
      onChange={(e) => setName(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') onDone();
      }}
      aria-label="Változat neve"
    />
  );
}
