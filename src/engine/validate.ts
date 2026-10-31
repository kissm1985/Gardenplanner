// Structural check of a project read from a file, a share link or the device's storage.
// It does not trust the shape of the data: a broken or crafted file is refused with a clear
// message instead of crashing the app (and then crashing it again on every start).
import { t } from '../i18n';

/** Limits well above any real garden, so a huge or crafted file cannot freeze the phone. */
export const LIMITS = { textBytes: 60 * 1024 * 1024, areas: 200, variantsPerArea: 300, itemsPerVariant: 20000, points: 5000, fixtures: 2000, plants: 5000 };

type Obj = Record<string, unknown>;

class Invalid extends Error {}

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e7;

function fail(where: string, what: string): never {
  throw new Invalid(t(`Hibás adat a mentésben (${where}): ${what}.`, `Broken data in the backup (${where}): ${what}.`));
}

function str(o: Obj, k: string, where: string, optional = false) {
  const v = o[k];
  if (v === undefined && optional) return;
  if (typeof v !== 'string' || v.length > 20000) fail(where, t(`a(z) „${k}” nem szöveg`, `“${k}” is not text`));
}

function n(o: Obj, k: string, where: string, optional = false) {
  const v = o[k];
  if (v === undefined && optional) return;
  if (!num(v)) fail(where, t(`a(z) „${k}” nem szám`, `“${k}” is not a number`));
}

function arr(o: Obj, k: string, where: string, max: number, optional = false): unknown[] {
  const v = o[k];
  if (v === undefined && optional) return [];
  if (!Array.isArray(v)) fail(where, t(`a(z) „${k}” nem lista`, `“${k}” is not a list`));
  if (v.length > max) fail(where, t(`a(z) „${k}” túl hosszú (${v.length})`, `“${k}” is too long (${v.length})`));
  return v;
}

function points(v: unknown, where: string, min: number) {
  if (!Array.isArray(v) || v.length < min || v.length > LIMITS.points) fail(where, t('hibás pontlista', 'bad point list'));
  for (const p of v) if (!Array.isArray(p) || p.length !== 2 || !num(p[0]) || !num(p[1])) fail(where, t('hibás koordináta', 'bad coordinate'));
}

function item(it: unknown, where: string) {
  if (!isObj(it)) fail(where, t('nem elem', 'not an item'));
  if (it.kind !== 'plant' && it.kind !== 'drift' && it.kind !== 'row') fail(where, t('ismeretlen elemtípus', 'unknown item kind'));
  str(it, 'id', where);
  str(it, 'plantId', where);
  if (it.kind === 'plant') {
    n(it, 'x', where);
    n(it, 'y', where);
    n(it, 'spreadCm', where, true);
  } else if (it.kind === 'drift') {
    points(it.polygon, where, 3);
    n(it, 'spacingCm', where);
    if (!((it.spacingCm as number) >= 1)) fail(where, t('túl kicsi tőtáv', 'spacing too small'));
  } else if (it.kind === 'row') {
    points(it.path, where, 2);
    n(it, 'spacingCm', where);
    if (!((it.spacingCm as number) >= 1)) fail(where, t('túl kicsi tőtáv', 'spacing too small'));
  }
}

function area(a: unknown, i: number) {
  const where = t(`${i + 1}. terület`, `area ${i + 1}`);
  if (!isObj(a)) fail(where, t('nem terület', 'not an area'));
  str(a, 'id', where);
  str(a, 'name', where);
  n(a, 'widthCm', where);
  n(a, 'lengthCm', where);
  if (!((a.widthCm as number) > 0 && (a.lengthCm as number) > 0)) fail(where, t('a méret nem pozitív', 'size is not positive'));
  if (!isObj(a.shape)) fail(where, t('hiányzó alak', 'missing shape'));
  if (a.shape.kind === 'polygon') points(a.shape.points, where, 3);
  else if (a.shape.kind !== 'rect') fail(where, t('ismeretlen alak', 'unknown shape'));
  if (!isObj(a.constraints)) fail(where, t('hiányzó korlátok', 'missing limits'));
  for (const f of arr(a, 'fixtures', where, LIMITS.fixtures)) {
    if (!isObj(f)) fail(where, t('hibás elem', 'bad element'));
    str(f, 'id', where);
    str(f, 'type', where);
    n(f, 'x', where);
    n(f, 'y', where);
    for (const k of ['w', 'h', 'radius']) n(f, k, where, true);
    if (f.polygon !== undefined) points(f.polygon, where, 3);
  }
  const variants = arr(a, 'variants', where, LIMITS.variantsPerArea);
  if (!variants.length) fail(where, t('nincs változat', 'no variant'));
  for (const v of variants) {
    if (!isObj(v)) fail(where, t('hibás változat', 'bad variant'));
    str(v, 'id', where);
    str(v, 'name', where);
    const vw = `${where}, ${String(v.name).slice(0, 40)}`;
    for (const it of arr(v, 'items', vw, LIMITS.itemsPerVariant)) item(it, vw);
    for (const r of arr(v, 'renders', vw, 200, true)) {
      if (!isObj(r) || typeof r.dataUrl !== 'string' || !r.dataUrl.startsWith('data:image/')) fail(vw, t('hibás látványkép', 'bad visualisation image'));
    }
  }
  str(a, 'chosenVariantId', where);
  if (a.background !== undefined) {
    if (!isObj(a.background) || typeof a.background.dataUrl !== 'string' || !a.background.dataUrl.startsWith('data:image/')) fail(where, t('hibás háttérkép', 'bad background image'));
  }
  if (a.camera !== undefined && (!isObj(a.camera) || !num(a.camera.x) || !num(a.camera.y) || !num(a.camera.dir))) fail(where, t('hibás nézőpont', 'bad viewpoint'));
}

function plant(p: unknown, i: number) {
  const where = t(`${i + 1}. növény`, `plant ${i + 1}`);
  if (!isObj(p)) fail(where, t('nem növény', 'not a plant'));
  str(p, 'code', where);
  str(p, 'nameHu', where);
  str(p, 'nameLat', where);
  for (const k of ['spacingCm', 'spreadCm', 'maxHeightCm']) n(p, k, where);
  if (!((p.spacingCm as number) >= 1)) fail(where, t('túl kicsi tőtáv', 'spacing too small'));
  if (!Array.isArray(p.sun)) fail(where, t('hiányzó fényigény', 'missing light need'));
  if (p.photoUrl !== undefined && typeof p.photoUrl === 'string' && p.photoUrl && !/^(https?:|data:image\/)/.test(p.photoUrl)) fail(where, t('a fotó címe nem webcím vagy beágyazott kép', 'the photo address is not a web address or an embedded image'));
}

/** Throws a readable error if the data is not a usable project; returns nothing otherwise. */
export function validateProject(data: unknown): void {
  try {
    if (!isObj(data)) fail(t('projekt', 'project'), t('nem objektum', 'not an object'));
    str(data, 'id', t('projekt', 'project'));
    str(data, 'name', t('projekt', 'project'));
    arr(data, 'areas', t('projekt', 'project'), LIMITS.areas).forEach(area);
    arr(data, 'plantDb', t('projekt', 'project'), LIMITS.plants).forEach(plant);
    if (!isObj(data.settings)) fail(t('projekt', 'project'), t('hiányzó beállítások', 'missing settings'));
    const loc = data.settings.location;
    if (loc !== undefined) {
      const md = (v: unknown) => isObj(v) && num(v.month) && num(v.day);
      if (!isObj(loc) || typeof loc.name !== 'string' || !md(loc.lastFrost) || !md(loc.firstFrost)) fail(t('beállítások', 'settings'), t('hibás helyszín', 'bad location'));
    }
  } catch (e) {
    if (e instanceof Invalid) throw new Error(e.message);
    throw new Error(t('A mentés szerkezete hibás.', 'The backup has a broken structure.'));
  }
}
