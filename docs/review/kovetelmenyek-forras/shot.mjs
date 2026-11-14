import { chromium } from 'playwright';
import { readdirSync } from 'fs';
const dir = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 2 });
for (const f of readdirSync(dir + '/html').sort()) {
  await p.goto('file://' + dir + '/html/' + f);
  await p.locator('#pg').screenshot({ path: dir + '/png/' + f.replace('.html', '.png') });
}
await b.close();
