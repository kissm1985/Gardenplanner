// Start-up JavaScript budget (PL-QA-02): the scripts index.html loads at start, gzipped, must stay under the limit.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const LIMIT_KB = 150;
const html = readFileSync('dist/index.html', 'utf8');
const files = [...new Set([...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1]))];
let total = 0;
for (const f of files) {
  const n = gzipSync(readFileSync(`dist/${f}`)).length;
  total += n;
  console.log(`${(n / 1024).toFixed(1).padStart(7)} KB  ${f}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB  total (limit ${LIMIT_KB} KB)`);
if (total > LIMIT_KB * 1024) {
  console.error(`::error::Start-up JavaScript is ${(total / 1024).toFixed(1)} KB gzip, over the ${LIMIT_KB} KB budget.`);
  process.exit(1);
}
