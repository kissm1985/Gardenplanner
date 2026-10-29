// Variants and folders of one area as a tree (parentId links). Unknown parents fall back to the top level.
import type { Area, Variant, VariantFolder } from './types';

export type TreeNode =
  | { kind: 'folder'; id: string; name: string; folder: VariantFolder; children: TreeNode[] }
  | { kind: 'variant'; id: string; name: string; variant: Variant; children: TreeNode[] };

export function variantTree(area: Area): TreeNode[] {
  const folders = area.variantFolders ?? [];
  const nodes = new Map<string, TreeNode>();
  for (const f of folders) nodes.set(f.id, { kind: 'folder', id: f.id, name: f.name, folder: f, children: [] });
  for (const v of area.variants) nodes.set(v.id, { kind: 'variant', id: v.id, name: v.name, variant: v, children: [] });
  const roots: TreeNode[] = [];
  const parentOf = (n: TreeNode) => (n.kind === 'folder' ? n.folder.parentId : n.variant.parentId);
  for (const n of nodes.values()) {
    const pid = parentOf(n);
    const parent = pid ? nodes.get(pid) : undefined;
    // Guard against cycles from hand-edited files: a node never hangs below its own descendant.
    if (parent && !isAncestor(area, n.id, pid!)) parent.children.push(n);
    else roots.push(n);
  }
  return roots;
}

function parentIdOf(area: Area, id: string): string | undefined {
  return area.variants.find((v) => v.id === id)?.parentId ?? area.variantFolders?.find((f) => f.id === id)?.parentId;
}

/** True if `ancestor` is `id` itself or above it in the tree. */
export function isAncestor(area: Area, ancestor: string, id: string): boolean {
  const seen = new Set<string>();
  for (let cur: string | undefined = id; cur && !seen.has(cur); cur = parentIdOf(area, cur)) {
    if (cur === ancestor) return true;
    seen.add(cur);
  }
  return false;
}

/** Number of variants below a node (any depth). */
export function variantCount(n: TreeNode): number {
  return n.children.reduce((s, c) => s + (c.kind === 'variant' ? 1 : 0) + variantCount(c), 0);
}

/** Possible new parents for a node: everything except itself and its descendants. */
export function moveTargets(area: Area, id: string): { id: string | null; label: string }[] {
  const out: { id: string | null; label: string }[] = [{ id: null, label: '— legfelső szint —' }];
  const walk = (ns: TreeNode[], depth: number) => {
    for (const n of ns) {
      if (n.id === id) continue;
      out.push({ id: n.id, label: `${'  '.repeat(depth)}${n.kind === 'folder' ? '📁 ' : ''}${n.name}` });
      walk(n.children, depth + 1);
    }
  };
  walk(variantTree(area), 0);
  return out;
}
