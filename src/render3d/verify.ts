// Manifest and verification of a 3D render (spec v0.2 F1). Pure functions: the manifest is read from the scene
// graph, the check compares it with the plan, so the same data always gives the same verdict.
import type * as THREE from 'three';
import type { PlantInstance } from './instances';
import { measuredCentre } from './scene';

export interface ManifestEntry {
  plant_id: string;
  species_id: string;
  species_name: string;
  /** Where the plan puts the plant (m), or null if the scene has an object the plan does not know. */
  required_xy_m: [number, number] | null;
  /** The created object's real centre (m), measured in the scene graph. */
  placed_xy_m: [number, number];
  render_object_id: string;
}

export interface Manifest {
  project: string;
  area: string;
  generated_at: string;
  units: 'm';
  origin: 'top-left corner of the area; x along the width, y along the length';
  plant_count_plan: number;
  plants: ManifestEntry[];
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

export function buildManifest(project: string, area: string, instances: PlantInstance[], plantObjects: THREE.Object3D[], at = new Date().toISOString()): Manifest {
  const byId = new Map(instances.map((p) => [p.plant_id, p]));
  return {
    project,
    area,
    generated_at: at,
    units: 'm',
    origin: 'top-left corner of the area; x along the width, y along the length',
    plant_count_plan: instances.length,
    plants: plantObjects.map((o) => {
      const u = o.userData as { plant_id: string; species_id: string; species_name: string };
      const req = byId.get(u.plant_id);
      const [x, z] = measuredCentre(o);
      return {
        plant_id: u.plant_id,
        species_id: u.species_id,
        species_name: u.species_name,
        required_xy_m: req ? [r4(req.xCm / 100), r4(req.yCm / 100)] : null,
        placed_xy_m: [r4(x), r4(z)],
        render_object_id: o.name,
      };
    }),
  };
}

/** Pixels a plant shows in the ID buffer; potentialShare = the share it covers when rendered alone (nothing in front). */
export type Visibility = { pixels: number; share: number; potentialShare?: number };
/** Visibility threshold: 0.005% of the image (about 200 px at 2400×1700), as decided for spec v0.2 (was 0.1%). */
export const DEFAULT_MIN_SHARE = 0.00005;
export const VISIBLE = 'LÁTHATÓ' as const;
export const NOT_PROVABLE = 'NEM IGAZOLHATÓ – takarás' as const;
/** Even unhidden it would be smaller than the threshold at this image size and viewpoint. */
export const TOO_SMALL = 'NEM IGAZOLHATÓ – perspektíva (kis méret)' as const;

export interface CheckRow {
  test_id: string;
  plant_id: string;
  species_expected: string;
  species_found: string | null;
  deviation_cm: number | null;
  status: 'PASS' | 'FAIL';
  reason: string;
  visibility?: typeof VISIBLE | typeof NOT_PROVABLE | typeof TOO_SMALL;
  visible_share?: number;
}

export interface CheckResult {
  project: string;
  rows: CheckRow[];
  expected: number;
  found: number;
  passed: number;
  failed: number;
  /** PASS only when every plan plant is present, right and within tolerance, and nothing extra is in the scene. */
  verdict: 'PASS' | 'FAIL';
  visible: number;
  /** Not provable because something hides it. */
  notProvable: number;
  /** Not provable because it is too small in the image even unhidden. */
  tooSmall: number;
}

/**
 * Checks the manifest against the plan: every plant present once, the right species, its centre within `tolCm`.
 * Visibility (from the ID buffer) is reported per plant; it never turns a FAIL into a PASS.
 */
export function checkManifest(
  project: string,
  instances: PlantInstance[],
  manifest: Manifest,
  opts: { tolCm?: number; visibility?: Map<string, Visibility>; minShare?: number } = {},
): CheckResult {
  const tol = opts.tolCm ?? 20;
  const minShare = opts.minShare ?? DEFAULT_MIN_SHARE;
  const found = new Map<string, ManifestEntry[]>();
  for (const e of manifest.plants) found.set(e.plant_id, [...(found.get(e.plant_id) ?? []), e]);
  const rows: CheckRow[] = instances.map((p) => {
    const test_id = `PL-3D-${project}-${p.plant_id}`;
    const es = found.get(p.plant_id) ?? [];
    const vis = opts.visibility?.get(p.plant_id);
    const visibility = !opts.visibility
      ? undefined
      : vis && vis.share >= minShare
        ? VISIBLE
        : vis?.potentialShare != null && vis.potentialShare < minShare
          ? TOO_SMALL
          : NOT_PROVABLE;
    const base = { test_id, plant_id: p.plant_id, species_expected: p.species_id, visibility, visible_share: vis?.share };
    if (!es.length) return { ...base, species_found: null, deviation_cm: null, status: 'FAIL', reason: 'hiányzik a jelenetből / missing from the scene' };
    if (es.length > 1)
      return { ...base, species_found: es[0].species_id, deviation_cm: null, status: 'FAIL', reason: `${es.length} objektum ugyanazzal az azonosítóval / duplicate objects` };
    const e = es[0];
    const dev = Math.hypot(e.placed_xy_m[0] * 100 - p.xCm, e.placed_xy_m[1] * 100 - p.yCm);
    const devCm = Math.round(dev * 10) / 10;
    const errors = [
      ...(e.species_id !== p.species_id ? [`rossz faj: ${e.species_id} / wrong species`] : []),
      ...(dev > tol ? [`eltérés ${devCm} cm > ${tol} cm / off by ${devCm} cm`] : []),
    ];
    return { ...base, species_found: e.species_id, deviation_cm: devCm, status: errors.length ? 'FAIL' : 'PASS', reason: errors.join('; ') };
  });
  const known = new Set(instances.map((p) => p.plant_id));
  for (const e of manifest.plants)
    if (!known.has(e.plant_id))
      rows.push({
        test_id: `PL-3D-${project}-${e.plant_id}`,
        plant_id: e.plant_id,
        species_expected: '',
        species_found: e.species_id,
        deviation_cm: null,
        status: 'FAIL',
        reason: 'a tervben nem szereplő objektum / object not in the plan',
      });
  const failed = rows.filter((r) => r.status === 'FAIL').length;
  return {
    project,
    rows,
    expected: instances.length,
    found: manifest.plants.length,
    passed: rows.length - failed,
    failed,
    verdict: failed === 0 && manifest.plants.length === instances.length && instances.length > 0 ? 'PASS' : 'FAIL',
    visible: rows.filter((r) => r.visibility === VISIBLE).length,
    notProvable: rows.filter((r) => r.visibility === NOT_PROVABLE).length,
    tooSmall: rows.filter((r) => r.visibility === TOO_SMALL).length,
  };
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Per-plant test report (CSV, semicolon-separated). */
export function reportCsv(r: CheckResult, logRef: string): string {
  const head = ['test_id', 'plant_id', 'species_expected', 'species_found', 'deviation_cm', 'status', 'reason', 'visibility', 'visible_share_pct', 'log'];
  const lines = r.rows.map((x) =>
    [
      x.test_id,
      x.plant_id,
      x.species_expected,
      x.species_found,
      x.deviation_cm,
      x.status,
      x.reason,
      x.visibility ?? '',
      x.visible_share != null ? (x.visible_share * 100).toFixed(3) : '',
      logRef,
    ]
      .map(csvCell)
      .join(';'),
  );
  return [head.join(';'), ...lines].join('\n') + '\n';
}

/** Per-plant test report (Markdown), with the summary on top. */
export function reportMd(r: CheckResult, logRef: string, meta: { area: string; commit?: string; tolCm: number; minSharePct: number }): string {
  const lines = [
    `# 3D-render ellenőrzés: ${r.project}`,
    '',
    `- Terület: ${meta.area}`,
    `- Eredmény: **${r.verdict}** (${r.passed}/${r.rows.length} PASS, ${r.failed} FAIL)`,
    `- Darabszám: terv ${r.expected}, jelenet ${r.found}`,
    `- Tűrés: ${meta.tolCm} cm · láthatósági küszöb: ${meta.minSharePct}% a képből`,
    `- Láthatóság (ID-buffer): ${r.visible} látható, ${r.notProvable} ${NOT_PROVABLE}, ${r.tooSmall} ${TOO_SMALL}`,
    `- Napló: ${logRef}`,
    ...(meta.commit ? [`- Commit: ${meta.commit}`] : []),
    '',
    '| Tesztazonosító | Faj | Eltérés (cm) | Eredmény | Láthatóság | Megjegyzés |',
    '|---|---|---:|---|---|---|',
    ...r.rows.map(
      (x) =>
        `| ${x.test_id} | ${x.species_found ?? '–'}${x.species_expected && x.species_found !== x.species_expected ? ` (várt: ${x.species_expected})` : ''} | ${x.deviation_cm ?? '–'} | ${x.status} | ${x.visibility ?? '–'}${x.visible_share != null ? ` (${(x.visible_share * 100).toFixed(2)}%)` : ''} | ${x.reason} |`,
    ),
    '',
  ];
  return lines.join('\n');
}
