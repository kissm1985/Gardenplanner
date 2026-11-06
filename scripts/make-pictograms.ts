// Simplified top and side pictograms for species that have no illustrated ones yet (same 128 px style as the bundled
// set): a ring of leaf discs seen from above, a fan of leaves (or trunk and crown for trees) from the side. They are
// placeholders until the illustrated set (PL-DAT-04) covers the species. Run: npx tsx scripts/make-pictograms.ts
import { existsSync, writeFileSync } from 'node:fs';
import { EDIBLE_SEEDS } from '../src/data/plants.edible';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#x27;');
const shade = (hex: string, f: number) =>
  '#' +
  [1, 3, 5]
    .map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');

for (const p of EDIBLE_SEEDS) {
  const leaf = p.seasonColors?.[1] && p.category !== 'rose' && p.category !== 'fruit' ? p.seasonColors[0] : '#6f9a5a';
  const accent = p.color ?? '#6f9a5a';
  const title = `${p.nameHu} — ${p.nameLat}`;
  const top = `${dir('top')}/${p.code}.svg`;
  const side = `${dir('side')}/${p.code}.svg`;
  if (!existsSync(top)) {
    const ring = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return `<ellipse cx="${(64 + 28 * Math.cos(a)).toFixed(2)}" cy="${(64 + 28 * Math.sin(a)).toFixed(2)}" rx="18" ry="18" fill="${i % 2 ? leaf : shade(leaf, 0.85)}"/>`;
    }).join('');
    const dots =
      p.category === 'vegetable' && !p.bloomMonths.length
        ? ''
        : Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2 + 0.3;
            return `<circle cx="${(64 + 20 * Math.cos(a)).toFixed(2)}" cy="${(64 + 20 * Math.sin(a)).toFixed(2)}" r="6" fill="${accent}"/>`;
          }).join('');
    writeFileSync(
      top,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img"><title>${esc(title)} — felülnézet</title>${ring}<circle cx="64" cy="64" r="20" fill="${shade(leaf, 0.75)}"/>${dots}</svg>\n`,
    );
  }
  if (!existsSync(side)) {
    let body: string;
    if (p.isTree) {
      body = `<rect x="60" y="70" width="8" height="44" fill="#7a5a3a"/><ellipse cx="64" cy="50" rx="${p.spreadCm < p.maxHeightCm / 2 ? 18 : 40}" ry="38" fill="${leaf}"/>${p.category === 'fruit' ? [40, 56, 72, 88].map((x, i) => `<circle cx="${x}" cy="${40 + (i % 2) * 18}" r="5" fill="${accent}"/>`).join('') : ''}`;
    } else {
      const h = Math.max(0.45, Math.min(1, p.maxHeightCm / Math.max(p.maxHeightCm, p.spreadCm)));
      body = Array.from({ length: 9 }, (_, i) => {
        const r = -72 + i * 18;
        return `<g transform="translate(${48 + i * 4} 112) rotate(${r})"><path d="M 0 0 Q -14 -14 0 ${(-70 * h).toFixed(1)} Q 14 -14 0 0 Z" fill="${i % 2 ? leaf : shade(leaf, 0.85)}"/></g>`;
      }).join('');
      if (p.bloomMonths.length || p.category === 'fruit') body += [44, 64, 84].map((x) => `<circle cx="${x}" cy="${(112 - 62 * h).toFixed(1)}" r="6" fill="${accent}"/>`).join('');
    }
    writeFileSync(
      side,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img"><title>${esc(title)} — oldalnézet</title><rect x="16" y="112" width="96" height="3" fill="#8a7a5a"/>${body}</svg>\n`,
    );
  }
}
function dir(kind: 'top' | 'side') {
  return `src/assets/pictograms/${kind}`;
}
console.log('done');
