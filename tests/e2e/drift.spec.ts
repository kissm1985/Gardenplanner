import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, tool: 'Folt' | 'Sor', plant: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: tool, exact: true }).click();
  await page.getByLabel('Növény keresése').fill(plant);
  await page.locator('.palette-item').first().click();
  return (await page.locator('.area-outline').boundingBox())!;
}

test('fill a drift on the 120 × 1200 cm strip and see the count', async ({ page }) => {
  const t0 = Date.now();
  const b = await setup(page, 'Folt', 'csenkesz');
  const cm = b.width / 120;
  // Freehand loop around 10…110 × 50…250 cm.
  const loop = [[10, 50], [110, 50], [110, 250], [10, 250], [10, 52]];
  await page.mouse.move(b.x + loop[0][0] * cm, b.y + loop[0][1] * cm);
  await page.mouse.down();
  for (const [x, y] of loop.slice(1)) await page.mouse.move(b.x + x * cm, b.y + y * cm, { steps: 10 });
  await page.mouse.up();
  const label = page.locator('.group-labels text');
  await expect(label).toHaveText(/^FE × \d+$/);
  const n = Number((await label.textContent())!.split('× ')[1]);
  // 100 × 200 cm at 25 cm spacing: ~32 (grid) … ~37 (staggered)
  expect(n).toBeGreaterThan(25);
  expect(n).toBeLessThan(45);
  await expect(page.locator('.area-meta')).toContainText(`${n} tő`);
  expect(Date.now() - t0).toBeLessThan(20_000);

  // Change the count via properties → spacing is solved.
  await page.getByRole('button', { name: 'Kijelölés' }).click();
  await page.mouse.click(b.x + 60 * cm, b.y + 150 * cm);
  await page.getByRole('button', { name: 'Tulajdonságok' }).click();
  await page.getByLabel('Darabszám').fill('12');
  await page.getByLabel('Darabszám').press('Enter');
  // Either exact, or the panel explains the nearest possible count.
  const got = Number(await page.getByLabel('Darabszám').inputValue());
  if (got !== 12) await expect(page.getByRole('status').filter({ hasText: 'legközelebbi' })).toBeVisible();
  await page.getByRole('button', { name: 'Kész' }).click();
  await expect(label).toHaveText(`FE × ${got}`);
  expect(Math.abs(got - 12)).toBeLessThanOrEqual(3);
});

test('straight row by tapping both ends', async ({ page }) => {
  const b = await setup(page, 'Sor', 'levendula');
  const cm = b.width / 120;
  await page.mouse.click(b.x + 60 * cm, b.y + 100 * cm);
  await expect(page.locator('.canvas-toast')).toContainText('végpontjára');
  await page.mouse.click(b.x + 60 * cm, b.y + 500 * cm);
  // 400 cm at 40 cm → 11 plants
  await expect(page.locator('.group-labels text')).toHaveText('LA × 11');
});
