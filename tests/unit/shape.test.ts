import { beforeEach, describe, expect, it } from 'vitest';
import { evaluate } from '../../src/engine/rules';
import { bedAreaM2 } from '../../src/engine/schedule';
import { selectCurrentArea, selectItems, useProject } from '../../src/store/projectStore';

const st = () => useProject.getState();
const area = () => selectCurrentArea(st())!;

describe('free-shape areas', () => {
  beforeEach(() => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject([]);
  });

  it('a drawn L shape is normalised to start at 0,0 with its bounding size', () => {
    const id = st().addArea({ name: 'L-ágyás', widthCm: 600, lengthCm: 600, orientation: 'S', sunUntil: '', notes: '', kind: 'bed' });
    st().setAreaShape(id, [[100, 50], [500, 50], [500, 250], [250, 250], [250, 450], [100, 450]]);
    const a = area();
    expect(a.shape).toEqual({ kind: 'polygon', points: [[0, 0], [400, 0], [400, 200], [150, 200], [150, 400], [0, 400]] });
    expect([a.widthCm, a.lengthCm]).toEqual([400, 400]);
    // 400×200 + 150×200 = 11 m²
    expect(bedAreaM2(a)).toBeCloseTo(11);
  });

  it('plants keep their place when the outline is redrawn; outside the polygon warns', () => {
    const id = st().addArea({ name: 'Sarok', widthCm: 400, lengthCm: 400, orientation: 'S', sunUntil: '', notes: '' });
    st().placePlant('LA', 150, 150);
    st().setAreaShape(id, [[100, 100], [400, 100], [100, 400]]); // triangle, shifted by -100
    expect(selectItems(st())[0]).toMatchObject({ x: 50, y: 50 });
    const run = () => evaluate(area(), selectItems(st()), st().project!.plantDb, st().project!.settings);
    expect(run().some((w) => w.rule === 'outside')).toBe(false);
    st().placePlant('LA', 250, 250); // beyond the hypotenuse
    expect(run().some((w) => w.rule === 'outside')).toBe(true);
  });

  it('undo restores the rectangle', () => {
    const id = st().addArea({ name: 'X', widthCm: 300, lengthCm: 200, orientation: 'S', sunUntil: '', notes: '' });
    st().setAreaShape(id, [[0, 0], [300, 0], [150, 200]]);
    st().undo();
    expect(area().shape).toEqual({ kind: 'rect' });
  });
});

describe('area kind', () => {
  it('a shade bed without sun hours counts as shade', async () => {
    const { areaSunLevel } = await import('../../src/engine/rules');
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject([]);
    st().addArea({ name: 'Árnyék', widthCm: 300, lengthCm: 300, orientation: 'S', sunUntil: '', notes: '', kind: 'shade' });
    expect(areaSunLevel(area())).toBe('shade');
    st().updateArea(area().id, { sunUntil: '14:00-ig' });
    expect(areaSunLevel(area())).toBe('sun');
  });
});
