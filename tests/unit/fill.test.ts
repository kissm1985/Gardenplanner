import { describe, expect, it } from 'vitest';
import { fillPath, fillPolygon, itemCount, spacingForCount } from '../../src/engine/fill';
import { dist, pointInPolygon, polylineLength, simplify } from '../../src/model/geometry';
import type { Pt } from '../../src/model/types';

const rect = (w: number, h: number, x = 0, y = 0): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

describe('drift fill', () => {
  it('square grid: 100×100 cm at 25 cm spacing gives 4×4', () => {
    const pts = fillPolygon(rect(100, 100), 25, 'grid');
    expect(pts).toHaveLength(16);
    expect(pts[0]).toEqual([12.5, 12.5]);
  });

  it('staggered grid keeps every neighbour at least the spacing apart and packs denser', () => {
    const poly = rect(300, 300);
    const st = fillPolygon(poly, 30, 'staggered');
    const gr = fillPolygon(poly, 30, 'grid');
    expect(st.length).toBeGreaterThan(gr.length);
    for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) expect(dist(st[i], st[j])).toBeGreaterThan(29.99);
    // ≈ area / (s²·√3/2)
    expect(st.length / (90000 / (900 * 0.866))).toBeGreaterThan(0.85);
  });

  it('all positions lie inside an irregular polygon', () => {
    const poly: Pt[] = [[0, 0], [200, 30], [160, 180], [40, 140], [10, 80]];
    const pts = fillPolygon(poly, 25, 'staggered');
    expect(pts.length).toBeGreaterThan(20);
    for (const p of pts) expect(pointInPolygon(p, poly)).toBe(true);
  });

  it('a tiny drift still gets one plant', () => {
    expect(fillPolygon(rect(10, 10), 40, 'grid')).toHaveLength(1);
  });

  it('120 cm house strip, 1 m long, lavender at 40 cm: 3 across × 2 along', () => {
    expect(fillPolygon(rect(120, 100), 40, 'grid')).toHaveLength(6);
  });
});

describe('row and curve', () => {
  it('straight row: both ends included, evenly spaced', () => {
    const pts = fillPath([[0, 0], [100, 0]], 25);
    expect(pts).toHaveLength(5);
    expect(pts[4]).toEqual([100, 0]);
  });

  it('length that does not divide evenly is rounded to the nearest count', () => {
    expect(fillPath([[0, 0], [110, 0]], 25)).toHaveLength(5); // 27.5 cm step
    expect(fillPath([[0, 0], [10, 0]], 25)).toHaveLength(1);
  });

  it('follows a curve with equal arc-length steps', () => {
    const arc: Pt[] = Array.from({ length: 50 }, (_, i) => {
      const a = (i / 49) * Math.PI;
      return [100 * Math.cos(a), 100 * Math.sin(a)];
    });
    const pts = fillPath(arc, 30);
    expect(pts.length).toBe(Math.round(polylineLength(arc) / 30) + 1);
    for (const [x, y] of pts) expect(Math.hypot(x, y)).toBeCloseTo(100, 0);
  });
});

describe('counts', () => {
  it('itemCount matches the positions', () => {
    expect(itemCount({ kind: 'plant', id: 'a', plantId: 'LA', x: 0, y: 0, status: 'needed' })).toBe(1);
    expect(itemCount({ kind: 'drift', id: 'b', plantId: 'LA', polygon: rect(100, 100), pattern: 'grid', spacingCm: 25, count: 0, status: 'needed' })).toBe(16);
  });

  it('spacingForCount finds a spacing that yields the requested count', () => {
    const poly = rect(200, 100);
    const s = spacingForCount((sp) => fillPolygon(poly, sp, 'grid').length, 32);
    expect(fillPolygon(poly, s, 'grid').length).toBe(32);
    const r = spacingForCount((sp) => fillPath([[0, 0], [300, 0]], sp).length, 7);
    expect(fillPath([[0, 0], [300, 0]], r)).toHaveLength(7);
  });

  it('simplify keeps the shape of a freehand stroke', () => {
    const stroke: Pt[] = Array.from({ length: 200 }, (_, i) => [i, Math.sin(i / 20) * 30 + (i % 2) * 0.3]);
    const s = simplify(stroke, 2);
    expect(s.length).toBeLessThan(40);
    expect(s[0]).toEqual(stroke[0]);
    expect(s[s.length - 1]).toEqual(stroke[199]);
  });
});
