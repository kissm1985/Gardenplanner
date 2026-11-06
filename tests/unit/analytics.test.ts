import { describe, expect, it } from 'vitest';
import { analyticsConfigured, band, track } from '../../src/engine/analytics';

describe('statistics', () => {
  it('sends nothing without a configured server and consent', () => {
    expect(analyticsConfigured()).toBe(false);
    expect(track('list_opened')).toBe(false);
  });
  it('reports counts only as bands', () => {
    expect(band(0)).toBe('0–0');
    expect(band(7)).toBe('1–9');
    expect(band(73)).toBe('50–99');
    expect(band(5000)).toBe('1000+');
  });
});
