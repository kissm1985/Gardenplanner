// Read-only share links: the plan compressed into the URL hash (no server). Kept apart from io.ts so the
// compression library only loads when a link is made or opened.
import { deflateSync, Inflate, strFromU8, strToU8 } from 'fflate';
import type { Project } from '../model/types';
import { chosenItems } from './bom';
import { NOT_A_BACKUP, parseProject, SHARE_PREFIX } from './io';

export { SHARE_PREFIX };
import { t } from '../i18n';

// ---------- share links ----------

const b64url = (u8: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const u8 = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i);
  return u8;
};

export interface ShareOptions {
  /** Leave out the notes of areas, variants and placed items (they may hold addresses or names). */
  withoutNotes?: boolean;
}

/**
 * Only what a viewer needs: chosen variants, the plants they use, settings.
 * Never in the link: background photos, visualisations, and the plants' own photos – a typed photo link would make
 * every viewer's browser contact that server (and see their IP address), an uploaded one would make the link huge.
 */
export function shareSnapshot(p: Project, opts: ShareOptions = {}): Project {
  const strip = opts.withoutNotes;
  const areas = p.areas.map((a) => {
    const v = a.variants.find((x) => x.id === a.chosenVariantId) ?? a.variants[0];
    const { activeVariantId: _a, background: _b, ...rest } = a;
    const { renders: _r, ...plain } = v;
    const variant = strip ? { ...plain, notes: '', items: plain.items.map(({ note: _n, ...it }) => it) } : plain;
    return { ...rest, ...(strip ? { notes: '' } : {}), variants: [variant] };
  });
  const used = new Set(p.areas.flatMap((a) => chosenItems(a).map((i) => i.plantId)));
  const plantDb = p.plantDb.filter((x) => used.has(x.code)).map(({ photoUrl: _u, photoCredit: _c, ...plant }) => plant);
  // Wikipedia photos stay the viewer's own choice on their device.
  const { wikiPhotos: _w, ...settings } = p.settings;
  return { schemaVersion: 1, id: p.id, name: p.name, areas, plantDb, settings };
}

export const encodeShare = (p: Project, opts?: ShareOptions) => b64url(deflateSync(strToU8(JSON.stringify(shareSnapshot(p, opts))), { level: 9 }));

/** A share code longer than this is not ours (real plans stay well below 50 000 characters). */
export const SHARE_MAX_CODE = 400_000;
/** Unpacked size limit: a crafted, tiny link could otherwise unpack to gigabytes and freeze the browser. */
export const SHARE_MAX_BYTES = 20 * 1024 * 1024;

class TooLarge extends Error {}

/** Inflate with a hard limit on the output size, checked while unpacking. */
export function inflateLimited(data: Uint8Array, max: number): Uint8Array {
  const parts: Uint8Array[] = [];
  let total = 0;
  const inf = new Inflate((chunk) => {
    total += chunk.length;
    if (total > max) throw new TooLarge();
    parts.push(chunk);
  });
  inf.push(data, true);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function decodeShare(code: string): Project {
  const tooLarge = () => t('A megosztott link túl nagy, nem nyitható meg.', 'The shared link is too large to open.');
  if (code.length > SHARE_MAX_CODE) throw new Error(tooLarge());
  try {
    return parseProject(strFromU8(inflateLimited(unb64url(code), SHARE_MAX_BYTES)));
  } catch (e) {
    if (e instanceof TooLarge) throw new Error(tooLarge(), { cause: e });
    throw new Error(e instanceof Error && e.message === NOT_A_BACKUP() ? e.message : t('A megosztott link sérült vagy hiányos.', 'The shared link is damaged or incomplete.'), {
      cause: e,
    });
  }
}

export const shareUrl = (p: Project, base = location.href, opts?: ShareOptions) => `${base.split('#')[0]}${SHARE_PREFIX}${encodeShare(p, opts)}`;
