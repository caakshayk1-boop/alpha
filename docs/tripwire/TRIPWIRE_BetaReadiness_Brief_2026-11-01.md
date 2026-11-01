# Tripwire public-beta readiness brief (owner, 1 Nov 2026)

Review and improve Tripwire at tripwire.askakshay.com for public-beta readiness. Implement the changes in this repository; do not stop at an audit or plan. Read CLAUDE.md and repository instructions, inspect the architecture, establish a baseline with the existing checks, preserve unrelated work, use a dedicated branch (`beta-readiness`).

The findings below come from a desktop review on 1 November 2026. Treat them as observations to reproduce, not assumed code defects. If something is already fixed, verify it and move on.

## Product goal
A clear, polished research workspace: Understand a company → examine evidence and risks → compare alternatives → record a thesis → track changes. Keep the dark identity, improve readability, hierarchy and chart storytelling. Preserve accurate disclosures and useful functionality.

## Phase 1 — Trust and data consistency
Investigate and fix:
1. Closed-market prices and positions labeled "Live." Distinguish Live, Delayed, Last traded and Unavailable using exchange timestamps and market-session state. Fetch time must never imply quote freshness.
2. Generic "Risk grade: LOW" alongside a downtrend and substantial drawdown. Identify the dimension actually measured and label it precisely. No screen flags must never imply no investment risks.
3. Contradictory statements about exchange-holiday support. Use the authoritative exchange-calendar implementation consistently.
4. Data coverage showing zero Signals rows while Picks displays entries. Correct the count or clearly explain its distinct meaning.
5. News filter counts differing from displayed totals. Define and consistently distinguish events, articles and covered companies.
6. News showing "Unavailable" before initial loading completes. Provide distinct loading, empty, delayed, partial, error and success states.
7. Portfolio contribution charts omitting losses from the initial view. Show signed contributions and an "Other" remainder that reconciles to the total.
8. Retroactively restated paper-trading results. Inspect existing rule/version provenance. Distinguish original and restated results wherever supported. Never fabricate historical records, overwrite immutable results, or silently change trading rules.
9. Repeated signal observations versus independent portfolio positions. Explain the distinction wherever counts and outcomes could be confused.

Do not modify investment thresholds, engine eligibility, execution assumptions or financial formulas just to improve presentation. If a calculation bug is found, isolate the fix, add meaningful tests, document its impact.

## Phase 2 — A shared chart system
Inspect the current chart implementation before choosing dependencies. Reuse or improve; avoid an unnecessary rewrite. Every major chart: a concise factual takeaway; the relevant comparison or baseline; visible timeframe, units and data-through date; direct labels where useful; consistent company/benchmark colours; accessible tooltips, keyboard operation and touch interaction; a table alternative and clear missing-data handling; source and adjustment basis incl. dividend treatment; responsive layouts and reduced-motion support.
Deterministic, testable takeaway logic derived from displayed data. No invented explanations, causal claims, confidence scores or forecasts. Reserve lime for selection and emphasis. Stable series identity. Do not rely on red/green alone. Avoid excessive gradients, decoration, tiny text, crowded controls.

## Phase 3 — Company and comparison
Company page: principal chart in the first meaningful screen; compress the decision summary; default new users to a one-year stock-versus-Nifty comparison where coverage permits (respect saved preferences); distinguish absolute return from relative performance; preserve candles, log scale, MAs, volume, RSI, drawdown and longer ranges; group advanced controls progressively; organise research into Overview, Financials, Ownership, Risks, Thesis using existing navigation patterns; verified event annotations only when reliable dated data exists; aligned revenue/profit/margin charts; improve ownership and historical valuation only where data suffices.
Compare: replace the large "Add a third company" panel with a compact expandable control; takeaway and indexed chart first; align date windows and explain coverage limits; show fundamental trade-offs without declaring an overall winner; drawdown comparison where supported.

## Phase 4 — Remaining pages
- Today: useful market takeaway, then changes in followed companies and thesis reviews due; explicitly labelled sample walkthrough for new users.
- Markets: index performance with breadth; ranked sector bars with sample sizes; breadth history only if genuine snapshots exist.
- Discover: keep advanced filtering and tables; transparent research presets with visible criteria; no rankings-as-recommendations; optional quality-vs-valuation plot only if measures are comparable and covered.
- Signals: simpler cards; compact entry/stop/target visual with explicit paper assumptions; rename "Take it myself" → "Add paper trade"; rename "Proof" → "Evidence".
- Auto / Record: full P&L attribution and record interpretation; portfolio history and drawdowns only where reproducible; do not imply a validated strategy from a short record.
- News: group coverage of the same event, better categories, keep source links, distinguish publication time from collection time, no unsupported summaries.
- My Desk / Planner: better empty states, explain the workflow; hypothetical allocation, cash remaining, modeled loss at the assumed stop, execution caveats.
- Data / Methodology / Help: concise summaries with expandable details; keep provenance, limitations, failed-test disclosures; use "Settings" consistently.
- Settings: device-only storage and backup discoverable; last-backup status if it can be recorded reliably.
- Operations: separate user-facing service health from developer diagnostics; do not claim frontend hiding is security; no secrets.
- Printable report: thesis and invalidation when present, principal chart, material risks, dates, sources, missing-evidence statements; verify print layout.

## Phase 5 — Verification
Run existing tests; add targeted tests for changed calculations, timestamps, aggregation, rule provenance, chart takeaway logic. Verify desktop and narrow mobile; keyboard, focus, contrast, reduced motion; empty/partial/delayed/missing/failed data; new listings and mismatched histories; zero/negative values and unavailable ratios; market-open/closed/weekend/holiday states; chart/table agreement and P&L reconciliation; persistence and backup without deleting user data; print layout; build, lint, types, tests. Do not claim real-device or screen-reader testing unless actually performed.

## Delivery
Incremental logical commits. Do not deploy, push to production, introduce paid services, add analytics, change authentication, or migrate/delete production data. Finish with: changes by user impact; tests run with actual results; before/after screenshots; unresolved issues and data dependencies; exact local preview instructions; a clear public-beta readiness assessment. Do not substitute mock data for missing production capabilities.
