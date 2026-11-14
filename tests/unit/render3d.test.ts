// Spec v0.2 F1: scene graph, manifest and verification, on every example plan (no browser needed: the scene and
// the measured centres come from three.js itself; the WebGL render and the ID buffer run in verify:render).
import { describe, expect, it } from 'vitest';
import { buildExample, EXAMPLE_PLANS } from '../../src/data/examples';
import { SEED_PLANTS } from '../../src/data/plants.seed';
import { itemCount } from '../../src/engine/fill';
import { areaOutline, plantInstances } from '../../src/render3d/instances';
import { buildScene, type Fault } from '../../src/render3d/scene';
import { buildManifest, checkManifest, reportCsv, reportMd } from '../../src/render3d/verify';
import { pointInPolygon } from '../../src/model/geometry';

function run(key: string, fault?: Fault) {
  const ex = EXAMPLE_PLANS.find((e) => e.key === key)!;
  const area = buildExample(ex, { stableIds: true });
  const items = area.variants[0].items;
  const instances = plantInstances(items, SEED_PLANTS);
  const ps = buildScene(area, instances, { fault });
  const manifest = buildManifest(key, area.name, instances, ps.plants, 'fixed');
  return { area, items, instances, manifest, result: checkManifest(key, instances, manifest) };
}

describe('every example plan', () => {
  for (const ex of EXAMPLE_PLANS)
    it(`${ex.key}: N plants, right species, centres within 20 cm`, () => {
      const { items, instances, manifest, result } = run(ex.key);
      const n = items.reduce((s, it) => s + itemCount(it), 0);
      expect(instances).toHaveLength(n); // N comes from the plan, nothing is hard-coded
      expect(manifest.plants).toHaveLength(n);
      expect(new Set(manifest.plants.map((p) => p.plant_id)).size).toBe(n);
      expect(result.verdict).toBe('PASS');
      expect(result.failed).toBe(0);
      expect(Math.max(...result.rows.map((r) => r.deviation_cm!))).toBeLessThanOrEqual(20);
      for (const e of manifest.plants) expect(e.render_object_id).toBe(`obj-${e.plant_id}`);
    });
});

describe('plant ids and positions', () => {
  it('are the same on every run (stable ids, deterministic fill)', () => {
    const a = run('curving').manifest.plants;
    const b = run('curving').manifest.plants;
    expect(a).toEqual(b);
    expect(a[0].plant_id).toBe('curving-1');
    expect(a.some((p) => /^curving-\d+#\d+$/.test(p.plant_id))).toBe(true);
  });

  it('placed_xy is measured in the scene graph, not copied: an offset plant shows up', () => {
    const { manifest, instances } = run('modern', { kind: 'offset', index: 0, dxCm: 30 });
    expect(manifest.plants[0].placed_xy_m[0]).toBeCloseTo(instances[0].xCm / 100 + 0.3, 3);
    expect(manifest.plants[0].required_xy_m![0]).toBeCloseTo(instances[0].xCm / 100, 3);
  });

  it('free-shape example: the outline is a polygon and every plant is inside it', () => {
    const { area, instances } = run('curving');
    expect(area.shape.kind).toBe('polygon');
    const outline = areaOutline(area);
    expect(outline.length).toBeGreaterThan(20);
    for (const p of instances) expect(pointInPolygon([p.xCm, p.yCm], outline), p.plant_id).toBe(true);
  });
});

describe('negative tests: the check must fail', () => {
  it('+30 cm offset → FAIL for that plant', () => {
    const { result } = run('modern', { kind: 'offset', index: 3, dxCm: 30 });
    expect(result.verdict).toBe('FAIL');
    const bad = result.rows.filter((r) => r.status === 'FAIL');
    expect(bad).toHaveLength(1);
    expect(bad[0].deviation_cm).toBeCloseTo(30, 0);
  });

  it('a missing plant → FAIL', () => {
    const { result } = run('modern', { kind: 'drop', index: 5 });
    expect(result.verdict).toBe('FAIL');
    expect(result.found).toBe(result.expected - 1);
    expect(result.rows.find((r) => r.status === 'FAIL')!.reason).toMatch(/hiányzik/);
  });

  it('a wrong species → FAIL', () => {
    const { result } = run('modern', { kind: 'species', index: 2, species: 'XX' });
    expect(result.verdict).toBe('FAIL');
    expect(result.rows.find((r) => r.status === 'FAIL')!.reason).toMatch(/rossz faj/);
  });

  it('19.9 cm passes, 20.1 cm fails (the tolerance is inclusive at 20 cm)', () => {
    expect(run('modern', { kind: 'offset', index: 0, dxCm: 19.9 }).result.verdict).toBe('PASS');
    expect(run('modern', { kind: 'offset', index: 0, dxCm: 20.1 }).result.verdict).toBe('FAIL');
  });

  it('an empty plan is never a PASS', () => {
    const { instances } = run('modern');
    const empty = checkManifest('x', [], { ...run('modern').manifest, plants: [] });
    expect(empty.verdict).toBe('FAIL');
    expect(instances.length).toBeGreaterThan(0);
  });
});

describe('reports', () => {
  it('CSV and Markdown carry test id, deviation, PASS/FAIL and the log reference', () => {
    const { result } = run('modern', { kind: 'offset', index: 0, dxCm: 30 });
    const csv = reportCsv(result, 'logs/run-x.log');
    expect(csv.split('\n')[0]).toBe('test_id;plant_id;species_expected;species_found;deviation_cm;status;reason;visibility;visible_share_pct;log');
    expect(csv).toContain('PL-3D-modern-modern-1;modern-1;DO;DO;30;FAIL;');
    const md = reportMd(result, 'logs/run-x.log', { area: 'Modern', tolCm: 20, minSharePct: 0.1 });
    expect(md).toContain('Eredmény: **FAIL**');
    expect(md).toContain('| PL-3D-modern-modern-1 |');
  });
});
