import { expect, test, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await expect(page.getByRole('application')).toBeVisible();
}
const outline = (page: Page) => page.locator('.area-outline').boundingBox();

test('place a plant from the palette, move it, delete it, undo', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Növény' }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.getByRole('option', { name: /Levendula/ }).click();
  await expect(page.locator('.palette-hint')).toContainText('Levendula');

  const box = (await outline(page))!;
  // 120 cm wide strip: tap at x≈60 cm, y≈1/4 of the length.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 4);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('g.plant')).toHaveCount(2);
  await expect(page.locator('g.plant text').first()).toHaveText('LA');

  // Select tool: tap selects, drag moves.
  await page.getByRole('button', { name: 'Kijelölés' }).click();
  const plant = page.locator('g.plant').first();
  const pb = (await plant.boundingBox())!;
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await expect(page.locator('.selbar-count')).toHaveText('1 db');
  const before = await plant.getAttribute('transform');
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.mouse.down();
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2 + 60, { steps: 6 });
  await page.mouse.up();
  expect(await plant.getAttribute('transform')).not.toBe(before);

  // Properties: switch species.
  await page.getByRole('button', { name: 'Tulajdonságok' }).click();
  await page.getByLabel(/^Faj/).selectOption('TH');
  await page.getByRole('button', { name: 'Kész' }).click();
  await expect(page.locator('g.plant.is-selected text')).toHaveText('TH');

  await page.getByRole('button', { name: 'Törlés' }).click();
  await expect(page.locator('g.plant')).toHaveCount(1);
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await expect(page.locator('g.plant')).toHaveCount(2);
});

test('plant database: add a custom plant and find it with a filter', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Növény' }).click();
  await page.getByRole('button', { name: 'Adatbázis' }).click();
  await page.getByRole('button', { name: '+ Új növény' }).click();
  await page.getByLabel(/^Kód/).fill('ZZ');
  await page.getByLabel(/^Magyar név/).fill('Teszt évelő');
  await page.getByLabel(/^Max. magasság/).fill('15');
  await page.getByRole('button', { name: 'Hozzáadás' }).click();
  await page.getByLabel('Keresés az adatbázisban').fill('teszt');
  await expect(page.locator('.plant-row')).toHaveCount(1);
  await expect(page.locator('.plant-row')).toContainText('Teszt évelő');
});
