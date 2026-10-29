import { useEffect, useMemo, useState } from 'react';
import { PlanCanvas, SNAP_CM } from './canvas/PlanCanvas';
import { evaluate, partition } from './engine/rules';
import { ORIENTATION_LABEL } from './model/types';
import { activeVariant, selectCurrentArea, selectItems, useProject } from './store/projectStore';
import { useUi, type Layers, type Tool } from './store/uiStore';
import { AreasPanel } from './ui/AreasPanel';
import { FIXTURE_LABEL, FixturesPanel } from './ui/FixturesPanel';
import { PlantDbPanel } from './ui/PlantDbPanel';
import { PlantPalette } from './ui/PlantPalette';
import { ListView } from './ui/ListView';
import { ItemProps, SelectionBar } from './ui/Selection';
import { Sheet } from './ui/Sheet';
import { WarningsPanel } from './ui/WarningsPanel';
import { Welcome } from './ui/Welcome';

// Tools arrive phase by phase (SPEC §7); unavailable ones are shown but disabled.
const TOOLS: { id: Tool; label: string; icon: string; ready: boolean }[] = [
  { id: 'select', label: 'Kijelölés', icon: '↖', ready: true },
  { id: 'plant', label: 'Növény', icon: '✿', ready: true },
  { id: 'drift', label: 'Folt', icon: '⬭', ready: true },
  { id: 'row', label: 'Sor', icon: '⋯', ready: true },
  { id: 'season', label: 'Évszak', icon: '◐', ready: false },
  { id: 'list', label: 'Lista', icon: '☰', ready: true },
];

const LAYER_LABELS: Record<keyof Layers, string> = {
  warnings: 'Figyelmeztetések',
  plants: 'Növények',
  spacing: 'Tőtáv-körök',
  grid: 'Rácsháló',
  fixtures: 'Rögzített elemek',
  zones: 'Juglone-zóna',
  dimensions: 'Méretvonalak',
};

type SheetId = null | 'areas' | 'view' | 'plantdb' | 'props' | 'warnings' | 'fixtures';

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
  const items = useProject(selectItems);
  const selectedFixture = useUi((s) => s.selectedFixture);

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

  if (loading) return <div className="splash">Betöltés…</div>;
  if (!project) return <Welcome />;

  const ui = useUi.getState();

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="area-switch" onClick={() => setSheet('areas')} aria-haspopup="dialog">
          <span className="area-name">{area ? area.name : 'Nincs terület'}</span>
          {area && (
            <span className="area-meta mono">
              {area.widthCm} × {area.lengthCm} cm · <b className="meta-count">{total} tő</b> · {ORIENTATION_LABEL[area.orientation]}
              {area.sunUntil && ` · ${area.sunUntil}`}
            </span>
          )}
        </button>
        <div className="top-actions">
          <button type="button" className="icon-btn" onClick={() => useProject.getState().undo()} disabled={!canUndo} aria-label="Visszavonás">
            ↶
          </button>
          <button type="button" className="icon-btn" onClick={() => useProject.getState().redo()} disabled={!canRedo} aria-label="Újra">
            ↷
          </button>
          <button type="button" className="icon-btn" onClick={() => setSheet('view')} aria-label="Nézet és rétegek">
            ◫
          </button>
          <button
            type="button"
            className={`warn-badge${warnings.length === 0 ? ' is-ok' : errors ? ' is-error' : ''}`}
            onClick={() => setSheet('warnings')}
            aria-label={`${warnings.length} figyelmeztetés`}
          >
            {warnings.length}
          </button>
        </div>
      </header>

      <main className={`stage${tool === 'list' ? ' stage-scroll' : ''}`}>
        {tool === 'list' ? (
          <ListView />
        ) : area ? (
          <>
            <PlanCanvas area={area} settings={project.settings} plantDb={project.plantDb} warnings={warnings} />
            {tool === 'select' && (
              <div className="stage-tools" role="toolbar" aria-label="Kijelölés módja">
                <button type="button" className="chip-btn" aria-pressed={lasso} onClick={() => ui.setLasso(!lasso)}>
                  Lasszó
                </button>
                <button type="button" className="chip-btn" aria-pressed={snapOn} onClick={() => ui.setSnap(!snapOn)}>
                  Mágnes {SNAP_CM} cm
                </button>
              </div>
            )}
            {tool === 'plant' && (
              <div className="stage-tools" role="toolbar" aria-label="Elhelyezés">
                <button type="button" className="chip-btn" aria-pressed={snapOn} onClick={() => ui.setSnap(!snapOn)}>
                  Mágnes {SNAP_CM} cm
                </button>
              </div>
            )}
            {tool === 'drift' && (
              <div className="stage-tools" role="toolbar" aria-label="Folt kiosztása">
                <button type="button" className="chip-btn" aria-pressed={driftPattern === 'staggered'} onClick={() => ui.setDriftPattern('staggered')}>
                  Eltolt rács
                </button>
                <button type="button" className="chip-btn" aria-pressed={driftPattern === 'grid'} onClick={() => ui.setDriftPattern('grid')}>
                  Négyzetes
                </button>
              </div>
            )}
            {tool === 'row' && (
              <div className="stage-tools" role="toolbar" aria-label="Sor fajtája">
                <button type="button" className="chip-btn" aria-pressed={rowMode === 'line'} onClick={() => ui.setRowMode('line')}>
                  Egyenes
                </button>
                <button type="button" className="chip-btn" aria-pressed={rowMode === 'curve'} onClick={() => ui.setRowMode('curve')}>
                  Ív
                </button>
                <button type="button" className="chip-btn" aria-pressed={snapOn} onClick={() => ui.setSnap(!snapOn)}>
                  Mágnes
                </button>
              </div>
            )}
            {tool === 'select' && <SelectionBar onProps={() => setSheet('props')} />}
            {tool === 'select' && selectedFixture && area.fixtures.some((x) => x.id === selectedFixture) && (
              <FixtureBar id={selectedFixture} label={(() => {
                const f = area.fixtures.find((x) => x.id === selectedFixture);
                return f ? f.label || FIXTURE_LABEL[f.type] : '';
              })()} onProps={() => setSheet('fixtures')} />
            )}
          </>
        ) : (
          <div className="empty-stage">
            <p>Még nincs területed. Hozz létre egyet, és kezdjük a rajzolást.</p>
            <button type="button" className="btn btn-primary" onClick={() => setSheet('areas')}>
              Terület hozzáadása
            </button>
          </div>
        )}
      </main>

      {(tool === 'plant' || tool === 'drift' || tool === 'row') && area && <PlantPalette onOpenDb={() => setSheet('plantdb')} />}

      <nav className="toolbar" aria-label="Eszközök">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tool"
            aria-pressed={tool === t.id}
            disabled={!t.ready}
            title={t.ready ? t.label : `${t.label} – hamarosan`}
            onClick={() => ui.setTool(t.id)}
          >
            <span className="tool-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="tool-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <Sheet open={sheet === 'areas'} title="Területek" onClose={() => setSheet(null)}>
        <AreasPanel onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'plantdb'} title="Növényadatbázis" onClose={() => setSheet(null)}>
        <PlantDbPanel />
      </Sheet>
      <Sheet open={sheet === 'props'} title="Tulajdonságok" onClose={() => setSheet(null)}>
        <ItemProps plantDb={project.plantDb} onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'warnings'} title={`Figyelmeztetések (${warnings.length})`} onClose={() => setSheet(null)}>
        <WarningsPanel active={warnings} muted={muted} onJump={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'fixtures'} title="Rögzített elemek" onClose={() => setSheet(null)}>
        <FixturesPanel onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'view'} title="Nézet" onClose={() => setSheet(null)}>
        <div className="form">
          <fieldset className="field-group">
            <legend>Rétegek</legend>
            {(Object.keys(LAYER_LABELS) as (keyof Layers)[]).map((k) => (
              <label key={k} className="check">
                <input type="checkbox" checked={layers[k]} onChange={(e) => ui.setLayer(k, e.target.checked)} />
                <span>{LAYER_LABELS[k]}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="field-group">
            <legend>Növények mérete</legend>
            <div className="seg">
              <label className="seg-item">
                <input
                  type="radio"
                  name="size"
                  checked={project.settings.showMatureSize}
                  onChange={() => useProject.getState().updateSettings({ showMatureSize: true })}
                />
                <span>kifejlett</span>
              </label>
              <label className="seg-item">
                <input
                  type="radio"
                  name="size"
                  checked={!project.settings.showMatureSize}
                  onChange={() => useProject.getState().updateSettings({ showMatureSize: false })}
                />
                <span>ültetéskori</span>
              </label>
            </div>
          </fieldset>
          <label className="check">
            <input type="checkbox" checked={snapOn} onChange={(e) => ui.setSnap(e.target.checked)} />
            <span>Mágnesezés {SNAP_CM} cm-es rácsra</span>
          </label>
          <div className="form-actions form-actions-start">
            <button type="button" className="btn" onClick={() => setSheet('plantdb')}>
              Növényadatbázis
            </button>
            <button type="button" className="btn" onClick={() => setSheet('fixtures')}>
              Rögzített elemek
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function FixtureBar({ id, label, onProps }: { id: string; label: string; onProps: () => void }) {
  return (
    <div className="selbar" role="toolbar" aria-label="Kijelölt elem">
      <span className="selbar-count mono">{label}</span>
      <button type="button" className="btn btn-small" onClick={onProps}>
        Adatok
      </button>
      <button
        type="button"
        className="btn btn-small btn-danger"
        onClick={() => {
          useProject.getState().deleteFixture(id);
          useUi.getState().selectFixture(null);
        }}
      >
        Törlés
      </button>
      <button type="button" className="icon-btn" onClick={() => useUi.getState().selectFixture(null)} aria-label="Kijelölés megszüntetése">
        ×
      </button>
    </div>
  );
}
