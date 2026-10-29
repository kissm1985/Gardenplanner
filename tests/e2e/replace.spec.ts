import { expect, test } from '@playwright/test';

test('replace every lavender with catmint from the selection bar; undo restores', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Sor', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  await page.mouse.click(b.x + 60 * cm, b.y + 100 * cm);
  await page.mouse.click(b.x + 60 * cm, b.y + 500 * cm); // 11 LA
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.mouse.click(b.x + 60 * cm, b.y + 800 * cm); // 12th LA, single plant
  await expect(page.locator('.meta-count')).toHaveText('12 tő');

  await page.getByRole('button', { name: 'Kijelölés' }).click();
  await page.locator('g.group').first().click();
  await page.getByRole('toolbar', { name: 'Kijelölés' }).getByRole('button', { name: 'Csere' }).click();
  const dlg = page.locator('dialog[open]');
  await expect(dlg.getByLabel('Ezt cserélem')).toHaveValue('LA');
  await dlg.getByLabel('Új növény keresése').fill('macskamenta');
  await dlg.getByRole('option', { name: /Macskamenta/ }).click();
  await expect(dlg.getByRole('status').first()).toContainText('2 elem, 12 tő levendula');
  await dlg.getByRole('button', { name: 'Csere', exact: true }).click();
  await expect(dlg).toContainText('2 elem cserélve: Levendula → Macskamenta');
  await dlg.getByRole('button', { name: 'Kész', exact: true }).click();

  // Catmint has a wider spacing, so the row has fewer plants.
  const count = Number((await page.locator('.meta-count').textContent())!.match(/\d+/)![0]);
  expect(count).toBeLessThan(12);
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await expect(page.locator('.meta-count')).toHaveText('12 tő');
});
