# RESEARCH_REPORT: Alpha Signal Engines

> **Honest summary:** no engine qualified. Under the owner-approved, frozen pre-registration (v1.0.0, commit `af7c35a`), E1–E5 were
> evaluated once on four walk-forward folds (2023–2024) net of itemised NSE costs, with unseen 2010–2019 history held for confirmation
> and the inspected 2025–26 holdout reported separately. All five stay **RESEARCH** and E6 stays **BLOCKED_DATA**.
> - **E1 (relative-strength continuation)** is the only engine worth more work: +0.30R over 64 walk-forward trades, PF 1.42. It beats
>   matched random entries (−0.18R) and an exposure-matched Nifty, survives 2× costs (+0.24R) and a one-session delay, and is stable
>   across the parameter neighbourhood. But the confidence interval includes zero, DSR is 0.11, the sample is 64 of the 891 trades the
>   power analysis requires, unseen 2010–19 history gives only +0.09R, the inspected 2025–26 period is −0.08R, and survivorship
>   flatters a momentum engine most.
> - **E2 (compression breakout)** is indistinguishable from zero and turns negative at 2× costs: merge into E1 or retire.
> - **E3 (orderly pullback) and E4 (residual reversion) are negative in every period.** E4 lost 28% of equity across 881 walk-forward
>   trades, so retire both.
> - **E5 (range reclaim)** is about zero to negative, with too few trades.
> - **PBO across the eight configurations is 0.53**, which is what selecting among noise looks like.
>
> The book trades nothing new until an engine passes. The prospective paper ledger now runs nightly (dry run), and the site shows
> the four views as "not published" until the owner authorises publishing.

Run of record: `engines-v3` workflow, data through 2026-10-21, 890 symbols, bars hash `cfa0e433e76dd3eb…`
(full value in `engines/research/v3/results.json`), snapshot artifact `v3-snapshot` (SHA-256 in `engines/research/v3/snapshot.sha256`),
evidence hash `99db61b581b0a09c…` binding the frozen files.

## 1. Legacy audit summary
See LEGACY_AUDIT.md.
- **Reproduction:** Swing v2's displayed figures reproduce exactly, but two books are one trade off. That fails the exact-count rule,
  so the unpinned data path was STOPPED; v3 runs only on a hashed snapshot.
- **The 0% gate is the market:** Nifty closed below its 200-day average on all 136 sessions.
- **Lookahead found and fixed:** the group-benchmark lookahead was corrected in swing-2.0.1, whose corrected holdout (t −0.62) shows no edge.

## 2. Data and universe
- **Source:** Yahoo Finance daily bars via yfinance, with exchange (split-adjusted) prices for levels, fills and stops, and
  dividend-adjusted closes for returns, momentum and residuals. Nifty is `^NSEI` and India VIX is `^INDIAVIX`.
- **Universe:** today's screened companies (survivorship: delisted names are absent). 890 symbols had at least 260 bars.
- **Window:** `period=max` reaching 2010 for most names. No point-in-time constituents, corporate-action file, circuit or suspension
  history, or event timestamps exist (MISSING_DATA_AND_ACCESS rows 1–6).
- **Bar handling:** a run drops any bar dated today in IST before 18:00, so no intraday bar is read as a close. A bar with an
  unexplained overnight move beyond 40% is excluded as unclean.

## 3. Exclusion funnels
| Engine | Available | Clean | Liquid | Setup | Context-compatible | Executable (WF book) | Portfolio-selected (WF trades) |
|---|---|---|---|---|---|---|---|
| E1 | 2,537,234 | 2,537,185 | 1,105,730 | 2,303 | 1,877 | 1,849 of 1,877 (cancelled at the open 28) | 64 |
| E2 | 2,537,234 | 2,537,185 | 1,105,730 | 6,304 | 5,770 | 5,704 of 5,770 (cancelled at the open 66) | 160 |
| E3 | 2,537,234 | 2,537,185 | 1,105,730 | 310 | 244 | 238 of 244 (cancelled at the open 6) | 64 |
| E4 | 2,537,234 | 2,537,185 | 752,241 | 14,608 | 10,676 | 10,528 of 10,676 (cancelled at the open 148) | 881 |
| E5 | 2,537,234 | 2,537,185 | 1,105,730 | 4,773 | 2,249 | 2,222 of 2,249 (cancelled at the open 27) | 69 |
| E6 | BLOCKED | — | — | — | — | — | — |


Executable = filled at the next open (cancelled when the open was at or below the stop or above the chase limit). Portfolio-selected
counts walk-forward trades only; the rest were blocked by one-position-per-symbol, the six-position / 1.5% risk limits or sizing.

## 4. Validation results (walk-forward OOS, net of costs)
### Walk-forward OOS (2023-01-01 to 2024-12-31), net of costs-1.0.0, baseline exits
| Engine | N | Indep. months | Net exp. (R) | 95% CI daily book return (%) | PF | Win % | Max DD (% equity) | ES (worst 5%, R) | Book return % | Exposure % | DSR | PBO (all 8 configs) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E1 | 64 | 21 | +0.297 | [-0.00591, 0.0329] | 1.423 | 37.5 | -3.194 | -3.258 | 6.503 | 13.07 | 0.1088 | 0.5287 |
| E2 | 160 | 22 | +0.014 | [-0.01238, 0.01774] | 1.046 | 30.0 | -2.48 | -1.048 | 1.054 | 13.55 | 0.0173 | 0.5287 |
| E3 | 64 | 21 | -0.156 | [-0.01737, 0.00884] | 0.753 | 39.1 | -4.698 | -1.160 | -2.229 | 4.83 | 0.0007 | 0.5287 |
| E4 | 881 | 23 | -0.128 | [-0.09307, -0.02145] | 0.663 | 43.2 | -27.987 | -1.306 | -28.164 | 39.16 | 0.0 | 0.5287 |
| E5 | 69 | 9 | -0.057 | [-0.01473, 0.00819] | 0.859 | 50.7 | -2.996 | -1.167 | -1.376 | 8.36 | 0.0065 | 0.5287 |
| Combined book | 249 | 23 | -0.070 | [-0.03302, 0.01965] | 0.851 | 42.2 | -9.051 | -2.014 | -3.144 | 22.02 | — | — |
| E6 | BLOCKED | | | | | | | | | | | |


Promotion requires all of: net lower confidence bound > 0, DSR ≥ 0.95, PBO < 0.20, ≥ 80% of neighbours positive, max drawdown ≤ 10%,
2× costs positive, one-session delay positive, beating matched random entries and the exposure-matched Nifty, and ≥ 891 trades.
Each engine's failures are listed in `engines/research/v3/results.json` (`engines.E*.why`). The daily-return CI uses realised P&L
on exit dates (no mark-to-market), so it understates intra-trade drawdown.

## 5. Robustness
### Robustness (walk-forward, expectancy in R)
| Engine | Base | Broker stress | 2x costs | +1 session delay | Challenger exits | Neighbourhood (pad 0.20 / 0.30, time -20% / +20%) |
|---|---|---|---|---|---|---|
| E1 | +0.297 | +0.271 | +0.240 | +0.656 | +0.160 | +0.309 / +0.293 / +0.356 / +0.402 |
| E2 | +0.014 | -0.010 | -0.044 | +0.042 | +0.020 | +0.015 / +0.014 / +0.002 / +0.015 |
| E3 | -0.156 | -0.179 | -0.260 | -0.422 | -0.072 | -0.139 / -0.116 / -0.113 / -0.171 |
| E4 | -0.128 | -0.181 | -0.244 | -0.131 | n/a (baseline only) | -0.140 / -0.119 / -0.128 / -0.132 |
| E5 | -0.057 | -0.090 | -0.150 | +0.214 | n/a (baseline only) | +0.025 / -0.052 / -0.021 / -0.064 |


## 6. Baselines
### Baselines (walk-forward)
| Engine | Strategy book % | Cash % | Exposure-matched Nifty % | Strategy exp. (R) | Matched random entry exp. (R) |
|---|---|---|---|---|---|
| E1 | 6.503 | 0.0 | 3.222 | +0.297 | -0.179 |
| E2 | 1.054 | 0.0 | 3.014 | +0.014 | -0.040 |
| E3 | -2.229 | 0.0 | -0.62 | -0.156 | -0.517 |
| E4 | -28.164 | 0.0 | 9.408 | -0.128 | -0.039 |
| E5 | -1.376 | 0.0 | 2.058 | -0.057 | -0.189 |


### Every segment (baseline exits, net expectancy in R, N)
| Engine | Unseen 2010-19 | Development 2019-22 | WF 2023H1 | 2023H2 | 2024H1 | 2024H2 | Inspected 2025-26 |
|---|---|---|---|---|---|---|---|
| E1 | +0.089 (229) | +0.338 (80) | +1.038 (16) | +0.305 (17) | +0.629 (11) | -0.486 (20) | -0.081 (42) |
| E2 | -0.025 (569) | +0.059 (214) | +0.030 (58) | +0.133 (48) | -0.023 (16) | -0.143 (38) | -0.091 (109) |
| E3 | -0.362 (55) | -0.442 (58) | +0.378 (14) | -0.031 (16) | -0.351 (13) | -0.485 (21) | -0.446 (60) |
| E4 | -0.118 (1999) | -0.159 (966) | -0.078 (219) | -0.033 (240) | -0.160 (188) | -0.247 (234) | -0.261 (508) |
| E5 | -0.045 (336) | +0.066 (113) | -0.020 (37) | +0.477 (6) | — (0) | -0.233 (26) | -0.260 (150) |


## 7. Regime breakdown
### Regime breakdown (walk-forward, baseline: exp. R (N))
| Engine | Trend-up | Trend-down | Range | Stress | Unknown |
|---|---|---|---|---|---|
| E1 | +0.331 (45) | — (0) | +0.215 (19) | — (0) | — (0) |
| E2 | -0.013 (100) | — (0) | +0.059 (60) | — (0) | — (0) |
| E3 | -0.216 (50) | — (0) | +0.061 (14) | — (0) | — (0) |
| E4 | -0.167 (633) | — (0) | -0.029 (248) | — (0) | — (0) |
| E5 | — (0) | — (0) | -0.057 (69) | — (0) | — (0) |


"Paper-only" regimes (E3 range, E4 trend-up) are kept and flagged by the runner and therefore included in the walk-forward book:
E4's 633 trend-up trades are in its −0.128R. Its active range cohort alone is still negative (−0.029R, 248), so no verdict changes;
a re-run will keep paper-only cohorts out of promotion evidence. No walk-forward session was classified stress or trend-down.

## 8. Overlap and incremental value
### Overlap (Jaccard of symbol-date candidates) and incremental value
| | E1 | E2 | E3 | E4 | E5 | Incremental WF Sharpe (combined with minus without) |
|---|---|---|---|---|---|---|
| E1 | 1.0 | 0.0861 | 0.0 | 0.0002 | 0.0 | +0.0734 |
| E2 | 0.0861 | 1.0 | 0.0 | 0.0002 | 0.0 | -0.0040 |
| E3 | 0.0 | 0.0 | 1.0 | 0.0028 | 0.0 | -0.0001 |
| E4 | 0.0002 | 0.0002 | 0.0028 | 1.0 | 0.0066 | -0.0701 |
| E5 | 0.0 | 0.0 | 0.0 | 0.0066 | 1.0 | -0.0026 |

E1 and E2 overlap most (Jaccard 0.086); the others barely overlap. Only E1 adds value to the combined book (+0.073 daily Sharpe).
**Recommendation:**
- Keep E1 in RESEARCH and paper.
- Merge E2's compression filter into E1 as a challenger in a future version, or retire E2.
- Retire E3 and E4.
- Keep E5 in paper for a forward sample.
- Leave E6 blocked until point-in-time event data exist.

## 9. Trial registry
`engines/research/trials.jsonl`: every evaluated configuration is appended (E1–E5 baseline, challenger and four neighbours each,
plus the legacy Swing runs). DSR uses each engine's registry count as N. Variants tested per engine: baseline exits; challenger
partials (E1–E3); stop pad 0.20/0.30 ATR; time stop ±20%.

## 10. Top 10 ways these results could still be wrong
See the adversarial review below (independent reviewer, read-only).

## 11. Limitations
These are research results, not investment advice. Past backtests do not guarantee future results. Survivorship, the absence of
point-in-time constituents and corporate-action files, realised-basis daily returns and small walk-forward samples all limit what
any figure above can show.
