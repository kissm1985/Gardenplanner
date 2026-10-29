// Two languages, Hungarian and English. Texts sit side by side at the call site: t('Bezárás', 'Close').
// The language is chosen per device (localStorage), by default from the browser; switching it
// re-mounts the app, so engines that build texts (rules, lists, exports) just read the current one.
import { useSyncExternalStore } from 'react';

export type Lang = 'hu' | 'en';
const KEY = 'kerttervezo.lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'hu' || saved === 'en') return saved;
  } catch {
    /* private mode */
  }
  const nav = typeof navigator !== 'undefined' ? (navigator.languages?.[0] ?? navigator.language ?? 'hu') : 'hu';
  return nav.toLowerCase().startsWith('hu') ? 'hu' : 'en';
}

let current: Lang = detect();
const listeners = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const getLang = () => current;

/** Pick the text for the current language. */
export function t(hu: string, en: string): string {
  return current === 'en' ? en : hu;
}

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* not saved, still switches for this session */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    getLang,
    getLang,
  );
}

/** Locale for numbers and dates. */
export const locale = () => (current === 'en' ? 'en-GB' : 'hu-HU');

/** A label table whose values follow the current language (enumerable getters, so Object.entries works). */
export function labels<K extends string>(m: Record<K, [hu: string, en: string]>): Record<K, string> {
  const o = {} as Record<K, string>;
  for (const k of Object.keys(m) as K[]) Object.defineProperty(o, k, { get: () => t(m[k][0], m[k][1]), enumerable: true });
  return o;
}

/** A read-only list whose items follow the current language. */
export function labelList(m: [hu: string, en: string][]): readonly string[] {
  return new Proxy([] as string[], {
    get(_, prop) {
      const list = m.map(([hu, en]) => t(hu, en));
      const v = Reflect.get(list, prop, list);
      return typeof v === 'function' ? v.bind(list) : v;
    },
    has: (_, prop) => prop in m,
    ownKeys: () => Reflect.ownKeys(m),
    getOwnPropertyDescriptor: (_, prop) => Reflect.getOwnPropertyDescriptor(m.map(([hu, en]) => t(hu, en)), prop),
  });
}
