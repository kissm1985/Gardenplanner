// Plant photo for the info card: own photo first, else a Wikipedia photo, cached on the device (IndexedDB)
// so it also shows offline after the first look-up.
import { get, set } from 'idb-keyval';
import { useEffect, useState } from 'react';
import { lookupPhoto } from '../engine/photos';
import type { Plant } from '../model/types';
import { useProject } from '../store/projectStore';
import { t } from '../i18n';

export type PhotoState =
  | { state: 'none' }
  | { state: 'loading' }
  | { state: 'ok'; src: string; credit: string; pageUrl?: string; filePage?: string; license?: string; licenseUrl?: string; own: boolean }
  | { state: 'offline' };

interface Cached {
  at: number;
  found: boolean;
  blob?: Blob;
  src?: string;
  credit?: string;
  pageUrl?: string;
  filePage?: string;
  license?: string;
  licenseUrl?: string;
}

const RETRY_MS = 7 * 24 * 3600 * 1000; // look again for plants without a photo after a week
const memo = new Map<string, Promise<PhotoState>>();
const key = (nameLat: string) => `photo:${nameLat.trim().toLowerCase()}`;

function fromCache(c: Cached): PhotoState {
  if (!c.found || !c.src) return { state: 'none' };
  return { state: 'ok', src: c.blob ? URL.createObjectURL(c.blob) : c.src, credit: c.credit ?? '', pageUrl: c.pageUrl, filePage: c.filePage, license: c.license, licenseUrl: c.licenseUrl, own: false };
}

async function load(nameLat: string): Promise<PhotoState> {
  let cached: Cached | undefined;
  try {
    cached = await get<Cached>(key(nameLat));
  } catch {
    /* no IndexedDB (private mode): just fetch */
  }
  // Photos cached before the licence links were kept are looked up again once (when online).
  const stale = cached?.found && !cached.filePage && navigator.onLine !== false;
  if (cached && !stale && (cached.found || Date.now() - cached.at < RETRY_MS)) return fromCache(cached);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return cached ? fromCache(cached) : { state: 'offline' };
  try {
    const info = await lookupPhoto(nameLat);
    const entry: Cached = { at: Date.now(), found: !!info, ...info };
    if (info)
      try {
        const res = await fetch(info.src);
        if (res.ok) entry.blob = await res.blob();
      } catch {
        /* keep the URL; the browser cache may still serve it */
      }
    set(key(nameLat), entry).catch(() => {});
    return fromCache(entry);
  } catch {
    memo.delete(nameLat); // network error: try again next time
    return { state: 'offline' };
  }
}

/** Photo for a plant; only looks up when `enabled` (e.g. while the card is visible). */
export function usePlantPhoto(plant: Plant | null, enabled = true): PhotoState {
  const wiki = useProject((s) => s.project?.settings.wikiPhotos !== false);
  const [st, setSt] = useState<PhotoState>({ state: 'loading' });
  const own = plant?.photoUrl;
  const name = plant?.nameLat ?? '';
  const hasPlant = !!plant;
  useEffect(() => {
    if (!enabled || !hasPlant || own) return;
    if (!wiki || !name.trim()) {
      setSt({ state: 'none' });
      return;
    }
    let live = true;
    setSt({ state: 'loading' });
    if (!memo.has(name)) memo.set(name, load(name));
    memo.get(name)!.then((r) => live && setSt(r));
    return () => {
      live = false;
    };
  }, [enabled, own, name, wiki, hasPlant]);
  if (!plant) return { state: 'none' };
  if (own) return { state: 'ok', src: own, credit: plant.photoCredit ?? t('saját fotó', 'own photo'), own: true };
  return st;
}
