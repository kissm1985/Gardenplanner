// The admin page's API client. The session token lives in sessionStorage (gone when the tab closes) and is sent
// only to the server it came from.
import type { CatalogSpecies, ImportMapping, ImportRow } from '../engine/catalog';

const KEY = 'planterra.admin';

export interface AdminSession {
  server: string;
  token: string;
  tenant: { slug: string; name: string };
  user: { email: string; role: 'owner' | 'editor' | 'viewer'; totp: boolean };
}

export function loadSession(): AdminSession | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as AdminSession | null;
  } catch {
    return null;
  }
}
export function saveSession(s: AdminSession | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* in memory only */
  }
}

export class AdminError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function call<T>(server: string, path: string, opts: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const res = await fetch(server + path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: { ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new AdminError(res.status, String(body.error ?? res.statusText), body);
  return body as T;
}

export interface Pending {
  added: string[];
  changed: string[];
  removed: string[];
}
export interface SpeciesList {
  species: CatalogSpecies[];
  pending: Pending;
  version: number;
  publishedAt: string | null;
}
export interface ImportPreview {
  mapping: ImportMapping;
  header: string[];
  rows: ImportRow[];
  summary: Record<'new' | 'update' | 'same' | 'error', number>;
}
export interface AdminUser {
  id: number;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  totp: boolean;
  disabled: boolean;
}

/** Bound to one signed-in session. */
export const client = (s: AdminSession) => ({
  species: () => call<SpeciesList>(s.server, '/api/v1/admin/species', { token: s.token }),
  putSpecies: (sp: CatalogSpecies) => call<CatalogSpecies>(s.server, `/api/v1/admin/species/${encodeURIComponent(sp.code)}`, { method: 'PUT', body: sp, token: s.token }),
  deleteSpecies: (code: string) => call(s.server, `/api/v1/admin/species/${encodeURIComponent(code)}`, { method: 'DELETE', token: s.token }),
  preview: (rows: string[][], mapping?: ImportMapping) => call<ImportPreview>(s.server, '/api/v1/admin/import/preview', { body: { rows, mapping }, token: s.token }),
  commit: (rows: string[][], mapping?: ImportMapping) =>
    call<{ species: number; summary: ImportPreview['summary'] }>(s.server, '/api/v1/admin/import/commit', { body: { rows, mapping }, token: s.token }),
  publish: () => call<{ version: number; changes: Pending }>(s.server, '/api/v1/admin/publish', { body: {}, token: s.token }),
  users: () => call<{ users: AdminUser[] }>(s.server, '/api/v1/admin/users', { token: s.token }),
  addUser: (email: string, role: string) => call<AdminUser>(s.server, '/api/v1/admin/users', { body: { email, role }, token: s.token }),
  patchUser: (id: number, patch: Partial<Pick<AdminUser, 'role' | 'disabled'>>) =>
    call<AdminUser>(s.server, `/api/v1/admin/users/${id}`, { method: 'PATCH', body: patch, token: s.token }),
  deleteUser: (id: number) => call(s.server, `/api/v1/admin/users/${id}`, { method: 'DELETE', token: s.token }),
  audit: () =>
    call<{ entries: { at: string; action: string; detail: string | null; email: string | null; ip: string | null }[] }>(s.server, '/api/v1/admin/audit', { token: s.token }),
  totpSetup: () => call<{ secret: string; uri: string }>(s.server, '/api/v1/me/totp/setup', { body: {}, token: s.token }),
  totpEnable: (code: string) => call(s.server, '/api/v1/me/totp/enable', { body: { code }, token: s.token }),
  logout: () => call(s.server, '/api/v1/auth/logout', { body: {}, token: s.token }),
});
export type Client = ReturnType<typeof client>;
