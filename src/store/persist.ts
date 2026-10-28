import { get, set } from 'idb-keyval';
import type { Project } from '../model/types';

const KEY = 'kerttervezo:project:v1';

export async function loadProject(): Promise<Project | null> {
  try {
    const p = (await get(KEY)) as Project | undefined;
    return p && p.schemaVersion === 1 ? p : null;
  } catch {
    return null;
  }
}

export async function saveProject(p: Project): Promise<void> {
  await set(KEY, p);
}

/** Debounced autosave; `flush` writes immediately (used when the page is hidden). */
export function createAutosaver(delayMs = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Project | null = null;
  let onError: (e: unknown) => void = () => {};
  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const p = pending;
    pending = null;
    if (p) {
      try {
        await saveProject(p);
      } catch (e) {
        onError(e);
      }
    }
  };
  return {
    schedule(p: Project) {
      pending = p;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    onError(fn: (e: unknown) => void) {
      onError = fn;
    },
  };
}
