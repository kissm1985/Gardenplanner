import { useEffect, useState } from 'react';
import { t } from '../i18n';

const KEY = 'kerttervezo:intro-done';

export function introDone(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // no storage: don't nag on every start
  }
}
function markDone() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

const STEPS: { target: string; readonly title: string; readonly text: string }[] = [
  {
    target: '.area-switch',
    get title() {
      return t('Terület kiválasztása', 'Choose the area');
    },
    get text() {
      return t(
        'Koppints a terület nevére: itt váltasz a Házoldali sáv és a Gyepsávos kert között, és itt hozol létre újat.',
        'Tap the area name: this is where you switch between areas and create new ones.',
      );
    },
  },
  {
    target: '.toolbar .tool:nth-child(2)',
    get title() {
      return t('Növény elhelyezése', 'Place a plant');
    },
    get text() {
      return t(
        'Válaszd a Növény eszközt, koppints egy növényre a palettán, aztán a rajzra. Sok tőhöz a Folt és a Sor eszköz gyorsabb.',
        'Choose the Plant tool, tap a plant in the palette, then tap the plan. For many plants the Drift and Row tools are faster.',
      );
    },
  },
  {
    target: '.toolbar .tool:last-child',
    get title() {
      return t('Lista megtekintése', 'See the list');
    },
    get text() {
      return t('A Lista mutatja a darabszámot, a rendelendő mennyiséget és a költséget; innen másolhatod Excelbe is.', 'The List shows the counts, what to order and the cost; you can copy it to Excel from there.');
    },
  },
];

/** First-start 3-step intro: area → plant → list (SPEC §5). */
export function Coach({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  useEffect(() => {
    const el = document.querySelector(step.target);
    el?.classList.add('coach-target');
    return () => el?.classList.remove('coach-target');
  }, [step.target]);
  const close = () => {
    markDone();
    onClose();
  };
  return (
    <div className={`coach coach-${i === 0 ? 'top' : 'bottom'}`} role="dialog" aria-label={t('Bevezető', 'Introduction')} aria-live="polite">
      <div className="mono muted">
        {i + 1} / {STEPS.length}
      </div>
      <h2>{step.title}</h2>
      <p>{step.text}</p>
      <div className="form-actions">
        <button type="button" className="btn btn-small" onClick={close}>
          {t('Kihagyás', 'Skip')}
        </button>
        <button type="button" className="btn btn-small btn-primary" onClick={() => (i < STEPS.length - 1 ? setI(i + 1) : close())}>
          {i < STEPS.length - 1 ? t('Tovább', 'Next') : t('Kezdjük', "Let's start")}
        </button>
      </div>
    </div>
  );
}
