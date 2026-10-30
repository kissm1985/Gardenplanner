// Monthly care calendar for the species in the plan (SPEC §4.7), written for a Hungarian climate
// (last frost around mid-April, first frost around the end of October); the project's location shifts the frost notes in the schedule.
import type { Plant, Project } from '../model/types';
import { t } from '../i18n';
import { plantName } from '../model/plants';
import { chosenItems } from './bom';

export interface CareTask {
  text: string;
  /** Species codes it concerns; empty = general task. */
  codes: string[];
}

type Text = [hu: string, en: string];
type Rule = { months: number[]; text: Text; codes?: string[]; when?: (p: Plant) => boolean };

// Species-specific care for the starting list (codes from the seed).
const SPECIES: Rule[] = [
  { codes: ['LA'], months: [4], text: ['Levendula: az új hajtások megjelenésekor harmadával visszavágni, öreg fába nem vágni.', 'Lavender: cut back by a third when new shoots appear; never into old wood.'] },
  { codes: ['LA'], months: [8], text: ['Levendula: elvirágzás után a virágszárakat a lombig visszavágni (legkésőbb augusztus végéig).', 'Lavender: after flowering, cut the flower stems back to the foliage (by the end of August).'] },
  { codes: ['SA'], months: [7], text: ['Ligeti zsálya: az első virágzás után tőből visszavágni, újra virágzik.', 'Woodland sage: cut back to the base after the first flowering; it flowers again.'] },
  { codes: ['NE'], months: [7], text: ['Macskamenta: az első virágzás után felére visszavágni.', 'Catmint: cut back by half after the first flowering.'] },
  { codes: ['CO', 'AM'], months: [8], text: ['Elnyílt virágok eltávolítása a hosszabb virágzásért.', 'Deadhead for a longer flowering.'] },
  { codes: ['TH'], months: [7], text: ['Kakukkfű: virágzás után könnyű nyírás, hogy tömött maradjon.', 'Thyme: light trim after flowering to keep it dense.'] },
  { codes: ['ST'], months: [6], text: ['Gyapjas tisztesfű: a virágszárak és a rothadó levelek eltávolítása.', 'Lamb’s ear: remove flower stems and rotting leaves.'] },
  { codes: ['FE', 'CA'], months: [3], text: ['Kék csenkesz / sás: kifésülés, az elszáradt levelek kihúzása (nem visszavágás).', 'Blue fescue / sedge: comb out and pull the dead leaves (do not cut back).'] },
  { codes: ['MO', 'CK', 'MI'], months: [3], text: ['Díszfüvek: visszavágás 10–15 cm-re, mielőtt az új hajtások megindulnak.', 'Ornamental grasses: cut back to 10–15 cm before the new growth starts.'] },
  { codes: ['EC', 'HH'], months: [3], text: ['Kúpvirág, magas varjúháj: a télen díszítő szárak visszavágása tőből.', 'Coneflower, tall stonecrop: cut the winter stems back to the base.'] },
  { codes: ['EC', 'HH', 'MO', 'CK', 'MI'], months: [11], text: ['A termésszárakat és a díszfüveket ne vágd vissza: télen díszítenek, és védik a tövet.', 'Leave seed heads and grasses standing: they look good in winter and protect the crown.'] },
  { codes: ['BE', 'HE'], months: [3], text: ['Bergénia / tűzeső: a sérült, elszáradt levelek eltávolítása.', 'Bergenia / coral bells: remove damaged and dead leaves.'] },
  { codes: ['GR', 'AL'], months: [7], text: ['Gólyaorr / palástfű: ha szétterül, visszavágás, újra kihajt.', 'Cranesbill / lady’s mantle: if it flops, cut back; it regrows.'] },
  { codes: ['EF', 'BB'], months: [5], text: ['Kecskerágó / borbolya: formázó nyírás (kesztyűben).', 'Spindle / barberry: shaping trim (wear gloves).'] },
  { codes: ['PE'], months: [4], text: ['Kékszakállfű: erős visszavágás 20–30 cm-re.', 'Russian sage: hard prune to 20–30 cm.'] },
  { codes: ['EU'], months: [6], text: ['Kutyatej: elvirágzott szárak visszavágása – kesztyűben, a tejnedv irritál.', 'Spurge: cut spent stems – wear gloves, the sap irritates.'] },
  { codes: ['AR'], months: [6], text: ['Pázsitszegfű: elnyílt virágfejek levágása.', 'Thrift: remove spent flower heads.'] },
  { codes: ['IR'], months: [7], text: ['Nőszirom: 3–4 évente a rizómák szétosztása (júl.–aug.).', 'Iris: divide the rhizomes every 3–4 years (Jul–Aug).'] },
  { codes: ['HM'], months: [11], text: ['Sásliliom: az elszáradt levelek eltávolítása.', 'Daylily: remove dead leaves.'] },
  { codes: ['HO'], months: [5], text: ['Árnyékliliom: csigák elleni védekezés az új hajtásokon.', 'Hosta: protect the new shoots from slugs.'] },
  { codes: ['SE', 'SD'], months: [4], text: ['Kövirózsa / varjúháj: az elhalt rozetták és levelek kiszedése.', 'Houseleek / stonecrop: remove dead rosettes and leaves.'] },
  { codes: ['AC', 'MG'], months: [6, 7, 8], text: ['Fák: az első 2–3 évben aszályban hetente egyszer bőséges öntözés.', 'Trees: in the first 2–3 years, water deeply once a week in drought.'] },
  { codes: ['MG'], months: [3], text: ['Magnólia: nem igényel metszést; késői fagyban a virágbimbók védelme fátyolfóliával.', 'Magnolia: needs no pruning; protect the buds with fleece in late frost.'] },
];

/** Generic rules that work for any (also user-added) plant. */
const GENERIC: Rule[] = [
  { months: [3, 4], text: ['Ne trágyázd és ne komposztáld a szárazságtűrőket:', 'Do not feed or compost the drought-tolerant plants:'], when: (p) => p.water === 'low' },
  { months: [11], text: ['Télen nem díszítő évelők: lombjuk elszáradása után visszavághatók:', 'Perennials without winter interest can be cut back once the foliage dies:'], when: (p) => !p.winterInterest && !p.isTree },
];

const GENERAL: { months: number[]; text: Text; when?: (ctx: Ctx) => boolean }[] = [
  { months: [1, 2], text: ['Pihenőidő: hónyomásos télen a díszfüvek összekötése; a csepegtető maradjon leeresztve.', 'Rest: tie up grasses in snowy winters; keep the drip line drained.'] },
  { months: [3], text: ['A csepegtető rendszer átnézése, szűrő tisztítása; gyomlálás, a mulcs pótlása, ahol elvékonyodott.', 'Check the drip system and clean the filter; weed and top up the mulch where it is thin.'] },
  { months: [4], text: ['Április közepéig fagyveszély: a frissen ültetett vagy korán hajtó növényeket hideg éjszakára takard.', 'Frost risk until mid-April: cover new or early plants on cold nights.'] },
  { months: [5, 6, 7, 8, 9], text: ['Öntözés: az első évben hetente 1–2 alkalommal mélyen (csepegtetővel reggel), utána csak tartós aszályban.', 'Watering: in the first year deeply 1–2 times a week (drip, in the morning), later only in long droughts.'] },
  { months: [6, 7, 8], text: ['Gyomlálás havonta; a kavicsmulcs alatt a gyom ritka, a széleken figyeld.', 'Weed monthly; under gravel mulch weeds are rare, watch the edges.'] },
  { months: [9, 10], text: ['Őszi ültetési idő: hiányzó tövek pótlása, túlnőtt évelők szétosztása.', 'Autumn planting time: replace missing plants, divide overgrown perennials.'] },
  { months: [10, 11], text: ['Diófa alatt: a lehullott diólevél és burok hetente összegyűjtése, ne komposztáld (juglone).', 'Under the walnut: collect fallen walnut leaves and husks weekly; do not compost them (juglone).'], when: (c) => c.walnut },
  { months: [11], text: ['Az első fagy előtt a csepegtető leeresztése, az ágyások utolsó beöntözése.', 'Before the first frost, drain the drip line and give the beds a last deep watering.'] },
  { months: [12], text: ['Pihenőidő: a mulcs és a lomb maradjon a tövek körül, téli védelemnek.', 'Rest: leave mulch and leaves around the plants as winter protection.'] },
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
  for (const g of GENERAL) if (!g.when || g.when(ctx)) for (const m of g.months) months[m - 1].push({ text: t(...g.text), codes: [] });
  for (const r of SPECIES) {
    const hit = r.codes!.filter((c) => codes.has(c));
    if (hit.length) for (const m of r.months) months[m - 1].push({ text: t(...r.text), codes: hit });
  }
  for (const r of GENERIC) {
    const hit = plants.filter(r.when!);
    if (hit.length)
      for (const m of r.months) months[m - 1].push({ text: `${t(...r.text)} ${hit.map((p) => plantName(p).toLowerCase()).join(', ')}.`, codes: hit.map((p) => p.code) });
  }
  return months;
}
