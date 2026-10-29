import { beforeEach, describe, expect, it } from 'vitest';
import { buildVisualPrompt } from '../../src/engine/visualPrompt';
import { selectCurrentArea, selectItems, useProject } from '../../src/store/projectStore';

const st = () => useProject.getState();
const prompt = (opt: Partial<Parameters<typeof buildVisualPrompt>[3]> = {}) =>
  buildVisualPrompt(st().project!, selectCurrentArea(st())!, selectItems(st()), { season: 1, viewpoint: 'eye', lang: 'hu', mature: true, ...opt });

describe('visualisation prompt for ChatGPT', () => {
  beforeEach(() => {
    useProject.setState({ project: null, currentAreaId: null, past: [], future: [] });
    st().createProject(['lawn-garden']);
    st().addDrift('LA', [[10, 280], [110, 280], [110, 480], [10, 480]], 'staggered');
    st().placePlant('AC', 440, 150);
  });

  it('describes the site, fixtures, every species with count, place and look', () => {
    const t = prompt();
    expect(t).toContain('Gyepsávos kert: 5,0 × 12,0 m');
    expect(t).toContain('keleti fekvés');
    expect(t).toContain('Gyepsáv: ívelt, lágy szélű nyírt gyep');
    expect(t).toContain('Diófa');
    expect(t).toMatch(/\*\*LA – Levendula\*\* \(\*Lavandula angustifolia 'Munstead'\*\), \d+ tő/);
    expect(t).toContain('folt: x 0,1–1,1 m, y 2,8–4,8 m');
    expect(t).toContain('most virágzik: lila'); // July
    expect(t).toContain('**AC – Törpe japán juhar**');
    expect(t).toContain('ne adj hozzá más növényt');
  });

  it('season changes bloom state; winter shows cut-back plants', () => {
    expect(prompt({ season: 0 })).toContain('Levendula');
    expect(prompt({ season: 0 })).not.toContain('most virágzik: lila');
    expect(prompt({ season: 3 })).toContain('január');
  });

  it('English version and both viewpoints', () => {
    const t = prompt({ lang: 'en', viewpoint: 'both' });
    expect(t).toContain('photorealistic');
    expect(t).toContain('Two images');
    expect(t).toContain('facing east');
  });

  it('planting-time size is smaller than mature', () => {
    expect(prompt({ mature: true })).toContain('kb. 45 cm magas');
    expect(prompt({ mature: false })).toContain('kb. 18 cm magas');
  });
});
