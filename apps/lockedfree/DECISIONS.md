# Rulebook — decisions (ADRs)

Changes to screen rules, ledger accounting, or Gate mechanics after Step 1 approval need an entry here first.

## ADR-001 — Astro static site, own package.json (proposed 2026-11-18)
Astro 7 static output on a Cloudflare Worker with assets, in `apps/lockedfree/` with its own manifest. The root manifest is Next.js 14 and serves Alpha; mixing would risk both builds. Rejected: Next.js, extending Tripwire's esbuild build.

## ADR-002 — React only inside base-ui islands (proposed, needs owner decision D5)
base-ui is React-only. Everything else is vanilla TS custom elements. Trade-off: ~40 KB gzip of React on Gate and Plan pages versus hand-building accessible primitives.

## ADR-003 — Two ledger scopes (proposed)
Public `rulebook-ledger/1` (built nightly) and per-visitor `rulebook-book/1` (browser only), sharing one `accounting.ts`. No accounts, no server-side user trades.

## ADR-004 — Anime.js and swup declined (proposed)
GSAP covers all sequences; native View Transitions on a static site make swup unnecessary.

## ADR-005 — Colour never carries direction alone (proposed)
Measured: the prompt's Up/Down differ in luminance by 0.003 (1.19:1 under simulated deuteranopia). Refined shades plus mandatory sign and icon, lint-enforced. Separate text-safe `down-ink` and `warn-ink`.

## ADR-006 — Pick mechanics and R definition (proposed, needs owner decision D2)
Entry next session open after first appearing; exit next open after first failing run; R measured against a fixed 20% initial stop, declared on each methodology page.

## ADR-006 addendum (Step 2, 2026-11-18)
Pick status gains `pending` (listed, entry fill not yet possible). A pick dropped while pending is voided with a reason. Stop is checked from the entry day's own low. A repeated run is a no-op. Charges version `in-delivery-1`: rates are starting values and must be verified against the NSE/SEBI/government schedules before launch.

## ADR-007 — pqoqubbw animated icons declined; book days carry `committed` (2026-11-18)
The animated icon set is built on React + the `motion` package; adding that to every page for hover effects costs more than it earns. Nav and feature icons are plain Lucide with a CSS hover transform (120ms, reduced-motion aware). `committed` was added to `book_days` before any real row existed, so charts can show return against notional put to work.

## ADR-008 — React only on the Gate and Plan pages, mounted by our own script (2026-11-18)
Not Astro islands: islands inject inline bootstrap scripts that a strict CSP forbids. Gate and Plan are React apps built on `@base-ui/react`, loaded as external module scripts. Every other page ships no React.

## ADR-009 — Strict CSP kept; chart attribution is a footer link (2026-11-18)
`style-src 'self'` with no inline anything. lightweight-charts injects an inline `<style>` for its attribution logo, which the CSP blocked. The logo is switched off (`attributionLogo: false`) and the library's required attribution is a text link to tradingview.com in the footer of every page.

## ADR-010 — Terminal surfaces override the light-only, end-of-day-only rules (owner decision, 2026-11-18)
The owner asked for a Bloomberg/Apple-style terminal (dashboard, screener, snapshot, daily brief, live P&L, a one-pager for each of the 999 tracked stocks) with motion and delayed live quotes, and chose to override Rulebook's design law for it. Scope of the override, so the rest stays intact:
- A dark graphite theme applies ONLY under `[data-surface="terminal"]` (/terminal/, /screener/, /snapshot/, /brief/, /pnl/, /stock/). The editorial site (home, screens, ledger, gate, plan, about) stays the paper theme. There is still no theme toggle.
- Quotes may be delayed-live (polled from the Worker, every number age-stamped) on those surfaces. The Ledger remains end-of-day and append-only.
- Kept regardless: no recommendations, no verdicts, no entry/stop/target ladders from the source feed, no return promises, no gamification, "missing stays missing", sign+arrow beside every colour. The feed's `vd` verdict and `lad` trade ladder are deliberately NOT shown (they read as advice; BUILD-PLAN R1).
- Source: the owner's own daily feed (trading-dashboard/docs/*.json via raw.githubusercontent.com), refreshed about 05:42 IST. Quotes are the only intraday data and come from Yahoo through the Worker (unofficial, delayed).

## ADR-011 — Editorial site re-themed to askakshay.com; home page rebuilt for speed and motion (owner decision, 2026-11-18)
The owner called the main page slow, boring and motionless, and asked it to match askakshay.com with better design and animation. Theme read from the live site: background `#08090A`, text `#F0F0F0`, lime `#B8EF43`, Fira Sans, JetBrains Mono, pill buttons, 12px cards, numbered section markers, italic lime emphasis. Applied to every editorial page through the shared tokens (the Terminal keeps its own palette and fonts). Supersedes the light-paper decision in DESIGN.md §1–§2 (see §14).
Why it was slow (measured on a throttled phone profile, 550 KB): a 164 KB charting library loaded on a page with no chart data; 68 KB of GSAP existed for one highlight animation; a 118 KB display font; a 61 KB stylesheet of view-transition names for 999 stock pages blocked rendering on every page. Fixes: charts fetched only when a chart scrolls near the viewport; GSAP and the smooth-scroll library removed from editorial pages (CSS plus about 3 KB of script); fonts cut to Fira Sans 400/700/500-italic and one JetBrains Mono variable file; stock transition names moved to a stylesheet only the terminal loads; speculation rules prerender likely next pages on hover (the CSP gains `'inline-speculation-rules'`, which allows that one JSON block and no executable inline script). Result: 175 KB total, 12 KB JS. LCP did not improve on the synthetic profile because the larger web fonts now count toward it.
Consequences: the "no looping" motion rule is relaxed for one slow marquee and the pulsing status dot; both stop under reduced motion. Direction is still never colour alone. The Terminal is unchanged.

## ADR-012 — Terminal unified with the main site (owner decision, 2026-11-18)
The owner asked for the terminal to look and flow like the core site: same fonts, colours and structure, "simple, smart, powerful". Removed: the graphite/amber palette block in tokens.css, the left icon rail, Fraunces, Inter and IBM Plex Mono (and their npm packages). Terminal pages now render the shared SiteHeader, then a sub-bar of room tabs, so there is one navigation model across the product. Supersedes the terminal-palette part of ADR-010; its other rules (delayed quotes, no verdicts or ladders) stand.
Side effects: stock pages no longer fetch the charting library until the price chart scrolls into view (183 KB to 19 KB of JS) and no longer ship GSAP; the screener reserves its table height so the page does not jump when data arrives (layout shift 0.088 to 0.000).

## ADR-013 — Start the record today, from the feed, at the signal-day close (owner decision, 2026-11-18)
Owner instruction: "start picking calls from today onwards", priced on today's close for all engines, for lockedfree only (Tripwire and Alpha untouched; confirmed in answer to a direct question). Three consequences, each a change to what was approved at Step 1:
1. **Entry and exit basis (supersedes ADR-006's next-open rule).** A listed pick fills at the close of its run day; a dropped pick exits at the close of the run that drops it; the 20% stop is checked from the next day's low. The ledger keeps both modes (`config.entry_basis`: `signal-close` now, `next-open` still tested). Cost: a list built from a close cannot be bought at that close, so results are optimistic. Stated on every methodology page.
2. **Data source for the screens: the owner's daily feed** instead of yfinance fundamentals (unreachable from the build sandbox and never run). Piotroski uses the feed's nine per-stock test results (verified against its own score for every stock), Magic Formula the feed's own rank and exclusions, Quality+Momentum and Conservative use feed ROCE, three years of profit, ROCE and operating cash flow, 12-1 momentum from its 1y and 1m returns, and the 200-day average. The 90-day look-ahead guard cannot be applied because the feed does not date its statements; stated on the methodology pages. `tools/fetch_fundamentals.py` and `tools/run-screens.ts` are removed.
3. **First run is today (the feed's latest close, 17 Nov 2026).** Rules and thresholds are unchanged from §5, and are NOT tightened to shrink the lists: 89 Piotroski, 15 Magic Formula, 62 Quality+Momentum, 238 Conservative Quality, 404 simulated positions of Rs 1,00,000. The "deliberately small" aim in the plan is not met by these thresholds; a stricter rule is a new screen version with its own record. Refusals now track the 25 nearest misses per screen, not every rejected name, to keep the ledger file bounded.
Also: a stock whose one share costs more than the position size is voided with that reason (found on the first real run: a Rs 1,28,840 share).

## ADR-014 — The book: Rs 1 crore, 30 calls, Tripwire's selection rules (owner decision, 2026-11-18)
Owner instruction: "make rules tighter for selection, total available balance Rs 1 crore, max 30 calls open, with rules from Tripwire onboard." Replaces the plan's one-position-per-passer sizing and supersedes the Rs 1,00,000 position size in ADR-013 (that day-one record of 404 positions was never published and was discarded and rebuilt). Rules mirror apps/tripwire/src/autobook.ts and eligibility.ts, read from the code:
- **Account** Rs 1,00,00,000, **at most 30 open calls**, a fixed **ticket of Rs 3,30,000** (30 tickets = Rs 99 lakh; the rest pays charges, which are deducted).
- **Order**: passers from all four screens compete in order of the feed's composite score, highest first; ties go to the symbol, so the book is reproducible. (Tripwire orders by engine score; this feed has no per-screen score, so the composite is the stated stand-in.)
- **Refusals, each logged with its reason**: the name is already held; one share costs more than the ticket; the book is full; **no more than 4 positions in one sector**. A stock several screens list is one position, credited to the first of Piotroski, Magic Formula, Quality+Momentum, Conservative.
- **Eligibility (Tripwire's)**: capital-based ratios are not judged for financial-sector companies or where operating profit exceeds revenue or profit is near zero; those stocks are not scorable on the two ROCE screens.
- Screen thresholds are UNCHANGED. The tightening is the book layer: of 404 stocks passing on 17 Nov, 30 are taken and 374 are recorded as not taken, each with its reason (some not taken because they duplicate a held name).
- Display: screens pages lead with the calls and keep the rest behind "All that passed"; the Ledger gains a book panel (account, open of 30, deployed, cash after charges, sector spread); the refusals page lists passed-but-not-taken names. The hero curve is return on the Rs 1 crore account.
- Not copied from Tripwire: per-engine ticket weights (no back-test here to justify them) and its time exit (calls here exit when their screen drops them).
Consequences: with 30 slots and weekly runs, the book will turn over slowly, so closed-trade sample sizes (n) will take many months to reach 30. Selecting by the feed's composite is a second criterion beyond the screens' own rules; it is stated on the methodology page.

## ADR-015 — Screens v2: stricter rules, top-5 lists, v1 archived (owner decision, 2026-11-18)
Owner: "Why so many calls from all the engines; the new ones other than Tripwire should have stricter rules." v1 passed 404 stocks on day one and the 30-call cap hid that; the screens themselves were too loose.
- Universe: market cap of Rs 2,000 cr or more and traded value of Rs 10 cr a day or more (Magic Formula: Rs 5,000 cr). Every screen also needs the price above its 200-day average.
- Piotroski: all nine tests plus the two filters. Magic Formula: ranked pool, earnings yield and return on capital positive, only the feed's top 10. Quality+Momentum: ROCE 20% or more, profit at least 1.25x two years ago, momentum in the top 10%. Conservative: debt-to-equity 0.1 or less, ROCE 30% or more and operating cash flow positive in three years, cash flow at least equal to profit.
- Each screen lists at most 5 names, ordered by the composite score; the book then applies ADR-014. 17 calls opened on 17 Nov (was 30 of 404 passers); cash is a position and is recorded as one.
- v1 ledger and runs are kept under ledger/archive/v1-2026-11-17/ (append-only: nothing deleted). The legacy engines in screens.ts are retained for their tests but are not used in production.
Consequences: fewer calls means closed-trade samples stay below n = 30 for longer; every figure keeps its n. Thresholds are a judgement, not a back-tested optimum.

## ADR-016 — Site consolidation to seven pages and a widget terminal (owner decision, 2026-11-18)
Owner: minimise pages and sections, make the site more powerful with widgets. Measured: about 140 hand-written pages removed; 1,007 pages built (7 core + 999 stock pages).
- Pages: Home, Terminal (widget board), Calls (open calls / the four screens / the record), Screener, The Gate (Trade / Journal / Rules tabs), The Plan, About (method merged), plus stock pages. Old URLs 301 to their new home via _redirects.
- Terminal widgets: market pulse, the book, daily brief, score leaders, movers, watchlist, live paper P&L, position-size calculator, data health. Each can be hidden; the choice is kept in this browser only (rb-widgets-hidden).
- Closed trades, voids and not-taken names stay visible on Calls > The record (no losing trade is hidden by the merge).
Consequences: bookmarks to retired pages rely on the redirects, verified in a browser under wrangler dev (proof-book B6).

## ADR-017 — Exit rules per engine, one-month cap (owner decision, 2026-11-19)
Owner: "use your proposed exit rules, with no holding greater than 1 month for all engines." A call leaves on the FIRST of its stop, its profit target, the screen dropping it (where the rule says so) or the end of one calendar month (the last trading session on or before the same day next month).
- Piotroski: 20% stop, +20% target, leaves if the screen drops it. Magic Formula: 15% stop, +15% target, held even if dropped (a rank-based list churns weekly; the month cap governs). Quality + Momentum: 25% trailing stop below the highest close (previous sessions only), +30% target, leaves if dropped. Conservative Quality: 18% stop, +15% target, leaves if dropped.
- Same-session ambiguity: daily bars cannot show whether the high or the low came first, so the STOP is assumed first. A gap through the stop or above the target fills at the open.
- R is measured to each call's own initial stop. Existing open calls (entered 17 Nov, none closed) were given their engine's rule once by tools/migrate-rules.ts; fills were not touched and the migration refuses to run once any call has closed.
- These are judgements, not back-tested. A 25% stop or a 20% target will rarely be reached in one month, so most exits will be the time limit; review after 30 closed calls per engine.
Consequences: closed-trade counts grow faster (every call is gone within a month), so n reaches 30 per engine sooner, but results are dominated by one-month price moves.

## ADR-018 — Launch hardening from the pre-launch audit (2026-11-19)
Fixed from the audit: translucent sticky bars let text show through (now opaque, higher z-index, scroll padding); stale universe text (now tied to the screen constants by a test); disclaimer with SEBI wording on every decision page and the footer; Privacy and Terms pages dated and matching what is collected; contact (email and askakshay.com) in every footer; icon set, manifest and Twitter cards; sort and filter on every Calls table; Calls shows quantity, invested, last price, P&L in rupees and percent, stop, target and exit-by; failure alerts on every job (GitHub issue) plus a 30-minute live probe; RUNBOOK.md with build, rollback, backup and restore. The charting library credit stays as text without a link.
Not done here (needs the owner): the legal/SEBI opinion; ADMIN_TOKEN secret for the email-list backup; a real staging site; real-device and Safari checks.
