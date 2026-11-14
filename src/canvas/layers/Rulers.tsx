import { niceStep, type View } from '../viewport';

export const RULER = 22; // px

const fmt = (cm: number) => (Math.abs(cm) >= 100 && cm % 100 === 0 ? `${cm / 100} m` : `${cm}`);

/** Screen-space rulers in cm along the top and left edges. */
export function Rulers({ view, w, h }: { view: View; w: number; h: number }) {
  const step = niceStep(view.s, 56);
  const sub = step / (step % 5 === 0 ? 5 : 2);
  const ticks = (len: number, offset: number) => {
    const out: { px: number; v: number; major: boolean }[] = [];
    const start = Math.floor((RULER - offset) / view.s / sub) * sub;
    const end = (len - offset) / view.s;
    for (let v = start; v <= end; v += sub) {
      const px = v * view.s + offset;
      if (px >= RULER) out.push({ px, v: Math.round(v), major: Math.round(v) % step === 0 });
    }
    return out;
  };
  const tx = ticks(w, view.tx);
  const ty = ticks(h, view.ty);
  return (
    <g className="rulers" pointerEvents="none" aria-hidden="true">
      <rect className="ruler-bg" x={0} y={0} width={w} height={RULER} />
      <rect className="ruler-bg" x={0} y={0} width={RULER} height={h} />
      {tx.map((t) => (
        <g key={`x${t.v}`}>
          <line x1={t.px} x2={t.px} y1={t.major ? 8 : 15} y2={RULER} className="ruler-tick" />
          {t.major && (
            <text x={t.px + 3} y={11} className="ruler-label">
              {fmt(t.v)}
            </text>
          )}
        </g>
      ))}
      {ty.map((t) => (
        <g key={`y${t.v}`}>
          <line y1={t.px} y2={t.px} x1={t.major ? 8 : 15} x2={RULER} className="ruler-tick" />
          {t.major && (
            <text transform={`translate(11 ${t.px + 3}) rotate(90)`} className="ruler-label">
              {fmt(t.v)}
            </text>
          )}
        </g>
      ))}
      <rect className="ruler-corner" x={0} y={0} width={RULER} height={RULER} />
      <text x={RULER / 2} y={RULER / 2 + 3} textAnchor="middle" className="ruler-label">
        cm
      </text>
    </g>
  );
}
