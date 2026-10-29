import { beforeEach, describe, expect, it } from 'vitest';
import { careCalendar } from '../../src/engine/care';
import { areaTasks, bedAreaM2, buildSchedule, daysBetween, defaultWindow, mulchAdvice } from '../../src/engine/schedule';
import { SEED_PLANTS } from '../../src/data/plants.seed';
import { selectCurrentArea, useProject } from '../../src/store/projectStore';

const st = () => useProject.getState();

describe('planting schedule', () => {
  beforeEach(() => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip', 'lawn-garden']);
  });

  it('dates and default window', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(defaultWindow(new Date(2026, 9, 1))).toEqual({ start: '2026-10-20', end: '2026-11-03' });
    expect(defaultWindow(new Date(2026, 10, 20)).start).toBe('2027-10-20');
  });

  it('bed area excludes the lawn', () => {
    const [strip, garden] = st().project!.areas;
    expect(bedAreaM2(strip)).toBeCloseTo(14.4);
    expect(bedAreaM2(garden)).toBeGreaterThan(25);
    expect(bedAreaM2(garden)).toBeLessThan(35);
  });

  it('tasks follow the K-07 order: soil, drip, fabric, trees, perennials, mulch, water', () => {
    st().selectArea(st().project!.areas[1].id);
    st().addDrift('LA', [[0, 0], [120, 0], [120, 300], [0, 300]], 'grid');
    st().placePlant('AC', 450, 200);
    const t = areaTasks(selectCurrentArea(st())!, st().project!.plantDb).map((x) => x.id.split(':')[1]);
    expect(t).toEqual(['soil', 'drip', 'fabric', 'tree', 'plant', 'mulch', 'water']);
  });

  it('spreads the work over the window and keeps the order', () => {
    st().selectArea(st().project!.areas[0].id);
    st().addDrift('TH', [[0, 0], [120, 0], [120, 1200], [0, 1200]], 'staggered', 25); // lots of thyme
    const { days, hours } = buildSchedule(st().project!, '2026-10-20', '2026-11-03');
    expect(days).toHaveLength(15);
    const flat = days.flatMap((d) => d.tasks.map((t) => t.id));
    expect(flat[0]).toMatch(/:soil$/);
    expect(flat[flat.length - 1]).toMatch(/:water$/);
    expect(new Set(flat).size).toBe(flat.length);
    expect(hours).toBeGreaterThan(10);
    // Work is spread: more than one day has tasks.
    expect(days.filter((d) => d.tasks.length).length).toBeGreaterThan(3);
  });

  it('warns about frost late in the season and empty plans', () => {
    expect(buildSchedule(st().project!, '2026-10-20', '2026-11-03').notes.join(' ')).toContain('Még nincs növény');
    st().placePlant('LA', 60, 100);
    expect(buildSchedule(st().project!, '2026-10-20', '2026-11-03').notes.join(' ')).toContain('első fagy');
  });

  it('ticks are stored by stable task id', () => {
    st().placePlant('LA', 60, 100);
    st().setScheduleWindow('2026-10-20', '2026-11-03');
    const id = buildSchedule(st().project!, '2026-10-20', '2026-11-03').days[0].tasks[0].id;
    st().toggleTask(id);
    expect(st().project!.schedule!.done).toEqual([id]);
    st().setScheduleWindow('2026-10-25', '2026-11-05');
    expect(st().project!.schedule!.done).toEqual([id]);
    st().toggleTask(id);
    expect(st().project!.schedule!.done).toEqual([]);
  });
});

describe('care calendar and mulch', () => {
  beforeEach(() => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['lawn-garden']);
  });

  it('lavender pruning in April and August, walnut leaves in autumn, no fertiliser for dry plants', () => {
    st().placePlant('LA', 60, 300);
    const cal = careCalendar(st().project!);
    expect(cal[3].some((t) => t.codes.includes('LA') && t.text.includes('visszavágni'))).toBe(true);
    expect(cal[7].some((t) => t.codes.includes('LA'))).toBe(true);
    expect(cal[9].some((t) => t.text.includes('diólevél'))).toBe(true);
    expect(cal[2].some((t) => t.text.includes('Ne trágyázd') && t.text.includes('levendula'))).toBe(true);
    // Species not in the plan do not appear.
    expect(cal.flat().some((t) => t.codes.includes('MO'))).toBe(false);
  });

  it('gravel for lavender, thyme, houseleek; bark for the rest', () => {
    const P = (c: string) => SEED_PLANTS.find((p) => p.code === c)!;
    const m = mulchAdvice([P('LA'), P('TH'), P('SE'), P('BE'), P('HO'), P('AC')]);
    expect(m.gravel.map((p) => p.code)).toEqual(['LA', 'TH', 'SE']);
    expect(m.bark.map((p) => p.code)).toEqual(['BE', 'HO']);
    expect(m.trees.map((p) => p.code)).toEqual(['AC']);
  });
});
