import { expect, test } from '@playwright/test';

test('acceptance: after the first visit the app opens and saves without internet', async ({ page, context }) => {
  await page.goto('/');
  // Wait until the service worker controls the page (precache done).
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 }).catch(async () => {
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 });
  });
  await page.getByRole('button', { name: /Kezdés/ }).click();

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.area-name')).toHaveText('Házoldali sáv');

  // Edit offline and reload offline: still there.
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 3);
  await expect(page.locator('.meta-count')).toHaveText('1 tő');
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator('.meta-count')).toHaveText('1 tő');
  // Fonts are bundled, not from a CDN.
  expect(await page.evaluate(() => document.fonts.check('16px "Fraunces Variable"'))).toBe(true);
  await context.setOffline(false);
});
