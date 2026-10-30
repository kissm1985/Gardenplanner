import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Sor', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  await page.mouse.click(b.x + 60 * cm, b.y + 100 * cm);
  await page.mouse.click(b.x + 60 * cm, b.y + 500 * cm); // 11 LA
  await expect(page.locator('.meta-count')).toHaveText('11 tő');
  await page.getByRole('button', { name: 'Kijelölés' }).click();
  return { b, cm };
}
const menu = (page: Page) => page.getByRole('button', { name: /Projekt: mentés/ }).click();

test('acceptance: JSON backup restores the project exactly', async ({ page }) => {
  await setup(page);
  await menu(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Teljes mentés (JSON)' }).click()]);
  const path = await dl.path();
  const saved = JSON.parse(readFileSync(path!, 'utf8'));
  await page.locator('dialog[open] .sheet-head button[aria-label="Bezárás"]').click();

  // Change the plan, then restore.
  await page.locator('g.group').first().click();
  await page.getByRole('button', { name: 'Törlés', exact: true }).click();
  await expect(page.locator('.meta-count')).toHaveText('0 tő');
  await menu(page);
  page.once('dialog', (d) => d.accept());
  await page.locator('dialog[open] input[type=file]').setInputFiles(path!);
  await expect(page.locator('.meta-count')).toHaveText('11 tő');

  // And it is exactly what was saved (re-export compares equal).
  await menu(page);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Teljes mentés (JSON)' }).click()]);
  expect(JSON.parse(readFileSync((await dl2.path())!, 'utf8'))).toEqual(saved);
});

test('share link opens a read-only page on another device', async ({ page, browser, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await setup(page);
  await menu(page);
  await page.getByRole('button', { name: 'Csak olvasható link' }).click();
  const link = await page.getByLabel('Megosztható link').inputValue();
  expect(link).toContain('#view=');
  const other = await browser.newContext();
  const q = await other.newPage();
  await q.goto(link);
  await expect(q.getByText('Csak olvasható nézet')).toBeVisible();
  await expect(q.locator('.ro-kpi')).toContainText('11 tő');
  await expect(q.locator('.static-plan .plant-body').first()).toBeVisible();
  await expect(q.locator('.area-switch')).toHaveCount(0); // no editor
  await other.close();
});

test('print document: one page per area plus summary; images download', async ({ page }) => {
  await setup(page);
  await menu(page);
  const [png] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PNG', exact: true }).click()]);
  expect(png.suggestedFilename()).toBe('hazoldali-sav-a-terv.png');
  const [svg] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'SVG', exact: true }).click()]);
  const svgText = readFileSync((await svg.path())!, 'utf8');
  expect(svgText).toContain('<svg');
  expect(svgText).not.toContain('var(--'); // colours resolved
  // Legend explains the codes.
  expect(svgText).toContain('JELMAGYARÁZAT');
  expect(svgText).toContain('Levendula');
  expect(svgText).toContain('11 tő');
  await page.getByRole('button', { name: 'Nyomtatás / mentés PDF-be' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-page')).toHaveCount(3);
  await expect(page.locator('.print-page').first()).toContainText('Házoldali sáv');
  await expect(page.locator('.print-page').first().locator('.print-table')).toContainText('Levendula');
  await expect(page.locator('.print-page').first().locator('.print-seasons figure')).toHaveCount(4);
  await expect(page.locator('.toolbar')).toBeHidden();
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
});

test('background image: upload, then set the scale with two points', async ({ page }) => {
  const { b, cm } = await setup(page);
  await page.getByRole('button', { name: 'Nézet és rétegek' }).click();
  await page.getByRole('button', { name: 'Rögzített elemek' }).click();
  await page.locator('dialog[open] input[type=file][accept="image/*"]').setInputFiles('public/icon-512.png');
  await expect(page.locator('.bg-image')).toHaveAttribute('width', '120');
  await page.getByRole('button', { name: 'Méretarány két ponttal' }).click();
  await expect(page.locator('.canvas-toast')).toContainText('első');
  page.once('dialog', (d) => d.accept('240')); // the 60 cm we tap is really 240 cm
  await page.mouse.click(b.x + 0 * cm + 2, b.y + 50 * cm);
  await page.mouse.click(b.x + 60 * cm, b.y + 50 * cm);
  // ×≈4 (the taps land a few px off, so allow a range).
  await expect.poll(async () => Number(await page.locator('.bg-image').getAttribute('width'))).toBeGreaterThan(440);
  expect(Number(await page.locator('.bg-image').getAttribute('width'))).toBeLessThan(540);
});

test('ChatGPT visualisation: brief is copied and the plan PNG downloads', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await setup(page);
  await menu(page);
  await page.getByRole('button', { name: 'Látványterv megnyitása' }).click();
  await page.locator('dialog[open]').getByLabel('Évszak').selectOption('2');
  await page.getByRole('button', { name: 'Leírás másolása' }).click();
  const text = await page.getByLabel('Leírás a látványtervhez').inputValue();
  expect(text).toContain('fotórealisztikus');
  expect(text).toContain('**LA – Levendula**');
  expect(text).toContain('11 tő');
  expect(text).toContain('ősz');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Rajz PNG-ben' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/latvanyterv\.png$/);
});

test('Látványterv: camera on the plan, style and mood, send in one step, finished image kept with the variant', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.route(/chatgpt\.com/, (r) => r.fulfill({ body: '<title>ChatGPT</title>', contentType: 'text/html' }));
  await setup(page);
  // From the variants window.
  await page.getByRole('button', { name: /Változat: A terv/ }).click();
  await page.getByRole('button', { name: '🖼 Látványterv' }).click();
  const dlg = page.locator('dialog[open]');
  await expect(dlg.locator('.sheet-head')).toContainText('Látványterv');

  // Place the camera: press on the strip, drag up along it.
  await dlg.getByRole('button', { name: '📷 Nézőpont a rajzon' }).click();
  await expect(page.locator('.camera-bar')).toBeVisible();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  await page.mouse.move(b.x + 60 * cm, b.y + 700 * cm);
  await page.mouse.down();
  await page.mouse.move(b.x + 60 * cm, b.y + 400 * cm, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.camera .camera-cone')).toHaveCount(1);
  await page.locator('.camera-bar').getByRole('button', { name: 'Kész' }).click();
  await expect(dlg.locator('.sheet-head')).toContainText('Látványterv');
  await expect(dlg).toContainText('Kamera a rajzon');

  await dlg.getByLabel('Stílus').selectOption('watercolor');
  await dlg.getByLabel('Napszak').selectOption('sunset');
  await dlg.getByLabel('Időjárás').selectOption('overcast');

  // Send: on this (share-less) browser it copies, downloads and opens ChatGPT.
  const [dl, tab] = await Promise.all([page.waitForEvent('download'), context.waitForEvent('page'), dlg.getByRole('button', { name: 'Küldés a ChatGPT-nek' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/latvanyterv\.png$/);
  await tab.waitForLoadState();
  expect(tab.url()).toContain('chatgpt.com');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('akvarell');
  expect(text).toContain('alkonyat');
  expect(text).toContain('borult');
  expect(text).toContain('rajzon jelölt nézőpontból');
  expect(text).toMatch(/felfelé/);
  expect(text).toMatch(/Előtér: [^\n]*LA levendula/);

  // Upload the finished image: it stays with the variant.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
  await dlg.getByLabel('Látványkép feltöltése').setInputFiles({ name: 'kert.png', mimeType: 'image/png', buffer: png });
  await expect(dlg.locator('.render-grid img')).toHaveCount(1);
  await expect(page.locator('.camera')).toHaveCount(1); // shown while the window is open
  await dlg.locator('.sheet-head button[aria-label="Bezárás"]').click();
  // Back on the plan the camera is hidden; the View layer can show it.
  await expect(page.locator('.camera')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nézet és rétegek' }).click();
  await page.locator('dialog[open]').getByLabel(/Látványterv nézőpontja/).check();
  await expect(page.locator('.camera')).toHaveCount(1);
  await page.locator('dialog[open] .sheet-head button[aria-label="Bezárás"]').click();
  await page.getByRole('button', { name: /Változat: A terv/ }).click();
  await expect(page.locator('dialog[open] .variant-tree')).toContainText('🖼 1');
});
