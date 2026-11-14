// Page used by `npm run verify:render` (headless Chromium): renders an example plan by key and returns the render,
// the ID buffer, the manifest and the visibility counts. It holds no state and sends nothing anywhere.
import { buildExample, EXAMPLE_PLANS } from '../data/examples';
import { SEED_PLANTS } from '../data/plants.seed';
import { renderPlan, type RenderOptions, type RenderResult } from './render';

declare global {
  interface Window {
    planterra3d: {
      examples: () => { key: string; name: string; shape: string }[];
      renderExample: (key: string, opts?: RenderOptions) => RenderResult;
    };
  }
}

window.planterra3d = {
  examples: () =>
    EXAMPLE_PLANS.map((ex) => {
      const a = buildExample(ex, { stableIds: true });
      return { key: ex.key, name: a.name, shape: a.shape.kind };
    }),
  renderExample(key, opts = {}) {
    const ex = EXAMPLE_PLANS.find((e) => e.key === key);
    if (!ex) throw new Error(`no example ${key}`);
    const area = buildExample(ex, { stableIds: true });
    return renderPlan(area, SEED_PLANTS, area.variants[0].items, { project: key, ...opts });
  },
};
document.getElementById('status')!.dataset.ready = '1';
