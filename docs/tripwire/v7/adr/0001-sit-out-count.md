# 0001 The sit-out log count
Status: decided by the builder (the owner said do not stop).
Context: the prompt says the log count must equal the ledger resolved-observation count. Taken literally that cannot hold, because resolved observations include the ones the book took.
Decision: the log lists resolved observations the book did NOT take. The invariant tested is `log.rows + resolved-and-taken = resolvedObservationCount` on the same ledger, and the page says "N of M resolved observations were not taken". Not-taken observations that have not resolved are counted in a footnote, not listed. No sit-out row enters any book figure (tested).
Reasons are the book's own refusal text (autobook), grouped as duplicate / risk-cap / size / not-selected. There is no "gate state" reason because the book records none.
