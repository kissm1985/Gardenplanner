import { expect, test } from '@playwright/test';

test('Elemek tool: drag a paving, tap a tap, start a lawn — without opening any menu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Elemek', exact: true }).click();
  const bar = page.getByRole('toolbar', { name: 'Elemek' });
  await expect(bar).toBeVisible();

  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  const P = (x: number, y: number) => [b.x + x * cm, b.y + y * cm] as const;

  // Paving: drag a rectangle.
  const before = await page.locator('.fx-paving').count();
  await bar.getByRole('button', { name: 'Burkolat' }).click();
  await expect(page.locator('.palette-hint')).toContainText('húzd végig');
  await page.mouse.move(...P(10, 200));
  await page.mouse.down();
  await page.mouse.move(...P(60, 260), { steps: 4 });
  await page.mouse.move(...P(110, 300), { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('.fx-paving')).toHaveCount(before + 1);
  await expect(page.getByRole('toolbar', { name: 'Kijelölt elem' })).toContainText('Burkolat');

  // Tap: a single tap places it.
  await bar.getByRole('button', { name: 'Csap' }).click();
  await page.mouse.click(...P(60, 700));
  await expect(page.locator('.fx-tap')).toHaveCount(1);

  // Gyepsáv: straight into drawing mode.
  await bar.getByRole('button', { name: 'Gyepsáv' }).click();
  await expect(page.locator('.shape-bar')).toContainText('Gyepsáv');
  await page.mouse.click(...P(0, 500));
  await page.mouse.click(...P(120, 500));
  await page.mouse.click(...P(120, 600));
  await page.getByRole('button', { name: 'Kész' }).click();
  await expect(page.locator('polygon.fx-lawn')).toHaveCount(1);
  await expect(bar).toBeVisible(); // back to the Elemek tool
});
