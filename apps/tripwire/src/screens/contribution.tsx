import { useMemo } from 'react';
import { contributions, type ContribIn } from '../contribution.ts';
import { inr0 } from '../fmt.ts';

const money = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`;
/** Open P&L as the parts it is made of: the largest contributions by size (gains and losses both), the rest netted into "Other", and the total. The rows plus Other equal the total exactly.
 *  Sign is in the number and the bar's side of the centre line, never colour alone. */
export function ContributionBars({ items, label, noun = 'position', max = 8, fmt = money }: { items: readonly ContribIn[]; label: string; noun?: string; max?: number; fmt?: (v: number) => string }) {
  const c = useMemo(() => contributions(items, max), [items, max]);
  if (c.count < 2) return null;
  const maxAbs = Math.max(1, ...c.rows.map((r) => Math.abs(r.value)), Math.abs(c.other?.value ?? 0));
  const bar = (v: number) => { const w = (Math.abs(v) / maxAbs) * 50; return <span className="bar2"><i style={{ width: `${w}%`, left: v >= 0 ? '50%' : `${50 - w}%`, background: v >= 0 ? 'var(--up)' : 'var(--down)' }} /></span>; };
  const plural = (n: number) => `${n} ${n === 1 ? noun : `${noun}s`}`;
  return <div style={{ marginTop: 10 }} aria-label={label} data-contrib>
    {c.rows.map((r) => <div key={r.key} className="contrib"><span className="sym trunc">{r.label}</span>{bar(r.value)}<span className={`num amt ${r.value >= 0 ? 'up' : 'down'}`}>{fmt(r.value)}</span></div>)}
    {c.other && <div className="contrib" data-contrib-other><span className="sym trunc">Other ({c.other.n})</span>{bar(c.other.value)}<span className={`num amt ${c.other.value >= 0 ? 'up' : 'down'}`}>{fmt(c.other.value)}</span></div>}
    <div className="contrib" data-contrib-total style={{ fontWeight: 600 }}><span className="sym">Total</span><span /><span className={`num amt ${c.total >= 0 ? 'up' : 'down'}`}>{fmt(c.total)}</span></div>
    <div className="small mute">{c.other ? `Largest ${c.rows.length} of ${plural(c.count)} by size, gains and losses both. Other nets the remaining ${plural(c.other.n)} (${fmt(c.other.gains)} gains, ${fmt(c.other.losses)} losses). ` : ''}The rows{c.other ? ' and Other' : ''} add up to the total.</div>
  </div>;
}
