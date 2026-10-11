'use client';

import { Async, PageHead, Rv } from '@/components/ui';
import { useFeed } from '@/lib/data';

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
  return (
    <>
      <PageHead eyebrow="Method and sources" title="How every number" em="is made." lede="The point of this desk is that you can check it. Here is where each dataset comes from, how fresh it is right now, and what it deliberately does not do." />
      <section className="wrap grid g2" style={{ alignItems: 'start' }}>
        <Rv className="panel">
          <div className="eyebrow">What this is not</div>
          <ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li>The engines are machine-learning models that rank stocks and name a stop and three targets for the top picks. They are research tools, not advice, and not a recommendation to buy or sell anything.</li>
            <li>Every engine is shown with how it tested on data it never saw, against randomly chosen stocks, including when the answer is that it did not beat them. The survivorship bias of testing on today&apos;s listed companies is stated on the engines page, not hidden.</li>
            <li>There is no live track record and no paper-trading book. The record is a test on past prices, which can overstate what happens next.</li>
            <li>Where a figure cannot be computed it shows a dash, never an estimate.</li>
          </ul>
        </Rv>
        <Rv className="panel">
          <div className="eyebrow">Sources</div>
          <div className="list">{SOURCES.map(([a, b, c]) => <div className="li" key={a}><div><div className="t">{a}</div><div className="s">{b}</div></div><span className="dim" style={{ fontSize: 12.5, textAlign: 'right' }}>{c}</span></div>)}</div>
        </Rv>
      </section>
      <section className="wrap section">
        <Rv className="panel">
          <div className="eyebrow">Data health, right now</div>
          <Async loading={h.loading} error={h.error} rows={3}>
            <div className="list">
              {h.data?.datasets.filter((d) => SHOWN.has(d.dataset)).map((d) => (
                <div className="li" key={d.dataset}>
                  <div><div className="t">{d.dataset}</div><div className="s">{d.source}</div></div>
                  <div style={{ textAlign: 'right' }}><span className={`tag ${d.status === 'FRESH' ? 'up' : 'warn'}`}>{d.status}</span><div className="s">{d.freshness_age}</div></div>
                </div>
              ))}
            </div>
          </Async>
        </Rv>
      </section>
    </>
  );
}
