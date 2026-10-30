import { useMemo, useState, type ReactNode } from 'react';
import { StaticPlan } from '../canvas/StaticPlan';
import { fmtFt, fmtInt } from '../engine/bom';
import { compareVariants, type VariantStats } from '../engine/compare';
import { MONTH_LABEL, SEASON_LABEL, SEASON_MONTH, seasonOf, type Season } from '../engine/season';
import type { Area } from '../model/types';
import { activeVariant, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { PlantChip } from './PlantChip';
import { t } from '../i18n';
import { plantName } from '../model/plants';

/** Two variants of the area side by side: plan, count, cost, warnings, per-species difference. */
export function CompareView({ area }: { area: Area }) {
  const project = useProject((s) => s.project)!;
  const month = useUi((s) => s.month);
  const vs = area.variants;
  const firstOther = vs.find((v) => v.id !== area.chosenVariantId) ?? vs[0];
  const [aId, setA] = useState(area.chosenVariantId);
  const [bId, setB] = useState(activeVariant(area).id !== aId ? activeVariant(area).id : firstOther.id);
  const a = vs.find((v) => v.id === aId) ?? vs[0];
  const b = vs.find((v) => v.id === bId) ?? firstOther;
  const cmp = useMemo(() => compareVariants(project, area, a, b), [project, area, a, b]);
  const ui = useUi.getState();

  const pick = (v: string, set: (id: string) => void, label: string) => (
    <select value={v} onChange={(e) => set(e.target.value)} aria-label={label}>
      {vs.map((x) => (
        <option key={x.id} value={x.id}>
          {x.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="compare">
      <header className="cmp-head">
        <div className="eyebrow">{t('Változatok összehasonlítása', 'Comparing variants')} · {area.name}</div>
        <div className="seg" role="group" aria-label={t('Évszak', 'Season')}>
          {([0, 1, 2, 3] as Season[]).map((s) => (
            <button key={s} type="button" className="chip-btn" aria-pressed={seasonOf(month) === s} onClick={() => ui.setMonth(SEASON_MONTH[s])}>
              {SEASON_LABEL[s]}
            </button>
          ))}
          <span className="mono muted">{MONTH_LABEL[month - 1]}</span>
        </div>
        <button type="button" className="btn btn-small" onClick={() => ui.setCompare(false)}>
          {t('← Vissza a tervhez', '← Back to the plan')}
        </button>
      </header>

      <div className="cmp-cols">
        <Column stats={cmp.a} other={cmp.b} area={area} month={month} picker={pick(aId, setA, t('Bal oldali változat', 'Left variant'))} chosen={a.id === area.chosenVariantId} />
        <Column stats={cmp.b} other={cmp.a} area={area} month={month} picker={pick(b.id, setB, t('Jobb oldali változat', 'Right variant'))} chosen={b.id === area.chosenVariantId} />
      </div>

      <div className="tw">
        <table className="bom cmp-table">
          <thead>
            <tr>
              <th>{t('Növény', 'Plant')}</th>
              <th className="m">{a.name}</th>
              <th className="m">{b.name}</th>
              <th className="m">{t('Eltérés', 'Difference')}</th>
            </tr>
          </thead>
          <tbody>
            {cmp.rows.map((r) => {
              const d = r.b - r.a;
              return (
                <tr key={r.plant.code} className={d ? 'is-diff' : ''}>
                  <td>
                    <span className="bom-name">
                      <PlantChip p={r.plant} size={24} />
                      {plantName(r.plant)}
                    </span>
                  </td>
                  <td className="m">{r.a || '–'}</td>
                  <td className="m">{r.b || '–'}</td>
                  <td className="m">{d === 0 ? '=' : d > 0 ? `+${d}` : d}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Column({ stats, other, area, month, picker, chosen }: {
  stats: VariantStats;
  other: VariantStats;
  area: Area;
  month: number;
  picker: ReactNode;
  chosen: boolean;
}) {
  const project = useProject((s) => s.project)!;
  const diff = (x: number, y: number, unit = '') => (x === y ? '' : ` (${x > y ? '+' : '−'}${fmtInt(Math.abs(x - y))}${unit})`);
  return (
    <section className="cmp-col">
      <div className="cmp-pick">
        {picker}
        {chosen && <span className="badge badge-chosen">{t('választott', 'chosen')}</span>}
      </div>
      <StaticPlan area={area} items={stats.variant.items} plantDb={project.plantDb} month={month} showMature={project.settings.showMatureSize} labelPx={170} title={stats.variant.name} />
      {(stats.variant.renders?.length ?? 0) > 0 && (
        <div className="cmp-renders" aria-label={t('Látványképek', 'Visualisations')}>
          {stats.variant.renders!.map((r) => (
            <img key={r.id} src={r.dataUrl} alt={t(`${stats.variant.name} látványképe`, `${stats.variant.name} visualisation`)} loading="lazy" />
          ))}
        </div>
      )}
      <dl className="cmp-stats">
        <dt>{t('Tövek', 'Plants')}</dt>
        <dd>
          {stats.bom.planted}
          <small>{diff(stats.bom.planted, other.bom.planted)}</small>
        </dd>
        <dt>{t('Költség', 'Cost')}</dt>
        <dd>
          {fmtFt(stats.bom.total)}
          <small>{diff(stats.bom.total, other.bom.total, t(' Ft', ' HUF'))}</small>
        </dd>
        <dt>{t('Figyelm.', 'Warnings')}</dt>
        <dd className={stats.errors ? 'warn-text' : ''}>
          {stats.warnings.length}
          {stats.errors ? t(` (${stats.errors} hiba)`, ` (${stats.errors} errors)`) : ''}
        </dd>
      </dl>
      {stats.warnings.length > 0 && (
        <ul className="cmp-warn">
          {stats.warnings.slice(0, 6).map((w) => (
            <li key={w.id} className={`sev-${w.severity}`}>
              {w.message}
            </li>
          ))}
          {stats.warnings.length > 6 && <li className="muted">{t(`… és még ${stats.warnings.length - 6}`, `… and ${stats.warnings.length - 6} more`)}</li>}
        </ul>
      )}
    </section>
  );
}
