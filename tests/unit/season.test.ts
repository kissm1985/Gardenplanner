import { describe, expect, it } from 'vitest';
import { SEED_PLANTS } from '../../src/data/plants.seed';
import { bloomSeason, plantLook, seasonOf, seasonSummary } from '../../src/engine/season';
import { blankPlant } from '../../src/model/plants';

const P = (c: string) => SEED_PLANTS.find((p) => p.code === c)!;

describe('season view', () => {
  it('months map to seasons', () => {
    expect([1, 3, 6, 9, 12].map(seasonOf)).toEqual([3, 0, 1, 2, 3]);
  });

  it('lavender: purple in July, grey-green in August and spring, silver in winter', () => {
    const la = P('LA');
    expect(bloomSeason(la)).toBe(1);
    expect(plantLook(la, 7)).toMatchObject({ color: '#8b6bb5', blooming: true });
    expect(plantLook(la, 8).blooming).toBe(false);
    expect(plantLook(la, 8).color).toBe(la.seasonColors![0]);
    expect(plantLook(la, 1)).toMatchObject({ color: la.seasonColors![3], opacity: 0.94 }); // winter interest
  });

  it('plants not decorative in winter are faded and smaller', () => {
    const sa = P('SA');
    const w = plantLook(sa, 1);
    expect(w.opacity).toBeLessThan(0.5);
    expect(w.scale).toBeLessThan(1);
    expect(plantLook(sa, 7).opacity).toBeGreaterThan(0.9);
  });

  it('spring bloomers (bergenia, magnolia) flower in spring', () => {
    expect(plantLook(P('BE'), 4)).toMatchObject({ blooming: true, color: P('BE').seasonColors![0] });
    expect(plantLook(P('MG'), 4).blooming).toBe(true);
  });

  it('custom plants without season colours fall back to colour / green / straw', () => {
    const p = { ...blankPlant('ZZ'), color: '#ff0000', bloomMonths: [6] };
    expect(plantLook(p, 6).color).toBe('#ff0000');
    expect(plantLook(p, 9).color).toBe('#6f9a5a');
    expect(plantLook(p, 1).opacity).toBeLessThan(0.5);
  });

  it('summary lists blooming and winter-interest species', () => {
    const s = seasonSummary(SEED_PLANTS, 1);
    expect(s.winter.map((p) => p.code)).toContain('FE');
    expect(seasonSummary(SEED_PLANTS, 7).blooming.map((p) => p.code)).toContain('LA');
  });
});
