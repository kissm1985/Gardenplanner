// "Larger text": a device setting that enlarges the interface text (not the plan drawing) by about 15%.
import { useSyncExternalStore } from 'react';

const KEY = 'kerttervezo.largeText';
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
let current = read();
function apply() {
  if (typeof document === 'undefined') return;
  if (current) document.documentElement.dataset.text = 'large';
  else delete document.documentElement.dataset.text;
}
export const isLargeText = () => current;
export function setLargeText(on: boolean) {
  current = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* this session only */
  }
  apply();
  listeners.forEach((f) => f());
}
export function useLargeText(): boolean {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    isLargeText,
    isLargeText,
  );
}
apply();
