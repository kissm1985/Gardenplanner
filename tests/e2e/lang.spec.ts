import { expect, test } from '@playwright/test';

test('switch to English and back: interface, plant names, warnings, help', async ({ page }) => {
  await page.goto('/');
  // Language button on the start screen.
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("Let's plan the garden");
  await page.getByRole('button', { name: 'Start with the chosen templates' }).click();
  await expect(page.getByRole('button', { name: 'Select', exact: true })).toBeVisible();
  await expect(page.locator('.area-name')).toHaveText('House-side strip');

  // English plant names in the palette and search by English name.
  await page.getByRole('button', { name: 'Plant', exact: true }).click();
  await page.getByLabel('Search plants').fill('catmint');
  await expect(page.locator('.palette-item').first()).toContainText('Catmint');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 3);
  await page.locator('.warn-badge').click();
  await expect(page.locator('dialog[open]')).toContainText('Catmint: grows to 60 cm, the area allows 50 cm.');
  await page.locator('dialog[open] .sheet-head button[aria-label="Close"]').click();

  // Help in English.
  await page.getByRole('button', { name: 'Help: user guide' }).click();
  await expect(page.locator('dialog[open] .guide h1')).toHaveText('Planterra – user guide');
  await page.locator('dialog[open] .sheet-head button[aria-label="Close"]').click();

  // Back to Hungarian from the View menu; the choice is remembered.
  await page.getByRole('button', { name: 'View and layers' }).click();
  await page.locator('dialog[open]').getByLabel('Magyar').click();
  await expect(page.getByRole('button', { name: 'Kijelölés', exact: true })).toBeVisible();
  await page.reload();
  // Default names follow the language: the template area and its elements are Hungarian again.
  await page.locator('.home-area', { hasText: 'Házoldali sáv' }).click();
  await expect(page.getByRole('button', { name: 'Kijelölés', exact: true })).toBeVisible();
  await expect(page.locator('.area-name')).toHaveText('Házoldali sáv');
  await expect(page.locator('.variant-pill')).toContainText('A terv');
  await expect(page.locator('.fx-paving .fx-label')).toHaveText('JÁRDA');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('.area-name')).toHaveText('House-side strip');
  await expect(page.locator('.variant-pill')).toContainText('Plan A');
  await expect(page.locator('.fx-paving .fx-label')).toHaveText('PAVEMENT');
  await expect(page.locator('.fx-wall .fx-label')).toHaveText('HOUSE');
});
