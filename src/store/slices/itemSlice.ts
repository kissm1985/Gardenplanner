import { itemPositions } from '../../engine/fill';
import { mixAssign } from '../../engine/mix';
import { uid } from '../../model/ids';
import { type Area, type PlacedItem, type Pt, type Variant } from '../../model/types';
import { activeVariant, translateItem, round1, roundPts, withCount, roundItem } from '../projectModel';
import type { Actions, StoreCtx } from '../projectState';

export const itemSlice = ({ get, commit, mapArea, mapItems, mapFixtures, plantSpacing }: StoreCtx) =>
  ({
    // ---------- placed items ----------
    placePlant: (plantId, x, y) => {
      if (!get().currentAreaId) return null;
      const id = uid('i');
      mapItems((items) => [...items, { kind: 'plant', id, plantId, x: round1(x), y: round1(y), status: 'needed' }]);
      return id;
    },

    addDrift: (plantId, polygon, pattern, spacingCm) => {
      const sp = spacingCm ?? plantSpacing(plantId);
      if (!get().currentAreaId || polygon.length < 3 || !sp) return null;
      const id = uid('i');
      const it = withCount({ kind: 'drift', id, plantId, polygon: roundPts(polygon), pattern, spacingCm: sp, count: 0, status: 'needed' });
      mapItems((items) => [...items, it]);
      return id;
    },

    addRow: (plantId, path, spacingCm) => {
      const sp = spacingCm ?? plantSpacing(plantId);
      if (!get().currentAreaId || path.length < 2 || !sp) return null;
      const id = uid('i');
      const it = withCount({ kind: 'row', id, plantId, path: roundPts(path), spacingCm: sp, count: 0, status: 'needed' });
      mapItems((items) => [...items, it]);
      return id;
    },

    updateShape: (id, points) =>
      mapItems((items) =>
        items.map((it) => {
          if (it.id !== id) return it;
          if (it.kind === 'drift') return withCount({ ...it, polygon: roundPts(points) });
          if (it.kind === 'row') return withCount({ ...it, path: roundPts(points) });
          return it;
        }),
      ),

    moveItems: (ids, dx, dy) => {
      if (!ids.length || (dx === 0 && dy === 0)) return;
      const set_ = new Set(ids);
      mapItems((items) => items.map((it) => (set_.has(it.id) ? withCount(roundItem(translateItem(it, dx, dy))) : it)));
    },

    updateItems: (ids, patch) => {
      const set_ = new Set(ids);
      mapItems((items) =>
        items.map((it) => {
          if (!set_.has(it.id)) return it;
          const { x, y, pattern, spacingCm, ...rest } = patch;
          let next = { ...it, ...rest } as PlacedItem;
          if (next.kind === 'plant') {
            if (x !== undefined || y !== undefined) next = { ...next, x: round1(x ?? next.x), y: round1(y ?? next.y) };
            return next;
          }
          // A species change on a drift/row adopts the new plant's spacing unless one is given.
          const sp = spacingCm ?? (rest.plantId && rest.plantId !== it.plantId ? plantSpacing(rest.plantId) : undefined);
          if (sp && sp > 0) next = { ...next, spacingCm: Math.round(sp * 10) / 10 };
          if (pattern && next.kind === 'drift') next = { ...next, pattern };
          return withCount(next);
        }),
      );
    },

    replaceSpecies: (from, to, scope, keepSpacing = false, mode = 'item') => {
      const p0 = get().project;
      const areaId = get().currentAreaId;
      if (!p0) return 0;
      const byCode = new Map(p0.plantDb.map((x) => [x.code, x]));
      const parts = (typeof to === 'string' ? [{ code: to, weight: 1 }] : to).filter((x) => x.code !== from && byCode.has(x.code) && x.weight > 0);
      if (!parts.length) return 0;
      // Several targets "per plant": drifts and rows are split into single plants at their current positions.
      const perPlant = parts.length > 1 && mode === 'plant';
      const inScope = (a: Area, v: Variant) => (scope === 'project' || a.id === areaId) && (scope !== 'variant' || v.id === activeVariant(a).id);
      let slots = 0;
      for (const a of p0.areas) for (const v of a.variants) if (inScope(a, v)) for (const it of v.items) if (it.plantId === from) slots += perPlant ? itemPositions(it).length : 1;
      if (!slots) return 0;
      const assign = mixAssign(slots, parts);
      let k = 0;
      const swap = (items: PlacedItem[]): PlacedItem[] =>
        items.flatMap((it): PlacedItem[] => {
          if (it.plantId !== from) return [it];
          if (perPlant && it.kind !== 'plant')
            return itemPositions(it).map(([x, y]) => ({
              kind: 'plant',
              id: uid('i'),
              plantId: assign[k++],
              x: round1(x),
              y: round1(y),
              status: it.status,
              ...(it.note ? { note: it.note } : {}),
            }));
          const code = assign[k++];
          if (it.kind === 'plant') return [{ ...it, plantId: code }];
          return [withCount({ ...it, plantId: code, spacingCm: keepSpacing ? it.spacingCm : byCode.get(code)!.spacingCm })];
        });
      commit((p) => ({
        ...p,
        areas: p.areas.map((a) => {
          const variants = a.variants.map((v) => (inScope(a, v) && v.items.some((it) => it.plantId === from) ? { ...v, items: swap(v.items) } : v));
          return variants.some((v, i) => v !== a.variants[i]) ? { ...a, variants } : a;
        }),
      }));
      return slots;
    },

    explodeItems: (ids) => {
      const set_ = new Set(ids);
      const created: string[] = [];
      mapItems((items) =>
        items.some((it) => set_.has(it.id) && it.kind !== 'plant')
          ? items.flatMap((it): PlacedItem[] => {
              if (!set_.has(it.id) || it.kind === 'plant') return [it];
              return itemPositions(it).map(([x, y]) => {
                const id = uid('i');
                created.push(id);
                return { kind: 'plant', id, plantId: it.plantId, x: round1(x), y: round1(y), status: it.status, ...(it.note ? { note: it.note } : {}) };
              });
            })
          : items,
      );
      return created;
    },

    applyFill: (add, removeIds) => {
      if (!add.length && !removeIds.length) return;
      const rm = new Set(removeIds);
      mapItems((items) => [...items.filter((i) => !rm.has(i.id)), ...add]);
    },

    deleteItems: (ids) => {
      if (!ids.length) return;
      const set_ = new Set(ids);
      mapItems((items) => (items.some((i) => set_.has(i.id)) ? items.filter((i) => !set_.has(i.id)) : items));
    },

    duplicateItems: (ids, dx, dy) => {
      const set_ = new Set(ids);
      const created: string[] = [];
      mapItems((items) => {
        const copies = items
          .filter((i) => set_.has(i.id))
          .map((i) => {
            const c = { ...withCount(roundItem(translateItem(i, dx, dy))), id: uid('i') };
            created.push(c.id);
            return c;
          });
        return copies.length ? [...items, ...copies] : items;
      });
      return created;
    },

    setMuted: (wid, muted) => {
      const id = get().currentAreaId;
      if (!id) return;
      mapArea(id, (a) => {
        const v = activeVariant(a);
        const cur = v.muted ?? [];
        if (cur.includes(wid) === muted) return a;
        const next = muted ? [...cur, wid] : cur.filter((x) => x !== wid);
        return { ...a, variants: a.variants.map((x) => (x.id === v.id ? { ...x, muted: next } : x)) };
      });
    },

    setSpeciesStatus: (code, status, areaIds, onlyFrom) =>
      commit((p) => ({
        ...p,
        areas: p.areas.map((a) =>
          !areaIds.includes(a.id)
            ? a
            : {
                ...a,
                variants: a.variants.map((v) =>
                  v.id !== a.chosenVariantId
                    ? v
                    : {
                        ...v,
                        items: v.items.map((it) => (it.plantId === code && (!onlyFrom || it.status === onlyFrom) && it.status !== status ? { ...it, status } : it)),
                      },
                ),
              },
        ),
      })),

    addFixture: (f) => {
      const areaId = get().currentAreaId;
      if (!areaId) return null;
      const id = uid('f');
      mapArea(areaId, (a) => ({ ...a, fixtures: [...a.fixtures, { ...f, id }] }));
      return id;
    },

    updateFixture: (fid, patch) => mapFixtures((fs) => fs.map((f) => (f.id === fid ? { ...f, ...patch } : f))),

    moveFixture: (fid, dx, dy) => {
      if (dx === 0 && dy === 0) return;
      mapFixtures((fs) =>
        fs.map((f) =>
          f.id === fid
            ? {
                ...f,
                x: round1(f.x + dx),
                y: round1(f.y + dy),
                ...(f.polygon ? { polygon: f.polygon.map(([x, y]) => [round1(x + dx), round1(y + dy)] as Pt) } : {}),
              }
            : f,
        ),
      );
    },

    deleteFixture: (fid) => mapFixtures((fs) => fs.filter((f) => f.id !== fid)),

    setCamera: (cam) => {
      const id = get().currentAreaId;
      if (!id) return;
      mapArea(id, (a) => {
        if (!cam) {
          const { camera: _drop, ...rest } = a;
          return rest;
        }
        return { ...a, camera: { x: Math.round(cam.x), y: Math.round(cam.y), dir: Math.round(((cam.dir % 360) + 360) % 360) } };
      });
    },

    addRender: (vid, r) => {
      const id = get().currentAreaId;
      if (!id) return;
      mapArea(id, (a) => ({ ...a, variants: a.variants.map((v) => (v.id === vid ? { ...v, renders: [...(v.renders ?? []), { ...r, id: uid('r') }] } : v)) }));
    },

    deleteRender: (vid, rid) => {
      const id = get().currentAreaId;
      if (!id) return;
      mapArea(id, (a) => ({ ...a, variants: a.variants.map((v) => (v.id === vid ? { ...v, renders: (v.renders ?? []).filter((x) => x.id !== rid) } : v)) }));
    },

    setBackground: (bg) => {
      const id = get().currentAreaId;
      if (!id) return;
      mapArea(id, (a) => {
        if (!bg) {
          const { background: _drop, ...rest } = a;
          return rest;
        }
        return { ...a, background: bg };
      });
    },

    setAreaShape: (areaId, pts) => {
      if (pts.length < 3) return;
      // Whole centimetres are plenty for an outline drawn on a phone.
      const whole = pts.map(([x, y]) => [Math.round(x), Math.round(y)] as Pt);
      const xs = whole.map((p) => p[0]);
      const ys = whole.map((p) => p[1]);
      const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
      const dx = -minX;
      const dy = -minY;
      const points = whole.map(([x, y]) => [x + dx, y + dy] as Pt);
      mapArea(areaId, (a) => ({
        ...a,
        shape: { kind: 'polygon', points },
        widthCm: Math.max(...xs) - minX,
        lengthCm: Math.max(...ys) - minY,
        variants: a.variants.map((v) => ({ ...v, items: v.items.map((it) => withCount(roundItem(translateItem(it, dx, dy)))) })),
        fixtures: a.fixtures.map((f) => ({
          ...f,
          x: round1(f.x + dx),
          y: round1(f.y + dy),
          ...(f.polygon ? { polygon: f.polygon.map(([x, y]) => [round1(x + dx), round1(y + dy)] as Pt) } : {}),
        })),
        ...(a.background ? { background: { ...a.background, x: a.background.x + dx, y: a.background.y + dy } } : {}),
      }));
    },
  }) satisfies Partial<Actions>;
