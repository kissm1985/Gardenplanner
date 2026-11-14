// Random but balanced assignment of species to slots: the counts follow the weights exactly
// (largest remainder), the order is shuffled. Used by the mixed replacement and the zone fill.

export interface MixPart {
  code: string;
  /** Relative share; 1 for each by default. */
  weight: number;
}

/** Counts per part for n slots, proportional to the weights, summing to n. */
export function mixCounts(n: number, parts: MixPart[]): number[] {
  const w = parts.map((p) => Math.max(0, p.weight));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const exact = w.map((x) => (n * x) / sum);
  const out = exact.map(Math.floor);
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0, left = n - out.reduce((a, b) => a + b, 0); k < left; k++) out[order[k % order.length][1]]++;
  return out;
}

/** n species codes in random order, with counts proportional to the weights. */
export function mixAssign(n: number, parts: MixPart[], rnd: () => number = Math.random): string[] {
  const counts = mixCounts(n, parts);
  const out = parts.flatMap((p, i) => Array<string>(counts[i]).fill(p.code));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
