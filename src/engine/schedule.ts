// Planting schedule (SPEC §4.7): day-by-day checklist for a time window, in the K-06/K-07
// order per area: soil → drip line → landscape fabric → trees → perennials → mulch → watering in.
import { areaPoints } from '../model/area';
import { polygonArea } from '../model/geometry';
import { plantName } from '../model/plants';
import type { Area, Plant, Project } from '../model/types';
import { chosenItems } from './bom';
import { itemCount } from './fill';
import { gardenLocation, type MonthDay } from '../model/location';
import { locale, t } from '../i18n';

export interface Task {
  /** Stable across regenerations (no dates), so ticks survive a changed window. */
  id: string;
  title: string;
  detail?: string;
  areaId: string;
  hours: number;
}

export interface Day {
  date: string; // YYYY-MM-DD
  tasks: Task[];
}


const PLANTS_PER_HOUR = 12; // P9 / 1 l pots into prepared, fabric-covered soil

export const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const e = fromIso(end);
  for (let d = fromIso(start); d <= e && out.length < 120; d.setDate(d.getDate() + 1)) out.push(toIso(d));
  return out;
}

/** Default window: the next 20 Oct – 3 Nov (autumn planting, as in K-07). */
export function defaultWindow(today = new Date()): { start: string; end: string } {
  let y = today.getFullYear();
  if (today > new Date(y, 10, 3)) y++;
  return { start: `${y}-10-20`, end: `${y}-11-03` };
}

/** Bed area in m²: the area minus any lawn polygon. */
export function bedAreaM2(a: Area): number {
  const lawn = a.fixtures.filter((f) => f.type === 'lawn' && f.polygon).reduce((s, f) => s + polygonArea(f.polygon!), 0);
  return Math.max(0, polygonArea(areaPoints(a)) - lawn) / 10000;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
/** Hungarian decimal comma for text ("14,4"). */
const hu = (n: number) => r1(n).toLocaleString(locale());

/** Ordered tasks for one area. */
export function areaTasks(a: Area, plantDb: Plant[]): Task[] {
  const items = chosenItems(a);
  if (!items.length) return [];
  const plants = new Map(plantDb.map((p) => [p.code, p]));
  const m2 = r1(bedAreaM2(a));
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.plantId, (counts.get(it.plantId) ?? 0) + itemCount(it));
  const species = [...counts].map(([code, n]) => ({ p: plants.get(code)!, n })).filter((x) => x.p);
  const trees = species.filter((x) => x.p.isTree);
  const perennials = species.filter((x) => !x.p.isTree).sort((x, y) => y.p.maxHeightCm - x.p.maxHeightCm); // tall back-row plants first
  const dry = perennials.filter((x) => x.p.water === 'low' && x.p.sun.includes('sun')).map((x) => plantName(x.p).toLowerCase());
  const c = a.constraints;
  const id = (s: string) => `${a.id}:${s}`;
  const out: Task[] = [];

  out.push({
    id: id('soil'),
    title: t(`Talaj-előkészítés – ${a.name}`, `Soil preparation – ${a.name}`),
    detail: t(
      `Gyomlálás, lazítás ~${hu(m2)} m²-en.${dry.length ? ` A szárazságtűrők (${dry.join(', ')}) helyére 20–30% durva homok vagy apró kavics, trágya és komposzt nélkül.` : ''}`,
      `Weeding and loosening on ~${hu(m2)} m².${dry.length ? ` Where the drought-tolerant plants go (${dry.join(', ')}), mix in 20–30% coarse sand or fine gravel, no manure or compost.` : ''}`,
    ),
    areaId: a.id,
    hours: Math.max(1, m2 * 0.25),
  });
  if (c.drip)
    out.push({
      id: id('drip'),
      title: t(`Csepegtető cső lefektetése – ${a.name}`, `Laying the drip line – ${a.name}`),
      detail: t('A sorok mentén, a meglévő körre csatlakoztatva; próbaöntözés.', 'Along the rows, connected to the existing circuit; test run.'),
      areaId: a.id,
      hours: Math.max(1, m2 * 0.08),
    });
  if (c.mulchCover)
    out.push({
      id: id('fabric'),
      title: t(`Agrotextil terítése – ${a.name}`, `Laying weed fabric – ${a.name}`),
      detail: t(
        `~${hu(m2 * 1.15)} m² (15% átfedéssel), csapokkal rögzítve.${trees.length ? ' A fák törzse körül 60 cm átmérőben hagyd szabadon.' : ''}`,
        `~${hu(m2 * 1.15)} m² (15% overlap), pinned down.${trees.length ? ' Leave 60 cm around tree trunks free.' : ''}`,
      ),
      areaId: a.id,
      hours: Math.max(0.5, m2 * 0.06),
    });
  for (const tr of trees)
    out.push({
      id: id(`tree:${tr.p.code}`),
      title: t(`Fa ültetése: ${plantName(tr.p)} (${tr.n} db) – ${a.name}`, `Planting tree: ${plantName(tr.p)} (${tr.n}) – ${a.name}`),
      detail: t('Elsőként; karó és kötöző, alapos beöntözés.', 'First; stake and tie, water in well.'),
      areaId: a.id,
      hours: tr.n * 1,
    });

  // Perennials in chunks of about two hours so a big drift can span days.
  for (const x of perennials) {
    const hours = x.n / PLANTS_PER_HOUR;
    const parts = Math.max(1, Math.ceil(hours / 2));
    for (let i = 0; i < parts; i++) {
      const n = Math.round((x.n * (i + 1)) / parts) - Math.round((x.n * i) / parts);
      out.push({
        id: id(`plant:${x.p.code}:${i}`),
        title: t(
          `Ültetés: ${plantName(x.p)} ${n} tő${parts > 1 ? ` (${i + 1}/${parts})` : ''} – ${a.name}`,
          `Planting: ${plantName(x.p)} ${n} plants${parts > 1 ? ` (${i + 1}/${parts})` : ''} – ${a.name}`,
        ),
        detail: i === 0 ? t(`Tőtáv ${x.p.spacingCm} cm, a terv szerint; az agrotextilen kereszt alakú vágás.`, `Spacing ${x.p.spacingCm} cm as planned; cross-shaped cut in the fabric.`) : undefined,
        areaId: a.id,
        hours: n / PLANTS_PER_HOUR,
      });
    }
  }
  if (c.mulchCover) {
    const m = mulchAdvice(species.map((x) => x.p));
    out.push({
      id: id('mulch'),
      title: t(`Mulcsozás – ${a.name}`, `Mulching – ${a.name}`),
      detail: a.kind === 'gravel'
        ? t('Világos 4–8 mm-es kavics az egész kőkertre, ~4–5 cm vastagon, agrotextilen.', 'Light 4–8 mm gravel over the whole rock garden, ~4–5 cm deep, on fabric.')
        : m.gravel.length
        ? t(
            `Világos 4–8 mm-es kavics (~4–5 cm) ${m.bark.length ? `a szárazságtűrők körül (${m.gravel.map((p) => plantName(p).toLowerCase()).join(', ')}), máshol kéreg is lehet` : 'az egész ágyásra'}.`,
            `Light 4–8 mm gravel (~4–5 cm) ${m.bark.length ? `around the drought-tolerant plants (${m.gravel.map((p) => plantName(p).toLowerCase()).join(', ')}), bark elsewhere` : 'over the whole bed'}.`,
          )
        : t('Fenyőkéreg vagy komposztált kéreg ~5 cm vastagon, a tövektől 3–5 cm-re.', 'Pine or composted bark ~5 cm deep, 3–5 cm away from the stems.'),
      areaId: a.id,
      hours: Math.max(0.5, m2 * 0.1),
    });
  }
  out.push({
    id: id('water'),
    title: t(`Beöntözés és ellenőrzés – ${a.name}`, `Watering in and check – ${a.name}`),
    detail: t('Tövenként alaposan; csepegtető működésének ellenőrzése.', 'Each plant thoroughly; check the drip line works.'),
    areaId: a.id,
    hours: 0.5,
  });
  return out.map((t) => ({ ...t, hours: r1(t.hours) }));
}

/**
 * Spread the tasks over the window in order, keeping each day near the average load.
 * A task never starts before the previous one (sequence matters), but several fit in a day.
 */
export function buildSchedule(project: Project, start: string, end: string): { days: Day[]; notes: string[]; hours: number } {
  const tasks = project.areas.flatMap((a) => areaTasks(a, project.plantDb));
  const dates = daysBetween(start, end);
  const notes: string[] = [];
  const hours = r1(tasks.reduce((s, t) => s + t.hours, 0));
  if (!dates.length) return { days: [], notes: [t('A záró dátum a kezdő előtt van.', 'The end date is before the start date.')], hours };

  const cap = Math.max(2, hours / dates.length);
  const days: Day[] = dates.map((date) => ({ date, tasks: [] }));
  let d = 0;
  let load = 0;
  for (const t of tasks) {
    if (load > 0 && load + t.hours > cap * 1.15 && d < days.length - 1) {
      d++;
      load = 0;
    }
    days[d].tasks.push(t);
    load += t.hours;
  }
  if (hours / dates.length > 6) notes.push(
      t(
        `Kb. ${hu(hours)} munkaóra jut ${dates.length} napra – ez napi ${hu(hours / dates.length)} óra; érdemes hosszabb időablakot vagy segítséget tervezni.`,
        `About ${hu(hours)} working hours over ${dates.length} days – ${hu(hours / dates.length)} hours a day; plan a longer window or get help.`,
      ),
    );

  const s = fromIso(start);
  const e = fromIso(end);
  const loc = gardenLocation(project.settings);
  const lastFrost = new Date(s.getFullYear(), loc.lastFrost.month - 1, loc.lastFrost.day);
  const firstFrost = new Date(e.getFullYear(), loc.firstFrost.month - 1, loc.firstFrost.day);
  const fmtMd = (d: MonthDay) => new Date(2000, d.month - 1, d.day).toLocaleDateString(locale(), { month: 'long', day: 'numeric' });
  if (s < lastFrost && s.getMonth() >= 1)
    notes.push(
      t(
        `${loc.name}: kb. ${fmtMd(loc.lastFrost)}-ig lehet fagy. A kezdés előtt figyeld az előrejelzést, a friss ültetést takard.`,
        `${loc.name}: frost is possible until about ${fmtMd(loc.lastFrost)}. Watch the forecast and cover fresh plantings.`,
      ),
    );
  if (e > firstFrost && e.getMonth() >= 8)
    notes.push(
      t(
        `${loc.name}: az első fagy kb. ${fmtMd(loc.firstFrost)} körül várható. A fagy előtt öntözz be alaposan, a mulcs védi a gyökereket. Fát és évelőt még 1–2 hétig lehet ültetni, amíg a talaj nem fagy.`,
        `${loc.name}: the first frost is expected around ${fmtMd(loc.firstFrost)}. Water in well before it; mulch protects the roots. Trees and perennials can still go in for 1–2 weeks while the soil is not frozen.`,
      ),
    );
  if (e.getMonth() >= 5 && e.getMonth() <= 7) notes.push(t('Nyári ültetésnél az első hetekben naponta öntözz, és árnyékold a délutáni napon.', 'When planting in summer, water daily for the first weeks and shade from the afternoon sun.'));
  if (!tasks.length) notes.push(t('Még nincs növény a választott változatokban, ezért nincs mit ütemezni.', 'There are no plants in the chosen variants yet, so nothing to schedule.'));
  // Days left empty at the end stay as spare days (rain, delivery delays).
  return { days, notes, hours };
}

// ---------- mulch ----------

/** Light fine gravel for drought-tolerant sun lovers instead of bark (K-06 / K-07). */
export function mulchAdvice(plants: Plant[]) {
  const ps = plants.filter((p) => !p.isTree);
  const gravel = ps.filter((p) => p.water === 'low' && p.sun.includes('sun'));
  return { gravel, bark: ps.filter((p) => !gravel.includes(p)), trees: plants.filter((p) => p.isTree) };
}
