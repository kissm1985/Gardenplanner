import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { StaticPlan } from '../canvas/StaticPlan';
import type { Area, PlacedItem, Plant } from '../model/types';

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
export function planSvg(opts: { area: Area; items: PlacedItem[]; plantDb: Plant[]; month?: number | null; caption: string; widthPx?: number }): string {
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
    // Caption band above the plan, in viewBox units.
    const [x, y, w, h] = clone.getAttribute('viewBox')!.split(' ').map(Number);
    const band = w * 0.09;
    clone.setAttribute('viewBox', `${x} ${y - band} ${w} ${h + band}`);
    const ns = 'http://www.w3.org/2000/svg';
    const bg = document.createElementNS(ns, 'rect');
    Object.entries({ x, y: y - band, width: w, height: h + band, fill: getComputedStyle(document.body).backgroundColor }).forEach(([k, v]) => bg.setAttribute(k, String(v)));
    clone.insertBefore(bg, clone.firstChild);
    const t = document.createElementNS(ns, 'text');
    Object.entries({ x: x + w * 0.02, y: y - band * 0.35, 'font-size': band * 0.42, 'font-family': 'Georgia, serif', fill: getComputedStyle(document.body).color }).forEach(([k, v]) =>
      t.setAttribute(k, String(v)),
    );
    t.textContent = opts.caption;
    clone.appendChild(t);
    const px = opts.widthPx ?? 1200;
    clone.setAttribute('width', String(px));
    clone.setAttribute('height', String(Math.round((px * (h + band)) / w)));
    clone.setAttribute('xmlns', ns);
    clone.removeAttribute('style');
    return new XMLSerializer().serializeToString(clone);
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('A kép nem készíthető el.'));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('A PNG nem készíthető el.'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
