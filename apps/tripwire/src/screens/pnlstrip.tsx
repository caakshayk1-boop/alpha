// The Book's P&L hierarchy (12 Nov 2026, Tripwire 2.0, 3.1 and 2.1). Display only: every figure comes from ONE snapshot (ledgerview.ts `snapshotOf`).
//   row 1  scope and trust: whose positions, paper only, the two statuses (Quotes; Exit verification), mark coverage, the OLDEST print
//   row 2  the answer: Total P&L, with Realised / Unrealised / Today beneath it. Remaining position value is supporting and never the biggest number.
//   row 3  what moved: biggest gain and loss, largest weight, exceptions; each opens its row
//   then   an all-figures table (symbol + lifecycle id, owner, shares left, entry, mark and its age, realised, unrealised, total, today, state)
// No performance percentage appears: no capital base or cash-flow treatment is defined for this book.
import type { ReactNode } from 'react';
import { Tick } from '../live.tsx';
import { countsTick } from '../tickbasis.ts';
import { inr0, inr } from '../fmt.ts';
import { coverageWords, OPEN_TRADE_LABEL, type Snapshot, type SnapPosition } from '../ledgerview.ts';

export const money = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`);
const tone = (v: number | null | undefined) => ((v ?? 0) > 0 ? 'up' : (v ?? 0) < 0 ? 'down' : '');
export const istHm = (sec: number) => `${new Date((sec + 19800) * 1000).toISOString().slice(11, 16)} IST`;
/** The font size of a big number follows the width of its container and the length of its text (ledger4.css, `--ch`), so the last digit can never wrap. */
const chars = (t: string) => ({ ['--ch' as string]: Math.max(6, t.length) });

/** The only status the Book prints is one that is WRONG: stale or missing quotes, an incomplete exit check, a partial subtotal. A healthy book says nothing (v6, 13 Nov 2026).
 *  What "complete" means, and the oldest print, are on #/info (Book and P&L). */
export const quotesProblem = (word: string | null | undefined): string | null => (word === 'Delayed' ? 'Quotes delayed' : word === 'Unavailable' ? 'Quotes unavailable' : null);
export function TrustRow({ snap, scope, onScope, hasMine, priceWord, throughWord, children }: { snap: Snapshot; scope: 'all' | 'engine' | 'mine'; onScope: (s: 'all' | 'engine' | 'mine') => void; hasMine: boolean; priceWord: string | null | undefined; throughWord: string | null; children?: ReactNode }) {
  const w = coverageWords(snap.coverage, throughWord); const c = snap.coverage; const q = quotesProblem(priceWord);
  const marksProblem = c.state === 'unavailable' || c.missing > 0 || c.closedUnpriced > 0;
  const range = c.oldestPrint != null && c.newestPrint !== c.oldestPrint ? ` (prints ${istHm(c.oldestPrint)} to ${istHm(c.newestPrint!)})` : '';
  return <div className="l4-scope" data-scope-row>
    <div className="l4-who">{hasMine
      ? <div className="l4-seg" role="group" aria-label="Whose positions"><button type="button" aria-pressed={scope === 'all'} onClick={() => onScope('all')}>Both</button><button type="button" aria-pressed={scope === 'engine'} onClick={() => onScope('engine')}>Engine paper book</button><button type="button" aria-pressed={scope === 'mine'} onClick={() => onScope('mine')}>My paper plans</button></div>
      : <b className="l4-scope-name" data-scope-name>Engine paper book</b>}
      {hasMine && <b className="l4-scope-name" data-scope-name>{scope === 'all' ? 'Engine paper book and my paper plans' : scope === 'engine' ? 'Engine paper book' : 'My paper plans'}</b>}</div>
    {(q || !w.exitComplete) && <div className="l4-status" role="group" aria-label="What needs attention">
      {q && <span className="l4-st warn" data-quotes>{q}</span>}
      {!w.exitComplete && <span className="l4-st warn" data-exit-verification title={w.exit}>Exit checks incomplete · {c.historyIncomplete} of {c.open}</span>}
    </div>}
    {marksProblem && <p className="l4-marks small mute" data-marks>{w.marks}{c.atClose && c.live ? `; ${c.live} at a live print, ${c.atClose} at the last close` : ''}{range}.</p>}
    {children}
  </div>;
}

export function TotalRow({ snap, dayLabel }: { snap: Snapshot; dayLabel: string }) {
  const t = snap.totals; const big = t.unavailable ? 'Unavailable' : t.total == null ? '—' : money(t.total);
  return <div className="l4-hero" data-total-pnl>
    <span className="k">Total P&L{t.partial ? ' (partial subtotal)' : ''}</span>
    <b className={`num amt l4-big ${t.unavailable ? '' : tone(t.total)}`} style={chars(big)} data-total>{t.unavailable || t.total == null ? big : <Tick v={t.total} {...countsTick(snap.coverage.live, snap.coverage.atClose)}>{big}</Tick>}</b>
    <dl className="l4-parts" aria-label="What the total is made of">
      <div><dt>Realised</dt><dd className={`num amt ${tone(t.realised)}`} data-realised>{t.unavailable ? '—' : money(t.realised)}</dd></div>
      <div><dt>Unrealised</dt><dd className={`num amt ${tone(t.unrealised)}`} data-unrealised>{money(t.unrealised)}</dd></div>
      <div><dt>{dayLabel}</dt><dd className={`num amt ${tone(t.day)}`} data-day>{money(t.day)}</dd></div>
    </dl>
    <p className="l4-note small mute" data-total-note>{t.openTrade != null ? <>{OPEN_TRADE_LABEL}: {money(t.openTrade)} · </> : null}<a href="#/info?s=pnl">How these are calculated</a></p>
  </div>;
}

export function MovedRow({ snap, onRow }: { snap: Snapshot; onRow: (id: string) => void }) {
  const link = (x: SnapPosition, v: number | null) => <button type="button" className="l4-link" onClick={() => onRow(x.id)}>{x.sym} <span className={`num amt ${tone(v)}`}>{money(v)}</span></button>;
  const g = snap.gainers[0], l = snap.losers[0]; const ex = snap.exceptions;
  /* v6: a tile with nothing in it ("none", "not measured") is not drawn; the row is absent when every tile is empty */
  const tiles = [
    g && <li key="g"><span className="k">Biggest gain</span>{link(g, g.split!.total)}</li>,
    l && <li key="l"><span className="k">Biggest loss</span>{link(l, l.split!.total)}</li>,
    snap.largest && <li key="w"><span className="k">Largest weight</span><span className="num">{snap.largest.sym} {snap.largest.pct.toFixed(1)}%</span></li>,
    ex.length > 0 && <li key="e"><span className="k">Exceptions</span><span>{ex.slice(0, 2).map((x, i) => <span key={x.id}>{i ? ', ' : ''}<button type="button" className="l4-link" onClick={() => onRow(x.id)}>{x.sym}</button></span>)}{ex.length > 2 ? ` and ${ex.length - 2} more` : ''}: {ex.some((x) => x.split?.total == null) ? 'not measured' : 'history incomplete'}</span></li>,
  ].filter(Boolean);
  if (!tiles.length) return null;
  return <ul className="l4-moved" data-moved aria-label="What moved">{tiles}</ul>;
}

const STATE_WORD = { awaiting: 'Awaiting entry', open: 'Open', closed: 'Closed', skipped: 'Skipped at the open' } as const;
export function PnlTable({ snap, onRow, live }: { snap: Snapshot; onRow: (id: string) => void; live: boolean }) {
  if (!snap.positions.length) return null;
  const mk = (x: SnapPosition) => (x.mark == null ? '—' : <>{inr(x.mark)}<small className="l4-age">{x.markKind === 'live' && x.markT != null ? ` print ${istHm(x.markT)}` : x.markKind === 'close' ? ' last close' : ''}</small></>);
  return <details className="more bk-fold" data-pnl-table><summary>Table: every position and every figure · {snap.positions.length}</summary>
    <div className="scroll-x" tabIndex={0} role="region" aria-label="Every position with its figures, scrolls sideways"><table className="tbl l4-table"><caption className="sr">Positions with realised, unrealised and total P&L; snapshot {snap.id}</caption>
      <thead><tr><th scope="col">Symbol</th><th scope="col">Owner</th><th scope="col">Shares left</th><th scope="col">Entry</th><th scope="col">Mark</th><th scope="col">Realised</th><th scope="col">Unrealised</th><th scope="col">Total</th><th scope="col">{live ? 'Today' : 'Last session'}</th><th scope="col">State</th></tr></thead>
      <tbody>{snap.positions.map((x) => <tr key={x.id} data-lifecycle={x.lifecycleId}>
        <th scope="row"><button type="button" className="l4-link" onClick={() => onRow(x.id)}>{x.sym}</button><small className="l4-lc num">{x.lifecycleId}</small></th>
        <td>{x.owner === 'engine' ? 'Engine' : 'You'}</td><td className="num">{x.state === 'closed' || x.state === 'skipped' ? '0' : Math.round(x.qtyLeft * 100) / 100}</td><td className="num">{x.entry == null ? '—' : inr(x.entry)}</td><td className="num">{mk(x)}</td>
        <td className={`num amt ${tone(x.split?.realised)}`}>{x.split && Number.isFinite(x.split.realised) ? money(x.split.realised) : '—'}</td><td className={`num amt ${tone(x.split?.unrealised)}`}>{money(x.split?.unrealised)}</td><td className={`num amt ${tone(x.split?.total)}`}><b>{money(x.split?.total)}</b></td>
        <td className={`num amt ${tone(x.dayPnl)}`}>{money(x.dayPnl)}</td><td>{STATE_WORD[x.state]}{x.incompleteHistory ? ' · history incomplete' : ''}</td></tr>)}</tbody></table></div>
    <p className="small mute">Shares left is what is still held after any booked partial exit. Realised and unrealised follow the convention under Total P&L; a dash is a figure that is not measured, never a zero.</p></details>;
}
