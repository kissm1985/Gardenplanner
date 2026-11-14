import { HttpError, type Kit } from '../kit';
import * as acc from '../accounts';
import { EMAIL_RE, SLUG_RE } from '../../src/engine/catalog';
import { newTotpSecret, sha256, totpOk } from '../security';

export function authRoutes(k: Kit) {
  const { db, secret, mailer, now, log, route, limit, text, audit, auditFor } = k;
  // --- Sign-in: e-mail one-time code, then (if set up) the authenticator code -------------------------------------
  route('POST', '/api/v1/auth/request', async (c) => {
    limit(`authreq:${c.ip}`, 10, 10 * 60_000);
    const email = text(c.body.email, 'email', 254).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Érvénytelen e-mail-cím. / Invalid e-mail address.');
    limit(`authreq:${email}`, 5, 10 * 60_000);
    const t = SLUG_RE.test(String(c.body.tenant)) ? acc.tenantBySlug(db, String(c.body.tenant)) : null;
    const user = t ? acc.userByEmail(db, t.id, email) : null;
    // The answer is the same whether or not the address has an account (no user enumeration).
    if (user && !user.disabled && acc.recentFailures(db, email, now()) < acc.LOCKOUT_FAILURES) {
      const code = acc.issueCode(db, secret, user, now());
      await mailer.send(
        email,
        `Planterra belépési kód: ${code}`,
        `A belépési kódod a(z) ${t!.name} katalógusához: ${code}\nA kód 10 percig érvényes. Ha nem te kérted, hagyd figyelmen kívül.\n\n` +
          `Your sign-in code for ${t!.name}: ${code}\nIt is valid for 10 minutes. If you did not ask for it, ignore this e-mail.`,
      );
      audit({ tenant: t!.id, user: user.id, action: 'login.code', ip: c.ip });
    } else audit({ tenant: t?.id ?? null, action: 'login.code.refused', detail: email, ip: c.ip });
    return { sent: true };
  });

  route('POST', '/api/v1/auth/verify', (c) => {
    limit(`authver:${c.ip}`, 20, 10 * 60_000);
    const email = text(c.body.email, 'email', 254).toLowerCase();
    const code = String(c.body.code ?? '').trim();
    const t = SLUG_RE.test(String(c.body.tenant)) ? acc.tenantBySlug(db, String(c.body.tenant)) : null;
    const user = t ? acc.userByEmail(db, t.id, email) : null;
    const fail = (why: string) => {
      audit({ tenant: t?.id ?? null, user: user?.id ?? null, action: 'login.fail', detail: email, ip: c.ip });
      log(`login failed for ${sha256(email).slice(0, 8)}: ${why}`);
      return new HttpError(401, 'Hibás vagy lejárt kód. / Wrong or expired code.');
    };
    if (!t || !user || user.disabled) throw fail('no user');
    if (acc.recentFailures(db, email, now()) >= acc.LOCKOUT_FAILURES)
      throw new HttpError(429, 'Túl sok hibás próbálkozás, próbáld egy óra múlva. / Too many failed tries, try in an hour.');
    if (user.totpOn) {
      // The e-mail code is checked (and spent) only together with the authenticator code.
      const second = String(c.body.totp ?? '');
      if (!second) throw new HttpError(401, 'Add meg a hitelesítő alkalmazás kódját is. / Enter your authenticator code too.', { totp: true });
      if (!totpOk(user.totpSecret!, second, now())) throw fail('totp');
    }
    if (!acc.checkCode(db, secret, user, code, now())) throw fail('code');
    const s = acc.createSession(db, user, now());
    audit({ tenant: t.id, user: user.id, action: 'login.ok', ip: c.ip });
    return {
      token: s.token,
      expiresAt: new Date(s.expiresAt).toISOString(),
      user: { email: user.email, role: user.role, totp: user.totpOn },
      tenant: { slug: t.slug, name: t.name },
    };
  });

  route(
    'POST',
    '/api/v1/auth/logout',
    (c) => {
      acc.endSession(db, c.session!.tokenHash);
      auditFor(c, 'logout');
      return { ok: true };
    },
    { role: 'viewer', beforeTotp: true },
  );

  route('GET', '/api/v1/me', (c) => ({ user: { email: c.session!.user.email, role: c.session!.user.role, totp: c.session!.user.totpOn }, tenant: c.session!.tenant }), {
    role: 'viewer',
    beforeTotp: true,
  });

  route(
    'POST',
    '/api/v1/me/totp/setup',
    (c) => {
      const u = c.session!.user;
      if (u.totpOn) throw new HttpError(409, 'A második lépés már be van kapcsolva. / Already set up.');
      const s = newTotpSecret();
      acc.setTotp(db, u.tenantId, u.id, s, false);
      return { secret: s, uri: `otpauth://totp/Planterra:${encodeURIComponent(u.email)}?secret=${s}&issuer=Planterra` };
    },
    { role: 'viewer', beforeTotp: true },
  );

  route(
    'POST',
    '/api/v1/me/totp/enable',
    (c) => {
      const u = c.session!.user;
      if (!u.totpSecret || u.totpOn) throw new HttpError(409, 'Előbb kérj új kulcsot. / Start the setup first.');
      if (!totpOk(u.totpSecret, String(c.body.code ?? ''), now())) throw new HttpError(400, 'Hibás kód. / Wrong code.');
      acc.setTotp(db, u.tenantId, u.id, u.totpSecret, true);
      auditFor(c, 'totp.on');
      return { ok: true };
    },
    { role: 'viewer', beforeTotp: true },
  );
}
