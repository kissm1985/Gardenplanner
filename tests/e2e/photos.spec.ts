import { expect, test, type Page } from '@playwright/test';

// Wikipedia / Commons are mocked: the card must show the photo with author and licence.
async function mockWiki(page: Page) {
  let lookups = 0;
  await page.route(/wikipedia\.org\/w\/api\.php/, (r) => {
    lookups++;
    const hit = r.request().url().includes('Lavandula%20angustifolia');
    return r.fulfill({
      json: hit ? { query: { pages: { '1': { pageimage: 'Lavender.jpg', fullurl: 'https://en.wikipedia.org/wiki/Lavandula_angustifolia' } } } } : { query: { pages: { '-1': { missing: '' } } } },
    });
  });
  await page.route(/commons\.wikimedia\.org\/w\/api\.php/, (r) =>
    r.fulfill({
      json: {
        query: { pages: { '2': { imageinfo: [{ thumburl: 'https://upload.wikimedia.org/lavender-480.png', extmetadata: { Artist: { value: 'Jane Doe' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' } } }] } } },
      },
    }),
  );
  await page.route(/upload\.wikimedia\.org/, (r) => r.fulfill({ path: 'tests/e2e/fixtures-lavender.png', contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }));
  return () => lookups;
}

test('photo in the palette card (hover) and in the plan card; cached after the first look-up', async ({ page }) => {
  const lookups = await mockWiki(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  const item = page.locator('.palette-item').first();
  await item.hover();
  const tip = page.getByRole('tooltip');
  await expect(tip.locator('img')).toBeVisible();
  await expect(tip).toContainText('Jane Doe · CC BY-SA 4.0 · forrás: Wikimedia Commons');
  await expect(tip.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0');
  await expect(tip.getByRole('link', { name: /forrás/ })).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Lavender.jpg');
  await expect.poll(() => tip.locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(48);
  await page.mouse.move(5, 5);
  await expect(tip).toHaveCount(0);
  const n = lookups();

  // Same plant on the plan: photo again, no new look-up.
  await item.click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 3);
  await page.getByRole('button', { name: 'Kijelölés' }).click();
  const pl = (await page.locator('g.plant').first().boundingBox())!;
  await page.mouse.move(pl.x + pl.width / 2, pl.y + pl.height / 2, { steps: 4 });
  await expect(page.getByRole('tooltip').locator('img')).toBeVisible();
  expect(lookups()).toBe(n);
});

test('own photo overrides Wikipedia and can be switched off again', async ({ page }) => {
  await mockWiki(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.getByRole('button', { name: 'Adatbázis' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByLabel(/Keresés/).first().fill('levendula');
  await dlg.locator('.plant-row').first().click();
  await expect(dlg.locator('.photo-field figcaption')).toContainText('Wikipédia · Jane Doe');
  await dlg.locator('input[type=file][accept="image/*"]').setInputFiles('tests/e2e/fixtures-lavender.png');
  await expect(dlg.locator('.photo-field figcaption')).toContainText('Saját fotó');
  await dlg.getByLabel('Fotó forrása / szerzője').fill('Kertem, 2026');
  await dlg.getByRole('button', { name: 'Vissza a Wikipédia-fotóra' }).click();
  await expect(dlg.locator('.photo-field figcaption')).toContainText('Wikipédia');
});
