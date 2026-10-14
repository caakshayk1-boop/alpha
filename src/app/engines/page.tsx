'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Curve from '@/components/Curve';
import PlanOdds from '@/components/PlanOdds';
import Scoreboard from '@/components/Scoreboard';
import { DataStamp, useDatasetStatus } from '@/components/DataStamp';
import { VERDICT_TONE, verdictText } from '@/components/EvidenceTags';
import { Async, Bar, Chg, CountUp, PageHead, Rv, SectionHead, Segmented } from '@/components/ui';
import { useEngines, usePx } from '@/lib/data';
import { ago, dash, dateLabel, num, quoteState } from '@/lib/format';
import { journalHref } from '@/lib/journal';
import type { EngineSignal, EngineStats, Period, PxQuote, RankBlock, TradeBlock } from '@/lib/types';

const TONE = VERDICT_TONE;
const f = (v: number | null | undefined, d = 1, suf = '') => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(d)}${suf}` : dash);
const sgn = (v: number | null | undefined, d = 2, suf = '') => (typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(d)}${suf}` : dash);
const days = (v: number | null | undefined) => (typeof v === 'number' ? `${Math.round(v)} trading days` : dash);

const STATE_LABEL: Record<string, string> = { pending: 'Issued · waiting for the next open', open: 'Open', closed: 'Closed', void: 'Void' };
const EVENT_LABEL: Record<string, string> = { entry: 'Entered', t1: 'T1 reached', t2: 'T2 reached', t3: 'T3 reached', stop: 'Stopped out', stop_after_t1: 'Stopped at entry', stop_after_t2: 'Stopped at T1', time: 'Time limit' };

function SignalCard({ s, e, live, through }: { s: EngineSignal; e: EngineStats; live?: PxQuote; through?: string }) {
  // A signal still `pending` once a later session exists in the screen has had its open come and go; the engines have not processed it yet.
  const overdue = s.status === 'pending' && !!through && through > s.date;
  const [capital, setCapital] = useState('500000');
  const [riskPct, setRiskPct] = useState('1');
  const base = s.entry ?? s.ref_price;
  const risk = base - s.sl;
  const cap = Number(capital) || 0;
  const rp = Number(riskPct) || 0;
  const qty = risk > 0 ? Math.floor((cap * rp / 100) / risk) : 0;
  const px = live?.price ?? s.last_close ?? null;
  const stop = s.stop_now ?? s.sl;
  const nextT = s.targets[Math.min(s.hit, 2)];
  const active = s.status === 'open' || s.status === 'pending';
  const b = s.benchmark;
  return (
    <Rv className="panel spot">
      <div className="sig-head">
        <div className="sig-id">
          <div className="eyebrow">{s.setup} · {s.horizon} · issued {dateLabel(s.issued)}</div>
          <Link href={`/company/?s=${encodeURIComponent(s.sym)}`} className="disp sig-sym">{s.sym}</Link>
          <div className="sig-name">{s.name}{s.sector ? ` · ${s.sector}` : ''}</div>
        </div>
        {px !== null && active && (
          <div className="sig-now">
            <div className="k">{live ? (quoteState(live.at).word === 'live' ? 'Live' : 'Last trade') : 'Last close'}</div>
            <div className="v num">₹{num(px, 2)}</div>
            {live && <Chg v={live.pct} />}
          </div>
        )}
      </div>
      <div className="sig-tags">
        <span className={`tag ${s.status === 'open' ? 'acc' : s.status === 'closed' ? ((s.r_net ?? 0) >= 0 ? 'up' : 'down') : s.status === 'void' ? 'warn' : ''}`}>{overdue ? `Issued · status not updated since ${dateLabel(s.date)}` : STATE_LABEL[s.status]}{s.status === 'closed' && typeof s.r_net === 'number' ? ` · ${s.r_net > 0 ? '+' : ''}${s.r_net.toFixed(2)}R` : ''}{s.status === 'open' && typeof s.r_open === 'number' ? ` · ${s.r_open > 0 ? '+' : ''}${s.r_open.toFixed(2)}R so far` : ''}</span>
        {s.score_percentile !== null && <span className="tag acc">Model rank: top {Math.max(0.1, 100 - s.score_percentile).toFixed(1)}%</span>}
        {s.also_names.length > 0 && <span className="tag">Also selected by {s.also_names.join(', ')}</span>}
      </div>
      <PlanOdds sl={stop} entry={base} targets={s.targets} rMultiples={s.r_multiples} odds={{ t1: e.trades.all.hit_t1, t2: e.trades.all.hit_t2, t3: e.trades.all.hit_t3, stopped: e.trades.all.stopped }} n={e.trades.all.n} last={px ?? undefined} />
      {px !== null && active && (
        <p className="sig-dist num">{(((px - stop) / px) * 100).toFixed(1)}% above the stop · {nextT > px ? `${(((nextT - px) / px) * 100).toFixed(1)}% to T${Math.min(s.hit, 2) + 1}` : 'past the next target'}</p>
      )}
      <div className="kv" style={{ marginTop: 14 }}>
        <div><div className="k">{s.entry ? 'Entered at the open on' : 'Signal close'}</div><div className="v" style={{ fontSize: 15 }}>{s.entry ? dateLabel(s.entry_date) : `₹${num(s.ref_price, 2)}`}</div>{!s.entry && <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>Entry in tests: the next session&apos;s open. Skipped if it opens past T1 or below the stop.</div>}</div>
        <div><div className="k">Time limit</div><div className="v" style={{ fontSize: 15 }}>{s.max_hold_days} sessions</div></div>
        <div><div className="k">T1 typically</div><div className="v" style={{ fontSize: 15 }}>{s.typical_days_to_t1 ? `~${Math.round(s.typical_days_to_t1)} sessions` : dash}</div></div>
        <div><div className="k">Avg daily turnover</div><div className="v" style={{ fontSize: 15 }}>₹{num(s.turnover_cr, 1)} cr</div></div>
      </div>
      {b && (
        <div className="panel tight" style={{ marginTop: 14, background: 'var(--panel-2)' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Against its own benchmark · {b.name}{b.members ? ` (${b.members} stocks)` : ''}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className={`tag ${b.uptrend ? 'up' : 'down'}`}>{b.uptrend ? 'Benchmark in an uptrend' : 'Benchmark not in an uptrend'}</span>
            <span className={`tag ${b.leads_nifty ? 'up' : 'warn'}`}>{b.leads_nifty ? 'Leading the Nifty' : 'Lagging the Nifty'}</span>
            {b.stock_vs_benchmark_pct !== null && <span className={`tag ${b.stock_vs_benchmark_pct >= 0 ? 'up' : 'down'}`}>{sgn(b.stock_vs_benchmark_pct, 1, '%')} vs benchmark, 3 months</span>}
          </div>
        </div>
      )}
      {s.events.length > 1 && (
        <ol className="muted num" style={{ fontSize: 13.5, margin: '12px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
          {s.events.map((ev) => <li key={ev.date + ev.kind}>{dateLabel(ev.date)} · {EVENT_LABEL[ev.kind] ?? ev.kind} at ₹{num(ev.price, 2)}</li>)}
        </ol>
      )}
      {s.void_reason && <p className="dim" style={{ fontSize: 13.5, margin: '10px 0 0' }}>Void: {s.void_reason}.</p>}
      {s.reasons.length > 0 && (
        <details className="sig-why">
          <summary>What the model is reading today</summary>
          <ul className="muted">{s.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <p className="dim">These are the inputs the model leans on most, and where this stock stands on each. They describe what it sees, not why the price will move.</p>
        </details>
      )}
      {s.turnover_cr < 5 && active && <p className="notice" style={{ marginTop: 12, fontSize: 13.5 }}>Thinly traded: about ₹{num(s.turnover_cr, 1)} crore changes hands a day. Fills at the next open may be far from the plan, and the 0.25% cost in the tests may be too kind.</p>}
      {active && (
        <details className="sig-why">
          <summary>How many shares fit your risk?</summary>
          <div className="filters" style={{ marginTop: 10 }}>
            <label className="muted" style={{ fontSize: 14 }}>Capital ₹ <input className="field" style={{ minWidth: 110, height: 34 }} inputMode="numeric" value={capital} onChange={(ev) => setCapital(ev.target.value.replace(/[^\d]/g, ''))} /></label>
            <label className="muted" style={{ fontSize: 14 }}>Risk % <input className="field" style={{ minWidth: 60, width: 70, height: 34 }} inputMode="decimal" value={riskPct} onChange={(ev) => setRiskPct(ev.target.value.replace(/[^\d.]/g, ''))} /></label>
          </div>
          <p className="num" style={{ margin: 0, fontSize: 14.5 }}>{qty > 0 ? <>{num(qty)} shares ≈ ₹{num(qty * base, 0)} · a stop-out costs about ₹{num(qty * risk, 0)} ({riskPct}% of capital)</> : 'Risk per share is zero or capital is empty.'}</p>
          <p className="dim" style={{ fontSize: 13, margin: '6px 0 0' }}>Arithmetic only. Position size is your decision; gaps and costs are not included.</p>
        </details>
      )}
      <div style={{ marginTop: 12 }}><Link className="chip" href={journalHref(s.sym, base, s.sl, s.targets[0])} title="Open the journal with this company, price, stop and first target filled in. You write the reason.">Journal this signal</Link></div>
    </Rv>
  );
}

const PERIOD_LABEL: Record<Period, string> = { development: 'Development', holdout: 'Holdout' };

function Deciles({ v }: { v: number[] }) {
  const max = Math.max(...v.map((x) => Math.abs(x)), 0.01);
  return (
    <div role="img" aria-label="Average excess return by model score decile" style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 96 }}>
      {v.map((x, i) => (
        <div key={i} title={`Decile ${i + 1}: ${sgn(x, 2, '%')}`} style={{ flex: 1, height: `${Math.max(4, (Math.abs(x) / max) * 100)}%`, background: x >= 0 ? 'var(--up)' : 'var(--down)', opacity: 0.35 + 0.65 * (i / 9), borderRadius: 3 }} />
      ))}
    </div>
  );
}

function RankTable({ e }: { e: EngineStats }) {
  const rows: [string, RankBlock][] = [
    ['Development', e.metrics.development], ['Holdout', e.metrics.holdout],
    ['Most-traded 300, development', e.robustness.top300.development], ['Most-traded 300, holdout', e.robustness.top300.holdout],
  ];
  return (
    <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
      <table className="tbl" style={{ minWidth: 700 }}>
        <thead><tr><th>Where</th><th>Sessions</th><th>Rank skill (IC)</th><th>t-stat</th><th>Days it was positive</th><th>Top picks beat the market by</th><th>Best vs worst decile</th></tr></thead>
        <tbody>
          {rows.map(([label, m]) => (
            <tr key={label} style={{ cursor: 'default' }}>
              <td><b>{label}</b></td>
              <td className="num">{num(m.dates)}</td>
              <td className={`num ${(m.ic_mean ?? 0) >= 0 ? 'up' : 'down'}`}>{sgn(m.ic_mean, 3)}</td>
              <td className="num">{f(m.ic_t, 2)}</td>
              <td className="num">{f(m.ic_pos_pct, 0, '%')}</td>
              <td className={`num ${(m.top_excess_pct ?? 0) >= 0 ? 'up' : 'down'}`}>{sgn(m.top_excess_pct, 2, '%')}</td>
              <td className="num">{m.decile_excess_pct.length ? `${sgn(m.decile_excess_pct[m.decile_excess_pct.length - 1] - m.decile_excess_pct[0], 2, '%')}` : dash}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsTable({ e }: { e: EngineStats }) {
  const rows: [string, TradeBlock, TradeBlock, number | null | undefined][] = (['development', 'holdout'] as const).map((k) => [PERIOD_LABEL[k], e.trades[k], e.baseline[k], e.clustered[k]?.t_clustered]);
  return (
    <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
      <table className="tbl" style={{ minWidth: 760 }}>
        <thead><tr><th>Period</th><th>Trades</th><th>Win rate</th><th>Avg R per trade</th><th>Random stocks, same exits</th><th>Month-clustered t</th><th>Reached T1</th><th>Stopped out</th></tr></thead>
        <tbody>
          {rows.map(([label, s, b, t]) => (
            <tr key={label} style={{ cursor: 'default' }}>
              <td><b>{label}</b></td>
              <td className="num">{num(s.n)}</td>
              <td className="num">{f(s.win_rate, 0, '%')}</td>
              <td className={`num ${(s.expectancy_r ?? 0) >= 0 ? 'up' : 'down'}`}>{sgn(s.expectancy_r, 2, 'R')}</td>
              <td className="num dim">{sgn(b.expectancy_r, 2, 'R')}</td>
              <td className="num">{f(t, 2)}</td>
              <td className="num">{f(s.hit_t1, 0, '%')}</td>
              <td className="num">{f(s.stopped, 0, '%')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EnginesPage() {
  const q = useEngines();
  const [key, setKey] = useState<string>('relative');
  const [tab, setTab] = useState<'signals' | 'how' | 'record' | 'board' | 'exits'>('signals');
  const feed = q.data;
  const e = feed?.engines[key];
  const sigs = useMemo(() => (feed?.signals ?? []).filter((s) => s.engine === key), [feed, key]);
  const activeSyms = useMemo(() => (feed?.signals ?? []).filter((s) => s.status === 'open' || s.status === 'pending').map((s) => s.sym), [feed]);
  const px = usePx(activeSyms);
  const newest = useDatasetStatus().items.find((i) => i.id === 'screen')?.asOf ?? undefined;
  return (
    <>
      <PageHead eyebrow="Engines" title="Five models," em="judged on data they never saw." lede="Each engine is a machine-learning model that reads 58 measures of every listed stock each evening and ranks the market. The top ranks become signals with a stop, three targets and a time limit priced from the stock's own volatility. Every model is shown against random picks and against a holdout it was never tuned on, whatever the answer is." />
      <section className="wrap">
        <Async loading={q.loading} error={q.error} rows={3}>
          {feed && (
            <>
              <div className="epick" role="radiogroup" aria-label="Engine">
                {Object.values(feed.engines).sort((a, b) => a.id - b.id).map((x) => {
                  const hr = x.trades.holdout.expectancy_r;
                  return (
                    <label key={x.key} className={`ecard${key === x.key ? ' on' : ''}`}>
                      <input type="radio" name="engine" checked={key === x.key} onChange={() => { setKey(x.key); setTab('signals'); }} />
                      <span className="ecard-top">
                        <b>{x.id}. {x.name}</b>
                        <span className="dim">{x.style.split(',')[0]} · {x.horizon_sessions} sessions</span>
                      </span>
                      <span className="ecard-sig"><b className="num">{x.signal_count}</b> signal{x.signal_count === 1 ? '' : 's'} now</span>
                      <span className="ecard-tags">
                        <span className={`tag ${TONE[x.ranking_status]}`} title={x.ranking_why}>Ranking · {verdictText(x.ranking_status)}</span>
                        <span className={`tag ${TONE[x.trading_status]}`} title={x.trading_why}>Trading · {verdictText(x.trading_status)}</span>
                      </span>
                      <span className="ecard-foot dim">Holdout <b className={`num ${(hr ?? 0) >= 0 ? 'up' : 'down'}`}>{sgn(hr, 2, 'R')}</b> per trade · {num(x.trades.all.n ?? 0)} tested trades · {feed.live_record[x.key]?.closed ?? 0} live closed</span>
                    </label>
                  );
                })}
              </div>
              <DataStamp ids={['engines', 'screen']} />
              <p className="dim" style={{ fontSize: 13.5, margin: '10px 2px 0' }}>Prices through {dateLabel(feed.data_through)} · {feed.backtest.universe} stocks · round-trip cost of {feed.backtest.cost_round_trip_pct}% charged on every test trade · the models retrain and rescore after each market close.</p>

              <Scoreboard feed={feed} />

              {e && (
                <>
                  <div style={{ height: 36 }} />
                  <SectionHead eyebrow={`Engine ${e.id} · ${e.style}`} title={e.name} />
                  <Rv className="panel" style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'grid', gap: 12, flex: 1, minWidth: 260 }}>
                        <div><span className="eyebrow">Ranking skill</span><div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 6 }}><span className={`tag ${TONE[e.ranking_status]}`} style={{ fontSize: 13 }}>{verdictText(e.ranking_status)}</span><span className="muted">{e.ranking_why}</span></div></div>
                        <div><span className="eyebrow">Net trading result</span><div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 6 }}><span className={`tag ${TONE[e.trading_status]}`} style={{ fontSize: 13 }}>{verdictText(e.trading_status)}</span><span className="muted">{e.trading_why}</span></div></div>
                        <div><span className="eyebrow">Phone alerts</span><div style={{ marginTop: 6 }}><span className={`tag ${e.alertable ? 'up' : ''}`} style={{ fontSize: 13 }}>{e.alertable ? 'ON' : 'OFF'}</span> <span className="muted">{e.alert_why}</span></div></div>
                      </div>
                    </div>
                    <p className="dim" style={{ fontSize: 13.5, margin: '12px 0 0' }}>Ranking skill and trading profit are different claims: a model can order stocks better than chance and still make nothing after stops, exits and costs. Both are shown, and alerts need both.</p>
                    <p className="dim" style={{ fontSize: 13.5, margin: '10px 0 0' }}>
                      Development is {dateLabel(feed.backtest.periods.development[0])} to {dateLabel(feed.backtest.periods.development[1])}; the holdout is everything after. Each prediction in both periods comes from a model trained only on data that was already fully known at the time (walk-forward, refit every quarter, with a gap equal to the prediction horizon). The design and the pass marks were written down before the holdout was read, and it was read once.{!e.alertable && ' This engine does not clear the bar for phone alerts: its signals are shown here, never pushed.'}
                    </p>
                  </Rv>
                  <div style={{ margin: '0 0 18px' }}><Segmented label="Engine views" value={tab} onChange={setTab} options={[['signals', `Signals now (${sigs.length})`], ['how', 'How it picks'], ['record', 'Track record'], ['board', 'Sector board'], ['exits', 'Exit plan']] as const} /></div>

                  {tab === 'signals' && (sigs.length ? (
                    <>
                      {px.at && <p className="dim" style={{ fontSize: 13.5, margin: '0 0 10px' }}>Live prices as of {ago(px.at)}, refreshed every minute while this page is open. Plans are fixed at issue and never move with the price.</p>}
                      <div className="grid g2">{sigs.map((s) => <SignalCard key={s.id} s={s} e={e} live={px.quotes[s.sym]} through={newest} />)}</div>
                      {(e.ranking_status === 'NO RANKING SKILL' || !e.alertable) && <p className="notice" style={{ marginTop: 14 }}>{e.ranking_status === 'NO RANKING SKILL' ? 'This model has not shown ranking skill.' : `This engine's holdout trades are ${e.trading_status.toLowerCase()}.`} Its picks are shown so it can be watched, not as recommendations.</p>}
                    </>
                  ) : <p className="notice">This engine has no open or pending signal at the latest close: each stock can carry only one active trade, and its best-ranked names are already held by another engine or inside the cooldown. Method, record and exits are in the other tabs.</p>)}

                  {tab === 'how' && (
                    <div className="grid g2">
                      <Rv className="panel">
                        <div className="eyebrow">What it does</div>
                        <ol className="muted" style={{ paddingLeft: 18, lineHeight: 1.7 }}>{e.how.map((r) => <li key={r}>{r}</li>)}</ol>
                        <div className="eyebrow" style={{ marginTop: 18 }}>Trade plan</div>
                        <p className="muted">Stop at {e.plan.stop_atr} ATR below entry (capped for volatile names); targets at {e.plan.targets_r.map((t) => `${t}R`).join(', ')}; at most {e.plan.picks_per_day} new signals a session; the same stock can not be picked again for {e.plan.cooldown} sessions; time limit {e.plan.max_hold} sessions.</p>
                        <div className="eyebrow" style={{ marginTop: 18 }}>Timeline</div>
                        <p className="muted">In tests, median {days(e.timeline.median_days_held)} held; nine in ten trades were over within {days(e.timeline.p90_days_held)}. Where the first target was reached it typically took {days(e.timeline.median_days_to_t1)}.</p>
                      </Rv>
                      <Rv className="panel">
                        <div className="eyebrow">What the model leans on</div>
                        <p className="dim" style={{ fontSize: 13.5, margin: '6px 0 12px' }}>Share of the model&apos;s skill lost when each input is scrambled, on the most recent labelled months. This is influence, not cause.</p>
                        <div className="meter">{e.importance.map((i) => <div className="meter-row" key={i.feature}><span className="lab" style={{ minWidth: 190 }}>{i.label}</span><Bar pct={Math.min(100, i.share_pct * 3)} kind="up" /><span className="num">{i.share_pct.toFixed(0)}%</span></div>)}</div>
                        <p className="dim" style={{ fontSize: 13.5, margin: '14px 0 0' }}>Trained on {num(e.train_rows)} stock-days. {e.kind === 'clf' ? 'A classifier: its score is a probability.' : 'A regressor: its score is a predicted rank inside the market.'}</p>
                      </Rv>
                    </div>
                  )}

                  {tab === 'record' && (
                    <>
                      <div className="eyebrow" style={{ marginBottom: 10 }}>1 · Can it rank stocks?</div>
                      <RankTable e={e} />
                      <p className="dim" style={{ fontSize: 13.5, margin: '10px 0 14px' }}>Rank skill (information coefficient) is the daily correlation between the model&apos;s ranking and what each stock then returned over {e.horizon_sessions} sessions beyond the market&apos;s median. 0 is a coin flip; a few hundredths, sustained, is what quantitative funds work with. The most-traded-300 rows repeat the test on only the largest, most liquid names.</p>
                      <div className="grid g-7-5">
                        <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 10 }}>Holdout: average excess return by score decile, lowest to highest</div><Deciles v={e.metrics.holdout.decile_excess_pct} /><p className="dim" style={{ fontSize: 13, margin: '8px 0 0' }}>A working model rises from left to right. A flat or ragged shape is noise.</p></Rv>
                        <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 10 }}>Development: the same chart</div><Deciles v={e.metrics.development.decile_excess_pct} /></Rv>
                      </div>

                      <div className="eyebrow" style={{ margin: '28px 0 10px' }}>2 · Do the trades make money after costs?</div>
                      <StatsTable e={e} />
                      <p className="dim" style={{ fontSize: 13.5, margin: '10px 0 18px' }}>Every trade follows the exit plan, enters at the next open and pays {feed.backtest.cost_round_trip_pct}% round trip. “Random stocks, same exits” takes liquid stocks picked at random on the same days with the same stop-and-target geometry, so the comparison removes the market&apos;s drift. R is the amount risked: +1R means the trade made as much as the stop would have lost. The month-clustered t treats each month as one observation because trades overlap; between −2 and +2 is indistinguishable from luck.</p>
                      <div className="grid g-7-5">
                        <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 8 }}>Cumulative R, by month</div><Curve a={e.equity_curve} b={e.baseline_curve} /></Rv>
                        <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 14 }}>How trades ended</div>
                          <div className="meter">{(['stop', 'breakeven', 'after_t2', 'all_targets', 'time'] as const).map((k) => { const tot = e.exits_n || Object.values(e.exits).reduce((a, b) => a + b, 0) || 1; return <div className="meter-row" key={k}><span className="lab" style={{ minWidth: 150 }}>{{ stop: 'Stopped out, no target', breakeven: 'T1 reached, then stopped at entry', after_t2: 'T2 reached, then stopped at T1', all_targets: 'All three targets (T3)', time: 'Time limit' }[k]}</span><Bar pct={((e.exits[k] ?? 0) / tot) * 100} kind={k === 'stop' ? 'down' : k === 'all_targets' || k === 'after_t2' ? 'up' : undefined} /><span className="num" title={`${e.exits[k] ?? 0} of ${tot} trades`}>{Math.round(((e.exits[k] ?? 0) / tot) * 100)}%</span></div>; })}<p className="dim" style={{ fontSize: 12, margin: '8px 0 0' }}>Same {num(e.exits_n || e.trades.all.n)} test trades as the figures below; every trade appears in exactly one row. “All three targets” is the same group that “Reached T3” counts.</p></div>
                          <div className="eyebrow" style={{ margin: '22px 0 10px' }}>Reached, at any point in the trade (historical frequency, {num(e.trades.all.n)} test trades)</div>
                          <div className="meter">{([['T1', e.trades.all.hit_t1], ['T2', e.trades.all.hit_t2], ['T3', e.trades.all.hit_t3]] as const).map(([l, v]) => <div className="meter-row" key={l}><span className="lab">{l}</span><Bar pct={v ?? 0} kind="up" /><span className="num">{f(v, 0, '%')}</span></div>)}</div>
                        </Rv>
                      </div>

                      <Rv className="panel" style={{ marginTop: 14 }}>
                        <div className="eyebrow">3 · Live record since launch ({feed.launched ? dateLabel(feed.launched) : 'not started'})</div>
                        {feed.live_record[e.key] ? (
                          <p className="muted" style={{ margin: '10px 0 0' }}><b className="num" style={{ color: 'var(--text)' }}>{feed.live_record[e.key].closed}</b> trades issued since launch have been closed by the rules: win rate {feed.live_record[e.key].win_rate}%, average {sgn(feed.live_record[e.key].avg_r, 2, 'R')} per trade, {sgn(feed.live_record[e.key].total_r, 1, 'R')} in total. {feed.live_record[e.key].closed < 30 ? 'Far too few to conclude anything yet.' : ''}</p>
                        ) : <p className="muted" style={{ margin: '10px 0 0' }}>No trade issued since launch has closed yet. This is the number to watch: it is the only one that cannot have been fitted to the past.</p>}
                      </Rv>

                      <Rv className="panel" style={{ marginTop: 14 }}>
                        <div className="eyebrow">What these tests can not tell you</div>
                        <ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.7, margin: '10px 0 0' }}>
                          <li><b>Survivorship.</b> The universe is today&apos;s listed companies, so stocks that were delisted or collapsed are missing from the past. That flatters any ranking that favours small or beaten-down names. The most-traded-300 rows are the check; where they are weaker than the full-universe rows, part of the edge may be this bias.</li>
                          <li><b>One look at the holdout.</b> It was read once, but after the models and their inputs were built on the development years, and the market in the holdout was a specific one. Treat it as one sample, not proof.</li>
                          <li><b>Small, illiquid stocks.</b> Some picks trade only a few crore a day. Real fills there can be worse than the 0.25% cost assumed.</li>
                          <li><b>Overlapping trades.</b> Three picks a day held for weeks are not independent, which is why the clustered statistic is shown beside the plain one.</li>
                        </ul>
                      </Rv>
                    </>
                  )}

                  {tab === 'board' && (
                    <>
                      <p className="muted" style={{ marginTop: 0 }}>Every stock is read against the benchmark of its own group. Nifty IT, Nifty Pharma and Nifty Bank are the real NSE indices; every other group is an equal-weighted index of that industry built from the screened stocks (Yahoo holds no daily history for the other NSE sector indices). A group is in an <b>uptrend</b> when it is above a rising 50-day average, and <b>leading</b> when it is ahead of the Nifty over three months. Engine 3 uses these benchmarks directly; the others see them as inputs.</p>
                      <div className="tbl-wrap" style={{ maxHeight: 'none' }}><table className="tbl" style={{ minWidth: 640 }}>
                        <thead><tr><th>Benchmark</th><th>Stocks</th><th>1 month</th><th>3 months</th><th>vs Nifty, 3 months</th><th>Trend</th><th>Leading</th></tr></thead>
                        <tbody>{feed.benchmarks.map((g) => <tr key={g.name} style={{ cursor: 'default' }}><td><b>{g.name.replace(' (alpha group index)', '')}</b>{g.real_index && <span className="tag acc" style={{ marginLeft: 8 }}>NSE index</span>}</td><td className="num">{g.members ?? dash}</td><td><Chg v={g.r1m} dp={1} /></td><td><Chg v={g.r3m} dp={1} /></td><td><Chg v={g.vs_nifty_3m} dp={1} /></td><td><span className={`tag ${g.uptrend ? 'up' : 'down'}`}>{g.uptrend ? 'up' : 'not up'}</span></td><td><span className={`tag ${g.leads_nifty ? 'up' : 'warn'}`}>{g.leads_nifty ? 'leading' : 'lagging'}</span></td></tr>)}</tbody>
                      </table></div>
                    </>
                  )}

                  {tab === 'exits' && (
                    <Rv className="panel">
                      <div className="eyebrow">How every engine is exited</div>
                      <ol className="muted" style={{ lineHeight: 1.8, paddingLeft: 20 }}>{feed.exit_plan.map((x) => <li key={x}>{x}</li>)}</ol>
                      <p className="dim" style={{ fontSize: 13.5 }}>The tests assume exactly this, including the pessimistic choices: stops win ties inside a session, gaps fill at the open, and costs come off every trade.</p>
                    </Rv>
                  )}
                </>
              )}
              <p className="notice" style={{ marginTop: 28 }}>Engines are research tools that describe what a statistical model would have selected. They are not investment advice, not a recommendation to buy or sell any security, and not a promise of future results. Past tests can overstate what happens next. Never risk money you cannot afford to lose, and check prices at your broker before acting.</p>
            </>
          )}
        </Async>
      </section>
    </>
  );
}
