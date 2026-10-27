# Round 3: what changed, what it answers, what is still open (27 Oct 2026)

Branch `tripwire-harden`, on top of the launch-hardening pass (`LAUNCH_HARDENING.md`). Automated checks only; no real device and no real user has seen it.

## Your questions, answered

**"WSTCSTPAPR: the screen and live show different. Is it the screen? When will the screen be live? What is feasible? Does it touch the Lab or other decisions?"**
Neither is wrong. They are two different moments.
- The **screen** is a batch built from the last finished session: price, returns, RSI, averages, ranks, scores, volume and every ratio are as of that close. It is rebuilt once a night after the exchange closes.
- **Live** is a Yahoo print from today's session.
- A list row showed the live price (and day change) while the same name in the table showed the screen's close, and PE, from-high and similar read at the close. That is the mismatch.
- **Fixed:** rows on screen now show the live print in the table too, and every figure that is a pure function of the price (day change, from-high, from-low, PE, PB, distance from the averages) is worked out at that price and marked with a dot. Everything else, and all **filtering and sorting**, stays at the close, and the page says so under the table.
- **Feasible:** a live overlay for the rows on screen (done). A fully live screen (re-filter all 988 names on every tick) is feasible only for figures that depend on the price alone; RSI, averages, ranks and fundamentals cannot be rebuilt from one print, and ~990 quotes per refresh is 33 Worker requests of 30 names each, which the free plan's request budget does not carry for more than a few users. Recommendation: do not.
- **Lab and decisions:** none of this touches them. The Lab runs on ten years of closes (not live prices), the engines rank on the close, eligibility reads the close, and the paper book enters at the next open. Live prices change what a page shows, never what is picked, tested or sized.

**"Targets are empty."** Picks filed before 27 Oct have no profit-booking ladder by policy (the record is not rewritten). They now show **reference** T1 and T2 (marked `ref`, dashed on the chart and the position road, "not traded"). Picks filed from 27 Oct onward trade the ladder.

**"Engine evidence: fix it in the best way; modify the paper-pick rules if needed."**
The evidence layer was already honest (Momentum: not supported by the back-test; Quality: cannot be back-tested, so on forward test). What was wrong is that the paper book took both at a full ticket and the picks all read the same.
- New **book-2 rules** (nights from 27 Oct; earlier nights keep book-1 and are not re-sized): ticket = ₹1,00,000 × engine weight (Momentum 0.25, Quality 0.5), and at most 4 positions in one sector. Weights follow the back-test standing on that day and change only by a new rule version.
- Why this does not damage the evidence: results are kept in R (a multiple of the risk taken), which does not depend on ticket size. Only the rupee headline shrinks.
- Each pick now shows the figures **its own engine** ranked it on (Momentum: 12-1 return, distance from high, vs Nifty, RSI, volume; Quality: ROCE, F-score, Magic rank, PE, debt/equity, sales growth), not one repeated line.
- The Proof tab now carries, per engine, its forward record and its paper ticket.
- Judgement: if the owner wants Momentum off the book entirely, that is one weight set to 0 in a new version. Keeping a quarter ticket preserves the forward sample that will settle it.

## Built

| Area | Change |
|---|---|
| Index cards | Nifty, Bank Nifty, VIX: points and %, day-range bar with yesterday's close marked, open vs previous close, low/high, a sparkline each, and Bank Nifty against the Nifty in points. Fixed height: no shift when prices arrive. |
| News | The Worker held a copy for an hour, so "check now" often returned the same page. Edge copy is now 5 minutes; "check now" goes past it once the copy is a minute old. The page re-reads every 10 minutes while the market is open, 30 otherwise, and on return to the tab. Views: All / My names / Market; "New" marks lines since your last visit; a quiet day widens the filter and says "wider match". Up to 10 held or followed names. |
| Trend map | One-word read by a printed rule; five breadth figures (above 50-day, above 200-day, within 5% of high, RSI ≥ 70, RSI ≤ 30), each over the names that have the figure; three one-tap questions that open Discover already filtered; sectors ranked strongest to weakest (four and four) or by size. |
| Charts | Open, high, low and volume now come through the Worker. Line or candles; daily, weekly or monthly; volume panel; RSI 14 panel on the frame you are viewing, with the daily, weekly and monthly readings side by side; scrub shows open/high/low/volume. Too many daily bars become weekly or monthly bars and the page says so (thinning bars would misstate a day). |
| RSI weekly and monthly | Nightly sheet (`ledger/rsi.json`, read through `/api/rsi`), shared test vectors between Python and the app. Columns and filters in Discover. A name outside the sheet has no figure rather than a zero. |
| Discover table | A filter button on every column heading (opens the same condition sheet on that column); links can carry `rsi=35-50`, `momentum`, `tier`, `view=table`. |
| Live P&L / picks | Reference targets on cards, blotter, chart; targets on every pick. |
| Speed, SEO, agents | Screens load as separate files (first-load script 488 kB → 138 kB). Robots allow the page and keep `/api/` and `/data/` out; description, canonical, share tags; `llms.txt`; three read-only WebMCP tools where the browser offers them. |

## PageSpeed (local Lighthouse 13 on this build, mobile emulation)
| | Before (same machine) | After |
|---|---|---|
| Performance | 77 | 95 |
| Accessibility | 100 | 100 |
| Best practices | 100 | 96 → fixed to 100 by answering the optional RSI sheet with HTTP 200 (a 404 is a console error) |
| SEO | 63 | 100 |
| Total blocking time | 1,000 ms | 0 ms |

Your screenshot (89 / 98 / 92 / 63 / agentic 2 of 4) is the live site, which I cannot run PageSpeed against from here (the API quota is exhausted for anonymous callers). Local numbers are not the same as PSI's. SEO 63 was `robots.txt` (`Disallow: /`) and a `noindex` tag, both of which I had set on purpose for the closed beta; they are now off. Agentic browsing was missing `llms.txt` and any WebMCP tool. Best practices 92 on the live site is two failed audits I cannot name without a PSI run; likely console errors from optional endpoints. Re-run PSI after deploy and send me the failing audit names.

**Decision for the owner:** this makes the landing page indexable. The app's own screens are behind a hash route and the data is not crawlable, but a public, indexed page about stock rules brings the SEBI question forward. Revert is one line in `build.mjs` and `index.html`.

## Not done, or found
- `ledger/factors.json` has been written with **zero names** (universe 0) by the nightly job. The factor sheet is empty and has been since it began. Not part of this round; it needs a look at what the loader returns on a runner.
- The RSI sheet appears after the first nightly run (or a manual dispatch of `tripwire-ledger`). Until then the weekly and monthly RSI columns are empty and say so.
- Research stamps (`meta.run`) land when the `[tw-research]` run commits; the first attempt failed to push because a second push raced it. The commit step now rebases with autostash.
- Still unverified on real devices; still no real-user test; the engines still have no supported edge.
