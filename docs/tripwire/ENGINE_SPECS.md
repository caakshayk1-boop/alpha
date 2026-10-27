# Tripwire engine specifications

One page per engine: the hypothesis, the rule, how it is traded, what it is measured against, how it can fail, and when it is switched off. Thresholds are starting hypotheses, not tuned values. Evidence status is as of 26 Oct 2026.

## Common to all three
- **Universe, by version (rules.ts).** `elig-1`, used for every night recorded up to the data day 26 Oct 2026: every company in the published screen (988 on 23 Oct) that the screen flags liquid, has a price, has a measured ATR and is not classed micro cap; an unpublished size class counted as not micro; there was no price floor and the traded value was not read. `elig-2`, from the data day 27 Oct 2026, is the written spec applied as written: a PUBLISHED size class that is not micro (the nearest the feed can show to "in the Nifty 500"), traded value of at least ₹10 crore a day as the screen publishes it, and a price of at least ₹50, on top of the liquid flag, a price and a measured ATR. Thresholds are the spec's own and were fixed before the counts were read. A night keeps the version it was written under. (Older text for the superseded rule follows.) There is no ₹50 price floor and the liquid flag is the screen's own, not a ₹10 crore test. The earlier text here said otherwise; the code never did. The three disagreements are open decisions D1 to D3 in OPEN_ITEMS.md, and the live counts are on the Data screen (`#/data`).
- **Selection:** a score among eligible names, a set of filters, at most 5 picks, at most 2 per sector, no pick whose stop would be wider than the engine's cap. Missing data is never a pass.
- **Trade:** next-session open plus 0.1% slippage; skipped if it opens more than 2% above the signal close or at or below the stop. Stop fixed at the signal; a gap exits at the open; a bar spanning the stop counts as stopped. Time exit at the close of the horizon. Costs 0.25% round trip plus 0.1% slippage on exit.
- **Benchmark:** the equal-weight average of all eligible names over the same sessions (the engine's *excess*), because beating the index with a high-beta tilt is not skill.
- **Capacity:** sized by the paper planner to the smallest of risk, cash, position and 1% of a day's traded value.

## MOM: Momentum
- **Hypothesis:** stocks that rose most over 12 months, skipping the latest, keep outperforming for weeks (Jegadeesh and Titman 1993), more so near their 52-week high (George and Hwang 2004).
- **Rule:** score = 70% rank of the 12-1 return + 30% rank of nearness to the 52-week high; must close above the 200-day average, be ahead of the Nifty over 3 months and score in the top fifth. Horizon 20 sessions; stop 2.5 ATR, capped at 12%.
- **Evidence:** back-test excess per trade +0.6% early (t 0.6), +0.1% middle, **−1.1% latest (t −1.0)**. Rank correlation with next-month returns is faintly positive in all three periods (0.045, 0.042, 0.033), too small to trade after costs. **Status: no historical support.**
- **Fails when:** momentum crashes (sharp market reversals after falls); small-cap-led rallies where the whole universe outruns the leaders.
- **Switched off if:** 100 closed forward trades show average R below zero, or excess against the universe below zero with t < 0.

## QLT: Quality at a fair price
- **Hypothesis:** profitable, financially sound companies bought cheaply earn more than the market over months (Greenblatt 2005, Piotroski 2000, Novy-Marx 2013).
- **Rule:** score = 50% Magic Formula rank + 30% Piotroski + 20% median ROCE; Piotroski ≥ 7, median ROCE ≥ 15%, debt to equity ≤ 1, above the 200-day average, not a lender. Horizon 60 sessions; stop 3 ATR, capped at 15%.
- **Evidence:** **cannot be back-tested**: it needs accounts as they stood on each date. The forward record is the only test. **Status: untested.**
- **Fails when:** the cheap are cheap for a reason (value traps), or accounts are restated.
- **Switched off if:** as MOM, at 100 closed trades.

## LVT: Steady uptrend
- **Hypothesis:** calm stocks that are still rising earn more per unit of risk than volatile ones (Ang et al. 2006; Frazzini and Pedersen 2014), with a trend filter (Faber 2007).
- **Rule:** score = 60% calmness (lowest 1-year volatility) + 40% rank of the 6-month return; calmest quarter, above the 200-day average, positive 6-month return, risk grade below HIGH (the grade cannot be reproduced in the back-test). Horizon 40 sessions; stop 2 ATR, capped at 10%.
- **Evidence:** excess per trade **−3.1% early (t −2.2), −1.8% middle, −3.1% latest (t −1.8)**. It underperformed the universe in every period; in this sample, risk-taking was rewarded. **Status: no historical support, and negative.** Recommendation: retire.
- **Fails when:** high-beta, small-cap-led markets (which is most of the sample).
- **Switched off if:** already below its kill line in the back-test; keep only if you want the forward record to confirm.

## The unusual indicators (study, 26 Oct 2026)
Thirteen candidates plus three common baselines and a random control, on 660 stocks and ten years, with the adoption rule fixed first. **None passed.** Residual momentum came closest (training t 2.58, but its top fifth did not beat the universe after costs in the latest period). They remain on company pages as description only, each with its verdict. The challenger blend (momentum + residual momentum + efficiency) did no better (latest excess −1.0%) and is not run.

## What a better engine would need
Company accounts as they stood on each past date; delivery percentages; daily foreign and domestic flows; earnings surprises with release times; and a list of stocks that includes the ones that disappeared. Each would be tested the same way, with the rule written first.
