// Bill of materials (SPEC §4.6): planted and order quantities, prices, per area and overall.
import { JUGLONE_LABEL, WATER_LABEL } from '../model/plants';
import type { Area, ItemStatus, PlacedItem, Plant, Project } from '../model/types';
import { itemCount } from './fill';

export const STATUSES: ItemStatus[] = ['needed', 'ordered', 'owned', 'planted'];

export interface BomRow {
  plant: Plant;
  /** Planted count per area id (only areas in scope). */
  byArea: Record<string, number>;
  byStatus: Record<ItemStatus, number>;
  planted: number;
  order: number;
  subtotal: number;
}

export interface Bom {
  areas: Area[];
  rows: BomRow[];
  planted: number;
  order: number;
  total: number;
  /** Rows whose unit price is 0 / missing. */
  unpriced: number;
  /** Rows priced from estimates rather than shop listings. */
  estimated: number;
  reservePct: number;
}

/** Order quantity: planted + reserve, rounded up. Trees get no reserve (as in K-07). */
export const orderQty = (planted: number, reservePct: number, isTree?: boolean) =>
  isTree || planted === 0 ? planted : Math.ceil((planted * (100 + reservePct)) / 100 - 1e-9);

/** Items of the chosen variant of an area – the plan the list and print are made from. */
export const chosenItems = (a: Area): PlacedItem[] => (a.variants.find((v) => v.id === a.chosenVariantId) ?? a.variants[0])?.items ?? [];

/**
 * @param areaIds areas in scope (all when omitted)
 * @param status only count items with this status
 */
export function buildBom(project: Project, areaIds?: string[], status?: ItemStatus | null): Bom {
  const areas = project.areas.filter((a) => !areaIds || areaIds.includes(a.id));
  const plants = new Map(project.plantDb.map((p) => [p.code, p]));
  const rows = new Map<string, BomRow>();
  for (const a of areas) {
    for (const it of chosenItems(a)) {
      if (status && it.status !== status) continue;
      const plant = plants.get(it.plantId);
      if (!plant) continue;
      const n = itemCount(it);
      let r = rows.get(plant.code);
      if (!r) {
        r = { plant, byArea: {}, byStatus: { needed: 0, ordered: 0, owned: 0, planted: 0 }, planted: 0, order: 0, subtotal: 0 };
        rows.set(plant.code, r);
      }
      r.byArea[a.id] = (r.byArea[a.id] ?? 0) + n;
      r.byStatus[it.status] += n;
      r.planted += n;
    }
  }
  const reservePct = project.settings.reservePct;
  const list = [...rows.values()]
    .map((r) => {
      const order = orderQty(r.planted, reservePct, r.plant.isTree);
      return { ...r, order, subtotal: order * (r.plant.unitPriceHuf || 0) };
    })
    // Trees last, then by Hungarian name.
    .sort((x, y) => Number(!!x.plant.isTree) - Number(!!y.plant.isTree) || x.plant.nameHu.localeCompare(y.plant.nameHu, 'hu'));
  return {
    areas,
    rows: list,
    planted: list.reduce((s, r) => s + r.planted, 0),
    order: list.reduce((s, r) => s + r.order, 0),
    total: list.reduce((s, r) => s + r.subtotal, 0),
    unpriced: list.filter((r) => !r.plant.unitPriceHuf).length,
    estimated: list.filter((r) => r.plant.priceSource !== 'shop').length,
    reservePct,
  };
}

// ---------- tabular exports ----------

export const fmtInt = (n: number) => Math.round(n).toLocaleString('hu-HU');
export const fmtFt = (n: number) => `${fmtInt(n)} Ft`;

type Cell = string | number;

/** Header + rows + total row; numbers stay numbers (for XLSX), text for the rest. */
export function bomTable(b: Bom): Cell[][] {
  const perArea = b.areas.length > 1;
  const head: Cell[] = [
    'Kód',
    'Magyar név',
    'Latin név',
    ...(perArea ? b.areas.map((a) => `${a.name} (db)`) : []),
    'Ültetett (db)',
    `Rendelendő (db, +${b.reservePct}%)`,
    'Kiszerelés',
    'Max. magasság (cm)',
    'Tőtáv (cm)',
    'Vízigény',
    'Juglone',
    'Egységár (Ft)',
    'Ár forrása',
    'Részösszeg (Ft)',
  ];
  const rows: Cell[][] = b.rows.map((r) => [
    r.plant.code,
    r.plant.nameHu + (r.plant.isTree ? ' (fa)' : ''),
    r.plant.nameLat,
    ...(perArea ? b.areas.map((a) => r.byArea[a.id] ?? 0) : []),
    r.planted,
    r.order,
    r.plant.pot,
    r.plant.maxHeightCm,
    r.plant.spacingCm,
    WATER_LABEL[r.plant.water],
    JUGLONE_LABEL[r.plant.juglone],
    r.plant.unitPriceHuf || '',
    r.plant.priceSource === 'shop' ? 'boltlista' : 'becslés',
    r.subtotal,
  ]);
  const total: Cell[] = ['', 'Összesen', '', ...(perArea ? b.areas.map((a) => b.rows.reduce((s, r) => s + (r.byArea[a.id] ?? 0), 0)) : []), b.planted, b.order, '', '', '', '', '', '', '', b.total];
  return [head, ...rows, total];
}

/** Tab-separated: pasting into Excel / Sheets splits it into the right columns. */
export const toTsv = (t: Cell[][]) => t.map((r) => r.map((c) => String(c).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\r\n');

/** Semicolon CSV (Hungarian Excel default), quoted where needed. */
export const toCsv = (t: Cell[][]) =>
  t.map((r) => r.map((c) => (typeof c === 'number' ? String(c) : /[;"\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';')).join('\r\n');

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const toHtmlTable = (t: Cell[][]) =>
  `<table>${t.map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${escHtml(String(c))}</th>` : `<td>${escHtml(String(c))}</td>`)).join('')}</tr>`).join('')}</table>`;

/** Readable shopping list for messages / notes. */
export function toText(b: Bom, title: string): string {
  const lines = [`${title} – növénylista (rendelés +${b.reservePct}% tartalékkal, fák tartalék nélkül)`, ''];
  for (const r of b.rows) {
    const price = r.plant.unitPriceHuf ? ` – ${fmtFt(r.plant.unitPriceHuf)}/db – ${fmtFt(r.subtotal)}` : '';
    lines.push(`${r.plant.code} ${r.plant.nameHu} (${r.plant.nameLat}) – ültetés ${r.planted} db – rendelés ${r.order} db – ${r.plant.pot}${price}`);
  }
  lines.push('', `Összesen: ${b.planted} tő, rendelés ${b.order} db, kb. ${fmtFt(b.total)}`);
  if (b.estimated) lines.push(`${b.estimated} tétel ára becslés – vásárlás előtt kérj pontos árat.`);
  return lines.join('\n');
}
