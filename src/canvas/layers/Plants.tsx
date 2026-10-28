import { memo } from 'react';
import { textOn } from '../../model/plants';
import type { PlacedItem, Plant } from '../../model/types';

export interface DragOffset {
  ids: Set<string>;
  dx: number;
  dy: number;
}

interface Props {
  items: PlacedItem[];
  plants: Map<string, Plant>;
  selected: Set<string>;
  drag: DragOffset | null;
  showMature: boolean;
  showSpacing: boolean;
}

/** Footprint radius in cm: mature spread, or a small planting-time size. */
export const plantRadius = (p: Plant, mature: boolean) => (mature ? p.spreadCm / 2 : Math.max(4, p.spreadCm * 0.2));

/**
 * All placed plants. Everything is in world units (cm) so a zoom does not re-render this layer;
 * each mark is memoised so dragging re-renders only the moved ones.
 */
export const PlantsLayer = memo(function PlantsLayer({ items, plants, selected, drag, showMature, showSpacing }: Props) {
  return (
    <g className="plants">
      {items.map((it) => {
        if (it.kind !== 'plant') return null;
        const p = plants.get(it.plantId);
        if (!p) return null;
        const moving = drag?.ids.has(it.id);
        return (
          <PlantMark
            key={it.id}
            id={it.id}
            x={it.x + (moving ? drag!.dx : 0)}
            y={it.y + (moving ? drag!.dy : 0)}
            plant={p}
            r={plantRadius(p, showMature)}
            selected={selected.has(it.id)}
            spacing={showSpacing}
            planted={it.status === 'planted'}
          />
        );
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
  const fill = plant.color;
  const tc = textOn(fill);
  const fs = Math.max(3, Math.min(r * 0.75, 14));
  const g = r * 0.72;
  return (
    <g className={`plant${selected ? ' is-selected' : ''}`} data-id={id} transform={`translate(${x} ${y})`}>
      {spacing && <circle className="spacing-ring" r={plant.spacingCm / 2} vectorEffect="non-scaling-stroke" />}
      <circle className="plant-body" r={r} fill={fill} vectorEffect="non-scaling-stroke" />
      {plant.symbol && plant.symbol !== 'circle' && r >= 6 && (
        <path className="plant-glyph" d={glyph(plant.symbol, g)} stroke={tc} vectorEffect="non-scaling-stroke" />
      )}
      {r >= 4 && (
        <text className="plant-code" fontSize={fs} fill={tc} textAnchor="middle" dominantBaseline="central">
          {plant.code}
        </text>
      )}
      {planted && <circle className="plant-planted" cx={r * 0.7} cy={-r * 0.7} r={Math.max(2, r * 0.18)} />}
      {selected && <circle className="select-ring" r={r + Math.max(2, r * 0.12)} vectorEffect="non-scaling-stroke" />}
    </g>
  );
});

function glyph(sym: NonNullable<Plant['symbol']>, g: number): string {
  if (sym === 'square') return `M${-g * 0.75} ${-g * 0.75}h${g * 1.5}v${g * 1.5}h${-g * 1.5}z`;
  if (sym === 'triangle') return `M0 ${-g}L${g * 0.9} ${g * 0.6}H${-g * 0.9}z`;
  return `M0 ${-g}L${g} 0L0 ${g}L${-g} 0z`;
}
