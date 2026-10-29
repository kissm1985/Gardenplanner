// Plant photos from Wikipedia / Wikimedia Commons, looked up by Latin name.
// Only freely licensed images (Wikipedia "page images" are free by default); author and licence are kept for the credit line.

export interface PhotoInfo {
  /** Thumbnail URL (about 480 px wide). */
  src: string;
  /** "Szerző, licenc" for the credit line. */
  credit: string;
  /** Page to open for details (Wikipedia article or Commons file page). */
  pageUrl: string;
}

type Fetch = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/** Wikipedia titles to try for a Latin name: the species without cultivar, then the genus. */
export function photoTitles(nameLat: string): string[] {
  const base = nameLat
    .replace(/['‘’"„”].*$/, '') // cultivar name in quotes
    .replace(/\b(sp|spp|cv|var)\.?(\s|$).*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) return [];
  const words = base.split(' ');
  const out = [base];
  if (words.length > 1) out.push(words[0]);
  return [...new Set(out)];
}

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

interface Pages {
  query?: { pages?: Record<string, { pageimage?: string; fullurl?: string; missing?: string; imageinfo?: Record<string, unknown>[] }> };
}

async function pageImage(fetchFn: Fetch, lang: string, title: string): Promise<{ file: string; pageUrl: string } | null> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages%7Cinfo&inprop=url&piprop=name&titles=${encodeURIComponent(title)}`;
  const res = await fetchFn(url);
  if (!res.ok) return null;
  const data = (await res.json()) as Pages;
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined || !page.pageimage) return null;
  return { file: page.pageimage, pageUrl: page.fullurl ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}` };
}

async function commonsInfo(fetchFn: Fetch, file: string): Promise<{ src: string; credit: string } | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=480&titles=${encodeURIComponent(`File:${file}`)}`;
  const res = await fetchFn(url);
  if (!res.ok) return null;
  const data = (await res.json()) as Pages;
  const info = Object.values(data.query?.pages ?? {})[0]?.imageinfo?.[0] as
    | { thumburl?: string; url?: string; extmetadata?: Record<string, { value?: string }> }
    | undefined;
  const src = info?.thumburl ?? info?.url;
  if (!src) return null;
  const meta = info?.extmetadata ?? {};
  const artist = stripHtml(meta.Artist?.value ?? '') || 'ismeretlen szerző';
  const lic = stripHtml(meta.LicenseShortName?.value ?? '');
  return { src, credit: `${artist}${lic ? `, ${lic}` : ''}` };
}

/** First free photo found for the plant, or null. Network errors propagate (the caller may retry later). */
export async function lookupPhoto(nameLat: string, fetchFn: Fetch = (u) => fetch(u)): Promise<PhotoInfo | null> {
  for (const title of photoTitles(nameLat))
    for (const lang of ['en', 'hu']) {
      const page = await pageImage(fetchFn, lang, title);
      if (!page) continue;
      const img = await commonsInfo(fetchFn, page.file);
      if (img) return { ...img, pageUrl: page.pageUrl };
    }
  return null;
}
