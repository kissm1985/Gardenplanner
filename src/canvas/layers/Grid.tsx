import { memo } from 'react';

/** Grid inside the area; every 5th line (or every metre) is drawn stronger. */
export const GridLayer = memo(function GridLayer({ w, h, step }: { w: number; h: number; step: number }) {
  const minor: string[] = [];
  const major: string[] = [];
  const isMajor = (v: number) => v % (step * 5) === 0 || v % 100 === 0;
  for (let x = step; x < w; x += step) (isMajor(x) ? major : minor).push(`M${x} 0V${h}`);
  for (let y = step; y < h; y += step) (isMajor(y) ? major : minor).push(`M0 ${y}H${w}`);
  return (
    <g className="grid" pointerEvents="none">
      <path className="grid-minor" d={minor.join('')} vectorEffect="non-scaling-stroke" />
      <path className="grid-major" d={major.join('')} vectorEffect="non-scaling-stroke" />
    </g>
  );
});
