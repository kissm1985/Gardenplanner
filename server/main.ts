// Planterra backend: the /api/v1 routes, and (optionally) the built app from dist/ with its security headers,
// so one process serves the app, the admin page and the API on one origin.
//   PORT=8787 DB_PATH=planterra.db SERVER_SECRET=… PUBLIC_URL=https://plan.example.hu npm run server
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { purgeOld } from './accounts';
import { createApp } from './app';
import { openDb } from './db';
import { makeMailer } from './mailer';

const env = process.env;
const production = env.NODE_ENV === 'production';
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);
const secret = env.SERVER_SECRET ?? (production ? '' : 'dev-secret-not-for-production-use-0000');
if (secret.length < 32) {
  console.error('SERVER_SECRET must be at least 32 characters.');
  process.exit(1);
}
const db = openDb(env.DB_PATH ?? 'planterra.db');
const PORT = Number(env.PORT ?? 8787);
// Outside production the defaults work on any OS without setting variables: this computer's address, and the
// built app from dist/ if it exists.
const publicUrl = env.PUBLIC_URL ?? (production ? undefined : `http://localhost:${PORT}`);
const origins = [publicUrl, ...(env.ALLOWED_ORIGINS ?? '').split(',')]
  .map((s) => s?.trim())
  .filter((s): s is string => !!s)
  .map((u) => new URL(u).origin);
const app = createApp({
  db,
  secret,
  origins,
  log,
  trustProxy: env.TRUST_PROXY === '1',
  requireOwnerTotp: env.REQUIRE_OWNER_TOTP === '1',
  mailer: makeMailer(db, { production, webhook: env.MAIL_WEBHOOK_URL, webhookToken: env.MAIL_WEBHOOK_TOKEN, log }),
});

// Retention (privacy notice): old log entries and feedback go once a day.
purgeOld(db, Date.now());
setInterval(() => purgeOld(db, Date.now()), 24 * 3600_000).unref();

const NO_APP =
  'A szerver fut (API: /api/v1/health), de nem talalja a buildelt alkalmazast (dist/index.html).\n' +
  'Allitsd le (Ctrl+C), futtasd: npm run build, majd ugyanabbol a mappabol: npm run server\n\n' +
  'The server is running, but the built app (dist/index.html) is missing: run npm run build, then npm run server.\n';
const STATIC = env.STATIC_DIR ? resolve(env.STATIC_DIR) : !production && existsSync('dist/index.html') ? resolve('dist') : null;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};
// The headers the build wrote for static hosts (dist/_headers), sent with every file (read once it exists).
let headers: Record<string, string> | null = null;
function staticHeaders(dir: string) {
  if (headers) return headers;
  const h: Record<string, string> = {};
  if (!existsSync(join(dir, '_headers'))) return h;
  for (const line of readFileSync(join(dir, '_headers'), 'utf8').split('\n').slice(1)) {
    const m = line.match(/^\s+([\w-]+):\s*(.+)$/);
    if (m) h[m[1].toLowerCase()] = m[2];
  }
  return (headers = h);
}

createServer(async (req, res) => {
  if (await app.handle(req, res)) return;
  if (!STATIC) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end(NO_APP);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(404).end();
    return;
  }
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = normalize(join(STATIC, path));
  if (!file.startsWith(STATIC)) {
    res.writeHead(400).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = existsSync(join(file, 'index.html')) ? join(file, 'index.html') : join(STATIC, 'index.html');
  const immutable = file.includes(`${join(STATIC, 'assets')}`);
  res.writeHead(200, {
    ...staticHeaders(STATIC),
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).pipe(res);
}).listen(PORT, () => {
  log(`Planterra server on :${PORT}${STATIC ? ` serving ${STATIC}` : ''}`);
  if (!STATIC && !production) log(`No app to serve: ${resolve('dist/index.html')} is missing. Run \`npm run build\`, then start the server again.`);
  if (!production && STATIC) log(`App: http://localhost:${PORT}/  ·  Admin: http://localhost:${PORT}/admin.html`);
});
