'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Curve from '@/components/Curve';
import Ladder from '@/components/Ladder';
import { Async, Bar, CountUp, PageHead, Rv, SectionHead } from '@/components/ui';
import { useEngines } from '@/lib/data';
import { dash, dateLabel, num } from '@/lib/format';
import type { EngineBlock, EngineSignal, EngineStats } from '@/lib/types';

const TONE: Record<string, string> = { 'EDGE SHOWN': 'up', 'LEANING POSITIVE': 'acc', 'NO EDGE SHOWN': 'warn', 'WORSE THAN RANDOM': 'down', 'NOT ENOUGH TRADES': '' };
const f = (v: number | null | undefined, d = 1, suf = '') => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(d)}${suf}` : dash);
const sgn = (v: number | null | undefined, d = 2, suf = '') => (typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(d)}${suf}` : dash);
const days = (v: number | null | undefined) => (typeof v === 'number' ? `${Math.round(v)} trading days` : dash);

function SignalCard({ s, e }: { s: EngineSignal; e: EngineStats }) {
  const [capital, setCapital] = useState('500000');
  const [riskPct, setRiskPct] = useState('1');
  const risk = (s.ref_price - s.sl);
  const cap = Number(capital) || 0;
  const rp = Number(riskPct) || 0;
  const qty = risk > 0 ? Math.floor((cap * rp / 100) / risk) : 0;
  return (
    <Rv className="panel spot">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16 }}>
        <div>
          <div className="eyebrow">{s.setup} · {s.horizon} · signal {dateLabel(s.date)}</div>
          <Link href={`/company/?s=${encodeURIComponent(s.sym)}`} className="disp" style={{ fontSize: 34, display: 'block', margin: '8px 0 2px' }}>{s.sym}</Link>
          <div className="dim" style={{ fontSize: 13 }}>{s.name}{s.sector ? ` · ${s.sector}` : ''}</div>
        </div>
        <Ladder sl={s.sl} entry={s.ref_price} targets={s.targets} last={s.last_close} />
      </div>
      <div className="kv" style={{ marginTop: 14 }}>
        <div><div className="k">Buy zone</div><div className="v" style={{ fontSize: 15 }}>₹{num(s.entry_zone[0], 2)} – {num(s.entry_zone[1], 2)}</div></div>
        <div><div className="k">Stop</div><div className="v down" style={{ fontSize: 15 }}>₹{num(s.sl, 2)} · −{s.risk_pct}%</div></div>
        {s.targets.map((t, i) => <div key={i}><div className="k">T{i + 1} · {s.r_multiples[i]}R</div><div className="v up" style={{ fontSize: 15 }}>₹{num(t, 2)}</div></div>)}
        <div><div className="k">Time limit</div><div className="v" style={{ fontSize: 15 }}>{s.max_hold_days} sessions</div></div>
        <div><div className="k">T1 typically</div><div className="v" style={{ fontSize: 15 }}>{s.typical_days_to_t1 ? `~${Math.round(s.typical_days_to_t1)} sessions` : dash}</div></div>
      </div>
      <ul className="muted" style={{ paddingLeft: 18, margin: '14px 0 0', fontSize: 13.5 }}>{s.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      <details style={{ marginTop: 14 }}>
        <summary className="eyebrow" style={{ cursor: 'pointer' }}>How many shares fit your risk?</summary>
        <div className="filters" style={{ marginTop: 10 }}>
          <label className="muted" style={{ fontSize: 13 }}>Capital ₹ <input className="field" style={{ minWidth: 110, height: 34 }} inputMode="numeric" value={capital} onChange={(ev) => setCapital(ev.target.value.replace(/[^\d]/g, ''))} /></label>
          <label className="muted" style={{ fontSize: 13 }}>Risk % <input className="field" style={{ minWidth: 60, width: 70, height: 34 }} inputMode="decimal" value={riskPct} onChange={(ev) => setRiskPct(ev.target.value.replace(/[^\d.]/g, ''))} /></label>
        </div>
        <p className="num" style={{ margin: 0, fontSize: 13.5 }}>{qty > 0 ? <>{num(qty)} shares ≈ ₹{num(qty * s.ref_price, 0)} · a stop-out costs about ₹{num(qty * risk, 0)} ({riskPct}% of capital)</> : 'Risk per share is zero or capital is empty.'}</p>
        <p className="dim" style={{ fontSize: 12, margin: '6px 0 0' }}>Arithmetic only. Position size is your decision; ignore costs and gaps at your peril.</p>
      </details>
      <p className="dim" style={{ fontSize: 12, margin: '12px 0 0' }}>Engine status: <span className={`tag ${TONE[e.status]}`}>{e.status}</span></p>
    </Rv>
  );
}

function StatsTable({ e }: { e: EngineStats }) {
  const rows: [string, EngineBlock, EngineBlock][] = [
    ['Train', e.splits.train, e.baseline.train], ['Validation', e.splits.validation, e.baseline.validation], ['Holdout', e.splits.holdout, e.baseline.holdout],
  ];
  return (
    <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
      <table className="tbl" style={{ minWidth: 760 }}>
        <thead><tr><th>Period</th><th>Trades</th><th>Win rate</th><th>Avg R per trade</th><th>Random, same exits</th><th>Picks vs random stocks</th><th>Reached T1</th><th>Stopped out</th></tr></thead>
        <tbody>
          {rows.map(([label, s, b]) => (
            <tr key={label} style={{ cursor: 'default' }}>
              <td><b>{label}</b></td>
              <td className="num">{num(s.n)}</td>
              <td className="num">{f(s.win_rate, 0, '%')}</td>
              <td className={`num ${(s.expectancy_r ?? 0) >= 0 ? 'up' : 'down'}`}>{sgn(s.expectancy_r, 2, 'R')}</td>
              <td className="num dim">{sgn(b.expectancy_r, 2, 'R')}</td>
              <td className={`num ${(s.excess?.mean_excess_pct ?? 0) >= 0 ? 'up' : 'down'}`}>{sgn(s.excess?.mean_excess_pct, 2, '%')}</td>
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
  const [key, setKey] = useState<string>('breakout');
  const [tab, setTab] = useState<'signals' | 'rules' | 'record' | 'exits'>('signals');
  const feed = q.data;
  const e = feed?.engines[key];
  const sigs = useMemo(() => (feed?.signals ?? []).filter((s) => s.engine === key), [feed, key]);
  return (
    <>
      <PageHead eyebrow="Engines" title="Four engines," em="tested against luck." lede="Each engine is a fixed set of rules that names a stock, an entry zone, a stop, three targets and a time limit. Each was tested on years of daily prices against randomly chosen stocks over the same dates, and its result is shown beside every signal, whatever it says." />
      <section className="wrap">
        <Async loading={q.loading} error={q.error} rows={3}>
          {feed && (
            <>
              <div className="grid g4">
                {Object.values(feed.engines).sort((a, b) => a.id - b.id).map((x) => (
                  <button key={x.key} onClick={() => { setKey(x.key); setTab('signals'); }} aria-pressed={key === x.key} style={{ textAlign: 'left' }}>
                    <Rv className="panel spot" style={{ height: '100%', borderColor: key === x.key ? 'var(--accent)' : undefined }}>
                      <div className="eyebrow">Engine {x.id}</div>
                      <div className="disp" style={{ fontSize: 34, margin: '8px 0 4px' }}>{x.name}</div>
                      <div className="muted" style={{ fontSize: 13.5, minHeight: 40 }}>{x.tagline}</div>
                      <div style={{ margin: '12px 0' }}><span className={`tag ${TONE[x.status]}`}>{x.status}</span></div>
                      <div className="kv" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div><div className="k">Signals now</div><div className="v"><CountUp value={x.signal_count} format={(n) => String(Math.round(n))} /></div></div>
                        <div><div className="k">Trades tested</div><div className="v">{num(x.all.n)}</div></div>
                      </div>
                    </Rv>
                  </button>
                ))}
              </div>
              <p className="dim" style={{ fontSize: 12.5, margin: '10px 2px 0' }}>Data through {dateLabel(feed.data_through)} · {feed.backtest.universe} stocks · round-trip cost of {feed.backtest.cost_round_trip_pct}% charged on every test trade · signals refresh after each market close.</p>

              {e && (
                <>
                  <div style={{ height: 36 }} />
                  <SectionHead eyebrow={`Engine ${e.id} · ${e.style}`} title={e.name} />
                  <Rv className="panel" style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`tag ${TONE[e.status]}`} style={{ fontSize: 12 }}>{e.status}</span>
                      <span className="muted" style={{ flex: 1, minWidth: 260 }}>{e.status_why}</span>
                    </div>
                    <p className="dim" style={{ fontSize: 12.5, margin: '10px 0 0' }}>
                      Rules were chosen on {feed.backtest.splits.train} and confirmed on {feed.backtest.splits.validation}; the holdout ({feed.backtest.splits.holdout}) was looked at once, after the rules were frozen. {e.variants_tried} rule variants were tried in all, which is why a modest edge should be discounted.{e.descended ? ` Descended from ${e.descended}.` : ''}
                    </p>
                  </Rv>
                  <div className="filters" role="tablist" aria-label="Engine views">
                    {([['signals', `Signals now (${sigs.length})`], ['rules', 'How it picks'], ['record', 'Track record'], ['exits', 'Exit plan']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className="chip" onClick={() => setTab(k)}>{l}</button>)}
                  </div>

                  {tab === 'signals' && (sigs.length ? (
                    <>
                      <div className="grid g2">{sigs.map((s) => <SignalCard key={`${s.sym}-${s.date}-${s.setup}`} s={s} e={e} />)}</div>
                      {e.status === 'WORSE THAN RANDOM' && <p className="notice" style={{ marginTop: 14 }}>These are what the rules select. Over years of tests, stocks picked this way lagged randomly chosen ones. They are shown so the engine can be watched, not as picks.</p>}
                    </>
                  ) : <p className="notice">No stock meets all of this engine&apos;s rules at the latest close, which is the usual state of a selective engine. Rules, record and exits are in the other tabs.</p>)}

                  {tab === 'rules' && (
                    <div className="grid g2">
                      <Rv className="panel"><div className="eyebrow">It picks a stock when</div><ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.7 }}>{e.rules.entry.map((r) => <li key={r}>{r}</li>)}</ul></Rv>
                      <Rv className="panel"><div className="eyebrow">Stop</div><p className="muted">{e.rules.stop}</p><div className="eyebrow" style={{ marginTop: 18 }}>Targets</div><p className="muted">{e.rules.targets}</p>
                        <div className="eyebrow" style={{ marginTop: 18 }}>Timeline</div>
                        <p className="muted">Median {days(e.timeline.median_days_held)} held; nine in ten trades are over within {days(e.timeline.p90_days_held)}. Where the first target is reached, it typically takes {days(e.timeline.median_days_to_t1)}.</p></Rv>
                    </div>
                  )}

                  {tab === 'record' && (
                    <>
                      <StatsTable e={e} />
                      <p className="dim" style={{ fontSize: 12.5, margin: '10px 0 18px' }}>“Picks vs random stocks” is the average return of each pick, entry to exit, minus the average return of ten randomly chosen liquid stocks over exactly the same days. It removes the market&apos;s own drift, which flatters every long-only test in a rising market. Validation and holdout pooled: {sgn(e.pooled_test.mean_excess_pct, 2, '%')} per trade across {e.pooled_test.months ?? 0} months, clustered t-statistic {f(e.pooled_test.t_clustered, 2)}. Anything between −2 and +2 is indistinguishable from luck.</p>
                      <div className="grid g-7-5">
                        <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 8 }}>Cumulative R, by month</div><Curve a={e.equity_curve} b={e.baseline_curve} /></Rv>
                        <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 14 }}>How trades ended</div>
                          <div className="meter">{(['stop', 'breakeven', 'target', 'time'] as const).map((k) => { const tot = Object.values(e.exits).reduce((a, b) => a + b, 0) || 1; return <div className="meter-row" key={k}><span className="lab">{{ stop: 'Stopped out', breakeven: 'Stopped at entry', target: 'Hit all targets', time: 'Timed out' }[k]}</span><Bar pct={(e.exits[k] / tot) * 100} kind={k === 'stop' ? 'down' : k === 'target' ? 'up' : undefined} /><span className="num">{Math.round((e.exits[k] / tot) * 100)}%</span></div>; })}</div>
                          <div className="eyebrow" style={{ margin: '22px 0 10px' }}>Reached</div>
                          <div className="meter">{([['T1', e.all.hit_t1], ['T2', e.all.hit_t2], ['T3', e.all.hit_t3]] as const).map(([l, v]) => <div className="meter-row" key={l}><span className="lab">{l}</span><Bar pct={v ?? 0} kind="up" /><span className="num">{f(v, 0, '%')}</span></div>)}</div>
                        </Rv>
                      </div>
                      {Object.keys(e.by_setup).length > 1 && (
                        <div className="tbl-wrap" style={{ marginTop: 14, maxHeight: 'none' }}><table className="tbl" style={{ minWidth: 560 }}>
                          <thead><tr><th>Setup</th><th>Trades</th><th>Win rate</th><th>Avg R</th><th>Reached T1</th></tr></thead>
                          <tbody>{Object.entries(e.by_setup).map(([k, s]) => <tr key={k} style={{ cursor: 'default' }}><td>{k}</td><td className="num">{num(s.n)}</td><td className="num">{f(s.win_rate, 0, '%')}</td><td className={`num ${(s.expectancy_r ?? 0) >= 0 ? 'up' : 'down'}`}>{sgn(s.expectancy_r, 2, 'R')}</td><td className="num">{f(s.hit_t1, 0, '%')}</td></tr>)}</tbody>
                        </table></div>
                      )}
                    </>
                  )}

                  {tab === 'exits' && (
                    <Rv className="panel">
                      <div className="eyebrow">How every engine is exited</div>
                      <ol className="muted" style={{ lineHeight: 1.8, paddingLeft: 20 }}>{feed.exit_plan.map((x) => <li key={x}>{x}</li>)}</ol>
                      <p className="dim" style={{ fontSize: 12.5 }}>The tests assume exactly this, including the pessimistic choices: stops win ties inside a session, gaps fill at the open, and costs come off every trade.</p>
                    </Rv>
                  )}
                </>
              )}
              <p className="notice" style={{ marginTop: 28 }}>Engines are research tools that describe what a fixed set of rules would have selected. They are not investment advice, not a recommendation to buy or sell any security, and not a promise of future results. Past tests can overstate what happens next. Never risk money you cannot afford to lose, and check prices at your broker before acting.</p>
            </>
          )}
        </Async>
      </section>
    </>
  );
}
