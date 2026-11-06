import { expect, test } from '@playwright/test';

test('variants: copy, edit B, choose, compare', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.getByRole('button', { name: 'Sor', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('levendula');
  await page.locator('.palette-item').first().click();
  const b = (await page.locator('.area-outline').boundingBox())!;
  const cm = b.width / 120;
  await page.mouse.click(b.x + 60 * cm, b.y + 100 * cm);
  await page.mouse.click(b.x + 60 * cm, b.y + 500 * cm); // 11 LA

  const pill = page.locator('.variant-pill');
  await expect(pill).toContainText('A terv');
  await pill.click();
  await page.getByRole('button', { name: 'A terv: műveletek' }).click();
  await page.getByRole('button', { name: 'Másolás', exact: true }).click();
  await expect(page.locator('.variant-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Bezárás' }).last().click();
  await expect(pill).toContainText('B terv');

  // Add catmint (60 cm) to B → height error only in B.
  await page.getByRole('button', { name: 'Növény', exact: true }).click();
  await page.getByLabel('Növény keresése').fill('macskamenta');
  await page.locator('.palette-item').first().click();
  await page.mouse.click(b.x + 60 * cm, b.y + 700 * cm);
  await expect(page.locator('.warn-badge')).toHaveText('1');

  // The list shows the plan on screen, which is the chosen one: B, 12 plants.
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await expect(page.locator('.lv-head .eyebrow')).toContainText('látható terv: B terv');
  await expect(page.locator('.lv-sum')).toContainText('12 tő');

  await page.getByRole('button', { name: 'Kijelölés' }).click();
  await pill.click();
  await page.getByRole('button', { name: 'Összehasonlítás' }).click();
  const cols = page.locator('.cmp-col');
  await expect(cols).toHaveCount(2);
  // The open (chosen) variant B comes first.
  await expect(cols.nth(0).locator('.cmp-stats')).toContainText('12');
  await expect(cols.nth(0).locator('.cmp-stats')).toContainText('1 hiba');
  await expect(cols.nth(1).locator('.cmp-stats')).toContainText('11');
  await expect(page.locator('.cmp-table tr.is-diff')).toContainText('Macskamenta');

  // Opening A makes it the chosen one again: the list follows.
  await page.getByRole('button', { name: '← Vissza a tervhez' }).click();
  await pill.click();
  await expect(page.locator('dialog[open] .variant-card.is-active')).toContainText('★ a rajzon');
  await page.getByRole('button', { name: 'Megnyitás' }).click();
  await expect(pill).toContainText('A terv');
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await expect(page.locator('.lv-sum')).toContainText('11 tő');
});

test('idea generator: new variant with a fitting composition, "Újra" replaces it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.locator('.variant-pill').click();
  await page.getByRole('button', { name: '✦ Ötlet generálása' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByLabel('Színvilág').selectOption('purple-silver');
  await dlg.getByRole('button', { name: 'Ötlet generálása' }).click();
  await expect(dlg.locator('.idea-result')).toContainText('Ötlet 1: Lila–ezüst');
  await expect(dlg.locator('.idea-result')).toContainText('nincs figyelmeztetés');
  const first = await dlg.locator('.idea-species').innerText();
  await dlg.getByRole('button', { name: 'Újra (ebbe a változatba)' }).click();
  await expect(dlg.locator('.idea-result')).toContainText('Ötlet 1');
  await dlg.getByRole('button', { name: 'Megnézem a rajzon' }).click();
  await expect(page.locator('.variant-pill')).toContainText('Ötlet 1');
  await expect(page.locator('g.group').first()).toBeVisible();
  expect(first.length).toBeGreaterThan(0);
});

test('variant tree: copies nest, folders group, move and collapse', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.locator('.variant-pill').click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByRole('button', { name: 'A terv: műveletek' }).click();
  await dlg.getByRole('button', { name: 'Másolás' }).click(); // B under A
  const tree = dlg.getByRole('tree');
  await expect(tree.getByRole('treeitem', { name: /A terv/ }).getByRole('group')).toContainText('B terv');

  page.once('dialog', (d) => d.accept('Tavaszi'));
  await dlg.getByRole('button', { name: '+ Mappa' }).click();
  await expect(tree).toContainText('📁 Tavaszi');

  // Move B into the folder.
  const b = tree.getByRole('treeitem', { name: /^B terv/ });
  await b.getByRole('button', { name: 'B terv: műveletek' }).click();
  await b.getByRole('button', { name: 'Áthelyezés' }).click();
  await b.getByLabel('Áthelyezés ide').selectOption({ label: '📁 Tavaszi' });
  const folder = tree.getByRole('treeitem', { name: /Tavaszi/ });
  await expect(folder.getByRole('group')).toContainText('B terv');

  await folder.getByRole('button', { name: 'Tavaszi becsukása' }).click();
  await expect(folder).toContainText('1 változat');
  await expect(folder.getByRole('group')).toHaveCount(0);
});

test('idea generator: plant types to use; impossible ones are disabled', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.locator('.variant-pill').click();
  await page.getByRole('button', { name: '✦ Ötlet generálása' }).click();
  const dlg = page.locator('dialog[open]');
  // House strip: max 50 cm → no hedges, shrubs or trees.
  await expect(dlg.getByLabel(/Sövény/)).toBeDisabled();
  await expect(dlg.getByLabel(/Fák/)).toBeDisabled();
  await expect(dlg.getByLabel(/Évelők/)).toBeChecked();
  for (const l of [/Évelők/, /Díszfüvek/, /Talajtakarók/]) await dlg.getByLabel(l).uncheck();
  await expect(dlg.getByRole('button', { name: 'Ötlet generálása' })).toBeDisabled();
  await dlg.getByLabel(/Talajtakarók/).check();
  await dlg.getByRole('button', { name: 'Ötlet generálása' }).click();
  await expect(dlg.locator('.idea-result')).toContainText('Ötlet 1');
  await expect(dlg.locator('.idea-result')).toContainText('nincs figyelmeztetés');
});

test('idea generator: mixed planting without same neighbours, extra distance', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Kezdés/ }).click();
  await page.locator('.variant-pill').click();
  await page.getByRole('button', { name: '✦ Ötlet generálása' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByLabel(/Vegyes ültetés/).check();
  await dlg.getByLabel('Plusz távolság a tövek között (cm)').fill('10');
  await dlg.getByRole('button', { name: 'Ötlet generálása' }).click();
  await expect(dlg.locator('.idea-result')).toContainText('azonos faj nem kerül egymás mellé');
  await expect(dlg.locator('.idea-result')).toContainText('10 cm-rel nagyobb');
  await expect(dlg.locator('.idea-result')).toContainText('nincs figyelmeztetés');
  // The zone fill tab has the same two options.
  await dlg.getByRole('tab', { name: /Kijelölt rész/ }).click();
  await expect(dlg.getByLabel(/Azonos növény ne kerüljön egymás mellé/)).toBeEnabled();
  await expect(dlg.getByLabel('Plusz távolság a tövek között (cm)')).toHaveValue('0');
  await dlg.getByLabel(/kisebb csoportokban/).check();
  await expect(dlg.getByLabel(/Azonos növény ne kerüljön egymás mellé/)).toBeDisabled();
});
