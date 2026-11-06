import { expect, test } from '@playwright/test';

test('several projects: continue, new project, switch, rename, duplicate, delete', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await expect(page.locator('.area-outline').first()).toBeVisible();
  // Back home: "Continue" leads back to the open area.
  await page.locator('button.topbar-brand').click();
  await expect(page.locator('.home-continue')).toContainText('Folytatás');
  await expect(page.locator('.home-project')).toHaveCount(1);
  // A second project starts with the new-area form.
  await page.getByRole('button', { name: '+ Új projekt' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByLabel('Név').fill('Hátsó kert');
  await dlg.getByRole('button', { name: 'Terület létrehozása' }).click();
  await page.locator('button.topbar-brand').click();
  await expect(page.locator('.home-project')).toHaveCount(2);
  await expect(page.locator('.home-area')).toHaveText(/Hátsó kert/);
  // Switch back to the first project: its areas come back.
  await expect(page.locator('.home-project', { hasText: 'Kertem 2' })).toHaveCount(1);
  await page.locator('.home-project', { hasText: /^Kertem\d/ }).click();
  await page.locator('button.topbar-brand').click();
  await expect(page.locator('.home-area').first()).toContainText('Házoldali sáv');
  // Rename, duplicate, delete via the ⋯ menu.
  await page
    .getByRole('button', { name: /Műveletek: Kertem/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Átnevezés' }).click();
  await page.getByLabel('Projekt neve').fill('Előkert projekt');
  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(page.locator('.home-project', { hasText: 'Előkert projekt' })).toHaveCount(1);
  await page.getByRole('button', { name: /Műveletek: Előkert projekt/ }).click();
  await page.getByRole('button', { name: 'Másolás' }).click();
  await expect(page.locator('.home-project')).toHaveCount(3);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /Műveletek: Előkert projekt \(másolat\)/ }).click();
  await page.getByRole('button', { name: 'Törlés' }).click();
  await expect(page.locator('.home-project')).toHaveCount(2);
  // Survives a reload.
  await page.reload();
  await expect(page.locator('.home-project')).toHaveCount(2);
});
