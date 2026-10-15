# Agent: today-widgets

Worktree branch: `worktree-agent-a844f682571fe109b` (fast-forwarded from 0242736 to 5b66fe7, the stated base).

## Done
- `src/components/widgets/DayContext.tsx`: `TodayProvider` runs `useDay()` once for the Today page (useLive polls per caller,
  so four widgets would otherwise start four pollers); `dayLabel` ("Live · HH:MM IST" / "{date} close"); `snapLabel` (movers
  and watchlist: live only when snap.session > screen as_of).
- Hero breadth card and `SectorBars` read `useDay()` (shared copy on Today; SectorBars loads its own on the Brief, props unchanged).
- `<MarketClock />` in the hero under the freshness stamps, shown only at ≤1240px (the header's breakpoint).
- `IndexStrip`: Nifty 50, Sensex, Nifty Bank, India VIX, USD/INR, Gold, Brent; `Flash` on price and %, last-trade time per item;
  sideways scroll inside its own focusable region. Board now shows only the S&P 500 (the rest moved to the strip).
- `LiveMovers`: top 5 risers (>0) and fallers (<0) by snap.pct over universe rows, only stocks that traded in the snapshot's
  session; moves beyond ±20% held out and named. Honest unavailable state.
- `LiveWatchlist`: watchlist symbols with live price and %; a stale symbol shows its price and "last traded {date}", no %.
  Empty state links to /screen/.
- `src/lib/live.ts` (additive): `LiveSnap.at` = each symbol's own last trade. Test added in tests/lib.test.ts.
- Page order: hero → job tiles → index strip → sectors + since-visit → movers + watchlist → rest.
- Checks: type-check, lint, test (73/73), build, audit, axe light+dark, sweep, webkit-iphone all clean. Accuracy spot-check
  done against the page's own /api/live responses. Screenshots in docs/screenshots/agents/today-*.png.

## Issues
- CCAVENUE (AvenuesAI) last traded 12 Oct; Yahoo prevClose 13.83 vs price 138.50 (+901%), the shape of a 1:10 consolidation.
  Movers now exclude it (stale) but the shared breadth/sector rule in lib/live.ts (dayFromLive) still counts stale symbols
  (1 of 990 today, so breadth moves by at most 1). Worth a decision in live.ts.
- Each page still runs three /api/live pollers (header clock, hero clock, TodayProvider). A module-level shared fetch in
  useLive (lib/data.ts) would make it one; not done here to keep lib/data.ts untouched.
