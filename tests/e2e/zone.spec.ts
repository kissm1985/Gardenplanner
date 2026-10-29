import { expect, test } from '@playwright/test';

test('zone fill: pick plants, draw a region, it is planted at random; again replaces it; undo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.locator('.variant-pill').click();
  await page.getByRole('button', { name: '✦ Ötlet generálása' }).click();
  let dlg = page.locator('dialog[open]');
  await dlg.getByRole('tab', { name: 'Kijelölt rész, saját listából' }).click();
  const search = dlg.getByLabel('Növény keresése a listában');
  for (const q of ['levendula', 'ligeti zsálya', 'menyecskeszem']) {
    await search.fill(q);
    await dlg.locator('.replace-list').getByRole('option').first().click();
  }
  await expect(dlg.getByLabel('Kiválasztott növények').locator('li')).toHaveCount(3);
  await dlg.getByRole('button', { name: 'Rész kijelölése a rajzon' }).click();
  await expect(page.locator('.shape-bar')).toContainText('Kitöltendő rész');

  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  for (const [x, y] of [[0, 100], [120, 100], [120, 500], [0, 500]]) await page.mouse.click(b.x + x * cm, b.y + y * cm);
  await page.getByRole('button', { name: 'Kész' }).click();

  dlg = page.locator('dialog[open]');
  await expect(dlg.locator('.idea-result')).toContainText(/Kitöltve: \d+ tő/);
  const n1 = Number((await dlg.locator('.idea-result b').textContent())!.match(/\d+/)![0]);
  expect(n1).toBeGreaterThan(15);
  await expect(dlg.locator('.idea-species li')).toHaveCount(3);
  await dlg.getByRole('button', { name: 'Újra ugyanide' }).click();
  const n2 = Number((await dlg.locator('.idea-result b').textContent())!.match(/\d+/)![0]);
  await dlg.getByRole('button', { name: 'Megnézem a rajzon' }).click();
  await expect(page.locator('.meta-count')).toHaveText(`${n2} tő`); // the first fill was replaced
  await expect(page.locator('.warn-badge')).toHaveText('0');
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await expect(page.locator('.meta-count')).toHaveText(`${n1} tő`);
});
