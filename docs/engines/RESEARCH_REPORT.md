# RESEARCH_REPORT: Alpha Signal Engines

> **Honest summary (interim, 22 Oct 2026, after Phase 0):** nothing qualifies. Swing v2's displayed figures reproduce exactly, but two books are one trade off because the original run kept no data snapshot, so the unpinned data path is stopped. The 0% gate is a real market state (Nifty below its 200-day on all 136 sessions), not a bug. A lookahead in the group benchmarks was found and corrected (swing-2.0.1); the corrected holdout is +0.015R, t −0.62: no edge. The five ML engines never cleared t 2 and share the same benchmark leak. E1–E5 are not built yet and no new out-of-sample result exists; the pre-registration awaits owner approval.

## 1. Legacy audit summary
See LEGACY_AUDIT.md. Reproduction status: FAIL on exact counts (displayed figures exact; no-gate 163 vs 162, development 268 vs 267). Gate diagnosis: DONE.

## 2. Data and universe
Sources, date ranges, point-in-time coverage and survivorship limits (details in MANIFEST.md).

## 3. Exclusion funnels
| Engine | Available | Clean | Liquid | Setup | Context-compatible | Executable | Portfolio-selected |
|---|---|---|---|---|---|---|---|
| E1 | | | | | | | |
| E2 | | | | | | | |
| E3 | | | | | | | |
| E4 | | | | | | | |
| E5 | | | | | | | |
| E6 | BLOCKED | | | | | | |

## 4. Validation results (walk-forward OOS, net of costs)
| Engine | N | Indep. obs. | Net exp. (R) | 95% CI (block bootstrap) | PF | Win % | Max DD | ES | Turnover | Avg hold | Exposure | DSR | PBO |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E1 | NOT RUN | | | | | | | | | | | | |
| E2 | NOT RUN | | | | | | | | | | | | |
| E3 | NOT RUN | | | | | | | | | | | | |
| E4 | NOT RUN | | | | | | | | | | | | |
| E5 | NOT RUN | | | | | | | | | | | | |
| E6 | BLOCKED | | | | | | | | | | | | |
| Combined book | NOT RUN | | | | | | | | | | | | |

## 5. Robustness
| Engine | Gross vs net | 2× costs | +1 session delay | Partial-exit challenger vs baseline | Parameter neighbourhood |
|---|---|---|---|---|---|

## 6. Baselines
| Engine | Strategy | Cash | Exposure-matched index | Matched random entry |
|---|---|---|---|---|

## 7. Regime breakdown
| Engine | Trend-up | Trend-down | Range | Stress | Unknown |
|---|---|---|---|---|---|

## 8. Overlap and incremental value
Symbol/date overlap matrix, daily return correlation, incremental OOS value, merge/retire recommendations.

## 9. Trial registry
Total trials N = `<fill>`. Registry path: `<fill>`. Variants tested per engine.

## 10. Top 10 ways these results could still be wrong
| # | Risk | Mitigation in place | Open action |
|---|---|---|---|
| 1 | | | |

## 11. Limitations
These are research results, not investment advice. Past backtests do not guarantee future results.
