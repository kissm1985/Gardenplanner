// Chapters of the user guide, by key; the heading ids differ per language (docs/UTMUTATO.md, docs/GUIDE.md).
import { getLang } from '../i18n';

const IDS = {
  screen: ['2-a-képernyő-részei', '2-the-screen'],
  areas: ['3-területek', '3-areas'],
  fixtures: ['4-rögzített-elemek-gyep-burkolat-fal-fa', '4-fixed-elements-lawn-paving-wall-tree'],
  placing: ['5-növények-elhelyezése', '5-placing-plants'],
  select: ['6-kijelölés-szerkesztés-csere', '6-selecting-editing-replacing'],
  replace: ['növény-cseréje-mindenhol', 'replacing-a-species-everywhere'],
  warnings: ['8-figyelmeztetések', '8-warnings'],
  db: ['9-növényadatbázis-és-szűrők', '9-plant-database-and-filters'],
  variants: ['10-változatok', '10-variants'],
  ideas: ['11-ötletgenerátor', '11-idea-generator'],
  season: ['12-évszaknézet', '12-season-view'],
  list: ['13-növénylista-rendelés-költség', '13-plant-list-ordering-cost'],
  project: ['15-mentés-megosztás-nyomtatás-képek', '15-saving-sharing-printing-images'],
} as const;

export type HelpKey = keyof typeof IDS;
export const helpId = (k: HelpKey) => IDS[k][getLang() === 'en' ? 1 : 0];
