# Tripwire: open items and self-audit (26 Oct 2026)

## Answers to the questions asked
| Question | Cause | Fix |
|---|---|---|
| "Your trades" vs "total trades" differ | Two books held the same picks at different rupee sizes: the auto book uses ₹1,00,000 per position, the manual book is sized by the risk planner and also held retired-LVT picks. Both were shown as if they were separate. | Today shows ONE paper-book card. Hand-taken trades appear only when they are a different pick. Mine explains the size difference and offers "Hide duplicates". Picks no longer have "Paper-trade all"; a hand-take is offered only when the auto book refuses a pick. |
| Trend map not live | It read published 50/200-day averages and the last close. | `/api/breadth` re-prices the names within 8% of their 50-day average (the only ones that can change class in a day), cached 60 s. Today labels it "live" or "close of <date>". |
| Refresh not every 5-10 s for all | Each list polled for itself (30-60 s) behind a 60 s edge cache. | One `/api/tick` every 8 s (45 s when the market is shut) for everything on screen; Yahoo spark batching, 6 s edge cache. |
| News too big / "Your names" | Market news plus up to six per-name cards. | One merged, de-duplicated list, five lines, "Show more". Company page capped at five. |

## Audit fixes
- "−0.0%" and green/red on zero: `pct` and `tone` now treat anything that rounds to zero as neutral.
- Duplicate facts removed from Today: ticker tape, separate index tiles, two LIVE labels, two book cards, "Weakest sectors", empty-state cards.
- `trendOf` and the Worker's rule now agree on every input, including a zero average (pinned by a test over 125 combinations).

## Not built
Web-push stop alerts; holdings CSV import; FII/DII screens; journal analytics; result-day reactions; accounts and sync.

## Needs the owner
Waitlist mail secrets; Cloudflare Browser Cache TTL; T09 contact; Telegram secrets; G30 decision; price; checks on a real iPhone (haptics, Face ID, text size, water performance); on Tuesday confirm the nightly ledger filled Friday's picks.

## Known limits
Yahoo is unofficial and can throttle; `/api/breadth` falls back to the close and says so. Breadth uses the published averages, so a name far from its 50-day line is not re-priced (it cannot change class in one session).


## D1 to D3: resolved by a versioned rule (27 Oct 2026)
The three gaps between the written spec and the code are closed by `elig-2` (rules.ts), which applies the spec as written from the data day 27 Oct 2026: a published size class that is not micro (D1), traded value of at least ₹10 crore a day (D2), price of at least ₹50 (D3). On the 23 Oct rows the previous version admitted 753 names and `elig-2` admits 459. Nights recorded before 27 Oct (23 and 26 Oct) keep `elig-1` and are never re-run or re-scored; the Signals screen prints the version beside the nights it governs and the Data screen shows the counts. Regression tests: `eligibility.test.ts` (each threshold at its boundary, both versions, GCSL and SBC), `ledgerversion.test.ts` (the ledger is append-only across the cut-over, a night with no version reads as `elig-1`, the same screen gives different picks under the two versions), `universe.test.ts`. Not decided by tuning: the thresholds are the spec's own and were fixed before the counts were read. Known limit: the feed does not say whether its traded-value figure is a 20-session median (the spec) or a mean.

## D4. Target multiples and ladder is unvalidated
The T1/T2 ladder (1/2R, 1.5/3R, 2/4R) is chosen, not tested. Review once 30 trades have closed per style. No engine writes short-term picks.
