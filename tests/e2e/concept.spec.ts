import { expect, test } from '@playwright/test';

test('round area, concept plan with pictograms, idea from preferred plants', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Új terület létrehozása/ }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByLabel('Név').fill('Kör ágyás');
  await dlg.getByLabel('kör / ellipszis').check();
  await dlg.getByLabel(/Átmérő/).fill('400');
  await dlg.getByRole('button', { name: 'Terület létrehozása' }).click();
  await expect(page.locator('ellipse.area-outline')).toHaveCount(1);

  // Pictograms in the palette.
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('kúpvirág');
  await expect(page.locator('.palette-item .picon img').first()).toHaveAttribute('src', /EC/);
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  // Standard plan: a coloured disc with the code.
  await expect(page.locator('.plants .plant-code')).toHaveText('EC');
  await expect(page.locator('.plants image.plant-picto')).toHaveCount(0);

  // Concept plan: the top-view drawing instead.
  await page.getByRole('button', { name: 'Nézet és rétegek' }).click();
  await dlg.getByLabel(/Koncepcióterv/).check();
  await dlg.locator('.sheet-head button[aria-label="Bezárás"]').click();
  await expect(page.locator('.plants image.plant-picto')).toHaveCount(1);
  await expect(page.locator('.plants .plant-code')).toHaveCount(0);

  // Idea from the chosen plants only.
  await page.getByRole('button', { name: 'Kijelölés', exact: true }).click();
  await page.locator('.variant-pill').click();
  await page.getByRole('button', { name: '✦ Ötlet generálása' }).click();
  for (const q of ['levendula', 'kék csenkesz']) {
    await dlg.getByLabel('Növény keresése a listában').fill(q);
    await dlg.locator('.replace-list .plant-row').first().click();
  }
  await expect(dlg.getByLabel('Színvilág')).toBeDisabled();
  await dlg.getByRole('button', { name: 'Ötlet generálása' }).click();
  await expect(dlg.locator('.idea-result')).toContainText('A kiválasztott 2 növényből készült');
  await expect(dlg.locator('.idea-species li')).toHaveCount(2);
  await expect(dlg.locator('.idea-species')).toContainText('Levendula');
  await expect(dlg.locator('.idea-species')).toContainText('Kék csenkesz');
});
