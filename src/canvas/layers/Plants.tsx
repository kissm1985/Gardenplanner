import { memo, useMemo } from 'react';
import { fillPath, fillPolygon } from '../../engine/fill';
import { plantLook } from '../../engine/season';
import { bbox, centroid } from '../../model/geometry';
import { effectivePlant, textOn } from '../../model/plants';
import type { PlacedItem, Plant, Pt } from '../../model/types';
import { useProject } from '../../store/projectStore';
import { topHref } from '../../ui/pictograms';

export interface DragOffset {
  ids: Set<string>;
  dx: number;
  dy: number;
}

/** Live shape of a drift/row while one of its vertices is being dragged. */
export interface ShapeOverride {
  id: string;
  points: Pt[];
}

interface Props {
  items: PlacedItem[];
  plants: Map<string, Plant>;
  selected: Set<string>;
  drag: DragOffset | null;
  shape: ShapeOverride | null;
  showMature: boolean;
  showSpacing: boolean;
  /** Season view: draw each plant as it looks in this month (1–12). */
  month?: number | null;
}

/** Footprint radius in cm: mature spread, or a small planting-time size. */
export const plantRadius = (p: Plant, mature: boolean) => (mature ? p.spreadCm / 2 : Math.max(4, p.spreadCm * 0.2));

/** Apply a live vertex-drag override to an item. */
export function withShape(it: PlacedItem, shape: ShapeOverride | null): PlacedItem {
  if (!shape || shape.id !== it.id) return it;
  if (it.kind === 'drift') return { ...it, polygon: shape.points };
  if (it.kind === 'row') return { ...it, path: shape.points };
  return it;
}

/**
 * All placed plants, drifts and rows. Everything is in world units (cm) so a zoom does not
 * re-render this layer; each mark is memoised so dragging re-renders only the moved ones.
 */
export const PlantsLayer = memo(function PlantsLayer({ items, plants, selected, drag, shape, showMature, showSpacing, month }: Props) {
  // Concept plan: top-view pictograms instead of coloured symbols (the season view keeps its colours).
  const concept = useProject((s) => s.project?.settings.planStyle === 'concept') && !month;
  // Tree crowns: an outline by default, so the bed under a tree stays visible.
  const canopy = useProject((s) => s.project?.settings.canopy ?? 'outline');
  return (
    <g className="plants">
      {items.map((raw) => {
        const it = withShape(raw, shape);
        const base = plants.get(it.plantId);
        if (!base) return null;
        const p = effectivePlant(base, it);
        const moving = drag?.ids.has(it.id);
        const dx = moving ? drag!.dx : 0;
        const dy = moving ? drag!.dy : 0;
        const look = month ? plantLook(p, month) : null;
        const r = plantRadius(p, showMature) * (look?.scale ?? 1);
        const fill = look?.color ?? p.color;
        const op = look?.opacity ?? 0.94;
        const sel = selected.has(it.id);
        if (it.kind === 'plant')
          return (
            <PlantMark
              key={it.id}
              id={it.id}
              x={it.x + dx}
              y={it.y + dy}
              plant={p}
              r={r}
              fill={fill}
              opacity={op}
              selected={sel}
              spacing={showSpacing}
              planted={it.status === 'planted'}
              concept={concept}
              canopy={canopy}
            />
          );
        return <GroupMark key={it.id} item={it} plant={p} r={r} fill={fill} opacity={op} dx={dx} dy={dy} selected={sel} spacing={showSpacing} concept={concept} />;
      })}
    </g>
  );
});

const PlantMark = memo(function PlantMark({
  id,
  x,
  y,
  plant,
  r,
  fill,
  opacity,
  selected,
  spacing,
  planted,
  concept,
  canopy = 'filled',
}: {
  id: string;
  x: number;
  y: number;
  plant: Plant;
  r: number;
  fill: string;
  opacity: number;
  selected: boolean;
  spacing: boolean;
  planted: boolean;
  concept: boolean;
  canopy?: 'outline' | 'transparent' | 'filled';
}) {
  return (
    <g className={`plant${selected ? ' is-selected' : ''}`} data-id={id} transform={`translate(${x} ${y})`}>
      <Dot plant={plant} r={r} fill={fill} opacity={opacity} spacing={spacing} concept={concept} canopy={plant.isTree ? canopy : 'filled'} />
      {planted && <circle className="plant-planted" cx={r * 0.7} cy={-r * 0.7} r={Math.max(2, r * 0.18)} />}
      {selected && <circle className="select-ring" r={r + Math.max(2, r * 0.12)} vectorEffect="non-scaling-stroke" />}
    </g>
  );
});

/** Pictograms have about 10 % optical room around the drawing; this keeps the foliage edge at the spread. */
const PICTO_SCALE = 1.1;

/** One plant symbol at the origin: footprint, shape glyph, code – or its top-view pictogram on a concept plan. */
function Dot({
  plant,
  r,
  fill,
  opacity,
  spacing,
  concept = false,
  canopy = 'filled',
}: {
  plant: Plant;
  r: number;
  fill: string;
  opacity: number;
  spacing: boolean;
  concept?: boolean;
  canopy?: 'outline' | 'transparent' | 'filled';
}) {
  const href = concept ? topHref(plant) : null;
  if (href) {
    const h = r * PICTO_SCALE;
    return (
      <>
        {spacing && <circle className="spacing-ring" r={plant.spacingCm / 2} vectorEffect="non-scaling-stroke" />}
        <circle className="plant-hit" r={r} />
        <image className="plant-picto" href={href} x={-h} y={-h} width={2 * h} height={2 * h} />
      </>
    );
  }
  const fs = Math.max(3, Math.min(r * 0.75, 14));
  // Faded (winter) plants keep a readable dark code.
  const tc = opacity < 0.6 || canopy !== 'filled' ? 'var(--fg)' : textOn(fill);
  return (
    <>
      {spacing && <circle className="spacing-ring" r={plant.spacingCm / 2} vectorEffect="non-scaling-stroke" />}
      {canopy === 'filled' ? (
        <circle className="plant-body" r={r} fill={fill} fillOpacity={opacity} vectorEffect="non-scaling-stroke" />
      ) : (
        <>
          <circle
            className={`plant-body canopy-${canopy}`}
            r={r}
            fill={fill}
            style={{ fillOpacity: canopy === 'transparent' ? opacity * 0.3 : 0.07, stroke: fill, strokeWidth: 2.5, strokeDasharray: canopy === 'outline' ? '7 5' : undefined }}
            vectorEffect="non-scaling-stroke"
          />
          <circle className="plant-trunk" r={Math.max(2, Math.min(r * 0.06, 8))} fill={fill} />
        </>
      )}
      {plant.symbol && plant.symbol !== 'circle' && r >= 6 && <path className="plant-glyph" d={glyph(plant.symbol, r * 0.72)} stroke={tc} vectorEffect="non-scaling-stroke" />}
      {r >= 4 && (
        <text className="plant-code" fontSize={fs} fill={tc} textAnchor="middle" dominantBaseline="central">
          {plant.code}
        </text>
      )}
    </>
  );
}

type Group = Extract<PlacedItem, { kind: 'drift' | 'row' }>;

const GroupMark = memo(function GroupMark({
  item,
  plant,
  r,
  fill,
  opacity,
  dx,
  dy,
  selected,
  spacing,
  concept,
}: {
  item: Group;
  plant: Plant;
  r: number;
  fill: string;
  opacity: number;
  dx: number;
  dy: number;
  selected: boolean;
  spacing: boolean;
  concept: boolean;
}) {
  const pts = useMemo(() => (item.kind === 'drift' ? fillPolygon(item.polygon, item.spacingCm, item.pattern) : fillPath(item.path, item.spacingCm)), [item]);
  const outline = (item.kind === 'drift' ? item.polygon : item.path).map((q) => q.join(',')).join(' ');
  return (
    <g className={`group group-${item.kind}${selected ? ' is-selected' : ''}`} data-id={item.id} transform={`translate(${dx} ${dy})`}>
      {item.kind === 'drift' ? (
        <polygon className={`drift-area${concept ? ' is-concept' : ''}`} points={outline} fill={fill} stroke={fill} vectorEffect="non-scaling-stroke" />
      ) : (
        <polyline className="row-line" points={outline} stroke={fill} strokeWidth={Math.max(6, r * 0.5)} />
      )}
      {pts.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <Dot plant={plant} r={r} fill={fill} opacity={opacity} spacing={spacing} concept={concept} />
        </g>
      ))}
      {selected && (
        <>
          {item.kind === 'drift' ? (
            <polygon className="group-select" points={outline} vectorEffect="non-scaling-stroke" />
          ) : (
            <polyline className="group-select" points={outline} vectorEffect="non-scaling-stroke" />
          )}
        </>
      )}
    </g>
  );
});

/** Screen-sized "LA × 12" labels for drifts and rows (re-rendered on zoom; one text per group). */
export function GroupLabels({
  items,
  plants,
  drag,
  shape,
  s,
}: {
  items: PlacedItem[];
  plants: Map<string, Plant>;
  drag: DragOffset | null;
  shape: ShapeOverride | null;
  s: number;
}) {
  const fs = 13 / s;
  const labels: { id: string; x: number; y: number; text: string }[] = [];
  for (const raw of items) {
    if (raw.kind === 'plant') continue;
    const it = withShape(raw, shape) as Group;
    const p = plants.get(it.plantId);
    if (!p) continue;
    const pts = it.kind === 'drift' ? it.polygon : it.path;
    const moving = drag?.ids.has(it.id);
    const [cx] = centroid(pts);
    const top = bbox(pts).minY;
    // Stored count is kept in sync by the store; recompute only during a live vertex drag.
    const count = it === raw ? it.count : it.kind === 'drift' ? fillPolygon(it.polygon, it.spacingCm, it.pattern).length : fillPath(it.path, it.spacingCm).length;
    labels.push({ id: it.id, x: cx + (moving ? drag!.dx : 0), y: top + (moving ? drag!.dy : 0) - 6 / s, text: `${p.code} × ${count}` });
  }
  const placed = placeLabels(labels, fs);
  return (
    <g className="group-labels" pointerEvents="none">
      {placed.map((l) =>
        l.hidden ? null : (
          <g key={l.id}>
            {l.moved && <line className="count-leader" x1={l.ax} y1={l.ay} x2={l.x} y2={l.y - fs * 0.45} vectorEffect="non-scaling-stroke" />}
            <CountLabel x={l.x} y={l.y} fs={fs} text={l.text} />
          </g>
        ),
      )}
    </g>
  );
}

const labelWidth = (text: string, fs: number) => text.length * fs * 0.62 + fs;

/**
 * Keeps group labels from covering each other: a label that would overlap one already placed moves up or down
 * (with a leader line to its group); if no free place is near, it is hidden until the user zooms in.
 */
export function placeLabels<T extends { id: string; x: number; y: number; text: string }>(labels: T[], fs: number) {
  const h = fs * 1.7;
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const hit = (x: number, y: number, w: number) => boxes.some((b) => x - w / 2 < b.x1 && x + w / 2 > b.x0 && y - h < b.y1 && y > b.y0);
  return [...labels]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((l) => {
      const w = labelWidth(l.text, fs);
      for (const dy of [0, -h, h, -2 * h, 2 * h]) {
        const y = l.y + dy;
        if (!hit(l.x, y, w)) {
          boxes.push({ x0: l.x - w / 2, x1: l.x + w / 2, y0: y - h, y1: y });
          return { ...l, y, ax: l.x, ay: l.y, moved: dy !== 0, hidden: false };
        }
      }
      return { ...l, ax: l.x, ay: l.y, moved: false, hidden: true };
    });
}

export function CountLabel({ x, y, fs, text }: { x: number; y: number; fs: number; text: string }) {
  const w = labelWidth(text, fs);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect className="count-bg" x={-w / 2} y={-fs * 1.25} width={w} height={fs * 1.6} rx={fs * 0.3} />
      <text className="count-text" fontSize={fs} textAnchor="middle" y={-fs * 0.45} dominantBaseline="middle">
        {text}
      </text>
    </g>
  );
}

/** Draggable vertex handles for one selected drift/row. */
export function VertexHandles({ points, s }: { points: Pt[]; s: number }) {
  const r = 9 / s;
  return (
    <g className="handles">
      {points.map(([x, y], i) => (
        <circle key={i} className="handle" data-handle={i} cx={x} cy={y} r={r} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
}

function glyph(sym: NonNullable<Plant['symbol']>, g: number): string {
  if (sym === 'square') return `M${-g * 0.75} ${-g * 0.75}h${g * 1.5}v${g * 1.5}h${-g * 1.5}z`;
  if (sym === 'triangle') return `M0 ${-g}L${g * 0.9} ${g * 0.6}H${-g * 0.9}z`;
  return `M0 ${-g}L${g} 0L0 ${g}L${-g} 0z`;
}
