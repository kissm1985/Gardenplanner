import type { JugloneTolerance, PlacedItem, Plant, Soil, SunNeed, Toxicity, WaterNeed } from './types';
import { safeCell, unsafeCell } from '../engine/csvSafe';
import { getLang, labelList, labels, t } from '../i18n';

export const SUN_LABEL: Record<SunNeed, string> = labels({ sun: ['nap', 'sun'], part: ['félárnyék', 'part shade'], shade: ['árnyék', 'shade'] });
export const SOILS: Soil[] = ['sandy', 'loam', 'clay', 'chalky', 'acidic', 'poor'];
export const SOIL_LABEL: Record<Soil, string> = labels({
  sandy: ['homokos', 'sandy'],
  loam: ['vályog', 'loam'],
  clay: ['agyagos', 'clay'],
  chalky: ['meszes', 'chalky'],
  acidic: ['savanyú', 'acidic'],
  poor: ['tápanyagszegény', 'poor'],
});
export const WATER_LABEL: Record<WaterNeed, string> = labels({ low: ['alacsony', 'low'], medium: ['közepes', 'medium'], high: ['magas', 'high'] });
export const TOXIC_LABEL: Record<Toxicity, string> = labels({
  no: ['nem', 'no'],
  human: ['emberre', 'to people'],
  pet: ['háziállatra', 'to pets'],
  both: ['emberre és háziállatra', 'to people and pets'],
  unknown: ['nem ismert', 'unknown'],
});
export const JUGLONE_LABEL: Record<JugloneTolerance, string> = labels({ tolerant: ['tűri', 'tolerant'], sensitive: ['érzékeny', 'sensitive'], unknown: ['nem dokumentált', 'not documented'] });
export const MONTHS = labelList([
  ['jan', 'Jan'],
  ['feb', 'Feb'],
  ['márc', 'Mar'],
  ['ápr', 'Apr'],
  ['máj', 'May'],
  ['jún', 'Jun'],
  ['júl', 'Jul'],
  ['aug', 'Aug'],
  ['szept', 'Sep'],
  ['okt', 'Oct'],
  ['nov', 'Nov'],
  ['dec', 'Dec'],
]);

export const plantMap = (db: Plant[]) => new Map(db.map((p) => [p.code, p]));

/** Alphabetical order by the name in the current language. */
export const byPlantName = (a: Plant, b: Plant) => plantName(a).localeCompare(plantName(b), getLang() === 'en' ? 'en' : 'hu');

/** Bloom colour, foliage colour and notes in the current language (Hungarian when no English text). */
export const plantBloom = (p: Plant) => (getLang() === 'en' && p.en?.bloomColor) || p.bloomColor;
export const plantFoliage = (p: Plant) => (getLang() === 'en' && p.en?.foliageColor) || p.foliageColor;
export const plantNotes = (p: Plant) => (getLang() === 'en' && p.en?.notes) || p.notes;

/** The plant's common name in the current language (falls back to the other one). */
export const plantName = (p: Pick<Plant, 'nameHu' | 'nameEn'>) => (getLang() === 'en' ? p.nameEn || p.nameHu : p.nameHu || p.nameEn || '');

/** The plant as placed: a single plant may have its own spread; the spacing scales with it. */
export function effectivePlant(p: Plant, it: PlacedItem): Plant {
  if (it.kind !== 'plant' || !it.spreadCm || it.spreadCm === p.spreadCm) return p;
  return { ...p, spreadCm: it.spreadCm, spacingCm: Math.round((p.spacingCm * it.spreadCm) / p.spreadCm) };
}

/** Readable text colour (dark or white) on top of a hex fill. */
export function textOn(hex: string): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  if (Number.isNaN(n)) return '#1b241d';
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.55 ? '#1b241d' : '#ffffff';
}

export const needsCheck = (p: Plant, k: keyof Plant) => !!p.verify?.includes(k);

export function blankPlant(code: string): Plant {
  return {
    code,
    nameHu: '',
    nameLat: '',
    maxHeightCm: 40,
    spreadCm: 40,
    spacingCm: 40,
    sun: ['sun'],
    water: 'medium',
    toxic: 'unknown',
    thorny: false,
    juglone: 'unknown',
    bloomMonths: [],
    bloomColor: '',
    foliageColor: 'zöld',
    winterInterest: false,
    pot: 'P9',
    unitPriceHuf: 0,
    priceSource: 'estimate',
    color: '#6f9a5a',
    symbol: 'circle',
    notes: '',
    verify: ['toxic', 'juglone'],
  };
}

/** First free 2-letter code derived from the name (e.g. "Levendula" → LE, LV, …). */
export function suggestCode(name: string, taken: Set<string>): string {
  const letters = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const first = letters[0] ?? 'X';
  for (const c of letters.slice(1) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const code = first + c;
    if (!taken.has(code)) return code;
  }
  for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') for (const b of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!taken.has(a + b)) return a + b;
  return 'XX';
}

/** Returns a list of Hungarian error messages; empty when valid. */
export function validatePlant(p: Plant, others: Plant[]): string[] {
  const e: string[] = [];
  if (!/^[A-Z0-9]{2}$/.test(p.code)) e.push(t('A kód pontosan 2 nagybetű vagy szám legyen (pl. LA).', 'The code must be exactly 2 capital letters or digits (e.g. LA).'));
  else if (others.some((o) => o.code === p.code)) e.push(t(`A(z) ${p.code} kód már foglalt.`, `The code ${p.code} is already taken.`));
  if (!p.nameHu.trim() && !p.nameEn?.trim()) e.push(t('Add meg a növény nevét.', 'Enter the plant’s name.'));
  if (!(p.maxHeightCm > 0)) e.push(t('A magasság legyen nagyobb 0-nál.', 'The height must be greater than 0.'));
  if (!(p.spreadCm > 0)) e.push(t('A szélesség legyen nagyobb 0-nál.', 'The spread must be greater than 0.'));
  if (!(p.spacingCm > 0)) e.push(t('A tőtáv legyen nagyobb 0-nál.', 'The spacing must be greater than 0.'));
  if (!p.sun.length) e.push(t('Válassz legalább egy napigényt.', 'Choose at least one light requirement.'));
  return e;
}

// ---------- CSV (semicolon separated, Excel/Sheets friendly) ----------

const CSV_COLS: { key: keyof Plant; head: string }[] = [
  { key: 'code', head: 'kod' },
  { key: 'nameHu', head: 'magyar_nev' },
  { key: 'nameEn', head: 'angol_nev' },
  { key: 'nameLat', head: 'latin_nev' },
  { key: 'maxHeightCm', head: 'max_magassag_cm' },
  { key: 'spreadCm', head: 'szelesseg_cm' },
  { key: 'spacingCm', head: 'totav_cm' },
  { key: 'sun', head: 'napigeny' },
  { key: 'water', head: 'vizigeny' },
  { key: 'soil', head: 'talaj' },
  { key: 'toxic', head: 'mergezo' },
  { key: 'thorny', head: 'tuskes' },
  { key: 'juglone', head: 'juglone' },
  { key: 'bloomMonths', head: 'viragzas_honapok' },
  { key: 'bloomColor', head: 'viragszin' },
  { key: 'foliageColor', head: 'lombszin' },
  { key: 'winterInterest', head: 'teli_disz' },
  { key: 'seasonColors', head: 'evszak_szinek' },
  { key: 'pot', head: 'kiszereles' },
  { key: 'unitPriceHuf', head: 'egysegar_ft' },
  { key: 'priceSource', head: 'ar_forras' },
  { key: 'color', head: 'szin' },
  { key: 'symbol', head: 'szimbolum' },
  { key: 'isTree', head: 'fa' },
  { key: 'notes', head: 'megjegyzes' },
  { key: 'photoUrl', head: 'foto_url' },
  { key: 'photoCredit', head: 'foto_forras' },
  { key: 'verify', head: 'ellenorizendo' },
  { key: 'dataSource', head: 'adat_forras' },
  { key: 'checkedAt', head: 'ellenorizve' },
];

const esc = (raw: string) => {
  const s = safeCell(raw);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** English texts, nested under `en` in the model, as flat columns. */
const EN_COLS: { key: 'bloomColor' | 'foliageColor' | 'notes'; head: string }[] = [
  { key: 'bloomColor', head: 'angol_viragszin' },
  { key: 'foliageColor', head: 'angol_lombszin' },
  { key: 'notes', head: 'angol_megjegyzes' },
];

/** Readable names of the plant fields that can be marked "to check". */
export const FIELD_LABEL: Partial<Record<keyof Plant, string>> = labels({
  maxHeightCm: ['Magasság', 'Height'],
  spreadCm: ['Szélesség', 'Spread'],
  spacingCm: ['Tőtáv', 'Spacing'],
  sun: ['Fényigény', 'Light'],
  water: ['Vízigény', 'Water'],
  soil: ['Talaj', 'Soil'],
  toxic: ['Mérgezőség', 'Toxicity'],
  thorny: ['Tüskés', 'Thorny'],
  juglone: ['Juglone-tűrés', 'Juglone tolerance'],
  bloomMonths: ['Virágzás', 'Bloom months'],
  bloomColor: ['Virágszín', 'Bloom colour'],
  foliageColor: ['Lombszín', 'Foliage colour'],
  pot: ['Kiszerelés', 'Pot size'],
  unitPriceHuf: ['Ár', 'Price'],
  winterInterest: ['Téli dísz', 'Winter interest'],
});

/** The plants that still have values to check, as a CSV worksheet for an expert review. */
export function reviewCsv(db: Plant[]): string {
  const head = [t('Kód', 'Code'), t('Név', 'Name'), t('Latin név', 'Latin name'), t('Ellenőrizendő adat', 'Field to check'), t('Jelenlegi érték', 'Current value'), t('Forrás', 'Source'), t('Utolsó ellenőrzés', 'Last checked'), t('Helyes érték / megjegyzés', 'Correct value / note')];
  const rows: string[][] = [head];
  for (const p of db)
    for (const k of p.verify ?? []) {
      const v = p[k];
      rows.push([p.code, plantName(p), p.nameLat, FIELD_LABEL[k] ?? String(k), Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v), p.dataSource ?? '', p.checkedAt ?? '', '']);
    }
  return rows.map((r) => r.map(esc).join(';')).join('\r\n');
}

export function plantsToCsv(db: Plant[]): string {
  const rows = [[...CSV_COLS, ...EN_COLS].map((c) => c.head).join(';')];
  for (const p of db) {
    rows.push(
      [
        ...CSV_COLS.map(({ key }) => {
          const v = p[key];
          if (Array.isArray(v)) return esc(v.join(','));
          if (typeof v === 'boolean') return v ? 'igen' : 'nem';
          return esc(v == null ? '' : String(v));
        }),
        ...EN_COLS.map(({ key }) => esc(p.en?.[key] ?? '')),
      ].join(';'),
    );
  }
  return rows.join('\r\n');
}

export function parseCsv(text: string, sep = ';'): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim() !== '')).map((r) => r.map(unsafeCell));
}

const enumOf = <T extends string>(v: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

export function plantsFromCsv(text: string): { plants: Plant[]; errors: string[] } {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (!rows.length) return { plants: [], errors: [t('Üres fájl.', 'Empty file.')] };
  const head = rows[0].map((h) => h.trim());
  const idx = (h: string) => head.indexOf(h);
  if (idx('kod') < 0 || (idx('magyar_nev') < 0 && idx('angol_nev') < 0)) return { plants: [], errors: [t('Hiányzik a „kod” vagy a „magyar_nev” oszlop.', 'The “kod” or “angol_nev” (English name) column is missing.')] };
  const plants: Plant[] = [];
  rows.slice(1).forEach((r, n) => {
    const get = (h: string) => (idx(h) >= 0 ? (r[idx(h)] ?? '').trim() : '');
    const num = (h: string, d: number) => {
      const v = parseFloat(get(h).replace(',', '.'));
      return Number.isFinite(v) ? v : d;
    };
    const list = (h: string) => get(h).split(',').map((s) => s.trim()).filter(Boolean);
    const bool = (h: string) => ['igen', 'true', '1', 'x'].includes(get(h).toLowerCase());
    const base = blankPlant(get('kod').toUpperCase());
    const sc = list('evszak_szinek');
    const p: Plant = {
      ...base,
      nameHu: get('magyar_nev'),
      nameEn: get('angol_nev') || undefined,
      nameLat: get('latin_nev'),
      maxHeightCm: num('max_magassag_cm', base.maxHeightCm),
      spreadCm: num('szelesseg_cm', base.spreadCm),
      spacingCm: num('totav_cm', num('szelesseg_cm', base.spacingCm)),
      sun: list('napigeny').filter((s): s is SunNeed => ['sun', 'part', 'shade'].includes(s)),
      water: enumOf(get('vizigeny'), ['low', 'medium', 'high'] as const, 'medium'),
      soil: list('talaj').filter((x): x is Soil => (SOILS as string[]).includes(x)),
      toxic: enumOf(get('mergezo'), ['no', 'human', 'pet', 'both', 'unknown'] as const, 'unknown'),
      thorny: bool('tuskes'),
      juglone: enumOf(get('juglone'), ['tolerant', 'sensitive', 'unknown'] as const, 'unknown'),
      bloomMonths: list('viragzas_honapok').map(Number).filter((m) => m >= 1 && m <= 12),
      bloomColor: get('viragszin'),
      foliageColor: get('lombszin'),
      winterInterest: bool('teli_disz'),
      seasonColors: sc.length === 4 ? (sc as [string, string, string, string]) : undefined,
      pot: get('kiszereles'),
      unitPriceHuf: num('egysegar_ft', 0),
      priceSource: get('ar_forras') === 'shop' ? 'shop' : 'estimate',
      color: /^#[0-9a-f]{6}$/i.test(get('szin')) ? get('szin') : base.color,
      symbol: enumOf(get('szimbolum'), ['circle', 'square', 'triangle', 'diamond'] as const, 'circle'),
      isTree: bool('fa') || undefined,
      notes: get('megjegyzes'),
      photoUrl: get('foto_url') || undefined,
      photoCredit: get('foto_forras') || undefined,
      verify: list('ellenorizendo') as (keyof Plant)[],
      dataSource: get('adat_forras') || undefined,
      checkedAt: /^\d{4}-\d{2}-\d{2}$/.test(get('ellenorizve')) ? get('ellenorizve') : undefined,
    };
    if (p.dataSource === undefined) delete p.dataSource;
    if (p.checkedAt === undefined) delete p.checkedAt;
    if (!p.sun.length) p.sun = ['sun'];
    if (p.seasonColors === undefined) delete p.seasonColors;
    if (p.isTree === undefined) delete p.isTree;
    if (p.nameEn === undefined) delete p.nameEn;
    const en = Object.fromEntries(EN_COLS.map(({ key, head }) => [key, get(head)]).filter(([, v]) => v));
    if (Object.keys(en).length) p.en = en;
    if (p.photoUrl === undefined) delete p.photoUrl;
    if (p.photoCredit === undefined) delete p.photoCredit;
    const errs = validatePlant(p, plants);
    if (errs.length) errors.push(t(`${n + 2}. sor: ${errs.join(' ')}`, `Row ${n + 2}: ${errs.join(' ')}`));
    else plants.push(p);
  });
  return { plants, errors };
}

export function plantsFromJson(text: string): { plants: Plant[]; errors: string[] } {
  try {
    const data = JSON.parse(text);
    const arr: unknown = Array.isArray(data) ? data : data?.plantDb;
    if (!Array.isArray(arr)) return { plants: [], errors: [t('A JSON nem növénylista.', 'This JSON is not a plant list.')] };
    const plants: Plant[] = [];
    const errors: string[] = [];
    arr.forEach((raw, i) => {
      const p = { ...blankPlant(String(raw?.code ?? '')), ...raw } as Plant;
      const errs = validatePlant(p, plants);
      if (errs.length) errors.push(t(`${i + 1}. elem: ${errs.join(' ')}`, `Item ${i + 1}: ${errs.join(' ')}`));
      else plants.push(p);
    });
    return { plants, errors };
  } catch {
    return { plants: [], errors: [t('Hibás JSON fájl.', 'Invalid JSON file.')] };
  }
}
