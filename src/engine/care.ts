// Monthly care calendar for the species in the plan (SPEC §4.7), written for Győr:
// last frost around mid-April, first frost around the end of October.
import type { Plant, Project } from '../model/types';
import { chosenItems } from './bom';

export interface CareTask {
  text: string;
  /** Species codes it concerns; empty = general task. */
  codes: string[];
}

type Rule = { months: number[]; text: string; codes?: string[]; when?: (p: Plant) => boolean };

// Species-specific care for the starting list (codes from the seed).
const SPECIES: Rule[] = [
  { codes: ['LA'], months: [4], text: 'Levendula: az új hajtások megjelenésekor harmadával visszavágni, öreg fába nem vágni.' },
  { codes: ['LA'], months: [8], text: 'Levendula: elvirágzás után a virágszárakat a lombig visszavágni (legkésőbb augusztus végéig).' },
  { codes: ['SA'], months: [7], text: 'Ligeti zsálya: az első virágzás után tőből visszavágni, újra virágzik.' },
  { codes: ['NE'], months: [7], text: 'Macskamenta: az első virágzás után felére visszavágni.' },
  { codes: ['CO', 'AM'], months: [8], text: 'Elnyílt virágok eltávolítása a hosszabb virágzásért.' },
  { codes: ['TH'], months: [7], text: 'Kakukkfű: virágzás után könnyű nyírás, hogy tömött maradjon.' },
  { codes: ['ST'], months: [6], text: 'Gyapjas tisztesfű: a virágszárak és a rothadó levelek eltávolítása.' },
  { codes: ['FE', 'CA'], months: [3], text: 'Kék csenkesz / sás: kifésülés, az elszáradt levelek kihúzása (nem visszavágás).' },
  { codes: ['MO', 'CK', 'MI'], months: [3], text: 'Díszfüvek: visszavágás 10–15 cm-re, mielőtt az új hajtások megindulnak.' },
  { codes: ['EC', 'HH'], months: [3], text: 'Kúpvirág, magas varjúháj: a télen díszítő szárak visszavágása tőből.' },
  { codes: ['EC', 'HH', 'MO', 'CK', 'MI'], months: [11], text: 'A termésszárakat és a díszfüveket ne vágd vissza: télen díszítenek, és védik a tövet.' },
  { codes: ['BE', 'HE'], months: [3], text: 'Bergénia / tűzeső: a sérült, elszáradt levelek eltávolítása.' },
  { codes: ['GR', 'AL'], months: [7], text: 'Gólyaorr / palástfű: ha szétterül, visszavágás, újra kihajt.' },
  { codes: ['EF', 'BB'], months: [5], text: 'Kecskerágó / borbolya: formázó nyírás (kesztyűben).' },
  { codes: ['PE'], months: [4], text: 'Kékszakállfű: erős visszavágás 20–30 cm-re.' },
  { codes: ['EU'], months: [6], text: 'Kutyatej: elvirágzott szárak visszavágása – kesztyűben, a tejnedv irritál.' },
  { codes: ['AR'], months: [6], text: 'Pázsitszegfű: elnyílt virágfejek levágása.' },
  { codes: ['IR'], months: [7], text: 'Nőszirom: 3–4 évente a rizómák szétosztása (júl.–aug.).' },
  { codes: ['HM'], months: [11], text: 'Sásliliom: az elszáradt levelek eltávolítása.' },
  { codes: ['HO'], months: [5], text: 'Árnyékliliom: csigák elleni védekezés az új hajtásokon.' },
  { codes: ['SE', 'SD'], months: [4], text: 'Kövirózsa / varjúháj: az elhalt rozetták és levelek kiszedése.' },
  { codes: ['AC', 'MG'], months: [6, 7, 8], text: 'Fák: az első 2–3 évben aszályban hetente egyszer bőséges öntözés.' },
  { codes: ['MG'], months: [3], text: 'Magnólia: nem igényel metszést; késői fagyban a virágbimbók védelme fátyolfóliával.' },
];

/** Generic rules that work for any (also user-added) plant. */
const GENERIC: Rule[] = [
  { months: [3, 4], text: 'Ne trágyázd és ne komposztáld a szárazságtűrőket:', when: (p) => p.water === 'low' },
  { months: [11], text: 'Télen nem díszítő évelők: lombjuk elszáradása után visszavághatók:', when: (p) => !p.winterInterest && !p.isTree },
];

const GENERAL: { months: number[]; text: string; when?: (ctx: Ctx) => boolean }[] = [
  { months: [1, 2], text: 'Pihenőidő: hónyomásos télen a díszfüvek összekötése; a csepegtető maradjon leeresztve.' },
  { months: [3], text: 'A csepegtető rendszer átnézése, szűrő tisztítása; gyomlálás, a mulcs pótlása, ahol elvékonyodott.' },
  { months: [4], text: 'Április közepéig fagyveszély: a frissen ültetett vagy korán hajtó növényeket hideg éjszakára takard.' },
  { months: [5, 6, 7, 8, 9], text: 'Öntözés: az első évben hetente 1–2 alkalommal mélyen (csepegtetővel reggel), utána csak tartós aszályban.' },
  { months: [6, 7, 8], text: 'Gyomlálás havonta; a kavicsmulcs alatt a gyom ritka, a széleken figyeld.' },
  { months: [9, 10], text: 'Őszi ültetési idő: hiányzó tövek pótlása, túlnőtt évelők szétosztása.' },
  { months: [10, 11], text: 'Diófa alatt: a lehullott diólevél és burok hetente összegyűjtése, ne komposztáld (juglone).', when: (c) => c.walnut },
  { months: [11], text: 'Az első fagy előtt a csepegtető leeresztése, az ágyások utolsó beöntözése.' },
  { months: [12], text: 'Pihenőidő: a mulcs és a lomb maradjon a tövek körül, téli védelemnek.' },
];

interface Ctx {
  walnut: boolean;
}

/** Plants present in the chosen variants of all areas. */
export function plantsInPlan(project: Project): Plant[] {
  const codes = new Set(project.areas.flatMap((a) => chosenItems(a).map((i) => i.plantId)));
  return project.plantDb.filter((p) => codes.has(p.code));
}

export function careCalendar(project: Project): CareTask[][] {
  const plants = plantsInPlan(project);
  const codes = new Set(plants.map((p) => p.code));
  const ctx: Ctx = { walnut: project.areas.some((a) => a.fixtures.some((f) => f.type === 'walnut')) };
  const months: CareTask[][] = Array.from({ length: 12 }, () => []);
  for (const g of GENERAL) if (!g.when || g.when(ctx)) for (const m of g.months) months[m - 1].push({ text: g.text, codes: [] });
  for (const r of SPECIES) {
    const hit = r.codes!.filter((c) => codes.has(c));
    if (hit.length) for (const m of r.months) months[m - 1].push({ text: r.text, codes: hit });
  }
  for (const r of GENERIC) {
    const hit = plants.filter(r.when!);
    if (hit.length)
      for (const m of r.months) months[m - 1].push({ text: `${r.text} ${hit.map((p) => p.nameHu.toLowerCase()).join(', ')}.`, codes: hit.map((p) => p.code) });
  }
  return months;
}
