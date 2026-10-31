// Light / dark appearance, per device. "auto" follows the system setting; the tokens in styles/tokens.css
// react to <html data-theme="light|dark"> as well as to prefers-color-scheme.
import { useSyncExternalStore } from 'react';

export type Theme = 'auto' | 'light' | 'dark';
const KEY = 'kerttervezo.theme';
const listeners = new Set<() => void>();
const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* private mode */
  }
  return 'auto';
}

let current: Theme = read();

/** The appearance actually shown. */
export const isDark = () => (current === 'auto' ? !!media?.matches : current === 'dark');

function apply() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (current === 'auto') delete root.dataset.theme;
  else root.dataset.theme = current;
  // Status bar colour on phones.
  const color = isDark() ? '#1d231e' : '#244b3c';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
}

export const getTheme = () => current;

export function setTheme(v: Theme) {
  current = v;
  try {
    if (v === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, v);
  } catch {
    /* only for this session */
  }
  apply();
  listeners.forEach((f) => f());
}

/** One tap: switch to the opposite of what is shown now. */
export const toggleTheme = () => setTheme(isDark() ? 'light' : 'dark');

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

/** Re-renders on a theme change, including a system change while on "auto". */
export function useTheme(): { theme: Theme; dark: boolean } {
  const theme = useSyncExternalStore(subscribe, getTheme, getTheme);
  const dark = useSyncExternalStore(subscribe, isDark, isDark);
  return { theme, dark };
}

media?.addEventListener?.('change', () => {
  if (current !== 'auto') return;
  apply();
  listeners.forEach((f) => f());
});
apply();
