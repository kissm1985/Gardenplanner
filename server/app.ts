// HTTP API of the Planterra backend, version 1 (PL-BE-01..04, PL-SEC-01). Plain node:http, JSON only.
// Public: health, a tenant's published catalogue (version + changes), feedback.
// Signed in (Bearer token): the tenant's admin API; the tenant always comes from the session, never from the
// request, and each route names the lowest role that may call it.
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as acc from './accounts';
import { type AppOptions, HttpError, makeKit } from './kit';
import { authRoutes } from './routes/auth';
import { catalogRoutes } from './routes/catalog';
import { publicRoutes } from './routes/public';
import { userRoutes } from './routes/users';

export type { AppOptions, Mailer } from './kit';

const PUBLIC = /^\/api\/v1\/(health|t\/|feedback)/;

export function createApp(o: AppOptions) {
  const k = makeKit(o);
  const { db, now, log, routes, limit, audit } = k;
  publicRoutes(k);
  authRoutes(k);
  catalogRoutes(k);
  userRoutes(k);

  // --- Plumbing -----------------------------------------------------------------------------------------------------
  const clientIp = (req: IncomingMessage) => {
    const fwd = o.trustProxy
      ? String(req.headers['x-forwarded-for'] ?? '')
          .split(',')[0]
          .trim()
      : '';
    return fwd || req.socket.remoteAddress || 'unknown';
  };

  const readBody = (req: IncomingMessage, max: number) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      if (req.method === 'GET' || req.method === 'DELETE' || req.method === 'OPTIONS') return resolve({});
      if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) return reject(new HttpError(415, 'JSON kell. / JSON expected.'));
      if (Number(req.headers['content-length'] ?? 0) > max) return reject(new HttpError(413, 'Túl nagy kérés. / Request too large.'));
      let size = 0;
      let over = false;
      const chunks: Buffer[] = [];
      req.on('data', (ch: Buffer) => {
        size += ch.length;
        if (size > max) over = true;
        else chunks.push(ch);
      });
      req.on('end', () => {
        if (over) return reject(new HttpError(413, 'Túl nagy kérés. / Request too large.'));
        try {
          const v = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
          if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
          resolve(v as Record<string, unknown>);
        } catch {
          reject(new HttpError(400, 'Hibás JSON. / Invalid JSON.'));
        }
      });
      req.on('error', reject);
    });

  const corsHeaders = (req: IncomingMessage, path: string): Record<string, string> => {
    const origin = String(req.headers.origin ?? '');
    const h: Record<string, string> = { vary: 'Origin' };
    if (PUBLIC.test(path)) h['access-control-allow-origin'] = '*';
    else if (origin && o.origins.includes(origin)) h['access-control-allow-origin'] = origin;
    else return h;
    h['access-control-allow-headers'] = 'authorization, content-type';
    h['access-control-allow-methods'] = 'GET, POST, PUT, PATCH, DELETE';
    h['access-control-max-age'] = '600';
    return h;
  };

  const send = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string>) => {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
      ...headers,
    });
    res.end(JSON.stringify(body));
  };

  /** Handles /api/ requests; returns false for any other path (e.g. for the static file server). */
  async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/api/')) return false;
    const cors = corsHeaders(req, url.pathname);
    const origin = req.headers.origin;
    try {
      // A browser on a foreign origin may not use the admin API even with a stolen token.
      if (origin && !cors['access-control-allow-origin']) throw new HttpError(403, 'Ez az oldal nem használhatja az API-t. / Origin not allowed.');
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors);
        res.end();
        return true;
      }
      const ip = clientIp(req);
      limit(`ip:${ip}`, 600, 60_000);
      const matches = routes.filter((r) => r.path.test(url.pathname));
      if (!matches.length) throw new HttpError(404, 'Nincs ilyen végpont. / Not found.');
      const r = matches.find((x) => x.method === req.method);
      if (!r) throw new HttpError(405, 'Nem támogatott metódus. / Method not allowed.');
      let session: acc.Session | null = null;
      if (r.role) {
        const auth = String(req.headers.authorization ?? '');
        const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
        session = token && token.length < 100 ? acc.sessionByToken(db, token, now()) : null;
        if (!session) throw new HttpError(401, 'Jelentkezz be. / Please sign in.');
        if (!acc.roleAtLeast(session.user.role, r.role)) {
          audit({ tenant: session.tenant.id, user: session.user.id, action: 'denied', detail: `${req.method} ${url.pathname}`, ip });
          throw new HttpError(403, 'Ehhez nincs jogosultságod. / You may not do this.');
        }
        if (o.requireOwnerTotp && session.user.role === 'owner' && !session.user.totpOn && !r.beforeTotp)
          throw new HttpError(403, 'Előbb kapcsold be a kétlépcsős belépést. / Set up two-step sign-in first.', { totpSetup: true });
      }
      const body = await readBody(req, r.limit ?? 65_536);
      const params = r.path.exec(url.pathname)!.slice(1);
      const out = await r.handler({ req, params, query: url.searchParams, ip, body, session });
      send(res, 200, out, cors);
    } catch (e) {
      if (e instanceof HttpError) {
        const h = { ...cors, ...(e.extra.retryAfter ? { 'retry-after': String(e.extra.retryAfter) } : {}) };
        send(res, e.status, { error: e.message, ...e.extra }, h);
      } else {
        log(`error: ${(e as Error).stack ?? e}`);
        send(res, 500, { error: 'Szerverhiba. / Server error.' }, cors);
      }
    }
    return true;
  }

  return { handle };
}
