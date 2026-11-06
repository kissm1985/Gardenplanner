import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createTenant, createUser, type Role } from '../../server/accounts';
import { createApp } from '../../server/app';
import { openDb, type Db } from '../../server/db';

export interface TestServer {
  url: string;
  db: Db;
  mails: { to: string; subject: string; body: string }[];
  clock: { t: number };
  close: () => Promise<void>;
  /** Signs in through the real e-mail code flow and returns the token. */
  login: (tenant: string, email: string, extra?: Record<string, string>) => Promise<string>;
  call: (
    method: string,
    path: string,
    opts?: { token?: string; body?: unknown; origin?: string; headers?: Record<string, string> },
  ) => Promise<{
    status: number; // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test responses are checked by the assertions
    body: any;
    headers: Headers;
  }>;
}

export async function startServer(opts: { requireOwnerTotp?: boolean; origins?: string[] } = {}): Promise<TestServer> {
  const db = openDb();
  const mails: TestServer['mails'] = [];
  const clock = { t: Date.parse('2026-11-06T10:00:00Z') };
  const app = createApp({
    db,
    secret: 'test-secret-test-secret-test-secret-00',
    origins: opts.origins ?? ['https://admin.example'],
    now: () => clock.t,
    requireOwnerTotp: opts.requireOwnerTotp,
    mailer: { send: (to, subject, body) => void mails.push({ to, subject, body }) },
  });
  const server: Server = createServer(async (req, res) => {
    if (!(await app.handle(req, res))) res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call: TestServer['call'] = async (method, path, o = {}) => {
    const res = await fetch(url + path, {
      method,
      headers: {
        ...(o.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
        ...(o.origin ? { origin: o.origin } : {}),
        ...o.headers,
      },
      body: o.body === undefined ? undefined : typeof o.body === 'string' ? o.body : JSON.stringify(o.body),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, body, headers: res.headers };
  };
  const login: TestServer['login'] = async (tenant, email, extra = {}) => {
    await call('POST', '/api/v1/auth/request', { body: { tenant, email } });
    const code = mails
      .filter((m) => m.to === email)
      .at(-1)
      ?.subject.match(/\d{6}/)?.[0];
    const r = await call('POST', '/api/v1/auth/verify', { body: { tenant, email, code, ...extra } });
    if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body.token as string;
  };
  return { url, db, mails, clock, call, login, close: () => new Promise((r) => server.close(() => r())) };
}

/** Two nurseries, each with an owner, an editor and a viewer. */
export function seedTenants(db: Db) {
  const at = Date.now();
  for (const slug of ['kert-a', 'kert-b']) {
    const t = createTenant(db, slug, slug === 'kert-a' ? 'A Kertészet' : 'B Kertészet', at);
    for (const role of ['owner', 'editor', 'viewer'] as Role[]) createUser(db, t.id, `${role}@${slug}.hu`, role, at);
  }
}
