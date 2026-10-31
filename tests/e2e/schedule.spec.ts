import { expect, test } from '@playwright/test';

test('planting schedule: window, checklist ticks persist; care calendar and mulch', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Folt', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  await page.mouse.move(b.x + 5 * cm, b.y + 100 * cm);
  await page.mouse.down();
  for (const [x, y] of [[115, 100], [115, 400], [5, 400], [6, 102]]) await page.mouse.move(b.x + x * cm, b.y + y * cm, { steps: 8 });
  await page.mouse.up();

  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await page.getByRole('button', { name: /Ültetési menetrend és gondozás/ }).click();
  await page.getByLabel('Kezdés').fill('2026-10-20');
  await page.getByLabel('Befejezés').fill('2026-10-26');
  await page.getByRole('button', { name: 'Menetrend készítése' }).click();
  await expect(page.locator('.day')).toHaveCount(7);
  const first = page.locator('.task').first();
  await expect(first).toContainText('Talaj-előkészítés – Házoldali sáv');
  await expect(page.locator('.warn').first()).toContainText('első fagy');
  await first.locator('input').check();
  await expect(page.locator('.sched-progress .mono')).toContainText('1 /');

  await page.waitForTimeout(600);
  await page.reload();
  await page.locator('.home-area').first().click();
  await page.getByRole('button', { name: 'Nézet és rétegek' }).click();
  await page.getByRole('button', { name: 'Menetrend és gondozás' }).click();
  await expect(page.locator('.task').first().locator('input')).toBeChecked();
  await expect(page.getByLabel('Kezdés')).toHaveValue('2026-10-20');

  await page.getByRole('tab', { name: 'Gondozási naptár' }).click();
  await expect(page.locator('.month-card')).toHaveCount(12);
  await expect(page.locator('.month-card', { hasText: 'április' })).toContainText('Levendula: az új hajtások');
  await expect(page.locator('.month-card', { hasText: 'október' })).toContainText('diólevél'); // the lawn garden has a walnut

  await page.getByRole('tab', { name: 'Mulcs' }).click();
  await expect(page.locator('.mulch-card').first()).toContainText('Világos apró kavics');
  await expect(page.locator('.mulch-card').first()).toContainText('Levendula');
});
