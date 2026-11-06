import { type Ctx, HttpError, type Kit } from '../kit';
import * as cat from '../catalogRepo';
import { CATALOG_LIMITS, CODE_RE, type ImportMapping, IMPORT_FIELDS, readImportRows, validateSpecies } from '../../src/engine/catalog';

export function catalogRoutes(k: Kit) {
  const { db, now, route, auditFor } = k;
  // --- Catalogue admin --------------------------------------------------------------------------------------------
  const code = (c: Ctx) => {
    const k = decodeURIComponent(c.params[0]).toUpperCase();
    if (!CODE_RE.test(k)) throw new HttpError(400, 'code: hibás / invalid');
    return k;
  };

  route(
    'GET',
    '/api/v1/admin/species',
    (c) => {
      const t = c.session!.tenant.id;
      return { species: cat.listSpecies(db, t), pending: cat.pendingChanges(db, t), ...cat.currentVersion(db, t) };
    },
    { role: 'viewer' },
  );

  route(
    'GET',
    '/api/v1/admin/species/:code',
    (c) => {
      const s = cat.getSpecies(db, c.session!.tenant.id, code(c));
      if (!s) throw new HttpError(404, 'Nincs ilyen faj. / No such species.');
      return s;
    },
    { role: 'viewer' },
  );

  route(
    'PUT',
    '/api/v1/admin/species/:code',
    (c) => {
      const t = c.session!.tenant.id;
      const k = code(c);
      const v = validateSpecies({ ...c.body, code: k });
      if (!v.ok) throw new HttpError(400, 'Hibás adatok. / Invalid data.', { details: v.errors });
      const isNew = !cat.getSpecies(db, t, k);
      if (isNew && cat.countSpecies(db, t) >= CATALOG_LIMITS.species)
        throw new HttpError(409, `Legfeljebb ${CATALOG_LIMITS.species} faj. / At most ${CATALOG_LIMITS.species} species.`);
      cat.putSpecies(db, t, v.value, c.session!.user.id, now());
      auditFor(c, isNew ? 'species.add' : 'species.edit', k);
      return v.value;
    },
    { role: 'editor' },
  );

  route(
    'DELETE',
    '/api/v1/admin/species/:code',
    (c) => {
      const k = code(c);
      if (!cat.deleteSpecies(db, c.session!.tenant.id, k)) throw new HttpError(404, 'Nincs ilyen faj. / No such species.');
      auditFor(c, 'species.delete', k);
      return { ok: true };
    },
    { role: 'editor' },
  );

  const importRows = (c: Ctx) => {
    const rows = c.body.rows;
    if (
      !Array.isArray(rows) ||
      rows.length > CATALOG_LIMITS.importRows + 1 ||
      rows.some((r) => !Array.isArray(r) || r.length > 200 || r.some((x) => typeof x !== 'string' || x.length > 500))
    )
      throw new HttpError(400, 'rows: szövegek táblázata kell / must be a table of text');
    let mapping: ImportMapping | undefined;
    if (c.body.mapping != null) {
      const m = c.body.mapping as Record<string, unknown>;
      mapping = {};
      for (const f of IMPORT_FIELDS) if (Number.isInteger(m[f]) && (m[f] as number) >= 0 && (m[f] as number) < 200) mapping[f] = m[f] as number;
    }
    const r = readImportRows(rows as string[][], mapping);
    if (r.errors.length) throw new HttpError(400, r.errors.join(' '), { mapping: r.mapping, header: rows[0] ?? [] });
    return { ...r, header: (rows[0] as string[]) ?? [] };
  };
  const summary = (rows: { status?: string }[]) => Object.fromEntries(['new', 'update', 'same', 'error'].map((s) => [s, rows.filter((r) => r.status === s).length]));

  route(
    'POST',
    '/api/v1/admin/import/preview',
    (c) => {
      const r = importRows(c);
      const rows = cat.planImport(db, c.session!.tenant.id, r.rows);
      return { mapping: r.mapping, header: r.header, rows, summary: summary(rows) };
    },
    { role: 'editor', limit: 4_000_000 },
  );

  route(
    'POST',
    '/api/v1/admin/import/commit',
    (c) => {
      const r = importRows(c);
      const t = c.session!.tenant.id;
      const rows = cat.planImport(db, t, r.rows);
      const species = cat.applyImport(db, t, r.rows, c.session!.user.id, now());
      const s = summary(rows);
      auditFor(c, 'import', `${species} species; new ${s.new}, updated ${s.update}, errors ${s.error}`);
      return { species, summary: s };
    },
    { role: 'editor', limit: 4_000_000 },
  );

  route('GET', '/api/v1/admin/publish', (c) => ({ pending: cat.pendingChanges(db, c.session!.tenant.id), ...cat.currentVersion(db, c.session!.tenant.id) }), { role: 'viewer' });

  route(
    'POST',
    '/api/v1/admin/publish',
    (c) => {
      const r = cat.publish(db, c.session!.tenant.id, c.session!.user.id, now());
      if (!r) throw new HttpError(409, 'Nincs közzéteendő változás. / Nothing to publish.');
      auditFor(c, 'publish', `v${r.version}: +${r.changes.added.length} ~${r.changes.changed.length} -${r.changes.removed.length}`);
      return r;
    },
    { role: 'editor' },
  );
}
