import { useState } from 'react';
import { AREA_TEMPLATES } from '../data/templates';
import { getLang, setLang, t } from '../i18n';
import { useProject } from '../store/projectStore';

/** First launch: offer the two starting templates (SPEC §4.1). */
export function Welcome() {
  const [picked, setPicked] = useState<string[]>(AREA_TEMPLATES.map((tp) => tp.key));
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const other = getLang() === 'hu' ? 'en' : 'hu';
  return (
    <main className="welcome">
      <div className="welcome-top">
        <div className="eyebrow">{t('Kerttervező', 'Garden planner')}</div>
        <button type="button" className="btn btn-small" onClick={() => setLang(other)} lang={other}>
          {other === 'en' ? 'English' : 'Magyar'}
        </button>
      </div>
      <h1>{t('Tervezzük meg a kertet', "Let's plan the garden")}</h1>
      <p className="lead">
        {t(
          'Rajzold meg a területet, húzd rá a növényeket, és az app összeállítja a listát. Minden adat ezen a készüléken marad.',
          'Draw the area, drag the plants onto it, and the app puts the list together. All data stays on this device.',
        )}
      </p>
      <h2 className="sub-h">{t('Mivel kezdjünk?', 'How shall we start?')}</h2>
      <div className="tpl-list">
        {AREA_TEMPLATES.map((tp) => (
          <label key={tp.key} className={`tpl tpl-check${picked.includes(tp.key) ? ' is-on' : ''}`}>
            <input type="checkbox" checked={picked.includes(tp.key)} onChange={() => toggle(tp.key)} />
            <b>{tp.title}</b>
            <small>{tp.summary}</small>
          </label>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-primary btn-wide" onClick={() => useProject.getState().createProject(picked)}>
          {picked.length ? t('Kezdés a kiválasztott sablonokkal', 'Start with the chosen templates') : t('Kezdés üres projekttel', 'Start with an empty project')}
        </button>
      </div>
    </main>
  );
}
