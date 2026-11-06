// Security building blocks (PL-SEC-01): secrets are never stored in clear (codes and tokens as HMAC/SHA-256),
// comparisons are constant-time, and every sensitive route is rate limited.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const hmac = (key: string, s: string) => createHmac('sha256', key).update(s).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// --- TOTP (RFC 6238, SHA-1, 30 s, 6 digits) for the second factor of owners ----------------------------------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function unbase32(s: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32(randomBytes(20));

export function totp(secret: string, atMs: number, step = 0): string {
  const counter = Math.floor(atMs / 30_000) + step;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

/** Accepts the current code and one step either side (clock drift). */
export const totpOk = (secret: string, code: string, atMs: number) => /^\d{6}$/.test(code) && [-1, 0, 1].some((s) => safeEqual(totp(secret, atMs, s), code));

// --- Rate limiting (fixed window, per key) ---------------------------------------------------------------------
export class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  constructor(private now: () => number) {}

  /** Counts one hit; returns the seconds to wait if the limit is exceeded, else 0. */
  hit(key: string, limit: number, windowMs: number): number {
    const t = this.now();
    let h = this.hits.get(key);
    if (!h || h.reset <= t) {
      h = { n: 0, reset: t + windowMs };
      this.hits.set(key, h);
    }
    h.n++;
    if (this.hits.size > 50_000) for (const [k, v] of this.hits) if (v.reset <= t) this.hits.delete(k);
    return h.n > limit ? Math.ceil((h.reset - t) / 1000) : 0;
  }
}
