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
Command: `engines/phase0.py` on GitHub Actions (`.github/workflows/engines_phase0.yml`, run 39705031021, commit f5704e5, rules
`swing-2.0.0`), universe = the screen at trading-dashboard `31d8822` (the one the original run read), window 2019-10-21 to
2026-10-21. Snapshot SHA-256 `a513d759ca19c68d013e9e004b93767f8b092991e5036e09c5dda69cfa266dbb` (artifact `phase0-snapshot`,
90 days). Bars hash (`trial_registry.bars_hash`) `ee2d01e79af3a009…`; full values in `engines/research/phase0/reproduction.json`.

| Metric | Displayed | Reproduced | Match? | Command | Data hash |
|---|---|---|---|---|---|
| Market gate conditions met | 1/4 | 1/4 on 2026-10-19 (VIX only) | YES | phase0.py · gate_funnel.csv | ee2d01e7… |
| Gate on, last 136 sessions | 0% | 0 of 136 (2026-04-02 to 2026-10-19), 136 of 136 sessions agree with the published history | YES | phase0.py | ee2d01e7… |
| Holdout trades | 49 | 49 | YES (exact) | phase0.py | ee2d01e7… |
| Holdout expectancy | −0.06R | −0.063R | YES | phase0.py | ee2d01e7… |
| Holdout PF | 0.90 | 0.90 | YES | phase0.py | ee2d01e7… |
| Month-clustered t | −0.91 | −0.91 | YES | phase0.py | ee2d01e7… |
| No-gate trades | 162 | 163 | **NO** (+1) | phase0.py | ee2d01e7… |
| No-gate expectancy | −0.26R | −0.261R | YES (within rounding) | phase0.py | ee2d01e7… |
| No-gate PF | 0.60 | 0.60 | YES | phase0.py | ee2d01e7… |

Not displayed but checked: development trades 268 vs 267 published (+1); no-gate holdout clustered t −3.41 vs −3.35.
On today's screen instead of the original one: no-gate 164, development 268 (run 39704019508).

**Verdict: FAIL on the exact-count criterion, by one trade in two books.** The displayed rules-book figures reproduce exactly. The
residual is the universe: 941 usable symbols now against 940 in the original run. `data.download` silently drops a chunk after
three failed attempts and drops any symbol with fewer than 120 bars, and the original run kept no snapshot, so the missing symbol
cannot be identified. **STOP (CLAUDE_TASK Phase 0):** no new engine is built on that data path. New work runs only on a hashed
snapshot (`phase0-snapshot`, or its successor), never on a fresh unpinned download.

Further defects found while reproducing:
- **Incomplete bar.** The original run started 05:07 UTC on 21 Oct, which is 10:37 IST, during the session, and recorded
  `data_through 2026-10-21`. Its last bar was an intraday bar. Including or excluding the (now complete) 21 Oct bar leaves every figure
  unchanged, so the partial bar is unlikely to have moved this result; that cannot be proven, and nothing in the backtest prevents it.
- **Lookahead in group benchmarks** (found by `tests/test_integrity.py`, future-poison): `common.Ctx` judged each stock's
  liquidity for its group index on the LAST 250 bars of the download, so membership in 2019 depended on 2026. Fixed in
  `swing-2.0.1` (DECISIONS #2); 2.0.1 has its own registered research run. The ML engines used the same `Ctx` and carry the same
  defect in their recorded results.

## 0% gate diagnosis
The 0% is the market, not the code. Every one of the 136 sessions failed the trend check: Nifty closed below its 200-day average
on all 136 (2 Apr: 22,713 vs 25,207; 19 Oct: 22,889 vs 24,174), and the 200-day average was not rising over 20 sessions on any of
them. Per-check passes in the window: trend 0, Nifty above 50-day 59, breadth ≥ 50% 97, VIX ≤ 20 131. Sessions by checks passed:
0 → 4, 1 → 36, 2 → 37, 3 → 59, 4 → 0. Funnel per session: `engines/research/phase0/gate_funnel.csv`.

| Check | Result | Evidence |
|---|---|---|
| Index symbol mapping | PASS | `^NSEI`; rebuilt 19 Oct close 22,888.95 and 200-day 24,174.48 equal the published "Nifty 22,889 · 200-day 24,174" |
| Date/timezone alignment | PASS with note | tz-naive exchange dates; 3 stock dates without a Nifty bar (2019-10-27 and 2020-11-14 are weekend dates, probably Diwali muhurat sessions; 2026-01-15 unexplained), none in the window |
| Adjustment policy | NOTE | gate and backtest read exchange-price (split-only) bars; dividends are not removed, so a stock's 50-day test shifts by the dividend at ex-dates. The index test uses `^NSEI`, a price index |
| Breadth denominator (point-in-time) | FAIL (survivorship) | denominator = today's screened universe with 50 bars (924–941 in the window). Delisted and dropped names are absent; historical constituents not available (MISSING row 3). Breadth did not decide the 0%: the trend check failed on every session regardless |
| 200-day warm-up | PASS | first valid 200-day average 2020-08-11; no null inside the window |
| Null handling | PASS | VIX missing on 17 sessions in the history before forward-fill, none in the window after it; a null VIX fails its check, never passes it |
| Exchange calendar | NOTE | sessions are Nifty's own dates; no NSE holiday calendar, so a missing Yahoo bar and a holiday look alike. 0 thin sessions in the window |

The holdout above has been **INSPECTED**. It is historical evidence only and must never be called untouched.
