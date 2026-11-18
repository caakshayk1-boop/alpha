# Tripwire fix-list release — 17 November 2026

## Changed
- Chart controls grouped before the drawing; width-aware candle aggregation (minimum 60-bar capacity), compact axis/readings, mobile tooltip duplication removed, touch cancellation fixed, mobile sticky quote removed and action bar yields to whole chart workspace. Preserved daily/weekly/monthly, RSI 7/14/21, divergences, comparison, table and historical lens.
- Added source dates, visible observation populations/CSV, daily refusal log, Swing gate/history/backtest, builder/story page, public changelog/API guide, Nifty excess column and crawlable summaries.
- Extended command search to ledger entries, Desk with saved price/RSI crossings and decision comparison, Today with record statistics and visit-baseline changes. Additive local state fields included in backup validation/merge. Legacy states remain unchanged unless the new features are used.
- Kept email disabled after owner's explicit deferral. Full item-by-item disposition in CHECKLIST.md.

## Accounting proof
Acceptance fixture: buy 100 shares at ₹100, original stop ₹90; sell 50 at ₹120, mark remaining 50 at ₹110.
- Realised before charges: (120−100)×50 = **₹1,000**.
- Unrealised before charges: (110−100)×50 = **₹500**.
- Total **₹1,500**; original risk (100−90)×100 = **₹1,000**; **1.5R**.
- With 0.25% round-trip entry-notional charges and zero slippage in the fixture: ₹12.50 allocated to each half, ₹987.50 realised + ₹487.50 unrealised = ₹1,475. Original risk stays ₹1,000.
Existing `pnlsplit.test.ts` proves both arithmetic and agreement with the real tracker. Existing Book browser test proves realised/unrealised presentation.

Independent published-ledger spot check: 139 open + 13 pending + 13 closed + 5 skipped + 5 void = **175 observations**. These are not the deduplicated paper-book positions. Paper-book closed R: LAURUSLABS first lifecycle +2.21, ECLERX −1.03, LAURUSLABS second lifecycle −1.05 = **+0.13R over 3 closed positions**, identical to the scoreboard. Sample remains explicitly insufficient for a conclusion.

## Verified
- TypeScript, token lint and asset budgets pass. Final unit/browser results appended below.
- Chromium/WebKit at 390px: Today, Research, Book, Markets, Methodology, About/data, Help, Settings, Privacy, Terms, Desk, Pro, Menu, Glass, Gate, Sit-out, Changelog and API guide; no horizontal overflow or tested axe violations. Deterministic tests use published ledger plus intercepted data fixtures.
- Chart suite at 390/1440px in both browsers: intervals, RSI periods, divergence, historical scrub, candle style, aligned RSI/price axes, no overflow, axe.
- Existing Book, backup/storage reliability, colourblind and reduced-motion suites verified.
- Mechanical design detector found only Fraunces as an overused-font warning. Intentional exception: owner fix-list P1-10 explicitly requires the real Fraunces face.
- Budget before this task: initial JS 96.8 KB gzip; critical CSS 13.9 KB gzip; full CSS 54.7 KB gzip. Re-captured first-viewport classes reduced critical CSS; final figures appended below.
- Local Lighthouse run during concurrent verification: performance 53, accessibility 100, best practices 100, SEO 100; LCP 4.0s, CLS 0, TBT 4,160ms. This is a throttled local lab measurement under load, **not** a production/real-device score or a performance sign-off. Asset gates are a separate measurement.

## Untouched / outstanding
- No automatic engine thresholds, eligibility, entry/exit rules, gates, cost model or ledger history changed. No ApexPro edits.
- Email/waitlist and weekly email deferred by owner. W2 sector-impact R01–R12 spec missing; existing sector heat map is not represented as that model. Physical iPhone verification outstanding.
- Security review is filed, not a paid-account launch clearance. No accounts/payments or background notification monitoring added.
- RSI/factors retain their real source dates. Signals carries 13 November while company screen is 16 November; no dates fabricated. HEG/ICICIPRULI stale prices and missing classifications remain labelled.

## Final verification and deploy — 17 November 2026
Built from freshly sharded published data (996 companies, screen day 2026-11-16) and the live ledger (updated 2026-11-17T01:26Z).

**Defects found by the full browser gate and fixed before release** (the earlier session had run only individual suites):
- Chart return in candle/volume view started at the close of the first aggregated bar, not at the window start. Whirlpool 5Y showed −59.4% (start 30 Nov 2021, first monthly bar) against the true −64.1% (start 17 Nov 2021: 2,311.75 → 829.40, recomputed from the raw series). The headline and the figure card now both read the window's own first and last close in every view. Regression test added: candle view and line view must state the same window return (`chart-workbench.mjs`; it failed 3.2% vs 2.3% before the fix).
- The Today record strip arrived late and moved the market cards 24 px (CLS 0.0161 > 0.01 limit): its date lines now reserve their height.
- Desk comparison table and Today strip links were under the 44 px target; the chart price gutter overflowed the page at 200% text; the Research page's new date line pushed the first result 46 px lower (its dates now sit in the page header, once).
- Desk watch-condition and comparison panels were shown above every Desk tab (Journal, Plans, Saved) and duplicated thesis text on Desk; they now appear on the Desk view only, and the comparison table renders when opened.
- Tests updated for intended changes: Menu (17 rows, new "Public record" group), sitemap (root + 3 crawlable pages), touch reading clears on finger lift (History lens keeps one), hover wording "From window start", figures-row height now compared at rest vs reading, record-strip copy excluded from the "no Paper book panel" check.

**Checks run on the final build** (outputs in this session): `tripwire:types` clean; `tripwire:lint` ok; `tripwire:budget` ok (initial JS 97.5 KB gzip, 3 files; critical CSS 12.7 KB gzip); `tripwire:test` 964/964; `tripwire:verify-data --no-ledger` ok; full `tripwire:check` browser gate exit 0, 2,265 PASS, 0 FAIL; plus the four suites that are not in that gate — `chart-workbench` (Chromium + WebKit, 390/1440), `trust-browser`, `selfbook-browser`, `watch-browser` — all pass.

**Deployed** with `wrangler deploy --config wrangler.tripwire.jsonc` from this working tree: version `9b96c771-5ba6-42d9-8e03-683beb920866` (an intermediate deploy `ec8e9bab-…` carried the candle-return error above for roughly 25 minutes and was replaced). Rollback target, the version live before this release: `7b926cca-552d-47a7-80e9-01c0ffbb96c2`.
Live check: asset hash equals the local build; `/`, `/methodology/`, `/record/`, `/about/`, `/sitemap.xml`, `/data/screen.json`, `/api/ledger`, `/api/chart` return 200; Whirlpool 5Y in line and candle view both read −64.1% (−18.5% a year); Today, Gate, Sit-out, About, Glass, Desk and Menu have no horizontal overflow and no page errors at 390 px; `shopfront.mjs` against production passes.

## Still outstanding
- This release was deployed from an uncommitted working tree on branch `apexpro-terminal-modern`. **Nothing is committed.** The scheduled/dispatch deploy in `.github/workflows/tripwire.yml` only deploys from `main`, so until this work is merged to `main` the next scheduled data deploy will replace it with `main`'s older code.
- `chart-workbench`, `trust-browser`, `selfbook-browser`, `watch-browser` are not in `tests/check.mjs`, so CI does not run them (the first, second and third also need WebKit, which the workflow does not install).
- Physical iPhone verification, W2 sector-impact specification, email/waitlist and the paid-account security clearance remain as listed above.

## Gate follow-up — 17 November 2026 (owner-approved)
`assertScreen` now fails the deploy when more than 5 rows carry the build's explicit `Unclassified` sector (`Policy.maxUnclassified`, default 5). Reason: #70 labels source omissions instead of leaving them null, which made the "no sector" rule unable to fail; a feed outage blanking many sectors would have passed. Currently 4 names are unclassified (AONESTEELS, IZMO, JASH, SSRETAIL), so today's data passes. Tests: boundary at 5 passes, 6 fails and names rows, override works. No engine, rule, gate threshold elsewhere, or cost model changed.

## CI and performance follow-up — 17 November 2026
- **Four suites now in CI.** `tests/extra.mjs` (`npm run tripwire:check:extra`) runs chart-workbench, trust-browser, selfbook-browser and watch-browser against its own Worker on port 8802, in Chromium and WebKit. The workflow runs it on pull requests and manual runs only, so the nightly data deploy neither waits for it nor is failed by it. Local run: 4 of 4 pass.
- **P0-1 RSI/factors lag.** At 14:29 UTC, `/api/rsi` and `/api/factors` carry 17 Nov (that session has closed) while screen, company files and signals carry 16 Nov. The 13 Nov lag has cleared. The mismatch is now one session the other way until tonight's screen publish; every surface still shows its own date. No code change.
- **Production performance (Lighthouse, mobile profile, median of 3, run on production 17 Nov):** home performance 91 (runs 91/90/92), accessibility 100, best practices 100, SEO 92, LCP 2.95 s, FCP 1.68 s, TBT 153 ms, CLS 0, 1,206 KB transferred. `/about/`: performance 100, LCP 0.91 s. This replaces the earlier local figure of 53, which was taken under load. Remaining findings: unused CSS (about 59 KB) and unused JS (about 47 KB) on the home route, both inside the existing budget; the 8 SEO points are a `Content-Signal` line in `robots.txt` that Cloudflare injects. Nothing was changed.
- **Email capture (P0-4, P2-7, P2-8)** is built and off. It needs one value from the owner, the Beehiiv subscribe endpoint (`apps/tripwire/src/capture.ts`). Not invented.

## Explainer films — 17 November 2026
Added the two remaining films from the unmerged `v6-animations` branch (Dark Keynote 17 s, Blueprint 14 s) next to the existing wide "from the close to the ledger" film, so the welcome screen now carries three different films. `src/components/Films.tsx`, `landing.css`, `welcome.tsx`; sources and README in `docs/tripwire/v6/animations/`. Same rules as the first film: no sound, lazy, paused under reduced motion and Data Saver, a text alternative each. Size checks added to `build.mjs`.
Verified: `howvideo.mjs` extended (9:16 box before video loads, muted, controls, poster, accessible name, transcript beats, files served, no sideways scroll, reduced motion pauses both) passes; screenshots at 390 and 1280; types, lint, budget ok; full browser gate 2,288 PASS / 0 FAIL.
Untouched: engine, rules, gates, costs, data. The films' copy was not re-checked against the 17 Nov vocabulary pass beyond reading it: it says Rules, Evidence, Paper book, Ledger, as the live site does.

## Vision phase 1 (18 Nov 2026): the ledger as the front of the house
Approved by the owner ("Yes, phase 1"). Three pieces, no engine, rule, gate, cost or scoring change; every figure is read from `/api/ledger` and `/data/signals.json`.
- **Welcome screen live line** (`LedgerLine`): nights recorded, paper picks and the swing gate state with its off streak, one sentence under the headline, two lines reserved so figures arriving do not shift the page.
- **Gate as the centrepiece** (`GateHero` at the top of `#/gate`): state, N of 4 checks, each check with its published figure, the failing check nearest to passing, and days off of days published. A distance is computed only where the published text carries a threshold and a reading (breadth "At least 50% … 47%" and VIX "at or below 20"); the Nifty 200-day check has none, so it is listed with no distance, not an invented one. On 16 Nov: breadth is 3 points short of 50%.
- **Daily Edition** (`#/edition`, `#/edition?d=YYYY-MM-DD`): one ledger night, rebuilt from the ledger, never edited. Picks recorded, passed-not-picked per engine, wide-stop skips (counts only, as published), voids with their reasons, names new to their engine, previous/next night. A night with no published gate entry says "missing", not "off".
- Pure logic in `src/edition.ts`; screens in `src/screens/edition.tsx`; route registered in `route.ts` and `app.tsx`.
- Not built from the plan yet: a static, crawlable per-day edition page and the weekly letter (email capture is deferred by the owner).
- Checks: `tests/edition.test.ts` 4 unit tests; `tests/edition.mjs` browser suite at 390 and 1280 px (added to `check.mjs`).
- Untouched: ApexPro, all rules and gate logic, every localStorage key.

## Nightly deploy reliability, chart ranges, near-stop colour (18 Nov 2026)
**Changed.**
- *Why the nightly deploy failed so often* (run histories 16–18 Nov): (1) rows with no sector (fixed 17 Nov by the Unclassified cap); (2) the build running a few minutes before the nightly screen published ("1 session behind"); (3) the browser gate reading the lazy day-line chart before it had loaded (`journey.mjs`, failed 17 Nov 15:33 and 18 Nov 00:12 UTC). Fixes: `tripwire.yml` waits (up to 4 tries, 8 minutes apart) when and only when the build is exactly a session behind, then checks again; any other data fault still fails at once. The nightly dispatch now gets the same second browser-gate attempt a scheduled run had. The timeout is 90 minutes. The journey test waits for the day line.
- *Charts:* ranges 1M, 3M and 6M added (the shortest was 1Y). Turning Candles on over a window too long for daily bars now narrows to the longest short range that fits (6M, 3M, 1M) instead of silently switching to weekly while D stayed lit; a longer range still falls back to weekly and says so.
- *Near stop in green:* "near the stop" measures distance to the stop in force, which after T1 is the entry price, so a profitable position can sit near it. Such a row now reads amber, "above its protected stop" / "Close to its profit-protecting stop", not red. A losing position is unchanged (red).
- *Colour:* both sites now share up #3DDC97, down #FF6A4D, caution #FFC24B and two neon tokens (lime #CCFF43, cyan #4DE1FF); only the brand accent differs (Tripwire lime, ApexPro amber). ApexPro's down, caution and comparison colours moved to these values; its SW is v15.
**Verified.** Types, token lint, 978 unit tests (one workflow test updated for the intended change, one added for the short ranges), ApexPro 14 model tests and 8 browser suites, ApexPro overlap/overflow audit (7 routes x 3 widths, none). The full Tripwire browser gate result is appended below.
**Untouched.** Engines, gate, scoring, ledger, cost model; ApexPro endpoints and rules; localStorage keys.
**Full browser gate on the final build:** exit 0, 2,326 PASS, 0 FAIL (an earlier run failed 9 checks when the short ranges sat in the main range row: 44px targets and the compare page at 320 to 390px; they moved to Chart options).

## Tripwire 6.0 review: what was built, what already existed, what was left (18 Nov 2026)
**Reading of the review.** The 18 Nov analysis (`tripwire-6-upgrade-analysis-2026-11-18.md`) recomputes correctly: from the live ledger I reproduced 190 picks, 15 closed (5 wins), -2.97R closed, MOM +1.87R / QLT -6.21R / ST +1.37R closed, 150 open at +35.49R, 25 past Target 1. Several of its gaps were already built or were out of date: the realised-R curve with its drawdown (Record), the engine split, the R histogram and honest scoreboard, the per-position timeline and sit-out log (Glass Book, 15 Nov), the gate centrepiece (Vision phase 1, 18 Nov), an attention sort in the Book (`bookview.ts`), per-surface as-of labels for RSI and Factors (17 Nov release, `IndicatorDates`, Intel, whycard) with a per-file freshness board (`#/status`), an About page, and Fraunces (shipped in `static/fonts`). None of those were rebuilt.
**Built (the part that did not exist).**
- *Daily book snapshot* (`src/booksnap.ts`, `ledger/book-snapshots.json`): one row per session with open-book R, closed R, counts, per engine. Written by the nightly job only after the ledger assertions pass, write-once per day, committed by the ledger workflow. The ledger keeps only each position's latest mark, so this history cannot be rebuilt for days not captured; it starts 17 Nov 2026, seeded from the marks the ledger held that day. Served at `/api/snapshots` (worker route, same pattern as `/api/fiidii`), listed in the API guide.
- *The open book beside the closed record* (`screens/booktoday.tsx`, first section on the Record after the headline): per engine, closed count and R beside open count, open R and the count past Target 1, with a totals row. Counts and R only. A line of closed R plus open marks per session appears once two snapshot days exist; until then it says when snapshots began.
**Decisions kept, not overridden.** The review asks for an expectancy figure at n=15. The product withholds win rate and average R until 30 trades have closed (`MIN_TRADES`), and the Record headline says so; that rule was left alone. The new section shows no rate or average. A public "Under review" or "retire" state for QLT needs a pre-registered rule the owner has not set; not invented here. Note for that decision: QLT is -6.21R closed but +9.70R on 62 open positions; the two columns are not comparable at this age.
**Not built, and why.** Email capture and `/pro` waitlist (external service and the owner's earlier deferral); per-pick permanent pages and a 190-URL sitemap (a publishing and compliance choice: indexable pages per pick read as tips, owner to decide); refusal counterfactuals (needs post-refusal prices and a rule for what counts); Nifty overlay (only per-trade `niftyPct` over each window is stored, not a daily series, so a time-aligned benchmark line is not computable today); regime shading; `/api/summary` (nothing reads it yet; the snapshot file is already the small source); real-device mobile verification (cannot be done from this environment).
**Verified.** `tsc`, token lint, budget, 984 unit tests (6 new in `booksnap.test.ts`, including the first snapshot matching `summarizeLedger` on the real ledger), `pagesa.mjs` Record checks at 320/390/1280 (rows add up to the totals row, no rate shown, date and limits stated, line appears with two days, no page overflow), screenshots at 390 and 1280 on the real ledger. Full browser gate: see below.
**Untouched.** Engines, rules, gate, costs, scoring, ledger contents, every localStorage key, ApexPro.
