import { t } from '../../i18n';
import { useProject } from '../../store/projectStore';
import { setSimpleMode, useSimpleMode } from '../simpleMode';
import { setLargeText, useLargeText } from '../textSize';

/** Simple mode and larger text (device settings, in the View window). */
export function ReadingChoices() {
  const simple = useSimpleMode();
  const large = useLargeText();
  return (
    <>
      <label className="check">
        <input type="checkbox" checked={simple} onChange={(e) => setSimpleMode(e.target.checked)} />
        <span>
          {t('Egyszerű mód', 'Simple mode')}
          <small className="mono muted"> – {t('kevesebb eszköz, a többi a „Több” gomb alatt', 'fewer tools, the rest under “More”')}</small>
        </span>
      </label>
      <label className="check">
        <input type="checkbox" checked={large} onChange={(e) => setLargeText(e.target.checked)} />
        <span>{t('Nagyobb betűk', 'Larger text')}</span>
      </label>
    </>
  );
}

/** How tree crowns are drawn on the plan. */
export function CanopyChoice() {
  const v = useProject((s) => s.project?.settings.canopy ?? 'outline');
  const opts: ['outline' | 'transparent' | 'filled', string][] = [
    ['outline', t('körvonal (alatta látszik az ágyás)', 'outline (the bed below shows)')],
    ['transparent', t('áttetsző', 'see-through')],
    ['filled', t('teli', 'filled')],
  ];
  return (
    <div className="plan-style" role="radiogroup" aria-label={t('Fák lombja', 'Tree crowns')}>
      <span className="lbl">{t('Fák lombja', 'Tree crowns')}</span>
      {opts.map(([k, label]) => (
        <label key={k} className="check">
          <input type="radio" name="canopy" checked={v === k} onChange={() => useProject.getState().updateSettings({ canopy: k })} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}
