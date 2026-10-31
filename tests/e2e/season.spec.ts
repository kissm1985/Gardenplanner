import { expect, test } from '@playwright/test';

test('season view: colours follow the month; four seasons side by side', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  for (const [q, y] of [['levendula', 150], ['ligeti', 300]] as const) {
    await page.getByLabel('Növény keresése').fill(q);
    await page.locator('.palette-item').first().click();
    await page.mouse.click(b.x + 60 * cm, b.y + y * cm);
  }

  await page.getByRole('button', { name: 'Évszak', exact: true }).click();
  const la = page.locator('g.plant').nth(0).locator('.plant-body');
  const sa = page.locator('g.plant').nth(1).locator('.plant-body');

  await page.getByRole('button', { name: 'Nyár', exact: true }).click();
  await expect(la).toHaveAttribute('fill', '#8b6bb5');
  await expect(page.locator('.season-hint')).toContainText('Virágzik: levendula, ligeti zsálya');

  await page.getByRole('button', { name: 'Tél', exact: true }).click();
  await expect(sa).toHaveAttribute('fill-opacity', '0.35');
  await expect(la).toHaveAttribute('fill-opacity', '0.94');
  await expect(page.locator('.season-hint')).toContainText('Télen is díszít: levendula');

  // Month slider: August, lavender no longer in bloom.
  await page.getByLabel('Hónap').fill('8');
  await expect(page.locator('.month-slider .mono')).toHaveText('augusztus');
  await expect(la).not.toHaveAttribute('fill', '#8b6bb5');

  await page.getByRole('button', { name: '4 egymás mellett' }).click();
  await expect(page.locator('.four-cell')).toHaveCount(4);
  await expect(page.locator('.four-cell figcaption b')).toHaveText(['Tavasz', 'Nyár', 'Ősz', 'Tél']);
  await expect(page.locator('.four-cell').nth(1).locator('.plant-body').first()).toHaveAttribute('fill', '#8b6bb5');
});
