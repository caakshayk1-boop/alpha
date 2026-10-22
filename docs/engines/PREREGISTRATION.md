# PREREGISTRATION: Frozen Before Out-of-Sample Evaluation

- Rules version: `v1.0.0`
- Commit SHA: `<fill>` · File SHA-256: `<fill>`
- Owner approval: `<name, date>`

Any change after this commit creates a new version, logged in DECISIONS.md, and voids prior qualification.

## 1. Engine definitions
Link to configs/engines/E1–E6.yaml with exact indicator formulas, lookbacks, triggers, invalidation, exits and ranking.

## 2. Regime model
Inputs, thresholds, hysteresis/transition rule, UNKNOWN handling, development period used to freeze definitions.

## 3. Execution and cost model
Fill rule, chase limit, expiry, gap handling, same-bar rule, itemised costs (each with source URL and access date).

## 4. Exit variants
Baseline (no partials) and one challenger (30% at 1.5R / 30% at 2.5R / 40% at 4R or earlier trailing/time exit). No others without a new version.

## 5. Sizing limits
0.25% risk per position · ≤ 1.5% total open risk · ≤ 6 positions · ≤ 25% per sector · no leverage · ADV cap `<fill>`.

## 6. Data splits
| Segment | Dates | Use |
|---|---|---|
| Development | | Freeze definitions |
| Walk-forward folds | | Purge `<n>` / embargo `<n>` sessions per horizon |
| Legacy holdout | | **INSPECTED**: historical only |
| Prospective paper | Start `<date>` | Immutable ledger |

## 7. Promotion policy (mirror of promotion_policy.yaml)
- Net OOS dependence-aware lower confidence bound > 0 (block bootstrap, block length `<fill>`)
- DSR using registry trial count N > `<fill>`
- PBO (CSCV) < `<fill>`
- Parameter-neighbourhood stability: `<rule>`
- Max drawdown ≤ `<fill>` · capacity ≥ `<fill>`
- Required independent observations from power analysis: `<fill>`
- Paper vs backtest agreement tolerance: `<fill>`
- Failing any criterion → RESEARCH (never PASS)
