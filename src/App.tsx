import { useEffect, useState } from 'react';
import { PlanCanvas, type Layers } from './canvas/PlanCanvas';
import { ORIENTATION_LABEL } from './model/types';
import { selectCurrentArea, useProject } from './store/projectStore';
import { AreasPanel } from './ui/AreasPanel';
import { Sheet } from './ui/Sheet';
import { Welcome } from './ui/Welcome';

type Tool = 'select' | 'plant' | 'drift' | 'row' | 'season' | 'list';

// Tools arrive phase by phase (SPEC §7); unavailable ones are shown but disabled.
const TOOLS: { id: Tool; label: string; icon: string; ready: boolean }[] = [
  { id: 'select', label: 'Kijelölés', icon: '↖', ready: true },
  { id: 'plant', label: 'Növény', icon: '✿', ready: false },
  { id: 'drift', label: 'Folt', icon: '⬭', ready: false },
  { id: 'row', label: 'Sor', icon: '⋯', ready: false },
  { id: 'season', label: 'Évszak', icon: '◐', ready: false },
  { id: 'list', label: 'Lista', icon: '☰', ready: false },
];

const LAYER_LABELS: Record<keyof Layers, string> = {
  grid: 'Rácsháló',
  fixtures: 'Rögzített elemek',
  zones: 'Juglone-zóna',
  dimensions: 'Méretvonalak',
};

export function App({ loading }: { loading: boolean }) {
  const project = useProject((s) => s.project);
  const area = useProject(selectCurrentArea);
  const canUndo = useProject((s) => s.past.length > 0);
  const canRedo = useProject((s) => s.future.length > 0);
  const [sheet, setSheet] = useState<null | 'areas' | 'layers'>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [layers, setLayers] = useState<Layers>({ grid: true, fixtures: true, zones: true, dimensions: true });

  // Desktop keyboard shortcuts for undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).closest('input,textarea,select')) return;
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

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="area-switch" onClick={() => setSheet('areas')} aria-haspopup="dialog">
          <span className="area-name">{area ? area.name : 'Nincs terület'}</span>
          {area && (
            <span className="area-meta mono">
              {area.widthCm} × {area.lengthCm} cm · {ORIENTATION_LABEL[area.orientation]}
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
          <button type="button" className="icon-btn" onClick={() => setSheet('layers')} aria-label="Rétegek">
            ◫
          </button>
          <span className="warn-badge is-ok" title="Figyelmeztetések (a szabálymotor a 4. fázisban érkezik)" aria-label="0 figyelmeztetés">
            0
          </span>
        </div>
      </header>

      <main className="stage">
        {area ? (
          <PlanCanvas area={area} settings={project.settings} layers={layers} />
        ) : (
          <div className="empty-stage">
            <p>Még nincs területed. Hozz létre egyet, és kezdjük a rajzolást.</p>
            <button type="button" className="btn btn-primary" onClick={() => setSheet('areas')}>
              Terület hozzáadása
            </button>
          </div>
        )}
      </main>

      <nav className="toolbar" aria-label="Eszközök">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tool"
            aria-pressed={tool === t.id}
            disabled={!t.ready}
            title={t.ready ? t.label : `${t.label} – hamarosan`}
            onClick={() => setTool(t.id)}
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
      <Sheet open={sheet === 'layers'} title="Rétegek" onClose={() => setSheet(null)}>
        <div className="layer-list">
          {(Object.keys(LAYER_LABELS) as (keyof Layers)[]).map((k) => (
            <label key={k} className="check">
              <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} />
              <span>{LAYER_LABELS[k]}</span>
            </label>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
