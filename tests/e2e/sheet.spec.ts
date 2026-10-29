import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 560 } }); // short screen, as with Safari's address bar showing

test('long sheets fit the visible screen: the × stays visible, the body scrolls; pulling the header down closes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: /Projekt: mentés/ }).click();
  const dlg = page.locator('dialog[open]');
  const close = dlg.locator('.sheet-head button');
  const box = (await close.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(560);
  // The body scrolls, the header stays put.
  await dlg.getByRole('button', { name: 'Bevezető újra' }).scrollIntoViewIfNeeded();
  await expect(dlg.getByRole('button', { name: 'Bevezető újra' })).toBeInViewport();
  expect((await close.boundingBox())!.y).toBeCloseTo(box.y, 0);
  await close.click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);

  // Pull-down to close.
  await page.getByRole('button', { name: /Projekt: mentés/ }).click();
  const h = (await page.locator('dialog[open] .sheet-head h2').boundingBox())!;
  await page.mouse.move(h.x + 10, h.y + 5);
  await page.mouse.down();
  await page.mouse.move(h.x + 10, h.y + 140, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});
