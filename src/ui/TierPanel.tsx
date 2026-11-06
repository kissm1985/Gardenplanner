// Choosing the tier, with what each tier has. No payments yet: the choice is free and kept on this device.
import { t } from '../i18n';
import { ALAP_CODES, ALAP_LIMITS, FEATURE_LABEL, FEATURE_TIER, hasFeature, setTier, TIER_LABEL, TIERS, useTier, type Feature, type Tier } from '../model/tier';

const BLURB: Record<Tier, () => string> = {
  alap: () =>
    t(
      `Ingyenes belépő: kb. ${ALAP_CODES.size} gyakori faj, ${ALAP_LIMITS.projects} projekt, ${ALAP_LIMITS.areas} terület, tő és folt.`,
      `Free start: about ${ALAP_CODES.size} common species, ${ALAP_LIMITS.projects} project, ${ALAP_LIMITS.areas} areas, plants and drifts.`,
    ),
  halado: () =>
    t(
      'A teljes alkalmazás a teljes növénylistával: változatok, látványterv, export, menetrend.',
      'The full app with the whole plant list: variants, visualisation, exports, schedule.',
    ),
  profi: () =>
    t(
      'Kertészeteknek: a Haladó mellett saját katalógus és árak, saját fejlécű PDF, ajánlatkérés.',
      'For nurseries: Advanced plus their own catalogue and prices, PDFs with their header, quote requests.',
    ),
};

export function TierPanel() {
  const tier = useTier();
  const features = Object.keys(FEATURE_TIER) as Feature[];
  return (
    <fieldset className="field-group tier-panel">
      <legend>{t('Csomag', 'Tier')}</legend>
      <div className="tier-choices" role="radiogroup" aria-label={t('Csomag', 'Tier')}>
        {TIERS.map((x) => (
          <label key={x} className={`tier-choice${x === tier ? ' is-on' : ''}`}>
            <input type="radio" name="tier" checked={x === tier} onChange={() => setTier(x)} />
            <b>{TIER_LABEL[x]}</b>
            <small>{BLURB[x]()}</small>
          </label>
        ))}
      </div>
      <details>
        <summary>{t('Mi van az egyes csomagokban?', 'What is in each tier?')}</summary>
        <table className="tier-table">
          <thead>
            <tr>
              <th>{t('Funkció', 'Feature')}</th>
              {TIERS.map((x) => (
                <th key={x}>{TIER_LABEL[x]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f}>
                <td>{FEATURE_LABEL[f]}</td>
                {TIERS.map((x) => (
                  <td key={x} className="c">
                    {hasFeature(f, x) ? '✓' : '–'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="mono muted">
        {t(
          'Fizetés még nincs: a csomag szabadon választható; a terveid csomagváltáskor sem vesznek el.',
          'No payments yet: choose freely; your plans are kept whatever tier you pick.',
        )}
      </p>
    </fieldset>
  );
}
