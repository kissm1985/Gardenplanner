import { describe, expect, it } from 'vitest';
import { localName } from '../../src/i18n/names';

describe('default names follow the language', () => {
  it('element labels, template areas and numbered variants; own names stay', () => {
    expect(localName('Kerítés', 'en')).toBe('Fence');
    expect(localName('Fence', 'hu')).toBe('Kerítés');
    expect(localName('Csap', 'en')).toBe('Tap');
    expect(localName('Járda', 'en')).toBe('Pavement');
    expect(localName('House-side strip', 'hu')).toBe('Házoldali sáv');
    expect(localName('B terv', 'en')).toBe('Plan B');
    expect(localName('Plan 12', 'hu')).toBe('12. terv');
    expect(localName('Ötlet 3', 'en')).toBe('Idea 3');
    expect(localName('Ötletek', 'en')).toBe('Ideas');
    expect(localName('Garázsfal', 'en')).toBe('Garázsfal');
    expect(localName('My own corner', 'hu')).toBe('My own corner');
    expect(localName(undefined, 'hu')).toBe('');
  });
});
