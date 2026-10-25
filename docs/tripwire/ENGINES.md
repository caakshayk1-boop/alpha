# Tripwire engines and paper tracker

Three engines, each a published factor idea with fixed, pre-stated rules over the daily screen (`apps/tripwire/src/quant.ts`). They rank names; they do not predict, and no probability is shown anywhere.

| Engine | Idea (reference) | Score | Must also | Horizon, stop |
|---|---|---|---|---|
| **Momentum** | 12-month return skipping the last month (Jegadeesh and Titman 1993); nearness to the 52-week high (George and Hwang 2004) | 70% 12-1 return rank + 30% nearness-to-high rank | Above the 200-day average, ahead of the Nifty over 3 months, score in the top fifth | 20 sessions, 2.5 ATR |
| **Quality at a fair price** | Magic Formula (Greenblatt 2005), Piotroski F-score (2000), profitability (Novy-Marx 2013) | 50% Magic Formula rank + 30% Piotroski + 20% median ROCE | Piotroski 7+, median ROCE 15%+, debt/equity 1 or less, above the 200-day average, not a lender | 60 sessions, 3 ATR |
| **Steady uptrend** | Low-volatility anomaly (Ang, Hodrick, Xing, Zhang 2006; Frazzini and Pedersen 2014) with a trend filter (Faber 2007) | 60% calmness (lowest 1-year volatility) + 40% 6-month return rank | Calmest quarter, above the 200-day average, positive 6-month return, risk grade below HIGH | 40 sessions, 2 ATR |

Common to all: liquid, priced, measured ATR, not a micro cap. At most 5 picks per engine and 2 per sector. A pick whose stop would be wider than the engine's cap (12%, 15%, 10%) is skipped and counted. Missing data is never a pass. Percentile ranks are inside the eligible set (about 750 names).

## What is and is not known
- The evidence for these factors comes from other markets and periods. **Tripwire has not backtested them on Indian prices.** The repository's earlier engines (v3 E1-E7) failed their own walk-forward tests; nothing here is claimed to do better. The paper tracker is the test, and it stays a test until at least 30 trades have closed (average R is withheld below that, and 30 is still a small sample).
- The thresholds (top fifth, 7 of 9, 15%, calmest quarter, ATR multiples) are starting hypotheses, not tuned values.
- Picks are produced when the page loads, from the latest published close. There is no server-side forward ledger yet: a pick only enters the record when you take it. A nightly job that records every pick for every engine is the next step, and the only way to get an unbiased forward record.

## Paper tracker (`tracker.ts`, `worker.js`)
A paper trade is created when you take a pick, sized by the planner from your own defaults. The Worker route `/api/bars` serves six months of daily bars and a delayed live price from Yahoo Finance (cached 5 minutes). The tracker replays them:
- **Entry**: the open of the first session that begins after you took the trade (a pick published after the close is never filled at that close), plus 0.1% slippage. Skipped if the open is more than 2% above the signal close or at or below the stop.
- **Stop**: fixed at the signal. A bar that opens at or below it exits at the open (a gap); a bar that trades through it exits at the stop; a bar spanning the stop counts as stopped. A forming bar's low can stop a trade out.
- **Time**: exit at the close of the Nth session. A forming bar never completes a time exit.
- **Costs**: round-trip cost (0.25%) plus 0.1% slippage each side. Real fills differ.
- **Live mark**: the delayed price when it is newer than the last bar, otherwise the last close. Prices unavailable is stated; nothing is estimated in its place.

Tested: `tests/quant.test.ts` (engine rules, eligibility, sector caps, the tracker's fills, gaps, stops, time exits, costs, live marks, the forming bar, the Worker's bar parsing) and the browser journey with mocked bars. **Not run: the Worker against the real Yahoo endpoint** (the build sandbox has no route to it), so the first live check is on the deployed address.
