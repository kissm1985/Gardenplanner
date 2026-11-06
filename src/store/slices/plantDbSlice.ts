import { adoptSeed } from '../projectModel';
import type { Actions, StoreCtx } from '../projectState';

export const plantDbSlice = ({ commit }: StoreCtx) =>
  ({
    // ---------- plant database ----------
    addPlant: (plant) => commit((p) => ({ ...p, plantDb: [...p.plantDb, plant] })),

    updatePlant: (code, plant) =>
      commit((p) => ({
        ...p,
        plantDb: p.plantDb.map((x) => (x.code === code ? plant : x)),
        // A code change must follow the placed items.
        areas:
          code === plant.code
            ? p.areas
            : p.areas.map((a) => ({
                ...a,
                variants: a.variants.map((v) => ({
                  ...v,
                  items: v.items.map((it) => (it.plantId === code ? { ...it, plantId: plant.code } : it)),
                })),
              })),
      })),

    deletePlant: (code) =>
      commit((p) => ({
        ...p,
        plantDb: p.plantDb.filter((x) => x.code !== code),
        areas: p.areas.map((a) => ({
          ...a,
          variants: a.variants.map((v) => ({ ...v, items: v.items.filter((it) => it.plantId !== code) })),
        })),
      })),

    importPlants: (plants, mode) =>
      commit((p) => {
        if (mode === 'replace') {
          // Keep species that are still placed somewhere, so no item loses its plant.
          const used = new Set(p.areas.flatMap((a) => a.variants.flatMap((v) => v.items.map((i) => i.plantId))));
          const incoming = new Set(plants.map((x) => x.code));
          return { ...p, plantDb: [...plants, ...p.plantDb.filter((x) => used.has(x.code) && !incoming.has(x.code))] };
        }
        const byCode = new Map(p.plantDb.map((x) => [x.code, x]));
        for (const x of plants) byCode.set(x.code, x);
        return { ...p, plantDb: [...byCode.values()] };
      }),

    adoptSeedUpdates: (codes) => commit((p) => ({ ...p, plantDb: p.plantDb.map((x) => (x.seedUpdate && (!codes || codes.includes(x.code)) ? adoptSeed(x) : x)) })),
  }) satisfies Partial<Actions>;
