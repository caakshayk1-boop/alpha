'use client';

import type { ReactNode } from 'react';
import { Async, PageHead, Rv } from '@/components/ui';
import { DataStatusTable } from '@/components/DataStamp';
import MetricGlossary from '@/components/MetricGlossary';
import { useSignals, useFeed } from '@/lib/data';
import { ago, dateLabel } from '@/lib/format';

const SOURCES: [string, string, string][] = [
  ['Prices, fundamentals, scores', 'Yahoo Finance prices and company statements, scored by the screen', 'Nearly 1,000 companies, rebuilt each evening'],
  ['Live board', 'Yahoo Finance', 'Cached up to 5 minutes; futures for commodities'],
  ['Shareholding', 'NSE shareholding patterns (SEBI SHP XBRL)', 'Quarterly'],
  ['IPOs', 'NSE and public issue data', 'Daily'],
  ['Funds', 'AMFI official NAV via mfapi.in', 'Daily; direct plans only'],
  ['News', 'Publisher RSS feeds', 'Several times a day'],
  ['Signals', 'Daily traded prices from Yahoo Finance for the screened stocks, the Nifty and India VIX', 'Rebuilt after each close'],
  ['Weekly reads', 'Screen figures, written up by a language model and labelled as such', 'Saturdays'],
];

// Only the datasets this site actually reads; the health feed also tracks other products.
const SHOWN = new Set(['Stock screen', 'Markets', 'Market Intelligence', 'Fund screen', 'New listings', 'World news']);

/** The rule book as the engine publishes it (public/signals.json `rules`), so this page and the engine cannot disagree. */
function RuleList() {
  const f = useSignals();
  const r = f.data?.rules;
  if (!r) return <p className="dim">Loading the rules…</p>;
  return (
    <div className="mrules">
      <div><b>1. Market gate</b> (all four, at the signal close)<ul>{r.gate.map((x) => <li key={x}>{x}</li>)}</ul></div>
      <div><b>2. Stock</b> (all of)<ul>{r.stock.map((x) => <li key={x}>{x}</li>)}</ul></div>
      <div><b>3. Setup</b> (one of)<ul>{Object.entries(r.setups).map(([k, v]) => <li key={k}><i>{k}</i>: {v}</li>)}</ul></div>
      <div><b>4. Plan</b><ul>{r.plan.map((x) => <li key={x}>{x}</li>)}</ul></div>
      <div><b>5. Book</b><ul>{r.book.map((x) => <li key={x}>{x}</li>)}</ul></div>
    </div>
  );
}

/** Every explanation the site needs lives here, one anchored section per page, so the pages themselves carry only data.
 *  Each page's header links to its section (PageHead `method`). Text states rules and limits; it never repeats a figure. */
const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  { id: 'prices', title: 'Prices: which one you see', body: <>
    <p>Every stock price is the exchange&apos;s own traded price, the one a broker or TradingView shows. Three sources can price a stock: the live snapshot of the whole screen, a per-stock quote, and the evening screen close. The newer session wins; on the same session the traded price wins.</p>
    <p>The screen close is <b>dividend-adjusted</b> by its source, so on any stock with a recent or upcoming ex-date it reads lower than the exchange (MRPL, 19 Oct 2026: 170.72 in the screen against 173.72 traded, a ₹3 dividend). Prices shown are the traded ones; the screen&apos;s averages, 52-week range and levels are still computed on adjusted closes and can sit a few percent off on such stocks.</p>
    <p>Labels: <i>live HH:MM IST</i> only inside NSE hours with a trade in the last 15 minutes; <i>last trade</i> for a quieter same-day trade; otherwise the session&apos;s <i>close</i>. A stock with no trade in the current session shows its last trade date and no day move. A one-day move beyond NSE&apos;s 20% band is flagged: it usually means a corporate action or a wrong previous close in the source.</p>
  </> },
  { id: 'trades', title: 'Trades: how the paper book is marked', body: <>
    <p>Alpha places no order. Each signal is a plan written once at issue (the rules are under Signals below). The evening run (18:00, 20:00 and 22:30 IST) walks every plan through the day&apos;s full high and low and books what happened. Between runs the Trades page applies the same rules to the latest price, so the state you see during the session is what the evening run will most likely book.</p>
    <p><b>Marked R</b> = (the half sold at T1, at its booked price + the rest at the latest price − entry) ÷ the risk at entry. <b>Today</b> is the marked R minus the R at the previous close; a trade entered at today&apos;s open counts from its entry. Rupee figures are R × the risk per trade you enter (kept in this browser). The day curve redraws the same sum on every five-minute bar. Marks are before costs; closed trades are after 0.25%.</p>
    <p><b>The stop has three names.</b> <i>Stop</i>: the original, below the structure. <i>Profit lock</i>: after T1 the stop on the remaining half moves to entry + 0.5R, so a winner that reaches T1 can no longer turn into a loss and the stop is never the same price as the entry. <i>Trailing stop</i>: after that it rises with the lowest low of the last 10 sessions, and never falls.</p>
    <p><b>Decisions for the next session:</b> <i>Enter</i>: buy at the open within the 2% gap limit. <i>Exit</i>: a stop, T2 or the time limit is reached. <i>Modify</i>: sell half at T1 and set the profit lock, raise the trailing stop, or place the stop on a trade entered today. <i>Hold</i>: no change. Provisional during market hours, final after the 15:30 close.</p>
  </> },
  { id: 'engines', title: 'Signals: the Swing v2 rule book', body: <>
    <p>One book, launched 21 Oct 2026, replacing five machine-learning engines that ranked every stock every evening and always produced picks; none cleared a significant holdout. Swing v2 trades only when the market itself allows, only leaders, only on two textbook setups, with a plan written before entry. On most days it issues nothing; that is the design. The rules, word for word as the engine runs them:</p>
    <RuleList />
    <p><b>How it was tested.</b> The rules were fixed in code before any test, with round textbook numbers, not tuned. One backtest on about six years of daily prices: development to 31 Dec 2024, holdout from 1 Jan 2025, read once. It is compared with the same book without the market gate (what the gate is worth) and with random liquid stocks on the same days under the same plan (what stock selection is worth). The month-clustered t treats each month as one observation because trades overlap; between −2 and +2 is indistinguishable from luck. Phone alerts switch on only when the holdout t is at least 2.</p>
    <p><b>Limits.</b> Survivorship: the universe is today&apos;s listed companies, which flatters any long book. One holdout is one sample. Fills are at the open with 0.25% round-trip cost and no other slippage. The forward record since launch is the only number that cannot have been fitted to the past.</p>
  </> },
  { id: 'today', title: 'Today and the Barometer', body: <>
    <p>The day&apos;s figures (breadth, sector medians, movers) come from whichever source describes the newer session: the live snapshot of ~990 stocks, or the evening screen; on a tie the screen. Stocks with no trade this session are left out and counted. The Barometer (0 to 100) combines index trend, the share above the 200-day average, the day&apos;s participation, the VIX and new highs; it is recomputed live from the same inputs as the published reading. The 200-day share is a close figure.</p>
  </> },
  { id: 'brief', title: 'Brief', body: <p>The written read of the day, copyable as text, plus what no other page shows: the valuation stage, the week&apos;s biggest moves, composite rank changes since the previous build, and the seasonal record (vetted names up in at least 75% of the last 8+ years in this month; a calendar month has no causal pull on a price). Telegram copies go out at 08:00 and 20:00 MYT on weekdays.</p> },
  { id: 'markets', title: 'Markets', body: <><p>Indices, sectors, commodities (futures), currencies and rates from Yahoo Finance, refreshed every minute while open (the source caches up to five minutes). Markets keep different hours, so each quote shows its own last-trade time. Some NSE sector indices have only one bar on Yahoo; their charts say so.</p><p>Tap any card for its detail: today&rsquo;s range and the 52-week range from the traded highs and lows; simple 20, 50 and 200-day averages of the close; classic floor pivots from the last complete session (P = (high + low + close) / 3, R1 = 2P − low, S1 = 2P − high, R2 and S2 one day&rsquo;s range either side of P); typical day as the 14-session average of high minus low; volatility as the 20-session standard deviation of daily returns, annualised. These are standard formulas applied to the bars, not forecasts or levels anyone has chosen.</p></> },
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
  const eng = useSignals();
  const closed = eng.data ? eng.data.record.closed : null;
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
            <li>The rule book is shown with how it tested on data it never saw, against random stocks and without its market gate, whatever the answer. A forward record began on {eng.data?.launched ? dateLabel(eng.data.launched) : 'launch day'}{closed === null ? '' : closed === 0 ? '; none of its trades has closed yet' : `; ${closed} trades have closed, too few to conclude anything`}.</li>
            <li>Where a figure cannot be computed it shows a dash, never an estimate.</li>
          </ul>
        </Rv>
      </section>
      <section className="wrap mgrid">
        {SECTIONS.map((x) => (
          <article key={x.id} id={x.id} className="panel tight msec">
            <h2>{x.title}</h2>
            {x.body}
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
