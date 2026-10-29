import { areaPoints } from '../canvas/AreaShape';
import type { Area } from '../model/types';
import { useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';

/** Start editing the outline of an area (rectangles become 4-corner polygons). */
export function startShapeEdit(area: Area) {
  useUi.getState().setTool('select');
  useUi.getState().setShapeEdit({ areaId: area.id, mode: 'edit', points: areaPoints(area).map(([x, y]) => [x, y]), selected: null });
}

/** Floating controls while drawing or editing an area outline. */
export function ShapeEditBar() {
  const se = useUi((s) => s.shapeEdit)!;
  const ui = useUi.getState();
  const n = se.points.length;
  const finish = () => {
    if (n < 3) return;
    useProject.getState().setAreaShape(se.areaId, se.points);
    ui.setShapeEdit(null);
  };
  return (
    <div className="shape-bar" role="toolbar" aria-label="Terület alakja">
      <p className="shape-hint">
        {se.mode === 'draw'
          ? n === 0
            ? 'Koppints a terület első sarkára.'
            : n < 3
              ? `Következő sarok… (${n} pont)`
              : 'Folytasd, vagy koppints az első pontra / a Kész gombra a lezáráshoz.'
          : 'Húzd a sarkokat; az oldalak közepén lévő pöttyel új sarkot szúrsz be.'}
      </p>
      <div className="shape-actions">
        {se.mode === 'draw' && (
          <button type="button" className="btn btn-small" disabled={!n} onClick={() => ui.setShapeEdit({ ...se, points: se.points.slice(0, -1) })}>
            Vissza
          </button>
        )}
        {se.mode === 'edit' && (
          <button
            type="button"
            className="btn btn-small"
            disabled={se.selected == null || n <= 3}
            onClick={() => se.selected != null && ui.setShapeEdit({ ...se, points: se.points.filter((_, i) => i !== se.selected), selected: null })}
          >
            Sarok törlése
          </button>
        )}
        <button type="button" className="btn btn-small" onClick={() => ui.setShapeEdit(null)}>
          Mégse
        </button>
        <button type="button" className="btn btn-small btn-primary" disabled={n < 3} onClick={finish}>
          Kész
        </button>
      </div>
    </div>
  );
}
