import { useState } from 'react';
import { AREA_TEMPLATES } from '../data/templates';
import { getLang, setLang, t } from '../i18n';
import { localName } from '../i18n/names';
import { activeVariant, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { AUTHOR, copyrightLine } from './About';
import { Logo } from './Logo';
import { LegalPanel } from './LegalPanel';
import { toggleTheme, useTheme } from './theme';

const plants = (n: number) => t(`${n} tő`, `${n} plants`);

/**
 * Start page, on every launch and from the logo: a new area first, then the areas already planned,
 * then the ready-made templates.
 */
export function Welcome() {
  const project = useProject((s) => s.project);
  const [picked, setPicked] = useState<string[]>(AREA_TEMPLATES.map((tp) => tp.key));
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const other = getLang() === 'hu' ? 'en' : 'hu';
  const { dark } = useTheme();
  const ui = useUi.getState();
  const st = useProject.getState();
  const open = (areaId: string) => {
    st.selectArea(areaId);
    ui.setHome(false);
  };
  const newArea = () => {
    ui.setStartWithNewArea(true);
    if (!project) st.createProject([]);
    ui.setHome(false);
  };

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
        <Logo size={84} stacked tagline={t('KERTTERVEZŐ SZOFTVER', 'GARDEN DESIGN SOFTWARE')} />
        <p className="welcome-slogan">{t('Formáld az élő tereket.', 'Shape living spaces.')}</p>
      </div>
      <h1>{t('Tervezzük meg a kertet', "Let's plan the garden")}</h1>
      <p className="lead">
        {t(
          'Rajzold meg a területet, húzd rá a növényeket, és az app összeállítja a listát. Minden adat ezen a készüléken marad.',
          'Draw the area, drag the plants onto it, and the app puts the list together. All data stays on this device.',
        )}
      </p>

      <button type="button" className="tpl tpl-own" onClick={newArea}>
        <b>{t('+ Új terület létrehozása', '+ Create a new area')}</b>
        <small>
          {t(
            'Üres területtel kezdesz: megadod a nevét, méretét, fekvését és napsütését; téglalap vagy a rajzon körberajzolt szabad alak.',
            'Start with an empty area: give its name, size, facing and sun; a rectangle or a free shape drawn on the plan.',
          )}
        </small>
      </button>

      {project && project.areas.length > 0 && (
        <>
          <h2 className="sub-h">{t('Területeid', 'Your areas')}</h2>
          <ul className="tpl-list home-areas">
            {project.areas.map((a) => {
              const v = activeVariant(a);
              const n = v.items.reduce((s, it) => s + (it.kind === 'plant' ? 1 : it.count), 0);
              return (
                <li key={a.id}>
                  <button type="button" className="tpl home-area" onClick={() => open(a.id)}>
                    <b>{localName(a.name)}</b>
                    <small>
                      {a.widthCm} × {a.lengthCm} cm · {localName(v.name)} · {plants(n)}
                      {a.variants.length > 1 ? t(` · ${a.variants.length} változat`, ` · ${a.variants.length} variants`) : ''}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2 className="sub-h">{project ? t('Új terület sablonból', 'New area from a template') : t('Vagy kezdj kész sablonokkal', 'Or start with ready templates')}</h2>
      {project ? (
        <div className="tpl-list">
          {AREA_TEMPLATES.map((tp) => (
            <button
              key={tp.key}
              type="button"
              className="tpl"
              onClick={() => {
                const id = st.addTemplateArea(tp.key);
                if (id) open(id);
              }}
            >
              <b>+ {tp.title}</b>
              <small>{tp.summary}</small>
            </button>
          ))}
        </div>
      ) : (
        <>
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
            <button
              type="button"
              className="btn btn-primary btn-wide"
              disabled={!picked.length}
              onClick={() => {
                st.createProject(picked);
                ui.setHome(false);
              }}
            >
              {t('Kezdés a kiválasztott sablonokkal', 'Start with the chosen templates')}
            </button>
          </div>
        </>
      )}

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
