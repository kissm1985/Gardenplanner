import type { JugloneTolerance, Plant, Soil, SunNeed } from './types';

export interface PlantFilter {
  q: string;
  toxic: '' | 'no' | 'yes' | 'unknown';
  hMin: string;
  hMax: string;
  sMin: string;
  sMax: string;
  sun: '' | SunNeed;
  soil: '' | Soil;
  thorny: '' | 'yes' | 'no';
  juglone: '' | JugloneTolerance;
  color: string;
}

export const NO_FILTER: PlantFilter = { q: '', toxic: '', hMin: '', hMax: '', sMin: '', sMax: '', sun: '', soil: '', thorny: '', juglone: '', color: '' };

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export const matchesQuery = (p: Plant, q: string) => {
  const s = q.trim().toLowerCase();
  return !s || p.code.toLowerCase().includes(s) || p.nameHu.toLowerCase().includes(s) || p.nameLat.toLowerCase().includes(s);
};

/** Number of active criteria (search text excluded). */
export const activeFilterCount = (f: PlantFilter) => (Object.keys(f) as (keyof PlantFilter)[]).filter((k) => k !== 'q' && f[k].trim() !== '').length;

export function filterPlants(db: Plant[], f: PlantFilter): Plant[] {
  const [hMin, hMax, sMin, sMax] = [num(f.hMin), num(f.hMax), num(f.sMin), num(f.sMax)];
  const color = f.color.trim().toLowerCase();
  return db.filter(
    (p) =>
      matchesQuery(p, f.q) &&
      (!f.toxic ||
        (f.toxic === 'no' && p.toxic === 'no') ||
        (f.toxic === 'yes' && (p.toxic === 'human' || p.toxic === 'pet' || p.toxic === 'both')) ||
        (f.toxic === 'unknown' && p.toxic === 'unknown')) &&
      (hMin == null || p.maxHeightCm >= hMin) &&
      (hMax == null || p.maxHeightCm <= hMax) &&
      (sMin == null || p.spreadCm >= sMin) &&
      (sMax == null || p.spreadCm <= sMax) &&
      (!f.sun || p.sun.includes(f.sun)) &&
      (!f.soil || !!p.soil?.includes(f.soil)) &&
      (!f.thorny || p.thorny === (f.thorny === 'yes')) &&
      (!f.juglone || p.juglone === f.juglone) &&
      (!color || p.bloomColor.toLowerCase().includes(color) || p.foliageColor.toLowerCase().includes(color)),
  );
}
