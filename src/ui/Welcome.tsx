import { lazy, Suspense, useEffect, useState } from 'react';
import { ConsentBanner } from './ConsentBanner';
import { roomForArea, roomForProject } from './Locked';
import { AREA_TEMPLATES } from '../data/templates';
import { getLang, setLang, t } from '../i18n';
import { localName } from '../i18n/names';
import { activeVariant, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { duplicateProject, newProject, openProject, removeProject, renameProject, useProjects } from '../store/projects';
import type { ProjectMeta } from '../store/persist';
import { AUTHOR, copyrightLine } from './About';

import { Logo } from './Logo';
import { toggleTheme, useTheme } from './theme';

// The example plans (data and thumbnails) load right after the start page.
const ExamplePlans = lazy(() => import('./ExamplePlans').then((m) => ({ default: m.ExamplePlans })));
const ExampleSizeSheet = lazy(() => import('./ExampleSize').then((m) => ({ default: m.ExampleSizeSheet })));
const LegalPanel = lazy(() => import('./LegalPanel').then((m) => ({ default: m.LegalPanel })));

const plants = (n: number) => t(`${n} tő`, `${n} plants`);

/** "today", "yesterday", "3 days ago", or the date. */
export function ago(ms: number, now = Date.now()): string {
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return t('ma', 'today');
  if (days === 1) return t('tegnap', 'yesterday');
  if (days < 14) return t(`${days} napja`, `${days} days ago`);
  return new Date(ms).toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'hu-HU');
}

/**
 * Start page, on every launch and from the logo. Returning: "Continue" first, then a new area, the areas of the
 * open project, the other projects, the examples in a strip and the templates. First visit: a new area, the
 * examples and the templates.
 */
export function Welcome({ onHelp }: { onHelp: () => void }) {
  const project = useProject((s) => s.project);
  const [picked, setPicked] = useState<string[]>(AREA_TEMPLATES.map((tp) => tp.key));
  const [legalOpen, setLegalOpen] = useState(false);
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
    if (project && !roomForArea()) return;
    ui.setStartWithNewArea(true);
    if (!project) st.createProject([]);
    ui.setHome(false);
  };
  const projects = useProjects((s) => s.list);
  useEffect(() => {
    void useProjects.getState().refresh();
  }, []);
  const [allExamples, setAllExamples] = useState(false);
  const [pickExample, setPickExample] = useState<string | null>(null);
  const currentArea = project?.areas.find((a) => a.id === st.currentAreaId) ?? project?.areas[0];
  const returning = !!currentArea;

  return (
    <main className="welcome">
      <div className="welcome-top">
        <span />
        <span className="welcome-switches">
          <button type="button" className="btn btn-small welcome-help" onClick={onHelp} aria-label={t('Súgó: felhasználói útmutató', 'Help: user guide')}>
            ?
          </button>
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

      <ConsentBanner />

      {returning && currentArea && (
        <button type="button" className="tpl home-continue" onClick={() => open(currentArea.id)}>
          <b>
            {t('Folytatás', 'Continue')}: {localName(currentArea.name)} ›
          </b>
          <small>
            {localName(project!.name)} · {localName(activeVariant(currentArea).name)} ·{' '}
            {plants(activeVariant(currentArea).items.reduce((n, it) => n + (it.kind === 'plant' ? 1 : it.count), 0))}
            {projects.find((m) => m.id === project!.id) ? ` · ${ago(projects.find((m) => m.id === project!.id)!.updatedAt)}` : ''}
          </small>
        </button>
      )}

      <button type="button" className="tpl tpl-own" onClick={newArea}>
        <b>{t('+ Új terület létrehozása', '+ Create a new area')}</b>
        <small>
          {t(
            'Üres területtel kezdesz: megadod a nevét, méretét, fekvését és napsütését; téglalap, kör vagy a rajzon körberajzolt szabad alak.',
            'Start with an empty area: give its name, size, facing and sun; a rectangle, a circle or a free shape drawn on the plan.',
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

      {projects.length > 0 && <ProjectList list={projects} currentId={project?.id} onOpen={() => ui.setHome(false)} />}

      <h2 className="sub-h">{t('Példatervek', 'Example plans')}</h2>
      <p className="muted example-lead">
        {t(
          'Kész, beültetett tervek ötletnek. Koppints egyre: új területként kerül a projektedbe, és szabadon átalakíthatod.',
          'Finished, planted plans for inspiration. Tap one: it is added to your project as a new area, and you can change anything.',
        )}
      </p>
      <Suspense fallback={<p className="mono muted">{t('Példatervek betöltése…', 'Loading examples…')}</p>}>
        <ExamplePlans
          strip={returning && !allExamples}
          onPick={(key) => {
            if (project && !roomForArea()) return;
            setPickExample(key);
          }}
        />
        <ExampleSizeSheet
          exampleKey={pickExample}
          onClose={() => setPickExample(null)}
          onAdd={async (key, size) => {
            const { addExampleArea } = await import('../store/exampleActions');
            const id = addExampleArea(key, size);
            if (id) open(id);
          }}
        />
      </Suspense>
      {returning && (
        <button type="button" className="btn btn-small example-all" onClick={() => setAllExamples((v) => !v)}>
          {allExamples ? t('Kevesebb példa', 'Fewer examples') : t('Összes példa ›', 'All examples ›')}
        </button>
      )}

      <h2 className="sub-h">{project ? t('Kezdés mintából (üres sablon)', 'Start from a template (empty)') : t('Vagy kezdj kész sablonokkal', 'Or start with ready templates')}</h2>
      {project ? (
        <div className="tpl-list">
          {AREA_TEMPLATES.map((tp) => (
            <button
              key={tp.key}
              type="button"
              className="tpl"
              onClick={() => {
                if (!roomForArea()) return;
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
      <details className="welcome-legal" onToggle={(e) => setLegalOpen(e.currentTarget.open)}>
        <summary>{t('Felhasználási feltételek és adatvédelem', 'Terms of use and privacy')}</summary>
        {legalOpen && (
          <Suspense fallback={<p className="mono muted">{t('Betöltés…', 'Loading…')}</p>}>
            <LegalPanel />
          </Suspense>
        )}
      </details>
    </main>
  );
}

/** The projects on this device: open, rename, copy, delete; and a new empty project. */
function ProjectList({ list, currentId, onOpen }: { list: ProjectMeta[]; currentId?: string; onOpen: () => void }) {
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <>
      <h2 className="sub-h">{t('Projektjeid', 'Your projects')}</h2>
      <ul className="tpl-list home-projects">
        {list.map((m) => (
          <li key={m.id} className="home-project-row">
            {editing === m.id ? (
              <form
                className="home-project-edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = new FormData(e.currentTarget).get('name');
                  void renameProject(m.id, String(v ?? ''));
                  setEditing(null);
                }}
              >
                <input name="name" defaultValue={localName(m.name)} aria-label={t('Projekt neve', 'Project name')} autoFocus />
                <button type="submit" className="btn btn-small btn-primary">
                  {t('Mentés', 'Save')}
                </button>
              </form>
            ) : (
              <button
                type="button"
                className={`tpl home-project${m.id === currentId ? ' is-current' : ''}`}
                onClick={async () => {
                  if (await openProject(m.id)) onOpen();
                }}
              >
                <b>
                  {localName(m.name)}
                  {m.id === currentId ? t(' · megnyitva', ' · open') : ''}
                </b>
                <small>
                  {t(`${m.areas} terület`, `${m.areas} ${m.areas === 1 ? 'area' : 'areas'}`)} · {plants(m.plants)} · {ago(m.updatedAt)}
                </small>
              </button>
            )}
            <button
              type="button"
              className="icon-btn home-project-more"
              aria-label={t(`Műveletek: ${m.name}`, `Actions: ${m.name}`)}
              aria-expanded={menu === m.id}
              onClick={() => setMenu(menu === m.id ? null : m.id)}
            >
              ⋯
            </button>
            {menu === m.id && (
              <div className="home-project-menu">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    setEditing(m.id);
                    setMenu(null);
                  }}
                >
                  {t('Átnevezés', 'Rename')}
                </button>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    void duplicateProject(m.id, t('(másolat)', '(copy)'));
                    setMenu(null);
                  }}
                >
                  {t('Másolás', 'Duplicate')}
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => {
                    if (
                      confirm(
                        t(
                          `Törlöd a(z) „${m.name}” projektet erről a készülékről? Ez nem vonható vissza.`,
                          `Delete the project “${m.name}” from this device? This cannot be undone.`,
                        ),
                      )
                    )
                      void removeProject(m.id);
                    setMenu(null);
                  }}
                >
                  {t('Törlés', 'Delete')}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-small home-new-project"
        onClick={async () => {
          if (!roomForProject(list.length)) return;
          await newProject([]);
          useUi.getState().setStartWithNewArea(true);
          onOpen();
        }}
      >
        {t('+ Új projekt', '+ New project')}
      </button>
    </>
  );
}
