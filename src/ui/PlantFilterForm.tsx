import { JUGLONE_LABEL, SOIL_LABEL, SOILS } from '../model/plants';
import { activeFilterCount, NO_FILTER, type PlantFilter } from '../model/plantFilter';
import type { JugloneTolerance, SunNeed } from '../model/types';
import { useUi } from '../store/uiStore';

/** Shared plant filters (database list and palette). */
export function PlantFilterForm() {
  const f = useUi((s) => s.plantFilter);
  const set = <K extends keyof PlantFilter>(k: K, v: PlantFilter[K]) => useUi.getState().setPlantFilter({ ...useUi.getState().plantFilter, [k]: v });
  const n = activeFilterCount(f);
  return (
    <div className="filter-grid">
      <label className="field">
        <span>Mérgező</span>
        <select value={f.toxic} onChange={(e) => set('toxic', e.target.value as PlantFilter['toxic'])}>
          <option value="">mind</option>
          <option value="no">nem mérgező</option>
          <option value="yes">mérgező</option>
          <option value="unknown">nem ismert</option>
        </select>
      </label>
      <label className="field">
        <span>Fény</span>
        <select value={f.sun} onChange={(e) => set('sun', e.target.value as PlantFilter['sun'])}>
          <option value="">mind</option>
          {(['sun', 'part', 'shade'] as SunNeed[]).map((s) => (
            <option key={s} value={s}>
              {s === 'sun' ? 'napos' : s === 'part' ? 'félárnyékos' : 'árnyékos'}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Talaj</span>
        <select value={f.soil} onChange={(e) => set('soil', e.target.value as PlantFilter['soil'])}>
          <option value="">mind</option>
          {SOILS.map((s) => (
            <option key={s} value={s}>
              {SOIL_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="range">
        <legend>Magasság (cm)</legend>
        <input type="number" inputMode="numeric" placeholder="tól" value={f.hMin} onChange={(e) => set('hMin', e.target.value)} aria-label="Magasság legalább (cm)" />
        <span>–</span>
        <input type="number" inputMode="numeric" placeholder="ig" value={f.hMax} onChange={(e) => set('hMax', e.target.value)} aria-label="Magasság legfeljebb (cm)" />
      </fieldset>
      <fieldset className="range">
        <legend>Terjedelem (cm)</legend>
        <input type="number" inputMode="numeric" placeholder="tól" value={f.sMin} onChange={(e) => set('sMin', e.target.value)} aria-label="Terjedelem legalább (cm)" />
        <span>–</span>
        <input type="number" inputMode="numeric" placeholder="ig" value={f.sMax} onChange={(e) => set('sMax', e.target.value)} aria-label="Terjedelem legfeljebb (cm)" />
      </fieldset>
      <label className="field">
        <span>Tüske</span>
        <select value={f.thorny} onChange={(e) => set('thorny', e.target.value as PlantFilter['thorny'])}>
          <option value="">mind</option>
          <option value="no">tüskementes</option>
          <option value="yes">tüskés</option>
        </select>
      </label>
      <label className="field">
        <span>Juglone</span>
        <select value={f.juglone} onChange={(e) => set('juglone', e.target.value as PlantFilter['juglone'])}>
          <option value="">mind</option>
          {(Object.keys(JUGLONE_LABEL) as JugloneTolerance[]).map((j) => (
            <option key={j} value={j}>
              {JUGLONE_LABEL[j]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Szín</span>
        <input value={f.color} onChange={(e) => set('color', e.target.value)} placeholder="pl. lila, ezüst" />
      </label>
      <button type="button" className="btn btn-small" onClick={() => useUi.getState().setPlantFilter({ ...NO_FILTER, q: f.q })} disabled={!n}>
        Szűrők törlése{n ? ` (${n})` : ''}
      </button>
    </div>
  );
}

