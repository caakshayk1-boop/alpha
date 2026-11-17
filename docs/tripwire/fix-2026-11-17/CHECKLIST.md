# 17 November fix-list disposition

Source: owner attachment `tripwire-claude-codex-fix-list-2026-11-17.md`. Existing working features were retained. This is a status ledger, not a blanket claim that every external launch dependency is complete.

| Item | Implementation / evidence |
|---|---|
| Chart screenshot | Compact controls precede plot; density adapts to measured width; readable external price axis; smaller unboxed readings; no duplicate mobile tooltip; touch cancellation clears selection; phone sticky quote removed; action bar yields to entire chart workspace. D/W/M, candles, RSI periods, divergences, history lens retained. Chromium/WebKit checks. |
| P0-1 | Research and condition sheets label RSI/factor dates; company factor readings carry their own date; `rsi_as_of` retained on joined rows. Source lag is labelled, not re-dated. Chart RSI is computed from the dated chart history, separately. |
| P0-2 | Existing visible realised/unrealised split retained and acceptance fixture rerun. See BUILD-LOG. |
| P0-3 | Visible Book observation populations + CSV; void precedence; unknown outcomes have a separate missing count. Explicitly distinct from paper position counts. |
| P0-4 | Capture placed at hero and Pro; **deferred by owner**. Endpoint remains blank/disabled. No invented subscription or test submission. |
| P0-5 | Picks shows dated Swing signal count/gate, exact alert reason and last ON date; full market checks/history link. Factor-engine picks are explicitly separate. |
| P1-1 | `#/sitout`: daily engine eligible/passed/picked/wide-stop counts, named skipped/voided reasons; existing book-selection refusals linked. The publisher does not store names of rejected wide-stop candidates, so names are not reconstructed. |
| P1-2 | Existing histogram/expectancy/win-loss/per-engine/sample honesty kept; Nifty-relative percentage-point column + source-labelled CSV added. Build writes `data/public-record.json` from the same ledger and pure scoreboard function. |
| P1-3 | Existing lifecycle timelines + core headline traces retained; command-search entry opens matching recorded paper lifecycle where one exists. An observation not taken by the book does not gain an invented paper timeline. |
| P1-4 | Today strip: screen count/date, ledger days/picks, closed paper-record R/sample and separately dated Swing gate. Book-derived figures use the same default plan and ledger. |
| P1-5 | `#/gate`: development/holdout/random-holdout table, monthly clustered t and +2.0 requirement; full source statistics expandable. No recalculated backtest. |
| P1-6 | Published gate-day strip and last ON fact; accessible date table. No earlier history invented. |
| P1-7 | `#/about`: named builder, accounting explanation, mailto error-report route. Delivery to the mailbox was not tested. |
| P1-8 | Today explains screen → engine picks → ledger → paper book, with separate Swing gate; Menu/search and manifest use Book/Research vocabulary. |
| P1-9 | 390px Chromium/WebKit page-by-page checks and desktop chart checks. **Physical iPhone verification remains outstanding.** |
| P1-10 | Real self-hosted Fraunces declared, `--editorial` fixed, public headline uses it. |
| P1-11 | Existing confirmed/forming/stale/missing chart and mark status retained. No intraday quote represented as a completed close. |
| P1-12 | Existing colourblind and motion browser suites pass; new pages/chart checked with reduced motion and axe. |
| P2-1 | Existing watchlist engine-book Trips retained; configurable local price/RSI crossing conditions added to Desk, validated and included in full backups. Requires two dated observed closes, no background/push claim. |
| P2-2 | Existing Why-this-stock summary remains above accordions with source dates. Larger evidence sections stay collapsed to respect the owner's request to reduce evidence clutter. |
| P2-3 | Existing ladder share-card generator retained; current release regenerates 34 PNG-backed cards from supplied ledger. |
| P2-4 | Existing review reminders/journal CSV retained; engine-observation versus dated journal decision comparison added. No inference about ordering within a session. |
| P2-5 | Existing regime weather and dated sector heat map retained. **W2 impact-map specification R01–R12 is unavailable**; no invented causal impact/pressure model substituted for it. |
| P2-6 | Existing Cmd/Ctrl-K augmented with new destinations and ledger-entry search. |
| P2-7 | **Deferred with email integration.** No weekly messages sent, list fabricated or scheduling promise made. |
| P2-8 | Existing personal Pro beta kept; shared capture location added. Waitlist disabled per owner, no price or paid entitlement claimed. |
| P2-9 | `#/changelog`: actual dated eligibility versions and summaries, linked from Methodology. |
| P2-10 | Build-time crawlable `/methodology/`, `/record/`, `/about/`, canonical tags and expanded sitemap. Public summaries use release data. |
| P2-11 | SECURITY-REVIEW.md filed before any account work. Shared repo dependency findings remain; **not cleared for accounts/payments**. |
| P2-12 | Existing followed-name changes retained; Today adds baseline-based new observations, newly voided observations and gate-check changes. First visit establishes baseline; no history fabricated. New book-selection refusals include their recorded reason; older baselines begin that comparison on their next visit. |
| P2-13 | Existing sample walkthrough, first-company flow and glossary kept; new gate/record links improve findability. |
| P2-14 | About includes factual story, voiding explanation and links to exact refusals/outcomes. |
| P2-15 | Existing saved filters in Research/Desk retained. |
| P2-16 | `#/api-guide`: endpoint links, schemas/dates and missing-value semantics. |
| P2-17 | Asset budgets pass; critical CSS trimmed. Local Lighthouse run recorded; see BUILD-LOG for limits rather than an invented field score. |
