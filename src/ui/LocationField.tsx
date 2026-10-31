import { locale, t } from '../i18n';
import { gardenLocation, LOCATION_PRESETS, type GardenLocation, type MonthDay } from '../model/location';
import { useProject } from '../store/projectStore';

const toInput = (d: MonthDay) => `2000-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
const fromInput = (s: string): MonthDay | null => {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(s);
  return m ? { month: +m[1], day: +m[2] } : null;
};
const fmt = (d: MonthDay) => new Date(2000, d.month - 1, d.day).toLocaleDateString(locale(), { month: 'long', day: 'numeric' });

/** Where the garden is: a nearby town (with average frost dates) or own dates. */
export function LocationField() {
  const settings = useProject((s) => s.project!.settings);
  const loc = gardenLocation(settings);
  const preset = LOCATION_PRESETS.find((p) => p.name === loc.name && p.lastFrost.month === loc.lastFrost.month && p.lastFrost.day === loc.lastFrost.day && p.firstFrost.month === loc.firstFrost.month && p.firstFrost.day === loc.firstFrost.day);
  const save = (l: GardenLocation) => useProject.getState().updateSettings({ location: l });
  return (
    <fieldset className="field-group">
      <legend>{t('Helyszín és éghajlat', 'Location and climate')}</legend>
      <label className="field">
        <span className="lbl">{t('A kert közelében', 'The garden is near')}</span>
        <select
          value={preset ? preset.name : '__own'}
          onChange={(e) => {
            const p = LOCATION_PRESETS.find((x) => x.name === e.target.value);
            if (p) save(p);
            else save({ ...loc, name: loc.name || t('Saját hely', 'My place') });
          }}
        >
          {LOCATION_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
          <option value="__own">{t('Más hely – saját fagydátumok', 'Elsewhere – my own frost dates')}</option>
        </select>
      </label>
      {!preset && (
        <>
          <label className="field">
            <span className="lbl">{t('Helység', 'Place')}</span>
            <input defaultValue={loc.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== loc.name && save({ ...loc, name: e.target.value.trim() })} />
          </label>
          <div className="field-row">
            <label className="field">
              <span className="lbl">{t('Utolsó tavaszi fagy', 'Last spring frost')}</span>
              <input type="date" value={toInput(loc.lastFrost)} onChange={(e) => fromInput(e.target.value) && save({ ...loc, lastFrost: fromInput(e.target.value)! })} />
            </label>
            <label className="field">
              <span className="lbl">{t('Első őszi fagy', 'First autumn frost')}</span>
              <input type="date" value={toInput(loc.firstFrost)} onChange={(e) => fromInput(e.target.value) && save({ ...loc, firstFrost: fromInput(e.target.value)! })} />
            </label>
          </div>
        </>
      )}
      <p className="mono muted">
        {t(
          `${loc.name}: utolsó fagy átlagosan ${fmt(loc.lastFrost)}, első fagy ${fmt(loc.firstFrost)} körül. Sokéves, kerekített átlag, tájékoztató érték; a menetrend fagyfigyelmeztetései és a látványterv-leírás ezt használják. Az év nem számít.`,
          `${loc.name}: last frost on average around ${fmt(loc.lastFrost)}, first frost around ${fmt(loc.firstFrost)}. A rounded long-term average, for information only; the schedule’s frost notes and the visualisation brief use it. The year does not matter.`,
        )}
      </p>
    </fieldset>
  );
}
