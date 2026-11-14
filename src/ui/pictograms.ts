// Plant pictograms (Planterra set v1.0): a side view for pickers and data cards, a top view for the
// concept plan. One SVG per built-in species code, bundled and cached offline like any other asset.
import type { Plant } from '../model/types';

const TOP = import.meta.glob('../assets/pictograms/top/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const SIDE = import.meta.glob('../assets/pictograms/side/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const path = (dir: 'top' | 'side', code: string) => `../assets/pictograms/${dir}/${code}.svg`;

/** Codes that have a pictogram. */
export const PICTOGRAM_CODES: string[] = Object.keys(TOP)
  .map((k) => /\/([A-Z0-9]+)\.svg$/.exec(k)?.[1] ?? '')
  .filter(Boolean)
  .sort();

/** The pictogram a plant uses: its own choice, else the one with its code (none for most own plants). */
export const pictogramOf = (p: Plant): string | null => {
  const code = p.pictogram ?? p.code;
  return TOP[path('top', code)] ? code : null;
};

export const sideUrl = (p: Plant): string | null => {
  const c = pictogramOf(p);
  return c ? SIDE[path('side', c)] : null;
};

export const topUrl = (p: Plant): string | null => {
  const c = pictogramOf(p);
  return c ? TOP[path('top', c)] : null;
};

// An SVG drawn into a PNG (export, print preview) cannot load linked files, so exports embed the
// top views as data URIs. They are fetched once per code and kept for the session.
const embedded = new Map<string, string>();

const toDataUri = (svg: string) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

/** Make the top views of these plants embeddable (call before building an export). */
export async function embedTopViews(plants: Plant[]): Promise<void> {
  await Promise.all(
    plants.map(async (p) => {
      const url = topUrl(p);
      const key = pictogramOf(p);
      if (!url || !key || embedded.has(key)) return;
      if (url.startsWith('data:')) return void embedded.set(key, url);
      try {
        const res = await fetch(url);
        if (res.ok) embedded.set(key, toDataUri(await res.text()));
      } catch {
        /* offline and not cached: the export falls back to the symbol */
      }
    }),
  );
}

/** The top view to draw: embedded when available (exports), else the asset URL. */
export const topHref = (p: Plant, embeddedOnly = false): string | null => {
  const key = pictogramOf(p);
  if (!key) return null;
  return embedded.get(key) ?? (embeddedOnly ? null : topUrl(p));
};
