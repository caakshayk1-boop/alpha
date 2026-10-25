'use client';
/** Method and validation: each engine family with its own model version, lifecycle, evidence date and record (S03); the evidence an
 *  alert would need beyond one t threshold (S02, A06); the backtest and the live book as two separately dated runs (S10); how the
 *  plan executes on daily bars and how this site marks between runs (S04, S06, S07); and the stated limits (S09). */
import Link from 'next/link';
import Curve from '@/components/Curve';
import { EnginesV3 } from '@/components/EnginesV3';
import { useEnginesV3 } from '@/lib/data';
import { lifecycleRows, STATE_WORD } from '@/lib/enginesV3';
import { dash, num, signed, tone } from '@/lib/format';
import { sessionLabel } from '@/lib/price';
import { LIFECYCLE_TONE, evidence, istStamp, swingLifecycle, type Lifecycle } from '@/lib/signalsView';
import type { BtStats, SignalsFeed } from '@/lib/types';

const sR = (v: number | null | undefined, d = 2) => signed(v, d, 'R');
const f = (v: number | null | undefined, d = 1, suf = '') => (typeof v === 'number' && Number.isFinite(v) ? `${num(v, d)}${suf}` : dash);
const VERDICT: Record<string, [string, string]> = { pass: ['ok', 'Meets it'], fail: ['bad', 'Does not'], info: ['', 'Context'], absent: ['warn', 'Not in the feed'] };

function StatsRow({ label, x }: { label: string; x?: BtStats }) {
  return (
    <tr style={{ cursor: 'default' }}>
      <td>{label}</td>
      <td className="num">{x?.n ? num(x.n) : dash}</td>
      <td className="num">{f(x?.win_rate, 0, '%')}</td>
      <td className={`num ${tone(x?.expectancy_r)}`}>{sR(x?.expectancy_r)}</td>
      <td className="num">{f(x?.profit_factor, 2)}</td>
      <td className="num">{f(x?.max_dd_r, 1, 'R')}</td>
      <td className="num">{f(x?.clustered_months, 0)}</td>
      <td className="num">{f(x?.clustered_t_clustered, 2)}</td>
    </tr>
  );
}

export function MethodView({ feed }: { feed: SignalsFeed }) {
  const v3 = useEnginesV3();
  const reg = lifecycleRows(v3.error || v3.loading ? null : v3.data);
  const b = feed.backtest;
  const ev = evidence(feed);
  const lc: Lifecycle = swingLifecycle(feed);
  const wordOf = (s: string) => STATE_WORD[s as keyof typeof STATE_WORD] ?? 'Research';
  return (
    <>
      <section className="section2 sg-sec" aria-labelledby="sg-fam-h">
        <div className="card-h"><div><h2 id="sg-fam-h" className="sec-title">Engine families</h2><p className="sec-sub">One lifecycle for every engine: Research, Paper, Validated, Paused, Retired, Blocked (data). Each family is judged on its own run.</p></div></div>
        <div className="card flush">
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Engine families and their lifecycle (scrolls sideways on small screens)" style={{ maxHeight: 'none' }}>
            <table className="tbl sg-life">
              <thead><tr><th>Engine</th><th>Model</th><th>Lifecycle</th><th>Evidence date</th><th>Record</th></tr></thead>
              <tbody>
                <tr style={{ cursor: 'default' }}>
                  <td><b>Swing v2</b><div className="dim sg-sub">Pullback and breakout, market-gated</div></td>
                  <td className="num">{feed.version}</td>
                  <td><span className={`pill ${LIFECYCLE_TONE[lc]}`}>{lc}</span></td>
                  <td className="num">{b ? `Backtest ${sessionLabel(b.generated.slice(0, 10))}` : 'No backtest'}<div className="dim sg-sub">book through {sessionLabel(feed.data_through)}</div></td>
                  <td>{feed.record.closed ? `${feed.record.closed} closed since ${sessionLabel(feed.launched)}, ${sR(feed.record.total_r)} after costs` : `Forward since ${sessionLabel(feed.launched)}; none closed yet`}</td>
                </tr>
                {reg.rows.map((r) => {
                  const w = wordOf(r.state) as Lifecycle;
                  return (
                    <tr key={r.id} style={{ cursor: 'default' }}>
                      <td><b>v3 · {r.id}</b><div className="dim sg-sub">{r.name}</div></td>
                      <td className="num">{r.version}</td>
                      <td><span className={`pill ${LIFECYCLE_TONE[w] ?? ''}`}>{w}</span></td>
                      <td className="num">{sessionLabel(r.decided)}<div className="dim sg-sub">{reg.source === 'feed' ? 'published feed' : 'decision record'}</div></td>
                      <td className="sg-why-cell">{reg.source === 'feed' ? r.why || 'No reason given' : `Not published. ${r.why}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="dim sg-note">The v3 engines are a separate research programme. None inherits a Swing v2 result, and no curve or total here joins two engines or two model versions.{reg.source === 'record' ? ' Their feed is not published, so their states are the decision record of 22 Oct 2026, without figures.' : ''}</p>
      </section>

      <section className="section2 sg-sec" aria-labelledby="sg-alert-h">
        <div className="card-h"><div><h2 id="sg-alert-h" className="sec-title">What an alert would need</h2><p className="sec-sub">Swing v2&apos;s switch is one number, the holdout t. One threshold is not enough evidence on its own, so the rest is reported beside it.</p></div><span className={`pill ${feed.alertable ? 'ok' : 'warn'}`}>Alerts {feed.alertable ? 'on' : 'off'}</span></div>
        <ul className="sg-evidence">
          {ev.map((e) => (
            <li key={e.key} className="card tight">
              <div className="sg-ev-h"><span className="m-l">{e.label}</span><span className={`pill ${VERDICT[e.verdict][0]} nodot`}>{VERDICT[e.verdict][1]}</span></div>
              <div className="sg-ev-v num">{e.value}</div>
              <p>{e.basis}</p>
            </li>
          ))}
        </ul>
        <p className="dim sg-note">{feed.alert_why} Alerts stay off until the switch passes; even then a {b ? `${b.rules.holdout.n}-trade` : 'single'} holdout is one sample, and the forward record is what can confirm it.</p>
      </section>

      {b && (
        <section className="section2 sg-sec" aria-labelledby="sg-bt-h">
          <div className="card-h"><div><h2 id="sg-bt-h" className="sec-title">The backtest</h2><p className="sec-sub">Rules fixed first, holdout read once. {num(b.universe)} stocks, {sessionLabel(b.periods.development[0])} to {sessionLabel(b.periods.holdout[1])}. Every figure after the {feed.cost_round_trip_pct}% round-trip cost.</p></div></div>
          <div className="card flush">
            <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Backtest results (scrolls sideways on small screens)" style={{ maxHeight: 'none' }}>
              <table className="tbl sg-bt">
                <thead><tr><th>Net of {feed.cost_round_trip_pct}% costs</th><th>Trades</th><th>Won</th><th>Avg</th><th>Profit factor</th><th>Worst drawdown</th><th>Months</th><th>Month t</th></tr></thead>
                <tbody>
                  <StatsRow label="Rules · development" x={b.rules.development} />
                  <StatsRow label="Rules · holdout" x={b.rules.holdout} />
                  <StatsRow label="Without the market gate · holdout" x={b.no_gate.holdout} />
                  <StatsRow label="Random stocks, same plan · holdout" x={b.random.holdout} />
                </tbody>
              </table>
            </div>
          </div>
          {b.curve.rules.length > 1 && (
            <div className="card sg-curvecard">
              <div className="card-h"><h3>Cumulative R by month, backtest only</h3><span className="dim sg-h-note">development and holdout · not the forward record</span></div>
              <Curve a={b.curve.rules.map((x) => [x.m, x.r] as [string, number])} b={b.curve.random.map((x) => [x.m, x.r] as [string, number])} />
            </div>
          )}
          <p className="dim sg-note">Gate on, share of sessions by year: {Object.entries(b.gate_on_pct_by_year).map(([y, v]) => `${y} ${v}%`).join(' · ')}.</p>
        </section>
      )}

      <section className="section2 sg-sec grid-2" aria-label="Two runs, two dates">
        <div className="card">
          <div className="card-h"><h3>Backtest artifact</h3><span className="pill nodot">{b?.version ?? feed.version}</span></div>
          <ul className="rows">
            <li className="row kvrow"><span className="row-s">Built</span><span className="num">{b ? `${sessionLabel(b.generated.slice(0, 10))}, ${b.generated.slice(11, 16)}${/Z$/.test(b.generated) ? ' UTC' : ' (time zone not stated)'}` : 'not run'}</span></li>
            <li className="row kvrow"><span className="row-s">Data ends</span><span className="num">{b ? sessionLabel(b.periods.holdout[1]) : dash}</span></li>
            <li className="row kvrow"><span className="row-s">Holdout</span><span className="num">{b ? `${sessionLabel(b.periods.holdout[0])} to ${sessionLabel(b.periods.holdout[1])}` : dash}</span></li>
          </ul>
        </div>
        <div className="card">
          <div className="card-h"><h3>Live decision book</h3><span className="pill acc nodot">{feed.version}</span></div>
          <ul className="rows">
            <li className="row kvrow"><span className="row-s">Built</span><span className="num">{istStamp(new Date(feed.generated))}</span></li>
            <li className="row kvrow"><span className="row-s">Data through</span><span className="num">{sessionLabel(feed.data_through)}</span></li>
            <li className="row kvrow"><span className="row-s">Gate read at</span><span className="num">{sessionLabel(feed.gate.date)} close</span></li>
          </ul>
        </div>
        <p className="dim sg-note sg-span">Two separate runs with their own dates. The backtest is rebuilt when the rules change; the book is rebuilt each evening. Neither updates the other, and neither date describes the other.</p>
      </section>

      <section className="section2 sg-sec grid-2" aria-label="Execution and marking rules">
        <div className="card">
          <div className="card-h"><h3>The plan on daily bars</h3><span className="pill nodot">Two-target plan</span></div>
          <ul className="sg-list">{feed.rules.plan.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="card-foot">The engine&apos;s own words (signals.json). <Link className="link" href="/about/#engines">The full rule book</Link></p>
        </div>
        <div className="card">
          <div className="card-h"><h3>How this site marks between runs</h3></div>
          <ul className="sg-list">
            <li>The evening run is the only thing that books an entry, target or stop, from each session&apos;s full high and low, under the rules on the left.</li>
            <li>Between runs a trade is marked to its latest price only. A stop or target that price reaches shows as <i>provisional, not an execution event</i>; nothing is recorded, and a level touched and left during the session is not shown at all.</li>
            <li>The mark advances one step at a time: a price beyond T2 before T1 is booked reads as T1 reached, and R is marked at that price, not at the level. The bar rules (stop first on an ambiguous bar, T1 and T2 on one bar, a gap through the stop filling at the open) run only in the engine (engines/swing.py walk) and are tested there.</li>
            <li>Marks are before costs; closed trades are after the {feed.cost_round_trip_pct}% round trip.</li>
          </ul>
        </div>
      </section>

      {b && b.notes.length > 0 && (
        <section className="section2 sg-sec" aria-labelledby="sg-lim-h">
          <div className="card">
            <div className="card-h"><h3 id="sg-lim-h">Limits of this test</h3></div>
            <ul className="sg-list">{b.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        </section>
      )}

      <EnginesV3 mode="full" />
    </>
  );
}
