// The app's catalogue sync against a real server: full download, then only the changes; the copy is kept offline.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cachedCatalog, syncCatalog } from '../../src/engine/catalogSync';
import { seedTenants, startServer, type TestServer } from './helpers';

let s: TestServer;
beforeEach(async () => {
  s = await startServer();
  seedTenants(s.db);
});
afterEach(() => s.close());

it('downloads the catalogue, then only the changes', async () => {
  const ed = await s.login('kert-a', 'editor@kert-a.hu');
  const put = (code: string, price: number) =>
    s.call('PUT', `/api/v1/admin/species/${code}`, { token: ed, body: { nameHu: code, nameLat: code, offers: [{ pot: 'P9', priceHuf: price }] } });
  await put('LA', 990);
  await put('SA', 1090);
  await s.call('POST', '/api/v1/admin/publish', { token: ed, body: {} });
  const conn = { server: s.url, tenant: 'kert-a' };
  const r1 = await syncCatalog(conn);
  expect(r1).toMatchObject({ changed: 2, catalog: { version: 1, name: 'A Kertészet' } });
  expect(Object.keys(r1.catalog.species)).toEqual(['LA', 'SA']);

  expect((await syncCatalog(conn)).changed).toBe(0);

  await put('LA', 1050);
  await s.call('DELETE', '/api/v1/admin/species/SA', { token: ed });
  await s.call('POST', '/api/v1/admin/publish', { token: ed, body: {} });
  const r3 = await syncCatalog(conn);
  expect(r3.changed).toBe(2);
  expect(r3.catalog.species.LA.offers[0].priceHuf).toBe(1050);
  expect(r3.catalog.species.SA).toBeUndefined();

  // Offline: the sync fails, the copy on the device stays.
  await s.close();
  await expect(syncCatalog(conn)).rejects.toThrow();
  expect((await cachedCatalog())?.version).toBe(2);
  s = await startServer(); // for afterEach
});

it('refuses an unknown nursery', async () => {
  await expect(syncCatalog({ server: s.url, tenant: 'nincs-ilyen' })).rejects.toThrow(/kertészet|nursery/i);
});
