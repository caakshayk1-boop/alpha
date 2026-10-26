# Paper accounting: what is assumed, what is checked

Every figure below is pinned by `apps/tripwire/tests/paper.test.ts`, with the arithmetic worked out in the comment beside each expected number.

## The four prices, never blurred
| Name | Meaning | Where it is shown |
|---|---|---|
| Signal | The engine's close on the data day. The stop is measured from it. | Trade card, "Which price is which" |
| Fill | The next session's open plus 0.1% slippage, rounded to the paisa. | Entry |
| Latest | The last close, or the last live print while the session is on. | Mark |
| P&L basis | Fill to latest (or exit), times shares, minus 0.25% of the entry value (costs) and 0.1% of the exit value (slippage). | Trade card, same disclosure |

## Rules
- **Next open.** A pick written at the close fills on the next bar, never at the signal close. A paper trade taken during a session fills on the following session's open.
- **Gaps.** Skipped when the open is more than 2% above the signal close, or at or below the stop. A gap through the stop exits at the open, which is worse than the stop; an orderly stop exits at the stop. When one bar spans the stop, the stop counts.
- **Time exit.** At the close of the Nth session, the entry session being the first. A forming bar can trigger a stop through its low but never a time exit.
- **Costs.** 0.25% round trip on the entry value (one assumption for brokerage, taxes and charges) plus 0.1% slippage on each side. The planner and the tracker use the same number (`DEFAULT_COST`). Real costs differ.
- **Holidays.** Sessions are the bars that exist, so a market holiday is never counted. The age-of-data check does not model holidays and says so.
- **Corporate actions.** Bars are quoted split-adjusted and not dividend-adjusted. After a split or bonus the whole history is re-quoted, so a stop stored in old prices would look breached. The signal-day bar carries the signal close in today's quoting; the ratio is the adjustment, and the stop, the signal and the share count are re-based so value, risk and P&L are unchanged (tested for 1-for-2, bonus and reverse split). If the signal-day bar is missing, the trade says its basis is unverified. Dividends are not received (conservative).
- **Duplicate runs.** A night is recorded once; a second run is refused ("already recorded"); an older data day is refused ("stale data"); a pick is never edited, only voided in the open with a reason.
- **Reproducibility.** Replaying the same bars gives the same outcomes, whatever order the picks are listed in; evaluating twice changes nothing; nothing is mutated.

## Known limits
- A missing bar that is not a holiday (a data hole) shortens the time exit's calendar length. It cannot be told apart from a holiday.
- A fill at the open plus slippage can sit 0.1% above that day's high when the open was the high.
- Costs are one assumed percentage, not an itemised schedule.
- The one rounding change made in this work: the fill is now rounded to the paisa (it was unrounded), so the headline P&L and the what-if slider use one number. The effect is under half a paisa a share.
