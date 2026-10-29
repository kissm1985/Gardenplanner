import { useState, type FormEvent, type ReactNode } from 'react';
import { JUGLONE_LABEL, MONTHS, SOIL_LABEL, SOILS, SUN_LABEL, TOXIC_LABEL, validatePlant, WATER_LABEL } from '../model/plants';
import type { JugloneTolerance, Plant, Soil, SunNeed, Toxicity, WaterNeed } from '../model/types';

interface Props {
  initial: Plant;
  others: Plant[];
  usedCount: number;
  isNew: boolean;
  onSave: (p: Plant) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function PlantForm({ initial, others, usedCount, isNew, onSave, onDelete, onCancel }: Props) {
  const [p, setP] = useState<Plant>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof Plant>(k: K, v: Plant[K]) => setP((x) => ({ ...x, [k]: v }));
  const checked = (k: keyof Plant) => setP((x) => ({ ...x, verify: (x.verify ?? []).filter((f) => f !== k) }));

  // Small label with an "ellenőrizendő" marker that can be cleared once checked.
  const L = ({ k, children }: { k: keyof Plant; children: ReactNode }) => (
    <span className="lbl">
      {children}
      {p.verify?.includes(k) && (
        <button type="button" className="verify-tag" onClick={() => checked(k)} title="Jelöld ellenőrzöttnek">
          ellenőrizendő ✓
        </button>
      )}
    </span>
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validatePlant(p, others);
    setErrors(errs);
    if (!errs.length) onSave({ ...p, nameHu: p.nameHu.trim(), nameLat: p.nameLat.trim() });
  };

  const toggleSoil = (x: Soil) => set('soil', p.soil?.includes(x) ? p.soil.filter((y) => y !== x) : [...(p.soil ?? []), x]);
  const toggleSun = (s: SunNeed) => set('sun', p.sun.includes(s) ? p.sun.filter((x) => x !== s) : [...p.sun, s]);
  const toggleMonth = (m: number) =>
    set('bloomMonths', p.bloomMonths.includes(m) ? p.bloomMonths.filter((x) => x !== m) : [...p.bloomMonths, m].sort((a, b) => a - b));

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field-row field-row-code">
        <label className="field">
          <L k="code">Kód</L>
          <input value={p.code} maxLength={2} onChange={(e) => set('code', e.target.value.toUpperCase())} autoCapitalize="characters" />
        </label>
        <label className="field">
          <L k="nameHu">Magyar név</L>
          <input value={p.nameHu} onChange={(e) => set('nameHu', e.target.value)} />
        </label>
      </div>
      <label className="field">
        <L k="nameLat">Latin név</L>
        <input value={p.nameLat} onChange={(e) => set('nameLat', e.target.value)} lang="la" />
      </label>
      <div className="field-row field-row-3">
        <Num label={<L k="maxHeightCm">Max. magasság (cm)</L>} v={p.maxHeightCm} on={(v) => set('maxHeightCm', v)} />
        <Num label={<L k="spreadCm">Kifejlett szélesség (cm)</L>} v={p.spreadCm} on={(v) => set('spreadCm', v)} />
        <Num label={<L k="spacingCm">Tőtáv (cm)</L>} v={p.spacingCm} on={(v) => set('spacingCm', v)} />
      </div>

      <fieldset className="field-group">
        <legend>
          <L k="sun">Napigény</L>
        </legend>
        <div className="seg">
          {(Object.keys(SUN_LABEL) as SunNeed[]).map((s) => (
            <label key={s} className="seg-item">
              <input type="checkbox" checked={p.sun.includes(s)} onChange={() => toggleSun(s)} />
              <span>{SUN_LABEL[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field-group">
        <legend>
          <L k="soil">Talaj (amiben jól fejlődik)</L>
        </legend>
        <div className="seg">
          {SOILS.map((x) => (
            <label key={x} className="seg-item">
              <input type="checkbox" checked={!!p.soil?.includes(x)} onChange={() => toggleSoil(x)} />
              <span>{SOIL_LABEL[x]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field-row">
        <Sel label={<L k="water">Vízigény</L>} v={p.water} opts={WATER_LABEL} on={(v) => set('water', v as WaterNeed)} />
        <Sel label={<L k="juglone">Juglone-tűrés</L>} v={p.juglone} opts={JUGLONE_LABEL} on={(v) => set('juglone', v as JugloneTolerance)} />
      </div>
      <div className="field-row">
        <Sel label={<L k="toxic">Mérgező</L>} v={p.toxic} opts={TOXIC_LABEL} on={(v) => set('toxic', v as Toxicity)} />
        <label className="check">
          <input type="checkbox" checked={p.thorny} onChange={(e) => set('thorny', e.target.checked)} />
          <L k="thorny">Tüskés</L>
        </label>
      </div>

      <fieldset className="field-group">
        <legend>
          <L k="bloomMonths">Virágzás</L>
        </legend>
        <div className="months">
          {MONTHS.map((m, i) => (
            <label key={m} className="month">
              <input type="checkbox" checked={p.bloomMonths.includes(i + 1)} onChange={() => toggleMonth(i + 1)} />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field-row">
        <label className="field">
          <L k="bloomColor">Virágszín</L>
          <input value={p.bloomColor} onChange={(e) => set('bloomColor', e.target.value)} />
        </label>
        <label className="field">
          <L k="foliageColor">Lombszín</L>
          <input value={p.foliageColor} onChange={(e) => set('foliageColor', e.target.value)} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={p.winterInterest} onChange={(e) => set('winterInterest', e.target.checked)} />
        <L k="winterInterest">Télen is díszít</L>
      </label>

      <div className="field-row">
        <label className="field">
          <L k="pot">Kiszerelés</L>
          <input value={p.pot} onChange={(e) => set('pot', e.target.value)} placeholder="pl. P9, 1–2 l" />
        </label>
        <Num label={<L k="unitPriceHuf">Egységár (Ft)</L>} v={p.unitPriceHuf} on={(v) => set('unitPriceHuf', v)} />
      </div>
      <Sel
        label={<span className="lbl">Ár forrása</span>}
        v={p.priceSource ?? 'estimate'}
        opts={{ shop: 'boltlista', estimate: 'becslés' }}
        on={(v) => set('priceSource', v as 'shop' | 'estimate')}
      />

      <div className="field-row">
        <label className="field">
          <span className="lbl">Szín a rajzon</span>
          <input type="color" value={p.color} onChange={(e) => set('color', e.target.value)} />
        </label>
        <Sel
          label={<span className="lbl">Forma</span>}
          v={p.symbol ?? 'circle'}
          opts={{ circle: 'kör', square: 'négyzet (talajtakaró)', triangle: 'háromszög (fű)', diamond: 'rombusz (fa)' }}
          on={(v) => set('symbol', v as Plant['symbol'])}
        />
      </div>
      <label className="check">
        <input type="checkbox" checked={!!p.isTree} onChange={(e) => set('isTree', e.target.checked || undefined)} />
        <span>Fa (a fák számát a terület korlátja figyeli)</span>
      </label>
      <label className="field">
        <span className="lbl">Megjegyzés</span>
        <textarea rows={3} value={p.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>

      {errors.length > 0 && (
        <div className="form-error" role="alert">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
      <div className="form-actions">
        {onDelete && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              const msg = usedCount
                ? `A(z) ${p.nameHu} ${usedCount} helyen szerepel a tervekben. Törlöd a növényt és ezeket a töveket is?`
                : `Törlöd a(z) ${p.nameHu} növényt az adatbázisból?`;
              if (confirm(msg)) onDelete();
            }}
          >
            Törlés
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel}>
          Mégse
        </button>
        <button type="submit" className="btn btn-primary">
          {isNew ? 'Hozzáadás' : 'Mentés'}
        </button>
      </div>
    </form>
  );
}

function Num({ label, v, on }: { label: ReactNode; v: number; on: (v: number) => void }) {
  return (
    <label className="field">
      {label}
      <input type="number" inputMode="decimal" min={0} value={Number.isFinite(v) ? v : ''} onChange={(e) => on(e.target.value === '' ? NaN : +e.target.value)} />
    </label>
  );
}

function Sel({ label, v, opts, on }: { label: ReactNode; v: string; opts: Record<string, string>; on: (v: string) => void }) {
  return (
    <label className="field">
      {label}
      <select value={v} onChange={(e) => on(e.target.value)}>
        {Object.entries(opts).map(([k, t]) => (
          <option key={k} value={k}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
