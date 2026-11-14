// The nursery catalogue (PL-BE-02..04): the draft the admins edit, and the published, versioned copy the app
// syncs from. Every function takes the tenant id first; no query reads or writes another tenant's rows.
import { type CatalogEntry, type CatalogSpecies, type ImportRow, validateSpecies } from '../src/engine/catalog';
import { type Db, nowIso, tx } from './db';

type Row = Record<string, unknown>;

const parse = (s: unknown): CatalogSpecies => JSON.parse(String(s)) as CatalogSpecies;
/** Stable text of a species, so "changed" means the data changed, not the key order. */
export const canonical = (s: CatalogSpecies) => {
  const sorted = { ...s, offers: [...s.offers].sort((a, b) => a.pot.localeCompare(b.pot)) };
  return JSON.stringify(Object.fromEntries(Object.entries(sorted).sort(([a], [b]) => a.localeCompare(b))));
};

export function listSpecies(db: Db, tenant: number): CatalogSpecies[] {
  return (db.prepare('SELECT data FROM species WHERE tenant_id = ? ORDER BY code').all(tenant) as Row[]).map((r) => parse(r.data));
}

export function getSpecies(db: Db, tenant: number, code: string): CatalogSpecies | null {
  const r = db.prepare('SELECT data FROM species WHERE tenant_id = ? AND code = ?').get(tenant, code) as Row | undefined;
  return r ? parse(r.data) : null;
}

export function countSpecies(db: Db, tenant: number): number {
  return Number((db.prepare('SELECT count(*) AS n FROM species WHERE tenant_id = ?').get(tenant) as Row).n);
}

export function putSpecies(db: Db, tenant: number, s: CatalogSpecies, user: number | null, at: number) {
  db.prepare(
    `INSERT INTO species (tenant_id, code, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (tenant_id, code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  ).run(tenant, s.code, canonical(s), nowIso(at), user);
}

export function deleteSpecies(db: Db, tenant: number, code: string): boolean {
  return Number(db.prepare('DELETE FROM species WHERE tenant_id = ? AND code = ?').run(tenant, code).changes) > 0;
}

export function currentVersion(db: Db, tenant: number): { version: number; publishedAt: string | null } {
  const r = db.prepare('SELECT version, published_at FROM versions WHERE tenant_id = ? ORDER BY version DESC LIMIT 1').get(tenant) as Row | undefined;
  return r ? { version: Number(r.version), publishedAt: String(r.published_at) } : { version: 0, publishedAt: null };
}

export interface PendingChanges {
  added: string[];
  changed: string[];
  removed: string[];
}

/** What publishing now would change, compared with the last published version. */
export function pendingChanges(db: Db, tenant: number): PendingChanges {
  const draft = new Map((db.prepare('SELECT code, data FROM species WHERE tenant_id = ?').all(tenant) as Row[]).map((r) => [String(r.code), String(r.data)]));
  const pub = new Map((db.prepare('SELECT code, data FROM published WHERE tenant_id = ? AND deleted = 0').all(tenant) as Row[]).map((r) => [String(r.code), String(r.data)]));
  const out: PendingChanges = { added: [], changed: [], removed: [] };
  for (const [code, data] of draft) {
    if (!pub.has(code)) out.added.push(code);
    else if (pub.get(code) !== data) out.changed.push(code);
  }
  for (const code of pub.keys()) if (!draft.has(code)) out.removed.push(code);
  for (const k of ['added', 'changed', 'removed'] as const) out[k].sort();
  return out;
}

/** Publishes the draft as the next version; returns null when there is nothing to publish. */
export function publish(db: Db, tenant: number, user: number | null, at: number): { version: number; changes: PendingChanges } | null {
  return tx(db, () => {
    const changes = pendingChanges(db, tenant);
    if (!changes.added.length && !changes.changed.length && !changes.removed.length) return null;
    const version = currentVersion(db, tenant).version + 1;
    const up = db.prepare(
      `INSERT INTO published (tenant_id, code, data, version, deleted) VALUES (?, ?, ?, ?, 0)
       ON CONFLICT (tenant_id, code) DO UPDATE SET data = excluded.data, version = excluded.version, deleted = 0`,
    );
    const get = db.prepare('SELECT data FROM species WHERE tenant_id = ? AND code = ?');
    for (const code of [...changes.added, ...changes.changed]) up.run(tenant, code, String((get.get(tenant, code) as Row).data), version);
    const del = db.prepare('UPDATE published SET data = NULL, deleted = 1, version = ? WHERE tenant_id = ? AND code = ?');
    for (const code of changes.removed) del.run(version, tenant, code);
    db.prepare('INSERT INTO versions (tenant_id, version, published_at, published_by, added, changed, removed) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      tenant,
      version,
      nowIso(at),
      user,
      changes.added.length,
      changes.changed.length,
      changes.removed.length,
    );
    return { version, changes };
  });
}

/** Published entries changed after `since` (0 = the whole catalogue, without removals). */
export function changesSince(db: Db, tenant: number, since: number): CatalogEntry[] {
  const rows = db
    .prepare(`SELECT code, data, version, deleted FROM published WHERE tenant_id = ? AND version > ? ${since === 0 ? 'AND deleted = 0' : ''} ORDER BY code`)
    .all(tenant, since) as Row[];
  return rows.map((r) =>
    Number(r.deleted) ? { code: String(r.code), version: Number(r.version), deleted: true } : { code: String(r.code), version: Number(r.version), species: parse(r.data) },
  );
}

/** Marks what each import row would do; rows that cannot be applied get errors (and status 'error'). */
export function planImport(db: Db, tenant: number, rows: ImportRow[]): ImportRow[] {
  const seen = new Set<string>();
  const draft = new Map(listSpecies(db, tenant).map((s) => [s.code, s]));
  const created = new Set<string>();
  return rows.map((r) => {
    const errors = [...r.errors];
    const key = `${r.code}|${r.offer?.pot.toLowerCase()}`;
    if (!errors.length && seen.has(key)) errors.push('Ez a faj és cserépméret már szerepelt feljebb. / Same species and pot size as an earlier row.');
    seen.add(key);
    const existing = draft.get(r.code);
    if (!errors.length && !existing && !created.has(r.code) && (!r.nameHu || !r.nameLat))
      errors.push('Új fajhoz név és latin név is kell. / A new species needs a name and a Latin name.');
    if (errors.length) return { ...r, errors, status: 'error' };
    if (!existing) {
      created.add(r.code);
      return { ...r, status: 'new' };
    }
    const old = existing.offers.find((o) => o.pot.toLowerCase() === r.offer!.pot.toLowerCase());
    const same = old && old.priceHuf === r.offer!.priceHuf && (old.stock ?? null) === (r.offer!.stock ?? null);
    return { ...r, status: same ? 'same' : old ? 'update' : 'new' };
  });
}

/** Applies the valid rows of an import in one transaction; returns how many species changed. */
export function applyImport(db: Db, tenant: number, rows: ImportRow[], user: number | null, at: number): number {
  return tx(db, () => {
    const touched = new Map<string, CatalogSpecies>();
    for (const r of planImport(db, tenant, rows)) {
      if (r.status === 'error' || r.status === 'same' || !r.offer) continue;
      const s: CatalogSpecies = touched.get(r.code) ??
        getSpecies(db, tenant, r.code) ?? { code: r.code, nameHu: r.nameHu!, nameLat: r.nameLat!, ...(r.nameEn ? { nameEn: r.nameEn } : {}), offers: [] };
      const offers = s.offers.filter((o) => o.pot.toLowerCase() !== r.offer!.pot.toLowerCase());
      touched.set(r.code, { ...s, offers: [...offers, r.offer] });
    }
    for (const s of touched.values()) {
      const v = validateSpecies(s);
      if (!v.ok) throw new Error(`${s.code}: ${v.errors.join('; ')}`);
      putSpecies(db, tenant, v.value, user, at);
    }
    return touched.size;
  });
}
