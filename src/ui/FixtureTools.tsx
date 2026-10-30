import { DRAG_DRAWN, FIXTURE_LABEL } from '../model/fixtures';
import type { FixtureType } from '../model/types';
import { selectCurrentArea, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { t } from '../i18n';
import { startLawnEdit } from './ShapeEditBar';

const ITEMS: { type: FixtureType | 'lawn-draw'; icon: string }[] = [
  { type: 'lawn-draw', icon: '▱' },
  { type: 'paving', icon: '▦' },
  { type: 'wall', icon: '▮' },
  { type: 'fence', icon: '┆' },
  { type: 'window', icon: '▭' },
  { type: 'tap', icon: '◉' },
  { type: 'manhole', icon: '◍' },
  { type: 'tree', icon: '◯' },
  { type: 'walnut', icon: '⬤' },
  { type: 'gravel', icon: '⁘' },
  { type: 'path', icon: '⋮' },
  { type: 'pond', icon: '◒' },
  { type: 'well', icon: '◎' },
  { type: 'shed', icon: '⌂' },
  { type: 'compost', icon: '▤' },
  { type: 'rainBarrel', icon: '◙' },
  { type: 'bench', icon: '▬' },
  { type: 'raisedBed', icon: '▣' },
  { type: 'other', icon: '□' },
];

/** Docked toolbar of the "Elemek" (Elements) tool: pick a fixed element, then tap or drag on the plan. */
export function FixtureTools({ onList }: { onList: () => void }) {
  const armed = useUi((s) => s.fixtureTool);
  const area = useProject(selectCurrentArea);
  const ui = useUi.getState();
  const hint = !armed
    ? t('Válassz elemet, majd koppints vagy húzz a rajzon. Egy meglévő elemre koppintva kijelölöd: húzd, a sarkánál méretezd, az Adatok gombbal szerkeszd.', 'Pick an element, then tap or drag on the plan. Tap an existing element to select it: drag it, resize it at its corner, edit it with Details.')
    : DRAG_DRAWN.has(armed)
      ? t(`${FIXTURE_LABEL[armed]}: húzd végig a rajzon (koppintásra alapméretű lesz).`, `${FIXTURE_LABEL[armed]}: drag it out on the plan (a tap gives the default size).`)
      : t(`${FIXTURE_LABEL[armed]}: koppints a rajzra, ahová kerüljön.`, `${FIXTURE_LABEL[armed]}: tap the plan where it should go.`);
  return (
    <section className="palette fx-tools" aria-label={t('Rögzített elemek eszköztára', 'Fixed elements toolbar')}>
      <div className="palette-head">
        <p className="palette-hint" role="status">
          {hint}
        </p>
        <button type="button" className="btn btn-small" onClick={onList}>
          {t('Lista', 'List')}
        </button>
      </div>
      <div className="palette-strip" role="toolbar" aria-label={t('Elemek', 'Elements')}>
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
            <span className="palette-name">{it.type === 'lawn-draw' ? t('Gyepsáv', 'Lawn strip') : FIXTURE_LABEL[it.type]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
