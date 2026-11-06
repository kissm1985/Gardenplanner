import { itemCount } from '../engine/fill';
import { SEED_PLANTS, SEED_SINCE } from '../data/plants.seed';
import { AREA_TEMPLATES } from '../data/templates';
import { uid } from '../model/ids';
import { DEFAULT_SETTINGS, type Area, type PlacedItem, type Project, type Pt, type Variant } from '../model/types';
import { t } from '../i18n';

import type { ProjectState } from './projectState';

export function newProject(templateKeys: string[]): Project {
  const areas = AREA_TEMPLATES.filter((t) => templateKeys.includes(t.key)).map((t) => t.build());
  return { schemaVersion: 1, id: uid('p'), name: t('Kertem', 'My garden'), areas, plantDb: seedPlants(), settings: { ...DEFAULT_SETTINGS } };
}

export const seedPlants = () => SEED_PLANTS.map((p) => ({ ...p }));

/** Upgrade projects saved by earlier builds. */
/** The plan on the canvas is always the chosen one: opening a variant chooses it. */
export const onePlan = (a: Area): Area => (a.activeVariantId && a.activeVariantId !== a.chosenVariantId ? { ...a, chosenVariantId: a.activeVariantId } : a);

export function migrate(p: Project): Project {
  let out = { ...p, areas: p.areas.map(onePlan) };
  if (!out.plantDb?.length) out = { ...out, plantDb: seedPlants() };
  const seedVersion = out.settings?.seedVersion ?? 1;
  if (seedVersion < SEED_VERSION) {
    // Merge the expanded built-in list once: add new species, fill soil on built-in ones.
    // Plants the user edited keep their values; a deleted built-in species stays deleted later.
    const have = new Map(out.plantDb.map((x) => [x.code, x]));
    const seeds = seedPlants();
    const byCode = new Map(seeds.map((x) => [x.code, x]));
    const updated = out.plantDb.map((x) => {
      const seed = byCode.get(x.code);
      if (!seed || seed.nameLat !== x.nameLat) return x;
      // Fill what older builds lacked (soil, English texts); never overwrite the user's values.
      let y = x;
      if (!y.soil?.length) y = { ...y, soil: seed.soil };
      if (!y.nameEn && seed.nameEn) y = { ...y, nameEn: seed.nameEn };
      if (!y.en && seed.en) y = { ...y, en: seed.en };
      return y;
    });
    // Only species newer than the project's list are added, so earlier deletions stick.
    const added = seeds.filter((x) => !have.has(x.code) && (SEED_SINCE[x.code] ?? 2) > seedVersion);
    out = { ...out, plantDb: [...updated, ...added] };
  }
  out = { ...out, settings: { ...DEFAULT_SETTINGS, ...out.settings, seedVersion: Math.max(seedVersion, SEED_VERSION) } };
  return out;
}

/** Bump when the built-in plant list grows. */
export const SEED_VERSION = 5;

/** Copy with a new parent; a missing parent removes the field (top level). */
export function withParent<T extends { parentId?: string }>(x: T, parentId: string | undefined): T {
  const { parentId: _old, ...rest } = x;
  void _old;
  return (parentId ? { ...rest, parentId } : rest) as T;
}

export const activeVariant = (a: Area): Variant => a.variants.find((v) => v.id === (a.activeVariantId ?? a.chosenVariantId)) ?? a.variants[0];

/** Next free plan name: "A terv", "B terv", … ("Plan A", "Plan B" in English). */
export function nextVariantName(vs: Variant[]): string {
  const used = new Set(vs.map((v) => v.name));
  const name = (c: string) => t(`${c} terv`, `Plan ${c}`);
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(name(c))) return name(c);
  return t(`${vs.length + 1}. terv`, `Plan ${vs.length + 1}`);
}

export function translateItem(it: PlacedItem, dx: number, dy: number): PlacedItem {
  switch (it.kind) {
    case 'plant':
      return { ...it, x: it.x + dx, y: it.y + dy };
    case 'drift':
      return { ...it, polygon: it.polygon.map(([x, y]) => [x + dx, y + dy]) };
    case 'row':
      return { ...it, path: it.path.map(([x, y]) => [x + dx, y + dy]) };
  }
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const roundPts = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [round1(x), round1(y)]);

/** Drifts and rows keep their plant count in sync with their shape and spacing. */
export function withCount(it: PlacedItem): PlacedItem {
  return it.kind === 'plant' ? it : { ...it, count: itemCount(it) };
}

export function roundItem(it: PlacedItem): PlacedItem {
  if (it.kind === 'plant') return { ...it, x: round1(it.x), y: round1(it.y) };
  if (it.kind === 'drift') return { ...it, polygon: it.polygon.map(([x, y]) => [round1(x), round1(y)]) };
  return { ...it, path: it.path.map(([x, y]) => [round1(x), round1(y)]) };
}

export const selectCurrentArea = (s: ProjectState): Area | null => s.project?.areas.find((a) => a.id === s.currentAreaId) ?? null;

const EMPTY: PlacedItem[] = [];
export const selectItems = (s: ProjectState): PlacedItem[] => {
  const a = selectCurrentArea(s);
  return a ? activeVariant(a).items : EMPTY;
};
