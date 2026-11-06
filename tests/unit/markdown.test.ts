import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { markdownToHtml, slug } from '../../src/ui/markdown';

describe('guide markdown', () => {
  it('GitHub-like heading ids, so the table of contents links work', () => {
    expect(slug('1. Első indítás')).toBe('1-első-indítás');
    expect(slug('4. Rögzített elemek: gyep, burkolat, fal, fa…')).toBe('4-rögzített-elemek-gyep-burkolat-fal-fa');
  });

  it('renders the real guide: every in-page link has a target heading; images resolved', () => {
    const md = readFileSync('docs/UTMUTATO.md', 'utf8');
    const html = markdownToHtml(md, (src) => `X/${src}`);
    const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    const anchors = [...html.matchAll(/data-anchor="([^"]+)"/g)].map((m) => m[1]);
    expect(anchors.length).toBeGreaterThan(15);
    for (const a of anchors) expect([a, ids.has(a)]).toEqual([a, true]);
    expect(html).toContain('src="X/img/03-terv.png"');
    expect(html).toContain('<table>');
    expect(html).not.toContain('**');
    expect(html).not.toMatch(/&lt;img/);
  });

  it('nested lists and inline marks', () => {
    const html = markdownToHtml('- **a** *b*\n  - c `d`\n- [e](#x)');
    expect(html).toBe('<ul>\n<li><b>a</b> <i>b</i>\n<ul>\n<li>c <code>d</code>\n</li></ul>\n</li>\n<li><a href="#x" data-anchor="x">e</a>\n</li></ul>');
  });
});

describe('English guide', () => {
  it('every in-page link has a target heading; the help chapters exist', async () => {
    const md = readFileSync('docs/GUIDE.md', 'utf8');
    const html = markdownToHtml(md);
    const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    for (const a of [...html.matchAll(/data-anchor="([^"]+)"/g)].map((m) => m[1])) expect([a, ids.has(a)]).toEqual([a, true]);
    const { setLang } = await import('../../src/i18n');
    const { helpId } = await import('../../src/ui/helpSections');
    const keys = ['screen', 'areas', 'fixtures', 'placing', 'select', 'replace', 'warnings', 'db', 'variants', 'ideas', 'season', 'list', 'project'] as const;
    const hu = new Set([...markdownToHtml(readFileSync('docs/UTMUTATO.md', 'utf8')).matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    for (const k of keys) {
      setLang('en');
      expect([k, ids.has(helpId(k))]).toEqual([k, true]);
      setLang('hu');
      expect([k, hu.has(helpId(k))]).toEqual([k, true]);
    }
  });
});
