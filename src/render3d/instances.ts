// The plants of a plan, one by one (spec v0.2 F1): single plants keep their own id; plants of a drift or row get
// `<item id>#<n>` in the order the fill engine places them, so the 2D plan, the list and the 3D render count the
// same plants at the same positions. Nothing is invented: the positions are the ones the app draws.
import { itemPositions } from '../engine/fill';
import { plantName } from '../model/plants';
import type { Area, PlacedItem, Plant, Pt } from '../model/types';

export interface PlantInstance {
  plant_id: string;
  species_id: string;
  species_name: string;
  /** Position in cm from the area's top-left corner (x along the width, y along the length). */
  xCm: number;
  yCm: number;
  heightCm: number;
  spreadCm: number;
  color: string;
  isTree: boolean;
  /** Body form of the 3D model (from the species: tree flag, genus, proportions). */
  form: PlantForm;
}

export type PlantForm = 'tree' | 'conifer' | 'columnar' | 'grass' | 'spike' | 'cushion' | 'shrub' | 'mound';

const CONIFERS = new Set(['Taxus', 'Thuja', 'Picea', 'Pinus', 'Juniperus', 'Chamaecyparis', 'Cedrus', 'Taxodium', 'Microbiota']);
const GRASSES = new Set(['Miscanthus', 'Pennisetum', 'Stipa', 'Calamagrostis', 'Festuca', 'Carex', 'Molinia', 'Hakonechloa', 'Helictotrichon']);
/** Perennials that flower in upright spikes or tall stems. */
const SPIKES = new Set([
  'Salvia',
  'Veronica',
  'Lavandula',
  'Agastache',
  'Allium',
  'Iris',
  'Gaura',
  'Astilbe',
  'Hemerocallis',
  'Nepeta',
  'Stachys',
  'Echinacea',
  'Rudbeckia',
  'Leucanthemum',
  'Achillea',
  'Phlox',
  'Coreopsis',
  'Narcissus',
]);

/** The model's form: a data-driven choice (no species is hard-coded by code, only genera by habit). */
export function plantForm(p: Pick<Plant, 'isTree' | 'nameLat' | 'maxHeightCm' | 'spreadCm'>): PlantForm {
  const genus = p.nameLat.trim().split(/\s+/)[0];
  const slender = p.maxHeightCm > p.spreadCm * 2.2;
  if (CONIFERS.has(genus)) return p.isTree || slender ? (slender ? 'columnar' : 'conifer') : p.maxHeightCm < 60 ? 'cushion' : 'shrub';
  if (p.isTree) return 'tree'; // a slender deciduous tree gets a tall, narrow crown (from its own height and spread)
  if (GRASSES.has(genus)) return 'grass';
  if (p.maxHeightCm <= 25 && p.spreadCm >= p.maxHeightCm) return 'cushion';
  if (SPIKES.has(genus)) return 'spike';
  if (p.maxHeightCm >= 100) return 'shrub';
  return 'mound';
}

export function plantInstances(items: PlacedItem[], plantDb: Plant[]): PlantInstance[] {
  const byCode = new Map(plantDb.map((p) => [p.code, p]));
  const out: PlantInstance[] = [];
  for (const it of items) {
    const p = byCode.get(it.plantId);
    if (!p) continue; // a plant without species data is not drawn anywhere in the app either
    const pts: Pt[] = itemPositions(it);
    pts.forEach(([x, y], i) =>
      out.push({
        plant_id: it.kind === 'plant' ? it.id : `${it.id}#${i + 1}`,
        species_id: p.code,
        species_name: plantName(p),
        xCm: x,
        yCm: y,
        heightCm: p.maxHeightCm,
        spreadCm: it.kind === 'plant' && it.spreadCm ? it.spreadCm : p.spreadCm,
        color: p.color,
        isTree: !!p.isTree,
        form: plantForm(p),
      }),
    );
  }
  return out;
}

/** Outline of the area in cm (closed ring, without repeating the first point). */
export function areaOutline(area: Pick<Area, 'shape' | 'widthCm' | 'lengthCm'>, segments = 96): Pt[] {
  const w = area.widthCm;
  const h = area.lengthCm;
  if (area.shape.kind === 'polygon') return area.shape.points;
  if (area.shape.kind === 'ellipse')
    return Array.from({ length: segments }, (_, i) => {
      const a = (i / segments) * 2 * Math.PI;
      return [w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)] as Pt;
    });
  return [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
}
