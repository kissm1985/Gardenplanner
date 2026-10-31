// Random but reasoned planting ideas for one area: species that fit the site, a colour scheme,
// tall plants at the back and low ones at the front, a few species repeated in a rhythm.
import { areaPoints } from '../model/area';
import { KEEP_CLEAR } from '../model/fixtures';
import { bbox, dist, pointInPolygon } from '../model/geometry';
import { uid } from '../model/ids';
import { plantName } from '../model/plants';
import type { Area, Fixture, PlacedItem, Plant, Pt, Settings } from '../model/types';
import { fillPath, fillPolygon } from './fill';
import { areaSunLevel } from './rules';
import { labels, t } from '../i18n';

export type PaletteKey = 'purple-silver' | 'warm' | 'white-blue' | 'pink-purple';

const PALETTE_LABEL = labels<PaletteKey>({
  'purple-silver': ['Lila–ezüst', 'Purple–silver'],
  warm: ['Meleg sárga–bordó', 'Warm yellow–burgundy'],
  'white-blue': ['Fehér–kék–zöld', 'White–blue–green'],
  'pink-purple': ['Rózsaszín–lila', 'Pink–purple'],
});
export const PALETTES: Record<PaletteKey, { readonly label: string; families: string[] }> = {
  'purple-silver': { get label() { return PALETTE_LABEL['purple-silver']; }, families: ['purple', 'blue', 'silver'] },
  warm: { get label() { return PALETTE_LABEL.warm; }, families: ['yellow', 'orange', 'red', 'bronze'] },
  'white-blue': { get label() { return PALETTE_LABEL['white-blue']; }, families: ['white', 'blue', 'green'] },
  'pink-purple': { get label() { return PALETTE_LABEL['pink-purple']; }, families: ['pink', 'purple', 'silver'] },
};

// Hungarian colour words → colour family.
const WORDS: [RegExp, string][] = [
  [/lila|ibolya|levendula|bíbor(?!rózsa)|purple|violet|lavender|mauve/, 'purple'],
  [/kék|blue/, 'blue'],
  [/ezüst|szürk|kékesszürk|silver|grey|gray/, 'silver'],
  [/sárga|arany|yellow|gold/, 'yellow'],
  [/narancs|réz|rozsda|orange|copper|rust/, 'orange'],
  [/piros|vörös|bordó|bíborrózsa|red|burgundy|crimson|scarlet/, 'red'],
  [/bronz|barna/, 'bronze'],
  [/fehér|krém|white|cream/, 'white'],
  [/rózsaszín|magenta|pink/, 'pink'],
];

export function colourFamilies(p: Plant): Set<string> {
  const out = new Set<string>();
  const text = `${p.bloomColor} ${p.foliageColor}`.toLowerCase();
  for (const [re, fam] of WORDS) if (re.test(text)) out.add(fam);
  if (/zöld|green/.test(p.foliageColor.toLowerCase())) out.add('green');
  return out;
}

/** Small seeded PRNG (mulberry32) so an idea can be reproduced from its seed. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seasonsOf = (p: Plant) => new Set<number>(p.bloomMonths.map((m) => (m >= 3 && m <= 5 ? 0 : m >= 6 && m <= 8 ? 1 : m >= 9 && m <= 11 ? 2 : 3)));

/** Plant types the generator can be asked for. */
export type PlantKind = 'perennial' | 'grass' | 'groundcover' | 'shrub' | 'hedge' | 'tree';
export const KIND_LABEL: Record<PlantKind, string> = labels({
  perennial: ['Évelők', 'Perennials'],
  grass: ['Díszfüvek', 'Grasses'],
  groundcover: ['Talajtakarók, elterülők', 'Ground covers, spreading'],
  shrub: ['Cserjék (magasabbak)', 'Shrubs (taller)'],
  hedge: ['Sövény (hátsó sor)', 'Hedge (back row)'],
  tree: ['Fák', 'Trees'],
});
export const DEFAULT_KINDS: PlantKind[] = ['perennial', 'grass', 'groundcover'];
const DRIFT_KINDS: PlantKind[] = ['perennial', 'grass', 'groundcover'];

/** What a species can be used as (a species can be several, e.g. a low spreading shrub). */
export function plantKinds(p: Plant): Set<PlantKind> {
  const k = new Set<PlantKind>();
  if (p.isTree) return k.add('tree');
  const h = p.maxHeightCm;
  if ((h >= 150 && (/sövény/i.test(p.notes) || p.spacingCm <= 0.6 * p.spreadCm)) || (h >= 80 && /sövény/i.test(p.notes))) k.add('hedge');
  if (h >= 100 && p.symbol !== 'triangle') k.add('shrub');
  if (p.symbol === 'square' || (p.spreadCm >= 1.5 * h && h <= 120)) k.add('groundcover');
  if (p.symbol === 'triangle') k.add('grass');
  if (h < 100 && (p.symbol ?? 'circle') === 'circle') k.add('perennial');
  return k;
}

/** Fits the site: sun, height limit, thorns, toxicity, soil, species limits. */
function siteOk(area: Area, p: Plant): boolean {
  const c = area.constraints;
  return (
    p.sun.includes(areaSunLevel(area)) &&
    (c.maxHeightCm == null || p.maxHeightCm <= c.maxHeightCm) &&
    !(c.noThorns && p.thorny) &&
    !(c.nonToxic && p.toxic !== 'no') &&
    !(area.soil && p.soil?.length && !p.soil.includes(area.soil)) &&
    (c.speciesLimits[p.code] ?? 1) > 0
  );
}

/** Species for drifts: perennials, grasses, ground covers small enough to repeat in patches. */
function driftOk(p: Plant): boolean {
  const k = plantKinds(p);
  return !p.isTree && p.symbol !== 'diamond' && p.spacingCm >= 15 && (p.spreadCm <= 120 || (k.has('groundcover') && p.spacingCm <= 120));
}

/** Whether a tree's mature crown fits the area (the layout keeps a slice of ~0.9 × spread for it). */
function treeFits(area: Area, p: Plant): boolean {
  const b = bbox(areaPoints(area));
  const long = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  const short = Math.min(b.maxX - b.minX, b.maxY - b.minY);
  return p.spacingCm * 0.9 * 1.5 <= long && p.spreadCm * 0.6 <= short;
}

/** Eligible species per requested type. */
export function poolsFor(area: Area, plantDb: Plant[], kinds: PlantKind[] = DEFAULT_KINDS) {
  const ok = plantDb.filter((p) => siteOk(area, p));
  const want = new Set(kinds);
  const has = (p: Plant, k: PlantKind) => want.has(k) && plantKinds(p).has(k);
  return {
    drift: ok.filter((p) => driftOk(p) && DRIFT_KINDS.some((k) => has(p, k))),
    hedge: ok.filter((p) => has(p, 'hedge')),
    shrub: ok.filter((p) => has(p, 'shrub') && !p.isTree && p.spacingCm >= 60),
    // A tree needs room for its crown: along the area and across it.
    tree: area.constraints.maxTrees === 0 ? [] : ok.filter((p) => has(p, 'tree') && treeFits(area, p)),
  };
}

/** All species the generator may use for the area and the requested types. */
export function candidates(area: Area, plantDb: Plant[], kinds: PlantKind[] = DEFAULT_KINDS): Plant[] {
  const p = poolsFor(area, plantDb, kinds);
  return [...new Set([...p.drift, ...p.hedge, ...p.shrub, ...p.tree])];
}

export interface Idea {
  seed: number;
  palette: PaletteKey;
  species: Plant[];
  items: PlacedItem[];
  /** Hungarian one-liners explaining the choice. */
  notes: string[];
}

function weighted<T>(r: () => number, xs: T[], w: (x: T) => number): T | undefined {
  const ws = xs.map((x) => Math.max(0, w(x)));
  const sum = ws.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return undefined;
  let t = r() * sum;
  for (let i = 0; i < xs.length; i++) if ((t -= ws[i]) <= 0) return xs[i];
  return xs[xs.length - 1];
}

/** Pick 3–5 species: palette colours, one water class, varied heights, bloom from spring to autumn, winter structure. */
export function pickSpecies(pool: Plant[], palette: PaletteKey, n: number, r: () => number): Plant[] {
  const fams = new Set(PALETTES[palette].families);
  const fit = (p: Plant) => [...colourFamilies(p)].filter((f) => fams.has(f) && f !== 'green').length;
  // Keep to one water band (low+medium or medium+high) so neighbours don't clash.
  const lowSide = pool.filter((p) => p.water !== 'high');
  const highSide = pool.filter((p) => p.water !== 'low');
  const band = lowSide.filter(fit).length >= highSide.filter(fit).length ? lowSide : highSide;
  const chosen: Plant[] = [];
  const covered = new Set<number>();
  for (let i = 0; i < n; i++) {
    const rest = band.filter((p) => !chosen.includes(p));
    const p = weighted(r, rest, (p) => {
      // Off-palette species only fill in when the palette has too few.
      const onPalette = rest.filter((q) => fit(q) > 0).length;
      let w = fit(p) ? 2 + 4 * fit(p) : onPalette >= 2 ? 0.15 : 1;
      if (palette === 'white-blue' && colourFamilies(p).has('green') && !fit(p)) w += 1;
      w += 2 * [...seasonsOf(p)].filter((s) => s < 3 && !covered.has(s)).length;
      if (!chosen.some((q) => q.winterInterest) && p.winterInterest) w += 3;
      if (!chosen.some((q) => q.symbol === 'triangle') && p.symbol === 'triangle') w += 2;
      // Prefer heights unlike the ones already chosen.
      const minGap = Math.min(...chosen.map((q) => Math.abs(q.maxHeightCm - p.maxHeightCm)), 999);
      w *= minGap < 10 ? 0.3 : 1;
      // Juglone-tolerant species are safer near a walnut and well documented.
      if (p.juglone === 'tolerant') w *= 1.3;
      return w * (0.5 + r());
    });
    if (!p) break;
    chosen.push(p);
    for (const s of seasonsOf(p)) covered.add(s);
  }
  return chosen.sort((a, b) => b.maxHeightCm - a.maxHeightCm);
}

// ---------- layout ----------

/** Clip a (possibly concave) polygon by an axis-aligned rectangle (Sutherland–Hodgman). */
export function clipRect(poly: Pt[], x0: number, y0: number, x1: number, y1: number): Pt[] {
  const edges: [(p: Pt) => boolean, (a: Pt, b: Pt) => Pt][] = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  let out = poly;
  for (const [inside, cut] of edges) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[(i + src.length - 1) % src.length];
      const b = src[i];
      if (inside(b)) {
        if (!inside(a)) out.push(cut(a, b));
        out.push(b);
      } else if (inside(a)) out.push(cut(a, b));
    }
    if (!out.length) return [];
  }
  return out.map(([x, y]) => [Math.round(x), Math.round(y)] as Pt);
}

/** Polygon of a blocking fixture (lawn and the KEEP_CLEAR ones: paving, tap, pond, shed…), padded for taps and manholes. */
export function fixturePoly(f: Fixture): Pt[] | null {
  if (f.type !== 'lawn' && !KEEP_CLEAR.has(f.type)) return null;
  if (f.polygon?.length) return f.polygon;
  const pad = f.type === 'tap' || f.type === 'manhole' ? 25 : 0;
  const w = f.w ?? 0;
  const h = f.h ?? 0;
  return [
    [f.x - pad, f.y - pad],
    [f.x + w + pad, f.y - pad],
    [f.x + w + pad, f.y + h + pad],
    [f.x - pad, f.y + h + pad],
  ];
}

type Interval = [number, number];

function subtract(base: Interval, cuts: Interval[]): Interval[] {
  let out: Interval[] = [base];
  for (const [a, b] of cuts)
    out = out.flatMap(([s, e]) => (b <= s || a >= e ? [[s, e] as Interval] : ([[s, a], [b, e]] as Interval[]).filter(([x, y]) => y - x > 0)));
  return out;
}

export function generateIdea(
  area: Area,
  plantDb: Plant[],
  settings: Settings,
  opts: {
    seed?: number;
    palette?: PaletteKey;
    kinds?: PlantKind[];
    /** Single plants instead of drifts, no two of the same species side by side. */
    mixed?: boolean;
    /** Extra distance between plants, cm (sparser planting). */
    extraGapCm?: number;
  } = {},
): Idea {
  const extra = Math.max(0, Math.round(opts.extraGapCm ?? 0));
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const r = rng(seed);
  const kinds = opts.kinds?.length ? opts.kinds : DEFAULT_KINDS;
  const keys = Object.keys(PALETTES) as PaletteKey[];
  const pools = poolsFor(area, plantDb, kinds);
  const all = [...new Set([...pools.drift, ...pools.hedge, ...pools.shrub, ...pools.tree])];
  // Palette: the requested one, or a random one that the pool can actually serve.
  const serve = (k: PaletteKey) => all.filter((p) => [...colourFamilies(p)].some((f) => PALETTES[k].families.includes(f) && f !== 'green')).length;
  const palette = opts.palette ?? weighted(r, keys, (k) => (serve(k) >= 3 ? 1 : 0)) ?? keys[Math.floor(r() * keys.length)];

  const pts = areaPoints(area);
  const bb = bbox(pts);
  const m2 = ((bb.maxX - bb.minX) * (bb.maxY - bb.minY)) / 1e4;
  const notes: string[] = [];

  // Mostly under a walnut: plan with juglone-tolerant species only (if there are enough).
  const walnuts = area.fixtures.filter((f) => f.type === 'walnut');
  const inWalnut = (q: Pt) => walnuts.some((f) => dist(q, [f.x, f.y]) <= settings.walnutRadiusCm);
  let inZone = 0;
  let total = 0;
  for (let x = bb.minX + 25; x < bb.maxX; x += 50)
    for (let y = bb.minY + 25; y < bb.maxY; y += 50)
      if (pointInPolygon([x, y], pts)) {
        total++;
        if (inWalnut([x, y])) inZone++;
      }
  const underWalnut = total > 0 && inZone / total > 0.4 && all.filter((p) => p.juglone === 'tolerant').length >= 3;
  const tol = (xs: Plant[]) => (underWalnut ? xs.filter((p) => p.juglone === 'tolerant') : xs);
  if (underWalnut)
    notes.push(t('A terület nagy része a diófa zónájában van, ezért csak juglone-tűrő fajokból válogattam.', 'Most of the area is in the walnut zone, so only juglone-tolerant species were used.'));

  // One water band for everything (low+medium or medium+high), so neighbours don't clash.
  const lowSide = all.filter((p) => p.water !== 'high').length >= all.filter((p) => p.water !== 'low').length;
  const wb = (xs: Plant[]) => tol(xs).filter((p) => (lowSide ? p.water !== 'high' : p.water !== 'low'));

  const hedge = pickSpecies(wb(pools.hedge), palette, 1, r)[0];
  const trees = pickSpecies(wb(pools.tree).filter((p) => p !== hedge), palette, 1, r);
  const shrubs = pickSpecies(wb(pools.shrub).filter((p) => p !== hedge), palette, m2 > 20 ? 2 : 1, r);
  const woody = !!hedge || trees.length > 0 || shrubs.length > 0;
  const nDrift = (m2 < 4 ? 3 : m2 < 12 ? 4 : 5) - (woody ? 1 : 0);
  // On large areas tiny plants would mean hundreds of pots per patch.
  const minSpacing = m2 > 40 ? 25 : 15;
  const species = pickSpecies(
    wb(pools.drift).filter((p) => p !== hedge && !shrubs.includes(p) && p.spacingCm >= minSpacing),
    palette,
    nDrift,
    r,
  );
  for (const k of kinds) {
    const empty = k === 'hedge' ? !hedge : k === 'tree' ? !trees.length : k === 'shrub' ? !shrubs.length : !species.some((p) => plantKinds(p).has(k));
    if (empty)
      notes.push(
        t(
          `${KIND_LABEL[k]}: ehhez a területhez (fény, magasság, mérgező, talaj, korlátok) nincs megfelelő faj.`,
          `${KIND_LABEL[k]}: no species fits this area (light, height, toxicity, soil, limits).`,
        ),
      );
  }
  if (!species.length && !woody) return { seed, palette, species: [], items: [], notes: [...notes, t('Nincs a terület feltételeinek megfelelő faj az adatbázisban.', 'No species in the database fits the area.')] };

  // Long axis u, short axis v.
  const alongY = bb.maxY - bb.minY >= bb.maxX - bb.minX;
  const U = (u: number, v: number): Pt => (alongY ? [v, u] : [u, v]);
  const [u0, u1] = alongY ? [bb.minY, bb.maxY] : [bb.minX, bb.maxX];
  const [v0, v1] = alongY ? [bb.minX, bb.maxX] : [bb.minY, bb.maxY];
  const blockers = area.fixtures.map(fixturePoly).filter((p): p is Pt[] => !!p);
  const walls = area.fixtures.filter((f) => f.type === 'wall' || f.type === 'fence');
  const gap = 6; // cm between neighbouring drifts, so their edge plants keep spacing
  const tolerantDrift = species.filter((p) => p.juglone === 'tolerant');
  const inside = (q: Pt) => pointInPolygon(q, pts);

  const items: PlacedItem[] = [];
  const cellBase = 150 + Math.round(r() * 80);
  const usedCodes = new Set<string>();
  /** Single plants of the mixed planting, to keep neighbours different. */
  const singles: { q: Pt; code: string; sp: number }[] = [];
  const add = (it: PlacedItem) => {
    usedCodes.add(it.plantId);
    items.push(it);
  };

  // Trees: evenly along the long axis, each in its own slice with nothing else around it.
  const tree = trees[0];
  const maxTrees = area.constraints.maxTrees ?? 2;
  const treeLen = tree ? Math.max(cellBase, Math.round(tree.spacingCm * 0.9)) : 0;
  const nTrees = tree ? Math.min(maxTrees, Math.max(u1 - u0 >= treeLen * 1.5 ? 1 : 0, Math.floor((u1 - u0) / (treeLen * 2.5)))) : 0;
  const treeAt = Array.from({ length: nTrees }, (_, k) => u0 + ((k + 0.5) * (u1 - u0)) / nTrees);
  let treesPlaced = 0;

  // Distance from v to a wall/fence on the short axis (for deciding which side is "back").
  const wallV = walls.map((f) => (alongY ? f.x + (f.w ?? 0) / 2 : f.y + (f.h ?? 0) / 2));

  for (let s = u0, cell = 0; s < u1 - 20; cell++) {
    const nextTree = treeAt[treesPlaced];
    const isTreeSlice = nextTree != null && s + treeLen / 2 >= nextTree - cellBase / 2 && u1 - s >= treeLen * 0.8;
    const e = isTreeSlice ? Math.min(u1, s + treeLen) : Math.min(u1, s + cellBase * (0.8 + r() * 0.4));
    const end = u1 - e < 60 ? u1 : e; // don't leave a sliver at the end
    if (isTreeSlice) treesPlaced++;
    // Blocked short-axis intervals within this slice.
    const cuts: Interval[] = [];
    for (const b of blockers) {
      const [x0, y0, x1, y1] = alongY ? [-1e6, s, 1e6, end] : [s, -1e6, end, 1e6];
      const part = clipRect(b, x0, y0, x1, y1);
      if (part.length < 3) continue;
      const pb = bbox(part);
      cuts.push(alongY ? [pb.minX - gap, pb.maxX + gap] : [pb.minY - gap, pb.maxY + gap]);
    }
    const free = subtract([v0, v1], cuts).filter(([a, b]) => b - a >= 35);
    for (const [a, b] of free) {
      const w = b - a;
      // Back = the side nearer a wall/fence; else the side away from a blocked strip (lawn, path).
      const touchesCutA = cuts.some(([, y]) => Math.abs(y - a) < gap + 1);
      const touchesCutB = cuts.some(([x]) => Math.abs(x - b) < gap + 1);
      const wallNearA = wallV.length ? Math.min(...wallV.map((c) => Math.abs(c - a))) : Infinity;
      const wallNearB = wallV.length ? Math.min(...wallV.map((c) => Math.abs(c - b))) : Infinity;
      const backAtA = wallNearA !== wallNearB ? wallNearA < wallNearB : touchesCutA !== touchesCutB ? touchesCutB : a <= v0 + 1;
      // v at a depth measured from the back edge.
      const V = (depth: number) => (backAtA ? a + depth : b - depth);
      let depth = 0;

      // 1) Hedge: one row along the back edge.
      if (hedge) {
        const hw = Math.ceil(Math.max(0.65 * hedge.spacingCm, Math.min(hedge.spreadCm, 0.4 * w)));
        const room = w - hw >= (species.length || shrubs.length ? 35 : 0);
        // At the area's ends keep the whole canopy inside; between slices half a spacing is enough.
        const endPad = Math.max(hedge.spacingCm, hedge.spreadCm) / 2;
        const ua = s + (s <= u0 + 1 ? endPad : hedge.spacingCm / 2);
        const ub = end - (end >= u1 - 1 ? endPad : hedge.spacingCm / 2);
        if (room && ub >= ua && !(hedge.juglone !== 'tolerant' && walnuts.length && [U(ua, V(hw / 2)), U(ub, V(hw / 2))].some(inWalnut))) {
          const path: Pt[] = ub - ua < 1 ? [U(ua, V(hw / 2))] : [U(ua, V(hw / 2)), U(ub, V(hw / 2))];
          const ps = fillPath(path, hedge.spacingCm);
          if (ps.every(inside)) {
            add({ kind: 'row', id: uid(), plantId: hedge.code, path: path.map(([x, y]) => [Math.round(x), Math.round(y)] as Pt), spacingCm: hedge.spacingCm, count: ps.length, status: 'needed' });
            depth = hw;
          }
        }
      }

      // 2) Tree slice: the tree alone (plus the hedge behind it), placed so it keeps its distance.
      if (isTreeSlice) {
        const needH = hedge && depth ? 0.3 * (tree.spacingCm + hedge.spacingCm) + hedge.spacingCm * 0.33 : 0;
        const d = Math.max(depth + needH, depth + (w - depth) / 2);
        const q = U((s + end) / 2, V(Math.min(d, w - 20)));
        if (d <= w - 20 && inside(q) && !(tree.juglone !== 'tolerant' && inWalnut(q)))
          add({ kind: 'plant', id: uid(), plantId: tree.code, x: Math.round(q[0]), y: Math.round(q[1]), status: 'needed' });
        continue;
      }

      // 3) Shrubs: single plants in rhythm in a strip in front of the hedge.
      if (shrubs.length) {
        const sp = Math.max(...shrubs.map((p) => p.spacingCm)) + extra;
        const sw = Math.ceil(Math.max(0.65 * sp, Math.min(Math.max(...shrubs.map((p) => p.spreadCm)), 0.5 * (w - depth))));
        if (w - depth - sw >= (species.length ? 35 : 0) && w - depth >= sw) {
          let k = cell;
          const pad = Math.max(sp, ...shrubs.map((p) => p.spreadCm)) / 2;
          const from = s + (s <= u0 + 1 ? pad : sp / 2);
          const to = end - (end >= u1 - 1 ? pad : sp / 2);
          for (let u = from; u <= to + 1; u += sp, k++) {
            const pl = shrubs[k % shrubs.length];
            const q = U(u, V(depth + sw / 2));
            if (!inside(q) || (pl.juglone !== 'tolerant' && inWalnut(q))) continue;
            add({ kind: 'plant', id: uid(), plantId: pl.code, x: Math.round(q[0]), y: Math.round(q[1]), status: 'needed' });
          }
          depth += sw;
        }
      }

      // 4) Drifts in the rest: tallest at the back, lowest at the front.
      // Drifts tile the strip without gaps; a square grid keeps half a spacing inside every edge,
      // so plants of neighbouring drifts are a full spacing apart without any extra margin.
      const rest = w - depth;
      if (!species.length || rest < 30) continue;
      const bands = Math.max(1, Math.min(3, species.length, Math.round(rest / 100)));
      const tiers: Plant[][] = Array.from({ length: bands }, () => []);
      species.forEach((p, i) => tiers[Math.min(bands - 1, Math.floor((i * bands) / species.length))].push(p));
      const bw = rest / bands;
      const len = end - s;
      /** Fits the band and the slice: at least one plant across, two along. */
      const fits = (p: Plant) => p.spacingCm + extra <= bw + 1 && 2 * (p.spacingCm + extra) <= len + 1;
      const backV = V(depth);
      for (let k = 0; k < bands; k++) {
        const tier = tiers[k].length ? tiers[k] : species;
        const da = depth + k * bw;
        const db = depth + (k + 1) * bw;
        const [va, vb] = [Math.min(V(da), V(db)), Math.max(V(da), V(db))];
        const rect = [U(s, va), U(end, vb)];
        const [x0, y0] = [Math.min(rect[0][0], rect[1][0]), Math.min(rect[0][1], rect[1][1])];
        const [x1, y1] = [Math.max(rect[0][0], rect[1][0]), Math.max(rect[0][1], rect[1][1])];
        const outer = clipRect(pts, x0, y0, x1, y1);
        if (outer.length < 3) continue;
        const walnutHere = walnuts.length > 0 && outer.some(inWalnut);
        const ok = (p: Plant) => fits(p) && (!walnutHere || p.juglone === 'tolerant');
        // The tier's own species if it fits; else the closest in height that does.
        const own = tier.filter(ok);
        const byHeight = (h: number) => [...species, ...tolerantDrift].filter(ok).sort((x, y) => Math.abs(x.maxHeightCm - h) - Math.abs(y.maxHeightCm - h));
        const cands = own.length ? [...own.slice((cell + k) % own.length), ...own.slice(0, (cell + k) % own.length)] : byHeight(tier[0].maxHeightCm).slice(0, 3);
        if (!cands.length) continue;
        // Rows run along x; a staggered layout is safe where no other drift sits beside the rows (one band along a long-in-y strip).
        const pattern: 'grid' | 'staggered' = alongY && bands === 1 ? 'staggered' : 'grid';
        /** How much of its strip a species would fill here (narrow beds suit small spacings). */
        const fill = (p: Plant) => {
          const sp = p.spacingCm + extra;
          const n = fillPolygon(clipRect(pts, x0, y0, x1, y1), sp, pattern).length;
          return (n * sp * sp) / Math.max(1, (x1 - x0) * (y1 - y0));
        };
        const best = Math.max(...cands.map(fill));
        // Keep the rhythm (first candidate) unless it would leave the strip clearly emptier than another one.
        const plant = cands.find((p) => fill(p) >= best * 0.75) ?? cands[0];
        // At the area's edge keep the mature spread inside (ground covers spread wider than their spacing);
        // next to the shrub / hedge strip leave a quarter spacing.
        const edgeIns = Math.min(Math.ceil(Math.max(0, plant.spreadCm - plant.spacingCm) / 2), 40);
        const back = k === 0 && depth > 0 ? Math.ceil(plant.spacingCm * 0.25) : 0;
        const ins = (v: number, edge: number) => (Math.abs(v - edge) < 1 ? edgeIns : Math.abs(v - backV) < 1 ? back : 0);
        const poly = clipRect(pts, x0 + ins(x0, bb.minX), y0 + ins(y0, bb.minY), x1 - ins(x1, bb.maxX), y1 - ins(y1, bb.maxY));
        if (poly.length < 3) continue;
        if (opts.mixed) {
          // Mixed planting: single plants on one tight grid; each spot gets a species that is not next door
          // and keeps its spacing to everything already planted.
          const near = [...tier, ...(tiers[k - 1] ?? []), ...(tiers[k + 1] ?? [])];
          let pick = [...new Set(tier.length >= 2 ? tier : near)].filter(ok);
          // Fewer than two fit this strip: widen to every species that fits, so neighbours can still differ.
          if (pick.length < 2) pick = [...new Set([...pick, ...species.filter(ok)])];
          if (!pick.length) continue;
          const grid = (0.95 * pick.reduce((a, p) => a + p.spacingCm, 0)) / pick.length + extra;
          for (const q of fillPolygon(poly, grid, 'staggered')) {
            if (!inside(q)) continue;
            const around = singles.filter((o) => dist(o.q, q) < 2.2 * (grid + extra));
            const free = pick.filter(
              (p) =>
                around.every((o) => dist(o.q, q) >= 0.88 * ((p.spacingCm + o.sp) / 2 + extra)) &&
                (pick.length < 2 || !around.some((o) => o.code === p.code && dist(o.q, q) < 1.6 * ((p.spacingCm + o.sp) / 2 + extra))),
            );
            if (!free.length) continue;
            const pl = free[Math.floor(r() * free.length)];
            singles.push({ q, code: pl.code, sp: pl.spacingCm });
            add({ kind: 'plant', id: uid(), plantId: pl.code, x: Math.round(q[0]), y: Math.round(q[1]), status: 'needed' });
          }
          continue;
        }
        // Without extra distance, the spacing may tighten by up to 12 % when that fits one more row or column.
        let dsp = plant.spacingCm + extra;
        let ps = fillPolygon(poly, dsp, pattern);
        if (!extra) {
          const pb = bbox(poly);
          const [pw, ph] = [pb.maxX - pb.minX, pb.maxY - pb.minY];
          for (const c of [pw / (Math.floor(pw / dsp) + 1), ph / (Math.floor(ph / dsp) + 1)]) {
            if (c < dsp * 0.88) continue;
            const alt = fillPolygon(poly, Math.ceil(c), pattern);
            if (alt.length > ps.length) [dsp, ps] = [Math.ceil(c), alt];
          }
        }
        if (!ps.length || ps.some((q) => !inside(q))) continue;
        add({ kind: 'drift', id: uid(), plantId: plant.code, polygon: poly, pattern, spacingCm: dsp, count: ps.length, status: 'needed' });
      }
    }
    s = end;
  }

  const ordered = [...(hedge ? [hedge] : []), ...trees, ...shrubs, ...species];
  const used = ordered.filter((p) => usedCodes.has(p.code));
  notes.push(t(`Színvilág: ${PALETTES[palette].label}.`, `Colour scheme: ${PALETTES[palette].label}.`));
  const parts: string[] = [];
  if (hedge && usedCodes.has(hedge.code)) parts.push(t(`hátul ${plantName(hedge).toLowerCase()} sövény`, `a ${plantName(hedge).toLowerCase()} hedge at the back`));
  if (tree && usedCodes.has(tree.code))
    parts.push(
      t(
        `${treesPlaced > 1 ? 'fák' : 'egy fa'} (${plantName(tree).toLowerCase()}) körülöttük szabad hellyel`,
        `${treesPlaced > 1 ? 'trees' : 'a tree'} (${plantName(tree).toLowerCase()}) with free space around`,
      ),
    );
  const sh = shrubs.filter((p) => usedCodes.has(p.code));
  if (sh.length)
    parts.push(t(`előtte cserjék ritmusban (${sh.map((p) => plantName(p).toLowerCase()).join(', ')})`, `shrubs in rhythm in front (${sh.map((p) => plantName(p).toLowerCase()).join(', ')})`));
  const dr = species.filter((p) => usedCodes.has(p.code));
  if (dr.length)
    parts.push(
      opts.mixed
        ? t(`${dr.length} faj vegyesen, tövenként váltakozva – azonos faj nem kerül egymás mellé`, `${dr.length} species mixed plant by plant – no two of the same side by side`)
        : t(`${dr.length} faj ismétlődő foltokban, elöl az alacsonyabbak`, `${dr.length} species in repeated drifts, lower ones in front`),
    );
  if (extra) notes.push(t(`A tövek között ${extra} cm-rel nagyobb a távolság a javasoltnál (ritkább ültetés).`, `Plants are ${extra} cm further apart than recommended (sparser planting).`));
  if (parts.length) notes.push(`${parts.join('; ')}.`.replace(/^./, (c) => c.toUpperCase()));
  const seasons = new Set(used.flatMap((p) => [...seasonsOf(p)]));
  const sName = [t('tavasz', 'spring'), t('nyár', 'summer'), t('ősz', 'autumn')].filter((_, i) => seasons.has(i as 0 | 1 | 2));
  if (sName.length) notes.push(t(`Virágzás: ${sName.join(', ')}.`, `Flowering: ${sName.join(', ')}.`));
  const winter = used.filter((p) => p.winterInterest);
  notes.push(
    winter.length
      ? t(`Télen is díszít: ${winter.map((p) => plantName(p).toLowerCase()).join(', ')}.`, `Winter interest: ${winter.map((p) => plantName(p).toLowerCase()).join(', ')}.`)
      : t('Télen kevés a díszítő elem.', 'Little winter interest.'),
  );
  return { seed, palette, species: used, items, notes };
}
