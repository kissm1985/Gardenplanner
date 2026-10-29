import type { JugloneTolerance, Plant, Soil, SunNeed, Toxicity, WaterNeed } from './types';

export const SUN_LABEL: Record<SunNeed, string> = { sun: 'nap', part: 'félárnyék', shade: 'árnyék' };
export const SOILS: Soil[] = ['sandy', 'loam', 'clay', 'chalky', 'acidic', 'poor'];
export const SOIL_LABEL: Record<Soil, string> = {
  sandy: 'homokos',
  loam: 'vályog',
  clay: 'agyagos',
  chalky: 'meszes',
  acidic: 'savanyú',
  poor: 'tápanyagszegény',
};
export const WATER_LABEL: Record<WaterNeed, string> = { low: 'alacsony', medium: 'közepes', high: 'magas' };
export const TOXIC_LABEL: Record<Toxicity, string> = {
  no: 'nem',
  human: 'emberre',
  pet: 'háziállatra',
  both: 'emberre és háziállatra',
  unknown: 'nem ismert',
};
export const JUGLONE_LABEL: Record<JugloneTolerance, string> = { tolerant: 'tűri', sensitive: 'érzékeny', unknown: 'nem dokumentált' };
export const MONTHS = ['jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];

export const plantMap = (db: Plant[]) => new Map(db.map((p) => [p.code, p]));

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
  if (!/^[A-Z0-9]{2}$/.test(p.code)) e.push('A kód pontosan 2 nagybetű vagy szám legyen (pl. LA).');
  else if (others.some((o) => o.code === p.code)) e.push(`A(z) ${p.code} kód már foglalt.`);
  if (!p.nameHu.trim()) e.push('Add meg a magyar nevet.');
  if (!(p.maxHeightCm > 0)) e.push('A magasság legyen nagyobb 0-nál.');
  if (!(p.spreadCm > 0)) e.push('A szélesség legyen nagyobb 0-nál.');
  if (!(p.spacingCm > 0)) e.push('A tőtáv legyen nagyobb 0-nál.');
  if (!p.sun.length) e.push('Válassz legalább egy napigényt.');
  return e;
}

// ---------- CSV (semicolon separated, Excel/Sheets friendly) ----------

const CSV_COLS: { key: keyof Plant; head: string }[] = [
  { key: 'code', head: 'kod' },
  { key: 'nameHu', head: 'magyar_nev' },
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
  { key: 'verify', head: 'ellenorizendo' },
];

const esc = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function plantsToCsv(db: Plant[]): string {
  const rows = [CSV_COLS.map((c) => c.head).join(';')];
  for (const p of db) {
    rows.push(
      CSV_COLS.map(({ key }) => {
        const v = p[key];
        if (Array.isArray(v)) return esc(v.join(','));
        if (typeof v === 'boolean') return v ? 'igen' : 'nem';
        return esc(v == null ? '' : String(v));
      }).join(';'),
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
  return out.filter((r) => r.some((c) => c.trim() !== ''));
}

const enumOf = <T extends string>(v: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

export function plantsFromCsv(text: string): { plants: Plant[]; errors: string[] } {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (!rows.length) return { plants: [], errors: ['Üres fájl.'] };
  const head = rows[0].map((h) => h.trim());
  const idx = (h: string) => head.indexOf(h);
  if (idx('kod') < 0 || idx('magyar_nev') < 0) return { plants: [], errors: ['Hiányzik a „kod” vagy a „magyar_nev” oszlop.'] };
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
      verify: list('ellenorizendo') as (keyof Plant)[],
    };
    if (!p.sun.length) p.sun = ['sun'];
    if (p.seasonColors === undefined) delete p.seasonColors;
    if (p.isTree === undefined) delete p.isTree;
    const errs = validatePlant(p, plants);
    if (errs.length) errors.push(`${n + 2}. sor: ${errs.join(' ')}`);
    else plants.push(p);
  });
  return { plants, errors };
}

export function plantsFromJson(text: string): { plants: Plant[]; errors: string[] } {
  try {
    const data = JSON.parse(text);
    const arr: unknown = Array.isArray(data) ? data : data?.plantDb;
    if (!Array.isArray(arr)) return { plants: [], errors: ['A JSON nem növénylista.'] };
    const plants: Plant[] = [];
    const errors: string[] = [];
    arr.forEach((raw, i) => {
      const p = { ...blankPlant(String(raw?.code ?? '')), ...raw } as Plant;
      const errs = validatePlant(p, plants);
      if (errs.length) errors.push(`${i + 1}. elem: ${errs.join(' ')}`);
      else plants.push(p);
    });
    return { plants, errors };
  } catch {
    return { plants: [], errors: ['Hibás JSON fájl.'] };
  }
}
