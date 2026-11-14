// "Show prices" (spec v0.2, F3): a device setting, off by default. The prices stay in the data (plant list, backups);
// only showing them is switched. While it is off, no price appears anywhere: list, totals, exports, print, PDF, prompt.
import { useSyncExternalStore } from 'react';

export const SHOW_PRICES_KEY = 'kerttervezo.showPrices';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(SHOW_PRICES_KEY) === '1';
  } catch {
    return false; // no storage (private mode, tests): off
  }
}

let current = read();

export const getShowPrices = () => current;

export function setShowPrices(on: boolean) {
  current = on;
  try {
    localStorage.setItem(SHOW_PRICES_KEY, on ? '1' : '0');
  } catch {
    /* this session only */
  }
  listeners.forEach((f) => f());
}

/** Re-renders when the setting changes. */
export function useShowPrices(): boolean {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    getShowPrices,
    getShowPrices,
  );
}
