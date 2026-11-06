import { expect, test } from '@playwright/test';

test('wall, fence and paving can be selected, moved, resized and edited', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  const P = (x: number, y: number) => [b.x + x * cm, b.y + y * cm] as const;
  const bar = page.getByRole('toolbar', { name: 'Kijelölt elem' });

  // The house wall: a tap selects it (Select tool).
  await page.getByRole('button', { name: 'Kijelölés' }).click();
  const wall = page.locator('.fx-wall');
  const wb = (await wall.locator('.fx-body').boundingBox())!;
  await page.mouse.click(wb.x + wb.width / 2, wb.y + wb.height / 2);
  await expect(bar).toContainText('Ház');
  await expect(wall).toHaveClass(/is-selected/);

  // Details: width and label.
  await bar.getByRole('button', { name: 'Adatok' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByLabel('Szélesség (cm)').fill('30');
  await dlg.getByLabel('Felirat').fill('Garázsfal');
  await dlg.getByLabel('Felirat').blur();
  await expect(page.locator('.fx-wall .fx-label')).toHaveText('GARÁZSFAL');
  await expect(wall.locator('.fx-body')).toHaveAttribute('width', '30');
  await dlg.getByRole('button', { name: 'Kész' }).click();
  await dlg.locator('.sheet-head button[aria-label="Bezárás"]').click();

  // The pavement: dragging an unselected one pans the plan; once selected it moves.
  const pave = page.locator('.fx-paving');
  const p0 = (await pave.locator('.fx-body').boundingBox())!;
  await page.mouse.click(p0.x + p0.width / 2, p0.y + 300 * cm);
  await expect(bar).toContainText('Járda');
  await page.mouse.move(p0.x + p0.width / 2, p0.y + 300 * cm);
  await page.mouse.down();
  await page.mouse.move(p0.x + p0.width / 2 + 40 * cm, p0.y + 300 * cm, { steps: 6 });
  await page.mouse.up();
  const px = Number(await pave.locator('.fx-body').getAttribute('x'));
  expect(Math.abs(px - 160)).toBeLessThanOrEqual(2);

  // Resize at the corner handle: undo restores it.
  const h = (await page.locator('.fx-resize-hit').boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 - 600 * cm, { steps: 6 });
  await page.mouse.up();
  const ph = Number(await pave.locator('.fx-body').getAttribute('height'));
  expect(Math.abs(ph - 600)).toBeLessThanOrEqual(25);
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await expect(pave.locator('.fx-body')).toHaveAttribute('height', '1200');

  // A tap on the empty plan clears the selection.
  await page.mouse.click(...P(60, 600));
  await expect(bar).toHaveCount(0);
});

test('new elements: pond and raised bed from the toolbar; type change; plants on the pond warn', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  const P = (x: number, y: number) => [b.x + x * cm, b.y + y * cm] as const;

  await page.getByRole('button', { name: 'Elemek', exact: true }).click();
  const tools = page.getByRole('toolbar', { name: 'Elemek' });
  for (const name of ['Kavicságy', 'Ösvény', 'Kerti tó', 'Kút', 'Tároló', 'Komposztáló', 'Esővízgyűjtő', 'Pad', 'Magaságyás'])
    await expect(tools.getByRole('button', { name })).toBeVisible();

  // Pond: drag a box; drawn as an ellipse.
  await tools.getByRole('button', { name: 'Kerti tó' }).click();
  await page.mouse.move(...P(10, 300));
  await page.mouse.down();
  await page.mouse.move(...P(110, 400), { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.fx-pond ellipse')).toHaveCount(1);

  // Raised bed: a tap places the default size.
  await tools.getByRole('button', { name: 'Magaságyás' }).click();
  await page.mouse.click(...P(60, 800));
  await expect(page.locator('.fx-raisedBed')).toHaveCount(1);

  // A plant on the pond warns; one in the raised bed does not.
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  await page.mouse.click(...P(60, 800));
  await expect(page.locator('.warn-badge')).toHaveText('0');
  await page.mouse.click(...P(60, 350));
  await expect(page.locator('.warn-badge')).toHaveText('1');

  // Type change in Details: the raised bed becomes a shed.
  await page.getByRole('button', { name: 'Kijelölés' }).click();
  const rb = (await page.locator('.fx-raisedBed .fx-body').boundingBox())!;
  await page.mouse.click(rb.x + rb.width / 2, rb.y + 10); // the middle holds the lavender
  await page.getByRole('toolbar', { name: 'Kijelölt elem' }).getByRole('button', { name: 'Adatok' }).click();
  await page.locator('dialog[open]').getByLabel('Típus').selectOption({ label: 'Tároló' });
  await expect(page.locator('.fx-shed')).toHaveCount(1);
  await expect(page.locator('.fx-shed .fx-label')).toHaveText('Tároló');
  await expect(page.locator('.warn-badge')).toHaveText('2');
});
