import { expect, test } from '@playwright/test';

test('plant info card on mouse hover and on long press', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 3);
  await page.getByRole('button', { name: 'Kijelölés' }).click();

  const plant = (await page.locator('g.plant').first().boundingBox())!;
  const cx = plant.x + plant.width / 2;
  const cy = plant.y + plant.height / 2;
  await page.mouse.move(cx - 80, cy - 80);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.mouse.move(cx, cy, { steps: 4 });
  const tip = page.getByRole('tooltip');
  await expect(tip).toContainText('Levendula');
  await expect(tip).toContainText('Lavandula angustifolia');
  await expect(tip).toContainText('45 cm magas');
  await expect(tip).toContainText('jún–júl');
  await page.mouse.move(cx - 80, cy - 80, { steps: 4 });
  await expect(tip).toHaveCount(0);

  // Touch: long press opens the card (Pixel 7 project has touch).
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchEnd', pts: { x: number; y: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await touch('touchStart', [{ x: cx, y: cy }]);
  await page.waitForTimeout(700);
  await expect(page.getByRole('tooltip')).toContainText('Levendula');
  await touch('touchEnd', []);
  // Stays open after lifting the finger; the next touch elsewhere closes it.
  await expect(page.getByRole('tooltip')).toBeVisible();
  await touch('touchStart', [{ x: cx - 70, y: cy - 70 }]);
  await touch('touchEnd', []);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});
