import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CSP, SECURITY_HEADERS } from '../../vite.config';

describe('security headers', () => {
  it('vercel.json sends exactly the headers of the build (dist/_headers)', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(vercel.headers[0].headers.map((h: { key: string; value: string }) => [h.key, h.value])).toEqual(SECURITY_HEADERS);
  });

  it('forbids framing and keeps the app CSP', () => {
    const csp = Object.fromEntries(SECURITY_HEADERS)['Content-Security-Policy'];
    expect(csp.startsWith(CSP)).toBe(true);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(CSP).toContain("script-src 'self'");
  });
});
