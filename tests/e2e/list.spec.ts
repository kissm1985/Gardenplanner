import { expect, test } from '@playwright/test';

test('plant list: counts, reserve, copy as table, CSV and XLSX download', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  // 11 lavender in a straight row on the strip.
  await page.getByRole('button', { name: 'Sor', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  await page.mouse.click(b.x + 60 * cm, b.y + 100 * cm);
  await page.mouse.click(b.x + 60 * cm, b.y + 500 * cm);
  await expect(page.locator('.group-labels text')).toHaveText('LA × 11');

  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  const row = page.locator('table.bom tbody tr').first();
  await expect(row).toContainText('Levendula');
  await expect(page.locator('.lv-sum')).toContainText('11 tő');
  await expect(page.locator('.lv-sum')).toContainText('13 db');

  await page.getByRole('button', { name: 'Összesítve' }).click();
  await page.getByLabel('Rendelési tartalék százalékban').fill('20');
  await expect(page.locator('.lv-sum')).toContainText('14 db');

  await page.getByRole('button', { name: 'Másolás táblázatként (Excel)' }).click();
  await expect(page.locator('.lv-tools .toast')).toContainText('kimásolva');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const lines = clip.split(/\r?\n/).map((l) => l.split('\t'));
  expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  const col = (h: string) => lines[0].findIndex((x) => x.startsWith(h));
  expect(lines[0].slice(0, 5)).toEqual(['Kód', 'Magyar név', 'Latin név', 'Házoldali sáv (db)', 'Gyepsávos kert (db)']);
  expect(lines[1].slice(0, 3)).toEqual(['LA', 'Levendula', "Lavandula angustifolia 'Munstead'"]);
  expect(lines[1][col('Ültetett')]).toBe('11');
  expect(lines[1][col('Rendelendő')]).toBe('14');
  expect(lines[1][col('Részösszeg')]).toBe(String(14 * 1099));

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV', exact: true }).click()]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'XLSX', exact: true }).click()]);
  expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);

  // Status: mark all lavender ordered, filter.
  await page.getByLabel('Levendula státusza').selectOption('ordered');
  await page.getByRole('button', { name: 'kell', exact: true }).click();
  await expect(page.getByText('Nincs „kell” státuszú tő.')).toBeVisible();
  await page.getByRole('button', { name: 'megrendelve', exact: true }).click();
  await expect(page.locator('table.bom tbody tr').first()).toContainText('Levendula');
});
