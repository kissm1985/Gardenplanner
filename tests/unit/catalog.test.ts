import { describe, expect, it } from 'vitest';
import { guessMapping, parseCsvText, readImportRows, validateChanges, validateSpecies } from '../../src/engine/catalog';
import { buildXlsx } from '../../src/engine/xlsx';
import { readXlsx } from '../../src/engine/xlsxRead';
import { mergeCatalog, offerFor, type NurseryCatalog } from '../../src/model/nursery';
import { AREA_TEMPLATES } from '../../src/data/templates';
import { newProject, seedByCode } from '../../src/store/projectModel';

describe('catalogue schema', () => {
  it('accepts a valid species and normalises it', () => {
    const r = validateSpecies({ code: 'la', nameHu: ' Levendula ', nameLat: 'Lavandula', sun: ['sun', 'sun'], offers: [{ pot: 'P9', priceHuf: '990', stock: 5 }] });
    expect(r).toEqual({ ok: true, value: { code: 'LA', nameHu: 'Levendula', nameLat: 'Lavandula', sun: ['sun'], offers: [{ pot: 'P9', priceHuf: 990, stock: 5 }] } });
  });
  it('lists every problem', () => {
    const r = validateSpecies({
      code: 'L',
      nameHu: 'x\u0007',
      nameLat: '',
      water: 'lots',
      offers: [
        { pot: 'P9', priceHuf: 1.5 },
        { pot: 'p9', priceHuf: 1 },
      ],
    });
    expect(r.ok).toBe(false);
    const e = (r as { errors: string[] }).errors.join('\n');
    for (const f of ['code', 'nameHu', 'nameLat', 'water', 'priceHuf']) expect(e).toContain(f);
  });
  it('checks server responses before use', () => {
    expect(validateChanges({ version: 2, since: 0, entries: [{ code: 'LA', version: 2, deleted: true }] }).ok).toBe(true);
    expect(validateChanges({ version: 2, since: 0, entries: [{ code: 'LA', version: 2, species: { code: 'XX', nameHu: 'a', nameLat: 'b', offers: [] } }] }).ok).toBe(false);
    expect(validateChanges({ version: -1, since: 0, entries: [] }).ok).toBe(false);
    expect(validateChanges('<html>').ok).toBe(false);
  });
});

describe('price list import', () => {
  it('reads CSV with ; , or tab and guesses the columns', () => {
    for (const sep of [';', ',', '\t']) {
      const rows = parseCsvText(`\uFEFFKód${sep}Cserép${sep}Ár${sep}Készlet\r\nLA${sep}P9${sep}990${sep}12\n`);
      expect(rows).toEqual([
        ['Kód', 'Cserép', 'Ár', 'Készlet'],
        ['LA', 'P9', '990', '12'],
      ]);
    }
    expect(guessMapping(['Cikkszám', 'Megnevezés', 'Latin név', 'Méret', 'Bruttó ár', 'Db'])).toEqual({ code: 0, nameHu: 1, nameLat: 2, pot: 3, priceHuf: 4, stock: 5 });
  });
  it('checks each row on its own', () => {
    const r = readImportRows([
      ['kod', 'cserep', 'ar'],
      ['la', 'P9', '1 290 Ft'],
      ['', 'P9', '100'],
      ['SA', 'C2', '12,5'],
    ]);
    expect(r.rows[0]).toMatchObject({ code: 'LA', offer: { pot: 'P9', priceHuf: 1290 }, errors: [] });
    expect(r.rows[1].errors[0]).toMatch(/code/);
    expect(r.rows[2].errors[0]).toMatch(/priceHuf/);
    expect(readImportRows([['név'], ['x']]).errors.length).toBe(3);
  });
  it('reads XLSX files (shared and inline strings, numbers)', () => {
    const bytes = buildXlsx([
      {
        name: 'Árlista',
        rows: [
          ['Kód', 'Név', 'Cserép', 'Ár'],
          ['LA', 'Levendula & társai', 'P9', 990],
          ['SA', 'Zsálya', '2 l', 1890],
        ],
      },
    ]);
    expect(readXlsx(bytes)).toEqual([
      ['Kód', 'Név', 'Cserép', 'Ár'],
      ['LA', 'Levendula & társai', 'P9', '990'],
      ['SA', 'Zsálya', '2 l', '1890'],
    ]);
    expect(() => readXlsx(new Uint8Array([1, 2, 3]))).toThrow(/XLSX/);
  });
});

describe('merging a catalogue into the plant list', () => {
  const cat = (species: NurseryCatalog['species']): NurseryCatalog => ({ server: 'https://x', tenant: 'kert-a', name: 'A Kertészet', version: 1, syncedAt: '', species });

  it('prefers the offer in the plant’s own pot size', () => {
    expect(
      offerFor({ pot: '2 L' }, [
        { pot: 'P9', priceHuf: 900 },
        { pot: '2l', priceHuf: 1800 },
      ])?.priceHuf,
    ).toBe(1800);
    expect(
      offerFor({ pot: 'C10' }, [
        { pot: 'P9', priceHuf: 900 },
        { pot: '2l', priceHuf: 700 },
      ])?.priceHuf,
    ).toBe(700);
  });

  it('sets nursery prices, adds offered species, and reports species no longer offered', () => {
    const p = newProject([AREA_TEMPLATES[0].key]);
    const la = p.plantDb.find((x) => x.code === 'LA')!;
    const c1 = cat({
      LA: { code: 'LA', nameHu: 'Levendula', nameLat: 'Lavandula', offers: [{ pot: la.pot, priceHuf: 1111, stock: 3 }] },
      ZZ9: { code: 'ZZ9', nameHu: 'Saját fajta', nameLat: 'Rosa ‘Saját’', spreadCm: 50, offers: [{ pot: 'C5', priceHuf: 4500 }] },
    });
    const r1 = mergeCatalog(p, c1, seedByCode);
    expect(r1.plantDb.find((x) => x.code === 'LA')).toMatchObject({ nurseryPrice: 1111, nurseryStock: 3 });
    expect(r1.added).toEqual(['ZZ9']);
    expect(r1.plantDb.find((x) => x.code === 'ZZ9')).toMatchObject({
      nameHu: 'Saját fajta',
      pot: 'C5',
      unitPriceHuf: 4500,
      nurseryPrice: 4500,
      spacingCm: 40,
      dataSource: 'A Kertészet',
    });
    // Repeating the same merge changes nothing.
    const again = mergeCatalog({ ...p, plantDb: r1.plantDb }, c1, seedByCode);
    expect([again.added, again.updated]).toEqual([[], []]);

    // LA is placed in the plan and then dropped by the nursery.
    const area = { ...p.areas[0] };
    const placed = {
      ...p,
      plantDb: r1.plantDb,
      areas: [{ ...area, variants: area.variants.map((v) => ({ ...v, items: [{ kind: 'plant' as const, id: 'i1', plantId: 'LA', x: 10, y: 10, status: 'needed' as const }] })) }],
    };
    const r2 = mergeCatalog(placed, cat({}), seedByCode);
    const laAfter = r2.plantDb.find((x) => x.code === 'LA')!;
    expect(laAfter.nurseryPrice).toBeUndefined();
    expect(r2.gone).toEqual([{ code: 'LA', name: la.nameHu, placed: 1 }]);
    expect(r2.plantDb.some((x) => x.code === 'ZZ9')).toBe(true); // nothing is deleted
  });
});
