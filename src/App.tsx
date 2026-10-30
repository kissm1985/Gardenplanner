import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { PlanCanvas, SNAP_CM } from './canvas/PlanCanvas';
import { evaluate, partition } from './engine/rules';
import { ORIENTATION_LABEL } from './model/types';
import { activeVariant, selectCurrentArea, selectItems, useProject } from './store/projectStore';
import { useUi, type Layers, type Tool } from './store/uiStore';
import { AreasPanel } from './ui/AreasPanel';
import { FIXTURE_LABEL, FixturesPanel } from './ui/FixturesPanel';
import { PlantDbPanel } from './ui/PlantDbPanel';
import { PlantFilterForm } from './ui/PlantFilterForm';
import { PlantPalette } from './ui/PlantPalette';
import { Coach, introDone } from './ui/Coach';
import { CompareView } from './ui/CompareView';
import { ListView } from './ui/ListView';
import { SchedulePage } from './ui/SchedulePage';
import { ShapeEditBar } from './ui/ShapeEditBar';
import { PrintView } from './ui/PrintView';
import { ProjectPanel, type Orientation } from './ui/ProjectPanel';
import { FourSeasons, SeasonPanel } from './ui/SeasonPanel';
import { ItemProps, SelectionBar } from './ui/Selection';
import { Sheet } from './ui/Sheet';
import { VariantsPanel } from './ui/VariantsPanel';
import { IdeaPanel } from './ui/IdeaPanel';
import { ReplacePanel } from './ui/ReplacePanel';
import { HelpPanel } from './ui/HelpPanel';
import { helpId, type HelpKey } from './ui/helpSections';
import { getLang, labels, setLang, t, type Lang } from './i18n';
import { FixtureTools } from './ui/FixtureTools';
import { WarningsPanel } from './ui/WarningsPanel';
import { LogoMark } from './ui/Logo';
import { Welcome } from './ui/Welcome';

// Tools arrive phase by phase (SPEC §7); unavailable ones are shown but disabled.
const TOOL_LABEL = labels<Tool>({
  select: ['Kijelölés', 'Select'],
  plant: ['Növény', 'Plant'],
  drift: ['Folt', 'Drift'],
  row: ['Sor', 'Row'],
  fixtures: ['Elemek', 'Elements'],
  season: ['Évszak', 'Season'],
  list: ['Lista', 'List'],
});
const TOOLS: { id: Tool; icon: string; ready: boolean }[] = [
  { id: 'select', icon: '↖', ready: true },
  { id: 'plant', icon: '✿', ready: true },
  { id: 'drift', icon: '⬭', ready: true },
  { id: 'row', icon: '⋯', ready: true },
  { id: 'fixtures', icon: '▦', ready: true },
  { id: 'season', icon: '◐', ready: true },
  { id: 'list', icon: '☰', ready: true },
];

/** Which chapter of the guide the help opens at, by the active tool. */
const HELP_SECTION: Partial<Record<Tool, HelpKey>> = {
  plant: 'placing',
  drift: 'placing',
  row: 'placing',
  fixtures: 'fixtures',
  season: 'season',
  list: 'list',
};

const LAYER_LABELS: Record<keyof Layers, string> = labels({
  background: ['Háttérkép', 'Background image'],
  warnings: ['Figyelmeztetések', 'Warnings'],
  plants: ['Növények', 'Plants'],
  spacing: ['Tőtáv-körök', 'Spacing circles'],
  grid: ['Rácsháló', 'Grid'],
  fixtures: ['Rögzített elemek', 'Fixed elements'],
  zones: ['Juglone-zóna', 'Juglone zone'],
  dimensions: ['Méretvonalak', 'Dimensions'],
});

type SheetId = null | 'areas' | 'view' | 'plantdb' | 'props' | 'warnings' | 'fixtures' | 'variants' | 'project' | 'filters' | 'ideas' | 'replace' | 'help';

export function App({ loading }: { loading: boolean }) {
  const project = useProject((s) => s.project);
  const area = useProject(selectCurrentArea);
  const canUndo = useProject((s) => s.past.length > 0);
  const canRedo = useProject((s) => s.future.length > 0);
  const tool = useUi((s) => s.tool);
  const lasso = useUi((s) => s.lasso);
  const snapOn = useUi((s) => s.snap);
  const layers = useUi((s) => s.layers);
  const driftPattern = useUi((s) => s.driftPattern);
  const rowMode = useUi((s) => s.rowMode);
  const total = useProject((s) => selectItems(s).reduce((n, i) => n + (i.kind === 'plant' ? 1 : i.count), 0));
  const [sheet, setSheet] = useState<SheetId>(null);
  const [replaceFrom, setReplaceFrom] = useState<string | undefined>(undefined);
  // Undo/redo (or a split) can remove selected items: keep only those that still exist.
  useEffect(
    () =>
      useProject.subscribe((st) => {
        const sel = useUi.getState().selected;
        if (!sel.length) return;
        const ids = new Set(selectItems(st).map((i) => i.id));
        const live = sel.filter((id) => ids.has(id));
        if (live.length !== sel.length) useUi.getState().select(live);
      }),
    [],
  );

  // A zone drawn on the plan goes straight back to the idea panel, which fills it.
  const zoneDraft = useUi((s) => s.zoneDraft);
  useEffect(() => {
    if (zoneDraft) setSheet('ideas');
  }, [zoneDraft]);
  const [helpAt, setHelpAt] = useState<string | undefined>(undefined);
  const openHelp = (key?: HelpKey) => {
    setHelpAt(key && helpId(key));
    setSheet('help');
  };
  const openReplace = (code?: string) => {
    setReplaceFrom(code);
    setSheet('replace');
  };
  const items = useProject(selectItems);
  const selectedFixture = useUi((s) => s.selectedFixture);
  const fourUp = useUi((s) => s.tool === 'season' && s.fourUp);
  const compare = useUi((s) => s.compare);
  const page = useUi((s) => s.page);
  const shapeEditing = useUi((s) => !!s.shapeEdit);
  const [print, setPrint] = useState<Orientation | null>(null);
  const [coach, setCoach] = useState(() => !introDone());

  // Ctrl+P / browser print menu also gets the print document (portrait by default).
  // Once requested it stays mounted; it is hidden on screen by the print stylesheet.
  useEffect(() => {
    const before = () => flushSync(() => setPrint((o) => o ?? 'portrait'));
    window.addEventListener('beforeprint', before);
    return () => window.removeEventListener('beforeprint', before);
  }, []);
  const startPrint = (o: Orientation) => {
    setSheet(null);
    flushSync(() => setPrint(o));
    // Give the dialog close a frame, then open the system print dialog (PDF on phones).
    requestAnimationFrame(() => window.print());
  };

  // Rule engine: re-runs after every change of the area, its items, plants or settings.
  const { active: warnings, muted } = useMemo(() => {
    if (!area || !project) return { active: [], muted: [] };
    return partition(evaluate(area, items, project.plantDb, project.settings), activeVariant(area).muted);
  }, [area, items, project]);
  const errors = warnings.filter((w) => w.severity === 'error').length;

  // Desktop keyboard shortcuts for undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).closest('input,textarea,select,dialog')) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) useProject.getState().undo();
      else if (k === 'y' || (k === 'z' && e.shiftKey)) useProject.getState().redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) return <div className="splash">{t('Betöltés…', 'Loading…')}</div>;
  if (!project) return <Welcome />;

  const ui = useUi.getState();

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-brand" title="Gardenly">
          <LogoMark size={26} />
        </span>
        <button type="button" className="area-switch" onClick={() => setSheet('areas')} aria-haspopup="dialog">
          <span className="area-name">{area ? area.name : t('Nincs terület', 'No area')}</span>
          {area && (
            <span className="area-meta mono">
              {area.widthCm} × {area.lengthCm} cm · <b className="meta-count">{t(`${total} tő`, `${total} plants`)}</b> · {ORIENTATION_LABEL[area.orientation]}
              {area.sunUntil && ` · ${area.sunUntil}`}
            </span>
          )}
        </button>
        <div className="top-actions">
          <button type="button" className="icon-btn" onClick={() => useProject.getState().undo()} disabled={!canUndo} aria-label={t('Visszavonás', 'Undo')}>
            ↶
          </button>
          <button type="button" className="icon-btn" onClick={() => useProject.getState().redo()} disabled={!canRedo} aria-label={t('Újra', 'Redo')}>
            ↷
          </button>
          <button type="button" className="icon-btn" onClick={() => setSheet('view')} aria-label={t('Nézet és rétegek', 'View and layers')}>
            ◫
          </button>
          <button type="button" className="icon-btn help-btn" onClick={() => openHelp(HELP_SECTION[tool])} aria-label={t('Súgó: felhasználói útmutató', 'Help: user guide')}>
            ?
          </button>
          <button type="button" className="icon-btn" onClick={() => setSheet('project')} aria-label={t('Projekt: mentés, megosztás, nyomtatás', 'Project: save, share, print')}>
            ⋯
          </button>
          <button
            type="button"
            className={`warn-badge${warnings.length === 0 ? ' is-ok' : errors ? ' is-error' : ''}`}
            onClick={() => setSheet('warnings')}
            aria-label={t(`${warnings.length} figyelmeztetés`, `${warnings.length} warnings`)}
          >
            {warnings.length}
          </button>
        </div>
      </header>

      <main className={`stage${page || tool === 'list' || fourUp || (compare && area) ? ' stage-scroll' : ''}`}>
        {page === 'schedule' ? (
          <SchedulePage />
        ) : tool === 'list' ? (
          <ListView />
        ) : compare && area ? (
          <CompareView area={area} />
        ) : fourUp && area ? (
          <FourSeasons area={area} plantDb={project.plantDb} showMature={project.settings.showMatureSize} />
        ) : area ? (
          <>
            <PlanCanvas area={area} settings={project.settings} plantDb={project.plantDb} warnings={warnings} />
            <button type="button" className="variant-pill" onClick={() => setSheet('variants')} aria-label={t(`Változat: ${activeVariant(area).name}. Változatok kezelése`, `Variant: ${activeVariant(area).name}. Manage variants`)}>
              {activeVariant(area).name}
              {activeVariant(area).id === area.chosenVariantId ? ' ★' : ''}
              {area.variants.length > 1 ? <span className="mono"> · {area.variants.length}</span> : null} ▾
            </button>
            {shapeEditing && <ShapeEditBar />}
            {tool === 'select' && !shapeEditing && (
              <div className="stage-tools" role="toolbar" aria-label={t('Kijelölés módja', 'Selection mode')}>
                <button type="button" className="chip-btn" aria-pressed={lasso} onClick={() => ui.setLasso(!lasso)}>
                  {t('Lasszó', 'Lasso')}
                </button>
                <button type="button" className="chip-btn" aria-pressed={snapOn} onClick={() => ui.setSnap(!snapOn)} title={t(`Igazítás ${SNAP_CM} cm-es rácsra`, `Snap to a ${SNAP_CM} cm grid`)}>
                  {t('Mágnes', 'Snap')}
                </button>
              </div>
            )}
            {tool === 'plant' && (
              <div className="stage-tools" role="toolbar" aria-label={t('Elhelyezés', 'Placing')}>
                <button type="button" className="chip-btn" aria-pressed={snapOn} onClick={() => ui.setSnap(!snapOn)} title={t(`Igazítás ${SNAP_CM} cm-es rácsra`, `Snap to a ${SNAP_CM} cm grid`)}>
                  {t('Mágnes', 'Snap')}
                </button>
              </div>
            )}
            {tool === 'drift' && (
              <div className="stage-tools" role="toolbar" aria-label={t('Folt kiosztása', 'Drift layout')}>
                <button type="button" className="chip-btn" aria-pressed={driftPattern === 'staggered'} onClick={() => ui.setDriftPattern('staggered')}>
                  {t('Eltolt rács', 'Staggered')}
                </button>
                <button type="button" className="chip-btn" aria-pressed={driftPattern === 'grid'} onClick={() => ui.setDriftPattern('grid')}>
                  {t('Négyzetes', 'Grid')}
                </button>
              </div>
            )}
            {tool === 'row' && (
              <div className="stage-tools" role="toolbar" aria-label={t('Sor fajtája', 'Row type')}>
                <button type="button" className="chip-btn" aria-pressed={rowMode === 'line'} onClick={() => ui.setRowMode('line')}>
                  {t('Egyenes', 'Straight')}
                </button>
                <button type="button" className="chip-btn" aria-pressed={rowMode === 'curve'} onClick={() => ui.setRowMode('curve')}>
                  {t('Ív', 'Curve')}
                </button>
                <button type="button" className="chip-btn" aria-pressed={snapOn} onClick={() => ui.setSnap(!snapOn)}>
                  {t('Mágnes', 'Snap')}
                </button>
              </div>
            )}
            {tool === 'select' && <SelectionBar onProps={() => setSheet('props')} onReplace={openReplace} />}
            {(tool === 'select' || tool === 'fixtures') && selectedFixture && area.fixtures.some((x) => x.id === selectedFixture) && (
              <FixtureBar id={selectedFixture} label={(() => {
                const f = area.fixtures.find((x) => x.id === selectedFixture);
                return f ? f.label || FIXTURE_LABEL[f.type] : '';
              })()} onProps={() => setSheet('fixtures')} />
            )}
          </>
        ) : (
          <div className="empty-stage">
            <p>{t('Még nincs területed. Hozz létre egyet, és kezdjük a rajzolást.', 'You have no area yet. Create one and start drawing.')}</p>
            <button type="button" className="btn btn-primary" onClick={() => setSheet('areas')}>
              {t('Terület hozzáadása', 'Add an area')}
            </button>
          </div>
        )}
      </main>

      {(tool === 'plant' || tool === 'drift' || tool === 'row') && area && !page && !compare && <PlantPalette onOpenDb={() => setSheet('plantdb')} onOpenFilters={() => setSheet('filters')} />}
      {tool === 'fixtures' && area && !page && !compare && !shapeEditing && <FixtureTools onList={() => setSheet('fixtures')} />}
      {tool === 'season' && area && !page && !compare && <SeasonPanel area={area} plantDb={project.plantDb} />}

      <nav className="toolbar" aria-label={t('Eszközök', 'Tools')}>
        {TOOLS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className="tool"
            aria-pressed={tool === tb.id}
            disabled={!tb.ready}
            title={TOOL_LABEL[tb.id]}
            onClick={() => ui.setTool(tb.id)}
          >
            <span className="tool-icon" aria-hidden="true">
              {tb.icon}
            </span>
            <span className="tool-label">{TOOL_LABEL[tb.id]}</span>
          </button>
        ))}
      </nav>

      <Sheet open={sheet === 'areas'} onHelp={() => openHelp('areas')} title={t('Területek', 'Areas')} onClose={() => setSheet(null)}>
        <AreasPanel onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'plantdb'} onHelp={() => openHelp('db')} title={t('Növényadatbázis', 'Plant database')} onClose={() => setSheet(null)}>
        <PlantDbPanel />
      </Sheet>
      <Sheet open={sheet === 'props'} onHelp={() => openHelp('select')} title={t('Tulajdonságok', 'Properties')} onClose={() => setSheet(null)}>
        <ItemProps plantDb={project.plantDb} onDone={() => setSheet(null)} onReplace={openReplace} />
      </Sheet>
      <Sheet open={sheet === 'project'} onHelp={() => openHelp('project')} title={t('Projekt', 'Project')} onClose={() => setSheet(null)}>
        <ProjectPanel
          onPrint={startPrint}
          onIntro={() => {
            setSheet(null);
            setCoach(true);
          }}
          onDone={() => setSheet(null)}
        />
      </Sheet>
      {coach && !sheet && <Coach onClose={() => setCoach(false)} />}
      {print && <PrintView project={project} orientation={print} />}
      <Sheet open={sheet === 'filters'} onHelp={() => openHelp('db')} title={t('Növényszűrők', 'Plant filters')} onClose={() => setSheet(null)}>
        <div className="form">
          <PlantFilterForm />
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => setSheet(null)}>
              {t('Kész', 'Done')}
            </button>
          </div>
        </div>
      </Sheet>
      <Sheet open={sheet === 'variants'} onHelp={() => openHelp('variants')} title={t('Változatok', 'Variants')} onClose={() => setSheet(null)}>
        <VariantsPanel onDone={() => setSheet(null)} onIdeas={() => setSheet('ideas')} onReplace={() => openReplace()} />
      </Sheet>
      <Sheet open={sheet === 'help'} title={t('Súgó', 'Help')} onClose={() => setSheet(null)} wide>
        <HelpPanel section={helpAt} />
      </Sheet>
      <Sheet open={sheet === 'replace'} onHelp={() => openHelp('replace')} title={t('Növény cseréje', 'Replace plants')} onClose={() => setSheet(null)}>
        <ReplacePanel key={replaceFrom ?? ''} from={replaceFrom} onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'ideas'} onHelp={() => openHelp('ideas')} title={t('Ötletgenerátor', 'Idea generator')} onClose={() => setSheet(null)}>
        <IdeaPanel onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'warnings'} onHelp={() => openHelp('warnings')} title={t(`Figyelmeztetések (${warnings.length})`, `Warnings (${warnings.length})`)} onClose={() => setSheet(null)}>
        <WarningsPanel active={warnings} muted={muted} onJump={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'fixtures'} onHelp={() => openHelp('fixtures')} title={t('Rögzített elemek', 'Fixed elements')} onClose={() => setSheet(null)}>
        <FixturesPanel onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'view'} onHelp={() => openHelp('screen')} title={t('Nézet', 'View')} onClose={() => setSheet(null)}>
        <div className="form">
          <fieldset className="field-group">
            <legend>{t('Rétegek', 'Layers')}</legend>
            {(Object.keys(LAYER_LABELS) as (keyof Layers)[]).map((k) => (
              <label key={k} className="check">
                <input type="checkbox" checked={layers[k]} onChange={(e) => ui.setLayer(k, e.target.checked)} />
                <span>{LAYER_LABELS[k]}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="field-group">
            <legend>{t('Növények mérete', 'Plant size')}</legend>
            <div className="seg">
              <label className="seg-item">
                <input
                  type="radio"
                  name="size"
                  checked={project.settings.showMatureSize}
                  onChange={() => useProject.getState().updateSettings({ showMatureSize: true })}
                />
                <span>{t('kifejlett', 'mature')}</span>
              </label>
              <label className="seg-item">
                <input
                  type="radio"
                  name="size"
                  checked={!project.settings.showMatureSize}
                  onChange={() => useProject.getState().updateSettings({ showMatureSize: false })}
                />
                <span>{t('ültetéskori', 'at planting')}</span>
              </label>
            </div>
          </fieldset>
          <label className="check">
            <input
              type="checkbox"
              checked={project.settings.wikiPhotos !== false}
              onChange={(e) => useProject.getState().updateSettings({ wikiPhotos: e.target.checked })}
            />
            <span>{t('Növényfotók a Wikipédiáról (első alkalommal internet kell)', 'Plant photos from Wikipedia (needs internet the first time)')}</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={snapOn} onChange={(e) => ui.setSnap(e.target.checked)} />
            <span>{t(`Mágnesezés ${SNAP_CM} cm-es rácsra`, `Snap to a ${SNAP_CM} cm grid`)}</span>
          </label>
          <div className="form-actions form-actions-start">
            <button type="button" className="btn" onClick={() => setSheet('plantdb')}>
              {t('Növényadatbázis', 'Plant database')}
            </button>
            <button type="button" className="btn" onClick={() => setSheet('fixtures')}>
              {t('Rögzített elemek', 'Fixed elements')}
            </button>
            <button type="button" className="btn" onClick={() => setSheet('ideas')}>
              {t('✦ Ötletgenerátor', '✦ Idea generator')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                ui.setPage('schedule');
                setSheet(null);
              }}
            >
              {t('Menetrend és gondozás', 'Schedule and care')}
            </button>
          </div>
          <fieldset className="field-group">
            <legend>{t('Nyelv', 'Language')}</legend>
            <div className="seg">
              {(['hu', 'en'] as Lang[]).map((l) => (
                <label key={l} className="seg-item">
                  <input type="radio" name="lang" checked={getLang() === l} onChange={() => setLang(l)} />
                  <span>{l === 'hu' ? 'Magyar' : 'English'}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Sheet>
    </div>
  );
}

function FixtureBar({ id, label, onProps }: { id: string; label: string; onProps: () => void }) {
  return (
    <div className="selbar" role="toolbar" aria-label={t('Kijelölt elem', 'Selected element')}>
      <span className="selbar-count mono">{label}</span>
      <button type="button" className="btn btn-small" onClick={onProps}>
        {t('Adatok', 'Details')}
      </button>
      <button
        type="button"
        className="btn btn-small btn-danger"
        onClick={() => {
          useProject.getState().deleteFixture(id);
          useUi.getState().selectFixture(null);
        }}
      >
        {t('Törlés', 'Delete')}
      </button>
      <button type="button" className="icon-btn" onClick={() => useUi.getState().selectFixture(null)} aria-label={t('Kijelölés megszüntetése', 'Clear selection')}>
        ×
      </button>
    </div>
  );
}
