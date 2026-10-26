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


## Beta decisions that belong to the owner (26 Oct 2026)
Tripwire did not change any engine rule to make the written spec and the data agree. A rule change alters every percentile rank and the forward record, so each is a versioned decision. Live counts are on the Data screen.
| # | Disagreement | What the data shows | Options |
|---|---|---|---|
| D1 | The spec says the Nifty 500 and no micro caps. The code lets an unpublished size class pass. | 293 of 988 names carry no size class; 266 of them are flagged liquid and eligible. Two of the five Momentum picks on 23 Oct (GCSL, SBC) are among them. | Exclude unpublished size (cuts about 266 names), keep as is and document, or publish a size class for all names. |
| D2 | The spec says liquid means a 20-session median traded value of at least ₹10 crore. The code uses the screen's liquid flag. | 145 of 960 flagged-liquid names show under ₹10 crore a day (lowest ₹0.7 crore); 4 unflagged names show ₹50 crore or more. The flag's definition is not published. | Publish the flag's definition, or replace it with the written threshold. |
| D3 | The spec says priced at ₹50 or more. No floor is applied. | 45 flagged-liquid names trade under ₹50. | Apply the floor, or correct the spec. |
The forward record has one night (23 Oct) and no closed trade; it was written under the current code. If any of D1 to D3 changes, record the version beside the night it takes effect.

## D4. Target multiples and sleeve sizes are unvalidated
The T1/T2 ladder (1/2R, 1.5/3R, 2/4R) and the 10/10/10 split are the owner's brief turned into numbers, not findings. Review once 30 trades have closed per sleeve. The short-term sleeve has no engine.
