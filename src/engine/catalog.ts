// Nursery catalogue (Pro tier, PL-BE-01..04): one schema shared by the server, the admin page and the app.
// Dependency-free on purpose: the server imports it as is. Every value coming from outside (API body, CSV/XLSX
// row, server response) goes through these validators; nothing else is trusted.

export type SunNeed = 'sun' | 'part' | 'shade';
export type WaterNeed = 'low' | 'medium' | 'high';

/** One pot size the nursery sells a species in, with its price and stock. */
export interface Offer {
  /** Pot or size label, e.g. "P9", "2 l", "C5", "60–80 cm". */
  pot: string;
  priceHuf: number;
  /** Units in stock; missing = not reported. */
  stock?: number;
}

/** A species in a nursery's catalogue (the draft the admin edits, and the published copy the app reads). */
export interface CatalogSpecies {
  code: string;
  nameHu: string;
  nameEn?: string;
  nameLat: string;
  maxHeightCm?: number;
  spreadCm?: number;
  sun?: SunNeed[];
  water?: WaterNeed;
  notes?: string;
  offers: Offer[];
}

/** A published change: the species as of `version`, or its removal. */
export interface CatalogEntry {
  code: string;
  version: number;
  deleted?: boolean;
  species?: CatalogSpecies;
}

export interface CatalogVersion {
  tenant: string;
  name: string;
  version: number;
  publishedAt: string | null;
}

export interface CatalogChanges {
  version: number;
  since: number;
  entries: CatalogEntry[];
}

export const CATALOG_LIMITS = { species: 5000, offers: 20, importRows: 10000, text: 500 };
const SUN: SunNeed[] = ['sun', 'part', 'shade'];
const WATER: WaterNeed[] = ['low', 'medium', 'high'];
export const CODE_RE = /^[A-Z0-9]{2,6}$/;
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export const EMAIL_RE = /^[^\s@<>()",;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const str = (v: unknown, field: string, errors: string[], { min = 0, max = 100 } = {}): string | undefined => {
  if (v == null || v === '') {
    if (min > 0) errors.push(`${field}: kötelező / required`);
    return undefined;
  }
  if (typeof v !== 'string') {
    errors.push(`${field}: szöveg kell / must be text`);
    return undefined;
  }
  // Control characters (but not line breaks in notes) are refused, not silently dropped.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) errors.push(`${field}: érvénytelen karakter / invalid character`);
  const s = v.trim();
  if (s.length < min) errors.push(`${field}: kötelező / required`);
  if (s.length > max) errors.push(`${field}: legfeljebb ${max} karakter / at most ${max} characters`);
  return s || undefined;
};

const int = (v: unknown, field: string, errors: string[], min: number, max: number): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/\s/g, '').replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    errors.push(`${field}: egész szám ${min}–${max} / whole number ${min}–${max}`);
    return undefined;
  }
  return n;
};

export function validateOffer(v: unknown, at = 'offer'): Result<Offer> {
  const errors: string[] = [];
  if (!v || typeof v !== 'object') return { ok: false, errors: [`${at}: hiányzik / missing`] };
  const o = v as Record<string, unknown>;
  const pot = str(o.pot, `${at}.pot`, errors, { min: 1, max: 20 });
  const priceHuf = int(o.priceHuf, `${at}.priceHuf`, errors, 0, 10_000_000);
  if (priceHuf == null && !errors.some((e) => e.startsWith(`${at}.priceHuf`))) errors.push(`${at}.priceHuf: kötelező / required`);
  const stock = int(o.stock, `${at}.stock`, errors, 0, 1_000_000);
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { pot: pot!, priceHuf: priceHuf!, ...(stock != null ? { stock } : {}) } };
}

export function validateSpecies(v: unknown): Result<CatalogSpecies> {
  const errors: string[] = [];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, errors: ['species: objektum kell / must be an object'] };
  const o = v as Record<string, unknown>;
  const code = typeof o.code === 'string' ? o.code.trim().toUpperCase() : '';
  if (!CODE_RE.test(code)) errors.push('code: 2–6 betű vagy szám / 2–6 letters or digits');
  const nameHu = str(o.nameHu, 'nameHu', errors, { min: 1, max: 80 });
  const nameEn = str(o.nameEn, 'nameEn', errors, { max: 80 });
  const nameLat = str(o.nameLat, 'nameLat', errors, { min: 1, max: 100 });
  const maxHeightCm = int(o.maxHeightCm, 'maxHeightCm', errors, 1, 5000);
  const spreadCm = int(o.spreadCm, 'spreadCm', errors, 1, 5000);
  const notes = str(o.notes, 'notes', errors, { max: CATALOG_LIMITS.text });
  let sun: SunNeed[] | undefined;
  if (o.sun != null) {
    if (!Array.isArray(o.sun) || o.sun.some((s) => !SUN.includes(s as SunNeed))) errors.push('sun: sun / part / shade');
    else sun = [...new Set(o.sun as SunNeed[])];
  }
  let water: WaterNeed | undefined;
  if (o.water != null && o.water !== '') {
    if (!WATER.includes(o.water as WaterNeed)) errors.push('water: low / medium / high');
    else water = o.water as WaterNeed;
  }
  const offers: Offer[] = [];
  if (o.offers != null && !Array.isArray(o.offers)) errors.push('offers: lista kell / must be a list');
  const rawOffers = Array.isArray(o.offers) ? o.offers : [];
  if (rawOffers.length > CATALOG_LIMITS.offers) errors.push(`offers: legfeljebb ${CATALOG_LIMITS.offers} / at most ${CATALOG_LIMITS.offers}`);
  rawOffers.slice(0, CATALOG_LIMITS.offers).forEach((x, i) => {
    const r = validateOffer(x, `offers[${i}]`);
    if (r.ok) offers.push(r.value);
    else errors.push(...r.errors);
  });
  const pots = offers.map((x) => x.pot.toLowerCase());
  if (new Set(pots).size !== pots.length) errors.push('offers: egy cserépméret csak egyszer / each pot size once');
  if (errors.length) return { ok: false, errors };
  const s: CatalogSpecies = { code, nameHu: nameHu!, nameLat: nameLat!, offers };
  if (nameEn) s.nameEn = nameEn;
  if (maxHeightCm != null) s.maxHeightCm = maxHeightCm;
  if (spreadCm != null) s.spreadCm = spreadCm;
  if (sun?.length) s.sun = sun;
  if (water) s.water = water;
  if (notes) s.notes = notes;
  return { ok: true, value: s };
}

/** Checks a server's /changes response before the app uses any of it. */
export function validateChanges(v: unknown): Result<CatalogChanges> {
  if (!v || typeof v !== 'object') return { ok: false, errors: ['changes: objektum kell'] };
  const o = v as Record<string, unknown>;
  const errors: string[] = [];
  const version = int(o.version, 'version', errors, 0, 1e9);
  const since = int(o.since, 'since', errors, 0, 1e9);
  if (!Array.isArray(o.entries) || o.entries.length > CATALOG_LIMITS.species) errors.push('entries: lista kell');
  const entries: CatalogEntry[] = [];
  for (const e of Array.isArray(o.entries) ? o.entries.slice(0, CATALOG_LIMITS.species) : []) {
    const x = (e ?? {}) as Record<string, unknown>;
    const ev = int(x.version, 'entry.version', errors, 1, 1e9);
    const code = typeof x.code === 'string' && CODE_RE.test(x.code) ? x.code : null;
    if (!code || ev == null) {
      errors.push('entry: hibás / invalid');
      continue;
    }
    if (x.deleted === true) entries.push({ code, version: ev, deleted: true });
    else {
      const s = validateSpecies(x.species);
      if (s.ok && s.value.code === code) entries.push({ code, version: ev, species: s.value });
      else errors.push(`entry ${code}: hibás faj / invalid species`);
    }
  }
  if (version == null || since == null || errors.length) return { ok: false, errors: errors.length ? errors : ['version'] };
  return { ok: true, value: { version, since, entries } };
}

// ---------------------------------------------------------------------------------------------------------------
// Price list import (PL-BE-03): a CSV or XLSX sheet → rows of code, names, pot, price, stock.

export type ImportField = 'code' | 'nameHu' | 'nameLat' | 'nameEn' | 'pot' | 'priceHuf' | 'stock';
export const IMPORT_FIELDS: ImportField[] = ['code', 'nameHu', 'nameLat', 'nameEn', 'pot', 'priceHuf', 'stock'];
export type ImportMapping = Partial<Record<ImportField, number>>;

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

const HEADER_NAMES: Record<ImportField, string[]> = {
  code: ['kod', 'code', 'azonosito', 'id', 'cikkszam', 'sku'],
  nameHu: ['nev', 'magyarnev', 'namehu', 'name', 'megnevezes', 'faj'],
  nameLat: ['latinnev', 'latin', 'namelat', 'botanicalname', 'tudomanyosnev'],
  nameEn: ['angolnev', 'nameen', 'english', 'englishname'],
  pot: ['cserep', 'cserepmeret', 'meret', 'pot', 'potsize', 'kiszereles', 'size'],
  priceHuf: ['ar', 'arft', 'egysegar', 'price', 'pricehuf', 'brutto', 'bruttoar'],
  stock: ['keszlet', 'db', 'darab', 'stock', 'mennyiseg', 'qty', 'quantity'],
};

/** Guesses which column holds which field from the header row. */
export function guessMapping(header: string[]): ImportMapping {
  const m: ImportMapping = {};
  header.forEach((h, i) => {
    const f = fold(h);
    for (const field of IMPORT_FIELDS) if (m[field] == null && HEADER_NAMES[field].includes(f)) m[field] = i;
  });
  return m;
}

/** Splits CSV text; the separator (; , or tab) is taken from the header line. */
export function parseCsvText(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = [';', '\t', ','].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
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

export interface ImportRow {
  /** 1-based line in the sheet (the header is line 1). */
  line: number;
  code: string;
  nameHu?: string;
  nameLat?: string;
  nameEn?: string;
  offer?: Offer;
  errors: string[];
  /** Filled in by the server: what applying the row would do. */
  status?: 'new' | 'update' | 'same' | 'error';
}

/** Turns sheet rows into import rows; every row is checked on its own, so one bad row does not block the rest. */
export function readImportRows(rows: string[][], mapping?: ImportMapping): { mapping: ImportMapping; rows: ImportRow[]; errors: string[] } {
  const errors: string[] = [];
  if (rows.length < 2) return { mapping: {}, rows: [], errors: ['A táblázat üres. / The sheet is empty.'] };
  if (rows.length - 1 > CATALOG_LIMITS.importRows)
    return { mapping: {}, rows: [], errors: [`Legfeljebb ${CATALOG_LIMITS.importRows} sor. / At most ${CATALOG_LIMITS.importRows} rows.`] };
  const m = mapping ?? guessMapping(rows[0]);
  if (m.code == null) errors.push('Nincs „kód” oszlop. / No “code” column.');
  if (m.pot == null) errors.push('Nincs „cserép” oszlop. / No “pot” column.');
  if (m.priceHuf == null) errors.push('Nincs „ár” oszlop. / No “price” column.');
  if (errors.length) return { mapping: m, rows: [], errors };
  const cell = (r: string[], f: ImportField) => (m[f] != null ? (r[m[f]!] ?? '').trim() : '');
  const out = rows.slice(1).map((r, i): ImportRow => {
    const e: string[] = [];
    const code = cell(r, 'code').toUpperCase();
    if (!CODE_RE.test(code)) e.push('code: 2–6 betű vagy szám / 2–6 letters or digits');
    const names: Partial<ImportRow> = {};
    for (const f of ['nameHu', 'nameLat', 'nameEn'] as const) {
      const v = str(cell(r, f), f, e, { max: f === 'nameLat' ? 100 : 80 });
      if (v) names[f] = v;
    }
    // Prices may be written as "1 290 Ft" or "1290,00".
    const price = cell(r, 'priceHuf')
      .replace(/ft|huf/i, '')
      .replace(/[\s\u00a0]/g, '')
      .replace(/,00$|\.00$/, '');
    const offer = validateOffer({ pot: cell(r, 'pot'), priceHuf: price, stock: cell(r, 'stock') }, 'offer');
    if (!offer.ok) e.push(...offer.errors.map((x) => x.replace(/^offer\./, '')));
    return { line: i + 2, code, ...names, ...(offer.ok ? { offer: offer.value } : {}), errors: e };
  });
  return { mapping: m, rows: out, errors };
}
