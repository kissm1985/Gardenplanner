import { beforeEach, describe, expect, it } from 'vitest';
import { buildBom } from '../../src/engine/bom';
import { compareVariants } from '../../src/engine/compare';
import { moveTargets, variantTree, type TreeNode } from '../../src/model/variantTree';
import { activeVariant, nextVariantName, selectCurrentArea, selectItems, useProject } from '../../src/store/projectStore';

const st = () => useProject.getState();
const area = () => selectCurrentArea(st())!;

describe('variants', () => {
  beforeEach(() => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip']);
  });

  it('copy makes "B terv" with fresh item ids and switches editing to it', () => {
    st().addRow('LA', [[60, 0], [60, 400]]);
    const a = area().variants[0];
    const bId = st().duplicateVariant(a.id)!;
    const b = area().variants.find((v) => v.id === bId)!;
    expect(b.name).toBe('B terv');
    expect(b.items).toHaveLength(1);
    expect(b.items[0].id).not.toBe(a.items[0].id);
    expect(activeVariant(area()).id).toBe(bId);
    expect(area().chosenVariantId).toBe(bId); // the plan on screen is the chosen one
  });

  it('editing affects only the open variant, which is also the chosen one', () => {
    st().placePlant('LA', 60, 100);
    const a = area().variants[0].id;
    st().duplicateVariant(a);
    st().placePlant('TH', 60, 300); // into B
    expect(selectItems(st())).toHaveLength(2);
    expect(buildBom(st().project!).planted).toBe(2); // B is open and chosen
    st().setActiveVariant(a);
    expect(buildBom(st().project!).planted).toBe(1);
    expect(area().variants.find((v) => v.id !== a)!.items).toHaveLength(2); // B kept its plants
  });

  it('rename, delete (never the last), chosen falls back', () => {
    const a = area().variants[0].id;
    const b = st().duplicateVariant(a)!;
    st().renameVariant(b, '  Kőkert  ');
    expect(area().variants[1].name).toBe('Kőkert');
    st().setChosenVariant(b);
    st().deleteVariant(b);
    expect(area().variants).toHaveLength(1);
    expect(area().chosenVariantId).toBe(a);
    expect(activeVariant(area()).id).toBe(a);
    st().deleteVariant(a);
    expect(area().variants).toHaveLength(1);
  });

  it('names continue alphabetically', () => {
    expect(nextVariantName([{ id: '1', name: 'A terv', items: [], notes: '' }, { id: '2', name: 'C terv', items: [], notes: '' }])).toBe('B terv');
  });

  it('comparison: counts, cost difference, warnings', () => {
    st().addRow('LA', [[60, 0], [60, 400]]); // 11 lavender
    const a = area().variants[0];
    st().duplicateVariant(a.id);
    st().placePlant('NE', 60, 600); // catmint 60 cm → height error in B
    const b = activeVariant(area());
    const c = compareVariants(st().project!, area(), area().variants[0], b);
    expect(c.a.bom.planted).toBe(11);
    expect(c.b.bom.planted).toBe(12);
    expect(c.b.bom.total - c.a.bom.total).toBe(2 * 1199); // 1 catmint → order 2
    expect(c.a.errors).toBe(0);
    expect(c.b.errors).toBe(1);
    expect(c.rows.find((r) => r.plant.code === 'NE')).toMatchObject({ a: 0, b: 1 });
  });
});

describe('variant tree', () => {
  beforeEach(() => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['house-strip']);
  });
  const names = (ns: TreeNode[]): unknown => ns.map((n) => (n.children.length ? { [n.name]: names(n.children) } : n.name));

  it('copies hang under their source; ideas go into the "Ötletek" folder', () => {
    const a = area().variants[0].id;
    const b = st().duplicateVariant(a)!;
    st().duplicateVariant(b);
    st().addVariantWith('Ötlet 1', [], '', 'Ötletek');
    st().addVariantWith('Ötlet 2', [], '', 'Ötletek');
    expect(names(variantTree(area()))).toEqual([{ Ötletek: ['Ötlet 1', 'Ötlet 2'] }, { 'A terv': [{ 'B terv': ['C terv'] }] }]);
  });

  it('move refuses cycles; folder and variant deletion lift children one level', () => {
    const a = area().variants[0].id;
    const b = st().duplicateVariant(a)!;
    const c = st().duplicateVariant(b)!;
    st().moveVariantNode(a, c); // would be a cycle
    expect(area().variants.find((v) => v.id === a)!.parentId).toBeUndefined();
    const f = st().addVariantFolder('Tavaszi')!;
    st().moveVariantNode(c, f);
    expect(names(variantTree(area()))).toEqual([{ Tavaszi: ['C terv'] }, { 'A terv': ['B terv'] }]);
    expect(moveTargets(area(), a).map((t) => t.label.trim())).toEqual(['— legfelső szint —', '📁 Tavaszi', 'C terv']);
    st().deleteVariantFolder(f);
    st().deleteVariant(a);
    expect(names(variantTree(area()))).toEqual(['B terv', 'C terv']);
    st().undo();
    expect(names(variantTree(area()))).toEqual([{ 'A terv': ['B terv'] }, 'C terv']);
  });
});
