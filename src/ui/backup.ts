// Keeping the plan safe on the device: persistent storage, the time of the last backup, and a reminder.
import { useSyncExternalStore } from 'react';
import { exportJson } from '../engine/io';
import type { Project } from '../model/types';
import { localName } from '../i18n/names';
import { downloadText } from './download';

const LAST_BACKUP = 'kerttervezo:last-backup';
const SNOOZE = 'kerttervezo:backup-snooze';
const DAY = 24 * 60 * 60 * 1000;
/** Remind after this many days without a backup (or never), once there is something to lose. */
export const REMIND_AFTER_DAYS = 7;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

const readNum = (k: string) => {
  try {
    const v = Number(localStorage.getItem(k));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};
const writeNum = (k: string, v: number) => {
  try {
    localStorage.setItem(k, String(v));
  } catch {
    /* only for this session */
  }
};

export const lastBackupAt = () => readNum(LAST_BACKUP);

/** Persistent storage: true = the browser will not clear it on its own, false = it may, null = unknown. */
let persisted: boolean | null = null;
export const isPersisted = () => persisted;

/** Ask the browser to keep the plan (Chrome grants it to installed or often used apps; Safari to home-screen apps). */
export async function requestPersistence(): Promise<boolean | null> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!s?.persist) return (persisted = null);
  try {
    persisted = (await s.persisted?.()) || (await s.persist());
  } catch {
    persisted = null;
  }
  emit();
  return persisted;
}

/** Installed to the home screen (standalone window). */
export const isInstalled = () =>
  typeof matchMedia !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

/** Full JSON backup to a file; remembers when, so the reminder goes quiet. */
export async function backupNow(project: Project): Promise<void> {
  const name = `planterra-${slug(localName(project.name))}-${new Date().toISOString().slice(0, 10)}.json`;
  const json = exportJson(project);
  // Chrome/Edge on computers: let the user pick the folder (e.g. a synced one). Elsewhere: a download.
  const picker = (window as Window & { showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
  if (picker && !matchMedia('(pointer: coarse)').matches) {
    try {
      const h = await picker({ suggestedName: name, types: [{ description: 'Planterra JSON', accept: { 'application/json': ['.json'] } }] });
      const w = await h.createWritable();
      await w.write(json);
      await w.close();
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      downloadText(name, json, 'application/json');
    }
  } else downloadText(name, json, 'application/json');
  writeNum(LAST_BACKUP, Date.now());
  emit();
}

export function snoozeReminder(days = 3) {
  writeNum(SNOOZE, Date.now() + days * DAY);
  emit();
}

/** Plants placed in the whole project – nothing to lose below a handful. */
const plantCount = (p: Project) =>
  p.areas.reduce((s, a) => s + a.variants.reduce((n, v) => n + v.items.reduce((k, it) => k + (it.kind === 'plant' ? 1 : (it.count ?? 1)), 0), 0), 0);

/** Whether to show the backup reminder now. */
export function needsReminder(p: Project | null, now = Date.now()): boolean {
  if (!p || plantCount(p) < 5) return false;
  const snooze = readNum(SNOOZE);
  if (snooze && snooze > now) return false;
  const last = lastBackupAt();
  return !last || now - last > REMIND_AFTER_DAYS * DAY;
}

/** Re-renders when a backup is made, the reminder is snoozed or persistence changes. */
export function useBackupState() {
  const last = useSyncExternalStore(subscribe, lastBackupAt, lastBackupAt);
  const persistedNow = useSyncExternalStore(subscribe, isPersisted, isPersisted);
  const snooze = useSyncExternalStore(
    subscribe,
    () => readNum(SNOOZE),
    () => readNum(SNOOZE),
  );
  return { last, persisted: persistedNow, snooze };
}
