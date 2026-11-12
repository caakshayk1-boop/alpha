# Chart audit, revamp v3 (12 Nov 2026)

Rule for every chart: it answers ONE question, shows something no other chart on the same page shows, leads with a one-line factual takeaway
(`src/charts/takeaway.ts` rules: deterministic, no cause, no forecast), then the chart, then at most ONE next action. Unit, timeframe and the
data-through date are on the chart. A table alternative stays. Missing data is the word, never a zero.

| Chart | The one question | The unique information only it shows | Duplicates found | Change made |
|---|---|---|---|---|
| Markets: day chart (`DayChart`, full) | How did Nifty 50 trade today? | The whole 09:15 to 15:30 path against the previous close; scrub by time | The Nifty 50 was ALSO drawn as a sparkline in the Indices rows (the same 5-minute series) | Kept. It now owns Nifty 50 on this page. Bank Nifty and VIX stay switchable in it. Unit, timeframe and data-through time added under the title. Line draw-on once |
| Markets: sector heat map (`SectorHeat`) | Which sectors led or lagged, and where does trading sit? | Traded-value-weighted sector change, share of activity, breadth per sector, leaders and laggards | Overlaps the Trend map's sector tiles and Sector bars in sector names only: those rank TREND, this ranks price change | Kept. Tiles already open the sector; the drilled-in sector offers the one action, "Research <sector>" (Discover with its filter). Tiles get the bar grow-in on the breadth strips |
| Markets: Indices (`IndexRows`) | Where is price inside today's range, and how far is Bank Nifty from the Nifty? | Range position (low to high bar with a marker and a previous-close tick) for Bank Nifty and India VIX; the bank-minus-Nifty gap | The Nifty 50 row repeated the day chart; all three rows repeated the day chart as a sparkline | Nifty row removed. Sparklines removed. Two rows remain, each a range-position bar. The sentence "Banks behind the Nifty by ..." keeps ONE home, here. Rows open the TradingView index chart as before |
| Markets: trend map (`TrendMap`) | What share of liquid stocks is in an uptrend, sideways, downtrend? | The three-way split by the screen's trend rule, breadth figures, one-tap Discover shortcuts | Its sector and size tiles repeat sector names that Sector heat and Sector bars carry | Kept; the tiles are already behind a disclosure. The split bar gets the grow-in |
| Markets: sector bars (`SectorBars`) | Which sectors are trending up or down at the close? | Net trend (share up minus share down) per sector, with N | Sector names repeat the heat map, but the measure differs (trend, not today's change); already behind a disclosure | Kept behind its disclosure; bar grow-in; each row opens Discover with the sector and trend filter |
| Markets: macro cards (`MacroStrip`, 8) | What did this commodity or currency do in its last session, and why would an Indian reader care? | Last-session shape and move in its own currency | Eight standalone charts with no link to India | Cards with a standing India link get a one-line description and the exposed sectors as chips (from `news/cues.js`: GOLD and SILVER to metals, BRENT and WTI to crude, USDINR to dollar). Bitcoin, MYR/INR and USD/MYR have none and show none. The measured move stays beside it |
| Markets: macro page (`MacroPage`) | The same, with history | Last session plus the price history | The day chart and the price chart start from the same close | Adds the full India link (how it connects, who is exposed, what to watch) under the day chart; the TradingView link stays |
| Markets: FII and DII flows (`FlowCard`) | Who bought and who sold over the last five sessions? | Net institutional flow per session, FII against DII | None on this page; Today's flow line is a sentence of the same figures that links here | Kept. One axis line, table kept, bars grow in |
| Company: price chart (`PriceChart`) | How has the price moved, against the Nifty, and where are the levels? | Window return, same-window Nifty, deepest fall, your levels, 200-day, 52-week high and low, results date | The 52-week slider on the Overview repeats the 52-week high and low when levels are on | Takeaway leads (already). Level labels are kept apart by the existing spreader and their touch targets are not changed. Controls stay at range, Price or vs Nifty, and Options; the rest sit in the Options sheet. No prediction added |
| Company: 52-week range slider (`company.tsx`) | Where is the price inside its 52-week range? | Position, distance from the high, 50 and 200-day values | Same two numbers as the price chart's high and low markers | Kept: a position bar and a line answer different questions. Not in this lane's files |
| Company: financial charts (`FinancialCharts`) | How did revenue, profit and margin move by fiscal year? | Up to six fiscal years of statements, losses below zero | None | Kept. Bars grow in, the margin lines draw on once. Table kept |
| Company: ownership (`Intel`) | Who holds the company, and did that change? | Promoter, FII, DII, public split and its history | None | Not in this lane; no change |
| Company: valuation percentile (`company.tsx`) | Is the PE high or low against its own history? | Percentile of the PE in its own history | None | Not in this lane; no change |
| Compare chart (`CompareChart`) | How did these stocks move from one shared start? | Indexed lines, or drawdown, on shared days, with the Nifty on the same days | The price chart's "vs Nifty" shows one stock against the Nifty; this shows several | Kept. Colours are stable (company slots against one benchmark style), end labels are direct, the legend only repeats them with the latest values |
| Today: gauge and index strip | Is the market up or down, and how broad? | One mood read | Markets holds the detail | Owned by the Today lane; no change here |
| Book: slots gauge and R bars | How full is the book, and how did closed picks return in R? | Slots used; R per closed pick | None | Owned by the Book lane; no change here |
| Contribution chart (`ContributionBars`) | Which positions made up the open P&L? | The largest contributions by size, Other, and the total | None | Kept. Bars grow in |

## Removed or merged

- Nifty 50 row in Indices: removed (duplicate of the day chart).
- Sparklines in Indices rows: removed; a second drawing of the same session earned nothing. Replaced by range position.
- No chart was added.

## Motion

Line draw-on once per chart (stroke-dashoffset) and bar grow-in (transform scale) only under `html.fx`; both off under reduced motion; no layout
shift (transform, opacity and stroke only). Defined in `src/charts3.css`.
