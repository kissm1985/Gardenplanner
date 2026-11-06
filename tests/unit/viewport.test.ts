import { describe, expect, it } from 'vitest';
import { fitView, niceStep, pinchView, screenToWorld, worldToScreen, zoomAt } from '../../src/canvas/viewport';

describe('viewport', () => {
  it('fits a tall 120×1200 cm strip into a phone viewport, centred', () => {
    const v = fitView(120, 1200, 390, 700, 20);
    expect(v.s).toBeCloseTo(660 / 1200);
    const [x0, y0] = worldToScreen(v, 0, 0);
    const [x1, y1] = worldToScreen(v, 120, 1200);
    expect((x0 + x1) / 2).toBeCloseTo(195);
    expect(y0).toBeCloseTo(20);
    expect(y1).toBeCloseTo(680);
  });

  it('zoomAt keeps the anchor point fixed', () => {
    const v = { s: 0.5, tx: 10, ty: 20 };
    const before = screenToWorld(v, 100, 150);
    const z = zoomAt(v, 2, 100, 150);
    expect(z.s).toBe(1);
    expect(screenToWorld(z, 100, 150)[0]).toBeCloseTo(before[0]);
    expect(screenToWorld(z, 100, 150)[1]).toBeCloseTo(before[1]);
  });

  it('zoom is clamped', () => {
    expect(zoomAt({ s: 1, tx: 0, ty: 0 }, 1e6, 0, 0).s).toBe(20);
    expect(zoomAt({ s: 1, tx: 0, ty: 0 }, 1e-6, 0, 0).s).toBe(0.05);
  });

  it('pinch keeps the world point under the fingers and scales by finger distance', () => {
    const start = { s: 1, tx: 0, ty: 0 };
    const v = pinchView(start, [100, 100], [200, 100], [50, 100], [250, 100]);
    expect(v.s).toBeCloseTo(2);
    // world midpoint (150,100) stays under the screen midpoint (150,100)
    expect(worldToScreen(v, 150, 100)[0]).toBeCloseTo(150);
    // pure two-finger pan
    const p = pinchView(start, [0, 0], [100, 0], [30, 40], [130, 40]);
    expect(p).toEqual({ s: 1, tx: 30, ty: 40 });
  });

  it('niceStep picks a readable ruler step', () => {
    expect(niceStep(0.5, 50)).toBe(100);
    expect(niceStep(5, 50)).toBe(10);
  });
});
