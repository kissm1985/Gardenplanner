// Expert review of the built-in plant data (PL-DAT-01). Each entry overrides fields of one species and records who
// checked what and when; `confirmed` lists fields found correct as they are. Entries are produced in the app
// (Plant database → "Lektorált lista visszatöltése", then "Lektorálás exportja") and pasted here; every change here
// must come with a SEED_VERSION bump so existing projects pick it up.
import type { Plant } from '../model/types';

export interface ReviewEntry {
  /** Corrected values. */
  set?: Partial<Plant>;
  /** Fields found correct as they are. */
  confirmed?: (keyof Plant)[];
  /** Reviewer or source, e.g. "Kovács Anna, kertészmérnök" or a catalogue. */
  source: string;
  /** YYYY-MM-DD */
  checkedAt: string;
}

/** Empty until the first expert review comes back. */
export const REVIEW: Record<string, ReviewEntry> = {};

export function applyReview(p: Plant, review: Record<string, ReviewEntry> = REVIEW): Plant {
  const r = review[p.code];
  if (!r) return p;
  const done = new Set<keyof Plant>([...(r.confirmed ?? []), ...(Object.keys(r.set ?? {}) as (keyof Plant)[])]);
  return { ...p, ...r.set, verify: (p.verify ?? []).filter((k) => !done.has(k)), dataSource: r.source, checkedAt: r.checkedAt };
}
