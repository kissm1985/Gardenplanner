// Data model (SPEC §6). All coordinates are in cm, origin = top-left corner of the area,
// x along the width, y along the length. Derived values (counts, cost, warnings) are never stored.

export type Pt = [number, number];

export type Orientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type SunNeed = 'sun' | 'part' | 'shade';
export type WaterNeed = 'low' | 'medium' | 'high';
export type Toxicity = 'no' | 'human' | 'pet' | 'both' | 'unknown';
export type JugloneTolerance = 'tolerant' | 'sensitive' | 'unknown';
export type ItemStatus = 'needed' | 'ordered' | 'owned' | 'planted';

export interface Plant {
  code: string; // 2 letters, unique within the project
  nameHu: string;
  nameLat: string;
  maxHeightCm: number;
  spreadCm: number;
  spacingCm: number;
  sun: SunNeed[];
  water: WaterNeed;
  toxic: Toxicity;
  thorny: boolean;
  juglone: JugloneTolerance;
  bloomMonths: number[]; // 1–12
  bloomColor: string;
  foliageColor: string;
  winterInterest: boolean;
  /** Colours per season [spring, summer, autumn, winter] for the season view. */
  seasonColors?: [string, string, string, string];
  pot: string;
  unitPriceHuf: number;
  priceSource?: 'shop' | 'estimate';
  color: string;
  symbol?: 'circle' | 'square' | 'triangle' | 'diamond';
  isTree?: boolean;
  notes: string;
  /** Field names whose values still need checking ("ellenőrizendő"). */
  verify?: (keyof Plant)[];
}

export interface Constraints {
  maxHeightCm: number | null;
  noThorns: boolean;
  nonToxic: boolean;
  drip: boolean;
  mulchCover: boolean;
  maxTrees: number | null;
  /** Optional per-species limit, e.g. { LA: 12 }. */
  speciesLimits: Record<string, number>;
}

export type FixtureType =
  | 'walnut'
  | 'window'
  | 'tap'
  | 'manhole'
  | 'paving'
  | 'fence'
  | 'tree'
  | 'lawn'
  | 'wall'
  | 'other';

export interface Fixture {
  id: string;
  type: FixtureType;
  label?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  radius?: number;
  /** Free shape (e.g. curved lawn strip); coordinates are absolute in the area. */
  polygon?: Pt[];
}

export type PlacedItem =
  | { kind: 'plant'; id: string; plantId: string; x: number; y: number; status: ItemStatus; note?: string }
  | {
      kind: 'drift';
      id: string;
      plantId: string;
      polygon: Pt[];
      pattern: 'grid' | 'staggered';
      spacingCm: number;
      count: number;
      status: ItemStatus;
      note?: string;
    }
  | { kind: 'row'; id: string; plantId: string; path: Pt[]; spacingCm: number; count: number; status: ItemStatus; note?: string };

export interface Variant {
  id: string;
  name: string;
  items: PlacedItem[];
  notes: string;
  /** Warning ids the user accepted as deliberate exceptions. */
  muted?: string[];
}

export interface Background {
  dataUrl: string;
  opacity: number;
  x: number;
  y: number;
  widthCm: number;
}

export type AreaShape = { kind: 'rect' } | { kind: 'polygon'; points: Pt[] };

export interface Area {
  id: string;
  name: string;
  widthCm: number;
  lengthCm: number;
  orientation: Orientation;
  sunUntil: string;
  /** Overrides the sun level derived from orientation + sunUntil. */
  sunLevel?: SunNeed;
  notes: string;
  shape: AreaShape;
  constraints: Constraints;
  fixtures: Fixture[];
  variants: Variant[];
  /** The variant the final list and print are made from. */
  chosenVariantId: string;
  /** The variant being edited on the plan (defaults to the chosen one). */
  activeVariantId?: string;
  background?: Background;
}

export interface Settings {
  reservePct: number;
  walnutRadiusCm: number;
  showMatureSize: boolean;
}

export interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  areas: Area[];
  plantDb: Plant[];
  settings: Settings;
}

export const ORIENTATION_LABEL: Record<Orientation, string> = {
  N: 'észak',
  NE: 'északkelet',
  E: 'kelet',
  SE: 'délkelet',
  S: 'dél',
  SW: 'délnyugat',
  W: 'nyugat',
  NW: 'északnyugat',
};

export const DEFAULT_SETTINGS: Settings = { reservePct: 10, walnutRadiusCm: 1500, showMatureSize: true };

export const DEFAULT_CONSTRAINTS: Constraints = {
  maxHeightCm: null,
  noThorns: false,
  nonToxic: false,
  drip: false,
  mulchCover: false,
  maxTrees: null,
  speciesLimits: {},
};
