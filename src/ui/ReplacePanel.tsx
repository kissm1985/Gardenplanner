import { useMemo, useState } from 'react';
import { itemCount } from '../engine/fill';
import { KIND_LABEL, plantKinds } from '../engine/generator';
import { mixCounts, type MixPart } from '../engine/mix';
import type { PlacedItem } from '../model/types';
import { activeVariant, selectCurrentArea, useProject, type ReplaceScope } from '../store/projectStore';
import { PlantMultiPicker } from './PlantMultiPicker';

const SCOPE_LABEL: Record<ReplaceScope, string> = {
  variant: 'csak a szerkesztett változatban',
  area: 'a terület összes változatában',
  project: 'az egész projektben (minden terület)',
};

const plants = (it: PlacedItem) => (it.kind === 'plant' ? 1 : it.count);

/** Replace every plant of one species with another one, or with a random mix of several (e.g. a different hedge). */
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
  const [to, setTo] = useState<MixPart[]>([]);
  const [mode, setMode] = useState<'plant' | 'item'>('plant');
  const [scope, setScope] = useState<ReplaceScope>('variant');
  const [keepSpacing, setKeepSpacing] = useState(false);
  const [msg, setMsg] = useState('');
  if (!area) return null;
  const src = project.plantDb.find((p) => p.code === from);
  if (!src) return <p className="empty">A szerkesztett változatban még nincs növény.</p>;

  // Suggestions: same type first (hedge for a hedge…), then similar height.
  const kinds = plantKinds(src);
  const options = project.plantDb
    .filter((p) => p.code !== from)
    .map((p) => {
      const same = [...plantKinds(p)].some((k) => kinds.has(k));
      return { p, tag: same ? 'hasonló típus' : undefined, score: (same ? 0 : 2) + Math.abs(p.maxHeightCm - src.maxHeightCm) / 1000 };
    });
  const targets = to.map((x) => ({ ...x, p: project.plantDb.find((p) => p.code === x.code)! })).filter((x) => x.p);
  const mixed = targets.length > 1;

  // Preview in the edited variant.
  const mine = items.filter((it) => it.plantId === from);
  const before = mine.reduce((s, it) => s + plants(it), 0);
  const preview = (() => {
    if (!targets.length) return '';
    if (!mixed) {
      const t = targets[0].p;
      const after = mine.reduce((s, it) => s + (it.kind === 'plant' ? 1 : itemCount({ ...it, spacingCm: keepSpacing ? it.spacingCm : t.spacingCm })), 0);
      return `${mine.length} elem, ${before} tő ${src.nameHu.toLowerCase()} → ${after} tő ${t.nameHu.toLowerCase()}.`;
    }
    const n = mode === 'plant' ? before : mine.length;
    const counts = mixCounts(n, targets);
    const unit = mode === 'plant' ? 'tő' : 'elem';
    return `${before} tő ${src.nameHu.toLowerCase()} → véletlenszerűen ${targets.map((t, i) => `${counts[i]} ${unit} ${t.p.nameHu.toLowerCase()}`).join(', ')}.`;
  })();

  const run = () => {
    if (!targets.length) return;
    const n = useProject.getState().replaceSpecies(from, to, scope, keepSpacing, mode);
    const names = targets.map((t) => t.p.nameHu).join(' + ');
    setMsg(n ? `${n} ${mixed && mode === 'plant' ? 'tő' : 'elem'} cserélve: ${src.nameHu} → ${names}. Visszavonással visszaállítható.` : 'Nem volt mit cserélni.');
    setFrom(targets[0].code);
    setTo([]);
  };

  return (
    <div className="form">
      <label className="field">
        <span className="lbl">Ezt cserélem</span>
        <select
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setTo([]);
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

      <PlantMultiPicker area={area} options={options} picked={to} onChange={setTo} label="Erre cserélem (egy vagy több növény)" />
      {mixed && (
        <fieldset className="field-group">
          <legend>Véletlenszerű keverés</legend>
          <label className="check">
            <input type="radio" name="mix-mode" checked={mode === 'plant'} onChange={() => setMode('plant')} />
            <span>tövenként – a foltok és sorok egyedi tövekre bomlanak, minden tő helyére véletlenszerűen kerül valamelyik</span>
          </label>
          <label className="check">
            <input type="radio" name="mix-mode" checked={mode === 'item'} onChange={() => setMode('item')} />
            <span>elemenként – egy folt vagy sor egészében egy fajt kap</span>
          </label>
          <p className="mono muted">
            A darabszámok az arányokat követik (pl. 1 : 1 → fele-fele), a sorrend véletlenszerű. Tövenkénti keverésnél a tövek a régi helyükön maradnak; ha az új növények
            nagyobbak, a figyelmeztetések jelzik a túl sűrű helyeket.
          </p>
        </fieldset>
      )}

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
          <span>A megmaradó foltok és sorok az új növény tőtávját kapják (a darabszám újraszámolódik)</span>
        </label>
      </fieldset>

      {preview && (
        <p className="mono" role="status">
          A szerkesztett változatban: {preview}
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
        <button type="button" className="btn btn-primary" disabled={!targets.length} onClick={run}>
          Csere
        </button>
      </div>
    </div>
  );
}
