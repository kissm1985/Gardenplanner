import { useMemo, useState } from 'react';
import { itemCount } from '../engine/fill';
import { KIND_LABEL, plantKinds } from '../engine/generator';
import { areaSunLevel } from '../engine/rules';
import { matchesQuery } from '../model/plantFilter';
import { SUN_LABEL } from '../model/plants';
import type { Area, PlacedItem, Plant } from '../model/types';
import { activeVariant, selectCurrentArea, useProject, type ReplaceScope } from '../store/projectStore';
import { PlantChip } from './PlantChip';

const SCOPE_LABEL: Record<ReplaceScope, string> = {
  variant: 'csak a szerkesztett változatban',
  area: 'a terület összes változatában',
  project: 'az egész projektben (minden terület)',
};

/** Why a plant does not suit the area (empty = fits). */
function misfit(area: Area, p: Plant): string[] {
  const c = area.constraints;
  const out: string[] = [];
  const sun = areaSunLevel(area);
  if (!p.sun.includes(sun)) out.push(`nem ${SUN_LABEL[sun]}i`);
  if (c.maxHeightCm != null && p.maxHeightCm > c.maxHeightCm) out.push(`magasabb ${c.maxHeightCm} cm-nél`);
  if (c.nonToxic && p.toxic !== 'no') out.push(p.toxic === 'unknown' ? 'mérgezősége nem ismert' : 'mérgező');
  if (c.noThorns && p.thorny) out.push('tüskés');
  if (area.soil && p.soil?.length && !p.soil.includes(area.soil)) out.push('más talajt kedvel');
  return out;
}

const plants = (it: PlacedItem) => (it.kind === 'plant' ? 1 : it.count);

/** Replace every plant of one species with another one (e.g. a different hedge). */
export function ReplacePanel({ from: initial, onDone }: { from?: string; onDone: () => void }) {
  const project = useProject((s) => s.project)!;
  const area = useProject(selectCurrentArea);
  const items = area ? activeVariant(area).items : [];
  // Species used in the edited variant, most plants first.
  const used = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.plantId, (m.get(it.plantId) ?? 0) + plants(it));
    return [...m].map(([code, n]) => ({ plant: project.plantDb.find((p) => p.code === code)!, n })).filter((x) => x.plant).sort((a, b) => b.n - a.n);
  }, [items, project.plantDb]);
  const [from, setFrom] = useState(initial && used.some((u) => u.plant.code === initial) ? initial : (used[0]?.plant.code ?? ''));
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<ReplaceScope>('variant');
  const [keepSpacing, setKeepSpacing] = useState(false);
  const [msg, setMsg] = useState('');
  if (!area) return null;
  const src = project.plantDb.find((p) => p.code === from);
  if (!src) return <p className="empty">A szerkesztett változatban még nincs növény.</p>;

  // Suggestions: same type first (hedge for a hedge…), then plants that suit the area; similar height first.
  const kinds = plantKinds(src);
  const options = project.plantDb
    .filter((p) => p.code !== from && matchesQuery(p, q))
    .map((p) => {
      const same = [...plantKinds(p)].some((k) => kinds.has(k));
      const bad = misfit(area, p);
      return { p, same, bad, score: (same ? 0 : 2) + (bad.length ? 1 : 0) + Math.abs(p.maxHeightCm - src.maxHeightCm) / 1000 };
    })
    .sort((a, b) => a.score - b.score);
  const target = project.plantDb.find((p) => p.code === to);

  // Preview in the edited variant: items and plants now, plants after (count follows the spacing).
  const mine = items.filter((it) => it.plantId === from);
  const before = mine.reduce((s, it) => s + plants(it), 0);
  const after = target
    ? mine.reduce((s, it) => s + (it.kind === 'plant' ? 1 : itemCount({ ...it, spacingCm: keepSpacing ? it.spacingCm : target.spacingCm })), 0)
    : before;

  const run = () => {
    if (!target) return;
    const n = useProject.getState().replaceSpecies(from, target.code, scope, keepSpacing);
    setMsg(n ? `${n} elem cserélve: ${src.nameHu} → ${target.nameHu}. Visszavonással visszaállítható.` : 'Nem volt mit cserélni.');
    setFrom(target.code);
    setTo('');
  };

  return (
    <div className="form">
      <label className="field">
        <span className="lbl">Ezt cserélem</span>
        <select
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setTo('');
          }}
        >
          {used.map(({ plant, n }) => (
            <option key={plant.code} value={plant.code}>
              {plant.code} – {plant.nameHu} ({n} tő)
            </option>
          ))}
        </select>
      </label>
      <p className="mono muted">
        Típus: {[...kinds].map((k) => KIND_LABEL[k].toLowerCase()).join(', ') || '–'} · {src.maxHeightCm} cm magas · tőtáv {src.spacingCm} cm
      </p>

      <label className="field">
        <span className="lbl">Erre cserélem</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keresés: név, latin név, kód" aria-label="Új növény keresése" />
      </label>
      <ul className="replace-list" role="listbox" aria-label="Választható növények">
        {options.slice(0, 40).map(({ p, same, bad }) => (
          <li key={p.code}>
            <button type="button" role="option" aria-selected={p.code === to} className={`plant-row${p.code === to ? ' is-picked' : ''}`} onClick={() => setTo(p.code)}>
              <PlantChip p={p} size={30} />
              <span className="plant-row-text">
                <b>{p.nameHu}</b>
                <span className="mono muted">
                  {p.maxHeightCm} cm · tőtáv {p.spacingCm} cm{same ? ' · hasonló típus' : ''}
                </span>
                {bad.length > 0 && <span className="mono replace-bad">⚠ {bad.join(', ')}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <fieldset className="field-group">
        <legend>Hol cseréljem?</legend>
        {(Object.keys(SCOPE_LABEL) as ReplaceScope[]).map((k) => (
          <label key={k} className="check">
            <input type="radio" name="replace-scope" checked={scope === k} onChange={() => setScope(k)} />
            <span>{SCOPE_LABEL[k]}</span>
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={!keepSpacing} onChange={(e) => setKeepSpacing(!e.target.checked)} />
          <span>A foltok és sorok az új növény tőtávját kapják (a darabszám újraszámolódik)</span>
        </label>
      </fieldset>

      {target && (
        <p className="mono" role="status">
          A szerkesztett változatban: {mine.length} elem, {before} tő {src.nameHu.toLowerCase()} → {after} tő {target.nameHu.toLowerCase()}.
        </p>
      )}
      {msg && (
        <p className="toast" role="status">
          {msg}
        </p>
      )}
      <div className="form-actions">
        <span className="spacer" />
        <button type="button" className="btn" onClick={onDone}>
          Kész
        </button>
        <button type="button" className="btn btn-primary" disabled={!target} onClick={run}>
          Csere
        </button>
      </div>
    </div>
  );
}
