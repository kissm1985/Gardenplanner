import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { purgeOld, RETENTION_MS } from '../../server/accounts';
import { totp } from '../../server/security';
import { seedTenants, startServer, type TestServer } from './helpers';

let s: TestServer;
beforeEach(async () => {
  s = await startServer();
  seedTenants(s.db);
});
afterEach(() => s.close());

const LAVENDER = { nameHu: 'Levendula', nameLat: 'Lavandula angustifolia', offers: [{ pot: 'P9', priceHuf: 990, stock: 120 }] };

describe('sign-in', () => {
  it('sends a one-time code and gives a session token for it', async () => {
    const r = await s.call('POST', '/api/v1/auth/request', { body: { tenant: 'kert-a', email: 'Editor@kert-a.hu' } });
    expect(r.body).toEqual({ sent: true });
    expect(s.mails).toHaveLength(1);
    const code = s.mails[0].subject.match(/\d{6}/)![0];
    const ok = await s.call('POST', '/api/v1/auth/verify', { body: { tenant: 'kert-a', email: 'editor@kert-a.hu', code } });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ email: 'editor@kert-a.hu', role: 'editor' });
    const me = await s.call('GET', '/api/v1/me', { token: ok.body.token });
    expect(me.body.tenant.slug).toBe('kert-a');
    // A code works once.
    expect((await s.call('POST', '/api/v1/auth/verify', { body: { tenant: 'kert-a', email: 'editor@kert-a.hu', code } })).status).toBe(401);
  });

  it('answers the same for unknown addresses and sends nothing', async () => {
    const r = await s.call('POST', '/api/v1/auth/request', { body: { tenant: 'kert-a', email: 'nobody@x.hu' } });
    expect(r).toMatchObject({ status: 200, body: { sent: true } });
    expect((await s.call('POST', '/api/v1/auth/request', { body: { tenant: 'nincs-ilyen', email: 'owner@kert-a.hu' } })).body).toEqual({ sent: true });
    expect(s.mails).toHaveLength(0);
  });

  it('spends a code after five wrong tries, and expires it after ten minutes', async () => {
    await s.call('POST', '/api/v1/auth/request', { body: { tenant: 'kert-a', email: 'owner@kert-a.hu' } });
    const code = s.mails[0].subject.match(/\d{6}/)![0];
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await s.call('POST', '/api/v1/auth/verify', { body: { tenant: 'kert-a', email: 'owner@kert-a.hu', code: wrong } })).status).toBe(401);
    expect((await s.call('POST', '/api/v1/auth/verify', { body: { tenant: 'kert-a', email: 'owner@kert-a.hu', code } })).status).toBe(401);

    await s.call('POST', '/api/v1/auth/request', { body: { tenant: 'kert-a', email: 'viewer@kert-a.hu' } });
    const c2 = s.mails.at(-1)!.subject.match(/\d{6}/)![0];
    s.clock.t += 11 * 60_000;
    expect((await s.call('POST', '/api/v1/auth/verify', { body: { tenant: 'kert-a', email: 'viewer@kert-a.hu', code: c2 } })).status).toBe(401);
  });

  it('locks an address after ten failed sign-ins within an hour', async () => {
    for (let i = 0; i < 10; i++) await s.call('POST', '/api/v1/auth/verify', { body: { tenant: 'kert-a', email: 'owner@kert-a.hu', code: '123456' } });
    s.clock.t += 11 * 60_000; // past the per-address request limit window
    await s.call('POST', '/api/v1/auth/request', { body: { tenant: 'kert-a', email: 'owner@kert-a.hu' } });
    expect(s.mails).toHaveLength(0);
    s.clock.t += 3600_000;
    await s.login('kert-a', 'owner@kert-a.hu');
  });

  it('rate limits code requests', async () => {
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await s.call('POST', '/api/v1/auth/request', { body: { tenant: 'kert-a', email: 'owner@kert-a.hu' } })).status);
    expect(codes.slice(0, 5).every((x) => x === 200)).toBe(true);
    expect(codes[5]).toBe(429);
  });

  it('ends the session on logout and after twelve hours', async () => {
    const tok = await s.login('kert-a', 'viewer@kert-a.hu');
    expect((await s.call('POST', '/api/v1/auth/logout', { token: tok, body: {} })).status).toBe(200);
    expect((await s.call('GET', '/api/v1/me', { token: tok })).status).toBe(401);
    const tok2 = await s.login('kert-a', 'viewer@kert-a.hu');
    s.clock.t += 12 * 3600_000 + 1;
    expect((await s.call('GET', '/api/v1/me', { token: tok2 })).status).toBe(401);
  });

  it('requires the authenticator code once it is set up', async () => {
    const tok = await s.login('kert-a', 'owner@kert-a.hu');
    const setup = await s.call('POST', '/api/v1/me/totp/setup', { token: tok, body: {} });
    expect(setup.body.uri).toMatch(/^otpauth:\/\/totp\/Planterra:/);
    expect((await s.call('POST', '/api/v1/me/totp/enable', { token: tok, body: { code: '000000' } })).status).toBe(400);
    expect((await s.call('POST', '/api/v1/me/totp/enable', { token: tok, body: { code: totp(setup.body.secret, s.clock.t) } })).status).toBe(200);
    await expect(s.login('kert-a', 'owner@kert-a.hu')).rejects.toThrow(/401/);
    await s.login('kert-a', 'owner@kert-a.hu', { totp: totp(setup.body.secret, s.clock.t) });
  });

  it('can make owners set up the second factor before using the admin API', async () => {
    const t = await startServer({ requireOwnerTotp: true });
    seedTenants(t.db);
    const tok = await t.login('kert-a', 'owner@kert-a.hu');
    expect((await t.call('GET', '/api/v1/admin/species', { token: tok })).body.totpSetup).toBe(true);
    expect((await t.call('GET', '/api/v1/me', { token: tok })).status).toBe(200);
    const editor = await t.login('kert-a', 'editor@kert-a.hu');
    expect((await t.call('GET', '/api/v1/admin/species', { token: editor })).status).toBe(200);
    await t.close();
  });
});

describe('roles and tenants', () => {
  it('lets each role do only its own things', async () => {
    const viewer = await s.login('kert-a', 'viewer@kert-a.hu');
    const editor = await s.login('kert-a', 'editor@kert-a.hu');
    const owner = await s.login('kert-a', 'owner@kert-a.hu');
    expect((await s.call('PUT', '/api/v1/admin/species/LA', { token: viewer, body: LAVENDER })).status).toBe(403);
    expect((await s.call('PUT', '/api/v1/admin/species/LA', { token: editor, body: LAVENDER })).status).toBe(200);
    expect((await s.call('GET', '/api/v1/admin/species/LA', { token: viewer })).body.nameHu).toBe('Levendula');
    expect((await s.call('GET', '/api/v1/admin/users', { token: editor })).status).toBe(403);
    expect((await s.call('GET', '/api/v1/admin/users', { token: owner })).body.users).toHaveLength(3);
    expect((await s.call('GET', '/api/v1/admin/audit', { token: owner })).body.entries.some((e: { action: string }) => e.action === 'denied')).toBe(true);
    expect((await s.call('GET', '/api/v1/admin/species', {})).status).toBe(401);
    expect((await s.call('GET', '/api/v1/admin/species', { token: 'forged' })).status).toBe(401);
  });

  it('never shows or changes another nursery’s data', async () => {
    const a = await s.login('kert-a', 'owner@kert-a.hu');
    const b = await s.login('kert-b', 'owner@kert-b.hu');
    await s.call('PUT', '/api/v1/admin/species/LA', { token: a, body: LAVENDER });
    expect((await s.call('GET', '/api/v1/admin/species', { token: b })).body.species).toEqual([]);
    expect((await s.call('GET', '/api/v1/admin/species/LA', { token: b })).status).toBe(404);
    expect((await s.call('DELETE', '/api/v1/admin/species/LA', { token: b })).status).toBe(404);
    await s.call('PUT', '/api/v1/admin/species/LA', { token: b, body: { ...LAVENDER, nameHu: 'B levendula' } });
    expect((await s.call('GET', '/api/v1/admin/species/LA', { token: a })).body.nameHu).toBe('Levendula');
    // Users of A are not reachable for B's owner by id.
    const aUsers = (await s.call('GET', '/api/v1/admin/users', { token: a })).body.users as { id: number }[];
    for (const u of aUsers) {
      expect((await s.call('PATCH', `/api/v1/admin/users/${u.id}`, { token: b, body: { role: 'viewer' } })).status).toBe(404);
      expect((await s.call('DELETE', `/api/v1/admin/users/${u.id}`, { token: b })).status).toBe(404);
    }
    // A token of A is no good for B's login names either: the tenant comes from the session.
    await s.call('POST', '/api/v1/admin/publish', { token: a, body: {} });
    expect((await s.call('GET', '/api/v1/t/kert-b/catalog/changes?since=0')).body.entries).toEqual([]);
    expect((await s.call('GET', '/api/v1/t/kert-a/catalog/changes?since=0')).body.entries).toHaveLength(1);
  });

  it('keeps at least one owner', async () => {
    const owner = await s.login('kert-a', 'owner@kert-a.hu');
    const users = (await s.call('GET', '/api/v1/admin/users', { token: owner })).body.users as { id: number; role: string }[];
    const me = users.find((u) => u.role === 'owner')!;
    expect((await s.call('PATCH', `/api/v1/admin/users/${me.id}`, { token: owner, body: { role: 'editor' } })).status).toBe(409);
    expect((await s.call('DELETE', `/api/v1/admin/users/${me.id}`, { token: owner })).status).toBe(409);
    const added = await s.call('POST', '/api/v1/admin/users', { token: owner, body: { email: 'uj@kert-a.hu', role: 'editor' } });
    expect(added.status).toBe(200);
    expect((await s.call('POST', '/api/v1/admin/users', { token: owner, body: { email: 'uj@kert-a.hu', role: 'editor' } })).status).toBe(409);
    const ed = users.find((u) => u.role === 'editor')!;
    const edTok = await s.login('kert-a', 'editor@kert-a.hu');
    await s.call('PATCH', `/api/v1/admin/users/${ed.id}`, { token: owner, body: { disabled: true } });
    expect((await s.call('GET', '/api/v1/me', { token: edTok })).status).toBe(401);
  });
});

describe('input checks', () => {
  it('refuses invalid species, bodies and origins', async () => {
    const editor = await s.login('kert-a', 'editor@kert-a.hu');
    const bad = await s.call('PUT', '/api/v1/admin/species/LA', { token: editor, body: { nameHu: '', nameLat: 'x', offers: [{ pot: 'P9', priceHuf: -5 }] } });
    expect(bad.status).toBe(400);
    expect(bad.body.details.join(' ')).toMatch(/nameHu.*priceHuf|priceHuf.*nameHu/s);
    expect((await s.call('PUT', '/api/v1/admin/species/l%3Ca', { token: editor, body: LAVENDER })).status).toBe(400);
    expect((await s.call('PUT', '/api/v1/admin/species/LA', { token: editor, body: 'not json', headers: { 'content-type': 'text/plain' } })).status).toBe(415);
    expect((await s.call('PUT', '/api/v1/admin/species/LA', { token: editor, body: '{bad' })).status).toBe(400);
    expect((await s.call('PUT', '/api/v1/admin/species/LA', { token: editor, body: { ...LAVENDER, notes: 'x'.repeat(70_000) } })).status).toBe(413);
    expect((await s.call('GET', '/api/v1/admin/species', { token: editor, origin: 'https://evil.example' })).status).toBe(403);
    const ok = await s.call('GET', '/api/v1/admin/species', { token: editor, origin: 'https://admin.example' });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://admin.example');
    expect((await s.call('GET', '/api/v1/t/kert-a/catalog/version', { origin: 'https://any.example' })).headers.get('access-control-allow-origin')).toBe('*');
    expect(ok.headers.get('cache-control')).toBe('no-store');
  });

  it('rate limits feedback', async () => {
    const st = [];
    for (let i = 0; i < 6; i++) st.push((await s.call('POST', '/api/v1/feedback', { body: { kind: 'idea', text: `ötlet ${i}` } })).status);
    expect(st).toEqual([200, 200, 200, 200, 200, 429]);
  });
});

describe('catalogue', () => {
  it('imports a price list with a preview, row errors and a commit', async () => {
    const editor = await s.login('kert-a', 'editor@kert-a.hu');
    await s.call('PUT', '/api/v1/admin/species/LA', { token: editor, body: LAVENDER });
    const rows = [
      ['Kód', 'Név', 'Latin név', 'Cserép', 'Ár', 'Készlet'],
      ['LA', '', '', 'P9', '990', '120'], // same
      ['LA', '', '', '2 l', '1 890 Ft', '40'], // new pot
      ['SA', 'Zsálya', 'Salvia nemorosa', 'P9', '1090', ''], // new species
      ['XX', '', '', 'P9', '500', ''], // new species without names
      ['LA', '', '', 'P9', 'sok', ''], // bad price
      ['SA', 'Zsálya', 'Salvia nemorosa', 'P9', '1190', ''], // duplicate
    ];
    const pre = await s.call('POST', '/api/v1/admin/import/preview', { token: editor, body: { rows } });
    expect(pre.status).toBe(200);
    expect(pre.body.rows.map((r: { status: string }) => r.status)).toEqual(['same', 'new', 'new', 'error', 'error', 'error']);
    expect(pre.body.summary).toEqual({ new: 2, update: 0, same: 1, error: 3 });
    expect((await s.call('GET', '/api/v1/admin/species', { token: editor })).body.species).toHaveLength(1); // preview changes nothing
    const done = await s.call('POST', '/api/v1/admin/import/commit', { token: editor, body: { rows } });
    expect(done.body.species).toBe(2);
    const la = (await s.call('GET', '/api/v1/admin/species/LA', { token: editor })).body;
    expect(la.offers).toEqual(
      expect.arrayContaining([
        { pot: '2 l', priceHuf: 1890, stock: 40 },
        { pot: 'P9', priceHuf: 990, stock: 120 },
      ]),
    );
    expect(
      (
        await s.call('POST', '/api/v1/admin/import/preview', {
          token: editor,
          body: {
            rows: [
              ['a', 'b'],
              ['1', '2'],
            ],
          },
        })
      ).status,
    ).toBe(400);
  });

  it('publishes versions and serves the changes since a version', async () => {
    const editor = await s.login('kert-a', 'editor@kert-a.hu');
    expect((await s.call('GET', '/api/v1/t/kert-a/catalog/version')).body).toMatchObject({ version: 0, name: 'A Kertészet' });
    expect((await s.call('POST', '/api/v1/admin/publish', { token: editor, body: {} })).status).toBe(409);
    await s.call('PUT', '/api/v1/admin/species/LA', { token: editor, body: LAVENDER });
    await s.call('PUT', '/api/v1/admin/species/SA', { token: editor, body: { nameHu: 'Zsálya', nameLat: 'Salvia nemorosa', offers: [{ pot: 'P9', priceHuf: 1090 }] } });
    expect((await s.call('POST', '/api/v1/admin/publish', { token: editor, body: {} })).body.version).toBe(1);
    await s.call('PUT', '/api/v1/admin/species/LA', { token: editor, body: { ...LAVENDER, offers: [{ pot: 'P9', priceHuf: 1050, stock: 80 }] } });
    await s.call('DELETE', '/api/v1/admin/species/SA', { token: editor });
    const pending = (await s.call('GET', '/api/v1/admin/publish', { token: editor })).body.pending;
    expect(pending).toEqual({ added: [], changed: ['LA'], removed: ['SA'] });
    expect((await s.call('POST', '/api/v1/admin/publish', { token: editor, body: {} })).body.version).toBe(2);
    const all = (await s.call('GET', '/api/v1/t/kert-a/catalog/changes?since=0')).body;
    expect(all).toMatchObject({ version: 2, since: 0 });
    expect(all.entries.map((e: { code: string }) => e.code)).toEqual(['LA']);
    const delta = (await s.call('GET', '/api/v1/t/kert-a/catalog/changes?since=1')).body;
    expect(delta.entries).toEqual([
      { code: 'LA', version: 2, species: expect.objectContaining({ offers: [{ pot: 'P9', priceHuf: 1050, stock: 80 }] }) },
      { code: 'SA', version: 2, deleted: true },
    ]);
    expect((await s.call('GET', '/api/v1/t/kert-a/catalog/changes?since=2')).body.entries).toEqual([]);
    expect((await s.call('GET', '/api/v1/t/kert-a/catalog/changes?since=99')).body.since).toBe(0);
    expect((await s.call('GET', '/api/v1/t/nincs/catalog/version')).status).toBe(404);
    // Drafts are not public until published.
    await s.call('PUT', '/api/v1/admin/species/NE', { token: editor, body: { nameHu: 'Macskamenta', nameLat: 'Nepeta', offers: [] } });
    expect((await s.call('GET', '/api/v1/t/kert-a/catalog/changes?since=2')).body.entries).toEqual([]);
  });
});

it('deletes the security log and feedback after a year', async () => {
  await s.login('kert-a', 'owner@kert-a.hu');
  await s.call('POST', '/api/v1/feedback', { body: { kind: 'bug', text: 'hiba' } });
  const n = (sql: string) => Number((s.db.prepare(sql).get() as { n: number }).n);
  expect(n('SELECT count(*) AS n FROM audit')).toBeGreaterThan(0);
  purgeOld(s.db, s.clock.t + RETENTION_MS - 1000);
  expect(n('SELECT count(*) AS n FROM audit')).toBeGreaterThan(0);
  expect(n('SELECT count(*) AS n FROM login_codes')).toBe(0); // the spent code
  purgeOld(s.db, s.clock.t + RETENTION_MS + 1000);
  expect(n('SELECT count(*) AS n FROM audit') + n('SELECT count(*) AS n FROM feedback') + n('SELECT count(*) AS n FROM sessions')).toBe(0);
});
