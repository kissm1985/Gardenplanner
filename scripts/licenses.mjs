// Collects the licences of the third-party code and fonts that ship inside the built app
// (JavaScript bundle, service worker, font files) into public/third-party-licenses.txt.
// Runs before every build; the About window links to the file.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Packages whose code or files end up in dist/ (types, build tools and test tools do not). */
const SHIPPED = [
  'react',
  'react-dom',
  'scheduler',
  'zustand',
  'idb-keyval',
  'fflate',
  'workbox-window',
  'workbox-core',
  'workbox-precaching',
  'workbox-routing',
  'workbox-strategies',
  '@fontsource-variable/fraunces',
  '@fontsource-variable/outfit',
  '@fontsource/jetbrains-mono',
];

const out = [
  'Gardenly – third-party software and fonts / harmadik féltől származó szoftverek és betűtípusok',
  '',
  'Gardenly itself: © 2026 Kiss-Mihály István, all rights reserved (see LICENSE).',
  'The components below are included under their own licences, reproduced in full.',
  'Az alábbi összetevők a saját licencük alatt szerepelnek; a licencszövegek teljes terjedelmükben.',
  '',
];
for (const name of SHIPPED) {
  const dir = join('node_modules', name);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  if (!file) throw new Error(`No licence file for ${name}`);
  out.push('='.repeat(78), `${name} ${pkg.version} – ${pkg.license}`, pkg.homepage ?? '', '='.repeat(78), '', readFileSync(join(dir, file), 'utf8').trim(), '');
}
writeFileSync('public/third-party-licenses.txt', out.join('\n'));
console.log(`third-party-licenses.txt: ${SHIPPED.length} components`);
