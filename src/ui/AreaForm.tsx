import { useState, type FormEvent } from 'react';
import type { AreaInput } from '../data/templates';
import { DEFAULT_CONSTRAINTS, ORIENTATION_LABEL, type Area, type Orientation } from '../model/types';

type Draft = AreaInput & { constraints: Area['constraints'] };

const blank: Draft = {
  name: '',
  widthCm: 200,
  lengthCm: 400,
  orientation: 'S',
  sunUntil: '',
  notes: '',
  constraints: { ...DEFAULT_CONSTRAINTS },
};

export function AreaForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial?: Area;
  submitLabel: string;
  onSubmit: (d: Draft) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(() =>
    initial
      ? {
          name: initial.name,
          widthCm: initial.widthCm,
          lengthCm: initial.lengthCm,
          orientation: initial.orientation,
          sunUntil: initial.sunUntil,
          notes: initial.notes,
          constraints: { ...initial.constraints },
        }
      : blank,
  );
  const [error, setError] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setC = <K extends keyof Draft['constraints']>(k: K, v: Draft['constraints'][K]) =>
    setD((p) => ({ ...p, constraints: { ...p.constraints, [k]: v } }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!d.name.trim()) return setError('Adj nevet a területnek, például „Házoldali sáv”.');
    if (!(d.widthCm >= 10 && d.widthCm <= 10000 && d.lengthCm >= 10 && d.lengthCm <= 10000))
      return setError('A méret 10 és 10 000 cm között lehet.');
    setError('');
    onSubmit({ ...d, name: d.name.trim() });
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">
        <span>Név</span>
        <input value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="pl. Házoldali sáv" autoComplete="off" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Szélesség (cm)</span>
          <input type="number" inputMode="numeric" min={10} value={d.widthCm} onChange={(e) => set('widthCm', +e.target.value)} />
        </label>
        <label className="field">
          <span>Hossz (cm)</span>
          <input type="number" inputMode="numeric" min={10} value={d.lengthCm} onChange={(e) => set('lengthCm', +e.target.value)} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Égtáj</span>
          <select value={d.orientation} onChange={(e) => set('orientation', e.target.value as Orientation)}>
            {(Object.keys(ORIENTATION_LABEL) as Orientation[]).map((o) => (
              <option key={o} value={o}>
                {ORIENTATION_LABEL[o]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Napsütés</span>
          <input value={d.sunUntil} onChange={(e) => set('sunUntil', e.target.value)} placeholder="pl. 13:00-ig" />
        </label>
      </div>

      <fieldset className="field-group">
        <legend>Korlátok</legend>
        <label className="field">
          <span>Max. magasság (cm, üresen: nincs)</span>
          <input
            type="number"
            inputMode="numeric"
            value={d.constraints.maxHeightCm ?? ''}
            onChange={(e) => setC('maxHeightCm', e.target.value === '' ? null : +e.target.value)}
          />
        </label>
        <label className="field">
          <span>Max. fák száma (üresen: nincs)</span>
          <input
            type="number"
            inputMode="numeric"
            value={d.constraints.maxTrees ?? ''}
            onChange={(e) => setC('maxTrees', e.target.value === '' ? null : +e.target.value)}
          />
        </label>
        <Check label="Tüskementes legyen" v={d.constraints.noThorns} on={(v) => setC('noThorns', v)} />
        <Check label="Nem mérgező legyen" v={d.constraints.nonToxic} on={(v) => setC('nonToxic', v)} />
        <Check label="Csepegtető öntözés van" v={d.constraints.drip} on={(v) => setC('drip', v)} />
        <Check label="Ágyásfedés (agrotextil + mulcs)" v={d.constraints.mulchCover} on={(v) => setC('mulchCover', v)} />
      </fieldset>

      <label className="field">
        <span>Megjegyzés</span>
        <textarea rows={3} value={d.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Mégse
        </button>
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Check({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
