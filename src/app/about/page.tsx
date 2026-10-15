'use client';

import { Async, PageHead, Rv } from '@/components/ui';
import { DataStatusTable } from '@/components/DataStamp';
import MetricGlossary from '@/components/MetricGlossary';
import { useEngines, useFeed } from '@/lib/data';
import { ago, dateLabel } from '@/lib/format';

const SOURCES: [string, string, string][] = [
  ['Prices, fundamentals, scores', 'Yahoo Finance prices and company statements, scored by the screen', 'Nearly 1,000 companies, rebuilt each evening'],
  ['Live board', 'Yahoo Finance', 'Cached up to 5 minutes; futures for commodities'],
  ['Shareholding', 'NSE shareholding patterns (SEBI SHP XBRL)', 'Quarterly'],
  ['IPOs', 'NSE and public issue data', 'Daily'],
  ['Funds', 'AMFI official NAV via mfapi.in', 'Daily; direct plans only'],
  ['News', 'Publisher RSS feeds', 'Several times a day'],
  ['Engines', 'Daily prices from Yahoo Finance for the screened stocks, tested with realistic exits and costs', 'Signals refresh after each close'],
  ['Weekly reads', 'Screen figures, written up by a language model and labelled as such', 'Saturdays'],
];

// Only the datasets this site actually reads; the health feed also tracks other products.
const SHOWN = new Set(['Stock screen', 'Markets', 'Market Intelligence', 'Fund screen', 'New listings', 'World news']);

export default function About() {
  const h = useFeed('data-health');
  const eng = useEngines();
  const closed = eng.data ? Object.values(eng.data.live_record).reduce((a, r) => a + r.closed, 0) : null;
  return (
    <>
      <PageHead eyebrow="Method and sources" title="How every number" em="is made." lede="The point of this desk is that you can check it. Here is where each dataset comes from, how fresh it is right now, and what it deliberately does not do." />
      <section className="wrap grid g2" style={{ alignItems: 'start' }}>
        <Rv className="panel">
          <div className="eyebrow">What this is not</div>
          <ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li>The engines are machine-learning models that rank stocks and name a stop and three targets for the top picks. They are research tools, not advice, and not a recommendation to buy or sell anything.</li>
            <li>Every engine is shown with how it tested on data it never saw, against randomly chosen stocks, including when the answer is that it did not beat them. The survivorship bias of testing on today&apos;s listed companies is stated on the engines page, not hidden.</li>
            <li>The engines&apos; evidence is a test on past prices, which can overstate what happens next. A forward record began on {eng.data?.launched ? dateLabel(eng.data.launched) : 'launch day'}: every signal issued since is tracked to its exit and shown on the Engines page. {closed === null ? '' : closed === 0 ? 'None of those trades has closed yet, so the forward record proves nothing yet.' : `${closed} have closed so far, too few to conclude anything.`} There is no paper-trading book.</li>
            <li>Where a figure cannot be computed it shows a dash, never an estimate.</li>
          </ul>
        </Rv>
        <Rv className="panel">
          <div className="eyebrow">Sources</div>
          <div className="list">{SOURCES.map(([a, b, c]) => <div className="li" key={a}><div><div className="t">{a}</div><div className="s">{b}</div></div><span className="dim" style={{ fontSize: 13.5, textAlign: 'right' }}>{c}</span></div>)}</div>
        </Rv>
      </section>
      <section className="wrap section">
        <Rv className="panel">
          <div className="eyebrow" id="data-dates">Data dates: which session each dataset describes</div>
          <p className="muted" style={{ fontSize: 14.5, margin: '8px 0 14px' }}>&ldquo;Describes&rdquo; is the market session or week the values are about; &ldquo;last refreshed&rdquo; is when the source last updated successfully. They are different things and are never merged. A daily dataset is judged against the session Alpha should already hold: the last weekday before today in India, with a few hours of grace so the morning build counts as on time. The rotation graph is rebuilt every weekday and its newest weekly point is the week still in progress, so it is judged like the others, against the day its data actually runs to. Weekends never count as late. Alpha holds no exchange-holiday calendar, so just after a holiday a dataset can read one session behind until the next trading day, and a notice appears on every page whenever any dataset is behind.</p>
          <DataStatusTable />
        </Rv>
      </section>
      <section className="wrap section" id="measures">
        <h2 className="disp" style={{ fontSize: 34, margin: '0 0 6px' }}>What each measure means</h2>
        <p className="muted" style={{ margin: '0 0 16px', maxWidth: '70ch' }}>Standard definitions of the figures on a company page, with what to watch out for. Open any label under Key numbers on a company page and you land on the same text.</p>
        <MetricGlossary />
      </section>
      <section className="wrap section">
        <Rv className="panel">
          <div className="eyebrow">Pipeline jobs: when each last ran</div>
          <p className="muted" style={{ fontSize: 14.5, margin: '8px 0 14px' }}>This table says whether a job ran on schedule. It does not say the market data is current: a feed can be fetched successfully and still describe an earlier session. Use the data dates above for what each dataset describes.</p>
          <Async loading={h.loading} error={h.error} rows={3}>
            <div className="list">
              {h.data?.datasets.filter((d) => SHOWN.has(d.dataset)).map((d) => (
                <div className="li" key={d.dataset}>
                  <div><div className="t">{d.dataset}</div><div className="s">{d.source}</div></div>
                  <div style={{ textAlign: 'right' }}><span className={`tag ${/^(FRESH|LIVE)$/.test(d.status) ? 'up' : 'warn'}`}>{/^(FRESH|LIVE)$/.test(d.status) ? 'JOB RAN OK' : d.status}</span><div className="s">last ran {ago(d.last_successful_update)}</div></div>
                </div>
              ))}
            </div>
          </Async>
        </Rv>
      </section>
    </>
  );
}
