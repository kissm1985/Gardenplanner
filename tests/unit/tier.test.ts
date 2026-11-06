import { describe, expect, it } from 'vitest';
import { SEED_CODES } from '../../src/data/plants.seed';
import { ALAP_CODES, FEATURE_TIER, hasFeature, TIERS } from '../../src/model/tier';

describe('tiers', () => {
  it('Basic has about 40 built-in species, all of them real codes', () => {
    expect(ALAP_CODES.size).toBeGreaterThanOrEqual(38);
    expect(ALAP_CODES.size).toBeLessThanOrEqual(45);
    for (const c of ALAP_CODES) expect(SEED_CODES.has(c), c).toBe(true);
  });
  it('each higher tier has everything the lower one has', () => {
    for (const f of Object.keys(FEATURE_TIER) as (keyof typeof FEATURE_TIER)[]) {
      const has = TIERS.map((t) => hasFeature(f, t));
      expect(has).toEqual([...has].sort((a, b) => Number(a) - Number(b)));
    }
    expect(hasFeature('rowTool', 'alap')).toBe(false);
    expect(hasFeature('rowTool', 'halado')).toBe(true);
    expect(hasFeature('pdfHeader', 'halado')).toBe(false);
    expect(hasFeature('pdfHeader', 'profi')).toBe(true);
  });
});
