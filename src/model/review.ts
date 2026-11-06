// Bringing an expert review back (PL-DAT-01): the "values to check" worksheet, filled in, is read back. A row whose
// last column says "ok" confirms the value; any other text is the correct value. The result updates the project's
// plant database and can be exported as the overlay the built-in list is built with (src/data/plants.review.ts).
import { t } from '../i18n';
import type { ReviewEntry } from '../data/plants.review';
import { FIELD_LABEL_PAIRS, parseCsv } from './plants';
import type { Plant, Soil, SunNeed } from './types';

const OK = new Set(['ok', 'oké', 'rendben', 'helyes', 'jó', 'jo', 'igen', '✓', 'x', 'correct', 'yes']);
const NUM: (keyof Plant)[] = ['maxHeightCm', 'spreadCm', 'spacingCm', 'unitPriceHuf'];
const MONTHS: (keyof Plant)[] = ['bloomMonths', 'harvestMonths', 'sowMonths', 'plantOutMonths'];
const BOOL: (keyof Plant)[] = ['thorny', 'winterInterest', 'native', 'beeFriendly', 'isTree'];
const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[,;/]+/)
    .map((x) => x.trim())
    .filter(Boolean);
const SUN: Record<string, SunNeed> = { sun: 'sun', nap: 'sun', napos: 'sun', part: 'part', félárnyék: 'part', felarnyek: 'part', shade: 'shade', árnyék: 'shade', arnyek: 'shade' };
const WATER: Record<string, Plant['water']> = { low: 'low', alacsony: 'low', medium: 'medium', közepes: 'medium', high: 'high', magas: 'high' };
const TOXIC: Record<string, Plant['toxic']> = {
  no: 'no',
  nem: 'no',
  human: 'human',
  ember: 'human',
  pet: 'pet',
  állat: 'pet',
  both: 'both',
  mindkettő: 'both',
  unknown: 'unknown',
  ismeretlen: 'unknown',
};
const JUGLONE: Record<string, Plant['juglone']> = { tolerant: 'tolerant', tűri: 'tolerant', sensitive: 'sensitive', érzékeny: 'sensitive', unknown: 'unknown' };
const SOILS: Record<string, Soil> = {
  sandy: 'sandy',
  homokos: 'sandy',
  loam: 'loam',
  vályog: 'loam',
  clay: 'clay',
  agyagos: 'clay',
  chalky: 'chalky',
  meszes: 'chalky',
  acidic: 'acidic',
  savanyú: 'acidic',
  poor: 'poor',
  tápanyagszegény: 'poor',
};

/** Parse a corrected value for a field; undefined = not understood. */
export function parseReviewValue(key: keyof Plant, raw: string): Plant[keyof Plant] | undefined {
  const v = raw.trim();
  if (NUM.includes(key)) {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  if (MONTHS.includes(key)) {
    const m = words(v)
      .map(Number)
      .filter((x) => Number.isInteger(x) && x >= 1 && x <= 12);
    return m.length || v === '' ? m : undefined;
  }
  if (BOOL.includes(key)) {
    const w = v.toLowerCase();
    if (['igen', 'yes', 'true', '1'].includes(w)) return true;
    if (['nem', 'no', 'false', '0'].includes(w)) return false;
    return undefined;
  }
  const map = (m: Record<string, string>) => {
    const out = words(v).map((w) => m[w]);
    return out.length && out.every(Boolean) ? out : undefined;
  };
  if (key === 'sun') return map(SUN) as SunNeed[] | undefined;
  if (key === 'soil') return map(SOILS) as Soil[] | undefined;
  if (key === 'water') return WATER[v.toLowerCase()];
  if (key === 'toxic') return TOXIC[v.toLowerCase()];
  if (key === 'juglone') return JUGLONE[v.toLowerCase()];
  return v || undefined;
}

export interface ReviewResult {
  plants: Plant[];
  changed: number;
  confirmed: number;
  errors: string[];
  /** The review as overlay entries, keyed by species code. */
  overlay: Record<string, ReviewEntry>;
}

/** Apply a filled-in review worksheet to a plant list. */
export function applyReviewCsv(db: Plant[], text: string, today = new Date().toISOString().slice(0, 10)): ReviewResult {
  const clean = text.replace(/^\uFEFF/, '');
  const sep = clean.split('\n')[0].includes(';') ? ';' : ',';
  const rows = parseCsv(clean, sep).slice(1);
  const byLabel = new Map<string, keyof Plant>();
  for (const [k, pair] of Object.entries(FIELD_LABEL_PAIRS)) for (const l of pair ?? []) byLabel.set(l.toLowerCase(), k as keyof Plant);
  const plants = new Map(db.map((p) => [p.code, { ...p }]));
  const overlay: Record<string, ReviewEntry> = {};
  const errors: string[] = [];
  let changed = 0;
  let confirmed = 0;
  rows.forEach((r, i) => {
    const [code, , , label, , source, , answer] = r.map((c) => (c ?? '').trim());
    if (!code || !answer) return;
    const p = plants.get(code);
    const key = byLabel.get((label ?? '').toLowerCase());
    if (!p || !key) {
      errors.push(t(`${i + 2}. sor: ismeretlen faj vagy adat (${code}, ${label}).`, `Row ${i + 2}: unknown species or field (${code}, ${label}).`));
      return;
    }
    const entry = (overlay[code] ??= { source: source || t('szakértői lektorálás', 'expert review'), checkedAt: today });
    if (OK.has(answer.toLowerCase())) {
      entry.confirmed = [...(entry.confirmed ?? []), key];
      confirmed++;
    } else {
      const value = parseReviewValue(key, answer);
      if (value === undefined) {
        errors.push(t(`${i + 2}. sor: a(z) „${answer}” nem értelmezhető ehhez: ${label}.`, `Row ${i + 2}: “${answer}” cannot be read as ${label}.`));
        return;
      }
      entry.set = { ...entry.set, [key]: value };
      (p as Record<string, unknown>)[key] = value;
      changed++;
    }
    p.verify = (p.verify ?? []).filter((k) => k !== key);
    p.checkedAt = today;
    p.dataSource = entry.source;
  });
  return { plants: [...plants.values()], changed, confirmed, errors, overlay };
}
