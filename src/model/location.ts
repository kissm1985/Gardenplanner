// Where the garden is: the planting schedule's frost warnings and the visualisation brief use it.
// Frost dates are long-term averages, rounded, for information only; any of them can be edited.
import type { Settings } from './types';

export interface MonthDay {
  month: number; // 1–12
  day: number;
}

export interface GardenLocation {
  name: string;
  /** Average date of the last spring frost. */
  lastFrost: MonthDay;
  /** Average date of the first autumn frost. */
  firstFrost: MonthDay;
}

export const DEFAULT_LOCATION: GardenLocation = { name: 'Győr', lastFrost: { month: 4, day: 15 }, firstFrost: { month: 10, day: 25 } };

/** Approximate averages for Hungarian regions (rounded to about a week; local spots can differ a lot). */
export const LOCATION_PRESETS: GardenLocation[] = [
  DEFAULT_LOCATION,
  { name: 'Budapest', lastFrost: { month: 4, day: 10 }, firstFrost: { month: 10, day: 30 } },
  { name: 'Sopron', lastFrost: { month: 4, day: 20 }, firstFrost: { month: 10, day: 20 } },
  { name: 'Pécs', lastFrost: { month: 4, day: 10 }, firstFrost: { month: 10, day: 30 } },
  { name: 'Szeged', lastFrost: { month: 4, day: 10 }, firstFrost: { month: 10, day: 30 } },
  { name: 'Debrecen', lastFrost: { month: 4, day: 20 }, firstFrost: { month: 10, day: 20 } },
  { name: 'Miskolc', lastFrost: { month: 4, day: 25 }, firstFrost: { month: 10, day: 15 } },
];

export const gardenLocation = (s: Settings | undefined): GardenLocation => s?.location ?? DEFAULT_LOCATION;

const valid = (d: MonthDay) => d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= 31;
export const validLocation = (l: GardenLocation) => !!l.name.trim() && valid(l.lastFrost) && valid(l.firstFrost);
