import { fillPath, fillPolygon } from '../engine/fill';
import { bbox, dist } from '../model/geometry';
import type { Area, Plant, Pt } from '../model/types';
import { CountLabel, plantRadius } from './layers/Plants';

/** Width/length dimension labels, placed outside edge strips (wall, fence, paving); font size is constant on screen. */
export function Dimensions({ area, s }: { area: Area; s: number }) {
  const fs = 11 / s;
  const off = 16 / s;
  const strips = area.fixtures.filter((f) => f.type === 'wall' || f.type === 'fence' || f.type === 'paving');
  const right = Math.max(area.widthCm, ...strips.map((f) => f.x + (f.w ?? 0)));
  const bottom = Math.max(area.lengthCm, ...strips.map((f) => f.y + (f.h ?? 0)));
  return (
    <g className="dims" fontSize={fs}>
      <text x={area.widthCm / 2} y={bottom + off + fs * 0.4} textAnchor="middle">
        {area.widthCm} cm
      </text>
      <text transform={`translate(${right + off} ${area.lengthCm / 2}) rotate(90)`} textAnchor="middle" dominantBaseline="middle">
        {area.lengthCm} cm
      </text>
    </g>
  );
}

/** Live preview while drawing a drift / row: outline, planting positions and count. */
export function Draft({
  draft,
  plant,
  pattern,
  s,
  mature,
}: {
  draft: { kind: 'drift' | 'curve' | 'line'; points: Pt[] };
  plant: Plant;
  pattern: 'grid' | 'staggered';
  s: number;
  mature: boolean;
}) {
  const pts = draft.points;
  const isDrift = draft.kind === 'drift';
  const positions = isDrift ? (pts.length >= 3 ? fillPolygon(pts, plant.spacingCm, pattern) : []) : fillPath(pts, plant.spacingCm);
  const r = plantRadius(plant, mature);
  const b = bbox(pts);
  const line = pts.map((q) => q.join(',')).join(' ');
  return (
    <g className="draft" pointerEvents="none">
      {isDrift ? (
        <polygon className="draft-shape" points={line} vectorEffect="non-scaling-stroke" />
      ) : (
        <polyline className="draft-shape" points={line} vectorEffect="non-scaling-stroke" />
      )}
      {positions.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={plant.color} fillOpacity={0.55} />
      ))}
      <CountLabel x={(b.minX + b.maxX) / 2} y={b.minY - 6 / s} fs={12 / s} text={`${plant.code} × ${positions.length}`} />
    </g>
  );
}

/** Outline being drawn/edited: corners, edge midpoints (tap to insert), edge lengths in cm. */
export function ShapeEditor({
  points,
  mode,
  selected,
  s,
  lawn,
  zone,
}: {
  points: Pt[];
  mode: 'draw' | 'edit';
  selected: number | null;
  s: number;
  lawn?: boolean;
  zone?: boolean;
}) {
  const closed = mode === 'edit' && points.length >= 3;
  const line = points.map((p) => p.join(',')).join(' ');
  const edges = points.map((a, i) => [a, points[(i + 1) % points.length]] as const).slice(0, closed ? points.length : Math.max(0, points.length - 1));
  const r = 10 / s;
  return (
    <g className={`shape-editor${lawn ? ' is-lawn' : ''}${zone ? ' is-zone' : ''}`}>
      {closed ? (
        <polygon className="shape-line" points={line} vectorEffect="non-scaling-stroke" />
      ) : (
        <polyline className="shape-line" points={line} vectorEffect="non-scaling-stroke" />
      )}
      {edges.map(([a, b], i) => {
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        return (
          <g key={`e${i}`}>
            <CountLabel x={mx} y={my - 8 / s} fs={10 / s} text={`${Math.round(dist(a, b))} cm`} />
            {mode === 'edit' && <circle className="shape-mid" data-shape-mid={i} cx={mx} cy={my} r={r * 0.7} vectorEffect="non-scaling-stroke" />}
          </g>
        );
      })}
      {points.map(([x, y], i) => (
        <circle
          key={i}
          className={`shape-vertex${i === selected ? ' is-selected' : ''}${i === 0 && mode === 'draw' ? ' is-first' : ''}`}
          data-shape-vertex={i}
          cx={x}
          cy={y}
          r={r}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}
