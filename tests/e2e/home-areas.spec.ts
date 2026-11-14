import { expect, test } from '@playwright/test';

test('start page: the areas are drawn cards in a strip, below the projects', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-example]').first().click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Eredeti méretben' }).click();
  await page.locator('button.topbar-brand').click();
  await page.screenshot({ path: 'test-results/home-areas.png', fullPage: true });
  const cards = page.locator('.home-areas .home-area');
  await expect(cards).toHaveCount(1);
  await expect(cards.first().locator('svg')).toBeVisible();
  const projects = await page.locator('.home-projects').boundingBox();
  const areas = await page.locator('.home-areas').boundingBox();
  expect(areas!.y).toBeGreaterThan(projects!.y);
});
