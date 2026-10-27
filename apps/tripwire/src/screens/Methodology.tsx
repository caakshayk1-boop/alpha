import { PageBar, Head } from './common.tsx';
import { ENGINES } from '../quant.ts';
import { useBacktest } from '../data.ts';
import { engineEvidence } from '../evidence.ts';
import { CURRENT_RULES, rulesDef } from '../rules.ts';
import { TREND_RULE_TEXT } from '../screen.ts';

/** Methodology and evidence: the long explanations that used to sit inside cards, in one place, read from the same constants the app computes with
 *  (the engines' own rule text, the eligibility steps, the trend rule), so this page cannot drift from the screens that link to it. */
export function Methodology() {
  const bt = useBacktest(); const rules = rulesDef(CURRENT_RULES);
  return <div>
    <PageBar title="Methodology and evidence" onBack sub="How things are worked out, and what the tests found" />
    <div className="note info"><b>Paper only, and experimental.</b> Nothing here is advice and no order is ever placed. A pick is a starting point for your own research; a rank is a position among eligible names, not a chance of winning.</div>

    <Head>Engines</Head>
    {ENGINES.filter((e) => !e.retired).map((e) => { const ev = engineEvidence(e.id, bt.data, bt.loading);
      return <details key={e.id} className="ev" open><summary><span className="grow"><span className="k" style={{ display: 'block' }}>{e.line}</span><b>{e.name}</b></span><span className={`tag ${ev.tone === 'bad' ? 'peach' : ev.state === 'supported' ? 'lime' : ''}`}>{ev.word}</span><span className="chev">▾</span></summary>
        <div className="body small"><p style={{ margin: '0 0 6px' }}><b>Evidence now:</b> {ev.line}</p>
          <ul style={{ margin: '0 0 6px', paddingLeft: 18 }}>{e.how.map((h) => <li key={h} style={{ marginBottom: 4 }}>{h}</li>)}</ul>
          <p className="mute" style={{ margin: 0 }}>Idea from: {e.theory}. A published idea is not evidence that it works here; the back-test and the forward record are.</p></div></details>; })}
    {ENGINES.some((e) => e.retired) && <p className="small mute" style={{ margin: '8px 0 0' }}>Retired: {ENGINES.filter((e) => e.retired).map((e) => `${e.name} (${e.retired})`).join(', ')}. Its past record stays on file.</p>}

    <Head>Who is eligible</Head>
    <div className="card small"><p style={{ margin: '0 0 6px' }}>{rules.summary}</p><ul style={{ margin: 0, paddingLeft: 18 }}>{rules.steps.map((x) => <li key={x.id}>{x.label}</li>)}</ul>
      <p className="mute" style={{ margin: '8px 0 0' }}>Rule version {rules.id}. A night keeps the rules it was filed under; older nights are not re-judged.</p></div>

    <Head>Trend</Head>
    <div className="card small"><p style={{ margin: '0 0 6px' }}><b>Uptrend:</b> {TREND_RULE_TEXT.up}.</p><p style={{ margin: '0 0 6px' }}><b>Downtrend:</b> {TREND_RULE_TEXT.down}.</p><p style={{ margin: 0 }}><b>Sideways:</b> {TREND_RULE_TEXT.mixed}. A trend describes the past and forecasts nothing.</p></div>

    <Head>Prices and charts</Head>
    <div className="card small"><p style={{ margin: '0 0 6px' }}>Charts draw daily closes from Yahoo Finance, adjusted for splits and bonuses and not for dividends. Candles, volume and RSI use whole bars; when too many daily bars would be unreadable the chart draws weekly or monthly bars and says so, because thinning days would misstate each one.</p>
      <p style={{ margin: '0 0 6px' }}>The Nifty line is the index price without dividends, like the stock; both are indexed to 100 on the first day the Nifty is held. A live price is a separate print and never moves the chart.</p>
      <p style={{ margin: 0 }}>Events are drawn only from dates the data holds. Today that is the results date the data provider lists; dividend, split and announcement dates are not held, so none are marked.</p></div>

    <Head>Shareholding</Head>
    <div className="card small"><p style={{ margin: 0 }}>The provider gives promoter, public, foreign, domestic, mutual-fund and insurer figures. They are drawn nested (institutions inside public, mutual funds inside domestic institutions) only for a company whose own figures add up that way; otherwise they are shown flat with a note that the groups may overlap. Lines marked "worked out" are subtractions, not reported numbers.</p></div>

    <Head>More</Head>
    <div className="card"><div className="list"><a className="li" href="#/data"><span className="grow">Data and coverage<span className="small dim" style={{ display: 'block' }}>What is in the screen and how old each figure is</span></span></a><a className="li" href="#/help"><span className="grow">How to use Tripwire</span></a></div></div>
  </div>;
}
