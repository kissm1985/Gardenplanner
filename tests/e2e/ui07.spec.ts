import { expect, test } from '@playwright/test';
import { menuItem } from './helpers';

test('simple mode, larger text, tree crowns, feedback', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  // Simple mode: fewer tools, the rest under More.
  await menuItem(page, 'Nézet és rétegek');
  const dlg = page.locator('dialog[open]');
  await dlg.getByLabel(/Egyszerű mód/).check();
  await dlg.getByLabel('Nagyobb betűk').check();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'large');
  await dlg.getByLabel(/körvonal/).check();
  await dlg.locator('.sheet-head button[aria-label="Bezárás"]').click();
  await expect(page.locator('.toolbar .tool[data-tool="row"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Több' }).click();
  await expect(page.locator('.toolbar .tool[data-tool="row"]')).toHaveCount(1);
  // Placing still lands where tapped with the larger text on.
  await page.locator('.toolbar .tool[data-tool="plant"]').click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').first().boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  const dot = (await page.locator('.plants .plant').first().boundingBox())!;
  expect(Math.abs(dot.x + dot.width / 2 - (b.x + b.width / 2))).toBeLessThan(12);
  // Feedback prepares an e-mail when no server is connected.
  await menuItem(page, 'Visszajelzés');
  const fb = page.locator('dialog[open]');
  await fb.getByLabel(/Mi történt/).fill('A lista nem frissült.');
  await expect(fb.getByRole('button', { name: 'Küldés' })).toBeEnabled();
});
