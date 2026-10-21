'use client';

import type { ReactNode } from 'react';
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
  ['Engines', 'Daily prices from Yahoo Finance for the screened stocks: dividend-adjusted to train the models, traded prices for every plan and mark', 'Signals refresh after each close'],
  ['Weekly reads', 'Screen figures, written up by a language model and labelled as such', 'Saturdays'],
];

// Only the datasets this site actually reads; the health feed also tracks other products.
const SHOWN = new Set(['Stock screen', 'Markets', 'Market Intelligence', 'Fund screen', 'New listings', 'World news']);

/** Every explanation the site needs lives here, one anchored section per page, so the pages themselves carry only data.
 *  Each page's header links to its section (PageHead `method`). Text states rules and limits; it never repeats a figure. */
const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  { id: 'prices', title: 'Prices: which one you see', body: <>
    <p>Every stock price is the exchange&apos;s own traded price, the one a broker or TradingView shows. Three sources can price a stock: the live snapshot of the whole screen, a per-stock quote, and the evening screen close. The newer session wins; on the same session the traded price wins.</p>
    <p>The screen close is <b>dividend-adjusted</b> by its source, so on any stock with a recent or upcoming ex-date it reads lower than the exchange (MRPL, 19 Oct 2026: 170.72 in the screen against 173.72 traded, a ₹3 dividend). Prices shown are the traded ones; the screen&apos;s averages, 52-week range and levels are still computed on adjusted closes and can sit a few percent off on such stocks.</p>
    <p>Labels: <i>live HH:MM IST</i> only inside NSE hours with a trade in the last 15 minutes; <i>last trade</i> for a quieter same-day trade; otherwise the session&apos;s <i>close</i>. A stock with no trade in the current session shows its last trade date and no day move. A one-day move beyond NSE&apos;s 20% band is flagged: it usually means a corporate action or a wrong previous close in the source.</p>
  </> },
  { id: 'trades', title: 'Trades: how the paper book is marked', body: <>
    <p>Alpha places no order. Each engine signal is a plan written once at issue: entry at the next session&apos;s open, a stop, three targets and a time limit. The evening run (18:00, 20:00 and 22:30 IST) walks every plan through the day&apos;s full high and low and books what happened. The Trades page applies the same rules to the latest price between runs.</p>
    <p><b>Marked R</b> = (thirds already sold at their booked prices + the rest at the latest price − entry) ÷ the risk at entry. <b>Today</b> is the marked R minus the R at the previous close; a trade entered at today&apos;s open counts from its entry. Rupee figures are R × the risk per trade you enter (kept in this browser). The day curve redraws the same sum on every five-minute bar of the session. Marks are before costs.</p>
    <p><b>Decisions for the next session:</b> <i>Enter</i>: a new signal, bought at the next open unless that open is past T1 or at/below the stop. <i>Exit</i>: the stop, T3 or the time limit is reached. <i>Modify</i>: a target is reached (sell a third, move the stop up) or the evening run booked one today (move the stop). <i>Hold</i>: no level reached. During market hours they are provisional; after the 15:30 close they are final until the evening run books them.</p>
  </> },
  { id: 'engines', title: 'Engines: how they are tested', body: <>
    <p>Five machine-learning models rank every screened stock each evening from 58 measures; the top ranks become signals. Each model is judged twice. <b>Ranking skill</b> (information coefficient): the daily correlation between the ranking and each stock&apos;s return beyond the market median over the model&apos;s horizon; 0 is a coin flip, a few hundredths sustained is meaningful. <b>Net trading result</b>: every trade enters at the next open, follows the exit plan and pays the round-trip cost, compared with random liquid stocks on the same days with the same stop-and-target geometry. Phone alerts need both.</p>
    <p>Every prediction comes from a model trained only on data fully known at the time (walk-forward, refit quarterly, with a gap equal to the horizon). The design and pass marks were fixed before the holdout was read, and it was read once. R is the amount risked: +1R made what the stop would have lost. The month-clustered t treats each month as one observation because trades overlap; between −2 and +2 is indistinguishable from luck. Feature influence is the skill lost when an input is scrambled: influence, not cause. Each stock is also read against its own group benchmark: in an uptrend when above a rising 50-day average, leading when ahead of the Nifty over three months.</p>
    <p><b>Limits.</b> Survivorship: the universe is today&apos;s listed companies, which flatters small or beaten-down picks (the most-traded-300 rows are the check). One holdout look is one sample, not proof. Thin stocks fill worse than the assumed cost. Overlapping trades are not independent. A forward record began at launch and is the only number that cannot have been fitted to the past.</p>
  </> },
  { id: 'today', title: 'Today and the Barometer', body: <>
    <p>The day&apos;s figures (breadth, sector medians, movers) come from whichever source describes the newer session: the live snapshot of ~990 stocks, or the evening screen; on a tie the screen. Stocks with no trade this session are left out and counted. The Barometer (0 to 100) combines index trend, the share above the 200-day average, the day&apos;s participation, the VIX and new highs; it is recomputed live from the same inputs as the published reading. The 200-day share is a close figure.</p>
  </> },
  { id: 'brief', title: 'Brief', body: <p>The written read of the day, copyable as text, plus what no other page shows: the valuation stage, the week&apos;s biggest moves, composite rank changes since the previous build, and the seasonal record (vetted names up in at least 75% of the last 8+ years in this month; a calendar month has no causal pull on a price). Telegram copies go out at 08:00 and 20:00 MYT on weekdays.</p> },
  { id: 'markets', title: 'Markets', body: <p>Indices, sectors, commodities (futures), currencies and rates from Yahoo Finance, refreshed every minute while open (the source caches up to five minutes). Markets keep different hours, so each quote shows its own last-trade time. Some NSE sector indices have only one bar on Yahoo; their charts say so.</p> },
  { id: 'screen', title: 'Screen', body: <p>Scores run 0 to 100 as percentiles within the screen&apos;s universe; 50 is the median company, not a neutral rating. The composite weights quality 35%, growth 25%, technical 25% and valuation 15%. A missing figure never passes a filter and sorts last. Size classes come from the screen&apos;s own list, not from the market cap shown. Plain-language search uses fixed rules, not a chatbot: every recognised clause is a chip you can switch off and every ignored word is listed.</p> },
  { id: 'map', title: 'Map', body: <p>Each tile is a stock, sized by value or trading and coloured by the measure you pick. Outlier mode colours a stock by its move against its own sector. Colour is never the only signal: the same values are listed beside the map.</p> },
  { id: 'rotation', title: 'Rotation', body: <p>Each group&apos;s weekly index is divided by the Nifty. RS-Ratio is that strength against its own 13-week average (100 = in line); RS-Momentum is 100 plus the 4-week change in a 3-week average of RS-Ratio. Only Nifty IT, Pharma and Bank are NSE indices; every other group is an equal-weighted index of its screened stocks, because Yahoo holds no history for the others. A close cousin of the RRG, not the licensed JdK formula. It describes relative prices, not money flows, and groups do not move through the quadrants in a fixed order.</p> },
  { id: 'confluence', title: 'Where several checks agree', body: <p>Liquid names (₹5 crore a day or more) ranked by the share of applicable checks they pass out of nine fundamental and trend checks, plus engine picks (full weight for engines that clear the alert bar, half for the rest), a Magic Formula top-100 place and a screen class with a case, minus a penalty for high risk flags. A name needs enough applicable checks to be ranked, so missing data cannot flatter it.</p> },
  { id: 'company', title: 'Company pages', body: <p>The nine checks are fixed rules applied to the figures on the page; nothing is generated or forecast. Look-alikes are nearest neighbours across the whole screen on quality, growth, value, trend, 3-month strength, ROCE, net margin and leverage, each standardised; a similar profile is not a similar future. The chart&apos;s key line is a 3-ATR trailing line that flips on a close through it: it reads the trend, it does not predict it.</p> },
  { id: 'ipo', title: 'IPO', body: <p>The live NSE subscription book where an issue is open, the issues about to open, and how recent listings have traded since.</p> },
  { id: 'funds', title: 'Funds', body: <p>Per category, the three direct-plan funds with the highest 3-year return, with their worst fall, monthly volatility and holdings. Lump-sum returns from AMFI&apos;s official NAV history, not SIP returns.</p> },
  { id: 'news', title: 'News', body: <p>Stories come from the publishers&apos; own feeds and the summaries are theirs. Themes are matched on words; a company is linked only when its ticker or full name is in the story. Nothing is scored or ranked. Read, saved and last-visit marks stay in this browser.</p> },
  { id: 'reads', title: 'Weekly reads', body: <p>Seven companies from one sector each Saturday. Figures come from the screen; the prose is written by a language model from those figures and checked automatically for arithmetic and names only. Business descriptions are the model&apos;s general knowledge. Figures are as at publication.</p> },
  { id: 'calendar', title: 'Calendar', body: <p>The next results date on file for each screened company. The feed does not say whether a date is confirmed or estimated, so treat each as provisional until the exchange&apos;s board-meeting announcement.</p> },
  { id: 'tools', title: 'Tools', body: <p>Arithmetic you can check line by line, run in this browser. Portfolio X-ray uses live prices where available and value-weighted screen ratios; it ignores tax and costs. The implied-growth tool solves for the earnings growth today&apos;s price needs (EPS = price ÷ trailing P/E, one growth stage then a terminal rate); it ignores capex, working capital, dilution and margins, and a P/E from a one-off year distorts it. Streak odds assume independent trades.</p> },
  { id: 'compare', title: 'Compare', body: <p>Up to four companies in one table, with the highest or lowest marked where that is meaningful, and score profiles on one scale.</p> },
  { id: 'watchlist', title: 'Watchlist', body: <p>Kept in this browser&apos;s storage only: private, and gone if you clear site data. Flags show an upcoming results date or a live engine signal. A Research Card is one question with the figures as they were when saved.</p> },
  { id: 'journal', title: 'Journal', body: <p>Stored in this browser only. Move and R compare the price now with the price you wrote down, for a long idea; only the price now is checked, so a stop or target touched in between is not seen. The averages describe your habits, not any stock, and a handful of entries says little.</p> },
];

export default function About() {
  const h = useFeed('data-health');
  const eng = useEngines();
  const closed = eng.data ? Object.values(eng.data.live_record).reduce((a, r) => a + r.closed, 0) : null;
  return (
    <>
      <PageHead eyebrow="Method and sources" title="How every number" em="is made." />
      <section className="wrap">
        <nav className="mtoc" aria-label="Method sections">
          {SECTIONS.map((x) => <a key={x.id} href={`#${x.id}`}>{x.title.split(':')[0]}</a>)}
          <a href="#sources">Sources</a><a href="#data-dates">Data dates</a><a href="#measures">Measures</a>
        </nav>
        <Rv className="panel tight">
          <div className="eyebrow">What this is not</div>
          <ul className="muted mlist">
            <li>Research tools, not advice, and not a recommendation to buy or sell anything. Alpha places no order.</li>
            <li>Every engine is shown with how it tested on data it never saw, against random stocks, including when it did not beat them. A forward record began on {eng.data?.launched ? dateLabel(eng.data.launched) : 'launch day'}{closed === null ? '' : closed === 0 ? '; none of its trades has closed yet' : `; ${closed} trades have closed, too few to conclude anything`}.</li>
            <li>Where a figure cannot be computed it shows a dash, never an estimate.</li>
          </ul>
        </Rv>
      </section>
      <section className="wrap mgrid">
        {SECTIONS.map((x) => (
          <article key={x.id} id={x.id} className="panel tight msec">
            <h2>{x.title}</h2>
            {x.body}
            {x.id === 'trades' && eng.data && <ol className="muted mlist">{eng.data.exit_plan.map((l) => <li key={l}>{l}</li>)}</ol>}
          </article>
        ))}
      </section>
      <section className="wrap section" id="sources">
        <Rv className="panel tight">
          <div className="eyebrow">Sources</div>
          <div className="list">{SOURCES.map(([a, b, c]) => <div className="li" key={a}><div><div className="t">{a}</div><div className="s">{b}</div></div><span className="dim" style={{ fontSize: 13.5, textAlign: 'right' }}>{c}</span></div>)}</div>
        </Rv>
      </section>
      <section className="wrap section">
        <Rv className="panel tight">
          <div className="eyebrow" id="data-dates">Data dates: which session each dataset describes</div>
          <p className="muted" style={{ fontSize: 14, margin: '6px 0 10px' }}>&ldquo;Describes&rdquo; is the session or week the values are about; &ldquo;last refreshed&rdquo; is when the source last updated. A daily dataset is judged against the last weekday before today in India, with a few hours of grace. Weekends never count as late; just after an exchange holiday a dataset can read one session behind.</p>
          <DataStatusTable />
        </Rv>
      </section>
      <section className="wrap section" id="measures">
        <h2 className="disp" style={{ fontSize: 28, margin: '0 0 10px' }}>What each measure means</h2>
        <MetricGlossary />
      </section>
      <section className="wrap section">
        <Rv className="panel tight">
          <div className="eyebrow">Pipeline jobs: when each last ran</div>
          <p className="muted" style={{ fontSize: 14, margin: '6px 0 10px' }}>Whether a job ran on schedule, not whether its data is current: use the data dates above for that.</p>
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
