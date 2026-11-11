import { PageBar, Head } from './common.tsx';
import { ENGINES } from '../quant.ts';
import { useBacktest, useJson, type ScreenFeed } from '../data.ts';
import { universeReport } from '../universe.ts';
import { BreadthGapText } from './gapnote.tsx';
import { engineEvidence } from '../evidence.ts';
import { CURRENT_RULES, rulesDef } from '../rules.ts';
import { TREND_RULE_TEXT } from '../screen.ts';
import { POLICY_FROM, STYLES, TARGETS_BACKFILL_ON } from '../exits.ts';
import { dayWord } from '../fmt.ts';
import { holidayStatement } from '../calendar.ts';
import { NO_FLAGS_SENTENCE, RISK_NAME, RISK_SCOPE } from '../eligibility.ts';
import { CaptureModule, IdentityFooter } from './capture.tsx';
import { Card, SectionHeader } from '../components/index.ts';
import { Fold } from './fold.tsx';

/** Methodology and evidence: the long explanations that used to sit inside cards, in one place, read from the same constants the app computes with
 *  (the engines' own rule text, the eligibility steps, the trend rule), so this page cannot drift from the screens that link to it. */
export function Methodology() {
  const bt = useBacktest(); const rules = rulesDef(CURRENT_RULES); const scr = useJson<ScreenFeed>('/data/screen.json'); const gap = scr.data ? universeReport(scr.data.rows, scr.data.as_of, scr.data.built_on).breadthGap : null;
  // 11 Nov 2026 (revamp v2): the paper-only statement was made three times at the top (a note said "no order" twice, then the summary's first line); it is made once, below.
  return <div className="mp read meth">
    <PageBar title="Methodology and evidence" onBack sub="How things are worked out, and what the tests found" />

    <section className="card sumcard" aria-labelledby="mt-glance" data-summary="methodology">
      <h2 id="mt-glance">At a glance</h2>
      <ul className="sumlist">
        <li><span className="sk-k">What this is</span><span className="sk-v">Paper-only, experimental research. Rules fire at the close and the evidence is shown on each side. It gives no advice and places no order; a pick is a starting point for your own research.</span></li>
        {ENGINES.filter((e) => !e.retired).map((e) => { const ev = engineEvidence(e.id, bt.data, bt.loading); return <li key={e.id} data-engine-summary={e.id}><span className="sk-k">{e.name}</span><span className={`sk-v${ev.tone === 'bad' ? ' bad' : ''}`}>{ev.word}: {ev.line}</span></li>; })}
        <li><span className="sk-k">Eligibility</span><span className="sk-v">Rule {rules.id}, {rules.steps.length} steps in order. A night keeps the rules it was filed under.</span></li>
        <li><span className="sk-k">How to read a rank</span><span className="sk-v">A position among eligible names, not a chance of winning. A name with no flags is not a name with no risks.</span></li>
      </ul>
      <p className="small mute" style={{ margin: 0 }}>Every rule, test result and limitation is in the sections below, including the engines whose tests did not support them. Open a heading for its detail.</p>
    </section>

    <Fold id="engines" title="Engines and what the tests found" summary={`${ENGINES.filter((e) => !e.retired).length} engines. Each one's rules, the idea it comes from, and the evidence now: supported, not supported or not yet tested.`}>
    {ENGINES.filter((e) => !e.retired).map((e) => { const ev = engineEvidence(e.id, bt.data, bt.loading);
      return <details key={e.id} className="ev"><summary><span className="grow"><span className="k" style={{ display: 'block' }}>{e.line}</span><b>{e.name}</b></span><span className={`tag ${ev.tone === 'bad' ? 'peach' : ev.state === 'supported' ? 'lime' : ''}`}>{ev.word}</span><span className="chev">▾</span></summary>
        <div className="body small"><p style={{ margin: '0 0 6px' }}><b>Evidence now:</b> {ev.line}</p>
          <ul style={{ margin: '0 0 6px', paddingLeft: 18 }}>{e.how.map((h) => <li key={h} style={{ marginBottom: 4 }}>{h}</li>)}</ul>
          <p className="mute" style={{ margin: 0 }}>Idea from: {e.theory}. A published idea is not evidence that it works here; the back-test and the forward record are.</p></div></details>; })}
    {ENGINES.some((e) => e.retired) && <p className="small mute" style={{ margin: '8px 0 0' }}>Retired: {ENGINES.filter((e) => e.retired).map((e) => `${e.name} (${e.retired})`).join(', ')}. Its past record stays on file.</p>}
    </Fold>

    <SectionHeader title="Who is eligible" description="The steps a company passes, in order, before an engine may pick it." />
    <Card className="small"><p style={{ margin: '0 0 6px' }}>{rules.summary}</p>
      <ol className="rulecards">{rules.steps.map((x, i) => <li key={x.id}><span className="n num" aria-hidden="true">{i + 1}</span><span>{x.label}</span></li>)}</ol>
      <p className="mute" style={{ margin: '8px 0 0' }}>Rule version {rules.id}. A night keeps the rules it was filed under; older nights are not re-judged.</p></Card>

    <Fold id="trend" title="Trend" summary='How uptrend, downtrend and sideways are defined. A trend describes the past and forecasts nothing.'>
    <div className="card small"><p style={{ margin: '0 0 6px' }}><b>Uptrend:</b> {TREND_RULE_TEXT.up}.</p><p style={{ margin: '0 0 6px' }}><b>Downtrend:</b> {TREND_RULE_TEXT.down}.</p><p style={{ margin: 0 }}><b>Sideways:</b> {TREND_RULE_TEXT.mixed}. A trend describes the past and forecasts nothing.</p>
      {gap && <p className="mute" style={{ margin: '8px 0 0' }}><b>Why the trend map has fewer names than the screen.</b> <BreadthGapText g={gap} /> <a href="#/data" style={{ textDecoration: 'underline' }}>Sector by sector, on the Data screen</a>.</p>}</div>
    </Fold>

    <Fold id="booking" title="Profit booking, targets and R" summary='Two targets per holding period as multiples of the risk taken, the same-bar rule, and the arithmetic written out.'>
    <div className="card small"><p style={{ margin: '0 0 6px' }}>A position's holding period sets its two targets, in multiples of its risk: {STYLES.map((x) => `${x.label.toLowerCase()} (${x.sessions}) ${x.t1}R and ${x.t2}R`).join('; ')}. At Target 1 half the shares are sold and the stop on the rest moves up to the fill; at Target 2 the rest is sold. The stop and the time limit still end whatever is left. These multiples were chosen, not tested: the back-test never used targets.</p>
      <p style={{ margin: '0 0 6px' }}><b>Same bar.</b> A daily bar does not say which price came first, so if one bar's high reaches both targets but it opened below Target 2, only Target 1 books on that bar and Target 2 can book from the next bar on; a bar that opens at or above Target 2 books both at the open. The stop is tested before either target.</p>
      <p style={{ margin: '0 0 6px' }}><b>R</b> is the risk actually taken, the fill (the next session's open plus slippage) minus the stop; every target, progress marker and R figure for a position that has entered is measured from that fill, and a level shown before a pick has entered is worked from its signal close and says "at signal close".</p>
      <p style={{ margin: 0 }}><b>Note, {dayWord(TARGETS_BACKFILL_ON)} {TARGETS_BACKFILL_ON.slice(0, 4)}:</b> the ladder began with the picks filed on {dayWord(POLICY_FROM)}. On {dayWord(TARGETS_BACKFILL_ON)} it was applied, retroactively, to every earlier pick that was still open or waiting to enter, replayed bar by bar from its entry, so a target already crossed is booked on the day and at the price it filled. No multiple, engine rule or threshold changed. A position that had already closed under the old stop-and-time rule was not re-evaluated, and its target levels, where shown, are marked "reference only — predates target tracking".</p></div>

    <Card className="small" aria-label="The target arithmetic, written out">
      <p style={{ margin: '0 0 8px' }}><b>The arithmetic, in one block.</b> R is the risk taken; each target is a multiple of it, above the fill.</p>
      <pre className="formula" tabIndex={0}>{`R         = fill - stop\n` + STYLES.map((x) => `${x.label.padEnd(9)} T1 = fill + ${x.t1} x R   T2 = fill + ${x.t2} x R   (${x.sessions})`).join('\n')}</pre>
      <p className="mute" style={{ margin: '8px 0 0' }}>In words: Target 1 sits {STYLES.map((x) => `${x.t1} times the risk above the fill for ${x.label.toLowerCase()}`).join(', ')}. Half is booked there; the rest exits at Target 2 or at its stop. All paper.</p></Card>
    </Fold>

    <Fold id="flags" title="What the screen's flag level measures" summary='A count of warning flags, not a safety rating. It does not read the price trend.' open>
    <div className="card small"><p style={{ margin: '0 0 6px' }} data-risk-scope><b>{RISK_NAME}</b> (the published LOW, MEDIUM or HIGH) is a count of warning flags, not a safety rating. {RISK_SCOPE.replace('Scope: this counts', 'It counts')}</p>
      <p style={{ margin: 0 }}>{NO_FLAGS_SENTENCE} A name can be LOW and still be in a downtrend or well below its high: in the 26 Oct screen 187 of the 290 LOW names were under their 200-day average.</p></div>
    </Fold>

    <Fold id="holidays" title="Exchange holidays and price labels" summary='One holiday statement; a price is Live only while the market is open and the print is under five minutes old.' open>
    <div className="card small"><p style={{ margin: '0 0 6px' }} data-holiday>{holidayStatement()}</p>
      <p style={{ margin: 0 }}>A price is called Live only when the market is open and the exchange printed it under five minutes ago. Older while the market is open is Delayed; once the market is shut it is Last traded. Fetch time decides none of this.</p></div>
    </Fold>

    <Fold id="charts" title="Prices and charts" summary='Daily closes, adjusted for splits and bonuses and not for dividends; what an event marker means.'>
    <div className="card small"><p style={{ margin: '0 0 6px' }}>Charts draw daily closes from Yahoo Finance, adjusted for splits and bonuses and not for dividends. Candles, volume and RSI use whole bars; when too many daily bars would be unreadable the chart draws weekly or monthly bars and says so, because thinning days would misstate each one.</p>
      <p style={{ margin: '0 0 6px' }}>The Nifty line is the index price without dividends, like the stock; both are indexed to 100 on the first day the Nifty is held. A live price is a separate print and never moves the chart.</p>
      <p style={{ margin: 0 }}>Events are drawn only from dates the data holds. Today that is the results date the data provider lists; dividend, split and announcement dates are not held, so none are marked.</p></div>
    </Fold>

    <Fold id="holding" title="Shareholding" summary='How promoter, public, foreign and domestic figures are drawn, and which lines are worked out.'>
    <div className="card small"><p style={{ margin: 0 }}>The provider gives promoter, public, foreign, domestic, mutual-fund and insurer figures. They are drawn nested (institutions inside public, mutual funds inside domestic institutions) only for a company whose own figures add up that way; otherwise they are shown flat with a note that the groups may overlap. Lines marked "worked out" are subtractions, not reported numbers.</p></div>
    </Fold>

    <Head>More</Head>
    <nav className="mp-links" aria-label="Related pages"><a href="#/data">Data and coverage<small>What is in the screen and how old each figure is</small></a><a href="#/help">How to use Tripwire<small>The path through the app</small></a></nav>
    <div className="t-capture"><CaptureModule source="tripwire-methodology" /></div>
    <IdentityFooter />
  </div>;
}
