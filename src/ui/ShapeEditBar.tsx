import { areaPoints } from '../canvas/AreaShape';
import { bbox } from '../model/geometry';
import type { Area, Fixture } from '../model/types';
import { useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';

/** Start editing the outline of an area (rectangles become 4-corner polygons). */
export function startShapeEdit(area: Area) {
  useUi.getState().setTool('select');
  useUi.getState().setShapeEdit({ areaId: area.id, mode: 'edit', points: areaPoints(area).map(([x, y]) => [x, y]), selected: null });
}

/** Draw a new lawn in the area (no plants go there), or reshape an existing one. */
export function startLawnEdit(area: Area, lawn?: Fixture) {
  useUi.getState().setTool('select');
  useUi.getState().setShapeEdit({
    areaId: area.id,
    mode: lawn?.polygon ? 'edit' : 'draw',
    points: lawn?.polygon?.map(([x, y]) => [x, y]) ?? [],
    selected: null,
    target: { kind: 'lawn', fixtureId: lawn?.id },
  });
}

/** Save a lawn outline: corners kept inside the area's bounding box, whole cm. */
function saveLawn(area: Area, fixtureId: string | undefined, points: [number, number][]) {
  const b = bbox(areaPoints(area));
  const pts = points.map(([x, y]) => [Math.round(Math.min(b.maxX, Math.max(b.minX, x))), Math.round(Math.min(b.maxY, Math.max(b.minY, y)))] as [number, number]);
  const pb = bbox(pts);
  const st = useProject.getState();
  if (fixtureId) st.updateFixture(fixtureId, { polygon: pts, x: pb.minX, y: pb.minY });
  else st.addFixture({ type: 'lawn', label: 'Gyepsáv', x: pb.minX, y: pb.minY, polygon: pts });
}

/** Floating controls while drawing or editing an area outline or a lawn. */
export function ShapeEditBar() {
  const se = useUi((s) => s.shapeEdit)!;
  const ui = useUi.getState();
  const n = se.points.length;
  const lawn = se.target?.kind === 'lawn';
  const finish = () => {
    if (n < 3) return;
    const area = useProject.getState().project?.areas.find((a) => a.id === se.areaId);
    if (lawn && area) saveLawn(area, se.target!.fixtureId, se.points);
    else useProject.getState().setAreaShape(se.areaId, se.points);
    ui.setShapeEdit(null);
  };
  return (
    <div className={`shape-bar${lawn ? ' is-lawn' : ''}`} role="toolbar" aria-label={lawn ? 'Gyepsáv alakja' : 'Terület alakja'}>
      <p className="shape-hint">
        {lawn && <b>Gyepsáv: </b>}
        {se.mode === 'draw'
          ? n === 0
            ? lawn
              ? 'Koppints a gyep első sarkára (ide nem kerül növény).'
              : 'Koppints a terület első sarkára.'
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
