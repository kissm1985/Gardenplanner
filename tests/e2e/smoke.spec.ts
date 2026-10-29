import { expect, test } from '@playwright/test';

test('first launch → templates → canvas → new area persists after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tervezzük meg a kertet' })).toBeVisible();
  await page.getByRole('button', { name: /Kezdés/ }).click();

  // Opens on the first template.
  await expect(page.locator('.area-name')).toHaveText('Házoldali sáv');
  const svg = page.getByRole('application');
  await expect(svg).toBeVisible();
  await expect(page.locator('.area-meta')).toContainText('120 × 1200 cm');

  // Zoom button changes the scale; double-tap fits it back.
  const s0 = Number(await svg.getAttribute('data-scale'));
  await page.getByRole('button', { name: 'Nagyítás', exact: true }).click();
  const s1 = Number(await svg.getAttribute('data-scale'));
  expect(s1).toBeGreaterThan(s0);
  await page.getByRole('button', { name: 'Illesztés a képernyőhöz' }).click();
  expect(Number(await svg.getAttribute('data-scale'))).toBeCloseTo(s0, 3);

  // Create a new area through the sheet.
  await page.locator('.area-switch').click();
  await page.getByRole('button', { name: '+ Új terület' }).click();
  await page.getByLabel('Név').fill('Teszt ágyás');
  await page.getByLabel('Szélesség (cm)').fill('120');
  await page.getByLabel('Hossz (cm)').fill('1200');
  await page.getByRole('button', { name: 'Terület létrehozása' }).click();
  await expect(page.locator('.area-name')).toHaveText('Teszt ágyás');

  // Autosave → survives a reload.
  await page.waitForTimeout(600);
  await page.reload();
  // The last open area comes back.
  await expect(page.locator('.area-name')).toHaveText('Teszt ágyás');
  await page.locator('.area-switch').click();
  const list = page.locator('.area-list');
  await expect(list.getByRole('button', { name: /Teszt ágyás/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /Gyepsávos kert/ })).toBeVisible();
});
