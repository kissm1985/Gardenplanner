import { useState } from 'react';
import type { MixPart } from '../engine/mix';
import { areaSunLevel } from '../engine/rules';
import { matchesQuery } from '../model/plantFilter';
import { plantName, SUN_LABEL } from '../model/plants';
import type { Area, Plant } from '../model/types';
import { PlantChip } from './PlantChip';
import { t } from '../i18n';

/** Why a plant does not suit the area (empty = fits). */
export function misfit(area: Area, p: Plant): string[] {
  const c = area.constraints;
  const out: string[] = [];
  const sun = areaSunLevel(area);
  if (!p.sun.includes(sun)) out.push(t(`nem ${SUN_LABEL[sun]}i`, `not for ${SUN_LABEL[sun]}`));
  if (c.maxHeightCm != null && p.maxHeightCm > c.maxHeightCm) out.push(t(`magasabb ${c.maxHeightCm} cm-nél`, `taller than ${c.maxHeightCm} cm`));
  if (c.nonToxic && p.toxic !== 'no') out.push(p.toxic === 'unknown' ? t('mérgezősége nem ismert', 'toxicity unknown') : t('mérgező', 'toxic'));
  if (c.noThorns && p.thorny) out.push(t('tüskés', 'thorny'));
  if (area.soil && p.soil?.length && !p.soil.includes(area.soil)) out.push(t('más talajt kedvel', 'prefers other soil'));
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
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Keresés: név, latin név, kód', 'Search: name, Latin name, code')} aria-label={t('Növény keresése a listában', 'Search plants in the list')} />
      </label>
      {picked.length > 0 && (
        <ul className="picked-list" aria-label={t('Kiválasztott növények', 'Chosen plants')}>
          {picked.map((x) => {
            const p = byCode.get(x.code);
            if (!p) return null;
            return (
              <li key={x.code} className="picked-item">
                <PlantChip p={p} size={26} />
                <span className="picked-name">{plantName(p)}</span>
                {picked.length > 1 && (
                  <label className="picked-weight">
                    <span className="mono muted">{t('arány', 'share')}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={99}
                      value={x.weight}
                      aria-label={t(`${plantName(p)} aránya`, `${plantName(p)} share`)}
                      onChange={(e) => onChange(picked.map((y) => (y.code === x.code ? { ...y, weight: Math.max(1, Math.min(99, +e.target.value || 1)) } : y)))}
                    />
                  </label>
                )}
                <button type="button" className="icon-btn" aria-label={t(`${plantName(p)} eltávolítása`, `Remove ${plantName(p)}`)} onClick={() => toggle(x.code)}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ul className="replace-list" role="listbox" aria-multiselectable="true" aria-label={t('Választható növények', 'Plants to choose from')}>
        {list.map(({ p, tag, bad }) => (
          <li key={p.code}>
            <button type="button" role="option" aria-selected={isPicked(p.code)} className={`plant-row${isPicked(p.code) ? ' is-picked' : ''}`} onClick={() => toggle(p.code)}>
              <PlantChip p={p} size={30} />
              <span className="plant-row-text">
                <b>
                  {isPicked(p.code) ? '✓ ' : ''}
                  {plantName(p)}
                </b>
                <span className="mono muted">
                  {t(`${p.maxHeightCm} cm · tőtáv ${p.spacingCm} cm`, `${p.maxHeightCm} cm · spacing ${p.spacingCm} cm`)}
                  {tag ? ` · ${tag}` : ''}
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
