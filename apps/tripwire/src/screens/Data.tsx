import { useMemo } from 'react';
import { useLedger, useScreen } from '../data.ts';
import { universeReport } from '../universe.ts';
import { freshness } from '../fresh.ts';
import { dayWord } from '../fmt.ts';
import { Head, Loading, Failed, PageBar } from './common.tsx';
import { fmtIst } from '../stamp.ts';

const N = (v: number) => v.toLocaleString('en-IN');
/** What the screen holds, counted from its own rows, and where every kind of figure comes from and how old it is. Nothing here is typed in: it is all read from the data. */
export function DataPage() {
  const scr = useScreen(); const led = useLedger();
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

    <Head>Where the written rules and the data disagree</Head>
    {u.conflicts.map((c) => <details key={c.id} className="ev"><summary><b>{c.id}</b> · {c.title}<span className="tag peach num" style={{ marginLeft: 'auto' }}>{N(c.count)}</span><span className="chev">▾</span></summary><div className="body"><p style={{ margin: '0 0 6px' }}><b>Written:</b> {c.spec}</p><p style={{ margin: '0 0 6px' }}><b>In the data:</b> {c.actual}</p><p style={{ margin: 0 }}><b>Open decision:</b> {c.decision}</p></div></details>)}
    <p className="small mute">Tripwire has not changed any engine rule to make these agree. A rule change alters percentile ranks and the forward record, so it is a versioned decision for the owner.</p>

    <Head>Sources and ages</Head>
    <div className="card" style={{ padding: '2px 14px' }}><div className="scroll-x" tabIndex={0} role="region" aria-label="Sources and ages, scrolls sideways"><table className="tbl" style={{ width: '100%' }}><thead><tr><th scope="col">Figure</th><th scope="col">Source</th><th scope="col">Observed</th><th scope="col">Delay</th></tr></thead><tbody>
      <tr><td>Live prices, indices, gold, currencies, Bitcoin</td><td>Yahoo Finance, through this app's Worker</td><td>The exchange's own print time, shown beside every live figure</td><td>Measured on each figure: the age of its latest print</td></tr>
      <tr><td>Screen, scores, trend, averages</td><td>Published daily screen, built from Yahoo Finance daily bars and annual statements</td><td>Close of {dayWord(u.asOf)}</td><td>{fr.word === 'Current' ? 'None: the last finished session' : `${fr.word}${fr.behind ? ` (${fr.behind})` : ''}`}</td></tr>
      <tr><td>Financial statements</td><td>Annual statements via Yahoo Finance</td><td>Latest fiscal year held per company (shown on its page)</td><td>Annual, months after a year ends</td></tr>
      <tr><td>Forward record and automatic book</td><td>Nightly job, daily bars via yfinance</td><td>{led.data?.ledger ? `Written ${fmtIst(Date.parse(led.data.ledger.updated) / 1000)}` : 'Not available'}</td><td>One night</td></tr>
      <tr><td>News</td><td>Bing News (Google News when it answers), English only</td><td>Each headline carries its own time</td><td>Checked hourly</td></tr></tbody></table></div></div>
    <p className="small mute" style={{ marginTop: 10 }}>Times are Indian Standard Time. A figure's age is measured from when it was printed, never from when this app last asked.</p>
  </div>;
}
