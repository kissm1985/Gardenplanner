// Rule engine (SPEC §4.5). Pure function of the area, its active items, the plant list and the
// settings; runs after every change. Warnings carry a stable id so the user can mute them.
import { centroid, dist, pointInPolygon } from '../model/geometry';
import { JUGLONE_LABEL, SOIL_LABEL, SUN_LABEL, TOXIC_LABEL, WATER_LABEL } from '../model/plants';
import type { Area, Fixture, PlacedItem, Plant, Pt, Settings, SunNeed, WaterNeed } from '../model/types';
import { itemPositions } from './fill';

export type Severity = 'error' | 'warn' | 'info';
export type RuleId =
  | 'height'
  | 'thorny'
  | 'toxic'
  | 'juglone'
  | 'spacing'
  | 'outside'
  | 'species-limit'
  | 'trees'
  | 'water-mix'
  | 'sun'
  | 'soil'
  | 'fixture'
  | 'window'
  | 'lawn';

export interface Warning {
  id: string;
  rule: RuleId;
  severity: Severity;
  itemIds: string[];
  /** Where to jump / draw the marker (cm). */
  at: Pt;
  message: string;
  hint?: string;
}

export const RULE_LABEL: Record<RuleId, string> = {
  height: 'Magasság',
  thorny: 'Tüske',
  toxic: 'Mérgező',
  juglone: 'Juglone',
  spacing: 'Tőtáv',
  outside: 'Határon kívül',
  'species-limit': 'Fajkorlát',
  trees: 'Fák száma',
  'water-mix': 'Vízigény',
  sun: 'Napigény',
  soil: 'Talaj',
  fixture: 'Rögzített elem',
  window: 'Ablak',
  lawn: 'Gyep',
};

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
const WATER_RANK: Record<WaterNeed, number> = { low: 0, medium: 1, high: 2 };
/** Below this share of the recommended spacing two plants count as too close. */
export const SPACING_TOLERANCE = 0.6;
const WINDOW_REACH_CM = 80;
const WINDOW_MAX_HEIGHT_CM = 100;

// ---------- area sun level ----------

/** Hours of direct sun from a free-text note such as "13:00-ig", "délig", "14:00-tól". */
export function sunHours(sunUntil: string): number | null {
  const t = sunUntil.toLowerCase().trim();
  if (!t) return null;
  if (/egész nap/.test(t)) return 10;
  if (/délig/.test(t)) return 12 - 7;
  if (/délután/.test(t)) return 19 - 13;
  const m = t.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(?:óra)?\s*-?\s*(ig|tól|től)?/);
  if (!m) return null;
  const h = +m[1] + (m[2] ? +m[2] / 60 : 0);
  // Assume direct sun from ~7:00 to ~19:00 in the growing season (Győr).
  return m[3] === 'tól' || m[3] === 'től' ? Math.max(0, 19 - h) : Math.max(0, h - 7);
}

export function areaSunLevel(area: Area): SunNeed {
  if (area.sunLevel) return area.sunLevel;
  const h = sunHours(area.sunUntil);
  if (h != null) return h >= 6 ? 'sun' : h >= 3 ? 'part' : 'shade';
  if (area.kind === 'shade') return 'shade';
  return ['S', 'SE', 'SW'].includes(area.orientation) ? 'sun' : ['E', 'W'].includes(area.orientation) ? 'part' : 'shade';
}

// ---------- helpers ----------

interface Pos {
  item: PlacedItem;
  plant: Plant;
  p: Pt;
}

const inArea = (area: Area, [x, y]: Pt, tol = 1) =>
  area.shape.kind === 'polygon'
    ? pointInPolygon([x, y], area.shape.points)
    : x >= -tol && y >= -tol && x <= area.widthCm + tol && y <= area.lengthCm + tol;

const inRect = (f: Fixture, [x, y]: Pt, pad = 0) =>
  x >= f.x - pad && y >= f.y - pad && x <= f.x + (f.w ?? 0) + pad && y <= f.y + (f.h ?? 0) + pad;

const anchorOf = (it: PlacedItem): Pt => (it.kind === 'plant' ? [it.x, it.y] : centroid(it.kind === 'drift' ? it.polygon : it.path));

const plural = (items: PlacedItem[], tő: number) => (items.length > 1 ? ` (${items.length} elem, ${tő} tő)` : tő > 1 ? ` (${tő} tő)` : '');

/** Uniform grid for neighbour queries, so 1000+ positions stay fast. */
function neighbours(pos: Pos[], cell: number, fn: (a: Pos, b: Pos) => void) {
  const grid = new Map<string, Pos[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  for (const q of pos) {
    const k = key(Math.floor(q.p[0] / cell), Math.floor(q.p[1] / cell));
    const arr = grid.get(k);
    if (arr) arr.push(q);
    else grid.set(k, [q]);
  }
  for (const [k, arr] of grid) {
    const [cx, cy] = k.split(',').map(Number);
    for (let dx = 0; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy < 0) continue; // visit each neighbouring cell pair once
        const other = dx === 0 && dy === 0 ? arr : grid.get(key(cx + dx, cy + dy));
        if (!other) continue;
        for (let i = 0; i < arr.length; i++)
          for (let j = other === arr ? i + 1 : 0; j < other.length; j++) fn(arr[i], other[j]);
      }
  }
}

// ---------- engine ----------

export function evaluate(area: Area, items: PlacedItem[], plantDb: Plant[], settings: Settings): Warning[] {
  const plants = new Map(plantDb.map((p) => [p.code, p]));
  const out: Warning[] = [];
  const c = area.constraints;
  const sunLevel = areaSunLevel(area);

  // Positions per item, computed once.
  const posByItem = new Map<string, Pt[]>();
  const all: Pos[] = [];
  for (const it of items) {
    const plant = plants.get(it.plantId);
    if (!plant) continue;
    const ps = itemPositions(it);
    posByItem.set(it.id, ps);
    for (const p of ps) all.push({ item: it, plant, p });
  }

  // Species-level rules: one warning per species, listing all its items.
  const bySpecies = new Map<string, PlacedItem[]>();
  for (const it of items) if (plants.has(it.plantId)) bySpecies.set(it.plantId, [...(bySpecies.get(it.plantId) ?? []), it]);
  const walnuts = area.fixtures.filter((f) => f.type === 'walnut');

  for (const [code, its] of bySpecies) {
    const p = plants.get(code)!;
    const n = its.reduce((s, it) => s + (posByItem.get(it.id)?.length ?? 0), 0);
    const ids = its.map((i) => i.id);
    const at = anchorOf(its[0]);
    const name = `${p.nameHu}${plural(its, n)}`;
    const add = (rule: RuleId, severity: Severity, message: string, hint?: string, itemIds = ids, where = at) =>
      out.push({ id: `${rule}:${code}`, rule, severity, itemIds, at: where, message, hint });

    if (c.maxHeightCm != null && p.maxHeightCm > c.maxHeightCm)
      add('height', 'error', `${name}: ${p.maxHeightCm} cm magasra nő, a terület korlátja ${c.maxHeightCm} cm.`, 'Válassz alacsonyabb fajt vagy fajtát.');

    if (c.noThorns && p.thorny) add('thorny', 'error', `${name} tüskés, ezen a területen nem lehet tüskés növény.`);

    if (c.nonToxic && p.toxic !== 'no') {
      if (p.toxic === 'unknown')
        add('toxic', 'warn', `${name}: a mérgező hatás nem ismert, a terület nem mérgező növényt kér.`, 'Nézz utána, vagy jelöld tudatos kivételnek.');
      else add('toxic', 'error', `${name} mérgező (${TOXIC_LABEL[p.toxic]}), a terület nem mérgező növényt kér.`);
    }

    if (!p.sun.includes(sunLevel))
      add(
        'sun',
        'warn',
        `${name} napigénye: ${p.sun.map((s) => SUN_LABEL[s]).join('/')}, a terület ${SUN_LABEL[sunLevel]}${area.sunUntil ? ` (napos ${area.sunUntil})` : ''}.`,
        sunLevel === 'sun' ? 'Tűző napon öntözd az első évben.' : 'Az első évben figyeld, elég napot kap-e.',
      );

    if (area.soil && p.soil?.length && !p.soil.includes(area.soil))
      add(
        'soil',
        'info',
        `${name}: ${SOIL_LABEL[area.soil]} talajba kevésbé való (kedveli: ${p.soil.map((x) => SOIL_LABEL[x]).join(', ')}).`,
        area.soil === 'clay' ? 'Agyagos talajba homokot, apró kavicsot keverj az ültetőgödörbe, vagy válassz más fajt.' : 'Javítsd a talajt az ültetőgödörben, vagy válassz más fajt.',
      );

    // Juglone: any position within the walnut radius.
    if (walnuts.length && p.juglone !== 'tolerant') {
      const r = settings.walnutRadiusCm;
      const inZone = its.filter((it) => (posByItem.get(it.id) ?? []).some((q) => walnuts.some((w) => dist(q, [w.x, w.y]) <= r)));
      if (inZone.length) {
        const zoneIds = inZone.map((i) => i.id);
        const label = `${p.nameHu}${plural(inZone, inZone.reduce((s, it) => s + (posByItem.get(it.id)?.length ?? 0), 0))}`;
        if (p.juglone === 'sensitive')
          add('juglone', 'error', `${label} juglone-érzékeny, és a diófa ${r / 100} m-es zónájában van.`, 'Tedd a zónán kívülre, vagy válassz juglone-tűrő fajt.', zoneIds, anchorOf(inZone[0]));
        else
          add(
            'juglone',
            'warn',
            `${label}: juglone-tűrése ${JUGLONE_LABEL[p.juglone]}, a diófa ${r / 100} m-es zónájában van.`,
            'Javaslat: jól dokumentált tűrő fajt tegyél a dió felőli oldalra (pl. ligeti zsálya, macskamenta, bergénia, kék gólyaorr), ezt pedig kezeld próbaültetésként.',
            zoneIds,
            anchorOf(inZone[0]),
          );
      }
    }

    const limit = c.speciesLimits[code];
    if (limit != null && n > limit)
      add('species-limit', 'warn', `${p.nameHu}: ${n} tő van a területen, a beállított korlát ${limit}.`, 'Csökkentsd a darabszámot, vagy emeld a korlátot a terület beállításainál.');
  }

  // Trees.
  if (c.maxTrees != null) {
    const trees = items.filter((it) => plants.get(it.plantId)?.isTree);
    const n = trees.reduce((s, it) => s + (posByItem.get(it.id)?.length ?? 0), 0);
    if (n > c.maxTrees)
      out.push({
        id: 'trees',
        rule: 'trees',
        severity: 'error',
        itemIds: trees.map((t) => t.id),
        at: anchorOf(trees[0]),
        message: `${n} fa van a területen, legfeljebb ${c.maxTrees} lehet.`,
      });
  }

  // Per-item rules.
  for (const it of items) {
    const p = plants.get(it.plantId);
    if (!p) continue;
    const ps = posByItem.get(it.id) ?? [];
    const outside = ps.filter((q) => !inArea(area, q));
    if (outside.length)
      out.push({
        id: `outside:${it.id}`,
        rule: 'outside',
        severity: 'error',
        itemIds: [it.id],
        at: outside[0],
        message: `${p.nameHu}: ${ps.length > 1 ? `${outside.length} tő ` : ''}a terület határán kívül van.`,
        hint: 'Húzd vissza a területre.',
      });

    if (it.kind !== 'plant' && it.spacingCm < p.spacingCm * SPACING_TOLERANCE)
      out.push({
        id: `spacing:${it.id}`,
        rule: 'spacing',
        severity: 'warn',
        itemIds: [it.id],
        at: anchorOf(it),
        message: `${p.nameHu} ${it.kind === 'drift' ? 'foltjában' : 'sorában'} a tőtáv ${it.spacingCm} cm, a javasolt ${p.spacingCm} cm.`,
        hint: 'A tövek túl sűrűn lesznek; növeld a tőtávot.',
      });

    for (const f of area.fixtures) {
      if (f.type === 'lawn' && f.polygon && f.polygon.length >= 3) {
        const hit = ps.filter((q) => pointInPolygon(q, f.polygon!));
        if (hit.length)
          out.push({
            id: `lawn:${it.id}:${f.id}`,
            rule: 'lawn',
            severity: 'warn',
            itemIds: [it.id],
            at: hit[0],
            message: `${p.nameHu}: ${hit.length > 1 ? `${hit.length} tő ` : ''}a(z) „${f.label || 'gyep'}” területére esik.`,
            hint: 'A gyepre nem kerül növény; húzd az ágyásba, vagy igazítsd a gyep alakját.',
          });
      }
      if (f.type === 'tap' || f.type === 'manhole' || f.type === 'paving') {
        const hit = ps.filter((q) => inRect(f, q));
        if (hit.length)
          out.push({
            id: `fixture:${it.id}:${f.id}`,
            rule: 'fixture',
            severity: 'warn',
            itemIds: [it.id],
            at: hit[0],
            message: `${p.nameHu}: ${hit.length > 1 ? `${hit.length} tő ` : ''}a(z) „${f.label ?? 'elem'}” helyére esik.`,
            hint: 'A csapot, aknát és burkolatot hagyd szabadon.',
          });
      }
      if (f.type === 'window' && p.maxHeightCm > WINDOW_MAX_HEIGHT_CM) {
        const hit = ps.filter((q) => inRect(f, q, WINDOW_REACH_CM));
        if (hit.length)
          out.push({
            id: `window:${it.id}:${f.id}`,
            rule: 'window',
            severity: 'info',
            itemIds: [it.id],
            at: hit[0],
            message: `${p.nameHu} (${p.maxHeightCm} cm) eltakarhatja az ablakot.`,
          });
      }
    }
  }

  // Pairwise: spacing overlap and water mix between different items.
  const maxSpacing = Math.max(10, ...plantDb.filter((p) => bySpecies.has(p.code)).map((p) => p.spacingCm));
  const tooClose = new Map<string, { a: Pos; b: Pos }>();
  const waterMix = new Map<string, { a: Pos; b: Pos }>();
  neighbours(all, maxSpacing * 1.5, (a, b) => {
    if (a.item.id === b.item.id) return;
    const d = dist(a.p, b.p);
    const need = (a.plant.spacingCm + b.plant.spacingCm) / 2;
    const key = [a.item.id, b.item.id].sort().join('|');
    if (d < need * SPACING_TOLERANCE && !tooClose.has(key)) tooClose.set(key, { a, b });
    if (d < need * 1.5 && Math.abs(WATER_RANK[a.plant.water] - WATER_RANK[b.plant.water]) >= 2 && !waterMix.has(key)) waterMix.set(key, { a, b });
  });
  for (const [key, { a, b }] of tooClose)
    out.push({
      id: `spacing:${key}`,
      rule: 'spacing',
      severity: 'warn',
      itemIds: [a.item.id, b.item.id],
      at: [(a.p[0] + b.p[0]) / 2, (a.p[1] + b.p[1]) / 2],
      message:
        a.plant.code === b.plant.code
          ? `Két ${a.plant.nameHu} túl közel (${Math.round(dist(a.p, b.p))} cm, javasolt ${a.plant.spacingCm} cm).`
          : `${a.plant.nameHu} és ${b.plant.nameHu} túl közel (${Math.round(dist(a.p, b.p))} cm, javasolt ${Math.round((a.plant.spacingCm + b.plant.spacingCm) / 2)} cm).`,
      hint: 'A kifejlett tövek erősen fedni fogják egymást.',
    });
  for (const [key, { a, b }] of waterMix)
    out.push({
      id: `water-mix:${key}`,
      rule: 'water-mix',
      severity: 'warn',
      itemIds: [a.item.id, b.item.id],
      at: [(a.p[0] + b.p[0]) / 2, (a.p[1] + b.p[1]) / 2],
      message: `Eltérő vízigény egymás mellett: ${a.plant.nameHu} (${WATER_LABEL[a.plant.water]}) és ${b.plant.nameHu} (${WATER_LABEL[b.plant.water]}).`,
      hint: 'Csepegtetőnél a két csoport ugyanannyi vizet kap; tedd őket külön öntözési zónába.',
    });

  return out.sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);
}

/** Split into active and muted lists for a variant. */
export function partition(ws: Warning[], muted: string[] | undefined) {
  const m = new Set(muted ?? []);
  return { active: ws.filter((w) => !m.has(w.id)), muted: ws.filter((w) => m.has(w.id)) };
}
