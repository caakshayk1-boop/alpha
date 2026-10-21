'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Async, ChangeRing, Flash, PageHead } from '@/components/ui';
import { canAnimate, gsap } from '@/lib/motion';
import { GatePanel } from '@/components/Gate';
import { useIntraday } from '@/lib/data';
import { useBook } from '@/lib/useBook';
import { dash, num, tone } from '@/lib/format';
import { istDate, nseClock } from '@/lib/live';
import { istTime, sessionLabel } from '@/lib/price';
import { DECISION_TEXT, STATE_TEXT, STATE_TONE, STOP_TEXT, bookCurve, markSource, type CurvePoint } from '@/lib/plan';
import { companyHref } from '@/lib/slug';

const sR = (v: number | null | undefined, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}R` : dash);
const sRs = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}₹${num(Math.abs(v), 0)}` : dash);
const sP = (v: number | null | undefined, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%` : dash);
const r2 = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const RISK_KEY = 'alpha:trades:risk';
const DTONE: Record<string, string> = { exit: 'down', modify: 'warn', enter: 'acc', hold: '', closed: '', void: 'warn' };

/** The book's R made today, bar by bar, with the zero line. One series; the last point is labelled in text beside it. */
function DayCurve({ pts }: { pts: CurvePoint[] }) {
  const path = useRef<SVGPathElement>(null);
  const drawn = useRef(false);
  useEffect(() => {          // draws in once, on the first real curve; later points just extend it
    const p = path.current;
    if (!p || drawn.current || pts.length < 2) return;
    drawn.current = true;
    if (!canAnimate()) return;
    const len = p.getTotalLength();
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.out', clearProps: 'strokeDasharray,strokeDashoffset' });
  }, [pts.length]);
  if (pts.length < 2) return <p className="dim tr-empty">The day curve appears once the session has five-minute bars.</p>;
  const W = 640, H = 120, P = 6;
  const lo = Math.min(0, ...pts.map((p) => p.r)), hi = Math.max(0, ...pts.map((p) => p.r));
  const span = hi - lo || 1;
  const x = (i: number) => P + (i / (pts.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - lo) / span) * (H - 2 * P);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.r).toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  const label = `Book R made today from ${istTime(pts[0].t)} to ${istTime(last.t)} IST: ${sR(last.r)} at the last bar, low ${sR(lo)}, high ${sR(hi)}.`;
  return (
    <figure className="tr-curve">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
        <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} className="zero" />
        <path ref={path} d={d} className={last.r >= 0 ? 'up' : 'down'} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="dim num"><span>{istTime(pts[0].t)}</span><span>high {sR(hi)} · low {sR(lo)}</span><span>{istTime(last.t)} IST</span></figcaption>
    </figure>
  );
}

export default function TradesPage() {
  const { q, feed, lv, active, open, pending, totalR, avgR, todayR, todayN, live, newestAt, nearStop, nearTarget, groups } = useBook();
  const intra = useIntraday(active.filter((s) => s.status === 'open').map((s) => s.sym));
  const [riskTxt, setRiskTxt] = useState('10000');
  useEffect(() => { try { const v = localStorage.getItem(RISK_KEY); if (v) setRiskTxt(v); } catch { /* private mode: default */ } }, []);
  const riskRs = Math.max(0, Number(riskTxt) || 0);
  const setRisk = (v: string) => { const c = v.replace(/[^\d]/g, '').slice(0, 9); setRiskTxt(c); try { localStorage.setItem(RISK_KEY, c); } catch { /* ignore */ } };

  const intraSession = useMemo(() => { const t = Object.values(intra.quotes)[0]?.t?.[0]; return t ? istDate(t) : null; }, [intra.quotes]);
  const curve = useMemo(() => (intraSession ? bookCurve(open.filter((r) => r.s.entry_date && r.s.entry_date <= intraSession).map((r) => ({ s: r.s, session: intraSession })), intra.quotes) : []), [open, intra.quotes, intraSession]);

  const clock = nseClock();
  const session = feed?.data_through ?? null;
  const provisional = clock.inHours && !!lv.snap && lv.snap.session === istDate(Date.now() / 1000);
  const stamp = live && newestAt ? `live ${istTime(newestAt)} IST` : `${sessionLabel(session)} close`;

  const [sort, setSort] = useState<'sym' | 'today' | 'r' | 'state'>('sym');
  const sorted = useMemo(() => [...open].sort((a, b) => {
    if (sort === 'today') return (b.today ?? -1e9) - (a.today ?? -1e9) || a.s.sym.localeCompare(b.s.sym);
    if (sort === 'r') return (b.m.r ?? -1e9) - (a.m.r ?? -1e9) || a.s.sym.localeCompare(b.s.sym);
    if (sort === 'state') return a.m.state.localeCompare(b.m.state) || a.s.sym.localeCompare(b.s.sym);
    return a.s.sym.localeCompare(b.s.sym);
  }), [open, sort]);
  const th = (k: typeof sort, label: string) => <th aria-sort={sort === k ? 'descending' : undefined}><button type="button" className="pbook-sort" onClick={() => setSort(k)}>{label}{sort === k ? ' ↓' : ''}</button></th>;

  return (
    <>
      <PageHead method="trades" eyebrow="Paper book · Swing v2 · experimental research" title="Every paper trade," em="marked to the price." />
      <section className="wrap">
        <Async loading={q.loading} error={q.error} rows={4}>
          {feed && (
            <>
              <GatePanel feed={feed} compact />
              <div className="tr-bar">
                <span className={`lw-stamp${live ? ' on' : ''}`}>{stamp}</span>
                <label className="tr-risk">Risk per trade ₹ <input className="field" inputMode="numeric" value={riskTxt} onChange={(e) => setRisk(e.target.value)} aria-label="Rupees risked per trade, for the rupee figures" /></label>
                <Link href="/about/#trades" className="dim">How this is marked</Link>
              </div>

              <div className="tr-kpis">
                <div><span className="k">Today</span><span className={`v num ${tone(r2(todayR))}`}><Flash value={r2(todayR)}>{todayN ? sR(todayR) : dash}</Flash></span><span className="n num">{todayN ? `${sRs(todayR * riskRs)} · ${todayN} of ${open.length}` : 'no open trade'}</span></div>
                <div><span className="k">Open, marked</span><span className={`v num ${tone(r2(totalR))}`}><Flash value={r2(totalR)}>{open.length ? sR(totalR) : dash}</Flash></span><span className="n num">{open.length ? `${sRs(totalR * riskRs)} · avg ${sR(avgR)}` : 'nothing held'}</span></div>
                <div><span className="k">Open</span><span className="v num">{open.length}</span><span className="n">{pending.length} waiting for entry</span></div>
                <div><span className="k">Closed since launch</span><span className={`v num ${tone(feed.record.total_r)}`}>{feed.record.closed ? sR(feed.record.total_r) : '—'}</span><span className="n num">{feed.record.closed} closed · {nearStop} near a stop, {nearTarget} near a target</span></div>
              </div>

              <div className="panel tight tr-day">
                <div className="tr-h"><h2>Book across the day</h2><span className="dim">{intraSession ? sessionLabel(intraSession) : intra.loading ? 'loading…' : 'no bars'}</span></div>
                <DayCurve pts={curve} />
              </div>

              <div className="panel tight">
                <div className="tr-h"><h2>Open trades</h2><span className="dim">{open.length} open · plan fixed at issue</span></div>
                <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Open trades (scrolls sideways on small screens)" style={{ maxHeight: 'none' }}>
                  <table className="tbl tr-tbl">
                    <thead><tr>{th('sym', 'Stock')}<th>Entry</th><th>Price</th>{th('today', 'Today')}{th('r', 'Total')}<th>Stop</th><th>Next</th>{th('state', 'State')}</tr></thead>
                    <tbody>
                      {sorted.map(({ s, m, today, todayPct }) => (
                        <tr key={s.id} style={{ cursor: 'default' }}>
                          <td><Link href={companyHref(s.sym)} prefetch={false}><b>{s.sym}</b></Link><div className="dim tr-sub">{s.setup}{m.half ? ' · half sold' : ''}</div></td>
                          <td className="num">₹{num(m.entry, 2)}<div className="dim tr-sub">{s.entry_date ? sessionLabel(s.entry_date) : ''}</div></td>
                          <td className="num"><Flash value={m.price}>₹{num(m.price, 2)}</Flash><div className="dim tr-sub">{markSource(m)}</div></td>
                          <td className={`num ${tone(r2(today))}`}><Flash value={r2(today)}>{sR(today)}</Flash><div className="dim tr-sub">{sP(todayPct)} · {sRs(today === null ? null : today * riskRs)}</div></td>
                          <td className={`num ${tone(r2(m.r))}`}><Flash value={r2(m.r)}>{sR(m.r)}</Flash><div className="dim tr-sub">{sRs(m.r === null ? null : m.r * riskRs)}</div></td>
                          <td className="num">₹{num(m.stop, 2)}<div className="dim tr-sub">{STOP_TEXT[m.stopKind]}{m.toStop ? ` ${sP(m.toStop.pct, 1)}` : ''}</div></td>
                          <td className="num">{m.toNext && m.state !== 'stop-hit' ? <>₹{num(m.toNext.price, 2)}<div className="dim tr-sub">{m.toNext.label} {sP(m.toNext.pct, 1)}</div></> : dash}</td>
                          <td><ChangeRing value={m.state}><span className={`tag ${STATE_TONE[m.state]}`}>{STATE_TEXT[m.state]}</span></ChangeRing></td>
                        </tr>
                      ))}
                      {!sorted.length && <tr><td colSpan={8} className="dim">{feed.gate.on ? 'No open trade.' : 'No open trade. The market gate is off, so the book opens nothing new until all four checks pass.'}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel tight">
                <div className="tr-h">
                  <h2>Decisions for the next session</h2>
                  <span className={`tag ${provisional ? 'warn' : 'acc'}`}>{provisional ? `Provisional · final after the 15:30 close` : `At the ${sessionLabel(session)} close`}</span>
                </div>
                {groups.length ? groups.map((g) => g.kind === 'hold' ? (
                  <details key={g.kind} className="tr-group tr-hold">
                    <summary><span className="tag">{DECISION_TEXT[g.kind]}</span> <span className="dim num">{g.items.length} · no change to their orders</span></summary>
                    <ul className="tr-dec">{g.items.map((d) => <li key={d.id}><Link href={companyHref(d.sym)} prefetch={false}><b>{d.sym}</b></Link> <span className="dim">{d.detail}</span></li>)}</ul>
                  </details>
                ) : (
                  <div key={g.kind} className="tr-group">
                    <div className="tr-gh"><span className={`tag ${DTONE[g.kind]}`}>{DECISION_TEXT[g.kind]}</span><span className="dim num">{g.items.length}</span></div>
                    <ul className="tr-dec">
                      {g.items.map((d) => (
                        <li key={d.id}><Link href={companyHref(d.sym)} prefetch={false}><b>{d.sym}</b></Link> <span>{d.headline}</span><div className="dim">{d.detail}</div></li>
                      ))}
                    </ul>
                  </div>
                )) : <p className="dim tr-empty">{feed.gate.on ? 'Nothing to do.' : 'Nothing to do: no open trades, and no new entries while the market gate is off.'}</p>}
                {!feed.gate.on && groups.length > 0 && <p className="dim tr-foot">No new entries while the market gate is off; open trades keep their stops and targets.</p>}
                <p className="dim tr-foot">The evening run (18:00, 20:00 and 22:30 IST) books every entry, target and stop from the day&apos;s full high and low; these lines apply the same rules to the latest price. Paper only: no order is placed and none of this is advice.</p>
              </div>
            </>
          )}
        </Async>
      </section>
    </>
  );
}

