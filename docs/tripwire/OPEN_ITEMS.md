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
