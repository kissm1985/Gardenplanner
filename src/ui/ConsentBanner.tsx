// One-time question about anonymous statistics (only when the build has a statistics server).
import { useSyncExternalStore } from 'react';
import { t } from '../i18n';
import { analyticsConfigured, getConsent, onConsentChange, setConsent, track } from '../engine/analytics';

export function useConsent() {
  return useSyncExternalStore(onConsentChange, getConsent, getConsent);
}

export function ConsentBanner() {
  const c = useConsent();
  if (!analyticsConfigured() || c) return null;
  return (
    <div className="consent" role="region" aria-label={t('Statisztika', 'Statistics')}>
      <p>
        {t(
          'Segítenél a fejlesztésben? Névtelen használati statisztikát küldenénk (pl. „lista megnyitva”), süti, azonosító és terv nélkül. Bármikor kikapcsolhatod a Nézet ablakban.',
          'Would you help us improve? We would send anonymous usage statistics (e.g. “list opened”), with no cookies, ids or plans. You can turn it off any time in the View window.',
        )}
      </p>
      <div className="form-actions form-actions-start">
        <button
          type="button"
          className="btn btn-small btn-primary"
          onClick={() => {
            setConsent('yes');
            track('app_start');
          }}
        >
          {t('Igen, segítek', 'Yes, I’ll help')}
        </button>
        <button type="button" className="btn btn-small" onClick={() => setConsent('no')}>
          {t('Nem', 'No')}
        </button>
      </div>
    </div>
  );
}

/** Toggle in the View window. */
export function ConsentToggle() {
  const c = useConsent();
  if (!analyticsConfigured()) return null;
  return (
    <label className="check">
      <input type="checkbox" checked={c === 'yes'} onChange={(e) => setConsent(e.target.checked ? 'yes' : 'no')} />
      <span>{t('Névtelen használati statisztika és hibajelentés', 'Anonymous usage statistics and error reports')}</span>
    </label>
  );
}
