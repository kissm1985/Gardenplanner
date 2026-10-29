// Random but reasoned planting ideas for one area: species that fit the site, a colour scheme,
// tall plants at the back and low ones at the front, a few species repeated in a rhythm.
import { areaPoints } from '../model/area';
import { bbox, dist, pointInPolygon } from '../model/geometry';
import { uid } from '../model/ids';
import type { Area, Fixture, PlacedItem, Plant, Pt, Settings } from '../model/types';
import { fillPolygon } from './fill';
import { areaSunLevel } from './rules';

export type PaletteKey = 'purple-silver' | 'warm' | 'white-blue' | 'pink-purple';

export const PALETTES: Record<PaletteKey, { label: string; families: string[] }> = {
  'purple-silver': { label: 'Lila–ezüst', families: ['purple', 'blue', 'silver'] },
  warm: { label: 'Meleg sárga–bordó', families: ['yellow', 'orange', 'red', 'bronze'] },
  'white-blue': { label: 'Fehér–kék–zöld', families: ['white', 'blue', 'green'] },
  'pink-purple': { label: 'Rózsaszín–lila', families: ['pink', 'purple', 'silver'] },
};

// Hungarian colour words → colour family.
const WORDS: [RegExp, string][] = [
  [/lila|ibolya|levendula|bíbor(?!rózsa)/, 'purple'],
  [/kék/, 'blue'],
  [/ezüst|szürk|kékesszürk/, 'silver'],
  [/sárga|arany/, 'yellow'],
  [/narancs|réz|rozsda/, 'orange'],
  [/piros|vörös|bordó|bíborrózsa/, 'red'],
  [/bronz|barna/, 'bronze'],
  [/fehér|krém/, 'white'],
  [/rózsaszín|magenta|pink/, 'pink'],
];

export function colourFamilies(p: Plant): Set<string> {
  const out = new Set<string>();
  const text = `${p.bloomColor} ${p.foliageColor}`.toLowerCase();
  for (const [re, fam] of WORDS) if (re.test(text)) out.add(fam);
  if (/zöld/.test(p.foliageColor.toLowerCase())) out.add('green');
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

/** Species that suit the area: sun, height limit, thorns, toxicity, soil, no trees. */
export function candidates(area: Area, plantDb: Plant[]): Plant[] {
  const c = area.constraints;
  const sun = areaSunLevel(area);
  return plantDb.filter(
    (p) =>
      !p.isTree &&
      p.symbol !== 'diamond' &&
      p.spreadCm <= 120 && // large shrubs need their own planning, not drifts
      p.sun.includes(sun) &&
      (c.maxHeightCm == null || p.maxHeightCm <= c.maxHeightCm) &&
      !(c.noThorns && p.thorny) &&
      !(c.nonToxic && p.toxic !== 'no') &&
      !(area.soil && p.soil?.length && !p.soil.includes(area.soil)) &&
      p.spacingCm >= 15 && // skip bulbs and tiny fillers; they don't carry a composition
      (c.speciesLimits[p.code] ?? 1) > 0,
  );
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

const BLOCKING = new Set(['lawn', 'paving', 'tap', 'manhole']);

/** Polygon of a blocking fixture (lawn, paving, tap, manhole), padded for small ones. */
function fixturePoly(f: Fixture): Pt[] | null {
  if (!BLOCKING.has(f.type)) return null;
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

export function generateIdea(area: Area, plantDb: Plant[], settings: Settings, opts: { seed?: number; palette?: PaletteKey } = {}): Idea {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const r = rng(seed);
  const keys = Object.keys(PALETTES) as PaletteKey[];
  const pool = candidates(area, plantDb);
  // Palette: the requested one, or a random one that the pool can actually serve.
  const serve = (k: PaletteKey) => pool.filter((p) => [...colourFamilies(p)].some((f) => PALETTES[k].families.includes(f) && f !== 'green')).length;
  const palette = opts.palette ?? weighted(r, keys, (k) => (serve(k) >= 3 ? 1 : 0)) ?? keys[Math.floor(r() * keys.length)];

  const pts = areaPoints(area);
  const bb = bbox(pts);
  const m2 = ((bb.maxX - bb.minX) * (bb.maxY - bb.minY)) / 1e4;
  const n = m2 < 4 ? 3 : m2 < 12 ? 4 : 5;
  // Mostly under a walnut: plan with juglone-tolerant species only (if there are enough).
  const walnutFx = area.fixtures.filter((f) => f.type === 'walnut');
  let inZone = 0;
  let total = 0;
  for (let x = bb.minX + 25; x < bb.maxX; x += 50)
    for (let y = bb.minY + 25; y < bb.maxY; y += 50)
      if (pointInPolygon([x, y], pts)) {
        total++;
        if (walnutFx.some((f) => dist([x, y], [f.x, f.y]) <= settings.walnutRadiusCm)) inZone++;
      }
  const tolerantPool = pool.filter((p) => p.juglone === 'tolerant');
  const underWalnut = total > 0 && inZone / total > 0.4 && tolerantPool.length >= 3;
  const species = pickSpecies(underWalnut ? tolerantPool : pool, palette, n, r);
  const notes: string[] = [];
  if (underWalnut) notes.push('A terület nagy része a diófa zónájában van, ezért csak juglone-tűrő fajokból válogattam.');
  if (!species.length) return { seed, palette, species, items: [], notes: ['Nincs a terület feltételeinek megfelelő faj az adatbázisban.'] };

  // Long axis u, short axis v.
  const alongY = bb.maxY - bb.minY >= bb.maxX - bb.minX;
  const U = (x: number, y: number): Pt => (alongY ? [y, x] : [x, y]);
  const [u0, u1] = alongY ? [bb.minY, bb.maxY] : [bb.minX, bb.maxX];
  const [v0, v1] = alongY ? [bb.minX, bb.maxX] : [bb.minY, bb.maxY];
  const blockers = area.fixtures.map(fixturePoly).filter((p): p is Pt[] => !!p);
  const walls = area.fixtures.filter((f) => f.type === 'wall' || f.type === 'fence');
  const walnuts = area.fixtures.filter((f) => f.type === 'walnut');
  const gap = 6; // cm between neighbouring drifts, so their edge plants keep spacing
  const tolerant = species.filter((p) => p.juglone === 'tolerant');

  const items: PlacedItem[] = [];
  const cellBase = 150 + Math.round(r() * 80);
  const usedCodes = new Set<string>();

  // Distance from v to a wall/fence on the short axis (for deciding which side is "back").
  const wallV = walls.map((f) => {
    const c = alongY ? f.x + (f.w ?? 0) / 2 : f.y + (f.h ?? 0) / 2;
    return c;
  });

  for (let s = u0, cell = 0; s < u1 - 20; cell++) {
    const e = Math.min(u1, s + cellBase * (0.8 + r() * 0.4));
    const end = u1 - e < 60 ? u1 : e; // don't leave a sliver at the end
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
      const bands = w < 110 ? 1 : w < 220 ? 2 : 3;
      // Back = the side nearer a wall/fence; else the side away from a blocked strip (lawn, path).
      const touchesCutA = cuts.some(([, y]) => Math.abs(y - a) < gap + 1);
      const touchesCutB = cuts.some(([x]) => Math.abs(x - b) < gap + 1);
      const wallNearA = wallV.length ? Math.min(...wallV.map((c) => Math.abs(c - a))) : Infinity;
      const wallNearB = wallV.length ? Math.min(...wallV.map((c) => Math.abs(c - b))) : Infinity;
      const backAtA = wallNearA !== wallNearB ? wallNearA < wallNearB : touchesCutA !== touchesCutB ? touchesCutB : a <= v0 + 1;
      // Tiers: tallest species at the back band, lowest at the front.
      const tiers: Plant[][] = Array.from({ length: bands }, () => []);
      species.forEach((p, i) => tiers[Math.min(bands - 1, Math.floor((i * bands) / species.length))].push(p));
      const bw = w / bands;
      for (let k = 0; k < bands; k++) {
        const tier = tiers[k].length ? tiers[k] : species;
        const bandIdx = backAtA ? k : bands - 1 - k;
        const va = a + bandIdx * bw + (bandIdx ? gap / 2 : 0);
        const vb = a + (bandIdx + 1) * bw - (bandIdx < bands - 1 ? gap / 2 : 0);
        // Stagger band boundaries for a less rigid look: split the slice for the back band of wide beds.
        const plant0 = tier[(cell + k) % tier.length];
        const rect = [U(s + (s > u0 ? gap / 2 : 0), va), U(end - (end < u1 ? gap / 2 : 0), vb)];
        const [x0, y0] = [Math.min(rect[0][0], rect[1][0]), Math.min(rect[0][1], rect[1][1])];
        const [x1, y1] = [Math.max(rect[0][0], rect[1][0]), Math.max(rect[0][1], rect[1][1])];
        const outer = clipRect(pts, x0, y0, x1, y1);
        if (outer.length < 3) continue;
        let plant = plant0;
        // Walnut zone: swap in a juglone-tolerant species of a similar height.
        const inZone = walnuts.length > 0 && outer.some((q) => walnuts.some((f) => dist(q, [f.x, f.y]) <= settings.walnutRadiusCm));
        if (plant.juglone !== 'tolerant' && inZone) {
          const alt = [...tolerant].sort((x, y) => Math.abs(x.maxHeightCm - plant.maxHeightCm) - Math.abs(y.maxHeightCm - plant.maxHeightCm))[0];
          if (!alt) continue;
          plant = alt;
        }
        // Inset the inner edges so edge plants of neighbouring drifts keep the spacing rule happy.
        const i = Math.ceil(plant.spacingCm * 0.32);
        const ins = (v: number, edge: number) => (Math.abs(v - edge) < 1 ? 0 : i);
        const poly = clipRect(pts, x0 + ins(x0, bb.minX), y0 + ins(y0, bb.minY), x1 - ins(x1, bb.maxX), y1 - ins(y1, bb.maxY));
        if (poly.length < 3) continue;
        const ps = fillPolygon(poly, plant.spacingCm, 'staggered');
        if (!ps.length || ps.some((q) => !pointInPolygon(q, pts))) continue;
        usedCodes.add(plant.code);
        items.push({ kind: 'drift', id: uid(), plantId: plant.code, polygon: poly, pattern: 'staggered', spacingCm: plant.spacingCm, count: ps.length, status: 'needed' });
      }
    }
    s = end;
  }

  const used = species.filter((p) => usedCodes.has(p.code));
  notes.push(`Színvilág: ${PALETTES[palette].label}.`);
  notes.push(`${used.length} faj ismétlődő foltokban, hátul a magasabbak (${used[0]?.nameHu ?? '–'}), elöl az alacsonyabbak.`);
  const seasons = new Set(used.flatMap((p) => [...seasonsOf(p)]));
  const sName = ['tavasz', 'nyár', 'ősz'].filter((_, i) => seasons.has(i as 0 | 1 | 2));
  if (sName.length) notes.push(`Virágzás: ${sName.join(', ')}.`);
  const winter = used.filter((p) => p.winterInterest);
  notes.push(winter.length ? `Télen is díszít: ${winter.map((p) => p.nameHu.toLowerCase()).join(', ')}.` : 'Télen kevés a díszítő elem.');
  return { seed, palette, species: used, items, notes };
}
