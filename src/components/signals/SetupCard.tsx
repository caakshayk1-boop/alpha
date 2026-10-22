'use client';
/** One published Swing v2 setup: what it is, the plan as written at issue, and the plan at the latest price (lib/plan.ts).
 *  Every card names its setup type, horizon, issue date, trigger, invalidation, two-target plan, costs and lifecycle state. */
import Link from 'next/link';
import { useState } from 'react';
import { AskAI } from '@/components/Explain';
import { Flash } from '@/components/ui';
import { num, signed, tone } from '@/lib/format';
import { journalHref } from '@/lib/journal';
import { GAP_MAX, LOCK_R, STATE_TEXT, STOP_TEXT, markSource, money, type PlanState } from '@/lib/plan';
import { sessionLabel } from '@/lib/price';
import { LIFECYCLE_TONE, swingLifecycle } from '@/lib/signalsView';
import { companyHref } from '@/lib/slug';
import type { SignalsFeed } from '@/lib/types';
import type { BookRow } from '@/lib/useBook';

export const STATE_PILL: Record<PlanState, string> = { 'awaiting-entry': '', hold: 'acc', 'stop-hit': 'bad', 't1-hit': 'ok', 't2-hit': 'ok', 'time-due': 'warn', closed: '', void: 'warn' };
/** A level reached by a live price is a provisional mark: the evening run books it, or does not, from the day's high and low. */
export const provisional = (state: PlanState, live: boolean) => live && (state === 'stop-hit' || state === 't1-hit' || state === 't2-hit' || state === 'time-due');

export function SetupCard({ row, feed }: { row: BookRow; feed: SignalsFeed }) {
  const { s, m } = row;
  const [capital, setCapital] = useState('500000');
  const [riskPct, setRiskPct] = useState('1');
  const entry = s.entry ?? s.ref_price;
  const risk = s.risk ?? s.ref_price - s.sl;
  const qty = risk > 0 ? Math.floor(((Number(capital) || 0) * (Number(riskPct) || 0) / 100) / risk) : 0;
  const lc = swingLifecycle(feed);
  const prov = provisional(m.state, m.live);
  // a published setup met every rule: the gate's checks, the stock rules and one setup definition
  const criteria = feed.rules.gate.length + feed.rules.stock.length + 1;
  return (
    <article className="card sg-setup">
      <div className="sg-setup-h">
        <div style={{ minWidth: 0 }}>
          <div className="sg-tags"><span className="pill nodot">{s.setup}</span><span className={`pill ${LIFECYCLE_TONE[lc]}`}>{lc}</span><span className="pill ok nodot" title="Every market-gate, stock and setup criterion of the published rule book held at the signal close">Rule match: {criteria} of {criteria} criteria met</span></div>
          <Link href={companyHref(s.sym)} prefetch={false} className="sg-sym">{s.sym}</Link>
          <div className="row-s">{s.name}{s.sector ? ` · ${s.sector}` : ''}</div>
        </div>
        <div className="sg-now">
          <span className={`pill ${STATE_PILL[m.state]} nodot`}>{STATE_TEXT[m.state]}{prov ? ' · provisional' : ''}</span>
          {m.price !== null && <div className="sg-px num"><Flash value={m.price}>₹{num(m.price, 2)}</Flash></div>}
          <small className="dim num">{m.price !== null ? markSource(m) : ''}{m.r !== null ? <> · <b className={tone(m.r)}>{signed(m.r, 2, 'R')}</b> before costs</> : null}</small>
        </div>
      </div>
      <ul className="rows sg-plan">
        <li className="row kvrow"><span className="row-s">Issued</span><span>{sessionLabel(s.date)} close, at {money(s.ref_price)}</span></li>
        <li className="row kvrow"><span className="row-s">Horizon</span><span>Up to {s.max_hold} sessions from entry{m.timeDue ? `: time limit the ${sessionLabel(m.timeDue)} close` : ''}</span></li>
        <li className="row kvrow"><span className="row-s">Trigger</span><span>{s.entry ? `Paper entry at the ${sessionLabel(s.entry_date)} open, ${money(s.entry)}` : `Rule entry at the next open, only if it is at most ${num(GAP_MAX * 100, 0)}% above the signal close (${money(s.ref_price * (1 + GAP_MAX))}) and above the rule stop`}</span></li>
        <li className="row kvrow"><span className="row-s">Invalidation</span><span>Rule {STOP_TEXT[m.stopKind].toLowerCase()} {money(m.stop)}{m.stopKind === 'stop' ? ` (${num(s.risk_pct, 1)}% below the signal close)` : ''}. A gap through it fills at the open.</span></li>
        <li className="row kvrow"><span className="row-s">Target plan</span><span><b>Two-target plan.</b> Rule T1 {money(m.t1)} (+2R) closes half on paper and raises the rule stop on the rest to entry + {LOCK_R}R; rule T2 {money(m.t2)} (+4R) closes the rest.</span></li>
        <li className="row kvrow"><span className="row-s">Costs</span><span>{feed.cost_round_trip_pct}% a round trip on a closed trade; marks are before costs. Fills at the open, no other slippage.</span></li>
      </ul>
      <p className="sg-note sg-ref">These are the rule&apos;s reference levels on paper, used to verify the rule book. They are not advice and not a recommendation to trade.</p>
      {s.why.length > 0 && <ul className="sg-why">{s.why.map((w) => <li key={w}>{w}</li>)}</ul>}
      {prov && <p className="sg-prov">Provisional, not an execution event: the latest price reached this level, and nothing is recorded until the evening run books it.</p>}
      <details className="sg-size">
        <summary>Rule risk arithmetic (paper)</summary>
        <div className="sg-size-f">
          <label>Capital ₹ <input className="field" inputMode="numeric" value={capital} onChange={(ev) => setCapital(ev.target.value.replace(/[^\d]/g, ''))} /></label>
          <label>Risk % <input className="field sg-narrow" inputMode="decimal" value={riskPct} onChange={(ev) => setRiskPct(ev.target.value.replace(/[^\d.]/g, ''))} /></label>
        </div>
        <p className="num">{qty > 0 ? <>{num(qty)} shares ≈ ₹{num(qty * entry, 0)} · a stop-out costs about ₹{num(qty * risk, 0)} before costs</> : 'Risk per share is zero or capital is empty.'}</p>
      </details>
      <div className="sg-acts"><Link className="act quiet" href={journalHref(s.sym, entry, m.stop, m.t1)}>Journal this setup</Link></div>
      <AskAI subject="signal" id={s.id} title={`Ask about this ${s.setup.toLowerCase()}`} compact />
    </article>
  );
}
