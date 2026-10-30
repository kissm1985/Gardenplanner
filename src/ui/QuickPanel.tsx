import { useMemo, useState } from 'react';
import { t } from '../i18n';

export interface QuickAction {
  id: string;
  label: string;
  /** One line on what it is for. */
  hint: string;
  /** Extra search words. */
  words?: string;
  run: () => void;
}

export interface Step {
  id: string;
  label: string;
  done: boolean;
  run: () => void;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Every feature in one searchable list, and the first-plan checklist until it is done. */
export function QuickPanel({ actions, steps }: { actions: QuickAction[]; steps: Step[] }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return actions.filter((a) => words.every((w) => norm(`${a.label} ${a.hint} ${a.words ?? ''}`).includes(w)));
  }, [actions, q]);
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="form quick-panel">
      {done < steps.length && !q && (
        <fieldset className="field-group">
          <legend>{t(`Az első terv lépései · ${done}/${steps.length}`, `Steps of a first plan · ${done}/${steps.length}`)}</legend>
          <ol className="quick-steps">
            {steps.map((s) => (
              <li key={s.id} className={s.done ? 'is-done' : ''}>
                <span className="quick-check" aria-hidden="true">
                  {s.done ? '✓' : ''}
                </span>
                <span className="quick-step-label">{s.label}</span>
                {!s.done && (
                  <button type="button" className="btn btn-small" onClick={s.run}>
                    {t('Mehet', 'Go')}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </fieldset>
      )}
      <input type="search" className="palette-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Mit szeretnél csinálni? (pl. csere, kép, mentés)', 'What do you want to do? (e.g. replace, image, backup)')} aria-label={t('Művelet keresése', 'Search actions')} autoFocus />
      <ul className="quick-list">
        {shown.map((a) => (
          <li key={a.id}>
            <button type="button" className="quick-item" onClick={a.run}>
              <b>{a.label}</b>
              <span className="mono muted">{a.hint}</span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="mono muted">{t('Nincs ilyen művelet. Próbálj más szót, vagy nézd meg a súgót.', 'No such action. Try another word, or see the help.')}</li>}
      </ul>
    </div>
  );
}
