import { useMemo } from 'react';
import { plantMap } from '../model/plants';
import type { Area, PlacedItem, Plant } from '../model/types';
import { AreaShapeEl } from './AreaShape';
import { FixturesLayer } from './layers/Fixtures';
import { PlantsLayer } from './layers/Plants';

const NO_SELECTION = new Set<string>();

/**
 * Non-interactive, self-fitting drawing of an area (season side-by-side view, print, export).
 * The viewBox covers the area and its edge strips (wall, fence, paving), not far-away trees.
 */
export function StaticPlan({ area, items, plantDb, month, showMature = true, labelPx = 160, title }: {
  area: Area;
  items: PlacedItem[];
  plantDb: Plant[];
  month?: number | null;
  showMature?: boolean;
  /** Approximate rendered width in px, used to size fixture labels. */
  labelPx?: number;
  title?: string;
}) {
  const plants = useMemo(() => plantMap(plantDb), [plantDb]);
  const strips = area.fixtures.filter((f) => f.type === 'wall' || f.type === 'fence' || f.type === 'paving');
  const m = 10;
  const minX = Math.min(0, ...strips.map((f) => f.x)) - m;
  const minY = Math.min(0, ...strips.map((f) => f.y)) - m;
  const maxX = Math.max(area.widthCm, ...strips.map((f) => f.x + (f.w ?? 0))) + m;
  const maxY = Math.max(area.lengthCm, ...strips.map((f) => f.y + (f.h ?? 0))) + m;
  const w = maxX - minX;
  const h = maxY - minY;
  return (
    <svg className="static-plan" viewBox={`${minX} ${minY} ${w} ${h}`} style={{ aspectRatio: `${w} / ${h}` }} role="img" aria-label={title ?? area.name} preserveAspectRatio="xMidYMid meet">
      <AreaShapeEl area={area} className={`area-bed kind-${area.kind ?? 'bed'}`} />
      <FixturesLayer area={area} scale={labelPx / w} drag={null} selected={null} interactive={false} />
      <AreaShapeEl area={area} className="area-outline" />
      <PlantsLayer items={items} plants={plants} selected={NO_SELECTION} drag={null} shape={null} showMature={showMature} showSpacing={false} month={month} />
    </svg>
  );
}
