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

// Three steps to the first plant list (the goal that matters): area → plants → list.
const STEPS: { target: string; readonly title: string; readonly text: string }[] = [
  {
    target: '.area-switch',
    get title() {
      return t('1. Terület', '1. Area');
    },
    get text() {
      return t(
        'Itt a terület, amit tervezel. A kezdőoldalon kész példatervből is indulhatsz, vagy itt rajzolhatsz újat.',
        'This is the area you are planning. You can also start from a ready example on the start page, or draw a new one here.',
      );
    },
  },
  {
    target: '.toolbar [data-tool="plant"]',
    get title() {
      return t('2. Növények', '2. Plants');
    },
    get text() {
      return t(
        'Koppints a Növényre, válassz a palettáról, majd koppints a rajzra. Ha nem tudod, mit ültess, kérj ötletet (Változatok → Ötlet).',
        'Tap Plant, pick one from the palette, then tap the plan. Not sure what to plant? Ask for an idea (Variants → Idea).',
      );
    },
  },
  {
    target: '.toolbar [data-tool="list"]',
    get title() {
      return t('3. Lista', '3. List');
    },
    get text() {
      return t(
        'A Lista megmutatja, mit és mennyit kell venni, irányárral. Ezt viheted a kertészetbe.',
        'The List shows what to buy and how many, with guide prices. Take it to the nursery.',
      );
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
