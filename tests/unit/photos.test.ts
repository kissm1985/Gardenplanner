import { describe, expect, it } from 'vitest';
import { lookupPhoto, photoTitles } from '../../src/engine/photos';

describe('plant photos', () => {
  it('titles drop the cultivar and fall back to the genus', () => {
    expect(photoTitles("Lavandula angustifolia 'Munstead'")).toEqual(['Lavandula angustifolia', 'Lavandula']);
    expect(photoTitles("Nepeta × faassenii 'Walker's Low'")).toEqual(['Nepeta × faassenii', 'Nepeta']);
    expect(photoTitles('Hosta sp.')).toEqual(['Hosta']);
    expect(photoTitles("Hylotelephium 'Herbstfreude'")).toEqual(['Hylotelephium']);
  });

  it('finds the page image on Wikipedia, then size, author and licence on Commons', async () => {
    const calls: string[] = [];
    const fake = async (url: string) => {
      calls.push(url);
      const body = url.includes('wikipedia.org')
        ? url.includes('en.wikipedia.org') && url.includes('titles=Lavandula%20angustifolia')
          ? { query: { pages: { '1': { pageimage: 'Lavender.jpg', fullurl: 'https://en.wikipedia.org/wiki/Lavandula_angustifolia' } } } }
          : { query: { pages: { '-1': { missing: '' } } } }
        : {
            query: {
              pages: {
                '2': {
                  imageinfo: [
                    {
                      thumburl: 'https://upload.wikimedia.org/thumb/Lavender.jpg/480px-Lavender.jpg',
                      extmetadata: {
                        Artist: { value: '<a href="x">Jane Doe</a>' },
                        LicenseShortName: { value: 'CC BY-SA 4.0' },
                        LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
                      },
                    },
                  ],
                },
              },
            },
          };
      return { ok: true, json: async () => body };
    };
    const p = await lookupPhoto("Lavandula angustifolia 'Munstead'", fake);
    expect(p).toEqual({
      src: 'https://upload.wikimedia.org/thumb/Lavender.jpg/480px-Lavender.jpg',
      credit: 'Jane Doe, CC BY-SA 4.0',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      filePage: 'https://commons.wikimedia.org/wiki/File:Lavender.jpg',
      pageUrl: 'https://en.wikipedia.org/wiki/Lavandula_angustifolia',
    });
    expect(calls[1]).toContain('commons.wikimedia.org');
    expect(calls[1]).toContain('File%3ALavender.jpg');
  });

  it('null when no free image exists', async () => {
    const fake = async () => ({ ok: true, json: async () => ({ query: { pages: { '-1': { missing: '' } } } }) });
    expect(await lookupPhoto('Nincs ilyen', fake)).toBeNull();
  });
});
