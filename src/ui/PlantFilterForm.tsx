import { JUGLONE_LABEL, SOIL_LABEL, SOILS } from '../model/plants';
import { activeFilterCount, NO_FILTER, type PlantFilter } from '../model/plantFilter';
import type { JugloneTolerance, SunNeed } from '../model/types';
import { useUi } from '../store/uiStore';
import { t } from '../i18n';

/** Shared plant filters (database list and palette). */
export function PlantFilterForm() {
  const f = useUi((s) => s.plantFilter);
  const set = <K extends keyof PlantFilter>(k: K, v: PlantFilter[K]) => useUi.getState().setPlantFilter({ ...useUi.getState().plantFilter, [k]: v });
  const n = activeFilterCount(f);
  return (
    <div className="filter-grid">
      <label className="field">
        <span>{t('Mérgező', 'Toxic')}</span>
        <select value={f.toxic} onChange={(e) => set('toxic', e.target.value as PlantFilter['toxic'])}>
          <option value="">{t('mind', 'all')}</option>
          <option value="no">{t('nem mérgező', 'non-toxic')}</option>
          <option value="yes">{t('mérgező', 'toxic')}</option>
          <option value="unknown">{t('nem ismert', 'unknown')}</option>
        </select>
      </label>
      <label className="field">
        <span>{t('Fény', 'Light')}</span>
        <select value={f.sun} onChange={(e) => set('sun', e.target.value as PlantFilter['sun'])}>
          <option value="">{t('mind', 'all')}</option>
          {(['sun', 'part', 'shade'] as SunNeed[]).map((s) => (
            <option key={s} value={s}>
              {s === 'sun' ? t('napos', 'sunny') : s === 'part' ? t('félárnyékos', 'part shade') : t('árnyékos', 'shade')}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('Talaj', 'Soil')}</span>
        <select value={f.soil} onChange={(e) => set('soil', e.target.value as PlantFilter['soil'])}>
          <option value="">{t('mind', 'all')}</option>
          {SOILS.map((s) => (
            <option key={s} value={s}>
              {SOIL_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="range">
        <legend>{t('Magasság (cm)', 'Height (cm)')}</legend>
        <input type="number" inputMode="numeric" placeholder={t('tól', 'from')} value={f.hMin} onChange={(e) => set('hMin', e.target.value)} aria-label={t('Magasság legalább (cm)', 'Height at least (cm)')} />
        <span>–</span>
        <input type="number" inputMode="numeric" placeholder={t('ig', 'to')} value={f.hMax} onChange={(e) => set('hMax', e.target.value)} aria-label={t('Magasság legfeljebb (cm)', 'Height at most (cm)')} />
      </fieldset>
      <fieldset className="range">
        <legend>{t('Terjedelem (cm)', 'Spread (cm)')}</legend>
        <input type="number" inputMode="numeric" placeholder={t('tól', 'from')} value={f.sMin} onChange={(e) => set('sMin', e.target.value)} aria-label={t('Terjedelem legalább (cm)', 'Spread at least (cm)')} />
        <span>–</span>
        <input type="number" inputMode="numeric" placeholder={t('ig', 'to')} value={f.sMax} onChange={(e) => set('sMax', e.target.value)} aria-label={t('Terjedelem legfeljebb (cm)', 'Spread at most (cm)')} />
      </fieldset>
      <label className="field">
        <span>{t('Tüske', 'Thorns')}</span>
        <select value={f.thorny} onChange={(e) => set('thorny', e.target.value as PlantFilter['thorny'])}>
          <option value="">{t('mind', 'all')}</option>
          <option value="no">{t('tüskementes', 'no thorns')}</option>
          <option value="yes">{t('tüskés', 'thorny')}</option>
        </select>
      </label>
      <label className="field">
        <span>Juglone</span>
        <select value={f.juglone} onChange={(e) => set('juglone', e.target.value as PlantFilter['juglone'])}>
          <option value="">{t('mind', 'all')}</option>
          {(Object.keys(JUGLONE_LABEL) as JugloneTolerance[]).map((j) => (
            <option key={j} value={j}>
              {JUGLONE_LABEL[j]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('Szín', 'Colour')}</span>
        <input value={f.color} onChange={(e) => set('color', e.target.value)} placeholder={t('pl. lila, ezüst', 'e.g. purple, silver')} />
      </label>
      <button type="button" className="btn btn-small" onClick={() => useUi.getState().setPlantFilter({ ...NO_FILTER, q: f.q })} disabled={!n}>
        {t('Szűrők törlése', 'Clear filters')}
        {n ? ` (${n})` : ''}
      </button>
    </div>
  );
}

