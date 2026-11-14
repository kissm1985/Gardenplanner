// Spec v0.2 F3: the "show prices" setting (off by default, kept in localStorage) and the outputs that follow it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bomTable, buildBom, toCsv, toText, toTsv } from '../../src/engine/bom';
import { useProject } from '../../src/store/projectStore';

function fakeStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('setting', () => {
  it('is off by default and survives a reload (module re-import over the same storage)', async () => {
    vi.stubGlobal('localStorage', fakeStorage());
    let m = await import('../../src/model/prices');
    expect(m.getShowPrices()).toBe(false);
    m.setShowPrices(true);
    vi.resetModules();
    m = await import('../../src/model/prices');
    expect(m.getShowPrices()).toBe(true);
    m.setShowPrices(false);
    vi.resetModules();
    m = await import('../../src/model/prices');
    expect(m.getShowPrices()).toBe(false);
  });

  it('stays off without storage (private mode)', async () => {
    vi.stubGlobal('localStorage', undefined);
    const m = await import('../../src/model/prices');
    expect(m.getShowPrices()).toBe(false);
  });
});

describe('outputs', () => {
  const project = () => {
    const st = useProject.getState;
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip']);
    st().addRow('LA', [
      [60, 0],
      [60, 400],
    ]);
    st().placePlant('EF', 30, 500);
    return st().project!;
  };
  const priceWords = /Egységár|Részösszeg|Ár forrása|Ft\b|irányár|becslés/;

  it('OFF: no price column, value or total in the table, TSV, CSV or text', () => {
    const b = buildBom(project());
    const table = bomTable(b, false);
    expect(table[0].join('|')).not.toMatch(priceWords);
    expect(table.flat()).not.toContain(b.total);
    expect(table.flat()).not.toContain(b.rows[0].subtotal);
    expect(toTsv(table)).not.toMatch(priceWords);
    expect(toCsv(table)).not.toMatch(priceWords);
    const txt = toText(b, 'Kertem', false);
    expect(txt).not.toMatch(priceWords);
    expect(txt).toContain('Összesen: ');
    // The data keeps its prices.
    expect(b.total).toBeGreaterThan(0);
  });

  it('ON: unit price, source and subtotal columns, the total, and prices in the text', () => {
    const b = buildBom(project());
    const table = bomTable(b, true);
    expect(table[0]).toEqual(expect.arrayContaining(['Egységár (Ft)', 'Ár forrása', 'Részösszeg (Ft)']));
    expect(table.at(-1)!.at(-1)).toBe(b.total);
    expect(new Set(table.map((r) => r.length)).size).toBe(1);
    expect(toText(b, 'Kertem', true)).toMatch(/\d Ft/);
  });

  it('OFF and ON tables have rectangular rows', () => {
    const b = buildBom(project());
    for (const on of [false, true]) expect(new Set(bomTable(b, on).map((r) => r.length)).size).toBe(1);
  });
});
