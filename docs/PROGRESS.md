# Progress (brief: CLAUDE_CODE_ALPHA_REBUILD.md)

Branch `redesign/alpha-v2`. Nothing is merged to `main` or deployed: the brief forbids production deploys without explicit authorisation.

- [x] Phase 1: system map and baseline (`docs/redesign-audit.md`; baseline screenshots at 360/390/768/1024/1440)
- [x] Phase 2: line-item review, 76 rows, every row decided (`docs/line-item-review.md`)
- [x] Phase 3: references (`docs/design-direction.md`): Linear, Stripe, Vercel, Raycast, TradingView observed via page scrape; Apple and editorial hospitality **not** inspected
- [x] Phase 4: one direction; tokens incl. motion tokens; gradients, glass, glow, aurora removed
- [~] Phase 5: routes. Done: Today, Engines, News, IPO, Weekly Reads, Tools, Markets, Screen controls, Company score bars, Map labels. Deferred: Brief, Funds, Compare, full Company restructure; filters-in-URL for Screen
- [~] Phase 6: AI. Existing feature documented, off (no key). No new AI built, none faked (`docs/ai-features.md`)
- [x] Phase 7: motion system tokens; no looping animation; reduced motion respected
- [~] Phase 8: engineering. Dead code removed; no new dependency; Lighthouse and axe **not run** (not installed)
- [~] Phase 9: browser verification (`docs/redesign-validation.md`); real-device, Safari/Firefox, throttled-network not done
- [x] Phase 10: docs written. Final report in the session

Requests added by the owner mid-way: remove Magic page (done, 301), fix nav menu staying open (done), better Engines (done), smart News (done).
