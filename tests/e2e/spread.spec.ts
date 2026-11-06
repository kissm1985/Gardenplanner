import { expect, test } from '@playwright/test';

test('a selected plant gets its own spread: drag the handle, or type it; the spacing rule follows', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  await page.mouse.click(b.x + 60 * cm, b.y + 300 * cm);
  await page.mouse.click(b.x + 60 * cm, b.y + 360 * cm); // 60 cm apart: fine for 40 cm lavender
  await page.getByRole('button', { name: 'Kijelölés' }).click();
  await expect(page.locator('.warn-badge')).toHaveText('0');

  await page.locator('g.plant').first().click();
  const h = page.locator('.resize-handle');
  await expect(h).toHaveCount(1);
  const hb = (await h.boundingBox())!;
  // Drag the edge out: radius 20 → ~100 cm, i.e. spread ~200 cm.
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 80 * cm, hb.y + hb.height / 2, { steps: 6 });
  await expect(page.locator('.count-text').filter({ hasText: '⌀' })).toContainText(/⌀ (19\d|20\d) cm/);
  await page.mouse.up();
  // A 2 m wide plant 60 cm from the other one is now too close.
  await expect(page.locator('.warn-badge')).not.toHaveText('0');

  await page.getByRole('button', { name: 'Tulajdonságok' }).click();
  const dlg = page.locator('dialog[open]');
  await expect(dlg).toContainText('egyedi méret (a faj: 40 cm)');
  await dlg.getByRole('button', { name: 'Vissza az alapméretre' }).click();
  await expect(dlg).toContainText('a faj mérete');
  await dlg.getByLabel('Kiterjedés (cm)').fill('60');
  await dlg.getByLabel('Kiterjedés (cm)').press('Enter');
  await expect(dlg).toContainText('egyedi méret (a faj: 40 cm)');
  await dlg.getByRole('button', { name: 'Kész' }).click();
});
