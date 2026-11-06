// Product tiers (Alap, Haladó, Profi) as feature switches on one code base. The tier is chosen per device; until
// payments exist it is a free choice (default: Haladó, the full app of 0.6). A locked feature stays visible with a
// lock and explains which tier has it; no plan is ever lost by switching tiers.
import { useSyncExternalStore } from 'react';
import { labels, t } from '../i18n';

export type Tier = 'alap' | 'halado' | 'profi';
export const TIERS: Tier[] = ['alap', 'halado', 'profi'];
export const TIER_LABEL: Record<Tier, string> = labels({ alap: ['Alap', 'Basic'], halado: ['Haladó', 'Advanced'], profi: ['Profi', 'Pro'] });

export type Feature =
  | 'allPlants'
  | 'rowTool'
  | 'advancedPlanting'
  | 'freeShape'
  | 'background'
  | 'variants'
  | 'compare'
  | 'concept'
  | 'visual'
  | 'fullRules'
  | 'ideaAdvanced'
  | 'dataExport'
  | 'schedule'
  | 'print'
  | 'svg'
  | 'moreProjects'
  | 'moreAreas'
  | 'nurseryCatalog'
  | 'pdfHeader'
  | 'quote';

const RANK: Record<Tier, number> = { alap: 0, halado: 1, profi: 2 };

/** Lowest tier that has each feature. */
export const FEATURE_TIER: Record<Feature, Tier> = {
  allPlants: 'halado',
  rowTool: 'halado',
  advancedPlanting: 'halado',
  freeShape: 'halado',
  background: 'halado',
  variants: 'halado',
  compare: 'halado',
  concept: 'halado',
  visual: 'halado',
  fullRules: 'halado',
  ideaAdvanced: 'halado',
  dataExport: 'halado',
  schedule: 'halado',
  print: 'halado',
  svg: 'halado',
  moreProjects: 'halado',
  moreAreas: 'halado',
  nurseryCatalog: 'profi',
  pdfHeader: 'profi',
  quote: 'profi',
};

export const FEATURE_LABEL: Record<Feature, string> = labels({
  allPlants: ['A teljes növénylista', 'The full plant list'],
  rowTool: ['Sor és ív', 'Rows and curves'],
  advancedPlanting: ['Kitöltés, csere, keverék', 'Fill, replace, mix'],
  freeShape: ['Szabad alakú terület', 'Free-shape areas'],
  background: ['Háttérkép', 'Background image'],
  variants: ['Több változat, változatfa', 'Several variants, variant tree'],
  compare: ['Változatok összehasonlítása', 'Comparing variants'],
  concept: ['Koncepcióterv', 'Concept plan'],
  visual: ['Látványterv', 'Visualisation'],
  fullRules: ['Teljes szabályellenőrzés', 'Full rule check'],
  ideaAdvanced: ['Az ötletgenerátor beállításai', 'Idea generator options'],
  dataExport: ['CSV- és XLSX-export', 'CSV and XLSX export'],
  schedule: ['Gondozási menetrend', 'Care schedule'],
  print: ['Nyomtatás, PDF', 'Printing, PDF'],
  svg: ['SVG-export', 'SVG export'],
  moreProjects: ['Több projekt', 'Several projects'],
  moreAreas: ['Kettőnél több terület', 'More than two areas'],
  nurseryCatalog: ['Kertészeti katalógus és árak', 'Nursery catalogue and prices'],
  pdfHeader: ['PDF saját fejléccel', 'PDF with your own header'],
  quote: ['Ajánlatkérés', 'Quote request'],
});

/** Limits of the Basic tier. */
export const ALAP_LIMITS = { projects: 1, areas: 2 };

/**
 * About 40 common, easy species for the Basic tier: perennials, grasses, a few shrubs and trees,
 * groundcovers – enough for a typical front-garden bed in sun or shade.
 */
export const ALAP_CODES = new Set([
  // sunny perennials
  'LA',
  'SA',
  'NE',
  'EC',
  'RU',
  'AM',
  'HH',
  'GR',
  'AL',
  'LE',
  'VS',
  'CO',
  'AG',
  'PE',
  'HM',
  'IR',
  // grasses
  'FE',
  'CK',
  'MO',
  'PN',
  'MI',
  // groundcover, rock garden
  'TH',
  'SD',
  'SE',
  'ST',
  'AR',
  'PS',
  // shade
  'HO',
  'HE',
  'BR',
  'PU',
  'DR',
  'BE',
  'VI',
  // shrubs and small trees
  'BX',
  'SJ',
  'HA',
  'AC',
  'MG',
  'DA',
]);

const KEY = 'kerttervezo.tier';
const listeners = new Set<() => void>();

function read(): Tier {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'alap' || v === 'halado' || v === 'profi') return v;
  } catch {
    /* private mode */
  }
  return 'halado';
}

let current: Tier = read();
export const getTier = () => current;

export function setTier(v: Tier) {
  current = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* this session only */
  }
  listeners.forEach((f) => f());
}

export const hasFeature = (f: Feature, tier: Tier = current) => RANK[tier] >= RANK[FEATURE_TIER[f]];

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

/** Re-renders when the tier changes. */
export function useTier(): Tier {
  return useSyncExternalStore(subscribe, getTier, getTier);
}

/** True if the current tier has the feature (re-renders on tier change). */
export function useFeature(f: Feature): boolean {
  return hasFeature(f, useTier());
}

/** One-line explanation for a locked feature. */
export const lockedText = (f: Feature) =>
  t(`A(z) „${FEATURE_LABEL[f]}” a ${TIER_LABEL[FEATURE_TIER[f]]} csomagban érhető el.`, `“${FEATURE_LABEL[f]}” is available in the ${TIER_LABEL[FEATURE_TIER[f]]} tier.`);
