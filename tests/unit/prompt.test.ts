// Spec v0.2 F2 / AC8–AC10: the structured ChatGPT prompt, on every example plan.
import { describe, expect, it } from 'vitest';
import { buildExample, EXAMPLE_PLANS } from '../../src/data/examples';
import { itemCount } from '../../src/engine/fill';
import { CHECK_BLOCK_HU } from '../../src/engine/checkBlock';
import { buildVisualPrompt } from '../../src/engine/visualPrompt';
import { plantInstances } from '../../src/render3d/instances';
import { newProject } from '../../src/store/projectModel';

function promptFor(key: string, lang: 'hu' | 'en' = 'hu') {
  const ex = EXAMPLE_PLANS.find((e) => e.key === key)!;
  const area = buildExample(ex, { stableIds: true });
  const project = { ...newProject([]), areas: [area] };
  const items = area.variants[0].items;
  const text = buildVisualPrompt(project, area, items, { season: 1, viewpoint: 'aerial', lang, mature: true });
  return { text, items, instances: plantInstances(items, project.plantDb), project };
}

const SECTIONS_HU = [
  '## 1. Szerep és cél',
  '## 2. Telek',
  '## 3. Növénytábla',
  '## 4. Fajok és elhelyezésük',
  '## 5. Stíluselőírás',
  '## 6. Kamera, fény és stílus',
  '## 7. Tiltások',
  '## 8. Ellenőrzés',
];

describe('structured prompt on every example plan', () => {
  for (const ex of EXAMPLE_PLANS)
    it(`${ex.key}: sections, every plant with id/species/coordinates, verification block with the right N`, () => {
      const { text, items, instances, project } = promptFor(ex.key);
      const n = items.reduce((s, it) => s + itemCount(it), 0);
      expect(instances).toHaveLength(n);
      // Sections in order.
      const at = SECTIONS_HU.map((h) => text.indexOf(h));
      expect(at.every((i) => i >= 0)).toBe(true);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
      // AC8: the verification block word for word, with N = the plan's plant count (no hard-coded 20).
      expect(text).toContain(CHECK_BLOCK_HU.replace('{N}', String(n)));
      expect(text).toContain(`## 3. Növénytábla (${n} növény)`);
      expect(text).toContain(`pontosan ${n} növény`);
      // AC9: one table row per plant: id, species, name, x and y (cm precision).
      const rows = text.split('\n').filter((l) => /^\| [^-|]/.test(l) && !l.startsWith('| ID '));
      expect(rows).toHaveLength(n);
      const byCode = new Map(project.plantDb.map((p) => [p.code, p]));
      instances.forEach((p, i) => {
        const cells = rows[i].split('|').map((c) => c.trim());
        expect(cells[1]).toBe(p.plant_id);
        expect(cells[2]).toBe(p.species_id);
        expect(cells[3]).toBe(byCode.get(p.species_id)!.nameHu);
        expect(Math.abs(Number(cells[4].replace(',', '.')) * 100 - p.xCm)).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(Math.abs(Number(cells[5].replace(',', '.')) * 100 - p.yCm)).toBeLessThanOrEqual(0.5 + 1e-9);
      });
      expect(new Set(rows.map((r) => r.split('|')[1].trim())).size).toBe(n);
      // No prices in the prompt.
      expect(text).not.toMatch(/\d\s?Ft\b|HUF|Egységár|irányár/);
    });

  // AC10: snapshot per example plan.
  for (const ex of EXAMPLE_PLANS)
    it(`${ex.key}: snapshot`, () => {
      expect(promptFor(ex.key).text).toMatchSnapshot();
    });

  it('English prompt carries the English verification block with N', () => {
    const { text, instances } = promptFor('curving', 'en');
    expect(text).toContain(`Consider the work successful only if all ${instances.length} plants appear in the output`);
    expect(text).toContain('## 8. Verification');
    expect(text).toContain('| curving-1 | BX |');
  });

  it('N follows the plan: one plant more, one more in the table and the block', () => {
    const ex = EXAMPLE_PLANS.find((e) => e.key === 'modern')!;
    const area = buildExample(ex, { stableIds: true });
    const project = { ...newProject([]), areas: [area] };
    const items = [...area.variants[0].items, { kind: 'plant' as const, id: 'extra', plantId: 'LA', x: 300, y: 600, status: 'needed' as const }];
    const text = buildVisualPrompt(project, area, items, { season: 1, viewpoint: 'aerial', lang: 'hu', mature: true });
    const n = items.reduce((s, it) => s + itemCount(it), 0);
    expect(text).toContain(`mind a ${n} növény szerepel`);
    expect(text).toContain('| extra | LA | Levendula | 3,00 | 6,00 |');
  });
});
