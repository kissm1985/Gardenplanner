import { useEffect, useState } from 'react';

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

const STEPS: { target: string; title: string; text: string }[] = [
  {
    target: '.area-switch',
    title: 'Terület kiválasztása',
    text: 'Koppints a terület nevére: itt váltasz a Házoldali sáv és a Gyepsávos kert között, és itt hozol létre újat.',
  },
  {
    target: '.tool[title="Növény"]',
    title: 'Növény elhelyezése',
    text: 'Válaszd a Növény eszközt, koppints egy növényre a palettán, aztán a rajzra. Sok tőhöz a Folt és a Sor eszköz gyorsabb.',
  },
  {
    target: '.tool[title="Lista"]',
    title: 'Lista megtekintése',
    text: 'A Lista mutatja a darabszámot, a rendelendő mennyiséget és a költséget; innen másolhatod Excelbe is.',
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
    <div className={`coach coach-${i === 0 ? 'top' : 'bottom'}`} role="dialog" aria-label="Bevezető" aria-live="polite">
      <div className="mono muted">
        {i + 1} / {STEPS.length}
      </div>
      <h2>{step.title}</h2>
      <p>{step.text}</p>
      <div className="form-actions">
        <button type="button" className="btn btn-small" onClick={close}>
          Kihagyás
        </button>
        <button type="button" className="btn btn-small btn-primary" onClick={() => (i < STEPS.length - 1 ? setI(i + 1) : close())}>
          {i < STEPS.length - 1 ? 'Tovább' : 'Kezdjük'}
        </button>
      </div>
    </div>
  );
}
