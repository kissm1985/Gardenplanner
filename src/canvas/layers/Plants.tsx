import { memo, useMemo } from 'react';
import { fillPath, fillPolygon } from '../../engine/fill';
import { bbox, centroid } from '../../model/geometry';
import { textOn } from '../../model/plants';
import type { PlacedItem, Plant, Pt } from '../../model/types';

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
export const PlantsLayer = memo(function PlantsLayer({ items, plants, selected, drag, shape, showMature, showSpacing }: Props) {
  return (
    <g className="plants">
      {items.map((raw) => {
        const it = withShape(raw, shape);
        const p = plants.get(it.plantId);
        if (!p) return null;
        const moving = drag?.ids.has(it.id);
        const dx = moving ? drag!.dx : 0;
        const dy = moving ? drag!.dy : 0;
        const r = plantRadius(p, showMature);
        const sel = selected.has(it.id);
        if (it.kind === 'plant')
          return (
            <PlantMark key={it.id} id={it.id} x={it.x + dx} y={it.y + dy} plant={p} r={r} selected={sel} spacing={showSpacing} planted={it.status === 'planted'} />
          );
        return <GroupMark key={it.id} item={it} plant={p} r={r} dx={dx} dy={dy} selected={sel} spacing={showSpacing} />;
      })}
    </g>
  );
});

const PlantMark = memo(function PlantMark({ id, x, y, plant, r, selected, spacing, planted }: {
  id: string;
  x: number;
  y: number;
  plant: Plant;
  r: number;
  selected: boolean;
  spacing: boolean;
  planted: boolean;
}) {
  const tc = textOn(plant.color);
  return (
    <g className={`plant${selected ? ' is-selected' : ''}`} data-id={id} transform={`translate(${x} ${y})`}>
      <Dot plant={plant} r={r} tc={tc} spacing={spacing} />
      {planted && <circle className="plant-planted" cx={r * 0.7} cy={-r * 0.7} r={Math.max(2, r * 0.18)} />}
      {selected && <circle className="select-ring" r={r + Math.max(2, r * 0.12)} vectorEffect="non-scaling-stroke" />}
    </g>
  );
});

/** One plant symbol at the origin: footprint, shape glyph, code. */
function Dot({ plant, r, tc, spacing }: { plant: Plant; r: number; tc: string; spacing: boolean }) {
  const fs = Math.max(3, Math.min(r * 0.75, 14));
  return (
    <>
      {spacing && <circle className="spacing-ring" r={plant.spacingCm / 2} vectorEffect="non-scaling-stroke" />}
      <circle className="plant-body" r={r} fill={plant.color} vectorEffect="non-scaling-stroke" />
      {plant.symbol && plant.symbol !== 'circle' && r >= 6 && (
        <path className="plant-glyph" d={glyph(plant.symbol, r * 0.72)} stroke={tc} vectorEffect="non-scaling-stroke" />
      )}
      {r >= 4 && (
        <text className="plant-code" fontSize={fs} fill={tc} textAnchor="middle" dominantBaseline="central">
          {plant.code}
        </text>
      )}
    </>
  );
}

type Group = Extract<PlacedItem, { kind: 'drift' | 'row' }>;

const GroupMark = memo(function GroupMark({ item, plant, r, dx, dy, selected, spacing }: {
  item: Group;
  plant: Plant;
  r: number;
  dx: number;
  dy: number;
  selected: boolean;
  spacing: boolean;
}) {
  const pts = useMemo(
    () => (item.kind === 'drift' ? fillPolygon(item.polygon, item.spacingCm, item.pattern) : fillPath(item.path, item.spacingCm)),
    [item],
  );
  const tc = textOn(plant.color);
  const outline = (item.kind === 'drift' ? item.polygon : item.path).map((q) => q.join(',')).join(' ');
  return (
    <g className={`group group-${item.kind}${selected ? ' is-selected' : ''}`} data-id={item.id} transform={`translate(${dx} ${dy})`}>
      {item.kind === 'drift' ? (
        <polygon className="drift-area" points={outline} fill={plant.color} stroke={plant.color} vectorEffect="non-scaling-stroke" />
      ) : (
        <polyline className="row-line" points={outline} stroke={plant.color} strokeWidth={Math.max(6, r * 0.5)} />
      )}
      {pts.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <Dot plant={plant} r={r} tc={tc} spacing={spacing} />
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
export function GroupLabels({ items, plants, drag, shape, s }: {
  items: PlacedItem[];
  plants: Map<string, Plant>;
  drag: DragOffset | null;
  shape: ShapeOverride | null;
  s: number;
}) {
  const fs = 11 / s;
  return (
    <g className="group-labels" pointerEvents="none">
      {items.map((raw) => {
        if (raw.kind === 'plant') return null;
        const it = withShape(raw, shape) as Group;
        const p = plants.get(it.plantId);
        if (!p) return null;
        const pts = it.kind === 'drift' ? it.polygon : it.path;
        const moving = drag?.ids.has(it.id);
        const [cx] = centroid(pts);
        const top = bbox(pts).minY;
        const x = cx + (moving ? drag!.dx : 0);
        const y = top + (moving ? drag!.dy : 0) - 6 / s;
        // Stored count is kept in sync by the store; recompute only during a live vertex drag.
        const count =
          it === raw ? it.count : it.kind === 'drift' ? fillPolygon(it.polygon, it.spacingCm, it.pattern).length : fillPath(it.path, it.spacingCm).length;
        const text = `${p.code} × ${count}`;
        return <CountLabel key={it.id} x={x} y={y} fs={fs} text={text} />;
      })}
    </g>
  );
}

export function CountLabel({ x, y, fs, text }: { x: number; y: number; fs: number; text: string }) {
  const w = text.length * fs * 0.62 + fs;
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
