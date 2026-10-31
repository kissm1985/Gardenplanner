// Names the app gives by default (element labels, template areas, "Plan A", "Idea 2"…) are stored as text in
// the language of the moment. On screen they follow the current language; names the user typed stay as they are.
import { FIXTURE_LABEL_PAIRS } from '../model/fixtures';
import { getLang, type Lang } from './index';

const PAIRS: [hu: string, en: string][] = [
  ...Object.values(FIXTURE_LABEL_PAIRS),
  ['Ház', 'House'],
  ['Járda', 'Pavement'],
  ['Gyepsáv', 'Lawn strip'],
  ['Csap / akna', 'Tap / manhole'],
  ['Diófa (szomszéd, helye ellenőrizendő)', 'Walnut (neighbour, position to be checked)'],
  ['Házoldali sáv', 'House-side strip'],
  ['Gyepsávos kert', 'Garden with lawn strip'],
  ['Kertem', 'My garden'],
  ['Ötletek', 'Ideas'],
  ['Mappa', 'Folder'],
  ['Saját hely', 'My place'],
];
const BY_TEXT = new Map<string, [string, string]>();
for (const p of PAIRS) for (const s of p) BY_TEXT.set(s.toLowerCase(), p);

/** Numbered defaults: "B terv" ↔ "Plan B", "3. terv" ↔ "Plan 3", "Ötlet 2" ↔ "Idea 2". */
const PATTERNS: { hu: RegExp; en: RegExp; toHu: (m: string) => string; toEn: (m: string) => string }[] = [
  { hu: /^([A-Z]) terv$/, en: /^Plan ([A-Z])$/, toHu: (m) => `${m} terv`, toEn: (m) => `Plan ${m}` },
  { hu: /^(\d+)\. terv$/, en: /^Plan (\d+)$/, toHu: (m) => `${m}. terv`, toEn: (m) => `Plan ${m}` },
  { hu: /^Ötlet (\d+)$/, en: /^Idea (\d+)$/, toHu: (m) => `Ötlet ${m}`, toEn: (m) => `Idea ${m}` },
];

/** A default name in the given (default: current) language; any other name unchanged. */
export function localName(s: string | undefined, lang: Lang = getLang()): string {
  if (!s) return '';
  const pair = BY_TEXT.get(s.trim().toLowerCase());
  if (pair) return lang === 'en' ? pair[1] : pair[0];
  for (const p of PATTERNS) {
    const m = p.hu.exec(s) ?? p.en.exec(s);
    if (m) return lang === 'en' ? p.toEn(m[1]) : p.toHu(m[1]);
  }
  return s;
}
