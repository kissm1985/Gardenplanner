import { expect, test } from '@playwright/test';

test('shared plant filters in the palette and the database; area soil', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  const all = await page.locator('.palette-item').count();
  expect(all).toBeGreaterThanOrEqual(55);

  await page.getByRole('button', { name: /^Szűrők/ }).click();
  await page.getByLabel('Mérgező').selectOption('no');
  await page.getByLabel('Fény').selectOption('shade');
  await page.getByLabel('Magasság legfeljebb (cm)').fill('40');
  await page.getByRole('button', { name: 'Kész' }).click();
  await expect(page.getByRole('button', { name: 'Szűrők (3)' })).toBeVisible();
  const names = await page.locator('.palette-name').allTextContents();
  expect(names).toContain('Foltos árvacsalán');
  expect(names).not.toContain('Levendula');
  expect(names).not.toContain('Kis meténg'); // toxic

  // Same filters in the database.
  await page.getByRole('button', { name: 'Adatbázis' }).click();
  await expect(page.locator('.filters summary')).toContainText('3 aktív');
  await expect(page.locator('.plant-row')).toHaveCount(names.length);
  await page.locator('dialog[open]').getByRole('button', { name: /Szűrők törlése/ }).click();
  await expect(page.locator('.plant-row')).toHaveCount(all);
  await page.locator('dialog[open] .sheet-head button').click();

  // Area soil → soil warning for lavender on clay.
  await page.locator('.area-switch').click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Szerkesztés' }).first().click();
  await page.locator('dialog[open]').getByLabel('Talaj').selectOption('clay');
  await page.locator('dialog[open]').getByRole('button', { name: 'Mentés', exact: true }).click();
  await page.locator('dialog[open] .sheet-head button').click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 3);
  await page.locator('.warn-badge').click();
  await expect(page.locator('.warn-msg')).toContainText('agyagos talajba kevésbé való');
});
