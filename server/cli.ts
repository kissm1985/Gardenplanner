// Operator commands:
//   npm run server:cli -- create-tenant <slug> "<name>" <owner-email>
//   npm run server:cli -- add-user <slug> <email> <owner|editor|viewer>
//   npm run server:cli -- outbox            (the last sign-in e-mails, for testing without an e-mail provider)
import { EMAIL_RE, SLUG_RE } from '../src/engine/catalog';
import { createTenant, createUser, ROLES, type Role, tenantBySlug } from './accounts';
import { openDb } from './db';

const db = openDb(process.env.DB_PATH ?? 'planterra.db');
const [cmd, ...args] = process.argv.slice(2);
const die = (m: string) => {
  console.error(m);
  process.exit(1);
};

if (cmd === 'create-tenant') {
  const [slug, name, email] = args;
  if (!SLUG_RE.test(slug ?? '')) die('slug: 3–40 lower-case letters, digits or hyphens');
  if (!name) die('name is required');
  if (!EMAIL_RE.test(email ?? '')) die('owner e-mail is invalid');
  if (tenantBySlug(db, slug)) die(`tenant ${slug} exists`);
  const t = createTenant(db, slug, name, Date.now());
  createUser(db, t.id, email, 'owner', Date.now());
  console.log(`tenant ${slug} created, owner ${email}`);
} else if (cmd === 'add-user') {
  const [slug, email, role] = args;
  const t = tenantBySlug(db, slug ?? '') ?? die(`no tenant ${slug}`);
  if (!EMAIL_RE.test(email ?? '')) die('e-mail is invalid');
  if (!ROLES.includes(role as Role)) die('role: owner, editor or viewer');
  createUser(db, t!.id, email, role as Role, Date.now());
  console.log(`user ${email} (${role}) added to ${slug}`);
} else if (cmd === 'outbox') {
  for (const r of db.prepare('SELECT recipient, subject, at FROM outbox ORDER BY id DESC LIMIT 10').all())
    console.log(`${new Date(Number(r.at)).toISOString()}  ${r.recipient}  ${r.subject}`);
} else die('commands: create-tenant, add-user, outbox');
