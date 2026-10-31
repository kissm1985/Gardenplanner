// Small per-device "already done once" flags (first-plan checklist).
const key = (k: string) => `kerttervezo:seen:${k}`;

export function seen(k: string): boolean {
  try {
    return localStorage.getItem(key(k)) === '1';
  } catch {
    return false;
  }
}

export function markSeen(k: string) {
  try {
    localStorage.setItem(key(k), '1');
  } catch {
    /* only for this session */
  }
}
