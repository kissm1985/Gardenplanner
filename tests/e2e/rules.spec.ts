import { expect, test } from '@playwright/test';

test('a plant taller than 50 cm in the 50 cm strip warns at once; jump and mute', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  const badge = page.locator('.warn-badge');
  await expect(badge).toHaveText('0');

  await page.getByRole('button', { name: 'Növény' }).click();
  await page.getByLabel('Növény keresése').fill('macskamenta'); // Nepeta, 60 cm
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 3);

  await expect(badge).toHaveText('1');
  await expect(badge).toHaveClass(/is-error/);
  await expect(page.locator('.wm-error')).toHaveCount(1);

  await badge.click();
  await expect(page.locator('.warn-msg')).toContainText('60 cm magasra nő, a terület korlátja 50 cm');
  await page.locator('.warn-main').click(); // jump: selects the plant
  await expect(page.locator('.selbar-count')).toHaveText('1 db');

  await badge.click();
  await page.getByRole('button', { name: 'Elnémítás' }).click();
  await expect(page.getByText('Nincs figyelmeztetés')).toBeVisible();
  await expect(page.getByRole('button', { name: /Elnémítva: 1/ })).toBeVisible();
});

test('fixtures: add a tap, drag it under a plant, get a warning', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Növény' }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  await page.mouse.click(b.x + 60 * cm, b.y + 200 * cm);
  await expect(page.locator('.warn-badge')).toHaveText('0');

  await page.getByRole('button', { name: 'Kijelölés' }).click();
  await page.getByRole('button', { name: 'Nézet és rétegek' }).click();
  await page.getByRole('button', { name: 'Rögzített elemek' }).click();
  await page.getByRole('button', { name: '+ Csap' }).click();
  await expect(page.locator('.selbar-count')).toHaveText('Csap');

  const tap = page.locator('.fx-tap.is-selected rect');
  const tb = (await tap.boundingBox())!;
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 60 * cm, b.y + 200 * cm, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('.warn-badge')).toHaveText('1');
  await page.locator('.warn-badge').click();
  await expect(page.locator('.warn-msg')).toContainText('Csap');
});
