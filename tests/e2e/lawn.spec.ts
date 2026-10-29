import { expect, test } from '@playwright/test';

test('draw a lawn strip in an area; plants on it are warned about; reshape it later', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.locator('.area-switch').click();
  await page.locator('.area-card.is-current').getByRole('button', { name: '+ Gyepsáv' }).click();
  await expect(page.locator('.shape-hint')).toContainText('gyep első sarkára');

  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  const at = (x: number, y: number) => page.mouse.click(b.x + x * cm, b.y + y * cm);
  await at(0, 600);
  await at(120, 600);
  await at(120, 800);
  await at(0, 800);
  await page.getByRole('button', { name: 'Kész' }).click();
  await expect(page.locator('polygon.fx-lawn')).toHaveCount(1);

  // A plant on the lawn → warning.
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  await at(60, 700);
  await expect(page.locator('.warn-badge')).toHaveText('1');
  await page.locator('.warn-badge').click();
  await expect(page.locator('dialog[open]')).toContainText('„Gyepsáv” területére esik');
  await page.locator('dialog[open] .sheet-head button').click();

  // The fixture list shows its size and lets me reshape it on the plan.
  await page.getByRole('button', { name: 'Nézet és rétegek' }).click();
  await page.getByRole('button', { name: 'Rögzített elemek' }).click();
  const dlg = page.locator('dialog[open]');
  await expect(dlg).toContainText(/Gyep · x \d+ · y \d+ · 2,[3-6] m²/);
  await dlg.getByRole('button', { name: /^Gyepsáv Gyep/ }).click();
  await dlg.getByRole('button', { name: 'Alak szerkesztése a rajzon' }).click();
  await expect(page.locator('.shape-vertex')).toHaveCount(4);
  await expect(page.locator('.shape-bar')).toContainText('Gyepsáv');
});
