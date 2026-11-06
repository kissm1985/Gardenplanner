// Tenants, users, login codes, sessions and the security log (PL-BE-01, PL-SEC-01).
import { type Db, nowIso } from './db';
import { hmac, newCode, newToken, safeEqual, sha256 } from './security';

export type Role = 'owner' | 'editor' | 'viewer';
export const ROLES: Role[] = ['owner', 'editor', 'viewer'];
const RANK: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };
export const roleAtLeast = (r: Role, min: Role) => RANK[r] >= RANK[min];

export interface Tenant {
  id: number;
  slug: string;
  name: string;
}
export interface User {
  id: number;
  tenantId: number;
  email: string;
  role: Role;
  totpOn: boolean;
  totpSecret: string | null;
  disabled: boolean;
}
export interface Session {
  user: User;
  tenant: Tenant;
  tokenHash: string;
  expiresAt: number;
}

type Row = Record<string, unknown>;
const toTenant = (r: Row): Tenant => ({ id: Number(r.id), slug: String(r.slug), name: String(r.name) });
const toUser = (r: Row): User => ({
  id: Number(r.id),
  tenantId: Number(r.tenant_id),
  email: String(r.email),
  role: r.role as Role,
  totpOn: !!Number(r.totp_on),
  totpSecret: r.totp_secret ? String(r.totp_secret) : null,
  disabled: !!Number(r.disabled),
});

export const CODE_TTL_MS = 10 * 60_000;
export const CODE_MAX_ATTEMPTS = 5;
export const SESSION_TTL_MS = 12 * 3600_000;
/** Failed logins of one address within an hour before it is locked for the rest of that hour. */
export const LOCKOUT_FAILURES = 10;

export function createTenant(db: Db, slug: string, name: string, at: number): Tenant {
  const r = db.prepare('INSERT INTO tenants (slug, name, created_at) VALUES (?, ?, ?) RETURNING *').get(slug, name, nowIso(at)) as Row;
  return toTenant(r);
}

export function tenantBySlug(db: Db, slug: string): Tenant | null {
  const r = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug) as Row | undefined;
  return r ? toTenant(r) : null;
}

export function createUser(db: Db, tenant: number, email: string, role: Role, at: number): User {
  const r = db.prepare('INSERT INTO users (tenant_id, email, role, created_at) VALUES (?, ?, ?, ?) RETURNING *').get(tenant, email.toLowerCase(), role, nowIso(at)) as Row;
  return toUser(r);
}

export function userByEmail(db: Db, tenant: number, email: string): User | null {
  const r = db.prepare('SELECT * FROM users WHERE tenant_id = ? AND email = ?').get(tenant, email.toLowerCase()) as Row | undefined;
  return r ? toUser(r) : null;
}

export function userById(db: Db, tenant: number, id: number): User | null {
  const r = db.prepare('SELECT * FROM users WHERE tenant_id = ? AND id = ?').get(tenant, id) as Row | undefined;
  return r ? toUser(r) : null;
}

export function listUsers(db: Db, tenant: number): User[] {
  return (db.prepare('SELECT * FROM users WHERE tenant_id = ? ORDER BY email').all(tenant) as Row[]).map(toUser);
}

export function updateUser(db: Db, tenant: number, id: number, patch: { role?: Role; disabled?: boolean }) {
  if (patch.role) db.prepare('UPDATE users SET role = ? WHERE tenant_id = ? AND id = ?').run(patch.role, tenant, id);
  if (patch.disabled != null) {
    db.prepare('UPDATE users SET disabled = ? WHERE tenant_id = ? AND id = ?').run(patch.disabled ? 1 : 0, tenant, id);
    if (patch.disabled) db.prepare('DELETE FROM sessions WHERE tenant_id = ? AND user_id = ?').run(tenant, id);
  }
}

export function deleteUser(db: Db, tenant: number, id: number) {
  db.prepare('DELETE FROM sessions WHERE tenant_id = ? AND user_id = ?').run(tenant, id);
  db.prepare('DELETE FROM login_codes WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ? AND id = ?)').run(tenant, id);
  db.prepare('DELETE FROM users WHERE tenant_id = ? AND id = ?').run(tenant, id);
}

export const countOwners = (db: Db, tenant: number) =>
  Number((db.prepare("SELECT count(*) AS n FROM users WHERE tenant_id = ? AND role = 'owner' AND disabled = 0").get(tenant) as Row).n);

export function setTotp(db: Db, tenant: number, id: number, secret: string | null, on: boolean) {
  db.prepare('UPDATE users SET totp_secret = ?, totp_on = ? WHERE tenant_id = ? AND id = ?').run(secret, on ? 1 : 0, tenant, id);
}

/** A new one-time login code for the user; earlier unused codes stop working. */
export function issueCode(db: Db, secret: string, user: User, at: number): string {
  const code = newCode();
  db.prepare('UPDATE login_codes SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);
  db.prepare('INSERT INTO login_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)').run(user.id, hmac(secret, `${user.id}:${code}`), at + CODE_TTL_MS);
  return code;
}

/** Checks a login code; each try counts, and the code is spent after too many wrong tries or one right one. */
export function checkCode(db: Db, secret: string, user: User, code: string, at: number): boolean {
  const r = db.prepare('SELECT * FROM login_codes WHERE user_id = ? AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1').get(user.id, at) as Row | undefined;
  if (!r) return false;
  const attempts = Number(r.attempts) + 1;
  const ok = /^\d{6}$/.test(code) && safeEqual(String(r.code_hash), hmac(secret, `${user.id}:${code}`));
  db.prepare('UPDATE login_codes SET attempts = ?, used = ? WHERE id = ?').run(attempts, ok || attempts >= CODE_MAX_ATTEMPTS ? 1 : 0, Number(r.id));
  return ok;
}

export function createSession(db: Db, user: User, at: number): { token: string; expiresAt: number } {
  const token = newToken();
  const expiresAt = at + SESSION_TTL_MS;
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(at);
  db.prepare('INSERT INTO sessions (token_hash, user_id, tenant_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run(sha256(token), user.id, user.tenantId, expiresAt, at);
  return { token, expiresAt };
}

export function sessionByToken(db: Db, token: string, at: number): Session | null {
  const r = db
    .prepare(
      `SELECT s.token_hash, s.expires_at, u.*, t.slug AS t_slug, t.name AS t_name FROM sessions s
       JOIN users u ON u.id = s.user_id AND u.tenant_id = s.tenant_id
       JOIN tenants t ON t.id = s.tenant_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0`,
    )
    .get(sha256(token), at) as Row | undefined;
  if (!r) return null;
  const user = toUser(r);
  return { user, tenant: { id: user.tenantId, slug: String(r.t_slug), name: String(r.t_name) }, tokenHash: String(r.token_hash), expiresAt: Number(r.expires_at) };
}

export const endSession = (db: Db, tokenHash: string) => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);

// --- Security log ------------------------------------------------------------------------------------------------
export interface AuditEntry {
  at: string;
  action: string;
  detail: string | null;
  email: string | null;
  ip: string | null;
}

export function audit(db: Db, e: { tenant?: number | null; user?: number | null; action: string; detail?: string; ip?: string | null }, at: number) {
  db.prepare('INSERT INTO audit (tenant_id, user_id, action, detail, ip, at) VALUES (?, ?, ?, ?, ?, ?)').run(
    e.tenant ?? null,
    e.user ?? null,
    e.action,
    e.detail?.slice(0, 500) ?? null,
    e.ip ?? null,
    at,
  );
}

export function listAudit(db: Db, tenant: number, limit = 200): AuditEntry[] {
  return (
    db
      .prepare('SELECT a.at, a.action, a.detail, a.ip, u.email FROM audit a LEFT JOIN users u ON u.id = a.user_id WHERE a.tenant_id = ? ORDER BY a.id DESC LIMIT ?')
      .all(tenant, limit) as Row[]
  ).map((r) => ({ at: nowIso(Number(r.at)), action: String(r.action), detail: (r.detail as string) ?? null, email: (r.email as string) ?? null, ip: (r.ip as string) ?? null }));
}

/** Failed logins for this address in the last hour (any tenant: an attacker can't dodge it by switching). */
export const recentFailures = (db: Db, email: string, at: number) =>
  Number((db.prepare("SELECT count(*) AS n FROM audit WHERE action = 'login.fail' AND detail = ? AND at > ?").get(email.toLowerCase(), at - 3600_000) as Row).n);
