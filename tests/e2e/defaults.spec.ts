import { expect, test } from '@playwright/test';

// A fresh device with a Hungarian browser: the app still starts in English.
test.use({ storageState: { cookies: [], origins: [] }, locale: 'hu-HU' });

test('English by default; help opens from the start page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("Let's plan the garden");
  await page.getByRole('button', { name: 'Help: user guide' }).click();
  const dlg = page.locator('dialog[open]');
  await expect(dlg).toHaveAttribute('aria-label', 'Help');
  await expect(dlg.locator('.guide')).toContainText('start page');
  await dlg.locator('.sheet-head button').last().click();
  // The choice of Hungarian is kept.
  await page.getByRole('button', { name: 'Magyar' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tervezzük meg a kertet');
  await expect(page.getByRole('button', { name: 'Súgó: felhasználói útmutató' })).toBeVisible();
});
