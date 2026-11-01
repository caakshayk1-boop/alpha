# Phase 1 findings: trust and data consistency (1 Nov 2026)

Method: each finding was first reproduced or refuted against the code at `beta-readiness` (commit 1d546c7), then fixed where real. Line numbers below are from that commit unless marked "now". Baseline before any change: `tripwire:types` clean, `tripwire:test` 478 tests / 0 fail, 20 browser suites green on a private wrangler port (the clock was Sunday 1 Nov, market shut).

No threshold, eligibility rule, execution assumption, cost, formula or rule version was changed. `/data` and `/api` shapes are untouched (the only addition is client-side `note` text on file rows and optional fields on in-app objects).

| # | Finding | Verdict |
|---|---|---|
| 1 | Closed-market prices and positions labelled "Live" | **Reproduced**, fixed |
| 2 | "Risk grade: LOW" beside a downtrend; "no flags" read as "no risk" | **Reproduced**, fixed in shared code; two Company/Compare lines handed over (see below) |
| 3 | Contradictory statements about exchange holidays | **Reproduced**, fixed |
| 4 | Data coverage: Signals 0 rows vs Picks entries | **Reproduced** (not a count bug; two different files), explained in words |
| 5 | News filter counts differ from displayed totals | **Reproduced**, fixed |
| 6 | News says "Unavailable" before first load | **Reproduced**, fixed |
| 7 | Contribution charts omit losses | **Reproduced**, fixed |
| 8 | Retroactively restated results | **Partly**: provenance exists to label, but no stored "before" figure; labelled, never paired with an invented number |
| 9 | Repeated observations vs independent positions | **Reproduced**, explained beside the counts |

## 1. Live labels

Reproduced.
- `stamp.ts:22` returned `live` for any print under 5 minutes old **regardless of the session**: at 15:33 IST a 15:29:50 print read "live" with the market shut. `lagging` (5 to 20 min) had the same flaw.
- `tracker.ts:71-74` and `:103-104` set `markKind: 'live'` whenever a print newer than the last daily bar exists. On a weekend Friday's last print satisfies that, so every open position was labelled live. Consumers printed it: `LivePositions.tsx:23`, `Tracker.tsx:81` ("Live"), `Tracker.tsx:102`, `Live.tsx:80,91`, `blotter.ts:20` (`live: v.markKind === 'live'`).
- `Macro.tsx:35,38` called `isLiveQuote(q)`, which assumed NSE hours, for gold/Bitcoin/FX.
- Hero badges were driven by the session clock, not by the print: `Tracker.tsx`, `AutoBook.tsx`, `Live.tsx` (`LiveBadge live={live} label={live ? 'LIVE' : ...}`), `today.tsx:105`, `markets.tsx:22`. With the clock open and no quote loaded yet they said LIVE.

Fix: one vocabulary **Live / Delayed / Last traded / Unavailable** in `stamp.ts` (`quoteAge().word`, `quoteWord`, `markWord`, `freshestPrint`). Rules: Live = print under 5 min AND session on (or a listed special session); Delayed = session on, older print; Last traded = session shut (weekend, holiday, before 09:15, after 15:30), however fresh the print; Unavailable = no print time and not loading; while loading the word is `null` and screens say "Checking prices". Round-the-clock markets (`nse=false`) are judged by print age alone. Fetch time is never an input. Applied in `book.ts` (`markT`, `priceWord`), `blotter.ts`, `LivePositions`, `Tracker`, `AutoBook`, `Live`, `Macro`, `today`, `markets`, `quotes.ts` (`LivePx.word`), `timelabels.quoteLabel`, `common.tsx`, Discover legend/dots, Help and Methodology. Service names ("Live prices" in Operations/Pipeline) are the name of the feed, not a quote label, and are unchanged.

Not done by this lane (Company page is owned by the charts agent): `screens/company.tsx:65-67` still prints `lp.live ? 'Live' : 'Last price'` and `'today' : 'last session'`. `lp.word` now exists on `useLivePrice()`; replace `{lp.live ? 'Live' : 'Last price'}` with `{lp.word}`.

## 2. Risk grade

Reproduced. The grade is the screen's `risk_lvl`, a weighted count of flags (`risk.score`: LOW 0 to 2, MEDIUM 3 to 5, HIGH 6+, verified over all 988 company files). The flags are statement quality, valuation vs peers, daily range (flag from 5% a day), thin trading and a fall of **40% or more** from the 52-week high (smallest "Down N%" flag in the data is 40). It reads no trend: of 290 LOW names in the 26 Oct screen, **187 are below their 200-day average and 130 are more than 25% under their 52-week high** (e.g. AAVAS -36.8%, below its 200-day, LOW, score 0, no flags).
Copy implying safety: `company.tsx:54,59` ("Risk grade: LOW."), `company.tsx:58` ("The screen raised no risk flag or weakness"), Countercase empty text ("No risk flag or weakness was raised"), `quant.ts:110` ("Screen risk grade LOW."), `pickfacts.ts:31` ("Risk grade").

Fix (in `eligibility.ts`, shared): `RISK_NAME` "Screen flag level", `RISK_SCOPE` (a visible scope line: what is counted, what is not read), `riskSentence()`, `NO_FLAGS_SENTENCE` ("not a finding that there are no risks"). `riskGradeOf().note` now always carries the scope, so every place that prints the grade prints its scope with it (Company page prints `grade.note` already). `quant.pickRisk` and `pickfacts` renamed; Methodology has a section "What the screen's flag level measures" quoting the 187 of 290 figure. The "Risk grade not shown" sentence for financial-sector names is deliberately unchanged (pinned by `beta.mjs`).
Handed over (Company/Compare pages not in this lane): in `company.tsx` replace the literal `Risk grade: ${grade.level}.` (lines 54, 59) with `riskSentence(grade.level, flags.length)`, replace the `mainRisk` empty line (58) and the Countercase empty text with `NO_FLAGS_SENTENCE`; in `compare.tsx:34` rename the row label "Screen risk grade" to "Screen flag level".

## 3. Holidays

Reproduced. `calendar.ts` models 16 NSE 2026 holidays (+ the Muhurat session, listed not modelled). Yet `stamp.ts:3` ("Holidays are not modelled"), `Data.tsx:37` ("Exchange holidays are not modelled."), `docs/tripwire/BETA_REPORT.md:42` said the opposite, and `stamp.ts:24` blamed "A holiday" for a quiet weekday the calendar lists as trading. Fix: `calendar.ts#holidayStatement()` is the single statement (built from the tables: version, count, special session, year coverage). Used by Data, Help and Methodology; the stale comment, doc line and stale-print sentence ("not a listed holiday: the price source is quiet, or trading is halted") corrected.

## 4. Signals 0 vs Picks

Reproduced, and it is not a miscount. `/data/signals.json` (`build.mjs:66`, `rows = signals.length`) is the swing-signal feed; its list is empty by design while its gate is OFF (gate 1/4 checks, holdout t -0.62). The Picks are the engines' observations in `/api/ledger` (65 rows). Two files, two meanings. Fix: `coverage.ts` notes on both file rows ("0 rows is not a failure ... gate is OFF ... a different file"; the ledger row says "pick observations ... not positions" and that voided/retired rows are in the file but not counted), wired in `freshdata.ts`; plus an "Observations and positions" section on Data.

## 5. News counts

Reproduced. Tab chips used `tabCounts()` (`newsview.ts`: "fit for Today", 48/72 h window) while the News page list is `archiveList()` (7 days by default, other filters), and Today's chips counted the raw pool while the list is diversified and capped at 10. So a chip could read 14 and the list show 10, or the reverse. Fix: `archiveTabCounts()` (same filters as the list) and `todayTabCounts()` (the length of the list Today draws); the page count line is `countsLine()`: "N events · N articles · N companies" with one definition (`COUNT_DEFINITION`, shown on the page and in the methodology drawer). Chips carry an accessible name with the unit.

## 6. News states

Reproduced. `news.ts:104` called `newsHealth()` with no notion of "not loaded yet", so with nothing saved the first render returned `unavailable` ("News unavailable: no check has succeeded yet") until the first poll returned. Fix: `NewsState` gains `loading` and `error`; `newsHealth({ loaded })`; `newsViewState()` returns one of loading / empty / delayed / partial / error / success (`data-news-state`, `data-news-view` hooks); `EmptyTab` has distinct error and delayed-and-empty copy. Unreachable with nothing saved is `error` (was "unavailable"); nothing-ever-published stays "unavailable".

## 7. Contribution charts

Reproduced. `AutoBook.tsx` sorted open positions by P&L descending and `open.slice(0, 8)`: with more than eight positions only the eight best were drawn, losses vanished, and there was no remainder or total (`Tracker.tsx:46` listed all but also had no total). Fix: `contribution.ts#contributions()` (pure): rows by absolute size, the largest gain and largest loss always among them, everything else netted into "Other (n)" with its gains and losses, a Total row, all arithmetic in whole paise so rows + Other equal the total exactly (`reconciles()`). `ContributionBars` (screens/contribution.tsx, existing `.contrib` styles, sign in the text and bar side, not colour alone) used by AutoBook and Tracker. No chart internals touched.

## 8. Original vs restated

Partly. What exists: pick data day, `POLICY_FROM` 27 Oct (ladder from the first night), `TARGETS_BACKFILL_ON` 1 Nov (ladder applied to earlier picks still unfinished), elig-1/2 and book-1/2 by night, `targetBasis`, outcomes that carry ladder fields only when the ladder ran. What does not exist: any stored result "before" the backfill. So the app labels, and does not pair numbers. `provenance.ts#resultBasis()` gives **As filed / Original rule / Restated rule** with the rule versions; the Record prints the split of closed results and warns when the total R mixes rules; each position card carries a pill and a "Rule basis" paragraph. Current ledger: all closed results are listed by basis in the Record. Closed results are never rewritten and nothing is reconstructed.

## 9. Observations vs positions

Reproduced. The ledger holds 65 pick rows over 6 nights naming only 20 companies (LAURUSLABS 7 times, CASTROLIND/HBLENGINE/PETRONET/HCLTECH 6 each); outcomes are replayed per observation, so "closed trades" counts overlapping looks at the same company. The paper book holds a company once at a time. `observations.ts` counts both from the ledger alone; `ObservationNote` states it beside the counts on Record, Signals (Picks) and Data, and "picks" on the Record became "pick observations".

## Unverified / limits
- Real-device and screen-reader testing were not done.
- The grade's thresholds (5% a day, 40% drawdown, score bands) are read from the published data, not from the upstream builder (which is not in this repo); the scope line says "flags" and names them, and the doc records how they were observed.
- Before/after screenshots belong to the brief's delivery, not this lane.
