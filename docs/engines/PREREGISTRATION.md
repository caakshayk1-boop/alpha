# PREREGISTRATION: Frozen Before Out-of-Sample Evaluation

> **Status: APPROVED and FROZEN.** Approved by the owner on 2026-10-22 before any E1–E5 code existed or any result was computed.
> Every number is a research hypothesis, not a tested optimum. The frozen files and their SHA-256 are listed in
> `configs/engines/FROZEN.sha256`; the freeze commit is recorded in DECISIONS.md #5.

- Rules version: `v1.0.0`
- Commit SHA: see DECISIONS.md #5 (a file cannot contain the hash of the commit that adds it) · File SHA-256: `configs/engines/FROZEN.sha256`
- Owner approval: `owner (caakshayk1-boop), 2026-10-22, in session`

Any change after this commit creates a new version, logged in DECISIONS.md, and voids prior qualification.

## 1. Engine definitions
`configs/engines/E1.yaml` … `E6.yaml` (and `regime.yaml`), transcribed from spec §3, frozen with this file. Two rules the spec
leaves to "a development-frozen rule" were fixed here BEFORE any data was read: a plan is rejected when its stop is more than 10%
or less than 1% below the entry, and E3's pullback starts at the first lower close after the most recent 10-session high. E6 is `BLOCKED_DATA` (no point-in-time announcement timestamps or
statements; MISSING_DATA_AND_ACCESS rows 1–2).

## 2. Regime model (proposed)
Inputs from the latest COMPLETED session only (never a bar formed during the session):
- Trend-up: Nifty > SMA200, SMA50 > SMA200, 60-session return > 0.
- Trend-down: Nifty < SMA200, SMA50 < SMA200, 60-session return < 0.
- Stress: 20-session realised volatility (annualised) above the 90th percentile of the preceding 504 sessions, or India VIX above
  the 90th percentile of its preceding 504 sessions. Stress overrides the two trend states.
- Range: anything else.
- UNKNOWN: any input missing or stale. UNKNOWN is never read as bearish or as zero.
- Hysteresis: the published state changes only after 3 consecutive sessions classify the same new state.
- Breadth (contemporaneous constituents) is a feature, not a state input, until historical constituents exist (MISSING row 3).
- Frozen on development data (2019-10-21 to 2022-12-31) by inspection of state durations only, never of returns.

## 3. Execution and cost model
- Fill at the next-session open plus half-spread and slippage (`configs/engines/costs.yaml`, `costs-1.0.0`).
- Cancel the entry if the open is at or below the stop, or above the chase limit (signal close + 0.5 ATR(14)). Entry window: the
  next session only; then the plan expires.
- Gap-through stops fill at the open. Stop and target in the same bar: stop first, flagged `ambiguous_bar`.
- Itemised statutory costs, each from an official source accessed 2026-10-22: STT 0.1% buy and sell, stamp duty 0.015% buy,
  NSE transaction charge ₹307/crore each side (NSE/FA/73061, from 2026-03-01), SEBI fee ₹10/crore each side, GST 18% on brokerage
  and fees. Statutory round trip 0.2225%. Brokerage and DP: base case 0 (the owner dropped the broker question, 2026-10-22); every
  result is also reported with a stress of ₹20 per order plus ₹15.93 DP per sell.

## 4. Exit variants
Baseline (no partials) and one challenger per family: trend engines 30% at 1.5R / 30% at 2.5R / 40% at 4R; reversion and range
engines the spec's normalisation or range targets. No other variant without a new version.

## 5. Sizing limits
0.25% risk per position · ≤ 1.5% total open risk · ≤ 6 positions · ≤ 25% per sector · no leverage · position ≤ 1% of the
20-session median traded value (ADV cap).

## 6. Data splits
| Segment | Dates | Use |
|---|---|---|
| Unseen history | 2010-01-01 to 2019-10-20 | Never used by any engine so far. Confirmation run ONCE after walk-forward; never for tuning |
| Development | 2019-10-21 to 2022-12-31 | Freeze definitions (regime durations, stop-distance rejection rule) |
| Walk-forward folds | 2023-01-01 to 2024-12-31, 4 half-year folds | Purge = the engine's maximum hold (E1 60, E2 25, E3 15, E4 7, E5 15 sessions) · embargo 10 sessions |
| Legacy holdout | 2025-01-01 to 2026-10-21 | **INSPECTED** (Swing v2 and ML engines read it): historical evidence only, never called untouched |
| Prospective paper | From the owner-approval date | Immutable, hash-chained ledger |

Survivorship: the universe is today's screened companies (MISSING row 3). Every result carries that caveat until historical
constituents are sourced; long-horizon engines (E1) are the most flattered by it.

## 7. Promotion policy (mirror of `configs/engines/promotion_policy.yaml`, APPROVED)
- Net OOS lower 95% confidence bound > 0 (stationary block bootstrap, mean block 21 sessions, 10,000 resamples, fixed seed)
- DSR probability ≥ 0.95 using the registry trial count N (`engines/research/trials.jsonl`)
- PBO (CSCV, 16 blocks) < 0.20
- Parameter neighbourhood: each parameter ±20% one at a time; ≥ 80% of neighbours net positive
- Max drawdown ≤ 10% of equity · capacity: position ≤ 1% of 20-session median traded value at a ₹10 lakh paper book
- Required independent observations from power analysis: 891 (effect 0.10R, sd 1.2R, one-sided α 0.05, power 0.80)
- Paper vs backtest: ≥ 30 prospective paper trades, net expectancy inside the backtest 95% CI, median fill slippage ≤ 0.20%
- Failing any criterion → RESEARCH (never PASS)
