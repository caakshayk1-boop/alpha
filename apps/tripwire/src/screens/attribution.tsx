import { useMemo, useState } from 'react';
import { attribute, realisedCurve, readRecord, type AttrRow, type CurveIn } from '../attribution.ts';
import { ContributionBars } from './contribution.tsx';
import { SectionHeader } from '../components/index.ts';
import { dayWord, inr0 } from '../fmt.ts';
import { COST_CONVENTION, OPEN_TRADE_LABEL } from '../ledgerview.ts';

const money = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`;
const R = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`;
const tone = (v: number) => (v > 0 ? 'up' : v < 0 ? 'down' : '');

/** The paper book's P&L (realised + open) split by engine and by position. Signed throughout; the engine rows and the position rows each add up to the same total, and the page says so with the
 *  arithmetic. A position with no P&L figure is named as unpriced, never counted as zero. */
export function PnlAttribution({ rows, nameOf }: { rows: readonly AttrRow[]; nameOf: (engine: string) => string }) {
  const [all, setAll] = useState(false);
  const a = useMemo(() => attribute(rows, nameOf, all ? 10_000 : 8), [rows, nameOf, all]);
  if (!a.byEngine.length) return null;
  return <section className="card attr" aria-labelledby="attr-h" data-attribution>
    <SectionHeader id="attr-h" title="Where the P&L came from" description={a.splitKnown ? 'Realised plus unrealised, paper money, split two ways. Both splits add up to the same total.' : `Realised plus open-trade, paper money, split two ways. ${OPEN_TRADE_LABEL}.`} level={3} />
    <div className="attr-total num"><span className="k">Total</span><b className={`amt ${tone(a.total)}`}>{money(a.total)}</b><span className="small dim" data-attr-parts>{money(a.realised)} realised · {money(a.unrealised)} {a.splitKnown ? 'unrealised' : 'open-trade'}</span></div>
    <div className="scroll-x" tabIndex={0} role="region" aria-label="P&L by engine, scrolls sideways"><table className="tbl attr-eng"><caption className="sr">P&amp;L by engine, signed</caption>
      <thead><tr><th scope="col">Engine</th><th scope="col">Positions</th><th scope="col">Realised</th><th scope="col">{a.splitKnown ? 'Unrealised' : 'Open-trade'}</th><th scope="col">Total</th></tr></thead>
      <tbody>{a.byEngine.map((e) => <tr key={e.engine} data-engine={e.engine}><th scope="row">{e.label}</th><td className="num">{e.closed} closed · {e.open} open</td><td className={`num amt ${tone(e.realised)}`}>{money(e.realised)}</td><td className={`num amt ${tone(e.unrealised)}`}>{money(e.unrealised)}</td><td className={`num amt ${tone(e.total)}`}><b>{money(e.total)}</b></td></tr>)}
        <tr className="attr-sum" data-engine-total><th scope="row">All engines</th><td /><td className={`num amt ${tone(a.realised)}`}>{money(a.realised)}</td><td className={`num amt ${tone(a.unrealised)}`}>{money(a.unrealised)}</td><td className={`num amt ${tone(a.total)}`}><b>{money(a.total)}</b></td></tr></tbody></table></div>
    <h3 className="attr-sub">By position</h3>
    <ContributionBars label="P&L by position, realised and open" items={rows.filter((r) => (r.status === 'open' || (r.status === 'closed' && r.r != null)) && typeof r.pnl === 'number').map((r) => ({ key: r.id, label: r.sym, value: r.pnl as number }))} max={all ? 10_000 : 8} />
    {a.positions.count > 8 && <button className="btn sm" style={{ marginTop: 8 }} aria-pressed={all} onClick={() => setAll((x) => !x)}>{all ? 'Show the largest 8' : `Show all ${a.positions.count} positions`}</button>}
    <p className="small mute" style={{ margin: '10px 0 0' }} data-attr-note>{a.engineReconciles && a.positionsReconcile ? 'The engine rows and the position rows each add up to the total to the paisa. ' : ''}{a.unpriced ? `${a.unpriced} position${a.unpriced === 1 ? ' has' : 's have'} no P&L figure yet and ${a.unpriced === 1 ? 'is' : 'are'} in neither split. ` : ''}{a.splitKnown && a.openTrade !== a.unrealised ? `Open-trade P&L (booked partials plus the remaining mark, for positions still open) is ${money(a.openTrade)}; it is a different quantity from unrealised. ` : ''}Paper money after costs and slippage. A gain or loss here describes this book on these days; it is not a forecast.</p>
    {a.splitKnown && <details className="more"><summary>How realised and unrealised are worked out</summary><p className="small" data-cost-convention>{COST_CONVENTION}</p></details>}
  </section>;
}

/** The record in plain sentences, from the closed trades alone. */
export function RecordReading({ rs, min }: { rs: readonly number[]; min: number }) {
  const rd = useMemo(() => readRecord(rs, min), [rs, min]);
  return <section className="rec-sec" aria-labelledby="rec-read" data-record-read>
    <SectionHeader id="rec-read" title="Reading this record" description="What the closed trades say, and what they cannot." />
    {rd.lines.map((l) => <p key={l} className="rec-line">{l}</p>)}
  </section>;
}

/** Closed trades in R by exit day: the running total, its running peak and the drop from it. Drawn only with two or more exit days; always followed by the same numbers as a table. */
export function RealisedCurve({ items }: { items: readonly CurveIn[] }) {
  const c = useMemo(() => realisedCurve(items), [items]);
  if (!c.points.length) return null;
  const W = 300, H = 90, pad = 8; const pts = c.points; const ys = [0, ...pts.map((p) => p.cum), ...pts.map((p) => p.peak)]; const lo = Math.min(...ys), hi = Math.max(...ys); const span = hi - lo || 1;
  const x = (i: number) => (pts.length === 1 ? W / 2 : pad + (i / (pts.length - 1)) * (W - 2 * pad)); const y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.cum).toFixed(1)}`).join(' ');
  const summary = `Running total of closed trades in R: ${pts.map((p) => `${dayWord(p.day)} ${R(p.cum)}`).join(', ')}.${c.maxDrop ? ` Largest drop from a peak ${R(-c.maxDrop.r)}.` : ' No drop from a peak so far.'}`;
  return <section className="rec-sec" aria-labelledby="rec-curve" data-curve>
    <SectionHeader id="rec-curve" title="Realised R over time" description={`${c.trades} closed trade${c.trades === 1 ? '' : 's'}, by exit day. Open positions are not in it. Within a day the order of exits is not known, so each day is read at its end.`} />
    {pts.length >= 2 ? <svg className="curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={summary}><line x1="0" x2={W} y1={y(0)} y2={y(0)} className="curve-zero" /><path d={line} className="curve-line" />{pts.map((p, i) => <circle key={p.day} cx={x(i)} cy={y(p.cum)} r="3" className="curve-dot" />)}</svg>
      : <p className="rec-line">{summary} A line needs two exit days.</p>}
    <p className="rec-line" data-drop>{c.maxDrop ? <>Largest drop from a running peak: <b className="num">{R(-c.maxDrop.r)}</b>{c.maxDrop.from ? `, after ${dayWord(c.maxDrop.from)}` : ''} to {dayWord(c.maxDrop.to)}. Measured on closed trades only, in R, with no capital base, so it is not a percentage of an account.</> : 'No closed day has ended below an earlier peak so far. That is a statement about a short list of trades.'}</p>
    <details className="more"><summary>Table: the same numbers</summary><div className="scroll-x" tabIndex={0} role="region" aria-label="Realised R by exit day, scrolls sideways"><table className="tbl"><thead><tr><th scope="col">Exit day</th><th scope="col">Trades</th><th scope="col">Running total</th><th scope="col">Peak so far</th><th scope="col">Drop from peak</th></tr></thead>
      <tbody>{pts.map((p) => <tr key={p.day}><th scope="row">{dayWord(p.day)}</th><td className="num">{p.n}</td><td className={`num ${tone(p.cum)}`}>{R(p.cum)}</td><td className="num">{R(p.peak)}</td><td className="num">{p.drop ? R(-p.drop) : '0.00R'}</td></tr>)}</tbody></table></div></details>
  </section>;
}
