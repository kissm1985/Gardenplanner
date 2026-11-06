import { uid } from '../../model/ids';
import { isAncestor } from '../../model/variantTree';
import { type Variant } from '../../model/types';
import { withParent, nextVariantName } from '../projectModel';
import type { Actions, StoreCtx } from '../projectState';

export const variantSlice = ({ get, mapArea }: StoreCtx) =>
  ({
    duplicateVariant: (vid) => {
      const areaId = get().currentAreaId;
      if (!areaId) return null;
      const id = uid('v');
      mapArea(areaId, (a) => {
        const src = a.variants.find((v) => v.id === vid);
        if (!src) return a;
        const copy: Variant = {
          id,
          name: nextVariantName(a.variants),
          notes: src.notes,
          items: src.items.map((it) => ({ ...it, id: uid('i') })),
          // Muted ids that refer to items no longer match; species-level ones carry over.
          muted: src.muted?.filter((m) => !m.includes('i_')),
          parentId: src.id,
        };
        return { ...a, variants: [...a.variants, copy], activeVariantId: id };
      });
      return id;
    },

    addEmptyVariant: () => {
      const areaId = get().currentAreaId;
      if (!areaId) return null;
      const id = uid('v');
      mapArea(areaId, (a) => ({ ...a, variants: [...a.variants, { id, name: nextVariantName(a.variants), items: [], notes: '' }], activeVariantId: id }));
      return id;
    },

    addVariantWith: (name, items, notes, folderName) => {
      const areaId = get().currentAreaId;
      if (!areaId) return null;
      const id = uid('v');
      mapArea(areaId, (a) => {
        let folders = a.variantFolders ?? [];
        let parentId: string | undefined;
        if (folderName) {
          const f = folders.find((x) => x.name === folderName && !x.parentId);
          parentId = f?.id ?? uid('f');
          if (!f) folders = [...folders, { id: parentId, name: folderName }];
        }
        return { ...a, variantFolders: folders, variants: [...a.variants, { id, name, items, notes, ...(parentId ? { parentId } : {}) }], activeVariantId: id };
      });
      return id;
    },

    addVariantFolder: (name, parentId) => {
      const areaId = get().currentAreaId;
      const n = name.trim();
      if (!areaId || !n) return null;
      const id = uid('f');
      mapArea(areaId, (a) => ({ ...a, variantFolders: [...(a.variantFolders ?? []), { id, name: n, ...(parentId ? { parentId } : {}) }] }));
      return id;
    },

    renameVariantFolder: (fid, name) => {
      const areaId = get().currentAreaId;
      const n = name.trim();
      if (!areaId || !n) return;
      mapArea(areaId, (a) => ({ ...a, variantFolders: (a.variantFolders ?? []).map((f) => (f.id === fid ? { ...f, name: n } : f)) }));
    },

    deleteVariantFolder: (fid) => {
      const areaId = get().currentAreaId;
      if (!areaId) return;
      mapArea(areaId, (a) => {
        const f = a.variantFolders?.find((x) => x.id === fid);
        if (!f) return a;
        const up = <T extends { parentId?: string }>(x: T): T => (x.parentId === fid ? withParent(x, f.parentId) : x);
        return { ...a, variantFolders: a.variantFolders!.filter((x) => x.id !== fid).map(up), variants: a.variants.map(up) };
      });
    },

    moveVariantNode: (id, parentId) => {
      const areaId = get().currentAreaId;
      if (!areaId) return;
      mapArea(areaId, (a) => {
        const exists = (x: string) => a.variants.some((v) => v.id === x) || !!a.variantFolders?.some((f) => f.id === x);
        if (!exists(id) || (parentId && (!exists(parentId) || isAncestor(a, id, parentId)))) return a;
        const mv = <T extends { id: string; parentId?: string }>(x: T): T => (x.id === id ? withParent(x, parentId ?? undefined) : x);
        return { ...a, variants: a.variants.map(mv), variantFolders: a.variantFolders?.map(mv) };
      });
    },

    setVariantItems: (vid, items, notes) => {
      const areaId = get().currentAreaId;
      if (!areaId) return;
      mapArea(areaId, (a) => ({ ...a, variants: a.variants.map((v) => (v.id === vid ? { ...v, items, notes, muted: [] } : v)) }));
    },

    renameVariant: (vid, name) => {
      const areaId = get().currentAreaId;
      const n = name.trim();
      if (!areaId || !n) return;
      mapArea(areaId, (a) => ({ ...a, variants: a.variants.map((v) => (v.id === vid ? { ...v, name: n } : v)) }));
    },

    deleteVariant: (vid) => {
      const areaId = get().currentAreaId;
      if (!areaId) return;
      mapArea(areaId, (a) => {
        if (a.variants.length <= 1 || !a.variants.some((v) => v.id === vid)) return a;
        const gone = a.variants.find((v) => v.id === vid)!;
        // Children of the deleted variant move up to its parent.
        const up = <T extends { parentId?: string }>(x: T): T => (x.parentId === vid ? withParent(x, gone.parentId) : x);
        const variants = a.variants.filter((v) => v.id !== vid).map(up);
        const chosen = a.chosenVariantId === vid ? variants[0].id : a.chosenVariantId;
        const active = (a.activeVariantId ?? a.chosenVariantId) === vid ? chosen : a.activeVariantId;
        return { ...a, variants, variantFolders: a.variantFolders?.map(up), chosenVariantId: chosen, activeVariantId: active };
      });
    },

    setActiveVariant: (vid) => {
      const areaId = get().currentAreaId;
      if (areaId) mapArea(areaId, (a) => (a.activeVariantId === vid ? a : { ...a, activeVariantId: vid }));
    },

    setChosenVariant: (vid) => {
      const areaId = get().currentAreaId;
      if (areaId) mapArea(areaId, (a) => (a.chosenVariantId === vid && a.activeVariantId === vid ? a : { ...a, chosenVariantId: vid, activeVariantId: vid }));
    },
  }) satisfies Partial<Actions>;
