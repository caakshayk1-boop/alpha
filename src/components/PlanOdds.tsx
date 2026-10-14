import { num } from '@/lib/format';

export interface Odds { t1?: number; t2?: number; t3?: number; stopped?: number }

/** Each level of a plan with its distance from entry and how often it was actually reached when this engine's rules were tested.
 *  Targets are volatility multiples, not chart levels, so what makes them meaningful is the measured reach, shown beside them. */
export default function PlanOdds({ sl, entry, targets, rMultiples, odds, last, n, cost }: { sl: number; entry: number; targets: number[]; rMultiples: number[]; odds: Odds; last?: number; n?: number; cost?: number }) {
  const row = (label: string, price: number, p: number | undefined, tone: 'up' | 'down' | 'flat', note?: string) => (
    <div key={label} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) 56px', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
      <span className={`num ${tone}`} style={{ fontWeight: 600 }}>{label}</span>
      <span className="num" style={{ color: 'var(--text)' }}>₹{num(price, 2)} <span className="dim">{price === entry ? '' : `${price > entry ? '+' : '−'}${Math.abs((price / entry - 1) * 100).toFixed(1)}%`}{note ? ` · ${note}` : ''}</span></span>
      <span style={{ display: 'block', height: 6, borderRadius: 3, background: 'var(--panel-3)', position: 'relative' }} title={p === undefined ? undefined : `${p.toFixed(0)}% of test trades`}>
        {p !== undefined && <i style={{ position: 'absolute', inset: '0 auto 0 0', width: `${Math.min(100, p)}%`, borderRadius: 3, background: tone === 'down' ? 'var(--down)' : 'var(--up)' }} />}
      </span>
    </div>
  );
  const pct = (v?: number) => (typeof v === 'number' ? `${v.toFixed(0)}%` : '—');
  return (
    <div className="plan" aria-label="Plan levels and how often each was reached in tests">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Plan levels · how often this engine&apos;s test trades reached each</div>
      <div style={{ display: 'grid', gap: 7 }}>
        {[...targets].map((t, i) => [t, i] as const).reverse().map(([t, i]) => row(`T${i + 1}`, t, [odds.t1, odds.t2, odds.t3][i], 'up', `${rMultiples[i]}R`))}
        {row('Entry', entry, undefined, 'flat')}
        {row('Stop', sl, odds.stopped, 'down', '−1R')}
      </div>
      <p className="dim" style={{ fontSize: 12, margin: '10px 0 0' }}>Historical frequency across {typeof n === 'number' ? `${num(n)} test trades` : 'the engine\'s test trades'}, not a probability for this stock: {pct(odds.t1)} reached T1, {pct(odds.t2)} T2, {pct(odds.t3)} T3, {pct(odds.stopped)} were stopped out.{typeof last === 'number' ? ` Now ₹${num(last, 2)}.` : ''}</p>
      <p className="dim" style={{ fontSize: 12, margin: '8px 0 0', paddingTop: 8, borderTop: '1px solid var(--line)' }}><b style={{ color: 'var(--text)', fontWeight: 600 }}>Limits.</b> A model&apos;s levels, not a recommendation. Tested only on companies listed today, so ones that were delisted or collapsed are missing and the record looks better than it was; {typeof cost === 'number' ? `a ${cost}%` : 'a fixed'} round-trip cost and no slippage model, so real fills at the next open can be worse.</p>
    </div>
  );
}
