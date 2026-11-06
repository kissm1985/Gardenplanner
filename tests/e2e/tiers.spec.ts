import { expect, test } from '@playwright/test';

test('Basic tier: fewer plants, locked tools explain themselves, switching back keeps the plan', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Projekt: mentés, megosztás, nyomtatás' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByRole('radio', { name: /Alap/ }).check();
  await dlg.locator('.sheet-head button[aria-label="Bezárás"]').click();
  // The row tool is locked and says where it is available.
  await page.getByRole('button', { name: 'Sor', exact: true }).click();
  const lock = page.locator('dialog[open]');
  await expect(lock).toContainText('Haladó csomagban');
  await lock.getByRole('button', { name: 'Később' }).click();
  // Only the Basic plant list: lavender yes, Japanese sedge no.
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await expect(page.locator('.palette-item')).not.toHaveCount(0);
  await page.getByLabel('Növény keresése').fill('japán sás');
  await expect(page.locator('.palette-item')).toHaveCount(0);
  // Switching from the lock window unlocks it again.
  await page.getByRole('button', { name: 'Sor', exact: true }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Váltás: Haladó/ })
    .click();
  await page.getByRole('button', { name: 'Sor', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sor', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
