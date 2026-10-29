// Text brief for an image model (e.g. ChatGPT) to render a realistic visualisation of one area.
// Paste it together with the plan PNG (with legend) exported from the app.
import { areaPoints } from '../model/area';
import { bbox, centroid } from '../model/geometry';
import { SOIL_LABEL } from '../model/plants';
import { AREA_KIND_LABEL, ORIENTATION_LABEL, type Area, type PlacedItem, type Plant, type Project, type Pt } from '../model/types';
import { fillPath, fillPolygon } from './fill';
import { areaSunLevel } from './rules';
import { mulchAdvice } from './schedule';
import { plantLook, SEASON_MONTH, type Season } from './season';

export type Viewpoint = 'eye' | 'aerial' | 'both';
export type Lang = 'hu' | 'en';

export interface PromptOptions {
  season: Season;
  viewpoint: Viewpoint;
  lang: Lang;
  /** Show plants at mature size (2–3 years after planting) or as just planted. */
  mature: boolean;
}

const m = (cm: number) => (Math.round(cm / 10) / 10).toLocaleString('hu-HU', { minimumFractionDigits: 1 });
const mEn = (cm: number) => (Math.round(cm / 10) / 10).toFixed(1);

const FORM: Record<string, { hu: string; en: string }> = {
  circle: { hu: 'bokros évelő', en: 'clump-forming perennial' },
  square: { hu: 'alacsony talajtakaró / párna', en: 'low ground cover / cushion' },
  triangle: { hu: 'díszfű / felálló levélcsomó', en: 'ornamental grass / upright tuft' },
  diamond: { hu: 'kis fa / nagycserje', en: 'small tree / large shrub' },
};

const SEASON_NAME = { hu: ['tavasz', 'nyár', 'ősz', 'tél'], en: ['spring', 'summer', 'autumn', 'winter'] };
const SEASON_DESC = {
  hu: ['április közepe, friss hajtások', 'július, teljes virágzás', 'október, őszi lombszínek', 'január, téli állapot, lehet dér'],
  en: ['mid-April, fresh growth', 'July, peak bloom', 'October, autumn foliage colours', 'January, winter state, possibly frost'],
};

const ORIENT_EN: Record<string, string> = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' };

/** Where an item lies, in metres from the top-left corner of the plan. */
function placement(it: PlacedItem, lang: Lang): string {
  const fmt = lang === 'hu' ? m : mEn;
  if (it.kind === 'plant') return lang === 'hu' ? `x ${fmt(it.x)} m, y ${fmt(it.y)} m` : `x ${fmt(it.x)} m, y ${fmt(it.y)} m`;
  const pts: Pt[] = it.kind === 'drift' ? it.polygon : it.path;
  const b = bbox(pts);
  const box = `x ${fmt(b.minX)}–${fmt(b.maxX)} m, y ${fmt(b.minY)}–${fmt(b.maxY)} m`;
  if (it.kind === 'drift') return lang === 'hu' ? `folt: ${box}, ${it.pattern === 'staggered' ? 'eltolt' : 'négyzetes'} kiosztás, ${it.spacingCm} cm tőtáv` : `drift: ${box}, ${it.pattern === 'staggered' ? 'staggered' : 'grid'} layout, ${it.spacingCm} cm apart`;
  const [a, z] = [it.path[0], it.path[it.path.length - 1]];
  return lang === 'hu'
    ? `${it.path.length > 2 ? 'íves sor' : 'egyenes sor'} (${fmt(a[0])}; ${fmt(a[1])}) m-től (${fmt(z[0])}; ${fmt(z[1])}) m-ig, ${it.spacingCm} cm tőtáv`
    : `${it.path.length > 2 ? 'curved row' : 'straight row'} from (${fmt(a[0])}, ${fmt(a[1])}) m to (${fmt(z[0])}, ${fmt(z[1])}) m, ${it.spacingCm} cm apart`;
}

function count(it: PlacedItem) {
  return it.kind === 'plant' ? 1 : it.kind === 'drift' ? fillPolygon(it.polygon, it.spacingCm, it.pattern).length : fillPath(it.path, it.spacingCm).length;
}

function fixtureLines(area: Area, lang: Lang): string[] {
  const fmt = lang === 'hu' ? m : mEn;
  const out: string[] = [];
  for (const f of area.fixtures) {
    const label = f.label ?? f.type;
    if (f.type === 'lawn' && f.polygon) {
      const b = bbox(f.polygon);
      const curved = f.polygon.length > 12;
      const corners = f.polygon.map(([x, y]) => (lang === 'hu' ? `(${fmt(x)}; ${fmt(y)})` : `(${fmt(x)}, ${fmt(y)})`)).join(', ');
      const name = f.label || (lang === 'hu' ? 'Gyep' : 'Lawn');
      out.push(
        lang === 'hu'
          ? curved
            ? `${name}: ívelt, lágy szélű nyírt gyep, kb. x ${fmt(b.minX)}–${fmt(b.maxX)} m, y ${fmt(b.minY)}–${fmt(b.maxY)} m között (alakja a mellékelt rajzon). Növény nincs rajta.`
            : `${name}: nyírt gyep, sarokpontjai (m): ${corners}. Növény nincs rajta.`
          : curved
            ? `${name}: mown lawn with soft curved edges, roughly x ${fmt(b.minX)}–${fmt(b.maxX)} m, y ${fmt(b.minY)}–${fmt(b.maxY)} m (exact shape on the attached plan). No plants on it.`
            : `${name}: mown lawn, corners (m): ${corners}. No plants on it.`,
      );
    } else if (f.type === 'walnut' || f.type === 'tree') {
      out.push(
        lang === 'hu'
          ? `${label}: nagy lombkoronájú fa a (${fmt(f.x)}; ${fmt(f.y)}) m pontnál${f.x < 0 || f.x > area.widthCm || f.y < 0 || f.y > area.lengthCm ? ' – a területen kívül, a háttérben' : ''}, korona sugara kb. ${fmt(f.radius ?? 200)} m.`
          : `${label}: large-crowned tree at (${fmt(f.x)}, ${fmt(f.y)}) m${f.x < 0 || f.x > area.widthCm || f.y < 0 || f.y > area.lengthCm ? ' – outside the area, in the background' : ''}, crown radius about ${fmt(f.radius ?? 200)} m.`,
      );
    } else {
      const where = `x ${fmt(f.x)}–${fmt(f.x + (f.w ?? 0))} m, y ${fmt(f.y)}–${fmt(f.y + (f.h ?? 0))} m`;
      const what =
        lang === 'hu'
          ? { wall: 'a ház fala (vakolt, világos)', fence: 'kerítés', paving: 'burkolat / járda', tap: 'kerti csap / akna', manhole: 'akna fedlap', window: 'ablak', other: label }[f.type as string] ?? label
          : { wall: 'house wall (light rendered)', fence: 'garden fence', paving: 'paving / pavement', tap: 'garden tap / manhole', manhole: 'manhole cover', window: 'window', other: label }[f.type as string] ?? label;
      out.push(`${what[0].toUpperCase() + what.slice(1)}${f.label && !what.toLowerCase().includes(f.label.toLowerCase()) ? ` („${f.label}”)` : ''}: ${where}.`);
    }
  }
  return out;
}

export function buildVisualPrompt(project: Project, area: Area, items: PlacedItem[], opt: PromptOptions): string {
  const hu = opt.lang === 'hu';
  const fmt = hu ? m : mEn;
  const plants = new Map(project.plantDb.map((p) => [p.code, p]));
  const month = SEASON_MONTH[opt.season];
  const used: Plant[] = [...new Set(items.map((i) => i.plantId))].map((c) => plants.get(c)!).filter(Boolean);
  const sun = areaSunLevel(area);
  const pts = areaPoints(area);
  const L: string[] = [];

  // Task
  L.push(
    hu
      ? `Készíts fotórealisztikus kerti látványtervet a lenti pontos leírás és a mellékelt alaprajz (PNG, jelmagyarázattal) alapján. A növények helye, darabszáma, mérete és színe pontosan egyezzen a tervvel; ne adj hozzá más növényt vagy tárgyat.`
      : `Create a photorealistic garden visualisation from the exact description below and the attached plan (PNG with legend). Plant positions, counts, sizes and colours must match the plan exactly; do not add any other plants or objects.`,
  );
  L.push('');
  // Site
  L.push(hu ? '## Terület' : '## Site');
  L.push(
    hu
      ? `${area.name}: ${fmt(area.widthCm)} × ${fmt(area.lengthCm)} m, ${area.kind ? AREA_KIND_LABEL[area.kind] : 'évelőágyás'}, ${ORIENTATION_LABEL[area.orientation]}i fekvés, ${sun === 'sun' ? 'napos' : sun === 'part' ? 'félárnyékos' : 'árnyékos'}${area.sunUntil ? ` (közvetlen nap ${area.sunUntil})` : ''}${area.soil ? `, ${SOIL_LABEL[area.soil]} talaj` : ''}. Hely: Győr környéki kertes ház.`
      : `${area.name}: ${fmt(area.widthCm)} × ${fmt(area.lengthCm)} m, ${area.kind ?? 'bed'}, facing ${ORIENT_EN[area.orientation]}, ${sun === 'sun' ? 'sunny' : sun === 'part' ? 'half shade' : 'shade'}${area.sunUntil ? ` (direct sun ${area.sunUntil})` : ''}${area.soil ? `, ${area.soil} soil` : ''}. Setting: a family house garden near Győr, Hungary.`,
  );
  L.push(
    hu
      ? `Koordináták: a mellékelt alaprajz bal felső sarka a (0; 0) pont, x a szélesség (balról jobbra), y a hossz (felülről lefelé), méterben.`
      : `Coordinates: the top-left corner of the attached plan is (0, 0); x runs across the width (left to right), y along the length (top to bottom), in metres.`,
  );
  if (area.shape.kind === 'polygon')
    L.push(hu ? `Az ágyás alakja (sarokpontok, m): ${pts.map(([x, y]) => `(${fmt(x)}; ${fmt(y)})`).join(', ')}.` : `Bed outline (corners, m): ${pts.map(([x, y]) => `(${fmt(x)}, ${fmt(y)})`).join(', ')}.`);
  for (const f of fixtureLines(area, opt.lang)) L.push(`- ${f}`);
  L.push('');

  // Plants
  L.push(hu ? '## Növények és elhelyezésük' : '## Plants and placement');
  const byPlant = new Map<string, PlacedItem[]>();
  for (const it of items) byPlant.set(it.plantId, [...(byPlant.get(it.plantId) ?? []), it]);
  for (const p of used) {
    const its = byPlant.get(p.code)!;
    const n = its.reduce((s, it) => s + count(it), 0);
    const look = plantLook(p, month);
    const h = opt.mature ? p.maxHeightCm : Math.max(10, Math.round(p.maxHeightCm * 0.4));
    const w = opt.mature ? p.spreadCm : Math.max(8, Math.round(p.spreadCm * 0.35));
    const f = p.isTree
      ? FORM.diamond[opt.lang]
      : p.maxHeightCm >= 120 && p.symbol !== 'triangle'
        ? (opt.lang === 'hu' ? (p.winterInterest ? 'cserje (télen is lombos / örökzöld)' : 'lombhullató cserje') : p.winterInterest ? 'shrub (evergreen / keeps winter structure)' : 'deciduous shrub')
        : FORM[p.symbol ?? 'circle'][opt.lang];
    const form = f[0].toUpperCase() + f.slice(1);
    const state = hu
      ? look.blooming
        ? `most virágzik: ${p.bloomColor}`
        : opt.season === 3 && !p.winterInterest
          ? 'téli állapot: visszavágva / lombtalan, alig látszik'
          : `most nem virágzik; lomb: ${p.foliageColor}`
      : look.blooming
        ? `in bloom now: ${p.bloomColor}`
        : opt.season === 3 && !p.winterInterest
          ? 'winter state: cut back / leafless, barely visible'
          : `not in bloom; foliage: ${p.foliageColor}`;
    L.push(
      hu
        ? `- **${p.code} – ${p.nameHu}** (*${p.nameLat}*), ${n} tő. ${form}, kb. ${h} cm magas és ${w} cm széles; ${state}.`
        : `- **${p.code} – ${p.nameHu}** (*${p.nameLat}*), ${n} plants. ${form}, about ${h} cm tall and ${w} cm wide; ${state}.`,
    );
    for (const it of its) L.push(`  - ${placement(it, opt.lang)}${it.kind === 'plant' ? '' : hu ? ` (${count(it)} tő)` : ` (${count(it)} plants)`}`);
  }
  if (!used.length) L.push(hu ? '- (Még nincs növény a tervben.)' : '- (No plants in the plan yet.)');
  L.push('');

  // Ground and season
  const mul = mulchAdvice(used);
  L.push(hu ? '## Talajtakarás, évszak, fény' : '## Ground cover, season, light');
  L.push(
    area.kind === 'gravel'
      ? hu
        ? 'Az ágyás felszíne világos, 4–8 mm-es mosott kavics.'
        : 'Bed surface: light washed gravel, 4–8 mm.'
      : mul.gravel.length
        ? hu
          ? `Világos apró kavicsmulcs a szárazságtűrők (${mul.gravel.map((p) => p.nameHu.toLowerCase()).join(', ')}) körül${mul.bark.length ? ', máshol sötét fakéreg mulcs' : ''}.`
          : `Light fine gravel mulch around the drought-tolerant plants (${mul.gravel.map((p) => p.nameLat).join(', ')})${mul.bark.length ? ', dark bark mulch elsewhere' : ''}.`
        : hu
          ? 'Sötét fakéreg mulcs a tövek között.'
          : 'Dark bark mulch between the plants.',
  );
  L.push(
    hu
      ? `Évszak: ${SEASON_NAME.hu[opt.season]} (${SEASON_DESC.hu[opt.season]}). ${opt.mature ? 'A növények kifejlett, 2–3 éves állapotban.' : 'Frissen ültetett állapot: kis tövek, sok látható mulcs.'}`
      : `Season: ${SEASON_NAME.en[opt.season]} (${SEASON_DESC.en[opt.season]}). ${opt.mature ? 'Plants shown established, 2–3 years after planting.' : 'Just planted: small plants with plenty of visible mulch.'}`,
  );
  L.push(
    hu
      ? `Fény: természetes ${area.orientation.includes('E') ? 'délelőtti' : area.orientation.includes('W') ? 'késő délutáni' : 'napközbeni'} napfény, valósághű árnyékokkal.`
      : `Light: natural ${area.orientation.includes('E') ? 'morning' : area.orientation.includes('W') ? 'late-afternoon' : 'midday'} sunlight with realistic shadows.`,
  );
  L.push('');

  // Camera
  L.push(hu ? '## Nézőpont és stílus' : '## Viewpoint and style');
  const eye = hu
    ? `Szemmagasságból (kb. 1,6 m), az alaprajz alsó széle (y = ${fmt(area.lengthCm)} m) felől a terület hossza mentén nézve, 35 mm-es objektívvel.`
    : `Eye level (about 1.6 m) from the bottom edge of the plan (y = ${fmt(area.lengthCm)} m), looking along the length, 35 mm lens.`;
  const aerial = hu ? 'Madártávlatból, kb. 45°-os szögből, hogy az elrendezés jól látsszon.' : 'Bird’s-eye view at about 45° so the layout is clearly visible.';
  if (opt.viewpoint === 'eye') L.push(eye);
  else if (opt.viewpoint === 'aerial') L.push(aerial);
  else L.push(hu ? `Két kép: 1) ${eye} 2) ${aerial}` : `Two images: 1) ${eye} 2) ${aerial}`);
  L.push(
    hu
      ? 'Stílus: fotórealisztikus, természetes színek, emberek, feliratok és vízjel nélkül. A kódokat (pl. LA) ne írd rá a képre.'
      : 'Style: photorealistic, natural colours, no people, no text or watermarks. Do not print the codes (e.g. LA) on the image.',
  );
  const centre = items.length ? centroid(items.map((i) => (i.kind === 'plant' ? [i.x, i.y] : centroid(i.kind === 'drift' ? i.polygon : i.path)) as Pt)) : null;
  if (centre) L.push(hu ? `(A beültetés súlypontja kb. (${fmt(centre[0])}; ${fmt(centre[1])}) m.)` : `(The planting is centred around (${fmt(centre[0])}, ${fmt(centre[1])}) m.)`);
  return L.join('\n');
}
