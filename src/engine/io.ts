// Project import/export (SPEC §4.9): full JSON backup, and a compact read-only share code
// that travels in the URL hash (no server).
import type { Project } from '../model/types';
import { LIMITS, validateProject } from './validate';
import { t } from '../i18n';

export const exportJson = (p: Project) => JSON.stringify(p, null, 2);

export const NOT_A_BACKUP = () => t('Ez nem Planterra-projektmentés (hiányzó vagy ismeretlen verzió).', 'This is not a Planterra backup (missing or unknown version).');

/** Parse and sanity-check a project backup; throws a readable message on failure. */
export function parseProject(text: string): Project {
  if (text.length > LIMITS.textBytes) throw new Error(t('A fájl túl nagy ahhoz, hogy Planterra-mentés legyen.', 'The file is too large to be a Planterra backup.'));
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t('A fájl nem érvényes JSON.', 'The file is not valid JSON.'));
  }
  const p = data as Project;
  if (!p || typeof p !== 'object' || p.schemaVersion !== 1) throw new Error(NOT_A_BACKUP());
  if (!Array.isArray(p.areas) || !Array.isArray(p.plantDb))
    throw new Error(t('A mentésből hiányoznak a területek vagy a növénylista.', 'The backup has no areas or no plant list.'));
  validateProject(p);
  return p;
}

/** Hash prefix of a read-only share link. */
export const SHARE_PREFIX = '#view=';
