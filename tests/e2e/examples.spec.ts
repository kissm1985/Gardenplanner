import { expect, test } from '@playwright/test';

test('example plans on the start page open as a planted area', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.example-card')).toHaveCount(10);
  await expect(page.locator('.example-card .static-plan').first()).toBeVisible();
  await page.locator('[data-example="english"]').click();
  await expect(page.locator('.topbar').getByText('Angolkert')).toBeVisible();
  await expect(page.locator('.plants .plant-code').first()).toBeVisible();
  // Back home: the example is now one of my areas, and a second example adds another.
  await page.locator('button.topbar-brand').click();
  await expect(page.locator('.home-area')).toHaveCount(1);
  await page.locator('[data-example="pollinator"]').click();
  await expect(page.locator('ellipse.area-outline')).toHaveCount(1);
  await page.locator('button.topbar-brand').click();
  await expect(page.locator('.home-area')).toHaveCount(2);
  // English names.
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('[data-example="chateau"]')).toContainText('Château garden');
  await expect(page.locator('.home-area').first()).toContainText('English garden');
});
