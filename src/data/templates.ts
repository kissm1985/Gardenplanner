import { uid } from '../model/ids';
import { DEFAULT_CONSTRAINTS, type Area, type Fixture, type Orientation, type AreaKind, type Pt, type Soil, type SunNeed } from '../model/types';
import { t } from '../i18n';

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
    variants: [{ id: variantId, name: t('A terv', 'Plan A'), items: [], notes: '' }],
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
    get title() {
      return t('Házoldali sáv', 'House-side strip');
    },
    get summary() {
      return t('120 × 1200 cm · déli fekvés · 13:00-ig napos · max. 50 cm', '120 × 1200 cm · facing south · sun until 13:00 · max. 50 cm');
    },
    build: () =>
      makeArea({
        name: t('Házoldali sáv', 'House-side strip'),
        widthCm: 120,
        lengthCm: 1200,
        orientation: 'S',
        sunUntil: t('13:00-ig', 'until 13:00'),
        kind: 'gravel',
        notes: t('Kőkert a ház mellett (K-06 / K-07). Felül a hátsó kerítés, alul a járda.', 'Rock garden along the house (K-06 / K-07). Back fence at the top, pavement at the bottom.'),
        constraints: { maxHeightCm: 50, noThorns: true, nonToxic: true, drip: true, mulchCover: true },
        fixtures: [
          { id: uid('f'), type: 'wall', label: t('Ház', 'House'), x: -16, y: 0, w: 16, h: 1200 },
          { id: uid('f'), type: 'paving', label: t('Járda', 'Pavement'), x: 120, y: 0, w: 30, h: 1200 },
        ],
      }),
  },
  {
    key: 'lawn-garden',
    get title() {
      return t('Gyepsávos kert', 'Garden with lawn strip');
    },
    get summary() {
      return t('500 × 1200 cm · keleti fekvés · 12:00-ig napos · ívelt gyepsáv, max. 2 fa', '500 × 1200 cm · facing east · sun until 12:00 · curved lawn strip, max. 2 trees');
    },
    build: () =>
      makeArea({
        name: t('Gyepsávos kert', 'Garden with lawn strip'),
        widthCm: 500,
        lengthCm: 1200,
        orientation: 'E',
        sunUntil: t('12:00-ig', 'until 12:00'),
        kind: 'bed',
        notes: t('Előkert (K-05 / K-07): középen ívelt gyepsáv, két oldalán ágyás. Legfeljebb 2 fa, 150–200 cm.', 'Front garden (K-05 / K-07): curved lawn strip in the middle, beds on both sides. At most 2 trees, 150–200 cm.'),
        constraints: { noThorns: true, nonToxic: true, drip: true, mulchCover: true, maxTrees: 2 },
        fixtures: [
          { id: uid('f'), type: 'wall', label: t('Ház', 'House'), x: -16, y: 0, w: 16, h: 1200 },
          { id: uid('f'), type: 'fence', label: t('Kerítés', 'Fence'), x: 500, y: 0, w: 6, h: 1200 },
          { id: uid('f'), type: 'lawn', label: t('Gyepsáv', 'Lawn strip'), x: 0, y: 0, polygon: curvedLawn(500, 1200) },
          { id: uid('f'), type: 'tap', label: t('Csap / akna', 'Tap / manhole'), x: 385, y: 4, w: 90, h: 80 },
          // The walnut stands beyond the fence; exact position is not in K-05…K-08, adjust on site.
          { id: uid('f'), type: 'walnut', label: t('Diófa (szomszéd, helye ellenőrizendő)', 'Walnut (neighbour, position to be checked)'), x: 760, y: 600, radius: 450 },
        ],
      }),
  },
];
