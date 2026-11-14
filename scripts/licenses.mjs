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
  // 3D visualisation and its PDF (loaded only when used)
  'three',
  'pdf-lib',
  '@pdf-lib/fontkit',
  '@pdf-lib/standard-fonts',
  '@pdf-lib/upng',
  'pako',
  'tslib',
  'dejavu-fonts-ttf',
];

/** Packages that ship no licence file; their package.json names the licence, the standard text is reproduced. */
const MIT = (holder) =>
  `MIT License\n\nCopyright (c) ${holder}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
const NO_FILE = { '@pdf-lib/fontkit': MIT('Devon Govett (fontkit) and Andrew Dillon (pdf-lib fork)') };

const out = [
  'Planterra – third-party software and fonts / harmadik féltől származó szoftverek és betűtípusok',
  '',
  'Planterra itself: © 2026 Kiss-Mihály István, all rights reserved (see LICENSE).',
  'The components below are included under their own licences, reproduced in full.',
  'Az alábbi összetevők a saját licencük alatt szerepelnek; a licencszövegek teljes terjedelmükben.',
  '',
];
for (const name of SHIPPED) {
  const dir = join('node_modules', name);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  if (!file && !NO_FILE[name]) throw new Error(`No licence file for ${name}`);
  const text = file ? readFileSync(join(dir, file), 'utf8').trim() : NO_FILE[name];
  out.push('='.repeat(78), `${name} ${pkg.version} – ${typeof pkg.license === 'string' ? pkg.license : 'see below'}`, pkg.homepage ?? '', '='.repeat(78), '', text, '');
}
writeFileSync('public/third-party-licenses.txt', out.join('\n'));
console.log(`third-party-licenses.txt: ${SHIPPED.length} components`);
