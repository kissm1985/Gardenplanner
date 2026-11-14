// Shared pieces of the API: options, errors, the route table and the helpers every route module uses.
import type { IncomingMessage } from 'node:http';
import { SLUG_RE } from '../src/engine/catalog';
import * as acc from './accounts';
import type { Db } from './db';
import { RateLimiter } from './security';

export interface Mailer {
  send(to: string, subject: string, body: string): void | Promise<void>;
}

export interface AppOptions {
  db: Db;
  /** Server secret for the login code HMAC (at least 32 characters in production). */
  secret: string;
  mailer: Mailer;
  /** Origins allowed to call the admin API from a browser (the admin page's origin). */
  origins: string[];
  now?: () => number;
  /** Take the client address from X-Forwarded-For (only behind a trusted proxy). */
  trustProxy?: boolean;
  /** Owners must set up the authenticator app (second factor) before using the admin API. */
  requireOwnerTotp?: boolean;
  log?: (msg: string) => void;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export interface Ctx {
  req: IncomingMessage;
  params: string[];
  query: URLSearchParams;
  ip: string;
  body: Record<string, unknown>;
  session: acc.Session | null;
}

export type Handler = (c: Ctx) => unknown;
export interface Route {
  method: string;
  path: RegExp;
  handler: Handler;
  /** Lowest role; missing = public. */
  role?: acc.Role;
  /** Body size limit in bytes. */
  limit?: number;
  /** Allowed before an owner set up the second factor. */
  beforeTotp?: boolean;
}

export function makeKit(o: AppOptions) {
  const { db, secret, mailer } = o;
  const now = o.now ?? Date.now;
  const log = o.log ?? (() => {});
  const limiter = new RateLimiter(now);
  const routes: Route[] = [];
  const route = (method: string, path: string, handler: Handler, opts: Omit<Route, 'method' | 'path' | 'handler'> = {}) =>
    routes.push({ method, path: new RegExp(`^${path.replace(/:(\w+)/g, '([^/]+)')}$`), handler, ...opts });

  const limit = (key: string, n: number, windowMs: number) => {
    const wait = limiter.hit(key, n, windowMs);
    if (wait) throw new HttpError(429, 'Túl sok kérés, próbáld később. / Too many requests, try later.', { retryAfter: wait });
  };
  const text = (v: unknown, field: string, max: number) => {
    if (typeof v !== 'string' || !v.trim() || v.length > max) throw new HttpError(400, `${field}: hibás / invalid`);
    return v.trim();
  };
  const auditFor = (c: Ctx, action: string, detail?: string) => audit({ tenant: c.session?.tenant.id, user: c.session?.user.id, action, detail, ip: c.ip });
  const audit = (e: Parameters<typeof acc.audit>[1]) => acc.audit(db, e, now());
  const tenantOf = (slug: string) => {
    const t = SLUG_RE.test(slug) ? acc.tenantBySlug(db, slug) : null;
    if (!t) throw new HttpError(404, 'Nincs ilyen kertészet. / No such nursery.');
    return t;
  };

  return { db, secret, mailer, now, log, routes, route, limit, text, audit, auditFor, tenantOf };
}
export type Kit = ReturnType<typeof makeKit>;
