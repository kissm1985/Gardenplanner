// Pro tier: the connected nursery's catalogue (PL-BE-04). The published catalogue is fetched by version
// (only the changes since the copy on this device), checked, and kept in IndexedDB, so it also works offline.
import { del, get, set } from 'idb-keyval';
import { type CatalogVersion, SLUG_RE, validateChanges } from './catalog';
import type { NurseryCatalog } from '../model/nursery';

const CONN = 'kerttervezo.nursery';
const CACHE = 'kerttervezo:catalog';

export interface NurseryConnection {
  /** Server origin; empty = the build's server (VITE_API_ORIGIN) or the app's own origin. */
  server: string;
  tenant: string;
}

export const defaultServer = () => (import.meta.env.VITE_API_ORIGIN as string | undefined) || location.origin;

export function getConnection(): NurseryConnection | null {
  try {
    const v = JSON.parse(localStorage.getItem(CONN) ?? 'null') as NurseryConnection | null;
    return v && typeof v.tenant === 'string' && SLUG_RE.test(v.tenant) ? { server: typeof v.server === 'string' ? v.server : '', tenant: v.tenant } : null;
  } catch {
    return null;
  }
}

export function setConnection(c: NurseryConnection | null) {
  try {
    if (c) localStorage.setItem(CONN, JSON.stringify(c));
    else localStorage.removeItem(CONN);
  } catch {
    /* this session only */
  }
  if (!c) void del(CACHE).catch(() => {});
}

/** Only https servers (or a server on this computer, for testing) are accepted. */
export function normalizeServer(s: string): string | null {
  if (!s.trim()) return '';
  try {
    const u = new URL(s.trim());
    if (u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))) return u.origin;
  } catch {
    /* fall through */
  }
  return null;
}

const baseOf = (c: NurseryConnection) => c.server || defaultServer();

export async function cachedCatalog(): Promise<NurseryCatalog | null> {
  try {
    return ((await get(CACHE)) as NurseryCatalog | undefined) ?? null;
  } catch {
    return null;
  }
}

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Brings the device's copy up to date: fetches the published version, then only the changes since the copy.
 * Throws when offline or the server refuses; the cached copy stays usable.
 */
export async function syncCatalog(c: NurseryConnection): Promise<{ catalog: NurseryCatalog; changed: number }> {
  const base = baseOf(c);
  const prefix = `${base}/api/v1/t/${encodeURIComponent(c.tenant)}/catalog`;
  const old = await cachedCatalog();
  const mine = old && old.server === base && old.tenant === c.tenant ? old : null;
  const v = (await getJson(`${prefix}/version`)) as CatalogVersion;
  if (!v || typeof v.version !== 'number' || typeof v.name !== 'string') throw new Error('Hibás válasz a szervertől.');
  const name = v.name.slice(0, 100);
  if (mine && mine.version === v.version) {
    const same = { ...mine, name, syncedAt: new Date().toISOString() };
    await set(CACHE, same);
    return { catalog: same, changed: 0 };
  }
  const r = validateChanges(await getJson(`${prefix}/changes?since=${mine?.version ?? 0}`));
  if (!r.ok) throw new Error(`Hibás katalógus: ${r.errors.slice(0, 3).join('; ')}`);
  // since = 0 means the whole catalogue (also when the server could not give a delta).
  const species = r.value.since === 0 ? {} : { ...mine!.species };
  for (const e of r.value.entries) {
    if (e.deleted) delete species[e.code];
    else species[e.code] = e.species!;
  }
  const catalog: NurseryCatalog = { server: base, tenant: c.tenant, name, version: r.value.version, syncedAt: new Date().toISOString(), species };
  await set(CACHE, catalog);
  return { catalog, changed: r.value.entries.length };
}
