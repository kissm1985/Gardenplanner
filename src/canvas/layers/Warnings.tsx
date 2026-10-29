import type { Warning } from '../../engine/rules';

/** Screen-sized markers at each active warning: red (error), amber (warning), blue (note). */
export function WarningsLayer({ warnings, s }: { warnings: Warning[]; s: number }) {
  const r = 9 / s;
  // Several warnings on the same spot share one marker (worst severity wins; list is sorted).
  const seen = new Set<string>();
  return (
    <g className="warn-markers" pointerEvents="none" aria-hidden="true">
      {warnings.map((w) => {
        const key = `${Math.round(w.at[0] / 5)}:${Math.round(w.at[1] / 5)}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return (
          <g key={w.id} className={`wm wm-${w.severity}`} transform={`translate(${w.at[0]} ${w.at[1] - r * 1.6})`}>
            <path d={`M0 ${-r}L${r * 1.1} ${r * 0.85}H${-r * 1.1}z`} vectorEffect="non-scaling-stroke" />
            <text fontSize={r * 1.15} textAnchor="middle" y={r * 0.55}>
              !
            </text>
          </g>
        );
      })}
    </g>
  );
}
