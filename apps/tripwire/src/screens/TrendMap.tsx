import { useMemo, useState } from 'react';
import { Heat, type HeatCell } from '../widgets.tsx';
import { breadthStats, breadthWord, shortcuts, type Share } from '../breadthstats.ts';
import { trendOf, TREND_RULE_TEXT, type Row } from '../screen.ts';
import { dayWord } from '../fmt.ts';
import { Ago } from '../live.tsx';

export interface MapData { n: number; up: number; mixed: number; down: number; sectors: HeatCell[] }
const pc = (s: Share) => (s.pct == null ? '—' : `${Math.round(s.pct)}%`);

/** The trend map: the split of liquid names into uptrend, sideways and downtrend, a one-word read by a printed rule, the supporting breadth figures, three one-tap questions that open
 *  Discover already filtered, and the groups ranked from strongest to weakest. The split is live when the Worker has today's prices for the names near a line; the rest is the last close, and says so. */
export function TrendMap({ rows, day, map, live, liveAt, open, repriced, err }: { rows: Row[]; day: string | null; map: MapData; live: boolean; liveAt: number | null; open: boolean; repriced: number | null; err: boolean }) {
  const [by, setBy] = useState<'sector' | 'size'>('sector');
  const st = useMemo(() => breadthStats(rows), [rows]); const sc = useMemo(() => shortcuts(rows), [rows]);
  const w = breadthWord(map.up, map.down, map.n);
  const size = useMemo(() => { const g = new Map<string, { n: number; up: number; down: number }>(); for (const r of rows) { if (!r.liquid || !r.tier) continue; const t = trendOf(r).trend; if (!t) continue; const e = g.get(r.tier) ?? { n: 0, up: 0, down: 0 }; e.n++; if (t === 'up') e.up++; if (t === 'down') e.down++; g.set(r.tier, e); }
    return ['large', 'mid', 'small', 'micro'].filter((k) => g.has(k)).map((k) => { const e = g.get(k)!; return { k: `${k[0].toUpperCase()}${k.slice(1)} cap`, key: k, n: e.n, up: (e.up / e.n) * 100, down: (e.down / e.n) * 100 }; }); }, [rows]);
  const ranked = useMemo(() => [...map.sectors].sort((a, b) => (b.up - b.down) - (a.up - a.down)), [map.sectors]);
  const cells: HeatCell[] = by === 'size' ? size : ranked.length > 8 ? [...ranked.slice(0, 4), ...ranked.slice(-4)] : ranked;
  const href = (c: HeatCell) => by === 'size' ? `#/discover?tier=${(c as HeatCell & { key?: string }).key}&trend=${c.up >= c.down ? 'up' : 'down'}` : `#/discover?sector=${encodeURIComponent(c.k)}&trend=${c.up >= c.down ? 'up' : 'down'}`;
  const pct = (v: number) => (map.n ? Math.round((v / map.n) * 100) : null);
  return <div className="card trendmap">
    <div className="row between"><span className="small"><b className="num up">{pct(map.up) ?? '—'}%</b> in an uptrend</span><span className="small dim num">{pct(map.down) ?? '—'}% in a downtrend</span></div>
    <div className="rangebar" role="img" aria-label={`Of ${map.n} liquid stocks, ${map.up} are in an uptrend, ${map.mixed} sideways and ${map.down} in a downtrend`}><i style={{ flexGrow: map.up || .01, background: 'var(--up)' }} /><i style={{ flexGrow: map.mixed || .01, background: 'var(--s3)' }} /><i style={{ flexGrow: map.down || .01, background: 'var(--down)' }} /></div>
    <div className="row between" style={{ margin: '8px 0 2px', alignItems: 'baseline' }}><span className="tm-word">{w.word}</span><span className="small mute">{map.mixed ? `${pct(map.mixed)}% sideways` : ''}</span></div>
    <div className="tm-stats num" role="list" aria-label="Breadth at the last close">
      {([['Above 50-day', st.above50], ['Above 200-day', st.above200], ['Within 5% of high', st.nearHigh], ['RSI 70 or more', st.stretched], ['RSI 30 or less', st.washed]] as [string, Share][]).map(([k, s]) => <span key={k} role="listitem" title={`${s.n} of ${s.of} names that have the figure`}><b>{pc(s)}</b><small>{k}</small></span>)}
    </div>
    <div className="tm-go" role="group" aria-label="Open Discover with these filters">
      {sc.map((x) => <a key={x.id} href={x.href} className="tm-btn"><span className="num tm-n">{x.n}</span><span className="tm-t">{x.title}</span><span className="small mute">{x.line}</span></a>)}
    </div>
    <div className="row between" style={{ margin: '12px 0 6px' }}>
      <span className="k">{by === 'sector' ? (ranked.length > 8 ? 'Four strongest and four weakest sectors' : 'Sectors, strongest first') : 'By size class'}</span>
      <div className="mini-seg" role="group" aria-label="Group by">{(['sector', 'size'] as const).map((v) => <button key={v} aria-pressed={by === v} onClick={() => setBy(v)}>{v === 'sector' ? 'SECTOR' : 'SIZE'}</button>)}</div></div>
    {cells.length > 0 ? <Heat cells={cells} href={href} /> : <p className="small dim" style={{ margin: 0 }}>No group has enough names to compare.</p>}
    <div className="small mute" style={{ margin: '8px 0 0' }}>
      {live && open ? <>Trend split live · <Ago at={liveAt} />. </> : live ? 'Trend split on the last prices. ' : `Trend split at the close of ${dayWord(day)}. `}Breadth figures and groups are always the close of {dayWord(day)}. {map.n} of {st.liquid} liquid names have the 200-day average the trend needs.
      {repriced != null ? ` Today's price was used for the ${repriced} names near a trend line.` : err ? ' Live update unavailable.' : ''}</div>
    <details className="more"><summary>How to read this</summary><div>{w.word === 'No read' ? '' : `${w.word}: `}{w.rule} Uptrend needs all four: {TREND_RULE_TEXT.up}. Downtrend is the mirror; anything else is sideways. The five breadth figures are shares of the names that have the figure; hover one for the count. The shortcuts are screens (the same filters as Discover), not recommendations, and none of this forecasts anything.</div></details>
  </div>;
}
