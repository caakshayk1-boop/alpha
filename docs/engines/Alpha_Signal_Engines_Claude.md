# Alpha Signal Engines: Design and Implementation Specification

Date: 21 October 2026, Malaysia. Scope: design and implementation specification. These are not tested strategies or investment recommendations.

> Note: Section 7 was not in the source text supplied. Sections 1–6 and 8 follow below.

## 1. Decision and evidence

Build six independently evaluated research engines instead of one universal bullish gate. Do not revive the five retired engines just to fill the page. Preserve their records and establish why each one failed.

Screenshot evidence: market gate 1/4, on during 0% of the last 136 sessions. Holdout: 49 trades, −0.06R, PF 0.90, month-clustered t −0.91. Without the gate: 162 trades, −0.26R, PF 0.60. This shows that removing that particular gate worsened that particular test. It does not show that no strategy can work. The screenshot alone cannot establish a coding bug or identify the five old engines, so verify the source and data first.

Keep three questions separate:
1. Are the data and gates implemented correctly?
2. Does a setup exist?
3. Does an engine have enough evidence for alerts?

A low count is a diagnostic, not a reason to lower validation standards. No engine has to produce a trade every day.

## 2. Architecture

Pipeline: point-in-time data → data health checks → market context → independent engine candidates → engine-specific ranking → shared portfolio constraints → paper ledger → evidence-qualified alert publisher.

Hard exclusions: stale or missing input; untradeable security; invalid corporate-action adjustment; unacceptable liquidity or cost; unknown required event timestamp; impossible stop or order; exhausted risk budget. Everything else must be identified as either a setup requirement or a ranking feature. Do not stack arbitrary mandatory indicators.

Context uses the latest completed session only:
- Nifty 20/60-day return and volatility
- 50/200-day trend
- breadth using contemporaneous constituents
- sector relative strength
- India VIX level and percentile, when available

Start with a transparent, deterministic regime model and freeze its definitions on development data. Evaluate trend-up, trend-down, range and stress separately. Missing context is UNKNOWN, not bearish or zero. Use transitions with hysteresis to avoid daily state churn. Do not fit an HMM on the full dataset and label history retrospectively.

Regime compatibility is engine-specific. Ordinary weak breadth need not automatically veto an earnings event or a stock-specific setup. Activity in stress still needs separately demonstrated performance; unvalidated stress activity stays paper-only. Cash with no new entries is a valid bear-market outcome for a long-only product.

## 3. Six engine specifications

All numbers are initial research hypotheses, not proven optimal parameters. Record every variant tested. Define indicators precisely, exclude today's bar from historical breakout levels, and compute rolling percentiles from preceding observations only. A signal formed after the close can first fill in the next session.

### E1: Relative-strength continuation (15–60 sessions)
- **Purpose:** durable leaders in rising markets, including selected strong sectors in mixed markets.
- **Baseline:** 126-session total return excluding the latest 21 sessions must be positive and in the top market quintile. Sector-neutral rank is a feature, not a filter. Trigger: close above the previous 20-session high while the 50-day average is rising.
- **Rank:** equal weight on lagged momentum percentile, sector-relative momentum percentile and inverse realised-volatility percentile. A percentile score is not a probability.
- **Invalidation:** low of the preceding 10 sessions − 0.25 ATR(14). Reject excessive stop distance under a development-frozen rule.
- **Exits:** time exit at 60 sessions. Exit the remainder on a close below the previous 20-session low, executable next session. Test partial-target variants independently.

### E2: Volatility compression breakout (5–25 sessions)
- **Baseline:** ATR(14)/close below its trailing 252-session 25th percentile (minimum 126 valid observations). Close breaks the prior 20-session high. Volume ÷ preceding 20-session median volume ≥ 1.5. Volume is a participation proxy, not proof of institutional buying.
- **Rank:** compression depth, breakout magnitude ÷ ATR and relative volume, with outliers capped.
- **Invalidation:** preceding 10-session low − 0.25 ATR.
- **Exits:** time exit at 25 sessions. Failed-breakout exit after two completed closes below the broken level. Research trend-up and range first; stress is disabled unless independently supported.

### E3: Orderly trend pullback (3–15 sessions)
- **Baseline:** close above a rising 50-day average; 63-session return above the sector median; 2–5-session decline towards the 20-day average, within ≤ 1 ATR of it; recovery close above the previous day's high. Freeze the definition of pullback start. Reject event gaps (they are routed to E6).
- **Rank:** trend strength, pullback depth ÷ ATR, and contraction in pullback volume.
- **Invalidation:** pullback low − 0.25 ATR. Primary target is the preceding 20-session high; reject if reward after costs is inadequate relative to risk.
- **Exits:** time exit at 15 sessions. Favour trend-up; mixed regimes only in validated sectors.

### E4: Residual mean reversion (2–7 sessions)
- **Purpose:** temporary stock-specific dislocation in liquid stocks during non-trending conditions. This is not an unconfirmed bottom-reversal engine.
- **Model:** regress trailing 126-session stock returns on market and sector returns using data through t−1 (≥ 100 valid observations). Standardise the latest 3-session cumulative residual against the training-window distribution of 3-session residual sums.
- **Trigger:** z ≤ −2, then a recovery close above the previous close. Requires adequate liquidity and a range-compatible market. Exclude known earnings and adverse-news windows; missing event coverage means paper-only status. A regression residual does not prove mispricing.
- **Invalidation:** dislocation-window low − 0.25 ATR.
- **Exits:** z ≥ 0, stop, or 7 sessions. Require sufficient modelled remaining reward after costs. No universal rising-200-day requirement. Inactive during uncontrolled stress.

### E5: Failed breakdown and range reclaim (3–15 sessions)
- **Baseline:** intraday low below the previous 20-session low, but the close reclaims that level and sits in the top quarter of the day's range. Requires a later completed close above the reclaim bar's high. Range context to start; trend-down cases are a separate paper research cohort.
- **Rank:** reclaim distance ÷ ATR, close location and relative volume. Exclude zero-range bars and untradeable gaps.
- **Invalidation:** failed-breakdown low − 0.25 ATR.
- **Targets:** range midpoint, then range high, frozen at signal formation. Reject if reward-to-risk after costs is inadequate.
- **Exits:** time exit at 15 sessions. Never label this a safe bottom or a guaranteed reversal.

### E6: Earnings surprise and post-event drift (5–40 sessions)
- **Data requirements:** verified exchange announcement timestamps and point-in-time financial statements. Without historical consensus, use a clearly labelled seasonal surprise: change in quarterly EPS from the same quarter a year earlier ÷ historical standard deviation of such changes known before release. Needs ≥ 8 valid prior changes, split adjustment and accounting comparability checks. Do not call it an analyst-consensus beat. A missing or near-zero denominator makes the stock ineligible.
- **Baseline:** surprise z ≥ 1, positive sector-adjusted event return and event volume ≥ 1.5× prior median. Enter only after the first full post-publication session closes, and only if next-session execution is feasible. Treat financial companies separately.
- **Invalidation:** first full post-publication session low − 0.25 ATR. Maximum 40 sessions. Wide-gap or unfillable orders expire.
- **Status:** if trustworthy event history is unavailable, build the interface and collector but keep E6 **BLOCKED**. Never simulate timestamps.

### Coverage and overlap
E1, E2 and E3 will overlap, and E4 and E5 may overlap. Measure symbol and date overlap and daily portfolio-return correlation. Allow one position per symbol, with a primary engine and supporting tags. If an engine adds no incremental out-of-sample value, merge or retire it. Do not add intraday, options, shorts or pairs trades using daily OHLC alone. Handle bear markets through risk reduction, exit warnings and labelled research setups.

## 4. Execution, stops, targets and sizing

**Fills and stops**
- Fill at the next-session open plus modelled spread and slippage.
- Cancel the entry if the open is at or below the stop, or above the chase limit (signal close + 0.5 ATR, a hypothesis). Define the entry window and expiry explicitly.
- Gap-through stops fill at the open. Circuit locks and no-liquidity bars can block fills.

**R accounting**
- Initial R = executed entry − initial stop.
- Net R subtracts all costs and aggregates partial exits against the original risk. Never reset R after moving a stop.

**Exit variants**
- Trend engines: a simple non-partial baseline versus one challenger: 30% at 1.5R, 30% at 2.5R, 40% at 4R, or an earlier trailing or time exit.
- Reversion and range engines: normalisation- or range-based targets. Show T3 as N/A if there is no defensible third target.
- Trail only on completed bars, effective from the next session.
- When stop and target fall in the same bar, count the stop first and flag the ambiguity. A breakeven stop does not guarantee a breakeven realised trade.

**Paper-book limits (configurable; not advice)**
- Risk 0.25% of equity per position; total open initial risk ≤ 1.5%.
- Maximum six positions; sector exposure ≤ 25%; no leverage.
- Shares = floor(risk budget ÷ stop distance), capped by cash, maximum position size and a fraction of traded volume.
- Gap risk can exceed planned loss. Stress allocation needs its own validated policy.

## 5. Validation before alerts
1. Reproduce current statistics and the 0% gate history. Check index mapping, dates, adjustment, breadth denominator, 200-day warm-up and null handling. Show the funnel for every gate and engine: available → clean → liquid → setup → context-compatible → executable → portfolio-selected.
2. Use point-in-time universes, including delisted and suspended names where possible, plus corporate actions and event availability. Keep split-adjusted price levels separate from dividend-inclusive returns. Document survivorship limits.
3. The displayed holdout has already been inspected. Do not tune against it or call it untouched. Use nested walk-forward with purging and embargo, use genuinely unseen history where it exists, and start an immutable prospective paper record.
4. Log every strategy, threshold, exit policy and failed experiment. Correct for multiple testing with the Deflated Sharpe Ratio (DSR), using block-bootstrap CIs and dependence-aware statistics. t > 2 alone is not sufficient.
5. Report net executable portfolio returns after brokerage, taxes, fees, spread, slippage, turnover and capacity, using verified current costs. Show gross and net, 2× cost stress and execution-delay sensitivity. Compare with cash, an exposure-matched index and matched random entries.
6. Report expectancy, PF, N, win rate, drawdown, expected shortfall, turnover, holding time, exposure, regime breakdown, CIs and worst gaps, plus the combined book. Correlated trades are not independent evidence.
7. Freeze the promotion policy before testing. It requires: net out-of-sample lower confidence bound > 0; drawdown and capacity limits; parameter-neighbourhood stability; multiple-testing review; and paper agreement. Set sample size by power analysis. Insufficient evidence = RESEARCH. If nothing survives, publish that result.

Meta-labelling (regularised logistic) is a challenger only. Show a probability only when its calibration has been demonstrated. LLMs may explain verified facts but must never invent prices, targets, news or confidence values.

## 6. Product and production behaviour
- **Views:** Forming setups / Paper signals / Validated alerts / Closed record. Cards show engine, as-of date, condition met, missing trigger, expiry and data status. Research cards cannot carry a live badge. In a quiet market, show what is forming and why other names failed.
- **States:** BLOCKED_DATA → RESEARCH → PAPER → VALIDATED → PAUSED/RETIRED. Each state is bound to a rules version plus data/test artifact hash. A material rule change invalidates the qualification. The publisher fails closed.
- **Nightly job:** runs after the EOD completeness check on the exchange calendar, with an explicit timezone. Uses idempotent keys, watermarks, atomic publish, retry limits and stale badges. Unchanged signals are not resent. Monitor data age, funnel counts, unexpected zeros, costs, drawdown and publisher failures. Never auto-lower thresholds.
- **Signal fields:** id, engine/version, symbol, exchange, as_of, earliest_entry, expiry, status, regime, entry rule, invalidation, target policy, initial risk, data watermark, source references, rank components, evidence artifact hash, reason codes, timestamps.
- **Records:** personal trading records stay private. The research ledger is immutable; corrections are appended.

## 8. Research basis and limits
These papers motivate the hypotheses and validation methods. They do not validate these exact rules, horizons or NSE implementations.
- Jegadeesh & Titman, momentum profitability: https://www.nber.org/papers/w7159
- Chan, Jegadeesh & Lakonishok, price/earnings momentum: https://www.nber.org/papers/w5375
- Dai et al., reversals and liquidity provision: https://www.nber.org/papers/w30917
- Bailey & López de Prado, Deflated Sharpe Ratio: https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf
- Bailey et al., Probability of Backtest Overfitting: https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf

The right outcome is a useful discovery product plus an honest, evidence-qualified signal system. Profitable trade frequency is an empirical result.
