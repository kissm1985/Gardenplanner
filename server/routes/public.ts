import { HttpError, type Kit } from '../kit';
import * as cat from '../catalogRepo';

export function publicRoutes(k: Kit) {
  const { db, now, route, limit, text, tenantOf } = k;
  // --- Public -----------------------------------------------------------------------------------------------------
  route('GET', '/api/v1/health', () => ({ ok: true, api: 1 }));

  route('GET', '/api/v1/t/:slug/catalog/version', (c) => {
    const t = tenantOf(c.params[0]);
    return { tenant: t.slug, name: t.name, ...cat.currentVersion(db, t.id) };
  });

  route('GET', '/api/v1/t/:slug/catalog/changes', (c) => {
    const t = tenantOf(c.params[0]);
    const since = Number(c.query.get('since') ?? 0);
    if (!Number.isInteger(since) || since < 0) throw new HttpError(400, 'since: hibás / invalid');
    const { version } = cat.currentVersion(db, t.id);
    // A client ahead of the server (e.g. after a restore) gets the whole catalogue again.
    const from = since > version ? 0 : since;
    return { version, since: from, entries: cat.changesSince(db, t.id, from) };
  });

  route(
    'POST',
    '/api/v1/feedback',
    (c) => {
      limit(`fb:${c.ip}`, 5, 10 * 60_000);
      const kind = ['bug', 'idea', 'other'].includes(String(c.body.kind)) ? String(c.body.kind) : 'other';
      const body = text(c.body.text, 'text', 5000);
      const tech = typeof c.body.tech === 'string' ? c.body.tech.slice(0, 1000) : null;
      db.prepare('INSERT INTO feedback (kind, text, tech, at) VALUES (?, ?, ?, ?)').run(kind, body, tech, now());
      return { ok: true };
    },
    { limit: 16_384 },
  );
}
