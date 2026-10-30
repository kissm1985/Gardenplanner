import { useState } from 'react';
import { AREA_TEMPLATES } from '../data/templates';
import { getLang, setLang, t } from '../i18n';
import { useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { AUTHOR, copyrightLine } from './About';
import { Logo } from './Logo';
import { LegalPanel } from './LegalPanel';
import { toggleTheme, useTheme } from './theme';

/** Line icons for the four steps (24 × 24, stroked). */
const STEPS: { hu: string; en: string; d: string }[] = [
  { hu: 'Tervezés', en: 'Design', d: 'M5 19C5 10 11 5 20 4c0 9-5 15-15 15zM5 19l8-8' },
  { hu: 'Ültetés', en: 'Plant', d: 'M12 21v-9M12 12C12 8 9 5.5 4.5 5.5 4.5 9.5 7.5 12 12 12zM12 10c0-4 3-6.5 7.5-6.5 0 4-3 6.5-7.5 6.5z' },
  { hu: 'Évszakok', en: 'Seasons', d: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4' },
  { hu: 'Élvezd', en: 'Enjoy', d: 'M12 20c-4.5 0-8-3-8-7 3.5 0 6 1.5 8 4 2-2.5 4.5-4 8-4 0 4-3.5 7-8 7zM12 17c-2.2-2.5-2.2-7.5 0-11 2.2 3.5 2.2 8.5 0 11z' },
];

/** First launch: offer the two starting templates (SPEC §4.1). */
export function Welcome() {
  const [picked, setPicked] = useState<string[]>(AREA_TEMPLATES.map((tp) => tp.key));
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const other = getLang() === 'hu' ? 'en' : 'hu';
  const { dark } = useTheme();
  return (
    <main className="welcome">
      <div className="welcome-top">
        <span />
        <span className="welcome-switches">
          <button type="button" className="btn btn-small" onClick={toggleTheme} aria-label={dark ? t('Világos mód', 'Light mode') : t('Sötét mód', 'Dark mode')}>
            {dark ? '☀' : '☾'}
          </button>
          <button type="button" className="btn btn-small" onClick={() => setLang(other)} lang={other}>
            {other === 'en' ? 'English' : 'Magyar'}
          </button>
        </span>
      </div>
      <div className="welcome-brand">
        <Logo size={92} stacked tagline={t('TERVEZZ · ÜLTESS · ÉLVEZD', 'DESIGN · PLANT · ENJOY')} />
        <p className="welcome-slogan">{t('Álmaid kertje egy tervnyire van.', 'Your dream garden, one plan away.')}</p>
      </div>
      <ol className="welcome-steps">
        {STEPS.map((s) => (
          <li key={s.en}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={s.d} />
            </svg>
            {t(s.hu, s.en)}
          </li>
        ))}
      </ol>
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
      <div className="welcome-or" aria-hidden="true">
        <span>{t('vagy', 'or')}</span>
      </div>
      <button
        type="button"
        className="tpl tpl-own"
        onClick={() => {
          useUi.getState().setStartWithNewArea(true);
          useProject.getState().createProject([]);
        }}
      >
        <b>{t('+ Saját terület létrehozása', '+ Create my own area')}</b>
        <small>
          {t(
            'Megadod a nevét, méretét, fekvését és napsütését; téglalap vagy a rajzon körberajzolt szabad alak. A sablonok később is hozzáadhatók.',
            'Give its name, size, facing and sun; a rectangle or a free shape drawn on the plan. The templates can be added later too.',
          )}
        </small>
      </button>
      <p className="welcome-quote">{t('Több mint egy kert. Szebb hétköznapok.', 'More than a garden. A better everyday.')}</p>
      <p className="welcome-credit mono muted">
        {t('Készítette', 'Created by')} {AUTHOR} · {copyrightLine()}
      </p>
      <details className="welcome-legal">
        <summary>{t('Felhasználási feltételek és adatvédelem', 'Terms of use and privacy')}</summary>
        <LegalPanel />
      </details>
    </main>
  );
}
