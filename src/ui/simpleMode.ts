// Simple mode: a shorter toolbar for beginners (plant, drift, idea, list; the rest under "More"). Chosen per device;
// until the user decides, it follows the tier (on in Basic, off otherwise).
import { useSyncExternalStore } from 'react';
import { getTier, useTier } from '../model/tier';

const KEY = 'kerttervezo.simple';
const listeners = new Set<() => void>();

function stored(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

export const isSimpleMode = () => stored() ?? getTier() === 'alap';

export function setSimpleMode(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* this session only */
  }
  listeners.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

export function useSimpleMode(): boolean {
  useTier(); // the default follows the tier
  return useSyncExternalStore(subscribe, isSimpleMode, isSimpleMode);
}
