// Lists source files over 400 lines (a hint to split them; it never fails the build).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const LIMIT = 400;
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const big = walk('src')
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('/data/'))
  .map((f) => [f, readFileSync(f, 'utf8').split('\n').length])
  .filter(([, n]) => n > LIMIT)
  .sort((a, b) => b[1] - a[1]);
for (const [f, n] of big) console.log(`::warning file=${f}::${n} lines (over ${LIMIT}; consider splitting)`);
if (!big.length) console.log(`All source files are at most ${LIMIT} lines.`);
