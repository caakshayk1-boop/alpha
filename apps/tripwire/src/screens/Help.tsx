import { PageBar, Head } from './common.tsx';
import { IdentityFooter } from './capture.tsx';
import { holidayStatement } from '../calendar.ts';
import { Fold, Workflow } from './fold.tsx';

/** How to use Tripwire: the path through the app, and where things are kept. Only what the app does today. */
export function Help() {
  const step = (n: number, t: string, body: string) => <li key={n} style={{ marginBottom: 10 }}><b>{t}.</b> {body}</li>;
  return <div className="read">
    <PageBar title="How to use Tripwire" onBack sub="A paper-only research workspace" />
    <div className="card small"><p style={{ margin: 0 }}>Tripwire shows which public rules fired at the last close and the evidence on each side. Everything is paper: no order is placed, and your notes stay on this device.</p></div>
    <Workflow />
    <Fold id="session" title="A first session, step by step" summary="Five steps from Today to a paper plan." open>
    <div className="card"><ol className="small helpsteps">
      {step(1, 'Read Today', 'It shows how old the data is, the market read, the picks from the last close, and what changed in the names you follow.')}
      {step(2, 'Find a company', 'Discover filters about a thousand companies by trend, RSI, valuation and size; the search button (or Ctrl or Cmd + K) finds one by name.')}
      {step(3, 'Read its page', 'The top of a company page is the 30-second read: price and its time, what changed, the strongest support and counterargument, the evidence status and the invalidation. Calculations sit behind the controls below.')}
      {step(4, 'Write a thesis', 'Say why, what would prove you wrong, and when to look again. The review date appears on Today when it is due.')}
      {step(5, 'Size a paper plan', 'The planner sizes a position against your own limits on paper and says its entry assumption.')}
    </ol></div>
    </Fold>
    <Fold id="kept" title="Where things are kept" summary="In this browser only. Back up from Settings.">
    <div className="card small"><p style={{ margin: '0 0 6px' }}>Follows, theses, plans and the journal live in this browser only. Clearing site data erases them, so export a backup from Settings now and then.</p><p style={{ margin: 0 }}>The screen lock in Settings stops casual opening on a phone that supports it; it does not encrypt anything.</p></div>
    </Fold>
    <Fold id="labels" title="Reading the labels" summary="Experimental, Old data, a dash, and the four price words: Live, Delayed, Last traded, Unavailable.">
    <div className="card small"><ul style={{ margin: 0, paddingLeft: 18 }}>
      <li style={{ marginBottom: 6 }}><b>Experimental:</b> the engine behind a pick has not passed its tests. Treat a pick as an experiment.</li>
      <li style={{ marginBottom: 6 }}><b>Old data / behind:</b> the figures are from an earlier session than the last finished one.</li>
      <li style={{ marginBottom: 6 }}><b>A dash:</b> the figure is not available. It is never a zero.</li>
      <li style={{ marginBottom: 6 }}><b>Live, Delayed, Last traded, Unavailable:</b> the four words for a price. Live is a print under five minutes old while the market is open. Delayed is an older print while the market is open. Last traded is the last print once the market is shut (evenings, weekends, exchange holidays), however recent. Unavailable means no print time could be read. The word comes from the exchange's own print time and the session, never from when this app last asked.</li>
      <li><b>Live and close:</b> a live price is a separate print; screening and filters read the close.</li></ul></div>
    </Fold>
    <Fold id="holidays" title="Exchange holidays" summary="One statement, from the exchange calendar the app uses." open>
    <div className="card small"><p style={{ margin: 0 }} data-holiday>{holidayStatement()}</p></div>
    </Fold>
    <Head>More</Head>
    <div className="card"><div className="list"><a className="li" href="#/methodology"><span className="grow">Methodology and evidence</span></a><a className="li" href="#/data"><span className="grow">Data and coverage</span></a><a className="li" href="#/settings"><span className="grow">Settings and backup</span></a></div></div>
    <IdentityFooter />
  </div>;
}
