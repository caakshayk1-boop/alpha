// #/info, "About and data" (v6, 13 Nov 2026). Everything a screen does not need in order to make a decision lives here: the data status, how the numbers are made, definitions, the fine print.
// A screen keeps (i) the data a decision needs, (ii) a warning when something is wrong, (iii) one-line labels, and links here ("About these numbers") with ?s=<anchor>.
// Nothing was deleted: every honesty statement that used to sit under a figure is below, under a heading with an anchor. docs/tripwire/v6/INFO_MOVES.md lists each move.
import { useEffect } from 'react';
import { PageBar } from './common.tsx';
import { DataPage } from './Data.tsx';
import { Methodology } from './Methodology.tsx';
import { ContactLine } from './legal.tsx';
import { Fold } from './fold.tsx';
import { currentSnapshotId } from '../snapid.ts';
import { DEFAULT_COST, SLIPPAGE_PCT, GAP_SKIP_PCT } from '../tracker.ts';
import { DEFAULT_CFG } from '../autobook.ts';
import { TREND_RULE_TEXT } from '../screen.ts';
import { rulesFor, RULES } from '../rules.ts';
import { LEGAL_UPDATED } from '../legal.ts';
import { inr0 } from '../fmt.ts';

/** The sections, in page order. `id` is the anchor and the value of `?s=`. Menu, Book, Markets and the rest link to these. */
export const INFO_SECTIONS: { id: string; title: string }[] = [
  { id: 'data', title: 'Data status' },
  { id: 'pnl', title: 'P&L and definitions' },
  { id: 'book', title: 'How the paper book works' },
  { id: 'markets', title: 'Markets' },
  { id: 'picks', title: 'How to read these picks' },
  { id: 'method', title: 'Methodology and evidence' },
  { id: 'legal', title: 'Disclaimers, privacy and contact' },
  { id: 'build', title: 'Build' },
];
const buildStamp = () => { try { const m = [...document.querySelectorAll('script[src]')].map((e) => (e as HTMLScriptElement).src.match(/\/app\.([a-z0-9]+)\.js/)).find(Boolean); return m ? m[1] : null; } catch { return null; } };

export function Info({ section }: { section?: string | null }) {
  useEffect(() => { if (!section) return; const t = window.setTimeout(() => { const el = document.getElementById(`info-${section}`); if (el) { (el as HTMLDetailsElement).open = true; el.scrollIntoView({ block: 'start' }); } }, 60); return () => window.clearTimeout(t); }, [section]);
  const snap = currentSnapshotId(); const stamp = buildStamp(); const rules = RULES.map((r) => r.id).join(', ');
  return <div className="mp read info" data-info>
    <PageBar title="About and data" onBack sub="How the numbers are made, how current they are, and the fine print" />
    <nav className="info-toc" aria-label="On this page"><ul>{INFO_SECTIONS.map((x) => <li key={x.id}><a href={`#/info?s=${x.id}`} onClick={(e) => { e.preventDefault(); const el = document.getElementById(`info-${x.id}`); if (el) { (el as HTMLDetailsElement).open = true; el.scrollIntoView({ block: 'start' }); history.replaceState(history.state, '', `#/info?s=${x.id}`); } }}>{x.title}</a></li>)}</ul></nav>

    <Fold id="data" anchor="info-data" title="Data status" summary="How current every dataset is, what it covers, build times." open><DataPage embedded /></Fold>

    <Fold id="pnl" anchor="info-pnl" title="P&L and definitions" summary="Realised, unrealised, R, T2, exit checks, the snapshot id." open={section === 'pnl'}>
      <div className="card small info-body">
        <p><b>Total P&L</b> is realised plus unrealised, after costs. <b>Realised</b> is booked exits, partial ones included. <b>Unrealised</b> is the shares still held, marked at the observed price. <b>Open-trade P&L, includes booked partials</b> is the whole open trade, so it differs from unrealised once a partial exit has been booked. No performance percentage is shown: no capital base or cash-flow treatment is defined for this book.</p>
        <p><b>One R</b> is the distance from the entry to the stop, so a result in R does not depend on position size. <b>T1</b> and <b>T2</b> are the profit-booking prices; T2 is the second, further level, and the part of the position still open after T1 is what a T2 exit closes. A stop-out after T1 was booked is a different outcome from one that never worked.</p>
        <p><b>Awaiting entry</b> means a pick has been taken into the book but its entry has not happened yet: it fills at the next session's open, and is skipped if that open is more than {GAP_SKIP_PCT}% above the signal close or at the stop.</p>
        <p><b>Exit verification</b> checks that daily price history exists for every open position, so a stop or a T1 that was crossed is not missed. It is complete when none is missing; the Book says so only when it is not. <b>Quotes</b> are Live (under five minutes old while the market is open), Delayed, Last traded (market shut) or Unavailable; the Book says so only when they are delayed or unavailable. <b>Marks</b> counts how many open positions have a price; when some do not, every figure is a partial subtotal and says so.</p>
        <p><b>Closed book positions</b> counts the engine book's own closed trades. <b>Resolved observations</b> in the Record is a wider and different count. A dash is a figure that is not measured, never a zero.</p>
        <p><b>Snapshot id</b> of the book as last drawn this session: <code className="num" data-snapshot-id>{snap ?? 'not drawn yet (open the Book)'}</code>. Every figure on the Book, its table and its export is read from that one snapshot, so they cannot disagree. It is also in the table's caption on the Book.</p>
        <p><b>Shares left</b> is what is still held after any booked partial exit. Rule versions in use: {rules}; the version for a pick is the one in force on the night it was written ({rulesFor('9999')} today).</p>
      </div>
    </Fold>

    <Fold id="book" anchor="info-book" title="How the paper book works" summary="Entry, exits, costs and the engine book's limits." open={section === 'book'}>
      <div className="card small info-body">
        <p><b>How a trade is followed.</b> Entry: the open of the first session after it was taken, plus {SLIPPAGE_PCT}% slippage; skipped if it opens more than {GAP_SKIP_PCT}% above the signal close or at the stop. Exit: the stop (a gap exits at the open; a bar spanning the stop counts as stopped), a profit-booking level, or the close of the last session of the horizon. Costs {DEFAULT_COST}% round trip plus {SLIPPAGE_PCT}% slippage each side. Real fills differ.</p>
        <p><b>The engine book.</b> Every pick the active engines write into the nightly record is taken the same night, best score first, with fixed limits: at most {DEFAULT_CFG.maxOpen} positions at a time (30 for nights before 3 Nov 2026, so no earlier night is re-planned) and at most {inr0(DEFAULT_CFG.ticket)} in any one (quantity = ticket ÷ signal close, rounded down). Rules are versioned by the night of the pick. Book-1, nights before 27 Oct 2026: the full ticket for every pick. Book-2, from the 27 Oct night: the ticket is scaled by the engine's back-test standing on that day (Momentum, not supported by the back-test, a quarter; Quality, on forward test, as it cannot be back-tested, a half) and no more than four positions run in one sector. Results are kept in R, which does not depend on ticket size. A pick is refused, and the log says why, if the name is already held, one share costs more than its ticket, its sector is full, or {DEFAULT_CFG.maxOpen} positions are running. It is built from the record, not from anything you press, and it does not choose between engines.</p>
        <p><b>Yours.</b> A pick you add is followed with the same rules at the size the position sizer gives it. A pick the engine book already holds is not added twice. Picks are written into the record each night after the market closes; nothing is real money.</p>
        <p>The order of the positions list is nearest its stop first, then nearest a profit-booking level.</p>
      </div>
    </Fold>

    <Fold id="markets" anchor="info-markets" title="Markets" summary="What the index tiles, the chart, the trend map, the sectors and the flows measure." open={section === 'markets'}>
      <div className="card small info-body">
        <p>Index moves are against the previous close; breadth is the share of liquid names. Both are measured, neither is a forecast. A tile's bar runs from today's low to today's high in index points; the dot is the last price and the tick is yesterday's close. A rising India VIX is drawn red.</p>
        <p>The session chart is 5-minute closes on the whole 09:15 to 15:30 axis, scaled to today's range and the previous close, never to an entry or stop of yours.</p>
        <p><b>Trend map.</b> Uptrend needs all four: {TREND_RULE_TEXT.up}. Downtrend is the mirror; anything else is sideways. The five breadth figures are shares of the names that have the figure. The shortcuts are the same filters as Research, not recommendations. Breadth figures and groups are always the last close; today's price is used for the names near a trend line when the live update is available.</p>
        <p><b>Sector heat.</b> Sector changes are weighted by the last session's traded value, not market capitalisation. Activity is the share of traded value across the sectors shown. Tiles have equal size for readability. Participation counts companies rising, falling or unchanged over the selected window. Only liquid names with a price change and a traded value count; a name missing a figure is left out, never read as zero.</p>
        <p><b>Movers</b> are the largest one-day changes among the screen's liquid names at its last close.</p>
        <p><b>FII and DII flows.</b> Provisional figures as published by NSE, in ₹ crore, for FII/FPI and DII as NSE groups them. They describe what was traded, not a view of what comes next. The card is hidden when the file is missing, damaged or more than a few sessions old.</p>
        <p><b>Commodities and currencies.</b> Prices from Yahoo Finance. Gold, silver and oil are exchange futures priced in US dollars, not the Indian MCX contracts, so a rupee price at home differs by the exchange rate, duty and dealer premium. Each tile opens its own page with its India link.</p>
      </div>
    </Fold>

    <Fold id="picks" anchor="info-picks" title="How to read these picks" summary="Rank, signal close, T1 and T2, eligibility." open={section === 'picks'}>
      <div className="card small info-body">
        <p>Ranked by each engine's own rank among eligible names. "→" is the live price against the signal close. The paper book skips an entry that opens more than {GAP_SKIP_PCT}% above that close. T1 and T2 are the profit-booking prices: "at signal close" for a pick that has not entered yet (the fill sets the booked levels), "from the fill" once it has; "(ref)" means reference only, not traded. The figures on the second line are the ones this pick's own engine ranked it on. Eligibility rule version in force today: {rulesFor('9999')}.</p>
        <p>Picks are long only. A paper entry fills at the next session's open, never at the signal close, and is skipped if that open is more than {GAP_SKIP_PCT}% above it. Levels on a pick are worked from the signal close; the fill sets the booked ones.</p>
        <p>Experimental: a rank is not a chance of winning. Paper only.</p>
      </div>
    </Fold>

    <Fold id="method" anchor="info-method" title="Methodology and evidence" summary="How picks and trends are worked out, and what the tests found." open={section === 'method'}><Methodology embedded /></Fold>

    <Fold id="legal" anchor="info-legal" title="Disclaimers, privacy and contact" summary="Not advice, nothing is ordered, what stays on your device." open={section === 'legal'}>
      <div className="card small info-body">
        <p><b>Experimental, closed research beta.</b> Tripwire shows which public rules fired at the last close and the evidence on each side. It is educational research, not investment advice. Every trade in it is a paper trade: no order is ever placed, and paper results are not real results. No SEBI registration is claimed.</p>
        <p>No account, no tracking, no analytics. Your notes stay on this device.</p>
        <p><a href="#/privacy">Privacy</a> · <a href="#/terms">Terms of use</a> · <a href="#/help">How to use Tripwire</a> · last updated {LEGAL_UPDATED}</p>
        <ContactLine />
      </div>
    </Fold>

    <Fold id="build" anchor="info-build" title="Build" summary="The version of this app that is running." open={section === 'build'}>
      <div className="card small info-body"><p data-build>Build <code className="num">{stamp ?? 'unavailable'}</code></p></div>
    </Fold>
  </div>;
}
