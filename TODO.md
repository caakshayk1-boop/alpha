# Alpha: work queue (2026-10-15)

Rule: batches of at most 4, each shipped and checked on the live URL before the next.
Each item has a pass/fail check.

## Batch 1: correctness, speed, access, URL state (no design decision needed)
- [x] 1. (shipped 8918c21, live) Brief tells one story. The read, sector tiles and movers all use one date and one universe, each labelled.
      Check: the sector tiles and the "up/down" count come from the same rows (`screen.json`); every block shows its date.
- [~] 2. (shipped, live) Today loads fast on a phone. RESULT: live median of 3 runs LCP 4.1 s, score 85 (was 10.4 s, 40). Misses the 4.0 s check by 0.1 s; remaining cost is JS hydration before paint. The headline no longer waits on the 490 KB screen feed.
      Check: Lighthouse mobile LCP on `/` at or below 4.0 s, down from 10.4 s (lab, simulated slow 4G).
- [x] 3. (shipped, live: 36/36 light, 36/36 dark) axe: 0 serious or critical violations on all 18 routes and a company page, at 390 and 1440 px.
      Check: `_System/Scripts/web-audit/axe-scan.mjs` exits 0. Baseline: 22 of 36 pass.
- [x] 4. (shipped, live) Screen filters live in the address, so Back, refresh and a shared link restore them.
      Check: set 3 filters and a sort, reload, and the same rows appear. Back from a company page returns to the same view.

## Batch 2: new look (WAITING FOR APPROVAL of the direction in the session)
- [ ] 5. Tokens and shell: light-first paper theme, ink hero card, pastel job tiles, sliding tab indicator.
- [ ] 6. Brief relook (reading layout, section index).
- [ ] 7. Company relook (Tickertape-style scorecard on Alpha's own Q/G/V/T scores, chart first).
- [ ] 8. Funds and Compare relook.

## Batch 3: later
- [ ] 9. Richer news feed. Needs a change in `trading-dashboard` (the data repo). That's a separate repo, so it gets its own confirmation.
- [ ] 10. Real-device check (iPhone Safari) and the WebKit engine pass.
