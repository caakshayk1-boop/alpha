# AI engines: design, fixed before the holdout was read

Written 2026-10-12. Everything below was decided before any engine was evaluated on the holdout.

## What was built
Five gradient-boosted models (scikit-learn `HistGradientBoosting`, fixed hyperparameters, `random_state=0`) trained walk-forward
on 59 price, volume, volatility, sector-relative and market features. No fundamentals: only today's snapshot exists, and using it
to train on history would leak the future.

| Engine | Target | Horizon |
|---|---|---|
| Rank | percentile of 21-day return vs the market's median | 21 |
| Barrier | P(+3 ATR target before -1.5 ATR stop within 15 sessions) | 15 |
| Relative | percentile of 21-day return inside its OWN benchmark group | 21 |
| Snapback | percentile of 5-day return vs the market's median | 5 |
| Compounder | percentile of 126-day return vs the market's median | 126 |

A sixth, a sector-group "Rotation" model, was built and **dropped**: out of sample its information coefficient was +0.026 (t = 0.2) and its
top two groups lagged the average. It has no skill, so it is not an engine.

## How they are tested
* Walk-forward: first model trained on data ending 2022-12; refit every 63 sessions on an expanding window; each prediction made by a
  model that never saw its date. Training stops H+1 sessions before the test block (embargo), so overlapping labels cannot leak.
* Periods. DEVELOPMENT 2023-01-01 to 2025-03-31. HOLDOUT 2025-04-01 onwards. Designs were chosen once, with no tuning loop. The
  holdout was first evaluated in `ai_finalize.py`, after this file was written.
* Statistics are taken every H-th session so overlapping outcomes are not counted as independent evidence.
* Trades: top-3 ranks per session, one per stock per cooldown, next-open entry, stop and targets from the stock's ATR, thirds exit,
  0.25% round-trip cost, against random liquid stocks on the same dates with the same geometry.

## Success criteria (decided in advance)
* EDGE SHOWN: IC > 0 in both periods, holdout IC t >= 2, trade average R above the random baseline in both periods, and the
  top-300-by-turnover robustness check not negative in the holdout.
* LEANING POSITIVE: IC > 0 and trade R above baseline in both periods, but at least one criterion above not met.
* WORSE THAN RANDOM: IC < 0 and trade R below baseline in both periods.
* NO EDGE SHOWN: anything else.

## Known biases, stated up front
* SURVIVORSHIP. The stock list is today's screened universe. Companies that fell out of the index or were delisted are absent,
  which flatters momentum-type signals, most of all at long horizons. The top-300-by-turnover check is the stress test.
* THE LIVE RECORD is the only evidence that cannot have been fitted to the past.
