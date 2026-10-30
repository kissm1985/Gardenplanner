import { unzipSync, strFromU8 } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { bomTable, buildBom, orderQty, toCsv, toText, toTsv } from '../../src/engine/bom';
import { buildXlsx, sheetName } from '../../src/engine/xlsx';
import { useProject } from '../../src/store/projectStore';

const st = () => useProject.getState();

describe('order quantity', () => {
  it('adds the reserve and rounds up; trees get none', () => {
    expect(orderQty(15, 10)).toBe(17); // K-07: 15 → 17
    expect(orderQty(20, 10)).toBe(22);
    expect(orderQty(10, 10)).toBe(11);
    expect(orderQty(1, 10)).toBe(2);
    expect(orderQty(0, 10)).toBe(0);
    expect(orderQty(2, 10, true)).toBe(2);
    expect(orderQty(7, 0)).toBe(7);
  });
});

describe('bill of materials', () => {
  beforeEach(() => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip', 'lawn-garden']);
  });
  const [strip, garden] = [0, 1];
  const areaId = (i: number) => st().project!.areas[i].id;

  it('sums plants, drifts and rows per area and overall, with prices', () => {
    st().selectArea(areaId(strip));
    st().addRow('LA', [[60, 0], [60, 400]]); // 11 lavender
    st().placePlant('TH', 20, 20);
    st().selectArea(areaId(garden));
    st().addDrift('LA', [[0, 0], [120, 0], [120, 80], [0, 80]], 'grid'); // 3 × 2 = 6
    st().placePlant('AC', 450, 200);
    const b = buildBom(st().project!);
    const la = b.rows.find((r) => r.plant.code === 'LA')!;
    expect(la.planted).toBe(17);
    expect(la.byArea).toEqual({ [areaId(strip)]: 11, [areaId(garden)]: 6 });
    expect(la.order).toBe(19);
    expect(la.subtotal).toBe(19 * 1099);
    expect(b.rows[b.rows.length - 1].plant.code).toBe('AC'); // trees last
    expect(b.order).toBe(19 + 2 + 1);
    expect(b.total).toBe(19 * 1099 + 2 * 1299 + 5799);
    expect(buildBom(st().project!, [areaId(strip)]).planted).toBe(12);
  });

  it('counts the chosen variant by default, or the one shown on the plan', () => {
    st().selectArea(areaId(strip));
    st().addRow('LA', [[60, 0], [60, 400]]); // 11 in A (chosen)
    const area = () => st().project!.areas[strip];
    const vb = st().duplicateVariant(area().variants[0].id)!;
    st().setActiveVariant(vb);
    st().placePlant('TH', 20, 20); // B: 12
    expect(buildBom(st().project!, [areaId(strip)]).planted).toBe(11);
    expect(buildBom(st().project!, [areaId(strip)], null, 'shown').planted).toBe(12);
  });

  it('filters by status and bulk-sets a species status', () => {
    st().selectArea(areaId(strip));
    st().addRow('LA', [[60, 0], [60, 400]]);
    st().placePlant('TH', 20, 20);
    st().setSpeciesStatus('LA', 'ordered', [areaId(strip)]);
    expect(buildBom(st().project!, undefined, 'ordered').rows.map((r) => r.plant.code)).toEqual(['LA']);
    expect(buildBom(st().project!, undefined, 'needed').rows.map((r) => r.plant.code)).toEqual(['TH']);
  });

  it('reserve setting changes the order', () => {
    st().selectArea(areaId(strip));
    st().addRow('LA', [[60, 0], [60, 400]]);
    st().updateSettings({ reservePct: 20 });
    expect(buildBom(st().project!).rows[0].order).toBe(14);
  });

  it('acceptance: the TSV pasted into Excel gives the right columns', () => {
    st().selectArea(areaId(strip));
    st().addRow('LA', [[60, 0], [60, 400]]);
    st().placePlant('EF', 30, 500);
    const t = bomTable(buildBom(st().project!, [areaId(strip)]));
    const lines = toTsv(t).split('\r\n').map((l) => l.split('\t'));
    const w = lines[0].length;
    expect(lines.every((l) => l.length === w)).toBe(true);
    expect(lines[0].slice(0, 5)).toEqual(['Kód', 'Magyar név', 'Latin név', 'Ültetett (db)', 'Rendelendő (db, +10%)']);
    const la = lines.find((l) => l[0] === 'LA')!;
    expect(la[3]).toBe('11');
    expect(la[4]).toBe('13');
    expect(lines[lines.length - 1][1]).toBe('Összesen');
  });

  it('per-area columns in the overall table; CSV quoting', () => {
    st().selectArea(areaId(strip));
    st().placePlant('LA', 60, 60);
    const t = bomTable(buildBom(st().project!));
    expect(t[0]).toContain('Házoldali sáv (db)');
    expect(t[0]).toContain('Gyepsávos kert (db)');
    expect(toCsv([['a;b', 'say "hi"', 3]])).toBe('"a;b";"say ""hi""";3');
  });

  it('readable text list', () => {
    st().selectArea(areaId(strip));
    st().addRow('LA', [[60, 0], [60, 400]]);
    const txt = toText(buildBom(st().project!), 'Kertem');
    expect(txt).toContain('LA Levendula (Lavandula angustifolia');
    expect(txt).toContain('ültetés 11 db – rendelés 13 db');
  });
});

describe('xlsx', () => {
  it('writes a valid workbook with numeric cells and one sheet per table', () => {
    const data = buildXlsx([
      { name: 'Összesen', rows: [['Kód', 'Db'], ['LA', 17], ['<&>', 3]] },
      { name: 'Házoldali sáv: [teszt]', rows: [['Kód'], ['TH']] },
    ]);
    const files = unzipSync(data);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/styles.xml']),
    );
    const wb = strFromU8(files['xl/workbook.xml']);
    expect(wb).toContain('name="Összesen"');
    expect(wb).toContain('name="Házoldali sáv   teszt"');
    const s1 = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(s1).toContain('<c r="B2"><v>17</v></c>');
    expect(s1).toContain('&lt;&amp;&gt;');
  });

  it('sheet names are unique and ≤ 31 characters', () => {
    const taken = new Set<string>();
    expect(sheetName('A', taken)).toBe('A');
    expect(sheetName('a', taken)).toBe('a 2');
    expect(sheetName('x'.repeat(40), taken)).toHaveLength(31);
  });
});
