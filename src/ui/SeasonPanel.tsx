import { useMemo } from 'react';
import { chosenItems } from '../engine/bom';
import { MONTH_LABEL, SEASON_LABEL, SEASON_MONTH, seasonOf, seasonSummary, type Season } from '../engine/season';
import type { Area, Plant } from '../model/types';
import { StaticPlan } from '../canvas/StaticPlan';
import { useUi } from '../store/uiStore';

/** Species of the area, for the hint line. */
function usedPlants(area: Area, plantDb: Plant[]) {
  const codes = new Set(chosenItems(area).map((i) => i.plantId));
  return plantDb.filter((p) => codes.has(p.code));
}

const names = (ps: Plant[]) => ps.map((p) => p.nameHu.toLowerCase()).join(', ');

function hint(ps: Plant[], month: number): string {
  const { blooming, winter } = seasonSummary(ps, month);
  const parts: string[] = [];
  if (blooming.length) parts.push(`Virágzik: ${names(blooming)}.`);
  if (winter.length) parts.push(`Télen is díszít: ${names(winter)}.`);
  if (!parts.length) parts.push(ps.length ? 'Ebben a hónapban nincs virágzó faj a területen.' : 'Még nincs növény a területen.');
  return parts.join(' ');
}

/** Docked season controls: four season buttons, month slider, what blooms, side-by-side toggle. */
export function SeasonPanel({ area, plantDb }: { area: Area; plantDb: Plant[] }) {
  const month = useUi((s) => s.month);
  const fourUp = useUi((s) => s.fourUp);
  const ui = useUi.getState();
  const ps = useMemo(() => usedPlants(area, plantDb), [area, plantDb]);
  const season = seasonOf(month);
  return (
    <section className="season-panel" aria-label="Évszaknézet">
      <div className="season-btns" role="group" aria-label="Évszak">
        {([0, 1, 2, 3] as Season[]).map((s) => (
          <button key={s} type="button" className="chip-btn" aria-pressed={!fourUp && season === s} onClick={() => (ui.setMonth(SEASON_MONTH[s]), ui.setFourUp(false))}>
            {SEASON_LABEL[s]}
          </button>
        ))}
        <button type="button" className="chip-btn" aria-pressed={fourUp} onClick={() => ui.setFourUp(!fourUp)}>
          4 egymás mellett
        </button>
      </div>
      {!fourUp && (
        <>
          <label className="month-slider">
            <span className="mono">{MONTH_LABEL[month - 1]}</span>
            <input type="range" min={1} max={12} step={1} value={month} onChange={(e) => ui.setMonth(+e.target.value)} aria-label="Hónap" />
          </label>
          <p className="season-hint" role="status">
            {hint(ps, month)}
          </p>
        </>
      )}
    </section>
  );
}

/** The area in all four seasons side by side (comparison and print). */
export function FourSeasons({ area, plantDb, showMature }: { area: Area; plantDb: Plant[]; showMature: boolean }) {
  const items = chosenItems(area);
  const ps = useMemo(() => usedPlants(area, plantDb), [area, plantDb]);
  const wide = area.widthCm > area.lengthCm * 0.6;
  return (
    <div className={`four-seasons${wide ? ' is-wide' : ''}`}>
      {([0, 1, 2, 3] as Season[]).map((s) => {
        const m = SEASON_MONTH[s];
        return (
          <figure key={s} className="four-cell">
            <figcaption>
              <b>{SEASON_LABEL[s]}</b> <span className="mono muted">{MONTH_LABEL[m - 1]}</span>
            </figcaption>
            <StaticPlan area={area} items={items} plantDb={plantDb} month={m} showMature={showMature} title={`${area.name}, ${SEASON_LABEL[s].toLowerCase()}`} />
            <p className="four-hint">{hint(ps, m)}</p>
          </figure>
        );
      })}
    </div>
  );
}
