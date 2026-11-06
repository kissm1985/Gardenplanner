// Merging a nursery's published catalogue into a project's plant list (PL-BE-04). Pure: the same catalogue and
// plant list always give the same result, so a sync can be repeated safely (online or from the offline copy).
import type { CatalogSpecies, Offer } from '../engine/catalog';
import { blankPlant } from './plants';
import type { Plant, Project } from './types';

export interface NurseryCatalog {
  server: string;
  tenant: string;
  name: string;
  version: number;
  syncedAt: string;
  species: Record<string, CatalogSpecies>;
}

export interface MergeResult {
  plantDb: Plant[];
  /** Species added to the plant list from the catalogue. */
  added: string[];
  /** Plants whose nursery price or stock changed. */
  updated: string[];
  /** Species the nursery no longer offers, with how many plants of them the plan has. */
  gone: { code: string; name: string; placed: number }[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/** The offer that fits the plant: the same pot size if there is one, else the cheapest. */
export function offerFor(p: Pick<Plant, 'pot'>, offers: Offer[]): Offer | undefined {
  return offers.find((o) => norm(o.pot) === norm(p.pot)) ?? [...offers].sort((a, b) => a.priceHuf - b.priceHuf)[0];
}

const hue = (code: string) => [...code].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

function fromCatalog(s: CatalogSpecies, nursery: string): Plant {
  const spread = s.spreadCm ?? 40;
  const first = [...s.offers].sort((a, b) => a.priceHuf - b.priceHuf)[0];
  return {
    ...blankPlant(s.code),
    nameHu: s.nameHu,
    ...(s.nameEn ? { nameEn: s.nameEn } : {}),
    nameLat: s.nameLat,
    maxHeightCm: s.maxHeightCm ?? 40,
    spreadCm: spread,
    spacingCm: Math.max(10, Math.round(spread * 0.8)),
    ...(s.sun?.length ? { sun: s.sun } : {}),
    ...(s.water ? { water: s.water } : {}),
    pot: first?.pot ?? 'P9',
    unitPriceHuf: first?.priceHuf ?? 0,
    color: `hsl(${hue(s.code)} 35% 45%)`,
    notes: s.notes ?? '',
    dataSource: nursery,
    verify: ['toxic', 'juglone', 'bloomMonths', 'soil'],
  };
}

const placedCounts = (p: Pick<Project, 'areas'>) => {
  const n = new Map<string, number>();
  for (const a of p.areas) for (const v of a.variants) for (const it of v.items) n.set(it.plantId, (n.get(it.plantId) ?? 0) + ('count' in it ? it.count : 1));
  return n;
};

/**
 * Applies the catalogue: plants it offers get the nursery's price and stock; species it offers that the list lacks
 * are added (the built-in data when the code is a built-in species, else the catalogue's own data); plants it no
 * longer offers lose the nursery price and are reported if the plan uses them. Nothing is deleted.
 */
export function mergeCatalog(project: Pick<Project, 'plantDb' | 'areas'>, cat: NurseryCatalog, seed: (code: string) => Plant | undefined, addMissing = true): MergeResult {
  const placed = placedCounts(project);
  const added: string[] = [];
  const updated: string[] = [];
  const gone: MergeResult['gone'] = [];
  const have = new Set(project.plantDb.map((p) => p.code));
  const plantDb = project.plantDb.map((p) => {
    const s = cat.species[p.code];
    if (!s) {
      if (p.nurseryPrice == null && p.nurseryStock == null) return p;
      if (placed.get(p.code)) gone.push({ code: p.code, name: p.nameHu, placed: placed.get(p.code)! });
      const { nurseryPrice: _p, nurseryStock: _s, ...rest } = p;
      updated.push(p.code);
      return rest;
    }
    const o = offerFor(p, s.offers);
    const next = { ...p, nurseryPrice: o?.priceHuf, nurseryStock: o?.stock };
    if (next.nurseryPrice == null) delete next.nurseryPrice;
    if (next.nurseryStock == null) delete next.nurseryStock;
    if (next.nurseryPrice !== p.nurseryPrice || next.nurseryStock !== p.nurseryStock) updated.push(p.code);
    return next;
  });
  if (addMissing)
    for (const s of Object.values(cat.species).sort((a, b) => a.code.localeCompare(b.code))) {
      if (have.has(s.code)) continue;
      const base = seed(s.code) ?? fromCatalog(s, cat.name);
      const o = offerFor(base, s.offers);
      plantDb.push({ ...base, ...(o ? { nurseryPrice: o.priceHuf } : {}), ...(o?.stock != null ? { nurseryStock: o.stock } : {}) });
      added.push(s.code);
    }
  return { plantDb, added, updated, gone };
}
