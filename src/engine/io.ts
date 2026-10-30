// Project import/export (SPEC §4.9): full JSON backup, and a compact read-only share code
// that travels in the URL hash (no server).
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import type { Project } from '../model/types';
import { chosenItems } from './bom';
import { t } from '../i18n';

export const exportJson = (p: Project) => JSON.stringify(p, null, 2);

const NOT_A_BACKUP = () => t('Ez nem Gardenly-projektmentés (hiányzó vagy ismeretlen verzió).', 'This is not a Gardenly backup (missing or unknown version).');

/** Parse and sanity-check a project backup; throws a readable message on failure. */
export function parseProject(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t('A fájl nem érvényes JSON.', 'The file is not valid JSON.'));
  }
  const p = data as Project;
  if (!p || typeof p !== 'object' || p.schemaVersion !== 1) throw new Error(NOT_A_BACKUP());
  if (!Array.isArray(p.areas) || !Array.isArray(p.plantDb)) throw new Error(t('A mentésből hiányoznak a területek vagy a növénylista.', 'The backup has no areas or no plant list.'));
  for (const a of p.areas) {
    if (!a.id || !Array.isArray(a.variants) || !a.variants.length || !Array.isArray(a.fixtures)) throw new Error(t(`Hibás terület a mentésben: ${a.name ?? a.id}.`, `Broken area in the backup: ${a.name ?? a.id}.`));
  }
  return p;
}

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

/** Only what a viewer needs: chosen variants, the plants they use, settings. */
export function shareSnapshot(p: Project): Project {
  const areas = p.areas.map((a) => {
    const v = a.variants.find((x) => x.id === a.chosenVariantId) ?? a.variants[0];
    const { activeVariantId: _a, background: _b, ...rest } = a;
    const { renders: _r, ...plain } = v;
    return { ...rest, variants: [plain] };
  });
  const used = new Set(p.areas.flatMap((a) => chosenItems(a).map((i) => i.plantId)));
  return { schemaVersion: 1, id: p.id, name: p.name, areas, plantDb: p.plantDb.filter((x) => used.has(x.code)), settings: p.settings };
}

export const encodeShare = (p: Project) => b64url(deflateSync(strToU8(JSON.stringify(shareSnapshot(p))), { level: 9 }));

export function decodeShare(code: string): Project {
  try {
    return parseProject(strFromU8(inflateSync(unb64url(code))));
  } catch (e) {
    throw new Error(e instanceof Error && e.message === NOT_A_BACKUP() ? e.message : t('A megosztott link sérült vagy hiányos.', 'The shared link is damaged or incomplete.'));
  }
}

export const SHARE_PREFIX = '#view=';
export const shareUrl = (p: Project, base = location.href) => `${base.split('#')[0]}${SHARE_PREFIX}${encodeShare(p)}`;
