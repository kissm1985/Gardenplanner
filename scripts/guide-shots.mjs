// Screenshots for the user guide (docs/img, docs/img/en): the app on a Pixel 7 at 2× scale, in Hungarian or English.
//   npm run build && npx vite preview --port 4173 --strictPort &
//   node scripts/guide-shots.mjs hu   (→ docs/img)      node scripts/guide-shots.mjs en   (→ docs/img/en)
// Every step is logged; a step that fails is reported and the rest still runs.
import { chromium, devices } from '@playwright/test';

const lang = process.argv[2] === 'en' ? 'en' : 'hu';
const L = (hu, en) => (lang === 'hu' ? hu : en);
const OUT = lang === 'hu' ? 'docs/img' : 'docs/img/en';
const BASE = process.env.BASE_URL ?? 'http://localhost:4173';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: L('hu-HU', 'en-GB'), deviceScaleFactor: 2 });
await ctx.addInitScript((l) => {
  localStorage.setItem('kerttervezo:intro-done', '1');
  localStorage.setItem('kerttervezo:backup-snooze', '9999999999999');
  localStorage.setItem('kerttervezo.lang', l);
  localStorage.setItem('kerttervezo.consent', 'no');
}, lang);
const page = await ctx.newPage();
await page.route(/wikipedia\.org|wikimedia\.org/, (r) => r.abort());
let failed = 0;
const shot = async (name, fn) => {
  try {
    if (fn) await fn();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('ok  ', name);
  } catch (e) {
    failed++;
    console.log('FAIL', name, String(e.message).split('\n')[0]);
  }
};
const dlg = () => page.locator('dialog[open]');
const close = async () => {
  if (await dlg().count()) await dlg().locator('.sheet-head button[aria-label]').last().click();
  await page.waitForTimeout(250);
};
const menu = async (name) => {
  await page.getByRole('button', { name: /^(Menü|Menu)$/ }).click();
  await page.getByRole('menuitem', { name }).click();
};
const box = async () => {
  const r = await page.locator('.area-outline').boundingBox();
  return { r, cm: r.width / 120 };
};

await page.goto(BASE);
await page.getByRole('button', { name: L('Kezdés a kiválasztott sablonokkal', 'Start with the chosen templates') }).click();

// House strip: a row of lavender, a drift of sage, two single plants.
await page.getByRole('button', { name: L('Sor', 'Row'), exact: true }).click();
await page.getByLabel(L('Növény keresése', 'Search plants')).fill('Lavandula angustifolia');
await page.locator('.palette-item').first().click();
let { r, cm } = await box();
await page.mouse.click(r.x + 40 * cm, r.y + 60 * cm);
await page.mouse.click(r.x + 40 * cm, r.y + 380 * cm);
await page.getByRole('button', { name: L('Folt', 'Drift'), exact: true }).click();
await page.getByLabel(L('Növény keresése', 'Search plants')).fill(L('ligeti zsálya', 'woodland sage'));
await page.locator('.palette-item').first().click();
await page.mouse.move(r.x + 10 * cm, r.y + 440 * cm);
await page.mouse.down();
for (const [x, y] of [
  [110, 440],
  [110, 640],
  [10, 640],
  [10, 445],
])
  await page.mouse.move(r.x + x * cm, r.y + y * cm, { steps: 6 });
await page.mouse.up();
await page.getByRole('button', { name: L('Növény', 'Plant'), exact: true }).click();
await page.getByLabel(L('Növény keresése', 'Search plants')).fill('');
await shot('02-paletta');
await page.getByLabel(L('Növény keresése', 'Search plants')).fill(L('macskamenta', 'catmint'));
await page.locator('.palette-item').first().click();
await page.mouse.click(r.x + 60 * cm, r.y + 720 * cm);
await page.mouse.click(r.x + 60 * cm, r.y + 800 * cm);
await page.getByRole('button', { name: L('Kijelölés', 'Select'), exact: true }).click();
await shot('03-terv');
const g = await page.locator('g.plant').first().boundingBox();
await shot('04-infokartya', async () => page.mouse.move(g.x + g.width / 2, g.y + g.height / 2, { steps: 3 }));
await page.mouse.move(5, 300);
await shot('05-kijeloles', async () => page.locator('g.group').first().click());
await page.mouse.click(5, 300).catch(() => {});
await shot('06-figyelmeztetesek', async () => page.locator('.warn-badge').click());
await close();
await shot('07-lista', async () => page.getByRole('button', { name: L('Lista', 'List'), exact: true }).click());
await page.getByRole('button', { name: L('Évszak', 'Season'), exact: true }).click();
await shot('08-evszak', async () =>
  page
    .getByRole('button', { name: L('Nyár', 'Summer') })
    .click()
    .catch(() => {}),
);
await shot('09-negy-evszak', async () => page.getByRole('button', { name: L('4 egymás mellett', '4 side by side') }).click());
await page
  .getByRole('button', { name: L('4 egymás mellett', '4 side by side') })
  .click()
  .catch(() => {});
await page.getByRole('button', { name: L('Kijelölés', 'Select'), exact: true }).click();
await page.locator('.area-outline').waitFor();

// Elements toolbar: drawing a lawn strip.
await page.getByRole('button', { name: L('Elemek', 'Elements'), exact: true }).click();
({ r, cm } = await box());
await shot('10-elemek', async () => {
  await page
    .getByRole('toolbar', { name: L('Elemek', 'Elements') })
    .getByRole('button', { name: L('Gyepsáv', 'Lawn strip') })
    .click();
  for (const [x, y] of [
    [0, 1080],
    [120, 1080],
    [120, 1180],
  ])
    await page.mouse.click(r.x + x * cm, r.y + y * cm);
});
await page
  .getByRole('button', { name: L('Mégse', 'Cancel') })
  .click()
  .catch(() => {});
await page.getByRole('button', { name: L('Kijelölés', 'Select'), exact: true }).click();
await shot('11-teruletek', async () => page.locator('.area-switch').click());
await close();

// The lawn garden: an idea and the variant tree.
await page.locator('.area-switch').click();
await dlg()
  .getByRole('button', { name: L(/Gyepsávos kert/, /Garden with lawn strip/) })
  .first()
  .click();
await page.waitForTimeout(300);
if (await dlg().count()) await close();
await page.locator('.variant-pill').click();
await dlg()
  .getByRole('button', { name: L('✦ Ötlet generálása', '✦ Generate an idea') })
  .click();
await dlg()
  .getByRole('button', { name: L('Ötlet generálása', 'Generate an idea') })
  .click();
await shot('12-otletgenerator');
await dlg()
  .getByRole('button', { name: L('Megnézem a rajzon', 'Show me on the plan') })
  .click();
await shot('13-otlet-terv');
await page.locator('.variant-pill').click();
await dlg()
  .getByRole('button', { name: L(/A terv: műveletek/, /Plan A: actions/) })
  .click();
await dlg()
  .getByRole('button', { name: L('Másolás', 'Copy'), exact: true })
  .click();
await shot('14-valtozatok');
// The planted idea goes on the plan for the visualisation shots.
await dlg()
  .getByRole('button', { name: L('Megnyitás', 'Open'), exact: true })
  .first()
  .click();
await close();

// Project window, the ChatGPT visualisation and the 3D visualisation.
await shot('16-projekt', async () => menu(L(/Projekt: mentés/, /Project: save/)));
await close();
await page.locator('.variant-pill').click();
await dlg()
  .getByRole('button', { name: L('🖼 Látványterv', '🖼 Visualisation') })
  .click();
await shot('17-chatgpt', async () => {
  await dlg()
    .getByRole('button', { name: L('📷 Nézőpont a rajzon', '📷 Viewpoint on the plan') })
    .click();
  const bx = await page.locator('.area-outline').boundingBox();
  const k = bx.width / 500;
  await page.mouse.move(bx.x + 250 * k, bx.y + 1000 * k);
  await page.mouse.down();
  await page.mouse.move(bx.x + 230 * k, bx.y + 600 * k, { steps: 5 });
  await page.mouse.up();
  await page
    .locator('.camera-bar')
    .getByRole('button', { name: L('Kész', 'Done') })
    .click();
  await dlg()
    .locator('.visual-panel > p.mono')
    .first()
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
});
await shot('18-latvanyterv-3d', async () => {
  await dlg()
    .getByRole('button', { name: L('Látványterv készítése', 'Make the visualisation') })
    .click();
  await dlg().locator('.render3d-preview').waitFor({ timeout: 60_000 });
  await dlg().locator('.render3d').scrollIntoViewIfNeeded();
});
await close();

// Start page last, so it shows the projects, the area cards and the examples.
await shot('01-kezdo', async () => {
  await page.locator('button.topbar-brand').click();
  await page.locator('.home-areas').waitFor();
  await page.locator('.home-continue').evaluate((el) => el.scrollIntoView({ block: 'start' }));
});

await browser.close();
console.log(failed ? `${failed} screenshot(s) failed` : 'all screenshots done');
process.exit(failed ? 1 : 0);
