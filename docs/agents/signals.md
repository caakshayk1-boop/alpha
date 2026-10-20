# Signals agent: how a signal is made, and whether fewer of them would be better

Branch `worktree-agent-ab96eedbfb0f3c326`, based on `08b1419` (v4-2026-10-20). Written 20 Oct 2026.
The site never places trades. Every engine is a research model and every trade below is paper.

## 1. The mechanism, reverse-engineered from the code

All paths are under `engines/`. Line numbers are at `08b1419`.

### Features (what the models see)
* One row per (date, stock). Every value at date t uses bars up to and including t, trailing windows only (`features.py:3-4`).
* 58 inputs, not the 59 the engine copy says (`ai_engines.py:46` says 59; `features.py:124-132` lists 36 + 5 + 7 + 10 = 58, and
  `research/ai_results.json` publishes `"features": 58`):
  * price and risk: returns over 1/5/10/21/63/126 days, 12-1 month momentum, volatility 21/63 and their ratio, downside
    volatility, ATR %, distance from 52-week high/low, distance from 20/50/200-day averages in ATRs, 50-day slope, RSI 14 and 2,
    MACD, stochastic, Bollinger position and width percentile, ADX, 63-day drawdown, share of up days (`features.py:34-60`);
  * volume: volume ratios, log of the 20-day median traded value (`turnover`), Amihud illiquidity, OBV slope, close location,
    gaps, candle bodies (`features.py:61-71`);
  * sector: stock vs its own benchmark over 21/63 days, benchmark momentum vs Nifty, benchmark vs its 50-day, benchmark trend
    (`features.py:73-85`). Benchmarks are Nifty IT / Pharma / Bank where Yahoo has them, otherwise a leave-one-out
    equal-weighted index of the stock's industry or sector (`common.py:205-272`);
  * market: Nifty 21/63-day return, Nifty vs 200-day, Nifty volatility, universe breadth (share above 50-day), dispersion,
    median 21-day return (`features.py:90-118`);
  * cross-sectional percentile of 10 key features each day (`features.py:26, 119-120`).
* A stock is `liquid` when its 20-day median traded value is at least Rs 1 crore (`common.py:61-65`). Only liquid rows are
  trained on, scored and benchmarked.

### Labels (what the models are asked to predict)
* `fwd_H` = close at t+H over the NEXT open (`labels.py:22-27`). `excess_H` is that minus the median of liquid stocks that
  day; `rank_H` its same-day percentile (`labels.py:66-72`).
* `rank_gr_21`: the same, inside the stock's own benchmark group, groups under 5 liquid members dropped (`labels.py:76-88`).
* `barrier`: 1 if +3 ATR is touched before -1.5 ATR within 15 sessions of the next open, ties to the stop (`labels.py:30-51`).

### Models (five engines, `ai_engines.py:43-68`)
| Engine | Target | H | Stop | Targets (R) | Time stop | Risk cap | Cooldown |
|---|---|---|---|---|---|---|---|
| Rank | `rank_21` | 21 | 2.0 ATR | 1 / 2 / 3.5 | 25 | 12% | 21 |
| Barrier | `barrier` (classifier) | 15 | 1.5 ATR | 1 / 2 / 3.5 | 15 | 10% | 15 |
| Relative | `rank_gr_21` | 21 | 2.0 ATR | 1 / 2 / 3.5 | 25 | 12% | 21 |
| Snapback | `rank_5` | 5 | 1.2 ATR | 0.8 / 1.5 / 2.5 | 7 | 6% | 5 |
| Compounder | `rank_126` | 126 | 3.0 ATR | 1.5 / 3 / 5 | 126 | 18% | 63 |

All are scikit-learn `HistGradientBoosting` with fixed hyperparameters (depth 4, lr 0.06, 200 iterations, min leaf 300, L2 2.0,
seed 0) (`walkfwd.py:17-18`). `picks_per_day` = 3 for all; `min_score` = None for all, so there is no absolute score bar.

### Walk-forward and holdout
* Test predictions start 2023-01-02; the model is refit every 63 sessions on an expanding window; training rows are every 3rd
  session; training stops H+1 sessions before each test block (embargo) (`walkfwd.py:42-62`, `walkfwd.py:31-39`).
* DEVELOPMENT 2023-01-01 to 2025-03-31, HOLDOUT 2025-04-01 onwards (`walkfwd.py:20`, `ai_finalize.py:26-28`).
* The script that writes the walk-forward predictions (`pred_e*_dev.pkl`) is **not in the repo**: `ai_finalize.py:4,25,118` reads
  them from a scratch folder. I rebuilt them from `walkfwd.walk_forward`'s defaults (section 2).
* Live, a separate final model per engine is trained every evening on every fully labelled row and scores the last three
  sessions (`ai_run_daily.py:36-48`). The published backtest numbers come from the walk-forward models, not this one.

### From a ranking to a signal
* Each session, the stocks are sorted by score; the top `picks_per_day` = 3 that (a) have a bar that day, (b) are outside the
  engine's own cooldown for that stock, and (c) get a valid plan become signals (`ai_trades.py:28-59`).
* So every signal has a same-day percentile of 99.7 or more; `score_percentile` in the feed is that percentile
  (`ai_run_daily.py:148, 154`). A "stricter percentile" filter therefore cannot be expressed as a percentile; I tested it as a
  same-day rank and as an absolute score bar instead.
* Plan: risk = min(stop_atr x ATR14, price x max_risk_pct); refused under 0.5% of price; stop = close - risk; targets = close +
  R x risk (`ai_trades.py:17-25`).
* Live, the evening run scans only sessions it has not seen (at most five) (`ai_run_daily.py:136-138`) and hands candidates to
  the registry, which enforces **one active trade per stock across all engines**: a later signal on a stock that already has a
  pending or open trade is recorded as "also selected by" and not issued (`registry.py:7-8, 90-94`; owner priority
  snapback > relative > rank > compounder > barrier, `registry.py:22`). **The backtest does not apply this rule**, so the live
  trade set is a subset of the tested one.

### Exits (one implementation for backtest and live, `common.py:68-121`)
* Entry at the next open. Void if that open is at or past T1 or at or below the stop, or if risk is over 20% or under 0.4%
  of entry (`common.py:85-89`).
* Thirds at T1, T2, T3. Stop moves to entry after T1, to T1 after T2. A gap through the stop fills at the open; a bar that
  touches both counts as the stop. Time stop: exit the rest at the close of bar `max_hold`.
* Cost 0.25% of entry, round trip, charged in R: r = gross_r - 0.0025 x entry / risk (`common.py:20, 133`).
* Trades the data has not closed are left out of the backtest (`common.py:128-129`).

### Verdicts and the alert rule (`ai_finalize.py:52-103`)
* Ranking: EDGE SHOWN needs holdout IC t >= 2 and the top-300-by-turnover check positive with t >= 2; LEANING POSITIVE if IC > 0
  in both periods otherwise.
* Trading: PROFITABLE AFTER COSTS needs holdout expectancy > 0.05R **and** month-clustered t >= 2; POSITIVE, NOT SIGNIFICANT is
  > 0.05R with t < 2.
* Alerts (`alertable`) are on when ranking is EDGE SHOWN or LEANING POSITIVE **and** trading is PROFITABLE or POSITIVE, NOT
  SIGNIFICANT (`ai_finalize.py:92-103`). So alerts are switched on for results whose own month-clustered t is below 2: in
  the committed `research/ai_results.json`, Rank (t 1.42), Relative (0.91) and Compounder (1.41) are alertable. The sender
  lives outside this repo; the site reads the flag (`src/components/AiTools.tsx:198`).

### Look-ahead and bias notes found while reading
* Benchmark group membership is decided from each stock's liquidity over the **last** 250 sessions (`common.py:207`) and from
  today's universe and sector labels (`data.py:23-28`). That feeds the sector features of earlier dates. It is a small leak
  of today's information into the past, on top of the survivorship bias the design note already states
  (`research/AI_DESIGN.md`, "Known biases").
* Labels and the walk-forward embargo are tested (`tests/test_ai.py` sections 1-4).

## Progress log
* 2026-10-20 23:48 bars downloaded (941 symbols, Nifty through 2026-10-19, 3 NSE sector indices).
* 2026-10-20 23:50 panel rebuilt: 1,295,914 rows x 59 columns. Walk-forward predictions: Rank, Barrier done; Relative,
  Snapback, Compounder running.
* 2026-10-21 all five walk-forward prediction sets built (1,207 s). Phase 1 trade records: 8,188 development, 5,435 holdout.
* 2026-10-21 development-only selection frozen (section 2). Holdout not yet read for any filter.

## 2. Fewer, better signals: protocol and development results

### Reproduction (route 2 for every published number)
The pipeline that writes `pred_e*_dev.pkl` is not in the repo, so I rebuilt it: fresh 7-year Yahoo bars (941 of the screen's
symbols, Nifty through 2026-10-19), `features.build_panel`, `labels.build_labels`, `walkfwd.walk_forward` with its defaults for each
engine, then `ai_trades.signals_from_scores` -> `simulate_all`, exactly as `ai_finalize.py:127-133`. Scripts (scratch, not committed):
`fetch.py`, `build.py`, `trades.py`, `filters.py`, `dev.py`, `holdout.py`.

| Engine | Period | Published n / exp R / clustered t | Rebuilt n / exp R / clustered t |
|---|---|---|---|
| Rank | dev | 1658 / +0.131 / 1.72 | 1652 / +0.139 / 1.83 |
| Rank | holdout | 1098 / +0.165 / 1.42 | 1111 / +0.142 / 1.34 |
| Barrier | dev | 1645 / +0.075 / 1.20 | 1650 / +0.058 / 1.05 |
| Barrier | holdout | 1103 / -0.041 / -1.00 | 1118 / -0.073 / -1.00 |
| Relative | dev | 1657 / +0.148 / 1.86 | 1658 / +0.160 / 2.07 |
| Relative | holdout | 1098 / +0.179 / 0.91 | 1106 / +0.152 / 1.19 |
| Snapback | dev | 1610 / +0.065 / 1.60 | 1591 / +0.094 / 2.19 |
| Snapback | holdout | 1094 / +0.018 / -0.05 | 1113 / -0.050 / -1.05 |
| Compounder | dev | 1642 / +0.529 / 3.60 | 1637 / +0.577 / 3.78 |
| Compounder | holdout | 969 / +0.251 / 1.41 | 987 / +0.294 / 1.23 |

Close but not identical: the universe is 941 symbols, not 950, and the data runs ten days longer. Snapback's holdout flips from
+0.018R to -0.050R, which says how fragile that engine's result is. Every filter below is compared against the REBUILT unfiltered
set, so the comparison is like for like.

### Protocol (fixed before the holdout was read)
* Unit: all five engines' backtest trades pooled. The conviction tier is one rule over the feed, so one pooled test per rule.
* A filter only TAGS existing signals; it never changes which signals the engines issue.
* For each family, the threshold is the grid point with the highest month-clustered t on DEVELOPMENT among points keeping at
  least 300 development trades. Then the holdout is read once for that one threshold.
* Pass on the holdout: at least 30 trades, expectancy above the unfiltered pooled holdout, and month-clustered t >= 2.
  Eight families are tested, so roughly one false pass in this set is plausible by chance at t >= 2; a pass is a lead, not proof.
* Barometer: its history on the live site is 22 sessions (2026-09-17 to 2026-10-19), so it cannot be backtested. The regime gate uses
  the two Barometer parts the engines already compute causally: Nifty above a rising 200-day (`common.py:193`) and breadth
  (`breadth_50`, share of liquid stocks above their 50-day, `features.py:115`).
* "Stricter score percentile" cannot work as a percentile (every signal is already above 99.7). Tested as (a) a per-engine score
  bar at a development quantile of issued scores and (b) the same-day rank (top 1 or top 2 instead of top 3).

### No look-ahead, and how it was checked
* Every filter column is taken on the signal date: the model scores of that date (walk-forward, out of sample), the plan's risk,
  the panel's trailing 20-day median turnover, that date's breadth and Nifty trend. Sector and one-per-name caps count only
  earlier accepted trades whose exit date is after the signal date (`filters._sequential`), i.e. still open at that close.
* Score bars are fixed numbers from development quantiles; the holdout never sets them.
* `dev.py` opens only `trades_development.pkl`; holdout trades are in a separate file that only `holdout.py` reads.
* `frozen.json` sha256 `a0226b4ce68e262c483b37577eace2b49aa73f380421d77f1765920d3b337524`; this section is committed before
  `holdout.py` runs.

### Development grid (pooled, unfiltered: n 8188, +0.206R, clustered t 2.80, win 56.6%)
| Family | Chosen on dev | Dev n | Dev exp R | Dev clustered t | Beats unfiltered on dev |
|---|---|---|---|---|---|
| Score bar | top third of each engine's dev scores (q 0.67) | 2702 | +0.328 | 4.05 | yes |
| Same-day rank | top 2 | 852 | +0.120 | 1.81 | no |
| Agreement | at least 1 other engine at >= 95th pct | 4544 | +0.206 | 2.88 | no (equal) |
| Regime | breadth_50 >= 0.6 | 4103 | +0.343 | 2.56 | yes |
| Liquidity | 20-day median turnover >= Rs 2 cr | 6893 | +0.180 | 2.71 | no |
| Risk cap | risk <= 8% of price | 4582 | +0.129 | 1.75 | no |
| Sector cap | at most 5 open per sector | 1736 | +0.193 | 2.91 | no |
| One per name | 1 open trade per stock, all engines | 4412 | +0.224 | 3.10 | yes |

Score bars at q 0.67: barrier 0.3692, compounder 0.5999, rank 0.5734, relative 0.5884, snapback 0.5695.
Development already rejects liquidity floors, risk caps, sector caps, same-day rank and cross-engine agreement: each one lowers
expectancy on development, and tighter versions lower it further (liquidity >= Rs 50 cr: +0.037R; agreement at the 99th pct with
3 engines: +0.025R).

## 3. The holdout, read once (2026-10-21)

`frozen.json` hash at read time: `a0226b4c...3b337524` (unchanged from section 2). Holdout signals 2025-04-01 to 2026-10-15,
last exit 2026-10-19. Expectancy is net of the 0.25% round-trip cost. "Random" = random liquid stocks on the same dates with the
same plan geometry (`ai_trades.random_baseline`). Paired t = month-by-month (filtered minus unfiltered) average R.

| Rule (from development) | Holdout n | Exp R | Clustered t (months) | Win % | Random exp R | Paired t | Pass |
|---|---|---|---|---|---|---|---|
| **Unfiltered, all five engines** | 5435 | +0.088 | 0.87 (19) | 52.1 | -0.052 | - | - |
| Score bar, top third per engine | 662 | +0.128 | 1.60 (19) | 55.6 | -0.083 | +1.39 | no (t < 2) |
| Same-day rank top 2 | 647 | +0.026 | 0.39 (19) | 54.7 | -0.111 | -0.72 | no |
| Agreement, 1+ other engine >= 95th pct | 2972 | +0.118 | 1.04 (19) | 54.1 | -0.068 | +0.65 | no (t < 2) |
| **Breadth >= 60% on signal date** | **1969** | **+0.231** | **2.05 (10)** | **56.7** | **+0.052** | **-1.32** | **yes, narrowly** |
| Liquidity >= Rs 2 cr | 4869 | +0.063 | 0.59 (19) | 51.6 | -0.087 | -3.73 | no |
| Risk <= 8% of price | 3413 | -0.026 | -0.43 (19) | 50.8 | -0.083 | -2.76 | no |
| Sector cap 5 open | 1182 | +0.031 | 0.70 (19) | 51.9 | -0.089 | -0.48 | no |
| One open trade per stock | 3186 | +0.045 | 0.50 (19) | 50.2 | -0.033 | -1.50 | no |

### What the one pass is, and why it is weak
* It passes the rule set in advance: 1969 trades (36% of the holdout), +0.231R against +0.088R unfiltered, clustered t 2.05.
* **It is market timing, not better stock picking.** It switches on for whole days: 135 of 384 holdout sessions, in 10 months
  (2025-04 to 07, 2025-09, 2026-04 to 08). Random picks on the same days also improved, from -0.052R to +0.052R. The engines'
  lead over random grew only from +0.140R to +0.179R. The paired t is negative in both periods (-2.49 dev, -1.32 holdout): in the
  months it trades, the gated trades did no better than the ungated trades of the same months.
* Fragile threshold: on development, breadth >= 0.5 gave t 0.80 and >= 0.4 gave t 1.41; only 0.6 cleared 2.
* Eight families were read, so at t >= 2 about one chance pass is expected. **Likely:** part of this pass is luck, given t 2.05 on
  10 clusters.
* By engine, under the gate: Relative +0.358R (t 2.62), Compounder +0.527R (t 2.61), Rank +0.324R (t 1.49), Barrier +0.074R
  (t 0.41), Snapback -0.097R (t -0.90). These are reported, not used: dropping engines now would be fitting to the holdout.
* Second best was the per-engine score bar (+0.128R, t 1.60, 662 trades). It is the only rule that selects stocks rather than
  days, and the only one with a positive paired t (+1.39 holdout, +3.01 dev), but it misses the bar. Rank and Compounder alone
  cleared t 2 under it (+0.313R t 2.46; +0.727R t 2.93); not acted on, for the same reason as above.
* Liquidity floors, risk caps, sector caps and one-per-name made results WORSE on both periods. The live registry already applies
  one-per-name (section 1); on this evidence that costs expectancy (+0.045R vs +0.088R holdout) rather than adding it.

### Implemented (commit `3b6958d`)
* `engines/conviction.py`: the rule, `tier(breadth) -> ('high' | 'standard', why)`, and `RULE` (wording, threshold, dates,
  development and holdout stats, four caveats).
* `engines/ai_run_daily.py`: each new candidate gets `conviction` and `conviction_why` at issue (stored in the registry like the
  plan). Registry entries issued earlier get the same rule from their signal-date breadth. `engines.json` gains top-level
  `conviction_rule`. No existing field changes meaning; no signal is dropped. End-to-end run on fresh data into scratch: top level
  adds only `conviction_rule`; signals add only `conviction`, `conviction_why` (plus `closed_date`/`exit_reason`/`r_net` from
  trades the existing tracker closed); registry 37 -> 46, none dropped.
* **Today every signal is 'standard'**: breadth was 21-33% from 2026-10-13 to 2026-10-19. The site must handle an empty high
  tier.
* `src/lib/types.ts` (`EnginesFeed`) does not yet declare the three new fields; the site agent owns that.
* Tests (`engines/tests/test_ai.py`, run by `.github/workflows/engines.yml`): boundary at 60%, unknown breadth never high, every
  tier has a reason, published stats clear the pass bar, holdout starts at `DEV_END`, and breadth up to t is unchanged when
  prices after t are rewritten.

### Recommendations, not implemented
1. Alerts: `alert_verdict` buzzes phones for POSITIVE, NOT SIGNIFICANT engines (clustered t 0.91-1.42). Requiring t >= 2 would
   switch every engine off today. That is the honest state.
2. Commit the walk-forward runner (`build.py` here) so `ai_results.json` can be reproduced from the repo.
3. Re-test the per-engine score bar once 12 more months of live data exist; it is the only stock-level filter that held its sign.
