// Bill of materials (SPEC §4.6): planted and order quantities, prices, per area and overall.
import { byPlantName, JUGLONE_LABEL, plantName, WATER_LABEL } from '../model/plants';
import type { Area, ItemStatus, PlacedItem, Plant, Project } from '../model/types';
import { itemCount } from './fill';
import { locale, t } from '../i18n';

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

/** Items of the variant shown on the plan (the edited one). */
export const shownItems = (a: Area): PlacedItem[] =>
  (a.variants.find((v) => v.id === (a.activeVariantId ?? a.chosenVariantId)) ?? a.variants[0])?.items ?? [];

/**
 * @param areaIds areas in scope (all when omitted)
 * @param status only count items with this status
 * @param source 'chosen' variants (default, for print and orders) or the 'shown' ones on the plan
 */
export function buildBom(project: Project, areaIds?: string[], status?: ItemStatus | null, source: 'chosen' | 'shown' = 'chosen'): Bom {
  const areas = project.areas.filter((a) => !areaIds || areaIds.includes(a.id));
  const pick = source === 'shown' ? shownItems : chosenItems;
  return bomFromEntries(
    areas.map((area) => ({ area, items: pick(area) })),
    project.plantDb,
    project.settings.reservePct,
    status,
  );
}

/** BOM for explicit item lists (e.g. one variant of an area, for comparison). */
export function bomFromEntries(entries: { area: Area; items: PlacedItem[] }[], plantDb: Plant[], reservePct: number, status?: ItemStatus | null): Bom {
  const areas = entries.map((e) => e.area);
  const plants = new Map(plantDb.map((p) => [p.code, p]));
  const rows = new Map<string, BomRow>();
  for (const { area: a, items } of entries) {
    for (const it of items) {
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
  const list = [...rows.values()]
    .map((r) => {
      const order = orderQty(r.planted, reservePct, r.plant.isTree);
      return { ...r, order, subtotal: order * (r.plant.unitPriceHuf || 0) };
    })
    // Trees last, then by Hungarian name.
    .sort((x, y) => Number(!!x.plant.isTree) - Number(!!y.plant.isTree) || byPlantName(x.plant, y.plant));
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

export const fmtInt = (n: number) => Math.round(n).toLocaleString(locale());
export const fmtFt = (n: number) => t(`${fmtInt(n)} Ft`, `${fmtInt(n)} HUF`);

type Cell = string | number;

/** Header + rows + total row; numbers stay numbers (for XLSX), text for the rest. */
export function bomTable(b: Bom): Cell[][] {
  const perArea = b.areas.length > 1;
  const head: Cell[] = [
    t('Kód', 'Code'),
    t('Magyar név', 'Name'),
    t('Latin név', 'Latin name'),
    ...(perArea ? b.areas.map((a) => t(`${a.name} (db)`, `${a.name} (pcs)`)) : []),
    t('Ültetett (db)', 'Planted (pcs)'),
    t(`Rendelendő (db, +${b.reservePct}%)`, `To order (pcs, +${b.reservePct}%)`),
    t('Kiszerelés', 'Pot size'),
    t('Max. magasság (cm)', 'Max. height (cm)'),
    t('Tőtáv (cm)', 'Spacing (cm)'),
    t('Vízigény', 'Water'),
    'Juglone',
    t('Egységár (Ft)', 'Unit price (HUF)'),
    t('Ár forrása', 'Price source'),
    t('Részösszeg (Ft)', 'Subtotal (HUF)'),
  ];
  const rows: Cell[][] = b.rows.map((r) => [
    r.plant.code,
    plantName(r.plant) + (r.plant.isTree ? t(' (fa)', ' (tree)') : ''),
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
    r.plant.priceSource === 'shop' ? t('boltlista', 'shop list') : t('becslés', 'estimate'),
    r.subtotal,
  ]);
  const total: Cell[] = ['', t('Összesen', 'Total'), '', ...(perArea ? b.areas.map((a) => b.rows.reduce((s, r) => s + (r.byArea[a.id] ?? 0), 0)) : []), b.planted, b.order, '', '', '', '', '', '', '', b.total];
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
  const lines = [
    t(`${title} – növénylista (rendelés +${b.reservePct}% tartalékkal, fák tartalék nélkül)`, `${title} – plant list (order +${b.reservePct}% spare, trees without spare)`),
    '',
  ];
  for (const r of b.rows) {
    const price = r.plant.unitPriceHuf ? t(` – ${fmtFt(r.plant.unitPriceHuf)}/db – ${fmtFt(r.subtotal)}`, ` – ${fmtFt(r.plant.unitPriceHuf)} each – ${fmtFt(r.subtotal)}`) : '';
    lines.push(
      t(
        `${r.plant.code} ${plantName(r.plant)} (${r.plant.nameLat}) – ültetés ${r.planted} db – rendelés ${r.order} db – ${r.plant.pot}${price}`,
        `${r.plant.code} ${plantName(r.plant)} (${r.plant.nameLat}) – plant ${r.planted} – order ${r.order} – ${r.plant.pot}${price}`,
      ),
    );
  }
  lines.push('', t(`Összesen: ${b.planted} tő, rendelés ${b.order} db, kb. ${fmtFt(b.total)}`, `Total: ${b.planted} plants, order ${b.order}, about ${fmtFt(b.total)}`));
  if (b.estimated) lines.push(t(`${b.estimated} tétel ára becslés – vásárlás előtt kérj pontos árat.`, `${b.estimated} prices are estimates – ask for exact prices before buying.`));
  return lines.join('\n');
}
