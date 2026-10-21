'use client';

import Link from 'next/link';
import { useState } from 'react';
import Curve from '@/components/Curve';
import { GatePanel } from '@/components/Gate';
import { Async, Flash, PageHead, Rv } from '@/components/ui';
import { dash, num, tone } from '@/lib/format';
import { journalHref } from '@/lib/journal';
import { STATE_TEXT, STATE_TONE, STOP_TEXT, markSource, money } from '@/lib/plan';
import { sessionLabel } from '@/lib/price';
import { companyHref } from '@/lib/slug';
import type { BtStats, Sig, SignalsFeed } from '@/lib/types';
import { useBook, type BookRow } from '@/lib/useBook';

const sR = (v: number | null | undefined, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}R` : dash);
const f = (v: number | null | undefined, d = 1, suf = '') => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(d)}${suf}` : dash);
const EXIT: Record<string, string> = { stop: 'Stopped out', lock: 'Profit lock after T1', trail: 'Trailing stop after T1', t2: 'T2 reached', time: 'Time limit' };

/** One active signal: what fired, the plan as written, and the plan at the latest price. */
function SignalCard({ row }: { row: BookRow }) {
  const { s, m } = row;
  const [capital, setCapital] = useState('500000');
  const [riskPct, setRiskPct] = useState('1');
  const entry = s.entry ?? s.ref_price;
  const risk = s.risk ?? s.ref_price - s.sl;
  const qty = risk > 0 ? Math.floor(((Number(capital) || 0) * (Number(riskPct) || 0) / 100) / risk) : 0;
  return (
    <Rv className="panel spot sig2">
      <div className="sig2-head">
        <div>
          <div className="eyebrow">{s.setup} · signal {sessionLabel(s.date)}</div>
          <Link href={companyHref(s.sym)} prefetch={false} className="disp sig-sym">{s.sym}</Link>
          <div className="sig-name">{s.name}{s.sector ? ` · ${s.sector}` : ''}</div>
        </div>
        <div className="sig2-now">
          <span className={`tag ${STATE_TONE[m.state]}`}>{STATE_TEXT[m.state]}</span>
          {m.price !== null && <div className="v num"><Flash value={m.price}>₹{num(m.price, 2)}</Flash></div>}
          <div className="dim num" style={{ fontSize: 12 }}>{m.price !== null ? markSource(m) : ''}{m.r !== null ? <> · <b className={tone(m.r)}>{sR(m.r)}</b></> : null}</div>
        </div>
      </div>
      <div className="kv sig2-plan">
        <div><div className="k">{s.entry ? `Entered ${sessionLabel(s.entry_date)}` : 'Entry'}</div><div className="v">{s.entry ? money(s.entry) : `next open ≤ ${money(s.ref_price * 1.02)}`}</div></div>
        <div><div className="k">{STOP_TEXT[m.stopKind]}</div><div className="v">{money(m.stop)}</div></div>
        <div><div className="k">T1 · sell half</div><div className="v">{money(m.t1)}</div></div>
        <div><div className="k">T2 · sell the rest</div><div className="v">{money(m.t2)}</div></div>
      </div>
      <p className="dim num sig2-risk">Risk {f(s.risk_pct, 1, '%')} to the stop · time limit {s.max_hold} sessions{m.timeDue ? ` (${sessionLabel(m.timeDue)})` : ''}</p>
      <ul className="sig2-why">{s.why.map((w) => <li key={w}>{w}</li>)}</ul>
      <details className="sig-why">
        <summary>How many shares fit your risk?</summary>
        <div className="filters" style={{ marginTop: 8 }}>
          <label className="muted" style={{ fontSize: 14 }}>Capital ₹ <input className="field" style={{ minWidth: 110, height: 32 }} inputMode="numeric" value={capital} onChange={(ev) => setCapital(ev.target.value.replace(/[^\d]/g, ''))} /></label>
          <label className="muted" style={{ fontSize: 14 }}>Risk % <input className="field" style={{ minWidth: 60, width: 70, height: 32 }} inputMode="decimal" value={riskPct} onChange={(ev) => setRiskPct(ev.target.value.replace(/[^\d.]/g, ''))} /></label>
        </div>
        <p className="num" style={{ margin: 0, fontSize: 14 }}>{qty > 0 ? <>{num(qty)} shares ≈ ₹{num(qty * entry, 0)} · a stop-out costs about ₹{num(qty * risk, 0)}</> : 'Risk per share is zero or capital is empty.'}</p>
      </details>
      <div style={{ marginTop: 10 }}><Link className="chip" href={journalHref(s.sym, entry, m.stop, m.t1)}>Journal this signal</Link></div>
    </Rv>
  );
}

function StatsRow({ label, x }: { label: string; x?: BtStats }) {
  return (
    <tr style={{ cursor: 'default' }}>
      <td>{label}</td>
      <td className="num">{x?.n ? num(x.n) : dash}</td>
      <td className="num">{f(x?.win_rate, 0, '%')}</td>
      <td className={`num ${tone(x?.expectancy_r)}`}>{sR(x?.expectancy_r)}</td>
      <td className="num">{f(x?.profit_factor, 2)}</td>
      <td className="num">{f(x?.max_dd_r, 1, 'R')}</td>
      <td className="num">{f(x?.clustered_t_clustered, 2)}</td>
    </tr>
  );
}

function BacktestPanel({ feed }: { feed: SignalsFeed }) {
  const b = feed.backtest;
  if (!b) return <Rv className="panel tight"><div className="eyebrow">Backtest</div><p className="muted" style={{ margin: '6px 0 0' }}>The rules have not been tested yet. Until they are, alerts stay off.</p></Rv>;
  const hold = b.rules.holdout;
  return (
    <Rv className="panel tight">
      <div className="tr-h"><h2>The test: rules fixed first, holdout read once</h2><span className="dim num">{b.universe} stocks · {b.periods.development[0]} to {b.periods.holdout[1]}</span></div>
      <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Backtest results (scrolls sideways on small screens)" style={{ maxHeight: 'none' }}>
        <table className="tbl">
          <thead><tr><th style={{ textAlign: 'left' }}>Net of 0.25% costs</th><th>Trades</th><th>Won</th><th>Avg</th><th>Profit factor</th><th>Worst drawdown</th><th>Month t</th></tr></thead>
          <tbody>
            <StatsRow label="Rules · development" x={b.rules.development} />
            <StatsRow label="Rules · holdout" x={b.rules.holdout} />
            <StatsRow label="Without the market gate · holdout" x={b.no_gate.holdout} />
            <StatsRow label="Random stocks, same plan · holdout" x={b.random.holdout} />
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 14, margin: '10px 0 0' }}>
        Holdout: {num(hold.n ?? 0)} trades, {sR(hold.expectancy_r)} each, month-clustered t {f(hold.clustered_t_clustered, 2)}. {feed.alert_why}
      </p>
      {b.curve.rules.length > 1 && <div style={{ marginTop: 10 }}><Curve a={b.curve.rules.map((x) => [x.m, x.r] as [string, number])} b={b.curve.random.map((x) => [x.m, x.r] as [string, number])} /></div>}
      <p className="dim" style={{ fontSize: 13, margin: '8px 0 0' }}>Gate on: {Object.entries(b.gate_on_pct_by_year).map(([y, v]) => `${y} ${v}%`).join(' · ')} of sessions. <Link href="/about/#engines" style={{ textDecoration: 'underline' }}>Limits of this test</Link>.</p>
    </Rv>
  );
}

export default function SignalsPage() {
  const { q, feed, rows } = useBook();
  const active = rows.filter((r) => r.s.status === 'open' || r.s.status === 'pending');
  const done = (feed?.signals ?? []).filter((s: Sig) => s.status === 'closed' || s.status === 'void');
  return (
    <>
      <PageHead method="engines" eyebrow="Signals · Swing v2" title="One rule book," em="only when the market allows." />
      <section className="wrap">
        <Async loading={q.loading} error={q.error} rows={3}>
          {feed && (
            <>
              <GatePanel feed={feed} />
              <div className="eng-link"><span className="dim num">Prices through {sessionLabel(feed.data_through)} · launched {sessionLabel(feed.launched)} · {feed.alertable ? 'alerts on' : 'alerts off'}</span><Link href="/trades/" className="chip">Live P&amp;L and today&apos;s decisions →</Link></div>

              <h2 className="sr">Active signals</h2>
              {active.length ? <div className="grid g2" style={{ marginTop: 12 }}>{active.map((r) => <SignalCard key={r.s.id} row={r} />)}</div> : (
                <Rv className="panel tight" style={{ marginTop: 12 }}>
                  <div className="eyebrow">Active signals</div>
                  <p className="muted" style={{ margin: '6px 0 0' }}>{feed.gate.on ? 'None today: no stock passed every rule at the latest close.' : `None: the market gate is off (${feed.gate.passed} of 4 checks pass), so the book opens nothing new. That is the rule working, not a gap.`}</p>
                </Rv>
              )}

              <div style={{ height: 14 }} />
              <BacktestPanel feed={feed} />

              {done.length > 0 && (
                <Rv className="panel tight" style={{ marginTop: 12 }}>
                  <div className="tr-h"><h2>Closed in the last 30 days</h2><span className="dim num">{feed.record.closed} closed since launch · {sR(feed.record.total_r)}</span></div>
                  <div className="list">{done.map((s) => <Link key={s.id} href={companyHref(s.sym)} className="li"><div><div className="t">{s.sym} · {s.setup}</div><div className="s">{s.status === 'void' ? `Skipped: ${s.void_reason ?? 'entry rule'}` : `${EXIT[s.exit_reason ?? ''] ?? 'Closed'} · ${sessionLabel(s.closed_date)}`}</div></div><span className={`num ${tone(s.r_net)}`}>{s.status === 'closed' ? sR(s.r_net) : dash}</span></Link>)}</div>
                </Rv>
              )}
              <p className="dim" style={{ fontSize: 13, margin: '12px 2px 0' }}>The five machine-learning engines were retired on 21 Oct 2026; none cleared a significant holdout. Their signals are archived and no longer shown.</p>
            </>
          )}
        </Async>
      </section>
    </>
  );
}
