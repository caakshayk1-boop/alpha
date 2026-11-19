# Tripwire Pro personal paper book — policy 1

Confirmed by owner 17 November 2026: a separate personal paper book; all self-picks together use at most 20% of total capital, maximum five concurrent positions. The automatic book and its record are not changed.

## Capital and entry
- Long-only cash equity simulation, no shorts, leverage or derivatives. Pending entries reserve both money and a slot.
- Capital is fixed when the book is created. Profits do not enlarge the allocation; realised losses reduce the basis. Changes in market value alone never force a sale.
- 20% aggregate entry-cost allocation, 5% maximum per name, 10% per sector; maximum five active/pending names. New entries have at most 0.5% of total capital at risk to the stop; aggregate open/pending stop risk at most 2%. Gap losses can exceed planned risk.
- Whole shares, one active position per symbol. No averaging down or pyramiding. Exit then re-entry is a new lifecycle, with a fresh thesis and one completed regular NSE session cooldown.
- Required before entry: thesis, supporting observation, countercase, numeric stop, invalidation and review date. Original thesis is frozen on the position; later learning goes into the action history.
- Queue for the next regular NSE open after the request, not the already-known historical close. Cancel if open is >2% above reference or at/below the stop. Reserve against the maximum allowed fill including entry slippage. Expire no later than the requested next session; missing data waits for that session's evidence rather than filling a later day.
- Execution assumptions: 0.1% slippage each side, 0.25% entry-notional round-trip costs, no dividends. Quotes are references; all fills are simulated. Unknown calendar, stale reference, missing bars or changed price basis blocks unsafe simulation.

## Discretionary exits
- Five completed ordinary NSE sessions strictly after the entry session. Entry day is excluded. Special sessions are excluded. Earliest request after the fifth subsequent session has completed.
- Per India calendar month: two net-loss discretionary exits; one non-loss exit (positive or zero after costs). No rollover and no borrowing from next month.
- Full remaining position only; no partial exits to evade quota. A pending request reserves allowance; repeated clicks cannot duplicate it.
- A reason is required. Fill at the next regular session open, not a past close. The actual execution month owns the quota. If the gap changes the profit/loss bucket from the reserved bucket, cancel the manual request and ask for a new decision; do not silently spend another allowance.
- Protective stops and the pre-agreed maximum holding period bypass both minimum tenure and manual quotas. A gap through a stop fills at the open, potentially worse than the stop. The normal holding period is 20 sessions by default, chosen at entry (5–60).
- Monthly allowance is an impulse-control device, not evidence of a profitable strategy. Never encourage retaining a loss simply to preserve quota.

## Record integrity
- Append dated entry/exit/cancellation events with policy version, source dates and reason. No deletion of filled positions or retrospective entry editing. Cancel unfilled entries without consuming an exit.
- Reconcile only when data is available and the book is opened; no claim of background monitoring or real order execution. Missing sessions pause replay and do not count as exits.
- Personal results stay separate from the published automatic results. Local backup/restore includes this book; imports cannot reset capital or overwrite a terminal position with an older pending record.
- Browser-local limits are not tamper-proof or enforceable across independent devices. Server accounts and authoritative events are required before selling this as a cross-device enforced product.

## Launch plan
Ship as an experimental personal-paper beta: explicit costs/source time, exact blocked reasons, accessible forms, duplicate-action protection, storage failures, backup/restore, audited accounting and calendar edge cases. Paid/multi-device launch additionally needs authenticated accounts, transactional server event storage and quotas, billing entitlements, data redistribution permission, appropriate legal positioning, incident/support ownership, 2027 NSE calendar, real-device and user trials. Do not claim those are configured merely because the beta UI is deployed.

## ApexPro adaptations
Bring contextual company research into the decision: source-labelled chart and RSI link, visible countercase, review queue, exact rule checklist, confidence/coverage where the feed supplies it. No invented confidence fields. Borrow research-context continuity and clear selection states, not duplicate charts. Add rule-budget meters and personal position lifecycle history instead of a decorative score dashboard.
