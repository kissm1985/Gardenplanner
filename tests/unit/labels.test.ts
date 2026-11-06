import { describe, expect, it } from 'vitest';
import { placeLabels } from '../../src/canvas/layers/Plants';

describe('group labels do not cover each other', () => {
  it('moves the second of two overlapping labels and draws a leader', () => {
    const out = placeLabels(
      [
        { id: 'a', x: 100, y: 100, text: 'BX × 43' },
        { id: 'b', x: 105, y: 102, text: 'LA × 22' },
      ],
      10,
    );
    const a = out.find((l) => l.id === 'a')!;
    const b = out.find((l) => l.id === 'b')!;
    expect(a.moved).toBe(false);
    expect(b.moved).toBe(true);
    expect(Math.abs(b.y - a.y)).toBeGreaterThanOrEqual(17);
  });
  it('hides labels when there is no free place nearby; far ones stay put', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, x: 0, y: 0, text: 'XX × 10' }));
    const out = placeLabels([...many, { id: 'far', x: 500, y: 500, text: 'FE × 9' }], 10);
    expect(out.filter((l) => l.hidden).length).toBe(3);
    expect(out.find((l) => l.id === 'far')!.moved).toBe(false);
  });
});
