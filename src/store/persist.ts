// Saving plans on the device (IndexedDB). Several projects, each under its own key, with a small index for
// the start page. Images (background photos, visualisations, own plant photos) are kept apart as Blobs, keyed
// by a content hash: the project record only holds a reference, so an autosave writes a few KB instead of
// every image again, and an image used twice is stored once. A JSON backup still embeds the images.
import { del, get, keys, set } from 'idb-keyval';
import { validateProject } from '../engine/validate';
import type { Project } from '../model/types';
import { uid } from '../model/ids';
import { hashString } from '../model/hash';

export { hashString };

/** Where 0.1–0.6 kept the single project. */
const OLD_KEY = 'kerttervezo:project:v1';
const INDEX = 'kerttervezo:projects';
const pkey = (id: string) => `kerttervezo:project:${id}`;
const IMG_PREFIX = 'kerttervezo:img:';
const imgKey = (pid: string, h: string) => `${IMG_PREFIX}${pid}:${h}`;
/** In a stored project an image is this prefix plus its hash. */
export const IMG_REF = 'idb-img:';
const CURRENT = 'kerttervezo:current-project';

export interface ProjectMeta {
  id: string;
  name: string;
  /** ms since epoch */
  updatedAt: number;
  areas: number;
  plants: number;
}

/** The saved plan cannot be used; `raw` is what was stored, so it can still be downloaded. */
export class StoredProjectError extends Error {
  constructor(
    message: string,
    readonly raw: unknown,
  ) {
    super(message);
  }
}

// ---------- current project (per device) ----------
export function currentProjectId(): string | null {
  try {
    return localStorage.getItem(CURRENT);
  } catch {
    return null;
  }
}
export function setCurrentProjectId(id: string | null) {
  try {
    if (id) localStorage.setItem(CURRENT, id);
    else localStorage.removeItem(CURRENT);
  } catch {
    /* per-device convenience */
  }
}

// ---------- index ----------
const plantCount = (p: Project) =>
  p.areas.reduce((s, a) => {
    const v = a.variants.find((x) => x.id === a.chosenVariantId) ?? a.variants[0];
    return s + (v ? v.items.reduce((n, it) => n + (it.kind === 'plant' ? 1 : (it.count ?? 1)), 0) : 0);
  }, 0);

export const metaOf = (p: Project, updatedAt = Date.now()): ProjectMeta => ({ id: p.id, name: p.name, updatedAt, areas: p.areas.length, plants: plantCount(p) });

async function readIndex(): Promise<ProjectMeta[]> {
  try {
    const v = await get<ProjectMeta[]>(INDEX);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const listeners = new Set<(list: ProjectMeta[]) => void>();
/** Called with the new list after every save, delete or rename. */
export function onProjectsChanged(f: (list: ProjectMeta[]) => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}
async function writeIndex(list: ProjectMeta[]) {
  await set(INDEX, list);
  const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  listeners.forEach((f) => f(sorted));
}

/** All projects on this device, most recently changed first. */
export async function listProjects(): Promise<ProjectMeta[]> {
  await migrateSingleProject();
  return (await readIndex()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Move the one project of 0.1–0.6 into the multi-project layout (once). */
async function migrateSingleProject() {
  let old: unknown;
  try {
    old = await get(OLD_KEY);
  } catch {
    return;
  }
  if (!old) return;
  const p = old as Project;
  if (p && typeof p === 'object' && typeof p.id === 'string') {
    const list = await readIndex();
    if (!list.some((m) => m.id === p.id)) {
      await set(pkey(p.id), p);
      await writeIndex([...list, metaOf(p)]);
    }
    if (!currentProjectId()) setCurrentProjectId(p.id);
  }
  await del(OLD_KEY);
}

// ---------- images ----------
const isDataImage = (s: unknown): s is string => typeof s === 'string' && s.startsWith('data:image/');

function dataUrlToBlob(u: string): Blob {
  const [head, data] = u.split(',', 2);
  const mime = /data:([^;,]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  if (!head.includes(';base64')) return new Blob([decodeURIComponent(data)], { type: mime });
  const bin = atob(data);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

async function blobToDataUrl(b: Blob): Promise<string> {
  const u8 = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return `data:${b.type || 'image/png'};base64,${btoa(s)}`;
}

/** Visit every image field of a project; `fn` returns the new value. */
function mapImages(p: Project, fn: (v: string) => string): Project {
  return {
    ...p,
    plantDb: p.plantDb.map((x) => {
      const u: string | undefined = x.photoUrl;
      return u && (u.startsWith('data:image/') || u.startsWith(IMG_REF)) ? { ...x, photoUrl: fn(u) } : x;
    }),
    areas: p.areas.map((a) => ({
      ...a,
      ...(a.background ? { background: { ...a.background, dataUrl: fn(a.background.dataUrl) } } : {}),
      variants: a.variants.map((v) => (v.renders?.length ? { ...v, renders: v.renders.map((r) => ({ ...r, dataUrl: fn(r.dataUrl) })) } : v)),
    })),
  };
}

const storedImages = new Set<string>();
const hashCache = new Map<string, string>();
function hashOf(s: string) {
  let h = hashCache.get(s);
  if (!h) {
    h = hashString(s);
    if (hashCache.size > 300) hashCache.clear();
    hashCache.set(s, h);
  }
  return h;
}

/** Project as stored: images replaced by references, the images written once. Returns the record and the hashes it uses. */
export async function packImages(p: Project): Promise<{ record: Project; used: Set<string> }> {
  const pending: [string, string][] = [];
  const used = new Set<string>();
  const record = mapImages(p, (v) => {
    if (!isDataImage(v)) return v;
    const h = hashOf(v);
    used.add(h);
    if (!storedImages.has(imgKey(p.id, h))) pending.push([h, v]);
    return IMG_REF + h;
  });
  for (const [h, v] of pending) {
    await set(imgKey(p.id, h), dataUrlToBlob(v));
    storedImages.add(imgKey(p.id, h));
  }
  return { record, used };
}

/** Stored record back to a usable project: references replaced by data URLs. */
export async function unpackImages(record: Project): Promise<Project> {
  const refs = new Set<string>();
  mapImages(record, (v) => {
    if (v.startsWith(IMG_REF)) refs.add(v.slice(IMG_REF.length));
    return v;
  });
  const urls = new Map<string, string>();
  for (const h of refs) {
    const b = await get<Blob>(imgKey(record.id, h));
    if (b) {
      urls.set(h, await blobToDataUrl(b));
      storedImages.add(imgKey(record.id, h));
    }
  }
  const out = mapImages(record, (v) => (v.startsWith(IMG_REF) ? (urls.get(v.slice(IMG_REF.length)) ?? '') : v));
  // An image whose Blob is gone (cleared site data) is dropped instead of breaking the whole plan.
  return {
    ...out,
    plantDb: out.plantDb.map((x) => (x.photoUrl === '' ? { ...x, photoUrl: undefined } : x)),
    areas: out.areas.map((a) => {
      const { background, ...rest } = a;
      const variants = a.variants.map((v) => (v.renders?.some((r) => !r.dataUrl) ? { ...v, renders: v.renders.filter((r) => r.dataUrl) } : v));
      return background && !background.dataUrl ? { ...rest, variants } : { ...a, variants };
    }),
  };
}

async function dropUnusedImages(pid: string, used: Set<string>) {
  const prefix = `${IMG_PREFIX}${pid}:`;
  for (const k of await keys()) {
    if (typeof k === 'string' && k.startsWith(prefix) && !used.has(k.slice(prefix.length))) {
      await del(k);
      storedImages.delete(k);
    }
  }
}

// ---------- load / save ----------
export async function loadProjectById(id: string): Promise<Project | null> {
  let rec: unknown;
  try {
    rec = await get(pkey(id));
  } catch {
    return null;
  }
  if (!rec || (rec as Project).schemaVersion !== 1) return null;
  let p: Project;
  try {
    p = await unpackImages(rec as Project);
  } catch (e) {
    throw new StoredProjectError((e as Error).message, rec);
  }
  try {
    validateProject(p);
  } catch (e) {
    throw new StoredProjectError((e as Error).message, p);
  }
  return p;
}

/** The project to open on start: the one used last, else the most recently changed. */
export async function loadProject(): Promise<Project | null> {
  const list = await listProjects();
  const cur = currentProjectId();
  const id = (cur && list.some((m) => m.id === cur) ? cur : list[0]?.id) ?? null;
  if (!id) return null;
  const p = await loadProjectById(id);
  if (p) setCurrentProjectId(p.id);
  return p;
}

let savesSinceCleanup = 0;
export async function saveProject(p: Project): Promise<void> {
  const { record, used } = await packImages(p);
  await set(pkey(p.id), record);
  const list = await readIndex();
  const meta = metaOf(p);
  await writeIndex(list.some((m) => m.id === p.id) ? list.map((m) => (m.id === p.id ? meta : m)) : [...list, meta]);
  // Unused images (a replaced background, a deleted render) are removed now and then, not on every keystroke.
  if (++savesSinceCleanup >= 20) {
    savesSinceCleanup = 0;
    await dropUnusedImages(p.id, used);
  }
}

/** Forget a project and its images (after the user downloaded it, or chose to delete it). */
export async function deleteProject(id: string): Promise<void> {
  await del(pkey(id));
  await dropUnusedImages(id, new Set());
  await writeIndex((await readIndex()).filter((m) => m.id !== id));
  if (currentProjectId() === id) setCurrentProjectId(null);
}

/** Forget the current (broken) project. */
export async function clearProject(): Promise<void> {
  const id = currentProjectId();
  if (id) await deleteProject(id);
  await del(OLD_KEY).catch(() => {});
}

/** Save a copy under a new id (and a new name), e.g. "Duplicate" or adopting a shared plan. */
export async function saveAsNew(p: Project, name = p.name): Promise<Project> {
  const copy = { ...p, id: uid('p'), name };
  await saveProject(copy);
  return copy;
}

/** Rename without loading the whole project into the editor. */
export async function renameStoredProject(id: string, name: string): Promise<void> {
  const rec = await get<Project>(pkey(id));
  if (!rec) return;
  await set(pkey(id), { ...rec, name });
  await writeIndex((await readIndex()).map((m) => (m.id === id ? { ...m, name } : m)));
}

/** Debounced autosave; `flush` writes immediately (used when the page is hidden or another project opens). */
export function createAutosaver(delayMs = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Project | null = null;
  let onError: (e: unknown) => void = () => {};
  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const p = pending;
    pending = null;
    if (p) {
      try {
        await saveProject(p);
      } catch (e) {
        onError(e);
      }
    }
  };
  return {
    schedule(p: Project) {
      // Switching to another project: the previous one is written first.
      if (pending && pending.id !== p.id) void flush();
      pending = p;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    onError(fn: (e: unknown) => void) {
      onError = fn;
    },
  };
}

/** The app's one autosaver (main.tsx feeds it; switching projects flushes it first). */
export const autosave = createAutosaver();
