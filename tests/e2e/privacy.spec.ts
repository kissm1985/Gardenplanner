import { menuItem } from './helpers';
import { expect, test } from '@playwright/test';

test('Wikipedia photos stay off until turned on: no request to Wikimedia before', async ({ page }) => {
  const hits: string[] = [];
  await page.route(/wiki(pedia|media)\.org/, (r) => {
    hits.push(r.request().url());
    return r.fulfill({ json: { query: { pages: { '-1': { missing: '' } } } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().hover();
  await expect(page.getByRole('tooltip')).toContainText('Növényfotók a Wikipédiáról');
  await page.waitForTimeout(300);
  expect(hits).toEqual([]);
});

test('the share link warns about its content and can leave notes out; served with security headers', async ({ page }) => {
  const res = await page.goto('/');
  const h = res!.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await menuItem(page, 'Projekt: mentés, megosztás, nyomtatás');
  const dlg = page.locator('dialog[open]');
  await expect(dlg.locator('.share-notice')).toContainText('csevegőkben');
  await expect(dlg.getByLabel('Jegyzetek nélkül')).toBeVisible();
});
