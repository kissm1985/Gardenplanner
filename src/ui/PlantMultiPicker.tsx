import { useState } from 'react';
import type { MixPart } from '../engine/mix';
import { areaSunLevel } from '../engine/rules';
import { matchesQuery } from '../model/plantFilter';
import { SUN_LABEL } from '../model/plants';
import type { Area, Plant } from '../model/types';
import { PlantChip } from './PlantChip';

/** Why a plant does not suit the area (empty = fits). */
export function misfit(area: Area, p: Plant): string[] {
  const c = area.constraints;
  const out: string[] = [];
  const sun = areaSunLevel(area);
  if (!p.sun.includes(sun)) out.push(`nem ${SUN_LABEL[sun]}i`);
  if (c.maxHeightCm != null && p.maxHeightCm > c.maxHeightCm) out.push(`magasabb ${c.maxHeightCm} cm-nél`);
  if (c.nonToxic && p.toxic !== 'no') out.push(p.toxic === 'unknown' ? 'mérgezősége nem ismert' : 'mérgező');
  if (c.noThorns && p.thorny) out.push('tüskés');
  if (area.soil && p.soil?.length && !p.soil.includes(area.soil)) out.push('más talajt kedvel');
  return out;
}

export interface PickOption {
  p: Plant;
  /** Short extra note, e.g. "hasonló típus". */
  tag?: string;
  /** Lower sorts first. */
  score: number;
}

/**
 * Search + list to pick one or more plants, each with a relative share ("arány").
 * Tapping a picked plant again removes it.
 */
export function PlantMultiPicker({
  area,
  options,
  picked,
  onChange,
  label,
  max = 8,
}: {
  area: Area;
  options: PickOption[];
  picked: MixPart[];
  onChange: (parts: MixPart[]) => void;
  label: string;
  max?: number;
}) {
  const [q, setQ] = useState('');
  const byCode = new Map(options.map((o) => [o.p.code, o.p]));
  const list = options
    .filter((o) => matchesQuery(o.p, q))
    .map((o) => ({ ...o, bad: misfit(area, o.p) }))
    .sort((a, b) => a.score + (a.bad.length ? 1 : 0) - (b.score + (b.bad.length ? 1 : 0)))
    .slice(0, 40);
  const isPicked = (c: string) => picked.some((x) => x.code === c);
  const toggle = (c: string) => onChange(isPicked(c) ? picked.filter((x) => x.code !== c) : picked.length < max ? [...picked, { code: c, weight: 1 }] : picked);

  return (
    <div className="multi-picker">
      <label className="field">
        <span className="lbl">{label}</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keresés: név, latin név, kód" aria-label="Növény keresése a listában" />
      </label>
      {picked.length > 0 && (
        <ul className="picked-list" aria-label="Kiválasztott növények">
          {picked.map((x) => {
            const p = byCode.get(x.code);
            if (!p) return null;
            return (
              <li key={x.code} className="picked-item">
                <PlantChip p={p} size={26} />
                <span className="picked-name">{p.nameHu}</span>
                {picked.length > 1 && (
                  <label className="picked-weight">
                    <span className="mono muted">arány</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={99}
                      value={x.weight}
                      aria-label={`${p.nameHu} aránya`}
                      onChange={(e) => onChange(picked.map((y) => (y.code === x.code ? { ...y, weight: Math.max(1, Math.min(99, +e.target.value || 1)) } : y)))}
                    />
                  </label>
                )}
                <button type="button" className="icon-btn" aria-label={`${p.nameHu} eltávolítása`} onClick={() => toggle(x.code)}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ul className="replace-list" role="listbox" aria-multiselectable="true" aria-label="Választható növények">
        {list.map(({ p, tag, bad }) => (
          <li key={p.code}>
            <button type="button" role="option" aria-selected={isPicked(p.code)} className={`plant-row${isPicked(p.code) ? ' is-picked' : ''}`} onClick={() => toggle(p.code)}>
              <PlantChip p={p} size={30} />
              <span className="plant-row-text">
                <b>
                  {isPicked(p.code) ? '✓ ' : ''}
                  {p.nameHu}
                </b>
                <span className="mono muted">
                  {p.maxHeightCm} cm · tőtáv {p.spacingCm} cm{tag ? ` · ${tag}` : ''}
                </span>
                {bad.length > 0 && <span className="mono replace-bad">⚠ {bad.join(', ')}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
