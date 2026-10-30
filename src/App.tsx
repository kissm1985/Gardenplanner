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
import { VisualPanel } from './ui/VisualPanel';
import { LegalPanel } from './ui/LegalPanel';
import { backupNow, lastBackupAt, needsReminder, requestPersistence, snoozeReminder, useBackupState } from './ui/backup';
import { QuickPanel, type QuickAction, type Step } from './ui/QuickPanel';
import { markSeen, seen } from './ui/seen';
import { setTheme, toggleTheme, useTheme, type Theme } from './ui/theme';
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
  camera: ['Látványterv nézőpontja (kamera)', 'Visualisation viewpoint (camera)'],
});

type SheetId = null | 'quick' | 'legal' | 'visual' | 'areas' | 'view' | 'plantdb' | 'props' | 'warnings' | 'fixtures' | 'variants' | 'project' | 'filters' | 'ideas' | 'replace' | 'help';

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
  // Ask the browser to keep the plan once there is one (no effect where it is not supported).
  const hasPlan = useProject((s) => !!s.project);
  useEffect(() => {
    if (hasPlan) requestPersistence();
  }, [hasPlan]);
  useEffect(() => useUi.getState().setVisualOpen(sheet === 'visual'), [sheet]);
  // Started from "My own area" on the start screen: open the new-area form at once.
  const [newArea, setNewArea] = useState(false);
  const startNew = useUi((s) => s.startWithNewArea);
  const hasProject = useProject((s) => !!s.project);
  useEffect(() => {
    if (!startNew || !hasProject) return;
    useUi.getState().setStartWithNewArea(false);
    setNewArea(true);
    setSheet('areas');
  }, [startNew, hasProject]);
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
  const cameraEdit = useUi((s) => s.cameraEdit);
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
      else if (k === 'k') setSheet('quick');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The first-plan checklist counts the list as seen once it was opened.
  const tool0 = useUi((s) => s.tool);
  useEffect(() => {
    if (tool0 === 'list') markSeen('list');
  }, [tool0]);

  if (loading) return <div className="splash">{t('Betöltés…', 'Loading…')}</div>;
  if (!project) return <Welcome />;

  const ui = useUi.getState();
  const go = (f: () => void) => () => {
    setSheet(null);
    f();
  };
  const tool_ = (tl: Tool) => go(() => ui.setTool(tl));
  const quickActions: QuickAction[] = [
    { id: 'plant', label: t('Növény ültetése', 'Place a plant'), hint: t('Egyedi tő a palettáról', 'Single plant from the palette'), words: 'tő palettá', run: tool_('plant') },
    { id: 'drift', label: t('Folt ültetése', 'Plant a drift'), hint: t('Egy rész kitöltése egy fajjal', 'Fill a patch with one species'), run: tool_('drift') },
    { id: 'row', label: t('Sor vagy ív', 'Row or curve'), hint: t('Ültetés vonal mentén', 'Planting along a line'), words: 'sövény hedge', run: tool_('row') },
    { id: 'fixtures', label: t('Rögzített elemek rajzolása', 'Draw fixed elements'), hint: t('Gyep, burkolat, fal, kerítés, tó, tároló, fa…', 'Lawn, paving, wall, fence, pond, shed, tree…'), words: 'elemek gyepsáv kavics kút pad', run: tool_('fixtures') },
    { id: 'areas', label: t('Területek', 'Areas'), hint: t('Váltás, új terület, méret, alak, sablonok', 'Switch, new area, size, shape, templates'), words: 'terület sablon alak', run: () => setSheet('areas') },
    { id: 'ideas', label: t('Ötletgenerátor', 'Idea generator'), hint: t('Kész összeállítás új változatba, vagy kijelölt rész kitöltése', 'A ready composition in a new variant, or fill a region'), words: 'generál random véletlen', run: () => setSheet('ideas') },
    { id: 'replace', label: t('Növény cseréje', 'Replace plants'), hint: t('Egy faj cseréje egy vagy több másikra', 'Swap a species for one or more others'), words: 'csere', run: () => openReplace() },
    { id: 'variants', label: t('Változatok', 'Variants'), hint: t('Másolás, mappák, választott változat', 'Copy, folders, chosen variant'), words: 'terv másolat', run: () => setSheet('variants') },
    ...(area && area.variants.length > 1 ? [{ id: 'compare', label: t('Változatok összehasonlítása', 'Compare variants'), hint: t('Két változat egymás mellett', 'Two variants side by side'), run: go(() => { ui.setTool('select'); ui.setCompare(true); }) }] : []),
    { id: 'visual', label: t('Látványterv (ChatGPT)', 'Visualisation (ChatGPT)'), hint: t('Kamera a rajzon, leírás és kép küldése, kész képek', 'Camera on the plan, send brief and image, finished images'), words: 'kép kamera chatgpt ai mi', run: () => setSheet('visual') },
    { id: 'season', label: t('Évszaknézet', 'Season view'), hint: t('Színek hónapról hónapra, négy évszak', 'Colours month by month, four seasons'), run: tool_('season') },
    { id: 'list', label: t('Növénylista, rendelés, költség', 'Plant list, order, cost'), hint: t('Lista, tartalék, CSV, XLSX', 'List, spare, CSV, XLSX'), words: 'bevásárló ár excel', run: tool_('list') },
    { id: 'schedule', label: t('Ültetési menetrend és gondozás', 'Planting schedule and care'), hint: t('Napi lista, gondozási naptár', 'Daily list, care calendar'), words: 'naptár', run: go(() => ui.setPage('schedule')) },
    { id: 'warnings', label: t('Figyelmeztetések', 'Warnings'), hint: t(`${warnings.length} figyelmeztetés ezen a területen`, `${warnings.length} warnings in this area`), words: 'hiba szabály', run: () => setSheet('warnings') },
    { id: 'plantdb', label: t('Növényadatbázis', 'Plant database'), hint: t('Fajok, szűrők, saját növény, import, ellenőrizendők', 'Species, filters, own plant, import, values to check'), words: 'faj növény', run: () => setSheet('plantdb') },
    { id: 'backup', label: t('Mentés fájlba', 'Save to file'), hint: t('Teljes mentés JSON-ban', 'Full backup as JSON'), words: 'backup json mentés', run: go(() => backupNow(project)) },
    { id: 'project', label: t('Projekt: betöltés, megosztás, nyomtatás, képek', 'Project: load, share, print, images'), hint: t('Link, PNG, SVG, PDF, helyszín, névjegy', 'Link, PNG, SVG, PDF, location, about'), words: 'pdf png link helyszín éghajlat', run: () => setSheet('project') },
    { id: 'view', label: t('Nézet és rétegek', 'View and layers'), hint: t('Rétegek, méret, fotók, megjelenés, nyelv', 'Layers, size, photos, appearance, language'), run: () => setSheet('view') },
    { id: 'theme', label: t('Sötét / világos mód', 'Dark / light mode'), hint: t('Váltás egy koppintással', 'Switch with one tap'), words: 'dark light téma', run: go(toggleTheme) },
    { id: 'lang', label: getLang() === 'hu' ? 'English' : 'Magyar', hint: getLang() === 'hu' ? 'Switch to English' : 'Váltás magyarra', words: 'nyelv language', run: go(() => setLang(getLang() === 'hu' ? 'en' : 'hu')) },
    { id: 'help', label: t('Súgó', 'Help'), hint: t('Felhasználói útmutató', 'User guide'), words: 'útmutató', run: () => openHelp() },
    { id: 'legal', label: t('Jogi információk és adatvédelem', 'Legal information and privacy'), hint: t('Feltételek, adatvédelem, adatforrások, licencek', 'Terms, privacy, data sources, licences'), run: () => setSheet('legal') },
    { id: 'intro', label: t('Bevezető újra', 'Show the intro again'), hint: t('A három lépéses bemutató', 'The three-step tour'), run: go(() => setCoach(true)) },
  ];
  const anyFixtures = project.areas.some((a) => a.fixtures.length > 0);
  const anyItems = project.areas.some((a) => a.variants.some((v) => v.items.length > 0));
  const steps: Step[] = [
    { id: 'area', label: t('Terület megadása (méret, fekvés, napsütés)', 'Set up an area (size, facing, sun)'), done: project.areas.length > 0, run: () => setSheet('areas') },
    { id: 'fixtures', label: t('Rögzített elemek (fal, gyep, fa…)', 'Fixed elements (wall, lawn, tree…)'), done: anyFixtures, run: tool_('fixtures') },
    { id: 'plants', label: t('Növények elhelyezése', 'Place plants'), done: anyItems, run: tool_('plant') },
    { id: 'warnings', label: t('Hibák javítása a figyelmeztetések alapján', 'Fix errors from the warnings'), done: anyItems && errors === 0, run: () => setSheet('warnings') },
    { id: 'variants', label: t('Változat vagy ötlet kipróbálása', 'Try a variant or an idea'), done: project.areas.some((a) => a.variants.length > 1), run: () => setSheet('variants') },
    { id: 'list', label: t('Növénylista és költség megnézése', 'Check the plant list and cost'), done: seen('list'), run: tool_('list') },
    { id: 'backup', label: t('Mentés fájlba', 'Save to file'), done: lastBackupAt() != null, run: go(() => backupNow(project)) },
  ];

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
          <QuickToggles />
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

      <BackupReminder />
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
            {cameraEdit && <CameraBar onDone={() => setSheet('visual')} />}
            {!cameraEdit && !shapeEditing && (
              <button type="button" className="quick-fab" onClick={() => setSheet('quick')} aria-label={t('Gyors műveletek', 'Quick actions')} title={t('Gyors műveletek (Ctrl+K)', 'Quick actions (Ctrl+K)')}>
                ⚡
              </button>
            )}
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

      <Sheet
        open={sheet === 'areas'}
        onHelp={() => openHelp('areas')}
        title={t('Területek', 'Areas')}
        onClose={() => {
          setNewArea(false);
          setSheet(null);
        }}
      >
        <AreasPanel
          key={newArea ? 'new' : 'list'}
          startNew={newArea}
          onDone={() => {
            setNewArea(false);
            setSheet(null);
          }}
        />
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
          onVisual={() => setSheet('visual')}
          onLegal={() => setSheet('legal')}
        />
      </Sheet>
      <Sheet open={sheet === 'quick'} title={t('Gyors műveletek', 'Quick actions')} onClose={() => setSheet(null)}>
        <QuickPanel actions={quickActions} steps={steps} />
      </Sheet>
      <Sheet open={sheet === 'legal'} title={t('Jogi információk', 'Legal information')} onClose={() => setSheet(null)} wide>
        <LegalPanel />
      </Sheet>
      <Sheet open={sheet === 'visual'} onHelp={() => openHelp('visual')} title={t('Látványterv', 'Visualisation')} onClose={() => setSheet(null)}>
        <VisualPanel
          onPickCamera={() => {
            setSheet(null);
            ui.setTool('select');
            ui.setCameraEdit(true);
          }}
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
        <VariantsPanel onDone={() => setSheet(null)} onIdeas={() => setSheet('ideas')} onReplace={() => openReplace()} onVisual={() => setSheet('visual')} />
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
            <legend>{t('Megjelenés', 'Appearance')}</legend>
            <ThemeChoice />
          </fieldset>
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

/** Gentle reminder to back the plan up to a file (it only lives on this device). */
function BackupReminder() {
  const project = useProject((s) => s.project);
  const { last, persisted } = useBackupState();
  if (!needsReminder(project)) return null;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  return (
    <div className="backup-reminder" role="status">
      <span>
        {days == null ? t('A tervről még nincs mentésed.', 'You have no backup of the plan yet.') : t(`Az utolsó mentés ${days} napja készült.`, `The last backup was ${days} days ago.`)}{' '}
        {persisted ? '' : t('A böngésző idővel törölheti az adatokat.', 'The browser may clear the data over time.')}
      </span>
      <button type="button" className="btn btn-small btn-primary" onClick={() => backupNow(project!)}>
        {t('Mentés fájlba', 'Save to file')}
      </button>
      <button type="button" className="btn btn-small" onClick={() => snoozeReminder()}>
        {t('Később', 'Later')}
      </button>
    </div>
  );
}

/** Floating controls while placing the visualisation viewpoint. */
function CameraBar({ onDone }: { onDone: () => void }) {
  const area = useProject(selectCurrentArea);
  const done = () => {
    useUi.getState().setCameraEdit(false);
    onDone();
  };
  return (
    <div className="shape-bar camera-bar" role="toolbar" aria-label={t('Nézőpont', 'Viewpoint')}>
      <p className="shape-hint">
        <b>{t('Nézőpont: ', 'Viewpoint: ')}</b>
        {area?.camera
          ? t('Húzd a kamerát a nézés irányába, vagy nyomj máshová az áthelyezéshez.', 'Drag from the camera towards where you look, or press elsewhere to move it.')
          : t('Nyomd meg ott, ahol állsz, és húzd a nézés irányába.', 'Press where you stand and drag towards where you look.')}
      </p>
      <div className="form-actions form-actions-start">
        {area?.camera && (
          <button type="button" className="btn btn-small btn-danger" onClick={() => useProject.getState().setCamera(null)}>
            {t('Törlés', 'Remove')}
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn btn-small btn-primary" onClick={done}>
          {t('Kész', 'Done')}
        </button>
      </div>
    </div>
  );
}

/** One-tap language and light/dark switches in the top bar. */
function QuickToggles() {
  const { dark } = useTheme();
  const other: Lang = getLang() === 'hu' ? 'en' : 'hu';
  return (
    <>
      <button type="button" className="icon-btn quick-btn" lang={other} onClick={() => setLang(other)} aria-label={other === 'en' ? 'Switch to English' : 'Váltás magyarra'} title={other === 'en' ? 'English' : 'Magyar'}>
        {other.toUpperCase()}
      </button>
      <button
        type="button"
        className="icon-btn quick-btn"
        onClick={toggleTheme}
        aria-label={dark ? t('Világos mód', 'Light mode') : t('Sötét mód', 'Dark mode')}
        title={dark ? t('Világos mód', 'Light mode') : t('Sötét mód', 'Dark mode')}
      >
        {dark ? '☀' : '☾'}
      </button>
    </>
  );
}

/** Automatic (system) / light / dark, in the View sheet. */
export function ThemeChoice() {
  const { theme } = useTheme();
  const opts: [Theme, string][] = [
    ['auto', t('Automatikus (rendszer)', 'Automatic (system)')],
    ['light', t('Világos', 'Light')],
    ['dark', t('Sötét', 'Dark')],
  ];
  return (
    <div className="seg">
      {opts.map(([v, label]) => (
        <label key={v} className="seg-item">
          <input type="radio" name="theme" checked={theme === v} onChange={() => setTheme(v)} />
          <span>{label}</span>
        </label>
      ))}
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
