// Adding an example plan (loaded on demand: the plan data is not part of the start-up code).
import { buildExample, EXAMPLE_PLANS, exampleCodes, scaleArea } from '../data/examples';
import { track } from '../engine/analytics';
import { seedPlants } from './projectModel';
import { useProject } from './projectStore';

/** Adds the example as a new area (optionally fitted to a size); returns the area id. */
export function addExampleArea(key: string, size?: { widthCm: number; lengthCm: number }): string | null {
  const ex = EXAMPLE_PLANS.find((x) => x.key === key);
  if (!ex) return null;
  track('example_used', { example: key, fitted: !!size });
  const built = buildExample(ex);
  const area = size ? scaleArea(built, size.widthCm, size.lengthCm) : built;
  const codes = new Set(exampleCodes(area));
  return useProject.getState().addAreaWithPlants(
    area,
    seedPlants().filter((p) => codes.has(p.code)),
  );
}
