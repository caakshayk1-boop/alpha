/** The breadth gauge on Today: a dotted arc, one dot per slice of the liquid universe, read left to right as uptrend (green), sideways (quiet) and downtrend (red), with the
 *  uptrend share as the one big number. It draws only measured shares (trend map of the published screen); with no figures it draws the empty arc and says so. No forecast. */
const DOTS = 28;
export function BreadthGauge({ upPct, downPct, n }: { upPct: number | null | undefined; downPct: number | null | undefined; n: number | null | undefined }) {
  const ok = typeof upPct === 'number' && typeof downPct === 'number' && !!n;
  const up = ok ? Math.round((upPct as number) / 100 * DOTS) : 0; const down = ok ? Math.round((downPct as number) / 100 * DOTS) : 0;
  const side = ok ? Math.max(0, 100 - Math.round(upPct as number) - Math.round(downPct as number)) : null;
  const label = ok ? `Of ${n} liquid stocks, ${Math.round(upPct as number)}% are in an uptrend, ${side}% sideways and ${Math.round(downPct as number)}% in a downtrend.` : 'The trend shares are not available right now.';
  return <figure className="gauge" data-gauge>
    <svg viewBox="0 0 200 112" role="img" aria-label={label}>
      {Array.from({ length: DOTS }, (_, i) => { const a = Math.PI - (i / (DOTS - 1)) * Math.PI; const x = 100 + 86 * Math.cos(a), y = 100 - 86 * Math.sin(a);
        const cls = !ok ? 'g-off' : i < up ? 'g-up' : i >= DOTS - down ? 'g-down' : 'g-mid';
        return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="4.2" className={cls} style={{ ['--k' as string]: i }} />; })}
      <text x="100" y="82" textAnchor="middle" className="g-num">{ok ? `${Math.round(upPct as number)}%` : '—'}</text>
      <text x="100" y="102" textAnchor="middle" className="g-cap">in an uptrend</text>
    </svg>
    <figcaption>{ok ? <><b className="up">{Math.round(upPct as number)}% up</b> · {side}% sideways · <b className="down">{Math.round(downPct as number)}% down</b> <span className="mute">of {n}</span></> : 'Trend shares unavailable'}</figcaption>
  </figure>;
}
