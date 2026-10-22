'use client';
/** The Swing v2 paper record: open trades marked to the latest price, the next session's decisions and every closed trade.
 *  Accounting basis (S05): open marks are before costs; closed trades are after the round-trip cost. Where both can be stated
 *  they sit side by side, so no step in a figure comes only from the cost treatment. A level the latest price reaches is a
 *  provisional mark, never an execution event: only the evening run books events (S06). An empty book says so once (H06). */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChangeRing, Flash } from '@/components/ui';
import { useIntraday } from '@/lib/data';
import { dash, num, signed, tone } from '@/lib/format';
import { istDate, nseClock } from '@/lib/live';
import { canAnimate, gsap } from '@/lib/motion';
import { DECISION_TEXT, STATE_TEXT, STOP_TEXT, bookCurve, markSource, type CurvePoint } from '@/lib/plan';
import { istTime, sessionLabel } from '@/lib/price';
import { costR, grossNet, type Lag } from '@/lib/signalsView';
import { companyHref } from '@/lib/slug';
import type { useBook } from '@/lib/useBook';
import { LagNotice } from './LagNotice';
import { STATE_PILL, provisional } from './SetupCard';

const sR = (v: number | null | undefined, d = 2) => signed(v, d, 'R');
const sRs = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}₹${num(Math.abs(v), 0)}` : dash);
const sP = (v: number | null | undefined, d = 2) => signed(v, d, '%');
const r2 = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const RISK_KEY = 'alpha:trades:risk';
const DTONE: Record<string, string> = { exit: 'bad', modify: 'warn', enter: 'acc', hold: '', closed: '', void: 'warn' };
const EXIT: Record<string, string> = { stop: 'Stopped out', lock: 'Raised stop after T1', trail: 'Trailing stop after T1', t2: 'T2 reached', time: 'Time limit' };

/** The book's R made today, bar by bar, with the zero line. Marks before costs, provisional until the evening run. */
function DayCurve({ pts }: { pts: CurvePoint[] }) {
  const path = useRef<SVGPathElement>(null);
  const drawn = useRef(false);
  useEffect(() => {
    const p = path.current;
    if (!p || drawn.current || pts.length < 2) return;
    drawn.current = true;
    if (!canAnimate()) return;
    const len = p.getTotalLength();
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.out', clearProps: 'strokeDasharray,strokeDashoffset' });
  }, [pts.length]);
  if (pts.length < 2) return <p className="dim sg-note">The day curve appears once the session has five-minute bars for an open trade.</p>;
  const W = 640, H = 120, P = 6;
  const lo = Math.min(0, ...pts.map((p) => p.r)), hi = Math.max(0, ...pts.map((p) => p.r));
  const span = hi - lo || 1;
  const x = (i: number) => P + (i / (pts.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - lo) / span) * (H - 2 * P);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.r).toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  const label = `Book R made today from ${istTime(pts[0].t)} to ${istTime(last.t)} IST, before costs: ${sR(last.r)} at the last bar, low ${sR(lo)}, high ${sR(hi)}.`;
  return (
    <figure className="sg-curve">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
        <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} className="zero" />
        <path ref={path} d={d} className={last.r >= 0 ? 'up' : 'down'} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="dim num"><span>{istTime(pts[0].t)}</span><span>high {sR(hi)} · low {sR(lo)}</span><span>{istTime(last.t)} IST</span></figcaption>
    </figure>
  );
}

export function PaperRecord({ book, lag }: { book: ReturnType<typeof useBook>; lag: Lag | null }) {
  const { feed, lv, active, open, pending, totalR, avgR, todayR, todayN, live, newestAt, nearStop, nearTarget, groups, rows } = book;
  const intra = useIntraday(active.filter((s) => s.status === 'open').map((s) => s.sym));
  const [riskTxt, setRiskTxt] = useState('10000');
  useEffect(() => { try { const v = localStorage.getItem(RISK_KEY); if (v) setRiskTxt(v); } catch { /* private mode: default */ } }, []);
  const riskRs = Math.max(0, Number(riskTxt) || 0);
  const setRisk = (v: string) => { const c = v.replace(/[^\d]/g, '').slice(0, 9); setRiskTxt(c); try { localStorage.setItem(RISK_KEY, c); } catch { /* ignore */ } };
  const intraSession = useMemo(() => { const t = Object.values(intra.quotes)[0]?.t?.[0]; return t ? istDate(t) : null; }, [intra.quotes]);
  const curve = useMemo(() => (intraSession ? bookCurve(open.filter((r) => r.s.entry_date && r.s.entry_date <= intraSession).map((r) => ({ s: r.s, session: intraSession })), intra.quotes) : []), [open, intra.quotes, intraSession]);
  const [sort, setSort] = useState<'sym' | 'today' | 'r' | 'state'>('sym');
  const sorted = useMemo(() => [...open].sort((a, b) => {
    if (sort === 'today') return (b.today ?? -1e9) - (a.today ?? -1e9) || a.s.sym.localeCompare(b.s.sym);
    if (sort === 'r') return (b.m.r ?? -1e9) - (a.m.r ?? -1e9) || a.s.sym.localeCompare(b.s.sym);
    if (sort === 'state') return a.m.state.localeCompare(b.m.state) || a.s.sym.localeCompare(b.s.sym);
    return a.s.sym.localeCompare(b.s.sym);
  }), [open, sort]);
  if (!feed) return null;
  const cost = feed.cost_round_trip_pct;
  const done = rows.filter((r) => r.s.status === 'closed' || r.s.status === 'void');
  const closedRows = done.filter((r) => r.s.status === 'closed').map((r) => ({ r, gn: grossNet(r.s.r_net, r.s.entry, r.s.risk, cost) }));
  const grossKnown = closedRows.every((x) => x.gn.gross !== null);
  const recordGross = closedRows.length && grossKnown && closedRows.length === feed.record.closed ? closedRows.reduce((a, x) => a + (x.gn.gross as number), 0) : null;
  const clock = nseClock();
  const session = feed.data_through;
  const provisionalDay = clock.inHours && !!lv.snap && lv.snap.session === istDate(Date.now() / 1000);
  const stamp = live && newestAt ? `live ${istTime(newestAt)} IST` : `${sessionLabel(session)} close`;
  const th = (k: typeof sort, label: string) => <th aria-sort={sort === k ? 'descending' : undefined}><button type="button" className="pbook-sort" onClick={() => setSort(k)}>{label}{sort === k ? ' ↓' : ''}</button></th>;
  const basis = <>Open marks are <b>before costs</b>; closed trades are <b>after the {cost}% round-trip cost</b>, and their gross figure is shown beside the net one.</>;

  // H06 / S08: an empty book is one statement, not a row of zero panels or a flat curve drawn from market bars.
  if (!open.length && !pending.length && !done.length && feed.record.closed === 0) {
    return (
      <>
        <LagNotice feed={feed} lag={lag} />
        <section className="section2 sg-sec" aria-labelledby="sg-rec-h">
          <div className="card">
            <div className="card-h sg-rec-h"><div style={{ minWidth: 0 }}><div className="eyebrow">Paper rule-verification log, not a model portfolio</div><h2 id="sg-rec-h">Swing v2 rulebook sandbox</h2></div><span className="pill acc">Paper · since {sessionLabel(feed.launched)}</span></div>
            <div className="state">
              <b>No paper positions yet, so there is no meaningful P&amp;L curve.</b>
              <p>The book opened on {sessionLabel(feed.launched)} and has taken no trade: {feed.gate.on ? 'no stock has passed every rule' : `the market gate has been off (${feed.gate.passed} of 4 checks pass at the ${sessionLabel(feed.gate.date)} close)`}. Market bars exist for every stock, but a curve drawn with no position in it would only be a flat line. The first open trade starts the record here, marked to the price.</p>
              <div className="acts"><Link className="act" href="#setups">See why nothing qualifies</Link><Link className="act quiet" href="/about/#trades">How the book is marked</Link></div>
            </div>
            <p className="card-foot">{basis} Backtest results are a separate run and are never added to this record: they are under Method and validation.</p>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <LagNotice feed={feed} lag={lag} />
      <section className="section2 sg-sec" aria-labelledby="sg-rec-h">
        <div className="sg-family">
          <div style={{ minWidth: 0 }}><div className="eyebrow">Paper rule-verification log, not a model portfolio</div><h2 id="sg-rec-h" className="sec-title">Swing v2 rulebook sandbox</h2><p className="sec-sub">Model {feed.version} · forward since {sessionLabel(feed.launched)} · {stamp}</p></div>
          <label className="sg-risk">Risk per trade ₹ <input className="field" inputMode="numeric" value={riskTxt} onChange={(e) => setRisk(e.target.value)} aria-label="Rupees risked per trade, for the rupee figures" /></label>
        </div>
        <p className="sg-basis" role="note">{basis}</p>

        <div className="metrics sg-metrics">
          <div><div className="m-l">Today · before costs</div><div className={`m-v num ${tone(r2(todayR))}`}><Flash value={r2(todayR)}>{todayN ? sR(todayR) : dash}</Flash></div><div className="m-n num">{todayN ? `${sRs(todayR * riskRs)} · ${todayN} of ${open.length}` : 'no open trade'}</div></div>
          <div><div className="m-l">Open, marked · before costs</div><div className={`m-v num ${tone(r2(totalR))}`}><Flash value={r2(totalR)}>{open.length ? sR(totalR) : dash}</Flash></div><div className="m-n num">{open.length ? `${sRs(totalR * riskRs)} · avg ${sR(avgR)}` : 'nothing held'}</div></div>
          <div><div className="m-l">Open · waiting</div><div className="m-v num">{open.length} · {pending.length}</div><div className="m-n">{nearStop} near a stop, {nearTarget} near a target</div></div>
          <div><div className="m-l">Closed · after costs</div><div className={`m-v num ${tone(feed.record.total_r)}`}>{feed.record.closed ? sR(feed.record.total_r) : dash}</div><div className="m-n num">{feed.record.closed} closed{recordGross !== null ? ` · gross ${sR(recordGross)}` : feed.record.closed ? ' · gross not derivable for every trade' : ''}</div></div>
        </div>
      </section>

      {open.length > 0 && (
        <section className="section2 sg-sec grid-lead">
          <div className="card">
            <div className="card-h"><h3>Open trades</h3><span className="dim sg-h-note">{open.length} open · plan fixed at issue</span></div>
            <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Open trades (scrolls sideways on small screens)" style={{ maxHeight: 'none' }}>
              <table className="tbl sg-tbl">
                <thead><tr>{th('sym', 'Stock')}<th>Entry</th><th>Price</th>{th('today', 'Today')}{th('r', 'Marked')}<th>Rule stop</th><th>Rule next level</th>{th('state', 'State')}</tr></thead>
                <tbody>
                  {sorted.map(({ s, m, today, todayPct }) => {
                    const c = costR(m.entry, m.risk, cost);
                    return (
                      <tr key={s.id} style={{ cursor: 'default' }}>
                        <td><Link href={companyHref(s.sym)} prefetch={false}><b>{s.sym}</b></Link><div className="dim sg-sub">{s.setup}{m.half ? ' · half sold' : ''}</div></td>
                        <td className="num">₹{num(m.entry, 2)}<div className="dim sg-sub">{s.entry_date ? sessionLabel(s.entry_date) : ''}</div></td>
                        <td className="num"><Flash value={m.price}>₹{num(m.price, 2)}</Flash><div className="dim sg-sub">{markSource(m)}</div></td>
                        <td className={`num ${tone(r2(today))}`}><Flash value={r2(today)}>{sR(today)}</Flash><div className="dim sg-sub">{sP(todayPct)} · {sRs(today === null ? null : today * riskRs)}</div></td>
                        <td className={`num ${tone(r2(m.r))}`}><Flash value={r2(m.r)}>{sR(m.r)}</Flash><div className="dim sg-sub">gross{m.r !== null && c !== null ? ` · ${sR(m.r - c)} net if closed here` : ''}</div></td>
                        <td className="num">₹{num(m.stop, 2)}<div className="dim sg-sub">{STOP_TEXT[m.stopKind]}{m.toStop ? ` ${sP(m.toStop.pct, 1)}` : ''}</div></td>
                        <td className="num">{m.toNext && m.state !== 'stop-hit' ? <>₹{num(m.toNext.price, 2)}<div className="dim sg-sub">{m.toNext.label} {sP(m.toNext.pct, 1)}</div></> : dash}</td>
                        <td><ChangeRing value={m.state}><span className={`pill ${STATE_PILL[m.state]} nodot`}>{STATE_TEXT[m.state]}</span></ChangeRing>{provisional(m.state, m.live) && <div className="dim sg-sub">provisional, not an execution event</div>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="card-foot">A stop or target reached by the latest price is a provisional mark, not an execution event: nothing is recorded until the evening run (18:00, 20:00 and 22:30 IST) books it from the day&apos;s full high and low. &ldquo;Net if closed here&rdquo; subtracts one {cost}% round trip.</p>
          </div>
          <div className="card">
            <div className="card-h"><h3>Book across the day</h3><span className="dim sg-h-note">{intraSession ? sessionLabel(intraSession) : intra.loading ? 'loading…' : 'no bars'}</span></div>
            <DayCurve pts={curve} />
            <p className="card-foot">R made today by the open trades, before costs, from five-minute bars. Provisional until the evening run.</p>
          </div>
        </section>
      )}

      {(open.length > 0 || pending.length > 0 || groups.length > 0) && (
        <section className="section2 sg-sec">
          <div className="card">
            <div className="card-h"><h3>Rule actions for the next session, on paper</h3><span className={`pill ${provisionalDay ? 'warn' : 'acc'} nodot`}>{provisionalDay ? 'Provisional · final after the 15:30 close' : `At the ${sessionLabel(session)} close`}</span></div>
            {groups.length ? groups.map((g) => g.kind === 'hold' ? (
              <details key={g.kind} className="sg-group sg-hold">
                <summary><span className="pill nodot">{DECISION_TEXT[g.kind]}</span> <span className="dim num">{g.items.length} · no change to their orders</span></summary>
                <ul className="sg-dec">{g.items.map((d) => <li key={d.id}><Link href={companyHref(d.sym)} prefetch={false}><b>{d.sym}</b></Link> <span className="dim">{d.detail}</span></li>)}</ul>
              </details>
            ) : (
              <div key={g.kind} className="sg-group">
                <div className="sg-gh"><span className={`pill ${DTONE[g.kind]} nodot`}>{DECISION_TEXT[g.kind]}</span><span className="dim num">{g.items.length}</span></div>
                <ul className="sg-dec">{g.items.map((d) => <li key={d.id}><Link href={companyHref(d.sym)} prefetch={false}><b>{d.sym}</b></Link> <span>{d.headline}</span><div className="dim">{d.detail}</div></li>)}</ul>
              </div>
            )) : <p className="dim sg-note">{feed.gate.on ? 'Nothing to do.' : 'Nothing to do: no new entries while the market gate is off.'}</p>}
            <p className="card-foot">{!feed.gate.on ? 'No new entries while the market gate is off; open trades keep their stops and targets. ' : ''}The evening run books every entry, target and stop from the day&apos;s full high and low; these lines apply the same rules to the latest price. Paper only: no order is placed and none of this is advice.</p>
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className="section2 sg-sec">
          <div className="card">
            <div className="card-h"><h3>Closed and skipped</h3><span className="dim sg-h-note num">{feed.record.closed} closed since {sessionLabel(feed.launched)} · {sR(feed.record.total_r)} after costs</span></div>
            <ul className="rows">
              {done.map(({ s }) => {
                const gn = grossNet(s.r_net, s.entry, s.risk, cost);
                return (
                  <li key={s.id}><Link className="row sg-closed" href={companyHref(s.sym)}>
                    <span style={{ minWidth: 0 }}><span className="row-t">{s.sym} · {s.setup}</span><div className="row-s">{s.status === 'void' ? `Skipped: ${s.void_reason ?? 'entry rule'}` : `${EXIT[s.exit_reason ?? ''] ?? 'Closed'} · ${sessionLabel(s.closed_date)}`}</div></span>
                    {s.status === 'closed' ? <span className="sg-gn num"><span><small>Gross</small>{sR(gn.gross)}</span><span className={tone(gn.net)}><small>Net</small>{sR(gn.net)}</span></span> : <span className="row-r dim">not entered</span>}
                  </Link></li>
                );
              })}
            </ul>
            <p className="card-foot">Net = gross minus one {cost}% round trip, in R of that trade (the engine&apos;s own booking). Only trades closed since launch; the backtest is not added to this list.</p>
          </div>
        </section>
      )}
    </>
  );
}
