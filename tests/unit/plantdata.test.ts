import { describe, expect, it } from 'vitest';
import { SEED_PLANTS, SEED_SINCE, PRICE_DATE } from '../../src/data/plants.seed';
import { careCalendar } from '../../src/engine/care';
import { buildBom } from '../../src/engine/bom';
import { filterPlants, NO_FILTER } from '../../src/model/plantFilter';
import { applyReviewCsv } from '../../src/model/review';
import { plantsFromCsv, plantsToCsv, reviewCsv } from '../../src/model/plants';
import { migrate, newProject, plantHash, SEED_VERSION, seedPlants } from '../../src/store/projectStore';
import type { Project } from '../../src/model/types';

describe('built-in plants: version 6', () => {
  it('has roses, fruit, vegetables and herbs with their months, added in seed version 6', () => {
    for (const cat of ['rose', 'fruit', 'vegetable', 'herb'] as const) expect(SEED_PLANTS.filter((p) => p.category === cat).length, cat).toBeGreaterThanOrEqual(3);
    const tomato = SEED_PLANTS.find((p) => p.code === 'PD')!;
    expect(tomato.plantOutMonths).toEqual([5]);
    expect(SEED_SINCE.PD).toBe(6);
    expect(new Set(SEED_PLANTS.map((p) => p.code)).size).toBe(SEED_PLANTS.length);
    expect(SEED_PLANTS.every((p) => p.priceDate === PRICE_DATE)).toBe(true);
  });

  it('filters by group, edible, native and bee-friendly', () => {
    expect(filterPlants(SEED_PLANTS, { ...NO_FILTER, group: 'herb' }).every((p) => p.category === 'herb')).toBe(true);
    expect(filterPlants(SEED_PLANTS, { ...NO_FILTER, edible: 'yes' }).length).toBeGreaterThanOrEqual(20);
    expect(filterPlants(SEED_PLANTS, { ...NO_FILTER, native: 'yes' }).map((p) => p.code)).toContain('TH');
    expect(filterPlants(SEED_PLANTS, { ...NO_FILTER, bee: 'yes' }).map((p) => p.code)).toContain('LA');
  });

  it('keeps the new fields through CSV', () => {
    const back = plantsFromCsv(plantsToCsv(SEED_PLANTS.filter((p) => p.category))).plants;
    expect(back.find((p) => p.code === 'PD')?.harvestMonths).toEqual([7, 8, 9]);
    expect(back.find((p) => p.code === 'MH')?.native).toBe(true);
  });

  it('puts sowing, planting out and harvest into the care calendar', () => {
    const p = newProject(['house-strip']);
    p.areas[0].variants[0].items = [{ kind: 'plant', id: 'i1', plantId: 'PD', x: 50, y: 100, status: 'needed' }];
    const cal = careCalendar(p);
    expect(cal[4].some((x) => x.text.startsWith('Kiültetés') && x.codes.includes('PD'))).toBe(true);
    expect(cal[7].some((x) => x.text.startsWith('Betakarítás') && x.codes.includes('PD'))).toBe(true);
  });
});

describe('updates of the built-in data', () => {
  const v5 = (p: Project): Project => ({ ...p, settings: { ...p.settings, seedVersion: 5 } });

  it('an untouched copy takes the new data; an edited one keeps its values and is offered the update', () => {
    const p = newProject([]);
    const la = p.plantDb.find((x) => x.code === 'LA')!;
    const se = p.plantDb.find((x) => x.code === 'SE')!;
    // Pretend both were copied from older built-in data (a different fingerprint).
    const old = { ...la, maxHeightCm: 40 };
    const oldLa = { ...old, seedHash: plantHash(old) };
    const edited = { ...se, seedHash: 'older', maxHeightCm: 99 };
    const out = migrate(v5({ ...p, plantDb: p.plantDb.map((x) => (x.code === 'LA' ? oldLa : x.code === 'SE' ? edited : x)) }));
    expect(out.plantDb.find((x) => x.code === 'LA')?.maxHeightCm).toBe(45);
    expect(out.plantDb.find((x) => x.code === 'SE')?.maxHeightCm).toBe(99);
    expect(out.plantDb.find((x) => x.code === 'SE')?.seedUpdate).toBe(true);
    expect(out.settings.seedVersion).toBe(SEED_VERSION);
  });

  it('new species come in once; a deleted old species stays deleted', () => {
    const p = newProject([]);
    const old = v5({ ...p, plantDb: p.plantDb.filter((x) => !x.category && x.code !== 'LA') });
    const out = migrate(old);
    expect(out.plantDb.some((x) => x.code === 'PD')).toBe(true);
    expect(out.plantDb.some((x) => x.code === 'LA')).toBe(false);
  });

  it('nursery prices win in the list and are marked', () => {
    const p = newProject(['house-strip']);
    p.areas[0].variants[0].items = [{ kind: 'plant', id: 'i1', plantId: 'LA', x: 50, y: 100, status: 'needed' }];
    p.plantDb = p.plantDb.map((x) => (x.code === 'LA' ? { ...x, nurseryPrice: 1500 } : x));
    const bom = buildBom(p);
    expect(bom.rows[0].subtotal).toBe(bom.rows[0].order * 1500);
  });

  it('seed copies carry a fingerprint that matches their data', () => {
    for (const x of seedPlants().slice(0, 5)) expect(plantHash(x)).toBe(x.seedHash);
  });
});

describe('expert review worksheet', () => {
  it('reads back corrections and confirmations', () => {
    const db = seedPlants().filter((p) => ['EC', 'LA'].includes(p.code));
    const sheet = reviewCsv(db).split('\n');
    const head = sheet[0];
    const rows = sheet.slice(1).filter(Boolean);
    const ecToxic = rows.find((r) => r.startsWith('EC;') && r.includes('Mérgezőség'))!;
    const laPrice = rows.find((r) => r.startsWith('LA;') && r.includes(';Ár;'));
    const filled = [head, ecToxic.replace(/;$/, ';nem'), ...(laPrice ? [laPrice.replace(/;$/, ';ok')] : [])].join('\n');
    const res = applyReviewCsv(db, filled, '2026-11-06');
    expect(res.errors).toEqual([]);
    const ec = res.plants.find((p) => p.code === 'EC')!;
    expect(ec.toxic).toBe('no');
    expect(ec.verify).not.toContain('toxic');
    expect(ec.checkedAt).toBe('2026-11-06');
    expect(res.overlay.EC.set).toEqual({ toxic: 'no' });
  });
});

describe('new projects', () => {
  it('start at the current built-in data version', () => {
    expect(newProject([]).settings.seedVersion).toBe(SEED_VERSION);
  });
});
