import { useMemo } from 'react';
import { useJson, useLedger, useScreen } from '../data.ts';
import { liveStatus } from '../quotes.ts';
import { HEALTH_WORD, overduePending, pipelineHealth } from '../pipeline.ts';
import { rulesOfRecord } from '../rules.ts';
import { universeReport } from '../universe.ts';
import { freshness } from '../fresh.ts';
import { dayWord } from '../fmt.ts';
import { Head, Loading, Failed, PageBar } from './common.tsx';
import { fmtIst } from '../stamp.ts';
import { useNewsHealth } from '../news.ts';
import { CALENDAR, calendarNote } from '../calendar.ts';

const N = (v: number) => v.toLocaleString('en-IN');
interface RunStamp { id: string; when?: string; git: string; data: { first_day: string; last_day: string; sessions: number; symbols: number }; code: { hash: string }; changes: string[]; previous: string | null }
/** What the screen holds, counted from its own rows, and where every kind of figure comes from and how old it is. Nothing here is typed in: it is all read from the data. */
export function DataPage() {
  const runs = [['Factor study', 'factor_study'], ['Engines back-test', 'engines_backtest'], ['Momentum walk-forward', 'engines_walkforward'], ['Pairs', 'engines_pairs']] as const;
  const rs = runs.map(([, f]) => useJson<{ meta?: { when?: string; run?: RunStamp } }>(`/data/research/${f}.json`));   // eslint-disable-line react-hooks/rules-of-hooks
  const nh = useNewsHealth(); const scr = useScreen(); const led = useLedger(); const panel = useJson<{ dates: string[]; built: string }>('/data/research/lab_panel.json');
  const u = useMemo(() => (scr.data ? universeReport(scr.data.rows, scr.data.as_of, scr.data.built_on) : null), [scr.data]);
  if (scr.loading) return <div><PageBar title="Data and coverage" onBack /><Loading what="the data" /></div>;
  if (scr.err || !u || !scr.data) return <div><PageBar title="Data and coverage" onBack /><Failed what="the data" err={scr.err ?? 'no data'} retry={scr.retry} /></div>;
  const fr = freshness(u.asOf); const built = u.builtOn;
  return <div>
    <PageBar title="Data and coverage" onBack sub="What is in the screen, and how old each figure is" />
    <section className="card glass">
      <div className="k">The screen</div>
      <p className="lead" style={{ margin: '6px 0 0' }}><em className="ed num">{N(u.total)}</em> companies, with prices through the close of <b>{dayWord(u.asOf)}</b>.</p>
      <p className="small dim" style={{ margin: '8px 0 0' }}>{fr.word === 'Current' ? 'That is the last finished session.' : `That is ${fr.word.toLowerCase()} the last finished session.`} The screen was built {built ? dayWord(built) : 'on an unknown date'}. Exchange holidays are not modelled.</p>
      <div className="note" style={{ marginTop: 10 }}><b>This is not the Nifty 500 index.</b> The feed does not publish an index membership list or the date of one. Its size classes follow the same pattern as the NSE index families ({u.tiers.large} large, {u.tiers.mid} mid, {u.tiers.small} small, against 100, 150 and 250), so about {N(u.indexSized)} names look index-sized. That is an inference from the counts, not a published fact. The other {N(u.total - u.indexSized)} are micro caps ({u.tiers.micro}) or have no size class ({u.tiers.unknown}).</div>
    </section>

    {(() => { const L = led.data?.ledger; const od = L ? overduePending(L) : null; const q = liveStatus(); const last = L?.days[L.days.length - 1];
      const ph = pipelineHealth({ screenAsOf: u.asOf, screenBuiltOn: u.builtOn, ledgerLastNight: last?.asOf ?? null, ledgerUpdated: L?.updated ?? null, ledgerRules: last ? rulesOfRecord(last.rules) : null, pendingOld: od?.old ?? 0, pendingTotal: od?.total ?? 0, quoteLastAt: q.lastAt || null, quoteErr: q.err ?? null, panelLastDay: panel.data?.dates?.[panel.data.dates.length - 1] ?? null, panelBuilt: panel.data?.built ?? null });
      return <><Head aside={<span className={`tag ${ph.overall === 'ok' ? 'lime' : 'peach'}`}>{HEALTH_WORD[ph.overall]}</span>}>Pipeline health</Head>
        <div className="card" style={{ padding: '2px 14px' }}><table className="tbl" style={{ width: '100%' }}><caption className="sr">Each stage of the data pipeline against what the exchange calendar says it should be</caption><tbody>
          {ph.stages.map((s) => <tr key={s.id}><th scope="row" style={{ textAlign: 'left', verticalAlign: 'top', width: '34%' }}>{s.label}</th><td><span className={`tag ${s.health === 'ok' ? 'lime' : s.health === 'waiting' ? '' : 'peach'}`}>{HEALTH_WORD[s.health]}</span><div className="small dim" style={{ marginTop: 4 }}>{s.detail}</div></td></tr>)}</tbody></table>
          <p className="small mute" style={{ margin: '6px 0 10px' }}>Expected: the close of {dayWord(ph.expectedSession)}, from the NSE holiday calendar ({CALENDAR.version}, covers {CALENDAR.year}). {calendarNote() ?? ''}</p></div></>; })()}

    <Head>Size classes</Head>
    <div className="card" style={{ padding: '2px 14px' }}><table className="tbl" style={{ width: '100%' }}><caption className="sr">Companies by size class</caption><tbody>
      {([['Large', u.tiers.large], ['Mid', u.tiers.mid], ['Small', u.tiers.small], ['Micro', u.tiers.micro], ['Not published', u.tiers.unknown]] as const).map(([l, v]) => <tr key={l}><td>{l}</td><td className="num" style={{ textAlign: 'right' }}>{N(v)}</td></tr>)}
      <tr><th scope="row" style={{ textAlign: 'left' }}>All</th><td className="num" style={{ textAlign: 'right' }}><b>{N(u.total)}</b></td></tr></tbody></table></div>

    <Head>From {N(u.total)} to the {N(u.engineEligible)} the engines may pick from</Head>
    <div className="card" style={{ padding: '2px 14px' }}><table className="tbl" style={{ width: '100%' }}><caption className="sr">Engine eligibility, step by step</caption><thead><tr><th scope="col" style={{ textAlign: 'left' }}>Step</th><th scope="col" style={{ textAlign: 'right' }}>Removed</th><th scope="col" style={{ textAlign: 'right' }}>Left</th></tr></thead><tbody>
      <tr><td>Companies in the screen</td><td /><td className="num" style={{ textAlign: 'right' }}>{N(u.total)}</td></tr>
      {u.waterfall.map((w) => <tr key={w.id}><td>{w.label}</td><td className="num" style={{ textAlign: 'right' }}>{w.removed ? `−${N(w.removed)}` : '0'}</td><td className="num" style={{ textAlign: 'right' }}>{N(w.left)}</td></tr>)}</tbody></table>
      <p className="small dim" style={{ margin: '8px 0 10px' }}>These steps are the engines' own rule, read from the same code, so this table cannot drift from what the engines do.</p></div>

    <Head>Coverage</Head>
    <div className="card" style={{ padding: '2px 14px' }}><table className="tbl" style={{ width: '100%' }}><caption className="sr">Coverage of the figures the screens use</caption><tbody>
      <tr><td>Flagged liquid by the screen</td><td className="num" style={{ textAlign: 'right' }}>{N(u.liquid)} of {N(u.total)}</td></tr>
      <tr><td>With both the 50 and 200-day averages (the trend map)</td><td className="num" style={{ textAlign: 'right' }}>{N(u.withAverages)}</td></tr>
      <tr><td>Liquid and with both averages</td><td className="num" style={{ textAlign: 'right' }}>{N(u.liquidWithAverages)}</td></tr>
      <tr><td>With financial statements</td><td className="num" style={{ textAlign: 'right' }}>{N(u.withStatements)} of {N(u.total)}</td></tr>
      <tr><td>Financial sector (statement ratios not judged)</td><td className="num" style={{ textAlign: 'right' }}>{N(u.financial)}</td></tr></tbody></table>
      <p className="small dim" style={{ margin: '8px 0 10px' }}>{N(u.liquid - u.liquidWithAverages)} liquid names have no 200-day average yet (recent listings), so the trend map counts {N(u.liquidWithAverages)}, not {N(u.liquid)}.</p></div>

    <Head>The eligibility rule, by version</Head>
    <div className="card" style={{ padding: '10px 14px' }}>
      <p className="small" style={{ margin: 0 }}>This screen is read under <b className="num">{u.rules}</b>{u.rules === 'elig-1' ? ` (elig-2 applies from the ${dayWord(u.rulesFrom === '0000-00-00' ? '2026-10-27' : u.rulesFrom)} data day)` : ` (in force from the ${dayWord(u.rulesFrom)} data day)`}. {u.rulesSummary}</p>
      <p className="small mute" style={{ margin: '8px 0 0' }}>On these rows the previous version would admit <b className="num">{N(u.engineEligibleElig1)}</b> names and this one admits <b className="num">{N(u.engineEligible)}</b>. Nights already in the record keep the version they were written under; none is re-run or re-scored.</p>
    </div>
    <Head>Three gaps between the written spec and the code, and how each was resolved</Head>
    {u.conflicts.map((c) => <details key={c.id} className="ev"><summary><b>{c.id}</b> · {c.title}<span className="tag lime num" style={{ marginLeft: 'auto' }}>{c.resolvedIn}</span><span className="chev">▾</span></summary><div className="body"><p style={{ margin: '0 0 6px' }}><b>Written:</b> {c.spec}</p><p style={{ margin: '0 0 6px' }}><b>In the data:</b> {c.actual}</p><p style={{ margin: 0 }}><b>Resolution:</b> {c.decision} <span className="mute">It removes {N(c.count)} names the old rule admitted.</span></p></div></details>)}
    <p className="small mute">A rule change alters every percentile rank and every pick that follows, so it is a dated version, never an edit. Thresholds are the spec's own, fixed before the counts were read; they are not tuned and not claimed to be better.</p>

    <Head>Back-test runs, and why a result changed</Head>
    <div className="card" style={{ padding: '2px 14px' }}>{runs.map(([label], i) => { const m = rs[i].data?.meta; const r = m?.run;
      return <details key={label} className="ev" style={{ margin: 0 }}><summary>{label}<span className="small mute num" style={{ marginLeft: 'auto' }}>{r ? `run ${r.id}` : m ? 'not stamped' : rs[i].loading ? '…' : 'not available'}</span><span className="chev">▾</span></summary>
        <div className="body small">{r ? <><p style={{ margin: '0 0 6px' }}>Run <b className="num">{r.id}</b> on {m?.when ?? 'an unknown time'}, code <span className="num">{r.code.hash}</span>, commit <span className="num">{r.git}</span>. Prices {r.data.first_day} to {r.data.last_day} ({N(r.data.sessions)} sessions, {N(r.data.symbols)} names).</p>
          <p style={{ margin: '0 0 4px' }}><b>What changed since the previous run{r.previous ? ` (${r.previous})` : ''}:</b></p><ul style={{ margin: 0, paddingLeft: 18 }}>{r.changes.map((c) => <li key={c}>{c}</li>)}</ul></> : m ? <p style={{ margin: 0 }}>This result was produced before runs were stamped. The next research run records what it ran on and compares with this one.</p> : <p style={{ margin: 0 }}>Not published.</p>}</div></details>; })}
      <p className="small mute" style={{ margin: '6px 0 10px' }}>A result can move for four reasons only: the history grew, the universe changed, the provider restated old closes, or the code or parameters changed. Each run says which. The same id means the same inputs.</p></div>

    <Head>Sources and ages</Head>
    <div className="card" style={{ padding: '2px 14px' }}><div className="scroll-x" tabIndex={0} role="region" aria-label="Sources and ages, scrolls sideways"><table className="tbl" style={{ width: '100%' }}><thead><tr><th scope="col">Figure</th><th scope="col">Source</th><th scope="col">Observed</th><th scope="col">Delay</th></tr></thead><tbody>
      <tr><td>Live prices, indices, gold, currencies, Bitcoin</td><td>Yahoo Finance, through this app's Worker</td><td>The exchange's own print time, shown beside every live figure</td><td>Measured on each figure: the age of its latest print</td></tr>
      <tr><td>Screen, scores, trend, averages</td><td>Published daily screen, built from Yahoo Finance daily bars and annual statements</td><td>Close of {dayWord(u.asOf)}</td><td>{fr.word === 'Current' ? 'None: the last finished session' : `${fr.word}${fr.behind ? ` (${fr.behind})` : ''}`}</td></tr>
      <tr><td>Financial statements</td><td>Annual statements via Yahoo Finance</td><td>Latest fiscal year held per company (shown on its page)</td><td>Annual, months after a year ends</td></tr>
      <tr><td>Forward record and automatic book</td><td>Nightly job, daily bars via yfinance</td><td>{led.data?.ledger ? `Written ${fmtIst(Date.parse(led.data.ledger.updated) / 1000)}` : 'Not available'}</td><td>One night</td></tr>
      <tr><td>News</td><td>Google News and Bing News search feeds, RBI and SEBI release feeds; admitted only if a story names a covered company or an India-wide event</td><td>Each story carries its own publication time; the check has its own: {nh.state === 'unavailable' ? 'no check has succeeded yet' : `last successful check ${nh.lastGood}`}</td><td>{nh.word}{nh.next && nh.state === 'fresh' ? `, next check about ${nh.next}` : ''}; scheduled every 15 minutes in the NSE session, 30 otherwise</td></tr></tbody></table></div></div>
    <p className="small mute" style={{ marginTop: 10 }}>Times are Indian Standard Time. A figure's age is measured from when it was printed, never from when this app last asked.</p>
  </div>;
}
