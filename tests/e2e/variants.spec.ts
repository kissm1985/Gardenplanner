import { expect, test } from '@playwright/test';

test('variants: copy, edit B, choose, compare', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Sor', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  await page.mouse.click(b.x + 60 * cm, b.y + 100 * cm);
  await page.mouse.click(b.x + 60 * cm, b.y + 500 * cm); // 11 LA

  const pill = page.locator('.variant-pill');
  await expect(pill).toContainText('A terv ★');
  await pill.click();
  await page.getByRole('button', { name: 'Másolás', exact: true }).click();
  await expect(page.locator('.variant-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Bezárás' }).last().click();
  await expect(pill).toContainText('B terv');
  await expect(pill).not.toContainText('★');

  // Add catmint (60 cm) to B → height error only in B.
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('macskamenta');
  await page.locator('.palette-item').first().click();
  await page.mouse.click(b.x + 60 * cm, b.y + 700 * cm);
  await expect(page.locator('.warn-badge')).toHaveText('1');

  // List still shows A (chosen): 11 plants.
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await page.getByRole('button', { name: 'Házoldali sáv', exact: true }).click();
  await expect(page.locator('.lv-sum')).toContainText('11 tő');

  await page.getByRole('button', { name: 'Kijelölés' }).click();
  await pill.click();
  await page.getByRole('button', { name: 'Összehasonlítás' }).click();
  const cols = page.locator('.cmp-col');
  await expect(cols).toHaveCount(2);
  await expect(cols.nth(0).locator('.cmp-stats')).toContainText('11');
  await expect(cols.nth(1).locator('.cmp-stats')).toContainText('12');
  await expect(cols.nth(1).locator('.cmp-stats')).toContainText('1 hiba');
  await expect(page.locator('.cmp-table tr.is-diff')).toContainText('Macskamenta');

  // Choose B → list follows.
  await page.getByRole('button', { name: '← Vissza a tervhez' }).click();
  await pill.click();
  await page.getByRole('button', { name: 'Legyen a választott' }).click();
  await page.getByRole('button', { name: 'Bezárás' }).last().click();
  await expect(pill).toContainText('B terv ★');
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await page.getByRole('button', { name: 'Házoldali sáv', exact: true }).click();
  await expect(page.locator('.lv-sum')).toContainText('12 tő');
});
