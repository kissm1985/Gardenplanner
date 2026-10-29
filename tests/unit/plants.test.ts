import { describe, expect, it } from 'vitest';
import { SEED_PLANTS } from '../../src/data/plants.seed';
import { parseCsv, plantsFromCsv, plantsFromJson, plantsToCsv, suggestCode, validatePlant } from '../../src/model/plants';
import { pointInPolygon } from '../../src/model/geometry';

describe('seed plant list', () => {
  it('has about 60 species with unique 2-letter codes, soil data and valid values', () => {
    expect(SEED_PLANTS.length).toBeGreaterThanOrEqual(55);
    expect(SEED_PLANTS.every((p) => p.soil && p.soil.length > 0)).toBe(true);
    // Shade plants exist for the shady strips.
    expect(SEED_PLANTS.filter((p) => p.sun.includes('shade')).length).toBeGreaterThanOrEqual(12);
    const codes = SEED_PLANTS.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    SEED_PLANTS.forEach((p, i) => expect(validatePlant(p, SEED_PLANTS.slice(0, i))).toEqual([]));
  });

  it('contains the species the spec names, with Latin names', () => {
    const lat = SEED_PLANTS.map((p) => p.nameLat).join(' | ');
    for (const n of ['Lavandula angustifolia', 'Salvia nemorosa', 'Coreopsis', 'Festuca glauca', 'Armeria maritima', 'Sempervivum', 'Thymus', 'Stachys byzantina', 'Bergenia', 'Hosta'])
      expect(lat).toContain(n);
  });

  it('marks uncertain data as "ellenőrizendő" instead of inventing it', () => {
    for (const p of SEED_PLANTS) {
      expect(p.verify).toContain('toxic'); // pet toxicity is undocumented in K-04…K-08
      if (p.juglone === 'unknown') expect(p.verify).toContain('juglone');
      if (p.priceSource === 'estimate') expect(p.verify).toContain('unitPriceHuf');
    }
  });

  it('keeps the K-07 heights inside the 50 cm house strip limit', () => {
    const strip = ['LA', 'SA', 'CO', 'FE', 'TH', 'ST', 'SD', 'EF', 'AR'];
    for (const c of strip) expect(SEED_PLANTS.find((p) => p.code === c)!.maxHeightCm).toBeLessThanOrEqual(50);
  });
});

describe('plant CSV / JSON', () => {
  it('round-trips the whole list through CSV', () => {
    const { plants, errors } = plantsFromCsv(plantsToCsv(SEED_PLANTS));
    expect(errors).toEqual([]);
    expect(plants).toEqual(SEED_PLANTS);
  });

  it('parses quoted cells with separators, quotes and newlines', () => {
    expect(parseCsv('a;"b;c";"d ""e"""\r\n"x\ny";2\n')).toEqual([
      ['a', 'b;c', 'd "e"'],
      ['x\ny', '2'],
    ]);
  });

  it('reports bad rows and keeps the good ones', () => {
    const csv = 'kod;magyar_nev;max_magassag_cm\nLA;Levendula;45\nLAA;Rossz;10\nLB;;10\n';
    const r = plantsFromCsv(csv);
    expect(r.plants.map((p) => p.code)).toEqual(['LA']);
    expect(r.errors).toHaveLength(2);
  });

  it('accepts a JSON array or a project export', () => {
    expect(plantsFromJson(JSON.stringify(SEED_PLANTS.slice(0, 2))).plants).toHaveLength(2);
    expect(plantsFromJson(JSON.stringify({ plantDb: SEED_PLANTS })).plants).toHaveLength(SEED_PLANTS.length);
    expect(plantsFromJson('nem json').errors).toHaveLength(1);
  });

  it('suggests a free code', () => {
    expect(suggestCode('Levendula', new Set())).toBe('LE');
    expect(suggestCode('Levendula', new Set(['LE']))).toBe('LV');
  });
});

describe('geometry', () => {
  it('point in polygon', () => {
    const sq: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(pointInPolygon([5, 5], sq)).toBe(true);
    expect(pointInPolygon([15, 5], sq)).toBe(false);
  });
});
