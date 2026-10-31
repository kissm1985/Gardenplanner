// Seasonal appearance (SPEC §4.4): colour, opacity and size of a plant in a given month.
import type { Plant } from '../model/types';
import { labelList } from '../i18n';

export type Season = 0 | 1 | 2 | 3; // spring, summer, autumn, winter
export const SEASON_LABEL = labelList([
  ['Tavasz', 'Spring'],
  ['Nyár', 'Summer'],
  ['Ősz', 'Autumn'],
  ['Tél', 'Winter'],
]);
/** Month shown when a season button is pressed. */
export const SEASON_MONTH: Record<Season, number> = { 0: 4, 1: 7, 2: 10, 3: 1 };
export const MONTH_LABEL = labelList([
  ['január', 'January'],
  ['február', 'February'],
  ['március', 'March'],
  ['április', 'April'],
  ['május', 'May'],
  ['június', 'June'],
  ['július', 'July'],
  ['augusztus', 'August'],
  ['szeptember', 'September'],
  ['október', 'October'],
  ['november', 'November'],
  ['december', 'December'],
]);

export const seasonOf = (month: number): Season => (month >= 3 && month <= 5 ? 0 : month >= 6 && month <= 8 ? 1 : month >= 9 && month <= 11 ? 2 : 3);

const GREEN = '#6f9a5a';
const DORMANT = '#9a8a64'; // straw / bare soil tone

export interface Look {
  color: string;
  opacity: number;
  /** Size factor relative to the mature spread. */
  scale: number;
  blooming: boolean;
}

/** Season in which most bloom months fall (null when it does not flower). */
export function bloomSeason(p: Plant): Season | null {
  if (!p.bloomMonths.length) return null;
  const n = [0, 0, 0, 0];
  for (const m of p.bloomMonths) n[seasonOf(m)]++;
  return n.indexOf(Math.max(...n)) as Season;
}

export function plantLook(p: Plant, month: number): Look {
  const s = seasonOf(month);
  const blooming = p.bloomMonths.includes(month);
  const bs = bloomSeason(p);
  let color: string;
  if (p.seasonColors) {
    // K-07 season colours: the bloom season's entry is the flower colour; outside the
    // bloom months of that season show the neighbouring season's foliage instead.
    if (blooming && bs != null) color = p.seasonColors[bs];
    else if (s === bs) color = p.seasonColors[s === 0 ? 2 : s - 1 as Season];
    else color = p.seasonColors[s];
  } else {
    color = blooming ? p.color : s === 3 ? (p.winterInterest ? p.color : DORMANT) : GREEN;
  }

  let opacity = 0.94;
  let scale = 1;
  if (s === 3 && !p.winterInterest) {
    // Not decorative in winter: faded and cut back / bare.
    opacity = 0.35;
    scale = p.isTree ? 1 : 0.55;
  } else if (month === 3 || month === 4) {
    // Early spring growth.
    scale = p.winterInterest || p.isTree ? 0.95 : 0.75;
  } else if (month === 11) {
    scale = p.winterInterest ? 1 : 0.9;
  }
  return { color, opacity, scale, blooming };
}

/** Species blooming / decorative in a month, for the hint line and the side-by-side view. */
export function seasonSummary(plants: Plant[], month: number) {
  const s = seasonOf(month);
  return {
    blooming: plants.filter((p) => p.bloomMonths.includes(month)),
    winter: s === 3 ? plants.filter((p) => p.winterInterest) : [],
  };
}
