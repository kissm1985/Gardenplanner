import { expect, test } from '@playwright/test';

test('help: ? opens the guide offline, table of contents jumps, windows open their own chapter', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Súgó: felhasználói útmutató' }).click();
  const dlg = page.locator('dialog[open]');
  await expect(dlg.locator('.guide h1')).toHaveText('Kerttervező – felhasználói útmutató');
  // Pictures are bundled.
  const img = dlg.locator('.guide img').first();
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(100);
  // Table of contents link scrolls to the chapter.
  await dlg.locator('.guide a', { hasText: 'Növénylista, rendelés, költség' }).click();
  await expect(dlg.locator('[id="13-növénylista-rendelés-költség"]')).toBeInViewport();
  await dlg.locator('.sheet-head button[aria-label="Bezárás"]').click();

  // From a window: its own chapter.
  await page.locator('.variant-pill').click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Súgó: Változatok' }).click();
  await expect(page.locator('dialog[open]')).toHaveAttribute('aria-label', 'Súgó');
  await expect(page.locator('dialog[open] [id="10-változatok"]')).toBeInViewport();
});
