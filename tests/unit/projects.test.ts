import 'fake-indexeddb/auto';
import { clear, get, keys, set } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { IMG_REF, deleteProject, hashString, listProjects, loadProject, loadProjectById, saveAsNew, saveProject } from '../../src/store/persist';
import { newProject } from '../../src/store/projectStore';
import type { Project } from '../../src/model/types';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function withImages(p: Project): Project {
  const a = p.areas[0];
  return {
    ...p,
    areas: [
      {
        ...a,
        background: { dataUrl: PNG, opacity: 0.5, x: 0, y: 0, widthCm: 100, aspect: 1 },
        variants: [{ ...a.variants[0], renders: [{ id: 'r1', dataUrl: PNG, addedAt: '2026-11-06T10:00:00Z' }] }],
      },
      ...p.areas.slice(1),
    ],
    plantDb: p.plantDb.map((x, i) => (i === 0 ? { ...x, photoUrl: PNG } : x)),
  };
}

describe('several projects on one device', () => {
  beforeEach(() => clear());

  it('lists, opens by id and keeps the most recent first', async () => {
    const a = { ...newProject(['house-strip']), name: 'A' };
    const b = { ...newProject(['lawn-garden']), name: 'B' };
    await saveProject(a);
    await new Promise((r) => setTimeout(r, 5));
    await saveProject(b);
    const list = await listProjects();
    expect(list.map((m) => m.name)).toEqual(['B', 'A']);
    expect(list[0].areas).toBe(1);
    expect((await loadProjectById(a.id))?.name).toBe('A');
    expect((await loadProject())?.id).toBe(b.id); // no current id in tests → most recent
  });

  it('moves the single project of 0.1–0.6 into the list once', async () => {
    const old = { ...newProject(['house-strip']), name: 'Régi' };
    await set('kerttervezo:project:v1', old);
    const list = await listProjects();
    expect(list.map((m) => m.name)).toEqual(['Régi']);
    expect(await get('kerttervezo:project:v1')).toBeUndefined();
    expect((await loadProject())?.name).toBe('Régi');
  });

  it('copies and deletes, with the images', async () => {
    const p = withImages(newProject(['house-strip']));
    await saveProject(p);
    const copy = await saveAsNew(p, 'Másolat');
    expect((await listProjects()).length).toBe(2);
    expect((await loadProjectById(copy.id))?.areas[0].background?.dataUrl).toBe(PNG);
    await deleteProject(p.id);
    expect((await listProjects()).map((m) => m.name)).toEqual(['Másolat']);
    const left = (await keys()).filter((k) => String(k).includes(p.id));
    expect(left).toEqual([]);
  });
});

describe('images stored apart from the project', () => {
  beforeEach(() => clear());

  it('the stored record holds references; one Blob for the same image used three times', async () => {
    const p = withImages(newProject(['house-strip']));
    await saveProject(p);
    const rec = (await get(`kerttervezo:project:${p.id}`)) as Project;
    expect(rec.areas[0].background?.dataUrl).toBe(IMG_REF + hashString(PNG));
    expect(rec.plantDb[0].photoUrl?.startsWith(IMG_REF)).toBe(true);
    expect(JSON.stringify(rec)).not.toContain('base64');
    const imgs = (await keys()).filter((k) => String(k).startsWith('kerttervezo:img:'));
    expect(imgs.length).toBe(1);
    expect(await loadProjectById(p.id)).toEqual(p);
  });

  it('a lost image is dropped, the plan still opens', async () => {
    const p = withImages(newProject(['house-strip']));
    await saveProject(p);
    for (const k of await keys()) if (String(k).startsWith('kerttervezo:img:')) await set(k, undefined);
    const back = await loadProjectById(p.id);
    expect(back?.areas[0].background).toBeUndefined();
    expect(back?.areas[0].variants[0].renders).toEqual([]);
    expect(back?.plantDb[0].photoUrl).toBeUndefined();
  });
});
