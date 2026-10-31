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

test('split a drift into single plants (Bontás); they stay in place; undo merges back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Sor', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  await page.mouse.click(b.x + 60 * cm, b.y + 100 * cm);
  await page.mouse.click(b.x + 60 * cm, b.y + 500 * cm); // 11 LA
  await page.getByRole('button', { name: 'Kijelölés' }).click();
  await page.locator('g.group').first().click();
  const bar = page.getByRole('toolbar', { name: 'Kijelölés', exact: true });
  await bar.getByRole('button', { name: 'Bontás' }).click();
  await expect(page.locator('g.plant')).toHaveCount(11);
  await expect(page.locator('g.group')).toHaveCount(0);
  await expect(bar).toContainText('11 db');
  await expect(bar.getByRole('button', { name: 'Bontás' })).toHaveCount(0);
  await expect(page.locator('.meta-count')).toHaveText('11 tő');
  for (const name of ['Tulajdonságok', 'Másolás', 'Csere', 'Törlés']) await expect(bar.getByRole('button', { name, exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await expect(page.locator('g.group')).toHaveCount(1);
  await expect(bar).toHaveCount(0); // the split plants are gone, so is their selection
  expect(errors).toEqual([]);
});
