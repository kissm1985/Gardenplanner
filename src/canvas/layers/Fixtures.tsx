import { memo } from 'react';
import type { Area, Fixture, FixtureType, Settings } from '../../model/types';

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** Fixtures that can be grabbed on the plan. Strips (wall, fence, paving) and the lawn are edited in the list. */
export const DRAGGABLE: ReadonlySet<FixtureType> = new Set(['walnut', 'tree', 'window', 'tap', 'manhole', 'other']);

export interface FixtureDrag {
  id: string;
  dx: number;
  dy: number;
}

const shifted = (f: Fixture, d: FixtureDrag | null): Fixture => (d && d.id === f.id ? { ...f, x: f.x + d.dx, y: f.y + d.dy } : f);

/** Fixed (non-plant) elements: lawn, wall, fence, paving, tap, trees. */
export const FixturesLayer = memo(function FixturesLayer({ area, scale, drag, selected, interactive }: {
  area: Area;
  scale: number;
  drag: FixtureDrag | null;
  selected: string | null;
  interactive: boolean;
}) {
  const fs = 10 / scale;
  // Lawn first so it sits beneath everything else.
  const sorted = [...area.fixtures].sort((a, b) => (a.type === 'lawn' ? -1 : 0) - (b.type === 'lawn' ? -1 : 0));
  return (
    <g className="fixtures">
      {sorted.map((f) => (
        <FixtureShape key={f.id} f={shifted(f, drag)} fs={fs} selected={f.id === selected} interactive={interactive && DRAGGABLE.has(f.type)} />
      ))}
    </g>
  );
});

function FixtureShape({ f, fs, selected, interactive }: { f: Fixture; fs: number; selected: boolean; interactive: boolean }) {
  const label = f.label ?? '';
  const cls = `fx fx-${f.type}${selected ? ' is-selected' : ''}${interactive ? ' is-interactive' : ''}`;
  const hit = interactive ? { 'data-fixture': f.id } : { pointerEvents: 'none' as const };
  if (f.polygon) {
    return <polygon className={cls} points={pts(f.polygon)} vectorEffect="non-scaling-stroke" pointerEvents="none" />;
  }
  if (f.type === 'walnut' || f.type === 'tree') {
    const r = f.radius ?? 200;
    return (
      <g className={cls} {...hit}>
        <circle className="fx-crown" cx={f.x} cy={f.y} r={r} vectorEffect="non-scaling-stroke" />
        <circle className="fx-trunk" cx={f.x} cy={f.y} r={Math.max(15, r * 0.06)} />
        <text x={f.x} y={f.y - r * 0.12} textAnchor="middle" fontSize={fs * 1.1} className="fx-label">
          {label}
        </text>
      </g>
    );
  }
  if (f.type === 'tap' || f.type === 'manhole' || f.type === 'window' || f.type === 'other') {
    const w = f.w ?? 40;
    const h = f.h ?? 40;
    return (
      <g className={cls} {...hit}>
        <rect x={f.x} y={f.y} width={w} height={h} vectorEffect="non-scaling-stroke" />
        <text x={f.x + w / 2} y={f.y + h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={fs} className="fx-label">
          {label}
        </text>
      </g>
    );
  }
  // Long strips (wall, fence, paving): label runs along the strip.
  const w = f.w ?? 10;
  const h = f.h ?? 10;
  const vertical = h >= w;
  return (
    <g className={cls} pointerEvents="none">
      <rect x={f.x} y={f.y} width={w} height={h} vectorEffect="non-scaling-stroke" />
      <text
        transform={`translate(${f.x + w / 2} ${f.y + h / 2})${vertical ? ' rotate(-90)' : ''}`}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fs}
        className="fx-label fx-strip-label"
      >
        {label.toUpperCase()}
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
