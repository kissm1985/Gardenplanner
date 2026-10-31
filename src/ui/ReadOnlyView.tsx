import { useMemo, useState } from 'react';
import { StaticPlan } from '../canvas/StaticPlan';
import { buildBom, chosenItems, fmtFt, fmtInt } from '../engine/bom';
import { decodeShare } from '../engine/io';
import { SEASON_LABEL, SEASON_MONTH, type Season } from '../engine/season';
import { ORIENTATION_LABEL, type Project } from '../model/types';
import { saveProject } from '../store/persist';
import { migrate } from '../store/projectStore';
import { PlantChip } from './PlantChip';
import { t } from '../i18n';
import { localName } from '../i18n/names';
import { plantName } from '../model/plants';

/** Read-only page opened from a share link (#view=…); never touches the local plan unless asked. */
export function ReadOnlyView({ code }: { code: string }) {
  const parsed = useMemo((): { p: Project | null; err: string } => {
    try {
      return { p: migrate(decodeShare(code)), err: '' };
    } catch (e) {
      return { p: null, err: (e as Error).message };
    }
  }, [code]);
  const [areaId, setAreaId] = useState(parsed.p?.areas[0]?.id ?? '');
  const [month, setMonth] = useState<number | null>(null);
  if (!parsed.p) {
    return (
      <main className="welcome">
        <h1>{t('Nem nyitható meg', 'Cannot be opened')}</h1>
        <p className="lead">{parsed.err}</p>
        <a className="btn btn-primary" href={location.pathname}>
          {t('Saját tervem megnyitása', 'Open my own plan')}
        </a>
      </main>
    );
  }
  const p = parsed.p;
  const area = p.areas.find((a) => a.id === areaId) ?? p.areas[0];
  const bom = area ? buildBom(p, [area.id]) : null;

  const adopt = async () => {
    if (!confirm(t('Elmented ezt a tervet ezen a készüléken? A saját, eddigi terved helyére kerül.', 'Save this plan on this device? It replaces your own plan.'))) return;
    await saveProject(p);
    location.href = location.pathname;
  };

  return (
    <div className="readonly">
      <header className="ro-head">
        <div className="eyebrow">{t('Csak olvasható nézet', 'Read-only view')}</div>
        <h1>{p.name}</h1>
        <div className="seg" role="group" aria-label={t('Terület', 'Area')}>
          {p.areas.map((a) => (
            <button key={a.id} type="button" className="chip-btn" aria-pressed={a.id === area?.id} onClick={() => setAreaId(a.id)}>
              {localName(a.name)}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label={t('Évszak', 'Season')}>
          <button type="button" className="chip-btn" aria-pressed={month == null} onClick={() => setMonth(null)}>
            {t('Alap', 'Base')}
          </button>
          {([0, 1, 2, 3] as Season[]).map((s) => (
            <button key={s} type="button" className="chip-btn" aria-pressed={month === SEASON_MONTH[s]} onClick={() => setMonth(SEASON_MONTH[s])}>
              {SEASON_LABEL[s]}
            </button>
          ))}
        </div>
      </header>
      {area && bom && (
        <div className="ro-body">
          <div className="ro-plan">
            <p className="mono muted">
              {area.widthCm} × {area.lengthCm} cm · {ORIENTATION_LABEL[area.orientation]}
              {area.sunUntil ? t(` · napos ${area.sunUntil}`, ` · sun ${area.sunUntil}`) : ''} · {area.variants[0].name}
            </p>
            <StaticPlan area={area} items={chosenItems(area)} plantDb={p.plantDb} month={month} showMature={p.settings.showMatureSize} labelPx={320} />
          </div>
          <div className="ro-list">
            <p className="ro-kpi">
              <b>{t(`${fmtInt(bom.planted)} tő`, `${fmtInt(bom.planted)} plants`)}</b> · {t(`rendelés ${fmtInt(bom.order)} db`, `order ${fmtInt(bom.order)}`)} · {fmtFt(bom.total)}
            </p>
            <ul className="ro-rows">
              {bom.rows.map((r) => (
                <li key={r.plant.code}>
                  <PlantChip p={r.plant} size={26} />
                  <span>
                    {plantName(r.plant)} <i>{r.plant.nameLat}</i>
                  </span>
                  <span className="mono">{t(`${r.planted} tő`, `${r.planted} plants`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <footer className="ro-foot">
        <button type="button" className="btn btn-small" onClick={adopt}>
          {t('Mentés saját tervként', 'Save as my plan')}
        </button>
        <a className="btn btn-small" href={location.pathname}>
          {t('Saját tervem megnyitása', 'Open my own plan')}
        </a>
      </footer>
    </div>
  );
}
