import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBom } from '../../src/engine/bom';
import { deflateSync } from 'fflate';
import { exportJson, parseProject } from '../../src/engine/io';
import { decodeShare, encodeShare, inflateLimited, SHARE_MAX_CODE, shareSnapshot } from '../../src/engine/share';
import { loadProject, saveProject } from '../../src/store/persist';
import { useProject } from '../../src/store/projectStore';

const st = () => useProject.getState();

function richProject() {
  useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
  st().createProject(['house-strip', 'lawn-garden']);
  st().addRow('LA', [
    [60, 0],
    [60, 400],
  ]);
  st().addDrift(
    'TH',
    [
      [0, 500],
      [120, 500],
      [120, 900],
      [0, 900],
    ],
    'staggered',
  );
  st().placePlant('NE', 60, 1000);
  st().duplicateVariant(st().project!.areas[0].variants[0].id);
  st().placePlant('SE', 30, 1100);
  st().setMuted('height:NE', true);
  st().selectArea(st().project!.areas[1].id);
  st().addFixture({ type: 'tap', label: 'Csap 2', x: 100, y: 100, w: 30, h: 30 });
  st().updateSettings({ reservePct: 15, walnutRadiusCm: 1200 });
  st().setScheduleWindow('2026-10-20', '2026-11-03');
  st().toggleTask('x:soil');
  return st().project!;
}

describe('JSON backup', () => {
  beforeEach(() => void richProject());

  it('acceptance: export → import gives exactly the same project', () => {
    const p = st().project!;
    expect(parseProject(exportJson(p))).toEqual(p);
  });

  it('survives IndexedDB too', async () => {
    const p = st().project!;
    await saveProject(parseProject(exportJson(p)));
    expect(await loadProject()).toEqual(p);
  });

  it('rejects foreign or broken files with a Hungarian message', () => {
    expect(() => parseProject('nem json')).toThrow('nem érvényes JSON');
    expect(() => parseProject('{"a":1}')).toThrow('Planterra');
    expect(() => parseProject(JSON.stringify({ schemaVersion: 1, areas: [{ id: 'x' }], plantDb: [] }))).toThrow('Hibás adat a mentésben');
  });

  it('refuses crafted data that would crash the app, and names where it is', () => {
    const p = JSON.parse(exportJson(st().project!));
    const bad = (mutate: (q: typeof p) => void) => {
      const q = structuredClone(p);
      mutate(q);
      return () => parseProject(JSON.stringify(q));
    };
    expect(bad((q) => (q.areas[0].widthCm = 'széles'))).toThrow('1. terület');
    expect(bad((q) => (q.areas[0].variants[0].items = [{ kind: 'drift', id: 'a', plantId: 'LA', polygon: [[0, 0]], spacingCm: 30 }]))).toThrow('hibás pontlista');
    expect(
      bad(
        (q) =>
          (q.areas[0].variants[0].items = [
            {
              kind: 'row',
              id: 'a',
              plantId: 'LA',
              path: [
                [0, 0],
                [9, 9],
              ],
              spacingCm: 0,
            },
          ]),
      ),
    ).toThrow('túl kicsi tőtáv');
    expect(bad((q) => (q.areas[0].variants[0].items = [{ kind: 'bomb', id: 'a' }]))).toThrow('ismeretlen elemtípus');
    expect(bad((q) => (q.plantDb[0].photoUrl = 'javascript:alert(1)'))).toThrow('1. növény');
    expect(bad((q) => (q.areas[0].background = { dataUrl: 'https://evil.example/x.svg' }))).toThrow('hibás háttérkép');
    expect(() => parseProject('x'.repeat(61 * 1024 * 1024))).toThrow('túl nagy');
    expect(() => parseProject(exportJson(st().project!))).not.toThrow();
  });
});

describe('share link', () => {
  it('round-trips the chosen variants and the plants they use', () => {
    const p = richProject();
    const code = encodeShare(p);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = decodeShare(code);
    expect(back).toEqual(shareSnapshot(p));
    expect(back.areas.every((a) => a.variants.length === 1)).toBe(true);
    expect(buildBom(back).planted).toBe(buildBom(p).planted);
    expect(back.plantDb.map((x) => x.code).sort()).toEqual(['LA', 'NE', 'SE', 'TH']); // B (with SE) is open, so chosen
  });

  it('stays short enough for a URL with 200+ plants', () => {
    const p = richProject();
    for (let i = 0; i < 220; i++) st().placePlant('FE', (i % 4) * 30 + 15, (Math.floor(i / 4) * 20) % 1200);
    expect(encodeShare(st().project!).length).toBeLessThan(16000);
    expect(p).toBeTruthy();
  });

  it('broken codes give a friendly error', () => {
    expect(() => decodeShare('abc')).toThrow('megosztott link');
  });

  it('never carries own plant photos; notes can be left out', () => {
    const p = richProject();
    const withPhoto = {
      ...p,
      plantDb: p.plantDb.map((x) => (x.code === 'LA' ? { ...x, photoUrl: 'https://tracker.example/x.png', photoCredit: 'me' } : x)),
      areas: p.areas.map((a) => ({ ...a, notes: 'Fő utca 1.' })),
    };
    const back = decodeShare(encodeShare(withPhoto));
    expect(back.plantDb.find((x) => x.code === 'LA')?.photoUrl).toBeUndefined();
    expect(back.plantDb.find((x) => x.code === 'LA')?.photoCredit).toBeUndefined();
    expect(back.areas[0].notes).toBe('Fő utca 1.');
    const bare = decodeShare(encodeShare(withPhoto, { withoutNotes: true }));
    expect(bare.areas.every((a) => a.notes === '' && a.variants[0].notes === '' && a.variants[0].items.every((it) => !it.note))).toBe(true);
  });

  it('a crafted link that unpacks to a huge size is refused, not unpacked', () => {
    // 64 MB of spaces packs to ~60 KB.
    const bomb = deflateSync(new Uint8Array(64 * 1024 * 1024).fill(32), { level: 9 });
    let s = '';
    for (let i = 0; i < bomb.length; i += 0x8000) s += String.fromCharCode(...bomb.subarray(i, i + 0x8000));
    const code = btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(code.length).toBeLessThan(SHARE_MAX_CODE);
    expect(() => decodeShare(code)).toThrow('túl nagy');
    expect(() => decodeShare('A'.repeat(SHARE_MAX_CODE + 1))).toThrow('túl nagy');
    expect(inflateLimited(deflateSync(new Uint8Array(10)), 100)).toHaveLength(10);
  });
});
