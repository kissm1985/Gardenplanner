import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('first start shows the 3-step intro once', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  const coach = page.getByRole('dialog', { name: 'Bevezető' });
  await expect(coach).toContainText('1 / 3');
  await expect(coach).toContainText('Terület kiválasztása');
  await expect(page.locator('.area-switch')).toHaveClass(/coach-target/);
  await coach.getByRole('button', { name: 'Tovább' }).click();
  await expect(coach).toContainText('Növény elhelyezése');
  await expect(page.locator('.tool[title="Növény"]')).toHaveClass(/coach-target/);
  await coach.getByRole('button', { name: 'Tovább' }).click();
  await expect(coach).toContainText('Lista megtekintése');
  await coach.getByRole('button', { name: 'Kezdjük' }).click();
  await expect(coach).toHaveCount(0);
  await page.reload();
  await page.locator('.home-area').first().click();
  await expect(page.locator('.area-switch')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Bevezető' })).toHaveCount(0);
});
