import { useState } from 'react';
import { candidates, generateIdea, PALETTES, type Idea, type PaletteKey } from '../engine/generator';
import { areaSunLevel, evaluate } from '../engine/rules';
import { SUN_LABEL, SOIL_LABEL } from '../model/plants';
import { AREA_KIND_LABEL } from '../model/types';
import { selectCurrentArea, useProject } from '../store/projectStore';
import { PlantChip } from './PlantChip';

/** Random planting ideas that fit the current area; each idea goes into its own variant. */
export function IdeaPanel({ onDone }: { onDone: () => void }) {
  const project = useProject((s) => s.project)!;
  const area = useProject(selectCurrentArea);
  const [palette, setPalette] = useState<PaletteKey | ''>('');
  const [idea, setIdea] = useState<{ variantId: string; idea: Idea } | null>(null);
  if (!area) return null;
  const pool = candidates(area, project.plantDb);
  const c = area.constraints;
  const variantAlive = idea && area.variants.some((v) => v.id === idea.variantId);

  const run = (again: boolean) => {
    const st = useProject.getState();
    const next = generateIdea(area, project.plantDb, project.settings, { palette: palette || undefined });
    const notes = next.notes.join(' ');
    if (again && idea && variantAlive) {
      st.setVariantItems(idea.variantId, next.items, notes);
      setIdea({ variantId: idea.variantId, idea: next });
    } else {
      const n = area.variants.filter((v) => /^Ötlet \d+$/.test(v.name)).length + 1;
      const id = st.addVariantWith(`Ötlet ${n}`, next.items, notes, 'Ötletek');
      if (id) setIdea({ variantId: id, idea: next });
    }
  };

  const shown = variantAlive ? idea!.idea : null;
  const issues = shown ? evaluate(area, shown.items, project.plantDb, project.settings).filter((w) => w.severity !== 'info') : [];
  const planted = shown?.items.reduce((s, it) => s + (it.kind === 'plant' ? 1 : it.count), 0) ?? 0;

  return (
    <div className="form">
      <p className="mono muted">
        A terület feltételeihez illő fajokból ({SUN_LABEL[areaSunLevel(area)]}
        {c.maxHeightCm != null ? `, max. ${c.maxHeightCm} cm` : ''}
        {c.nonToxic ? ', nem mérgező' : ''}
        {c.noThorns ? ', tüske nélkül' : ''}
        {area.soil ? `, ${SOIL_LABEL[area.soil]} talaj` : ''}
        {area.kind ? `, ${AREA_KIND_LABEL[area.kind].toLowerCase()}` : ''}; {pool.length} faj jöhet szóba) véletlenszerű, de átgondolt összeállítás: egy színvilág, hátul a magasabbak, elöl
        az alacsonyabbak, 3–5 faj ismétlődő foltokban. Mindegyik ötlet külön változatba kerül, a meglévő terv nem változik.
      </p>
      <label className="field">
        <span className="lbl">Színvilág</span>
        <select value={palette} onChange={(e) => setPalette(e.target.value as PaletteKey | '')}>
          <option value="">Meglepetés</option>
          {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
            <option key={k} value={k}>
              {PALETTES[k].label}
            </option>
          ))}
        </select>
      </label>
      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-primary" onClick={() => run(false)} disabled={pool.length < 2}>
          {shown ? 'Új ötlet új változatba' : 'Ötlet generálása'}
        </button>
        {shown && (
          <button type="button" className="btn" onClick={() => run(true)}>
            Újra (ebbe a változatba)
          </button>
        )}
      </div>
      {pool.length < 2 && <p className="form-error">Túl kevés faj felel meg a terület feltételeinek. Lazíts a korlátokon, vagy bővítsd az adatbázist.</p>}

      {shown && (
        <div className="idea-result" aria-live="polite">
          <b>
            {area.variants.find((v) => v.id === idea!.variantId)?.name}: {PALETTES[shown.palette].label} · {planted} tő
          </b>
          <ul className="idea-species">
            {shown.species.map((p) => (
              <li key={p.code}>
                <PlantChip p={p} size={26} /> {p.nameHu} <span className="muted">{p.maxHeightCm} cm · {p.bloomColor || p.foliageColor}</span>
              </li>
            ))}
          </ul>
          {shown.notes.map((n) => (
            <p key={n} className="mono muted">
              {n}
            </p>
          ))}
          <p className="mono">{issues.length ? `Szabályellenőrzés: ${issues.length} figyelmeztetés – nézd meg a Figyelmeztetések között.` : 'Szabályellenőrzés: nincs figyelmeztetés.'}</p>
          <div className="form-actions">
            <span className="spacer" />
            <button type="button" className="btn btn-primary" onClick={onDone}>
              Megnézem a rajzon
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
