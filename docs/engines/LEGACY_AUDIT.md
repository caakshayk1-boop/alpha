# LEGACY_AUDIT: Retired Engines and Swing V2

Rule: describe the rules **as implemented in code**, not as documented. Cite file paths, commits and data sources.

## Engine inventory
"The five retired engines" are the five ML engines retired on 21 Oct 2026 (the Signals page says so). An older rule-based
set (`engines/legacy/`: Rebound, Divergence, Breakout, Swing) was replaced by them on 12 Oct 2026 and is listed for completeness.

| Engine | Code path | Config | First / last commit | Data source | Status |
|---|---|---|---|---|---|
| Legacy 1 · Rank | `engines/ai_engines.py` (`ENGINES["rank"]`), model `walkfwd.py`, trade layer `ai_trades.py`, labels `labels.py`, features `features.py` | in code: target `rank_21`, H 21, 3 picks/day, stop 2.0 ATR, T 1/2/3.5R, hold 25 | 9d65c16 (2026-10-12) / 26b7fce (2026-10-21) | Yahoo daily bars via `data.py` (adjusted for the model; exchange prices for plans), universe = alpha's live screen | RETIRED |
| Legacy 2 · Barrier | same; `ENGINES["barrier"]` | classifier: +3 ATR before −1.5 ATR in 15 sessions, stop 1.5 ATR, hold 15 | 9d65c16 / 26b7fce | same | RETIRED |
| Legacy 3 · Relative | same; `ENGINES["relative"]` | target `rank_gr_21` inside own benchmark group, stop 2.0 ATR, hold 25 | 9d65c16 / 26b7fce | same, plus `^CNXIT`, `^CNXPHARMA`, `^NSEBANK` | RETIRED |
| Legacy 4 · Snapback | same; `ENGINES["snapback"]` | target `rank_5`, H 5, stop 1.2 ATR, T 0.8/1.5/2.5R, hold 7 | 9d65c16 / 26b7fce | same | RETIRED |
| Legacy 5 · Compounder | same; `ENGINES["compounder"]` | target `rank_126`, H 126, stop 3.0 ATR, T 1.5/3/5R, hold 126 | 9d65c16 / 26b7fce | same | RETIRED |
| Swing V2 | `engines/swing.py` (rules, `market_gate`, `scan_stock`, `walk`, `run_book`), `swing_backtest.py`, nightly `swing_run.py` | `swing.P` (29 parameters, fingerprinted by `swing.fingerprint()`), version `swing-2.0.0` | 99070aa (2026-10-21) / current | Yahoo exchange-price bars (`data.download(..., with_exchange=True)`), `^NSEI`, `^INDIAVIX`, screen universe | CURRENT |

Archive: `engines/archive/ml-2026-10-21/` holds the five engines' signal registry and last feed. Research results:
`engines/research/ai_results.json` (design fixed 2026-10-12 in `research/AI_DESIGN.md`), `engines/research/swing_results.json`.

## Per-engine findings
Holdout figures below are from `engines/research/ai_results.json` (holdout from 2025-04-01, month-clustered t over 18–19 months).
They were read once, not re-run here; no snapshot of that data exists, so they are recorded, not reproduced.

| Engine | Implemented rules (code) | Documented rules | Discrepancies | Holdout trades: n · avg R · PF · clustered t | Random baseline avg R | Failure cause |
|---|---|---|---|---|---|---|
| Rank | gradient-boosted ranker on 59 features; top 3 ranks every session become signals, ATR stop, thirds exit | as code (`AI_DESIGN.md`) | none found in the definitions; every session issues up to 3 signals regardless of market state | 1,098 · +0.165 · 1.40 · +1.42 | −0.060 | NO EDGE (not significant): IC t 2.98 holdout but trade t 1.42 < 2; survivorship flatters momentum |
| Barrier | probability classifier, top 3 | as code | — | 1,103 · −0.041 · 0.92 · −1.00 | −0.095 | NO EDGE: holdout negative |
| Relative | in-group ranker, top 3 | as code | — | 1,098 · +0.179 · 1.44 · +0.91 | −0.060 | NO EDGE (not significant) |
| Snapback | 5-day ranker, top 3, tight stop | as code | IC is the strongest (t 6.45 holdout) but does not survive the trade layer | 1,094 · +0.018 · 1.04 · −0.05 | −0.063 | NO EDGE in trades: a ranking signal that the stop/target geometry and 0.25% cost erase |
| Compounder | 126-day ranker, top 3, wide stop | as code | 126-session labels overlap heavily; development t 3.6 vs holdout 1.41; IC not computed (`None`) | 969 · +0.251 · 1.46 · +1.41 | −0.107 | UNKNOWN / likely survivorship: today's universe at a six-month horizon is the bias `AI_DESIGN.md` names; not significant |
| Swing V2 | market gate (4 checks, all required) → stock gate → Pullback or Breakout → half at 2R, lock 0.5R, trail on 10-day low, 30-session limit, 3 new/day, 10 open, 2/sector | `swing.RULES` (published on the Signals page) | backtest run 05:07 UTC = 10:37 IST on 21 Oct, so its last bar (21 Oct) was an incomplete intraday bar; breadth denominator is today's universe | 49 · −0.063 · 0.90 · −0.91 (published) | −0.302 (30 trades) | see the reproduction and gate diagnosis below |

Shared across all six: universe = today's screened companies (survivorship); costs are a flat 0.25% round trip, not the itemised
Indian schedule; no NSE holiday calendar; fills at the next open with no slippage model.

## Reproduction of displayed metrics
| Metric | Displayed | Reproduced | Match? | Command | Data hash |
|---|---|---|---|---|---|
| Market gate conditions met | 1/4 | NOT RUN | | | |
| Gate on, last 136 sessions | 0% | NOT RUN | | | |
| Holdout trades | 49 | NOT RUN | | | |
| Holdout expectancy | −0.06R | NOT RUN | | | |
| Holdout PF | 0.90 | NOT RUN | | | |
| Month-clustered t | −0.91 | NOT RUN | | | |
| No-gate trades | 162 | NOT RUN | | | |
| No-gate expectancy | −0.26R | NOT RUN | | | |
| No-gate PF | 0.60 | NOT RUN | | | |

## 0% gate diagnosis
| Check | Result | Evidence |
|---|---|---|
| Index symbol mapping | NOT RUN | |
| Date/timezone alignment | NOT RUN | |
| Adjustment policy | NOT RUN | |
| Breadth denominator (point-in-time) | NOT RUN | |
| 200-day warm-up | NOT RUN | |
| Null handling | NOT RUN | |
| Exchange calendar | NOT RUN | |

The holdout above has been **INSPECTED**. It is historical evidence only and must never be called untouched.
