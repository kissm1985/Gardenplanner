// Spec v0.2 F1 / AC5, AC7: on a phone, "Make the visualisation" renders the plan in 3D; PNG, PDF and manifest
// download; the PDF opens and lists every plant of the plan.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('3D visualisation from an example plan on a phone: PNG, PDF with the plant list, manifest', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.locator('[data-example="curving"]').click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Eredeti méretben' }).click();
  await page.getByRole('button', { name: /Változat: A terv/ }).click();
  await page.getByRole('button', { name: '🖼 Látványterv' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByRole('button', { name: 'Látványterv készítése' }).click();
  await expect(dlg.locator('.render3d-preview')).toBeVisible({ timeout: 60_000 });
  await expect(dlg.locator('.render3d')).toContainText('82 növény, 8 faj');

  const [png] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'PNG', exact: true }).click()]);
  const pngBytes = readFileSync((await png.path())!);
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  expect(pngBytes.subarray(1, 4).toString()).toBe('PNG');
  expect(pngBytes.readUInt32BE(16)).toBe(2400); // width from the IHDR chunk

  const [man] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'manifest.json' }).click()]);
  const manifest = JSON.parse(readFileSync((await man.path())!, 'utf8'));
  expect(manifest.plants).toHaveLength(82);
  for (const p of manifest.plants) {
    expect(Math.hypot(p.placed_xy_m[0] - p.required_xy_m[0], p.placed_xy_m[1] - p.required_xy_m[1])).toBeLessThanOrEqual(0.2);
    expect(p.render_object_id).toBe(`obj-${p.plant_id}`);
  }

  const [pdf] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'PDF', exact: true }).click()]);
  const bytes = new Uint8Array(readFileSync((await pdf.path())!));
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  expect(doc.numPages).toBeGreaterThanOrEqual(2);
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) text += (await (await doc.getPage(i)).getTextContent()).items.map((it) => ('str' in it ? it.str : '')).join('\n') + '\n';
  expect(text).toContain('Kanyargó előkerti ágyás');
  const lines = new Set(text.split('\n').map((l) => l.trim()));
  for (const p of manifest.plants) expect(lines.has(p.plant_id), p.plant_id).toBe(true);
});
