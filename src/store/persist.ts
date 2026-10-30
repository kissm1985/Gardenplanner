import { del, get, set } from 'idb-keyval';
import { validateProject } from '../engine/validate';
import type { Project } from '../model/types';

const KEY = 'kerttervezo:project:v1';

/** The saved plan cannot be used; `raw` is what was stored, so it can still be downloaded. */
export class StoredProjectError extends Error {
  constructor(
    message: string,
    readonly raw: unknown,
  ) {
    super(message);
  }
}

export async function loadProject(): Promise<Project | null> {
  let p: unknown;
  try {
    p = await get(KEY);
  } catch {
    return null;
  }
  if (!p || (p as Project).schemaVersion !== 1) return null;
  try {
    validateProject(p);
  } catch (e) {
    throw new StoredProjectError((e as Error).message, p);
  }
  return p as Project;
}

/** Forget the saved plan (after the user downloaded it or chose to start over). */
export async function clearProject(): Promise<void> {
  await del(KEY);
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
