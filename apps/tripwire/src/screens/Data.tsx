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
import { CALENDAR, calendarNote, holidayStatement } from '../calendar.ts';
import { useFreshness } from '../freshdata.ts';
import { throughWord, builtWord, type Status } from '../freshness.ts';
import { StatusPill, type Tone } from '../components/index.ts';
import { BreadthGapText, BreadthGapTable } from './gapnote.tsx';
import { ObservationNote } from './obsnote.tsx';
import { Fold } from './fold.tsx';
import { missingNights, missingNightsNote } from '../ledgergaps.ts';

const N = (v: number) => v.toLocaleString('en-IN');
const STATUS_WORD: Record<Status, string> = { current: 'Current', pending: 'Build due', stale: 'Behind', unknown: 'Date unreadable', missing: 'Not published' };
const STATUS_PILL: Record<Status, Tone> = { current: 'up', pending: 'neutral', stale: 'amber', unknown: 'amber', missing: 'amber' };
interface RunStamp { id: string; when?: string; git: string; data: { first_day: string; last_day: string; sessions: number; symbols: number }; code: { hash: string }; changes: string[]; previous: string | null }
/** What the screen holds, counted from its own rows, and where every kind of figure comes from and how old it is. Nothing here is typed in: it is all read from the data. */
export function DataPage({ embedded = false }: { embedded?: boolean } = {}) {
  const runs = [['Factor study', 'factor_study'], ['Engines back-test', 'engines_backtest'], ['Momentum walk-forward', 'engines_walkforward'], ['Pairs', 'engines_pairs']] as const;
  const rs = runs.map(([, f]) => useJson<{ meta?: { when?: string; run?: RunStamp } }>(`/data/research/${f}.json`));   // eslint-disable-line react-hooks/rules-of-hooks
  const nh = useNewsHealth(); const scr = useScreen(); const led = useLedger(); const panel = useJson<{ dates: string[]; built: string }>('/data/research/lab_panel.json');
  const u = useMemo(() => (scr.data ? universeReport(scr.data.rows, scr.data.as_of, scr.data.built_on) : null), [scr.data]);
  const fx = useFreshness();
  if (scr.loading) return <div className="mp mp-data">{!embedded && <PageBar title="Data and coverage" onBack />}<Loading what="the data" /></div>;
  if (scr.err || !u || !scr.data) return <div className="mp mp-data">{!embedded && <PageBar title="Data and coverage" onBack />}<Failed what="the data" err={scr.err ?? 'no data'} retry={scr.retry} /></div>;
  const fr = freshness(u.asOf); const built = u.builtOn;
  const L = led.data?.ledger; const od = L ? overduePending(L) : null; const q = liveStatus(); const last = L?.days[L.days.length - 1];
  const ph = pipelineHealth({ screenAsOf: u.asOf, screenBuiltOn: u.builtOn, ledgerLastNight: last?.asOf ?? null, ledgerUpdated: L?.updated ?? null, ledgerRules: last ? rulesOfRecord(last.rules) : null, pendingOld: od?.old ?? 0, pendingTotal: od?.total ?? 0, quoteLastAt: q.lastAt || null, quoteErr: q.err ?? null, panelLastDay: panel.data?.dates?.[panel.data.dates.length - 1] ?? null, panelBuilt: panel.data?.built ?? null });
  const gaps = missingNights(L, Date.now()); const gapNote = missingNightsNote(gaps);
  // 11 Nov 2026 (revamp v2): the screen's size and date were stated twice (a card and the first line of At a glance); they are stated once, here.
  return <div className="mp mp-data">
    {!embedded && <PageBar title="Data and coverage" onBack sub="What is in the screen, and how old each figure is" />}
    <section className="card" aria-label="The screen">
      <p className="lead mp-lead"><b className="num">{N(u.total)}</b> companies, prices through the close of <b>{dayWord(u.asOf)}</b>; {fr.word === 'Current' ? 'that is the last finished session.' : `${fr.word.toLowerCase()} the last finished session.`}</p>
      <p className="mp-meta" data-counts>One definition, used everywhere: <b className="num">{N(u.total)}</b> companies are screened; <b className="num">{N(u.liquid)}</b> pass the liquidity filter; the trend map counts the <b className="num">{N(u.liquidWithAverages)}</b> of those that have both moving averages.</p>
      <p className="mp-meta">The screen was built {built ? dayWord(built) : 'on an unknown date'}. {holidayStatement()}</p>
      <div className="note" style={{ marginTop: 'var(--sp-4)' }}><b>This is not the Nifty 500 index.</b> The feed does not publish an index membership list or the date of one. Its size classes follow the same pattern as the NSE index families ({u.tiers.large} large, {u.tiers.mid} mid, {u.tiers.small} small, against 100, 150 and 250), so about {N(u.indexSized)} names look index-sized. That is an inference from the counts, not a published fact. The other {N(u.total - u.indexSized)} are micro caps ({u.tiers.micro}) or have no size class ({u.tiers.unknown}, {((u.tiers.unknown / u.total) * 100).toFixed(1)}% of the screen). A missing class is stated, not filled in: the feed's classes follow index membership rather than a market-cap cut-off (their market-cap ranges overlap), so none can be worked out from a company's value, and the engines require a published class that is not micro (rule elig-2, D1).</div>
    </section>

    <section className="card sumcard" aria-labelledby="dt-glance" data-summary="data">
      <h2 id="dt-glance">At a glance</h2>
      <ul className="sumlist">
        <li><span className="sk-k">Data files</span><span className={`sk-v${fx.worst === 'current' || fx.worst === 'pending' || fx.loading ? '' : ' bad'}`}>{fx.loading ? 'Checking each file.' : fx.worst === 'current' ? 'Every file is current.' : fx.worst === 'pending' ? 'Every file is current; the newest build is due.' : 'At least one file is behind; the table below names it.'}</span></li>
        <li><span className="sk-k">Pipeline</span><span className={`sk-v${ph.overall === 'ok' ? '' : ' bad'}`}>{HEALTH_WORD[ph.overall]}: {ph.overall === 'ok' ? 'each stage matches the exchange calendar.' : 'a stage is behind or waiting; see Pipeline health.'}</span></li>
        <li><span className="sk-k">Forward record</span><span className={`sk-v${gapNote ? ' bad' : ''}`} data-ledger-gaps={gaps.length}>{!L ? (led.loading ? 'Checking.' : 'Not available.') : `Last night recorded: ${last ? dayWord(last.asOf) : 'none yet'}.`}{gapNote ? ` ${gapNote}.` : L ? ' No session missing since the first night.' : ''}</span></li>
        <li><span className="sk-k">Open to the engines</span><span className="sk-v">{N(u.engineEligible)} of {N(u.total)} under rule {u.rules}.</span></li>
      </ul>
      <p className="small mute" style={{ margin: 0 }}>The sections below keep every table, source and limitation. Open any heading for its detail; nothing has been removed.</p>
    </section>

    <Head aside={<span className={`tag ${fx.worst === 'current' ? 'lime' : fx.worst === 'pending' ? '' : 'amber'}`}>{fx.loading ? 'Checking' : fx.worst === 'current' ? 'All current' : fx.worst === 'pending' ? 'Build due' : 'Something is behind'}</span>}>Every data file, and how current it is</Head>
    <div className="card" style={{ padding: '2px 14px' }}><div className="scroll-x" tabIndex={0} role="region" aria-label="Every data file, scrolls sideways"><table className="tbl fresh-tbl" data-fresh-table style={{ width: '100%' }}><caption className="sr">Each published data file: the session it carries, when it was built, its rows and its status against the last finished session</caption>
      <thead><tr><th scope="col">File</th><th scope="col">As of</th><th scope="col">Built</th><th scope="col" style={{ textAlign: 'right' }}>Rows</th><th scope="col">Status</th></tr></thead><tbody>
      {fx.files.map((f) => <tr key={f.id} data-file={f.id}><th scope="row" style={{ textAlign: 'left' }}>{f.label}{f.note ? <span className="small mute" style={{ display: 'block', fontWeight: 400 }}>{f.note}</span> : null}{f.id === 'ledger' && gapNote ? <span className="gaps" data-ledger-gaps-row>{gapNote}</span> : null}</th><td className="num" data-label="As of">{f.asOf ? `${throughWord(f.asOf)} close` : 'none'}</td><td className="num" data-label="Built">{f.built ? (builtWord(f.built) ? `${f.built.slice(0, 10)} ${builtWord(f.built)}` : f.built.slice(0, 10)) : 'not stated'}</td><td className="num" data-label="Rows" style={{ textAlign: 'right' }}>{f.rows != null ? N(f.rows) : '—'}</td>
        <td data-label="Status"><StatusPill tone={STATUS_PILL[f.status]} icon={f.status === 'current' ? 'check' : f.status === 'pending' ? 'clock' : 'alert'}>{STATUS_WORD[f.status]}</StatusPill>{f.status === 'stale' && f.behind ? <span className="small dim" style={{ display: 'block' }}>{f.behind} session{f.behind === 1 ? '' : 's'} behind {throughWord(fx.expected)}</span> : null}</td></tr>)}
      {fx.waiting.map((id) => <tr key={id}><th scope="row" style={{ textAlign: 'left' }}>{id}</th><td colSpan={4} className="dim">Loading…</td></tr>)}</tbody></table></div>
      <p className="small mute" style={{ margin: '6px 0 10px' }}>The last finished session is {throughWord(fx.expected)} ({CALENDAR.version}). Dates are closes, not live prices; "built" is when the file was written, in Indian time. A file one session behind is "build due" only between the close and 23:30 IST on that day; after that it is behind. Weekends and NSE holidays are not lateness.</p></div>

    <Fold id="pipeline" title="Pipeline health" summary={ph.overall === 'ok' ? 'Every stage matches what the exchange calendar says it should be.' : 'At least one stage is behind or waiting; the stage table says which.'} aside={<span className={`tag ${ph.overall === 'ok' ? 'lime' : 'peach'}`}>{HEALTH_WORD[ph.overall]}</span>}>
      <div className="card" style={{ padding: '2px 14px' }}><table className="tbl" style={{ width: '100%' }}><caption className="sr">Each stage of the data pipeline against what the exchange calendar says it should be</caption><tbody>
          {ph.stages.map((s) => <tr key={s.id}><th scope="row" style={{ textAlign: 'left', verticalAlign: 'top', width: '34%' }}>{s.label}</th><td><span className={`tag ${s.health === 'ok' ? 'lime' : s.health === 'waiting' ? '' : 'peach'}`}>{HEALTH_WORD[s.health]}</span><div className="small dim" style={{ marginTop: 4 }}>{s.detail}</div>{s.id === 'ledger-night' && gapNote ? <span className="gaps">{gapNote}. A night that was not written down is not filled in later.</span> : null}</td></tr>)}</tbody></table>
          <p className="small mute" style={{ margin: '6px 0 10px' }}>Expected: the close of {dayWord(ph.expectedSession)}, from the NSE holiday calendar ({CALENDAR.version}, covers {CALENDAR.year}). {calendarNote() ?? ''}</p></div>
    </Fold>

    <Fold id="sizes" title={'Size classes'} summary={`${N(u.tiers.large)} large, ${N(u.tiers.mid)} mid, ${N(u.tiers.small)} small, ${N(u.tiers.micro)} micro, ${N(u.tiers.unknown)} not published.`}>
    <div className="card" style={{ padding: '2px 14px' }}><table className="tbl" style={{ width: '100%' }}><caption className="sr">Companies by size class</caption><tbody>
      {([['Large', u.tiers.large], ['Mid', u.tiers.mid], ['Small', u.tiers.small], ['Micro', u.tiers.micro], ['Not published', u.tiers.unknown]] as const).map(([l, v]) => <tr key={l}><td>{l}</td><td className="num" style={{ textAlign: 'right' }}>{N(v)}</td></tr>)}
      <tr><th scope="row" style={{ textAlign: 'left' }}>All</th><td className="num" style={{ textAlign: 'right' }}><b>{N(u.total)}</b></td></tr></tbody></table></div>
    </Fold>

    <Fold id="waterfall" title={`From ${N(u.total)} to the ${N(u.engineEligible)} the engines may pick from`} summary={`${N(u.engineEligible)} of ${N(u.total)} pass every eligibility step; the table shows how many each step removes.`}>
    <div className="card" style={{ padding: '2px 14px' }}><table className="tbl" style={{ width: '100%' }}><caption className="sr">Engine eligibility, step by step</caption><thead><tr><th scope="col" style={{ textAlign: 'left' }}>Step</th><th scope="col" style={{ textAlign: 'right' }}>Removed</th><th scope="col" style={{ textAlign: 'right' }}>Left</th></tr></thead><tbody>
      <tr><td>Companies in the screen</td><td /><td className="num" style={{ textAlign: 'right' }}>{N(u.total)}</td></tr>
      {u.waterfall.map((w) => <tr key={w.id}><td>{w.label}</td><td className="num" style={{ textAlign: 'right' }}>{w.removed ? `−${N(w.removed)}` : '0'}</td><td className="num" style={{ textAlign: 'right' }}>{N(w.left)}</td></tr>)}</tbody></table>
      <p className="small dim" style={{ margin: '8px 0 10px' }}>These steps are the engines' own rule, read from the same code, so this table cannot drift from what the engines do.</p></div>
    </Fold>

    <Fold id="coverage" title={'Coverage'} summary={`${N(u.withStatements)} of ${N(u.total)} have financial statements; ${N(u.liquidWithAverages)} liquid names have both moving averages.`}>
    <div className="card" style={{ padding: '2px 14px' }}><table className="tbl" style={{ width: '100%' }}><caption className="sr">Coverage of the figures the screens use</caption><tbody>
      <tr><td>Flagged liquid by the screen</td><td className="num" style={{ textAlign: 'right' }}>{N(u.liquid)} of {N(u.total)}</td></tr>
      <tr><td>With both the 50 and 200-day averages (the trend map)</td><td className="num" style={{ textAlign: 'right' }}>{N(u.withAverages)}</td></tr>
      <tr><td>Liquid and with both averages</td><td className="num" style={{ textAlign: 'right' }}>{N(u.liquidWithAverages)}</td></tr>
      <tr><td>With financial statements</td><td className="num" style={{ textAlign: 'right' }}>{N(u.withStatements)} of {N(u.total)}</td></tr>
      <tr><td>Financial sector (statement ratios not judged)</td><td className="num" style={{ textAlign: 'right' }}>{N(u.financial)}</td></tr></tbody></table>
      <p className="small dim" style={{ margin: '8px 0 10px' }}>{N(u.liquid - u.liquidWithAverages)} liquid names have no 200-day average yet (recent listings), so the trend map counts {N(u.liquidWithAverages)}, not {N(u.liquid)}.</p></div>
    </Fold>

    <Fold id="observations" title={'Observations and positions'} summary='A pick is an observation; the paper book holds a company once at a time. The Signals gate file and the Picks are different files.'>
    <div className="card" style={{ padding: '10px 14px' }}><ObservationNote className="small" /><p className="small mute" style={{ margin: '8px 0 0' }}>The Signals gate file and the engines' Picks are different files: the gate file can hold no rows while the engines still record picks (see the table of files above).</p></div>
    </Fold>

    <Fold id="trendgap" title={'Why the trend map counts fewer names than the screen'} summary='Where the difference sits, sector by sector.'>
    <div className="card" style={{ padding: '10px 14px' }}><p className="small" style={{ margin: '0 0 8px' }}><BreadthGapText g={u.breadthGap} /></p><BreadthGapTable g={u.breadthGap} /></div>
    </Fold>

    <Fold id="rules" title={'The eligibility rule, by version'} summary={`This screen is read under ${u.rules}; nights already in the record keep the version they were written under.`}>
    <div className="card" style={{ padding: '10px 14px' }}>
      <p className="small" style={{ margin: 0 }}>This screen is read under <b className="num">{u.rules}</b>{u.rules === 'elig-1' ? ` (elig-2 applies from the ${dayWord(u.rulesFrom === '0000-00-00' ? '2026-10-27' : u.rulesFrom)} data day)` : ` (in force from the ${dayWord(u.rulesFrom)} data day)`}. {u.rulesSummary}</p>
      <p className="small mute" style={{ margin: '8px 0 0' }}>On these rows the previous version would admit <b className="num">{N(u.engineEligibleElig1)}</b> names and this one admits <b className="num">{N(u.engineEligible)}</b>. Nights already in the record keep the version they were written under; none is re-run or re-scored.</p>
    </div>
    </Fold>

    <Fold id="gaps" title={'Three gaps between the written spec and the code'} summary='Where the written spec and the code disagreed, and which version resolved each.'>
    {u.conflicts.map((c) => <details key={c.id} className="ev"><summary><b>{c.id}</b> · {c.title}<span className="tag lime num" style={{ marginLeft: 'auto' }}>{c.resolvedIn}</span><span className="chev">▾</span></summary><div className="body"><p style={{ margin: '0 0 6px' }}><b>Written:</b> {c.spec}</p><p style={{ margin: '0 0 6px' }}><b>In the data:</b> {c.actual}</p><p style={{ margin: 0 }}><b>Resolution:</b> {c.decision} <span className="mute">It removes {N(c.count)} names the old rule admitted.</span></p></div></details>)}
    <p className="small mute">A rule change alters every percentile rank and every pick that follows, so it is a dated version, never an edit. Thresholds are the spec's own, fixed before the counts were read; they are not tuned and not claimed to be better.</p>
    </Fold>

    <Fold id="runs" title={'Back-test runs, and why a result changed'} summary='Which run produced each research result, what it ran on, and what changed since the previous run.'>
    <div className="card" style={{ padding: '2px 14px' }}>{runs.map(([label], i) => { const m = rs[i].data?.meta; const r = m?.run;
      return <details key={label} className="ev" style={{ margin: 0 }}><summary>{label}<span className="small mute num" style={{ marginLeft: 'auto' }}>{r ? `run ${r.id}` : m ? 'not stamped' : rs[i].loading ? '…' : 'not available'}</span><span className="chev">▾</span></summary>
        <div className="body small">{r ? <><p style={{ margin: '0 0 6px' }}>Run <b className="num">{r.id}</b> on {m?.when ?? 'an unknown time'}, code <span className="num">{r.code.hash}</span>, commit <span className="num">{r.git}</span>. Prices {r.data.first_day} to {r.data.last_day} ({N(r.data.sessions)} sessions, {N(r.data.symbols)} names).</p>
          <p style={{ margin: '0 0 4px' }}><b>What changed since the previous run{r.previous ? ` (${r.previous})` : ''}:</b></p><ul style={{ margin: 0, paddingLeft: 18 }}>{r.changes.map((c) => <li key={c}>{c}</li>)}</ul></> : m ? <p style={{ margin: 0 }}>This result was produced before runs were stamped. The next research run records what it ran on and compares with this one.</p> : <p style={{ margin: 0 }}>Not published.</p>}</div></details>; })}
      <p className="small mute" style={{ margin: '6px 0 10px' }}>A result can move for four reasons only: the history grew, the universe changed, the provider restated old closes, or the code or parameters changed. Each run says which. The same id means the same inputs.</p></div>
    </Fold>

    <Fold id="sources" title={'Sources and ages'} summary='Where each kind of figure comes from, when it was observed and how late it can be.'>
    <div className="card" style={{ padding: '2px 14px' }}><div className="scroll-x" tabIndex={0} role="region" aria-label="Sources and ages, scrolls sideways"><table className="tbl" style={{ width: '100%' }}><thead><tr><th scope="col">Figure</th><th scope="col">Source</th><th scope="col">Observed</th><th scope="col">Delay</th></tr></thead><tbody>
      <tr><td>Price quotes (Live, Delayed or Last traded): shares, indices, gold, currencies, Bitcoin</td><td>Yahoo Finance, through this app's Worker</td><td>The exchange's own print time, shown beside every live figure</td><td>Measured on each figure: the age of its latest print</td></tr>
      <tr><td>Screen, scores, trend, averages</td><td>Published daily screen, built from Yahoo Finance daily bars and annual statements</td><td>Close of {dayWord(u.asOf)}</td><td>{fr.word === 'Current' ? 'None: the last finished session' : `${fr.word}${fr.behind ? ` (${fr.behind})` : ''}`}</td></tr>
      <tr><td>Financial statements</td><td>Annual statements via Yahoo Finance</td><td>Latest fiscal year held per company (shown on its page)</td><td>Annual, months after a year ends</td></tr>
      <tr><td>Forward record and automatic book</td><td>Nightly job, daily bars via yfinance</td><td>{led.data?.ledger ? `Written ${fmtIst(Date.parse(led.data.ledger.updated) / 1000)}` : 'Not available'}</td><td>One night</td></tr>
      <tr><td>News</td><td>Google News and Bing News search feeds, RBI and SEBI release feeds; admitted only if a story names a covered company or an India-wide event</td><td>Each story carries its own publication time (published); the check has its own time (checked): {nh.state === 'loading' ? 'checking now' : nh.lastGood ? `last successful check ${nh.lastGood}` : 'no check has succeeded yet'}</td><td>{nh.word}{nh.next && nh.state === 'fresh' ? `, next check about ${nh.next}` : ''}; scheduled every 15 minutes in the NSE session, 30 otherwise. The scheduler is best effort and can start late: when it does the page says delayed, and may add stories refreshed on demand, labelled as such</td></tr></tbody></table></div></div>
    <p className="small mute" style={{ marginTop: 10 }}>Times are Indian Standard Time. A figure's age is measured from when it was printed, never from when this app last asked.</p>
    </Fold>

  </div>;
}
