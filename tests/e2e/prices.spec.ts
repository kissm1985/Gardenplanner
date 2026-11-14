// Spec v0.2 F3 / AC11: prices are hidden by default; the "Show prices" setting brings them back in the list,
// the exports and the print document; the choice survives a reload.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { menuItem } from './helpers';

async function plantRowAndOpenList(page: Page) {
  await page.getByRole('button', { name: 'Sor', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  await page.mouse.click(b.x + 60 * cm, b.y + 100 * cm);
  await page.mouse.click(b.x + 60 * cm, b.y + 500 * cm);
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await expect(page.locator('table.bom tbody tr').first()).toContainText('Levendula');
}

async function csvText(page: Page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV', exact: true }).click()]);
  return readFileSync((await dl.path())!, 'utf8');
}

async function setPrices(page: Page, on: boolean) {
  await menuItem(page, 'Nézet és rétegek');
  const box = page.locator('dialog[open]').getByRole('checkbox', { name: /Árak megjelenítése/ });
  if (on) await box.check();
  else await box.uncheck();
  await page.locator('dialog[open] .sheet-head button[aria-label="Bezárás"]').click();
}

test('prices: hidden by default everywhere, shown after switching on, kept after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await plantRowAndOpenList(page);

  // OFF (default): no price in the list, the totals, the CSV or the print document.
  const list = page.locator('.list-view, main').first();
  await expect(page.locator('table.bom thead')).not.toContainText('Egységár');
  await expect(page.locator('table.bom')).not.toContainText('Részösszeg');
  await expect(page.locator('.lv-sum')).not.toContainText('Becsült költség');
  await expect(page.locator('.prices-off')).toBeVisible();
  const csvOff = await csvText(page);
  expect(csvOff).toContain('Levendula');
  expect(csvOff).not.toMatch(/Egységár|Részösszeg|Ft\b/);
  await expect(list).not.toContainText(/\d\s?Ft\b/);

  // ON: the price columns and the estimated cost are back.
  await setPrices(page, true);
  await expect(page.locator('table.bom thead')).toContainText('Egységár');
  await expect(page.locator('.lv-sum')).toContainText('Becsült költség');
  expect(await csvText(page)).toMatch(/Egységár \(Ft\).*Részösszeg \(Ft\)/);

  // Kept after a reload.
  await page.reload();
  await page.locator('.home-continue').click();
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await expect(page.locator('table.bom thead')).toContainText('Egységár');

  // OFF again, also after a reload; the print document has no cost either.
  await setPrices(page, false);
  await page.reload();
  await page.locator('.home-continue').click();
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await expect(page.locator('table.bom thead')).not.toContainText('Egységár');
  await menuItem(page, /Projekt: mentés/);
  await page.getByRole('button', { name: 'Nyomtatás / mentés PDF-be' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-page').first()).toContainText('Levendula');
  await expect(page.locator('.print-page').first()).not.toContainText(/Költség|Egységár|Részösszeg|\d\s?Ft\b/);
});
