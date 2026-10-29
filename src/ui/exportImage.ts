import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { StaticPlan } from '../canvas/StaticPlan';
import type { Area, PlacedItem, Plant } from '../model/types';
import { t } from '../i18n';

const STYLE_PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-opacity',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'letter-spacing',
] as const;

/**
 * Render the plan off-screen and return a standalone SVG string: CSS classes and variables are
 * replaced by computed values, so the file looks the same in any viewer.
 */
export interface LegendRow {
  code: string;
  nameHu: string;
  nameLat: string;
  color: string;
  symbol?: string;
  count: number;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** Inline computed styles so the drawing looks the same outside the app. */
function renderPlan(opts: { area: Area; items: PlacedItem[]; plantDb: Plant[]; month?: number | null }): { inner: string; viewBox: number[] } {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;visibility:hidden;pointer-events:none';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() =>
      root.render(createElement(StaticPlan, { area: opts.area, items: opts.items, plantDb: opts.plantDb, month: opts.month ?? null, labelPx: 800 })),
    );
    const live = host.querySelector('svg')!;
    const clone = live.cloneNode(true) as SVGSVGElement;
    const src = [live, ...live.querySelectorAll('*')];
    const dst = [clone, ...clone.querySelectorAll('*')];
    src.forEach((el, i) => {
      const cs = getComputedStyle(el);
      const out = dst[i] as SVGElement;
      for (const prop of STYLE_PROPS) {
        const v = cs.getPropertyValue(prop);
        if (v && v !== 'normal') out.style.setProperty(prop, v);
      }
      out.removeAttribute('class');
    });
    const viewBox = clone.getAttribute('viewBox')!.split(' ').map(Number);
    return { inner: [...clone.childNodes].map((n) => new XMLSerializer().serializeToString(n)).join(''), viewBox };
  } finally {
    root.unmount();
    host.remove();
  }
}

/**
 * Standalone SVG of the plan with a caption and (optionally) a legend that explains the
 * plant codes. Tall plans get the legend on the right, wide ones below.
 */
export function planSvg(opts: {
  area: Area;
  items: PlacedItem[];
  plantDb: Plant[];
  month?: number | null;
  caption: string;
  legend?: LegendRow[];
  widthPx?: number;
}): string {
  const { inner, viewBox } = renderPlan(opts);
  const [vx, vy, vw, vh] = viewBox;
  const bg = getComputedStyle(document.body).backgroundColor;
  const fg = getComputedStyle(document.body).color;
  const W = opts.widthPx ?? 1200;
  const pad = 24;
  const head = 64;
  const rows = opts.legend ?? [];
  const rowH = 34;
  const legendH = rows.length ? 56 + rows.length * rowH + 36 : 0;
  const tall = vw / vh < 0.9;
  const legendW = rows.length && tall ? 470 : 0;
  // Plan box: fill the width (minus a right-hand legend), keep the aspect ratio.
  const planW = W - 2 * pad - (legendW ? legendW + pad : 0);
  const planH = Math.min(planW * (vh / vw), tall ? 1800 : 1400);
  const planWReal = planH * (vw / vh);
  const H = Math.round(head + Math.max(planH, legendW ? legendH : 0) + (rows.length && !legendW ? legendH + pad : 0) + pad);
  const lx = legendW ? pad + planWReal + pad : pad;
  const ly = legendW ? head : head + planH + pad;
  const mono = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";
  const serif = "'Fraunces', Georgia, serif";
  const total = rows.reduce((n, r) => n + r.count, 0);
  const legend = rows.length
    ? `<g transform="translate(${lx} ${ly})">
<text x="0" y="22" font-family="${mono}" font-size="15" fill="${fg}" letter-spacing="1">${t('JELMAGYARÁZAT', 'LEGEND')}</text>
${rows
  .map((r, i) => {
    const y = 44 + i * rowH;
    const shape =
      r.symbol === 'square'
        ? `<rect x="2" y="${y + 2}" width="24" height="24" rx="4" fill="${r.color}" stroke="#3a443c" stroke-opacity=".4"/>`
        : r.symbol === 'triangle'
          ? `<path d="M14 ${y + 2} L27 ${y + 26} H1 Z" fill="${r.color}" stroke="#3a443c" stroke-opacity=".4"/>`
          : r.symbol === 'diamond'
            ? `<path d="M14 ${y} L28 ${y + 14} L14 ${y + 28} L0 ${y + 14} Z" fill="${r.color}" stroke="#3a443c" stroke-opacity=".4"/>`
            : `<circle cx="14" cy="${y + 14}" r="13" fill="${r.color}" stroke="#3a443c" stroke-opacity=".4"/>`;
    return `${shape}
<text x="38" y="${y + 19}" font-family="${mono}" font-size="15" font-weight="600" fill="${fg}">${esc(r.code)}</text>
<text x="76" y="${y + 19}" font-family="${serif}" font-size="16" fill="${fg}">${esc(clip(r.nameHu, 24))} <tspan font-style="italic" font-size="13" fill-opacity=".65">${esc(clip(r.nameLat, 30))}</tspan></text>
<text x="${(legendW || W - 2 * pad) - 4}" y="${y + 19}" text-anchor="end" font-family="${mono}" font-size="14" fill="${fg}">${t(`${r.count} tő`, `${r.count} plants`)}</text>`;
  })
  .join('\n')}
<text x="0" y="${44 + rows.length * rowH + 22}" font-family="${mono}" font-size="14" fill="${fg}" fill-opacity=".7">${t(`Összesen ${total} tő · ${rows.length} faj`, `Total ${total} plants · ${rows.length} species`)}</text>
</g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${bg}"/>
<text x="${pad}" y="42" font-family="${serif}" font-size="28" fill="${fg}">${esc(opts.caption)}</text>
<svg x="${pad}" y="${head}" width="${planWReal}" height="${planH}" viewBox="${vx} ${vy} ${vw} ${vh}">${inner}</svg>
${legend}
</svg>`;
}

export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error(t('A kép nem készíthető el.', 'The image could not be made.')));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error(t('A PNG nem készíthető el.', 'The PNG could not be made.')))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
