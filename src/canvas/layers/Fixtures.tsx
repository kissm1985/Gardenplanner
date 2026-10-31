import { useUi } from '../../store/uiStore';
import { memo } from 'react';
import { MOVE_WHEN_SELECTED, ROUND } from '../../model/fixtures';
import { localName } from '../../i18n/names';
import type { Area, Fixture, FixtureType, Pt, Settings } from '../../model/types';

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** Point-like fixtures that move as soon as they are grabbed; the larger ones move once selected (MOVE_WHEN_SELECTED). */
export const DRAGGABLE: ReadonlySet<FixtureType> = new Set(['walnut', 'tree', 'window', 'tap', 'manhole', 'other', 'well', 'compost', 'rainBarrel', 'bench']);

export interface FixtureDrag {
  id: string;
  dx: number;
  dy: number;
  /** Live size while resizing. */
  w?: number;
  h?: number;
  radius?: number;
}

/** Rough size for drawing order (trees count by trunk only: their crown does not catch taps). */
const footprint = (f: Fixture) => (f.polygon ? Infinity : f.radius != null ? 0 : (f.w ?? 40) * (f.h ?? 40));

const shifted = (f: Fixture, d: FixtureDrag | null): Fixture =>
  d && d.id === f.id
    ? {
        ...f,
        x: f.x + d.dx,
        y: f.y + d.dy,
        ...(d.w != null ? { w: d.w, h: d.h } : {}),
        ...(d.radius != null ? { radius: d.radius } : {}),
        ...(f.polygon && (d.dx || d.dy) ? { polygon: f.polygon.map(([x, y]) => [x + d.dx, y + d.dy] as Pt) } : {}),
      }
    : f;

/** Fixed (non-plant) elements: lawn, wall, fence, paving, tap, trees, pond, shed… All can be selected on the plan. */
export const FixturesLayer = memo(function FixturesLayer({ area, scale, drag, selected, interactive }: {
  area: Area;
  scale: number;
  drag: FixtureDrag | null;
  selected: string | null;
  interactive: boolean;
}) {
  const fs = 10 / scale;
  // Lawn first so it sits beneath everything else.
  // The lawn being reshaped is drawn by the shape editor instead.
  const editingLawn = useUi((s) => (s.shapeEdit?.target?.kind === 'lawn' ? s.shapeEdit.target.fixtureId : undefined));
  // Lawn first, then larger elements beneath smaller ones, so every element stays reachable with a tap.
  const sorted = [...area.fixtures]
    .filter((f) => f.id !== editingLawn)
    .sort((a, b) => (a.type === 'lawn' ? -1 : 0) - (b.type === 'lawn' ? -1 : 0) || footprint(b) - footprint(a));
  const sel = interactive && selected ? sorted.find((f) => f.id === selected) : undefined;
  return (
    <g className="fixtures">
      {sorted.map((f) => (
        <FixtureShape key={f.id} f={shifted(f, drag)} fs={fs} selected={f.id === selected} interactive={interactive} />
      ))}
      {sel && !sel.polygon && <ResizeHandle f={shifted(sel, drag)} scale={scale} />}
    </g>
  );
});

/** Screen px the resize handle sits outside the corner, so small elements can still be grabbed in the middle. */
export const RESIZE_OFFSET_PX = 12;

/** Corner handle of the selected element: drag to resize (radius for trees). */
function ResizeHandle({ f, scale }: { f: Fixture; scale: number }) {
  const o = RESIZE_OFFSET_PX / scale;
  const [x, y] = f.radius != null ? [f.x + f.radius + o, f.y] : [f.x + (f.w ?? 0) + o, f.y + (f.h ?? 0) + o];
  return (
    <g className="fx-resize">
      <circle cx={x} cy={y} r={7 / scale} />
      <circle cx={x} cy={y} r={14 / scale} className="fx-resize-hit" data-fx-resize={f.id} />
    </g>
  );
}

function FixtureShape({ f, fs, selected, interactive }: { f: Fixture; fs: number; selected: boolean; interactive: boolean }) {
  const label = localName(f.label);
  const cls = `fx fx-${f.type}${selected ? ' is-selected' : ''}${interactive ? ' is-interactive' : ''}${MOVE_WHEN_SELECTED.has(f.type) && !selected ? ' is-fixed' : ''}`;
  const hit = interactive ? { 'data-fixture': f.id } : { pointerEvents: 'none' as const };
  if (f.polygon) {
    return (
      <g className={cls} {...hit}>
        <polygon className="fx-lawn" points={pts(f.polygon)} vectorEffect="non-scaling-stroke" />
      </g>
    );
  }
  if (f.type === 'walnut' || f.type === 'tree') {
    const r = f.radius ?? 200;
    return (
      <g className={cls} {...hit}>
        {/* Only the trunk catches taps, so elements under the crown can still be selected. */}
        <circle className="fx-crown" cx={f.x} cy={f.y} r={r} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        <circle className="fx-trunk" cx={f.x} cy={f.y} r={Math.max(15, r * 0.06)} />
        {interactive && <circle className="fx-trunk-hit" cx={f.x} cy={f.y} r={Math.max(15, r * 0.06, fs * 2.2)} />}
        <text x={f.x} y={f.y - r * 0.12} textAnchor="middle" fontSize={fs * 1.1} className="fx-label">
          {label}
        </text>
      </g>
    );
  }
  const w = f.w ?? 40;
  const h = f.h ?? 40;
  if (ROUND.has(f.type)) {
    return (
      <g className={cls} {...hit}>
        <ellipse className="fx-body" cx={f.x + w / 2} cy={f.y + h / 2} rx={w / 2} ry={h / 2} vectorEffect="non-scaling-stroke" />
        <text x={f.x + w / 2} y={f.y + h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={fs} className="fx-label">
          {label}
        </text>
      </g>
    );
  }
  // Long strips (wall, fence, paving, path): label runs along the strip. Thin ones get a wider invisible hit area.
  const strip = f.type === 'wall' || f.type === 'fence' || f.type === 'paving' || f.type === 'path';
  const vertical = h >= w;
  return (
    <g className={cls} {...hit}>
      <rect className="fx-body" x={f.x} y={f.y} width={w} height={h} vectorEffect="non-scaling-stroke" />
      {interactive && Math.min(w, h) < 30 && <rect className="fx-hit" x={f.x} y={f.y} width={w} height={h} vectorEffect="non-scaling-stroke" />}
      <text
        transform={`translate(${f.x + w / 2} ${f.y + h / 2})${strip && vertical ? ' rotate(-90)' : ''}`}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fs}
        className={`fx-label${strip ? ' fx-strip-label' : ''}`}
      >
        {strip ? label.toUpperCase() : label}
      </text>
    </g>
  );
}

/** Influence zones drawn under the bed: walnut juglone radius (user setting, default 15 m). */
export const FixtureZonesLayer = memo(function FixtureZonesLayer({ area, settings, drag }: { area: Area; settings: Settings; drag: FixtureDrag | null }) {
  return (
    <g className="zones" pointerEvents="none">
      {area.fixtures
        .filter((f) => f.type === 'walnut')
        .map((raw) => {
          const f = shifted(raw, drag);
          return <circle key={f.id} className="zone-juglone" cx={f.x} cy={f.y} r={settings.walnutRadiusCm} vectorEffect="non-scaling-stroke" />;
        })}
    </g>
  );
});
