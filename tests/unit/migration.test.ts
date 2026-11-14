// Real saves written by earlier versions (generated with the code of 0.2–0.6): a new version must open them.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exportJson, parseProject } from '../../src/engine/io';
import { buildBom } from '../../src/engine/bom';
import { validateProject } from '../../src/engine/validate';
import { migrate, SEED_VERSION } from '../../src/store/projectStore';

const DIR = 'tests/fixtures/saves';
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));

describe('saves of earlier versions', () => {
  it('has a save for every released minor version', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  for (const f of files) {
    it(`${f}: opens, migrates and keeps the plan`, () => {
      const text = readFileSync(`${DIR}/${f}`, 'utf8');
      const before = parseProject(text);
      const after = migrate(before);
      validateProject(after);
      expect(after.settings.seedVersion).toBe(SEED_VERSION);
      expect(after.areas.length).toBe(before.areas.length);
      // Every variant keeps its items; the plan on screen is the chosen one.
      after.areas.forEach((a, i) => {
        expect(a.variants.map((v) => v.items.length)).toEqual(before.areas[i].variants.map((v) => v.items.length));
        expect(!a.activeVariantId || a.activeVariantId === a.chosenVariantId).toBe(true);
      });
      // Every placed species is in the database, so the list can be built.
      const codes = new Set(after.plantDb.map((p) => p.code));
      for (const a of after.areas) for (const v of a.variants) for (const it of v.items) expect(codes.has(it.plantId), it.plantId).toBe(true);
      expect(buildBom(after).planted).toBeGreaterThan(0);
      // A migrated plan survives a save and reload unchanged.
      expect(parseProject(exportJson(after))).toEqual(after);
    });
  }
});
