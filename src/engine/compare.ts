// Side-by-side comparison of two variants of one area (SPEC §4.8).
import type { Area, Plant, Project, Variant } from '../model/types';
import { bomFromEntries, type Bom } from './bom';
import { evaluate, partition, type Warning } from './rules';
import { byPlantName } from '../model/plants';

export interface VariantStats {
  variant: Variant;
  bom: Bom;
  warnings: Warning[];
  errors: number;
}

export interface CompareRow {
  plant: Plant;
  a: number;
  b: number;
}

export function variantStats(project: Project, area: Area, v: Variant): VariantStats {
  const bom = bomFromEntries([{ area, items: v.items }], project.plantDb, project.settings.reservePct);
  const { active } = partition(evaluate(area, v.items, project.plantDb, project.settings), v.muted);
  return { variant: v, bom, warnings: active, errors: active.filter((w) => w.severity === 'error').length };
}

export function compareVariants(project: Project, area: Area, a: Variant, b: Variant) {
  const sa = variantStats(project, area, a);
  const sb = variantStats(project, area, b);
  const rows = new Map<string, CompareRow>();
  for (const r of sa.bom.rows) rows.set(r.plant.code, { plant: r.plant, a: r.planted, b: 0 });
  for (const r of sb.bom.rows) {
    const x = rows.get(r.plant.code);
    if (x) x.b = r.planted;
    else rows.set(r.plant.code, { plant: r.plant, a: 0, b: r.planted });
  }
  return {
    a: sa,
    b: sb,
    rows: [...rows.values()].sort((x, y) => byPlantName(x.plant, y.plant)),
  };
}
