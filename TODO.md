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

## Batch 2: new look (approved 15 Oct)
- [x] 5. Tokens and shell: light-first paper theme, ink hero card, pastel job tiles, sliding tab indicator.
- [x] 6. Brief relook (reading layout, section index).
- [x] 7. Company relook (Tickertape-style scorecard on Alpha's own Q/G/V/T scores, chart first).
- [x] 8. (moved: Company was item 7; this batch shipped Tokens/shell, Today, Brief, Company.)

## Batch 3
- [x] 9. Funds and Compare relook. Funds: three cards per category with holdings and calendar years (fixed: years showed the OLDEST four, hiding 2025; volatility was described as daily, it is monthly). Compare: small multiples, no gain/loss colours as identity, visible best tags, rows from shards.
- [x] 10. Audit F4: limits line inside every plan-level block (survivorship, cost, no slippage).
- [~] 10b. Audit F5: neutral statement live; a stronger one NEEDS AKSHAY: does he hold positions in names on the site?
- [x] 11. Audit F7 + F10: CSP in public/_headers (sweep: no violations); NSE session chip read from the Nifty's last trade (holiday-proof).
- [x] 12. Polish pass: Screen examples were full-width (".wrap" class collided with the page container); 8 Markets sector cards
      had blank charts (Yahoo has one bar for those indices: now said plainly); Reads/About headers aligned; engine glow removed.

## Batch 4 (15 Oct)
- [x] 13. Motion: pointer light + lift on cards, scroll reveal (it never ran: child effects registered before motion was on),
      sliding ink nav pill, Brief index scrollspy, gauge sweep, theme cross-fade. All off for reduced motion.
- [x] 14. Indexable company pages: /company/<SYM>/ x990, own title/description/canonical, pre-rendered content, company sitemap,
      301 from /company/?s=, live fallback for companies with no pre-built page.
- [x] 15. Safari engine: WebKit 27.2 with iPhone 15 emulation, 21/21 routes pass. Real iPhone / iOS Simulator NOT done
      (no iOS runtime installed; ~7 GB Xcode download is the owner's call).

## Batch 3: later
- [ ] 9. Richer news feed. Needs a change in `trading-dashboard` (the data repo). That's a separate repo, so it gets its own confirmation.
- [~] 10. WebKit pass done (item 15). Real device still open.

## Batch 5 (20 Oct): everything live, signals, design
- [x] 16. (shipped c090277, live) Live barometer: port barometer.py compute() exactly (tested on published inputs); Nifty, VIX, 52-week range,
      breadth and 200-day share all live; the hero date follows the latest session; a "before the open" state.
      Check: at any time the hero date = the newest session any feed describes; the barometer card says live or its date.
- [~] 17. (statement + redirects live; company LCP NOT fixed: live median 5.6 s, blocked on JS before the price line, a pre-rendered line would show a stale price) Conflicts statement (neutral, true without the owner's answer); signal./gems. 301 to alpha after checking the Worker's
      routes and every dependent hostname; company LCP (the trend line).
- [x] 18. (shipped: only breadth>=60% passed the holdout, t 2.05, so it is a 'conviction' label; no signals cut) Agent: signal engines, fewer and better signals, validated on the holdout only.
- [x] 19. (shipped: paper book + per-signal P&L and rule action; Tools/Compare/accent control; other 12 pages got shared CSS only) Agent: live P&L and rule-based status on every open signal. Agent: Analyze section + neon + colour control + motion.

## Batch 6 (next)
- [x] 20. (21 Oct: late stocks re-fetched twice before publishing, a 22:30 IST re-mark run, and a loud warning naming any still late) Engines: `last_close` lags `data_through` when a stock's bar is late (19 Oct: 26/31 open signals on the 16 Oct close). `last_close_date` now recorded; the 18:00 IST run should wait for, or re-mark on, the late bars.
- [ ] 21. Alerts only from engines with holdout clustered t >= 2 (switches all off today). NEEDS AKSHAY.
- [ ] 22. Company LCP: an honest pre-rendered price line (needs a build-time close that is the latest session).
- [ ] 23. Page-by-page design pass on the 12 pages that only got shared CSS (markets, news, ipo, reads, funds, rotation, calendar, watchlist, journal, about, map, screen).

## Batch 7 (21 Oct 2026, owner's points)
- [x] 24. Price parity (MRPL 170 vs TradingView 173): the screen close is dividend-adjusted (170.72 vs 173.72 traded, ₹3 dividend). Every price now
      takes the exchange's traded price on a session tie; engines price and track plans on traded (split-only) bars, train on adjusted.
      Still open upstream (trading-dashboard repo, needs its own OK): screen's sma/52w/levels are computed on adjusted closes.
- [x] 25. /trades/: open trades marked live, today's R and ₹ (risk per trade input), the book across the day on 5-minute bars (/api/intraday),
      next-session decisions (exit / modify / enter / hold / closed / skipped), provisional in hours, final after the close.
- [x] 26. Explanations moved to Method (/about/#<page>); every page header links its section. Duplicates removed: Today (engine teaser, single
      quote, weekly movers, wire, IPO/read cards), Brief (quotes, sectors, today's movers, calendar, IPO, engines, wire), Engines (paper book,
      per-card paper block, exit-plan tab, live-record panel, limits panel).
- [x] 27. Spacing one step tighter site-wide (tokens, table cells, page gutters).
- [x] 21. (owner, 21 Oct) Alerts only from engines with holdout month-clustered t >= 2: all five off today (best +1.42).
- [x] 10b. (owner, 21 Oct) Footer: the author holds no position in any company shown here.
- [x] 22. (21 Oct) Company LCP: the late element was the "Data check" banner (3.4-4.7 s), not the price; the name and dated price were already pre-rendered. Banner is one line now; LCP is the pre-rendered h1 at ~1.0 s (412 px, 4x CPU, 1.6 Mbps, local). The banner also skips weekdays the NSE did not trade (gaps in the Nifty bars, or no trade in the live snapshot), so 20 Oct (Diwali) no longer reads as "1 session behind".

## Batch 8 (21 Oct 2026): signals rebuilt from today
- [x] 28. Swing v2 replaces the five ML engines (engines/swing.py): market gate (4 checks), stock gate, two setups (pullback,
      breakout), plan = half at 2R, profit lock at +0.5R, 10-session-low trail, rest at 4R, 30 sessions. Rules fixed before
      the one backtest: development +0.24R/trade (t 1.73), holdout -0.06R (t -0.91) vs no gate -0.26R and random -0.30R.
      Alerts off (owner's t >= 2 rule). Gate off on 21 Oct (1 of 4): no new trades. ML signals archived (engines/archive/).
- [x] 29. Site on the new feed (signals.json); engines.json kept in the old shape for Telegram/brief (trading-dashboard #54).
- [x] 30. AI asks for the market and each signal, beside the company one. OFF until ANTHROPIC_API_KEY is set on the Worker.
- [x] 31. Motion refinements; audit of 21 routes x phone/desktop x light/dark: clean.
- [ ] 32. Owner: add ANTHROPIC_API_KEY (Cloudflare Worker secret) and a spend limit on its Anthropic workspace to switch AI on.
