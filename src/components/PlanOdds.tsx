import { num } from '@/lib/format';

export interface Odds { t1?: number; t2?: number; t3?: number; stopped?: number }

/** Each level of a plan with its distance from entry and how often it was actually reached when this engine's rules were tested.
 *  Targets are volatility multiples, not chart levels, so what makes them meaningful is the measured reach, shown beside them. */
export default function PlanOdds({ sl, entry, targets, rMultiples, odds, last }: { sl: number; entry: number; targets: number[]; rMultiples: number[]; odds: Odds; last?: number }) {
  const row = (label: string, price: number, p: number | undefined, tone: 'up' | 'down' | 'flat', note?: string) => (
    <div key={label} style={{ display: 'grid', gridTemplateColumns: '38px 1fr 54px', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
      <span className={`num ${tone}`} style={{ fontWeight: 600 }}>{label}</span>
      <span className="num" style={{ color: 'var(--text)' }}>₹{num(price, 2)} <span className="dim">{price === entry ? '' : `${price > entry ? '+' : '−'}${Math.abs((price / entry - 1) * 100).toFixed(1)}%`}{note ? ` · ${note}` : ''}</span></span>
      <span style={{ display: 'block', height: 6, borderRadius: 3, background: 'var(--panel-3)', position: 'relative' }} title={p === undefined ? undefined : `${p.toFixed(0)}% of test trades`}>
        {p !== undefined && <i style={{ position: 'absolute', inset: '0 auto 0 0', width: `${Math.min(100, p)}%`, borderRadius: 3, background: tone === 'down' ? 'var(--down)' : 'var(--up)' }} />}
      </span>
    </div>
  );
  const pct = (v?: number) => (typeof v === 'number' ? `${v.toFixed(0)}%` : '—');
  return (
    <div style={{ minWidth: 230 }} aria-label="Plan levels and how often each was reached in tests">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Plan odds · share of test trades that got there</div>
      <div style={{ display: 'grid', gap: 7 }}>
        {[...targets].map((t, i) => [t, i] as const).reverse().map(([t, i]) => row(`T${i + 1}`, t, [odds.t1, odds.t2, odds.t3][i], 'up', `${rMultiples[i]}R`))}
        {row('Entry', entry, undefined, 'flat')}
        {row('Stop', sl, odds.stopped, 'down', '−1R')}
      </div>
      <p className="dim" style={{ fontSize: 11.5, margin: '10px 0 0' }}>In tests: {pct(odds.t1)} reached T1, {pct(odds.t2)} T2, {pct(odds.t3)} T3, {pct(odds.stopped)} were stopped out.{typeof last === 'number' ? ` Now ₹${num(last, 2)}.` : ''}</p>
    </div>
  );
}
