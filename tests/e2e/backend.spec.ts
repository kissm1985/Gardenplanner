// Pro tier end to end: the nursery edits its catalogue in the admin page, imports a price list and publishes;
// a planner connects to the nursery and gets its species and prices in the plant list.
import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import { BACKEND_DB } from '../../playwright.config';
import { menuItem } from './helpers';

const BASE = 'http://localhost:8787';

async function lastCode(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const db = new DatabaseSync(BACKEND_DB, { readOnly: true });
    const r = db.prepare('SELECT subject FROM outbox WHERE recipient = ? ORDER BY id DESC LIMIT 1').get(email) as { subject: string } | undefined;
    db.close();
    if (r) return r.subject.match(/\d{6}/)![0];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('no code mailed');
}

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('kerttervezo:intro-done', '1');
    localStorage.setItem('kerttervezo:backup-snooze', '9999999999999');
    localStorage.setItem('kerttervezo.lang', 'hu');
    localStorage.setItem('kerttervezo.tier', 'profi');
  });
}

test('a nursery publishes its catalogue and a planner gets its prices', async ({ page }) => {
  await setup(page);
  await page.goto(`${BASE}/admin.html`);
  await page.getByLabel('Kertészet azonosítója').fill('zoldkert');
  await page.getByLabel('E-mail-cím').fill('tulaj@zoldkert.hu');
  await page.getByRole('button', { name: 'Belépési kód kérése' }).click();
  await expect(page.getByRole('status')).toContainText('10 percen belül');
  await page.getByLabel('Az e-mailben kapott 6 jegyű kód').fill(await lastCode('tulaj@zoldkert.hu'));
  await page.getByRole('button', { name: 'Belépés' }).click();
  await expect(page.locator('.admin-head')).toContainText('Zöld Kert Kertészet');

  // A species by hand.
  await page.getByRole('button', { name: 'Új faj' }).click();
  await page.getByLabel('Kód (2–6 betű/szám)').fill('LA');
  await page.getByLabel('Magyar név').fill('Levendula');
  await page.getByLabel('Latin név').fill('Lavandula angustifolia');
  await page.getByLabel('Ár', { exact: true }).fill('1234');
  await page.getByLabel('Készlet', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Mentés' }).click();
  await expect(page.locator('.admin-table')).toContainText(/1\s?234 Ft \(50\)/);

  // A price list with one good and one bad row.
  await page.getByRole('tab', { name: 'Árlista importálása' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'arlista.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Kód;Név;Latin név;Cserép;Ár;Készlet\nZK1;Zöld Kert rózsa;Rosa ‘Zöld Kert’;C5;5900;7\nZK2;;;C5;abc;\n'),
  });
  await expect(page.locator('.admin-summary')).toContainText('új: 1');
  await expect(page.locator('.admin-summary')).toContainText('hiba: 1');
  await page.getByRole('button', { name: /Alkalmazás \(1 sor\)/ }).click();
  await expect(page.getByRole('status')).toContainText('1 faj frissült');

  await page.getByRole('tab', { name: /Közzététel/ }).click();
  await page.getByRole('button', { name: 'Közzététel (2 változás)' }).click();
  await expect(page.getByRole('status')).toContainText('1. változat');

  // The owner's security log shows the sign-in and the changes.
  await page.getByRole('tab', { name: 'Napló' }).click();
  await expect(page.locator('.admin-table')).toContainText('publish');
  await expect(page.locator('.admin-table')).toContainText('login.ok');

  // The planner connects.
  await page.goto(`${BASE}/`);
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await menuItem(page, /Projekt: mentés/);
  await page.getByLabel('Kertészet azonosítója').fill('zoldkert');
  await page.getByRole('button', { name: 'Kapcsolódás' }).click();
  const panel = page.locator('.nursery-panel');
  await expect(panel).toContainText('Frissítve: 1. változat, 2 változás.');
  await expect(panel).toContainText('Zöld Kert Kertészet');
  await expect(panel).toContainText('Új faj a listában: 1; frissített ár/készlet: 1.');
  await page.getByRole('button', { name: 'Frissítés' }).click();
  await expect(panel).toContainText('A katalógus naprakész (1. változat).');
});

test('the admin API refuses wrong codes and other origins', async ({ request }) => {
  const r = await request.post(`${BASE}/api/v1/auth/verify`, { data: { tenant: 'zoldkert', email: 'tulaj@zoldkert.hu', code: '000000' } });
  expect(r.status()).toBe(401);
  const foreign = await request.get(`${BASE}/api/v1/admin/species`, { headers: { origin: 'https://evil.example' } });
  expect(foreign.status()).toBe(403);
  const pub = await request.get(`${BASE}/api/v1/t/zoldkert/catalog/version`);
  expect((await pub.json()).name).toBe('Zöld Kert Kertészet');
  // The static app gets the security headers too.
  const html = await request.get(`${BASE}/admin.html`);
  expect(html.headers()['x-frame-options']).toBe('DENY');
});
