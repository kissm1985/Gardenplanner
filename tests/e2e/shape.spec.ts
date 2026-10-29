import { expect, test } from '@playwright/test';

test('draw a new free-shape area, then move a corner; templates keep their ground plan', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  // Templates are still there with their plans (wall, paving, lawn).
  await expect(page.locator('.fx-wall')).toHaveCount(1);

  await page.locator('.area-switch').click();
  await page.getByRole('button', { name: '+ Új terület' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByLabel('Név').fill('Sarokágyás');
  await dlg.getByLabel('szabad alak – a terven rajzolom').check();
  await dlg.getByLabel('Rajzterület szélessége (cm)').fill('400');
  await dlg.getByLabel('Rajzterület hossza (cm)').fill('400');
  await dlg.getByLabel('Területtípus').selectOption('shade');
  await dlg.getByRole('button', { name: 'Terület létrehozása' }).click();
  await expect(page.locator('.shape-hint')).toContainText('első sarkára');

  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 400;
  const at = (x: number, y: number) => page.mouse.click(b.x + x * cm, b.y + y * cm);
  await at(20, 20);
  await at(380, 20);
  await at(200, 380);
  await expect(page.locator('.shape-vertex')).toHaveCount(3);
  await expect(page.locator('.shape-editor .count-text').first()).toHaveText(/^3[56]\d cm$/);
  await page.getByRole('button', { name: 'Kész' }).click();
  await expect(page.locator('.shape-bar')).toHaveCount(0);
  await expect(page.locator('polygon.area-outline')).toHaveCount(1);
  const size = async () => (await page.locator('.area-meta').textContent())!.match(/(\d+) × (\d+) cm/)!.slice(1).map(Number);
  const [w0, l0] = await size();
  expect(Math.abs(w0 - 360)).toBeLessThan(8);
  expect(Math.abs(l0 - 360)).toBeLessThan(8);

  // Edit: drag the bottom corner down.
  await page.locator('.area-switch').click();
  await page.locator('.area-card.is-current').getByRole('button', { name: 'Alak szerkesztése' }).click();
  await expect(page.locator('.shape-vertex')).toHaveCount(3);
  await expect(page.locator('.shape-mid')).toHaveCount(3);
  const v = (await page.locator('.shape-vertex').nth(2).boundingBox())!;
  await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2);
  await page.mouse.down();
  await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Kész' }).click();
  const [, l1] = await size();
  expect(l1).toBeGreaterThan(l0 + 20);
});
