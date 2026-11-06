import { type Ctx, HttpError, type Kit } from '../kit';
import * as acc from '../accounts';
import { EMAIL_RE } from '../../src/engine/catalog';

export function userRoutes(k: Kit) {
  const { db, now, route, text, auditFor } = k;
  // --- Users and security log (owners) ----------------------------------------------------------------------------
  const userView = (u: acc.User) => ({ id: u.id, email: u.email, role: u.role, totp: u.totpOn, disabled: u.disabled });
  const role = (v: unknown): acc.Role => {
    if (!acc.ROLES.includes(v as acc.Role)) throw new HttpError(400, 'role: owner / editor / viewer');
    return v as acc.Role;
  };
  const otherUser = (c: Ctx) => {
    const id = Number(c.params[0]);
    const u = Number.isInteger(id) ? acc.userById(db, c.session!.tenant.id, id) : null;
    if (!u) throw new HttpError(404, 'Nincs ilyen felhasználó. / No such user.');
    return u;
  };
  const keepAnOwner = (c: Ctx, u: acc.User) => {
    if (u.role === 'owner' && acc.countOwners(db, c.session!.tenant.id) <= 1) throw new HttpError(409, 'Legalább egy tulajdonos kell. / At least one owner is needed.');
  };

  route('GET', '/api/v1/admin/users', (c) => ({ users: acc.listUsers(db, c.session!.tenant.id).map(userView) }), { role: 'owner' });

  route(
    'POST',
    '/api/v1/admin/users',
    (c) => {
      const email = text(c.body.email, 'email', 254).toLowerCase();
      if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Érvénytelen e-mail-cím. / Invalid e-mail address.');
      const t = c.session!.tenant.id;
      if (acc.userByEmail(db, t, email)) throw new HttpError(409, 'Ez a cím már szerepel. / This address is already listed.');
      if (acc.listUsers(db, t).length >= 50) throw new HttpError(409, 'Legfeljebb 50 felhasználó. / At most 50 users.');
      const u = acc.createUser(db, t, email, role(c.body.role), now());
      auditFor(c, 'user.add', `${email} (${u.role})`);
      return userView(u);
    },
    { role: 'owner' },
  );

  route(
    'PATCH',
    '/api/v1/admin/users/:id',
    (c) => {
      const u = otherUser(c);
      const patch: { role?: acc.Role; disabled?: boolean } = {};
      if (c.body.role != null) patch.role = role(c.body.role);
      if (c.body.disabled != null) patch.disabled = c.body.disabled === true;
      if ((patch.role && patch.role !== 'owner') || patch.disabled) keepAnOwner(c, u);
      acc.updateUser(db, c.session!.tenant.id, u.id, patch);
      auditFor(c, 'user.edit', `${u.email}: ${JSON.stringify(patch)}`);
      return userView(acc.userById(db, c.session!.tenant.id, u.id)!);
    },
    { role: 'owner' },
  );

  route(
    'DELETE',
    '/api/v1/admin/users/:id',
    (c) => {
      const u = otherUser(c);
      keepAnOwner(c, u);
      acc.deleteUser(db, c.session!.tenant.id, u.id);
      auditFor(c, 'user.delete', u.email);
      return { ok: true };
    },
    { role: 'owner' },
  );

  route('GET', '/api/v1/admin/audit', (c) => ({ entries: acc.listAudit(db, c.session!.tenant.id) }), { role: 'owner' });
}
