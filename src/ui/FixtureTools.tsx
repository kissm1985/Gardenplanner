import { DRAG_DRAWN, FIXTURE_LABEL } from '../model/fixtures';
import type { FixtureType } from '../model/types';
import { selectCurrentArea, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { startLawnEdit } from './ShapeEditBar';

const ITEMS: { type: FixtureType | 'lawn-draw'; icon: string; label: string }[] = [
  { type: 'lawn-draw', icon: '▱', label: 'Gyepsáv' },
  { type: 'paving', icon: '▦', label: FIXTURE_LABEL.paving },
  { type: 'wall', icon: '▮', label: FIXTURE_LABEL.wall },
  { type: 'fence', icon: '┆', label: FIXTURE_LABEL.fence },
  { type: 'window', icon: '▭', label: FIXTURE_LABEL.window },
  { type: 'tap', icon: '◉', label: FIXTURE_LABEL.tap },
  { type: 'manhole', icon: '◍', label: FIXTURE_LABEL.manhole },
  { type: 'tree', icon: '◯', label: FIXTURE_LABEL.tree },
  { type: 'walnut', icon: '⬤', label: FIXTURE_LABEL.walnut },
  { type: 'other', icon: '□', label: FIXTURE_LABEL.other },
];

/** Docked toolbar of the "Elemek" tool: pick a fixed element, then tap or drag on the plan. */
export function FixtureTools({ onList }: { onList: () => void }) {
  const armed = useUi((s) => s.fixtureTool);
  const area = useProject(selectCurrentArea);
  const ui = useUi.getState();
  const hint = !armed
    ? 'Válassz elemet, majd koppints vagy húzz a rajzon. A meglévő elemeket itt is húzhatod.'
    : DRAG_DRAWN.has(armed)
      ? `${FIXTURE_LABEL[armed]}: húzd végig a rajzon (koppintásra alapméretű lesz).`
      : `${FIXTURE_LABEL[armed]}: koppints a rajzra, ahová kerüljön.`;
  return (
    <section className="palette fx-tools" aria-label="Rögzített elemek eszköztára">
      <div className="palette-head">
        <p className="palette-hint" role="status">
          {hint}
        </p>
        <button type="button" className="btn btn-small" onClick={onList}>
          Lista
        </button>
      </div>
      <div className="palette-strip" role="toolbar" aria-label="Elemek">
        {ITEMS.map((it) => (
          <button
            key={it.type}
            type="button"
            className="palette-item fx-tool"
            aria-pressed={it.type !== 'lawn-draw' && armed === it.type}
            onClick={() => {
              if (it.type === 'lawn-draw') {
                if (area) startLawnEdit(area);
                ui.setTool('fixtures');
                ui.setFixtureTool(null);
              } else ui.setFixtureTool(armed === it.type ? null : it.type);
            }}
          >
            <span className={`fx-tool-icon fx-tool-${it.type}`} aria-hidden="true">
              {it.icon}
            </span>
            <span className="palette-name">{it.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
