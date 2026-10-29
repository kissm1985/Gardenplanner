import { uid } from '../model/ids';
import { DEFAULT_CONSTRAINTS, type Area, type Fixture, type Orientation, type AreaKind, type Pt, type Soil, type SunNeed } from '../model/types';

export interface AreaInput {
  name: string;
  widthCm: number;
  lengthCm: number;
  orientation: Orientation;
  sunUntil: string;
  sunLevel?: SunNeed;
  soil?: Soil;
  kind?: AreaKind;
  notes: string;
  constraints?: Partial<Area['constraints']>;
  fixtures?: Fixture[];
}

export function makeArea(input: AreaInput): Area {
  const variantId = uid('v');
  return {
    id: uid('a'),
    name: input.name,
    widthCm: input.widthCm,
    lengthCm: input.lengthCm,
    orientation: input.orientation,
    sunUntil: input.sunUntil,
    ...(input.sunLevel ? { sunLevel: input.sunLevel } : {}),
    ...(input.soil ? { soil: input.soil } : {}),
    ...(input.kind ? { kind: input.kind } : {}),
    notes: input.notes,
    shape: { kind: 'rect' },
    constraints: { ...DEFAULT_CONSTRAINTS, ...input.constraints, speciesLimits: { ...input.constraints?.speciesLimits } },
    fixtures: input.fixtures ?? [],
    variants: [{ id: variantId, name: 'A terv', items: [], notes: '' }],
    chosenVariantId: variantId,
  };
}

/**
 * Curved lawn strip of the K-07 front garden: two sine-shaped edges, ~120 cm beds on both sides.
 * Same formula as K-07 (amplitude 42 cm, period 1500 cm), converted to top-left origin.
 */
export function curvedLawn(widthCm: number, lengthCm: number, bedCm = 120, amp = 42, period = 1500, phase = 1.5): Pt[] {
  const c = (v: number) => amp * Math.sin((2 * Math.PI * v) / period + phase);
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let v = 0; v <= lengthCm; v += 20) {
    const y = lengthCm - v; // K-07 measured v from the sidewalk (bottom)
    left.push([round1(bedCm + c(v)), y]);
    right.push([round1(widthCm - bedCm + c(v)), y]);
  }
  return [...left, ...right.reverse()];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface AreaTemplate {
  key: string;
  title: string;
  summary: string;
  build: () => Area;
}

export const AREA_TEMPLATES: AreaTemplate[] = [
  {
    key: 'house-strip',
    title: 'Házoldali sáv',
    summary: '120 × 1200 cm · déli fekvés · 13:00-ig napos · max. 50 cm',
    build: () =>
      makeArea({
        name: 'Házoldali sáv',
        widthCm: 120,
        lengthCm: 1200,
        orientation: 'S',
        sunUntil: '13:00-ig',
        kind: 'gravel',
        notes: 'Kőkert a ház mellett (K-06 / K-07). Felül a hátsó kerítés, alul a járda.',
        constraints: { maxHeightCm: 50, noThorns: true, nonToxic: true, drip: true, mulchCover: true },
        fixtures: [
          { id: uid('f'), type: 'wall', label: 'Ház', x: -16, y: 0, w: 16, h: 1200 },
          { id: uid('f'), type: 'paving', label: 'Járda', x: 120, y: 0, w: 30, h: 1200 },
        ],
      }),
  },
  {
    key: 'lawn-garden',
    title: 'Gyepsávos kert',
    summary: '500 × 1200 cm · keleti fekvés · 12:00-ig napos · ívelt gyepsáv, max. 2 fa',
    build: () =>
      makeArea({
        name: 'Gyepsávos kert',
        widthCm: 500,
        lengthCm: 1200,
        orientation: 'E',
        sunUntil: '12:00-ig',
        kind: 'bed',
        notes: 'Előkert (K-05 / K-07): középen ívelt gyepsáv, két oldalán ágyás. Legfeljebb 2 fa, 150–200 cm.',
        constraints: { noThorns: true, nonToxic: true, drip: true, mulchCover: true, maxTrees: 2 },
        fixtures: [
          { id: uid('f'), type: 'wall', label: 'Ház', x: -16, y: 0, w: 16, h: 1200 },
          { id: uid('f'), type: 'fence', label: 'Kerítés', x: 500, y: 0, w: 6, h: 1200 },
          { id: uid('f'), type: 'lawn', label: 'Gyepsáv', x: 0, y: 0, polygon: curvedLawn(500, 1200) },
          { id: uid('f'), type: 'tap', label: 'Csap / akna', x: 385, y: 4, w: 90, h: 80 },
          // The walnut stands beyond the fence; exact position is not in K-05…K-08, adjust on site.
          { id: uid('f'), type: 'walnut', label: 'Diófa (szomszéd, helye ellenőrizendő)', x: 760, y: 600, radius: 450 },
        ],
      }),
  },
];
