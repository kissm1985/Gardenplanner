import { expect, test } from '@playwright/test';

test('first launch → templates → canvas → new area persists after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tervezzük meg a kertet' })).toBeVisible();
  await page.getByRole('button', { name: /Kezdés/ }).click();

  // Opens on the first template.
  await expect(page.locator('.area-name')).toHaveText('Házoldali sáv');
  const svg = page.getByRole('application');
  await expect(svg).toBeVisible();
  await expect(page.locator('.area-meta')).toContainText('120 × 1200 cm');

  // Zoom button changes the scale; double-tap fits it back.
  const s0 = Number(await svg.getAttribute('data-scale'));
  await page.getByRole('button', { name: 'Nagyítás', exact: true }).click();
  const s1 = Number(await svg.getAttribute('data-scale'));
  expect(s1).toBeGreaterThan(s0);
  await page.getByRole('button', { name: 'Illesztés a képernyőhöz' }).click();
  expect(Number(await svg.getAttribute('data-scale'))).toBeCloseTo(s0, 3);

  // Create a new area through the sheet.
  await page.locator('.area-switch').click();
  await page.getByRole('button', { name: '+ Új terület' }).click();
  await page.getByLabel('Név').fill('Teszt ágyás');
  await page.getByLabel('Szélesség (cm)').fill('120');
  await page.getByLabel('Hossz (cm)').fill('1200');
  await page.getByRole('button', { name: 'Terület létrehozása' }).click();
  await expect(page.locator('.area-name')).toHaveText('Teszt ágyás');

  // Autosave → survives a reload.
  await page.waitForTimeout(600);
  await page.reload();
  // The last open area comes back.
  await expect(page.locator('.area-name')).toHaveText('Teszt ágyás');
  await page.locator('.area-switch').click();
  const list = page.locator('.area-list');
  await expect(list.getByRole('button', { name: /Teszt ágyás/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /Gyepsávos kert/ })).toBeVisible();
});

test('start screen: create my own area instead of the templates', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Saját terület létrehozása/ }).click();
  const dlg = page.locator('dialog[open]');
  await expect(dlg.locator('.sheet-head')).toContainText('Területek');
  await dlg.getByLabel('Név').fill('Előkert');
  await dlg.getByRole('button', { name: 'Terület létrehozása' }).click();
  await expect(page.locator('.area-name')).toHaveText('Előkert');
  // Only the new area exists; the templates are still offered to add later.
  await page.locator('.area-switch').click();
  await expect(page.locator('dialog[open]')).toContainText(/Előkert200 × 400 cm[^]*Sablonból[^]*Házoldali sáv/);
});

test('the built app runs under its Content Security Policy without violations', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { cspViolations: string[] }).cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto('/');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  await page.getByRole('button', { name: /Kezdés/ }).click();
  // Touch the parts that use blobs, data URLs and the service worker: a PNG export and the help.
  await page.getByRole('button', { name: /Projekt: mentés/ }).click();
  await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PNG', exact: true }).click()]);
  await page.locator('dialog[open] .sheet-head button[aria-label="Bezárás"]').click();
  await page.getByRole('button', { name: /Súgó/ }).click();
  await expect(page.locator('dialog[open] .guide img').first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)).toEqual([]);
});

test('a broken saved plan opens the recovery screen: download it, then start over', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await expect(page.locator('.area-outline')).toBeVisible();
  // Corrupt the saved plan the way a bad import or a bug could.
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        const req = indexedDB.open('keyval-store');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('keyval', 'readwrite');
          const store = tx.objectStore('keyval');
          const get = store.get('kerttervezo:project:v1');
          get.onsuccess = () => {
            const p = get.result;
            p.areas[0].variants[0].items = [{ kind: 'drift', id: 'x', plantId: 'LA', polygon: 'oops', spacingCm: 30 }];
            store.put(p, 'kerttervezo:project:v1');
          };
          tx.oncomplete = () => done();
        };
      }),
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Valami elromlott' })).toBeVisible();
  await expect(page.locator('.recovery-msg')).toContainText('hibás pontlista');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Terv letöltése (JSON)' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^gardenly-mentes-.*\.json$/);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /Tiszta lap/ }).click();
  await expect(page.getByRole('heading', { name: 'Tervezzük meg a kertet' })).toBeVisible();
});

test('quick actions: search every feature; the first-plan checklist ticks itself', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Gyors műveletek' }).click();
  const dlg = page.locator('dialog[open]');
  await expect(dlg.locator('.quick-steps li.is-done')).toHaveCount(2); // area and fixtures come with the templates
  await expect(dlg).toContainText('Az első terv lépései · 2/7');
  await dlg.getByLabel('Művelet keresése').fill('csere');
  await expect(dlg.locator('.quick-item')).toHaveCount(1);
  await dlg.getByLabel('Művelet keresése').fill('kép kamera');
  await dlg.locator('.quick-item').first().click();
  await expect(page.locator('dialog[open] .sheet-head')).toContainText('Látványterv');
  await page.locator('dialog[open] .sheet-head button[aria-label="Bezárás"]').click();
  // Opening the list ticks its step.
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await page.getByRole('button', { name: 'Kijelölés', exact: true }).click();
  await page.keyboard.press('Control+k');
  await expect(page.locator('dialog[open]')).toContainText('3/7');
});
