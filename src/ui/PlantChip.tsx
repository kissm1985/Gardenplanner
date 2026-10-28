import { textOn } from '../model/plants';
import type { Plant } from '../model/types';

/** Coloured round badge with the plant code (colour + code + shape, colour-blind friendly). */
export function PlantChip({ p, size = 32 }: { p: Plant; size?: number }) {
  const shape = p.symbol ?? 'circle';
  return (
    <span
      className={`pchip pchip-${shape}`}
      style={{ background: p.color, color: textOn(p.color), width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {p.code}
    </span>
  );
}
