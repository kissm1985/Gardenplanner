// npm run verify:render (spec v0.2 F1): renders every example plan in headless Chromium (WebGL), writes the render,
// the ID buffer and the manifest, checks the manifest against the plan and writes a per-plant test report and a
// run log. Then repeats three deliberately broken renders (+30 cm, missing plant, wrong species) that must FAIL.
// Exit code 0 only if every example PASSes and every negative run FAILs.
//   options: --threshold=0.1 (visibility, % of the image) --tol=20 (cm) --only=key1,key2 --width=2400 --height=1700
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import type { RenderResult } from '../src/render3d/render';
import type { Fault } from '../src/render3d/scene';
import { checkManifest, reportCsv, reportMd, type CheckResult, type Visibility } from '../src/render3d/verify';

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const TOL = Number(arg('tol', '20'));
const THRESHOLD_PCT = Number(arg('threshold', '0.1'));
const WIDTH = Number(arg('width', '2400'));
const HEIGHT = Number(arg('height', '1700'));
const ONLY = arg('only', '').split(',').filter(Boolean);
const OUT = resolve('out');
const DIST = resolve('dist');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim() + (execSync('git status --porcelain').toString().trim() ? ' (+ nem commitolt változások)' : '');
  } catch {
    return 'ismeretlen';
  }
})();

if (!existsSync(join(DIST, 'render.html'))) {
  console.error('dist/render.html hiányzik: futtasd előbb az npm run build parancsot (a verify:render ezt magától megteszi).');
  process.exit(2);
}

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const p = join(DIST, decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) return void res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
  createReadStream(p).pipe(res);
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const pageErrors: string[] = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(`${base}/render.html`);
await page.waitForSelector('#status[data-ready="1"]', { timeout: 30_000 });
const webgl = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
  return gl ? String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : null;
});
if (!webgl) {
  console.error('NEM IGAZOLT: nincs WebGL a headless böngészőben, render nem készült.');
  process.exit(3);
}

const examples = (await page.evaluate(() => window.planterra3d.examples())).filter((e) => !ONLY.length || ONLY.includes(e.key));
const dataUrlToBuf = (u: string) => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');
const version = (await import('../package.json', { with: { type: 'json' } })).default.version;
const threeVersion = (await import('three')).REVISION;

async function renderOne(key: string, fault?: Fault): Promise<RenderResult> {
  return page.evaluate(({ key, fault, w, h }) => window.planterra3d.renderExample(key, { width: w, height: h, fault }), { key, fault, w: WIDTH, h: HEIGHT });
}

function writeRun(dir: string, key: string, area: string, r: RenderResult, log: string[], t0: number): CheckResult {
  mkdirSync(join(dir, 'logs'), { recursive: true });
  const logRef = `logs/run-${stamp}.log`;
  const visibility = new Map<string, Visibility>(Object.entries(r.visibility));
  const res = checkManifest(key, r.instances, r.manifest, { tolCm: TOL, visibility, minShare: THRESHOLD_PCT / 100 });
  writeFileSync(join(dir, 'render.png'), dataUrlToBuf(r.png));
  writeFileSync(join(dir, 'idbuffer.png'), dataUrlToBuf(r.idPng));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(r.manifest, null, 2) + '\n');
  writeFileSync(join(dir, 'test-report.csv'), reportCsv(res, logRef));
  writeFileSync(join(dir, 'test-report.md'), reportMd(res, logRef, { area, commit, tolCm: TOL, minSharePct: THRESHOLD_PCT }));
  log.push(
    `render ${r.width}×${r.height} px, ${Date.now() - t0} ms`,
    `plan: ${r.instances.length} plants · scene: ${r.manifest.plants.length} objects`,
    `check: ${res.verdict} (${res.passed} PASS, ${res.failed} FAIL), tolerance ${TOL} cm`,
    `max deviation: ${Math.max(0, ...res.rows.map((x) => x.deviation_cm ?? 0))} cm`,
    `ID buffer: ${res.visible} visible ≥ ${THRESHOLD_PCT}% of the image, ${res.notProvable} NEM IGAZOLHATÓ – takarás, ${res.tooSmall} NEM IGAZOLHATÓ – perspektíva (kis méret); stray pixels: ${r.strayPixels}`,
    ...res.rows.filter((x) => x.status === 'FAIL').map((x) => `FAIL ${x.test_id}: ${x.reason}`),
    ...(pageErrors.length ? ['page errors:', ...pageErrors.splice(0)] : []),
  );
  writeFileSync(join(dir, logRef), log.join('\n') + '\n');
  return res;
}

const header = [
  `Planterra verify:render · ${new Date().toISOString()}`,
  `commit: ${commit} · app ${version} · three r${threeVersion} · node ${process.version} · WebGL: ${webgl}`,
  `command: ${process.argv.slice(1).join(' ')}`,
];
const summary: { key: string; area: string; shape: string; n: number; verdict: string; failed: number; maxDev: number; visible: number; notProvable: number; tooSmall: number }[] =
  [];

for (const ex of examples) {
  const t0 = Date.now();
  const r = await renderOne(ex.key);
  const res = writeRun(join(OUT, ex.key), ex.key, ex.name, r, [...header, `example: ${ex.key} (${ex.name}, shape ${ex.shape})`], t0);
  summary.push({
    key: ex.key,
    area: ex.name,
    shape: ex.shape,
    n: res.expected,
    verdict: res.verdict,
    failed: res.failed,
    maxDev: Math.max(0, ...res.rows.map((x) => x.deviation_cm ?? 0)),
    visible: res.visible,
    notProvable: res.notProvable,
    tooSmall: res.tooSmall,
  });
  console.log(
    `${res.verdict}  ${ex.key.padEnd(14)} N=${String(res.expected).padStart(3)}  max ${summary.at(-1)!.maxDev} cm  látható ${res.visible}, takarás ${res.notProvable}, kis méret ${res.tooSmall}`,
  );
}

// Negative runs: the same pipeline with a deliberate fault must FAIL.
const negKey = examples[0]?.key ?? 'modern';
const negatives: { name: string; fault: Fault }[] = [
  { name: 'offset-30cm', fault: { kind: 'offset', index: 0, dxCm: 30 } },
  { name: 'missing-plant', fault: { kind: 'drop', index: 1 } },
  { name: 'wrong-species', fault: { kind: 'species', index: 2, species: 'XX' } },
];
const negResults: { name: string; verdict: string; detail: string }[] = [];
for (const n of negatives) {
  const t0 = Date.now();
  const r = await renderOne(negKey, n.fault);
  const res = writeRun(join(OUT, '_negative', n.name), negKey, `${negKey} (${n.name})`, r, [...header, `NEGATIVE ${n.name} on ${negKey}: ${JSON.stringify(n.fault)}`], t0);
  const detail = res.rows.find((x) => x.status === 'FAIL')?.reason ?? '–';
  negResults.push({ name: n.name, verdict: res.verdict, detail });
  console.log(`${res.verdict === 'FAIL' ? 'OK  ' : 'HIBA'}  negatív ${n.name}: ${res.verdict} (${detail})`);
}

await browser.close();
server.close();

const allPass = summary.length > 0 && summary.every((s) => s.verdict === 'PASS');
const negOk = negResults.every((n) => n.verdict === 'FAIL');
const md = [
  '# verify:render – összesítő',
  '',
  ...header.map((h) => `- ${h}`),
  `- Tűrés: ${TOL} cm · láthatósági küszöb: ${THRESHOLD_PCT}% · kép: ${WIDTH}×${HEIGHT} px`,
  '',
  '| Mintaprojekt | Alak | N | Eredmény | Max. eltérés (cm) | Látható | NEM IGAZOLHATÓ – takarás | NEM IGAZOLHATÓ – kis méret |',
  '|---|---|---:|---|---:|---:|---:|---:|',
  ...summary.map((s) => `| ${s.key} (${s.area}) | ${s.shape} | ${s.n} | ${s.verdict} | ${s.maxDev} | ${s.visible} | ${s.notProvable} | ${s.tooSmall} |`),
  '',
  '## Negatív tesztek (elvárt: FAIL)',
  '',
  '| Teszt | Eredmény | Indok |',
  '|---|---|---|',
  ...negResults.map((n) => `| ${n.name} | ${n.verdict} | ${n.detail} |`),
  '',
  `**Összesen: ${allPass && negOk ? 'PASS' : 'FAIL'}** – mintaprojektek: ${allPass ? 'mind PASS' : 'van FAIL'}; negatív tesztek: ${negOk ? 'mind FAIL, ahogy kell' : 'valamelyik nem bukott el'}.`,
  '',
];
writeFileSync(join(OUT, 'summary.md'), md.join('\n'));
writeFileSync(join(OUT, 'summary.json'), JSON.stringify({ header, tolCm: TOL, thresholdPct: THRESHOLD_PCT, summary, negatives: negResults }, null, 2) + '\n');
console.log(`\n${allPass && negOk ? 'PASS' : 'FAIL'} – részletek: out/summary.md`);
process.exit(allPass && negOk ? 0 : 1);
