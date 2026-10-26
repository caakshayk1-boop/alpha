import { useBacktest, useStudy } from '../data.ts';
import { ENGINES } from '../quant.ts';
import { engineEvidence, studySummary } from '../evidence.ts';
import { FACTOR_META } from '../intel.ts';
import { Empty } from '../ui.tsx';
import { Head, Loading } from './common.tsx';

const p1 = (v: number | null | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`);
const f2 = (v: number | null | undefined) => (v == null ? '—' : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`);
const PRETTY: Record<string, string> = { mom12_1: '12-month momentum', near_high: 'Nearness to 52-week high', rev21: 'One-month reversal', amihud: 'Illiquidity', noise: 'Random noise', ...Object.fromEntries(Object.entries(FACTOR_META).map(([k, v]) => [k, v.label])) };

/** The page that tells you what the history says about every engine and indicator: the study, its rules, and what it found. */
export function Evidence() {
  const bt = useBacktest(); const st = useStudy();
  if (bt.loading || st.loading) return <Loading what="the evidence" />;
  const sum = studySummary(st.data);
  return <>
    <div className="card glass"><div className="k">What the history says</div>
      <p className="lead" style={{ marginTop: 6 }}>{bt.data ? <>None of the engines beat <em className="ed">the whole market</em> in a ten-year back-test.</> : <>The historical test has not been published <em className="ed">yet</em>.</>}</p>
      <p className="small dim" style={{ margin: '8px 0 0' }}>Tripwire tests its own ideas in public, with the rules written down before the result was known, and shows you the result either way. The picks you see are experiments. The forward record (Record tab) is the real test, because it cannot be fitted to the past.</p></div>
    <Head>Engines, back-tested as built</Head>
    {ENGINES.map((e) => { const ev = engineEvidence(e.id, bt.data); const per = bt.data?.engines?.[e.id]?.periods;
      return <div key={e.id} className="card"><div className="row between"><b>{e.name}</b><span className={`tag ${ev.tone === 'bad' ? 'peach' : ev.tone === 'ok' ? 'lime' : ''}`}>{ev.short}</span></div>
        <p className="small dim" style={{ margin: '8px 0 0' }}>{ev.line}</p>
        {per && <div className="scroll-x" style={{ marginTop: 8 }} tabIndex={0} role="region" aria-label={`${e.name} back-test by period, scrolls sideways`}><table className="tbl"><thead><tr><th>Period</th><th>Trades</th><th>Net a trade</th><th>Hit rate</th><th>Excess (t)</th></tr></thead><tbody>{(['train', 'validation', 'holdout'] as const).map((k) => <tr key={k}><td>{k === 'train' ? 'Early' : k === 'validation' ? 'Middle' : 'Latest'}</td><td className="num">{per[k].trades ?? '—'}</td><td className="num">{p1(per[k].mean_net)}</td><td className="num">{per[k].hit_rate != null ? `${Math.round(per[k].hit_rate! * 100)}%` : '—'}</td><td className="num">{p1(per[k].excess_vs_universe)} ({f2(per[k].excess_t)})</td></tr>)}</tbody></table></div>}</div>; })}
    {!bt.data && <Empty title="Back-test not published">It is produced by the research workflow and appears here once it has run.</Empty>}
    <p className="small mute">Excess is the engine's average trade, after costs and slippage, minus the average of every eligible stock over the same sessions. The three periods are fixed in advance: the latest was read once. The list of stocks is today's, so those that fell out of the index are missing, which flatters every figure.</p>

    {sum && st.data && <><Head>Unusual indicators, tested</Head>
      <div className="card"><p style={{ margin: 0 }}><b className="num">{sum.candidates}</b> less common indicators were tested against three common ones and a random control: <b className={`num ${sum.passed ? 'up' : 'down'}`}>{sum.passed}</b> passed.</p>
        {sum.best && <p className="small dim" style={{ margin: '8px 0 0' }}>Closest: <b style={{ color: 'var(--tx)' }}>{PRETTY[sum.best.name] ?? sum.best.name}</b> (training t {f2(sum.best.t)}). It failed: {sum.best.failed.join('; ') || 'nothing'}.</p>}
        <details className="ev" style={{ marginTop: 10 }}><summary>Every indicator<span className="chev">▾</span></summary><div className="body"><div className="scroll-x" tabIndex={0} role="region" aria-label="Every indicator tested, scrolls sideways"><table className="tbl"><thead><tr><th>Indicator</th><th>Early IC (t)</th><th>Middle IC</th><th>Latest IC</th><th>Result</th></tr></thead><tbody>
          {Object.entries(st.data.features).map(([k, f]) => { const v = st.data!.verdict[k]; return <tr key={k}><td>{PRETTY[k] ?? k}<div className="small mute">{v.kind}</div></td><td className="num">{f2(f.train.ic)} ({f2(f.train.t)})</td><td className="num">{f2(f.validation.ic)}</td><td className="num">{f2(f.holdout.ic)}</td><td>{v.adopt ? 'passed' : 'did not pass'}</td></tr>; })}</tbody></table></div>
          <p className="small mute" style={{ margin: '8px 0 0' }}>IC is the rank correlation between the indicator and the next 20 sessions' return: 0 is nothing, 0.05 is a faint tilt, above 0.1 would be strong. These are all faint at best.</p></div></details></div>
      <div className="note info" style={{ marginTop: 10 }}><b>The rule, fixed before the run.</b> An indicator is adopted only if it clears t ≥ 2.5 in the early years (about a dozen were tried, so 2.0 would let one false positive through), keeps its sign and at least half its strength in the middle years, and still beats the universe after costs in the latest years, which are read once. A feature that fails stays failed. A random-noise control must not pass, and a planted effect must be found; both are tested before any real data is read.</div></>}
    <Head>What would change this</Head>
    <div className="card small dim"><ul style={{ margin: 0, paddingLeft: 18 }}><li style={{ marginBottom: 6 }}>The forward record reaching 100 closed trades per engine, with a positive average after costs and a t above 2. Thirty is a minimum, not proof.</li><li style={{ marginBottom: 6 }}>Data the study could not use: company accounts as they stood on each date (to test Quality), delivery percentages, daily foreign and domestic flows, earnings surprises with their release times. With them, better engines can be designed and tested the same way.</li><li>A list of stocks that includes the ones that disappeared, which removes the survivorship flattery.</li></ul></div>
  </>;
}
