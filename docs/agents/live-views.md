# Agent: live-views (15 Oct 2026)

Branch `live-views`, from 5b66fe7, with `live-2026-10-15` (today-widgets) merged in.

## What changed
- **Heat map (/map/)**: the Today metric follows `useDay()`. Live: tiles, summary row, leaders, tooltip, selected panel and the
  text table read `snap.pct`/`snap.price`, labelled "Today · live HH:MM IST". Close: "Today · {date} close". Other measures
  are labelled "{measure} · {screen date} close". A line under the controls gives the whole-market count from `useDay()`
  (the same figures as the Brief). "Up vs down" no longer counts unchanged stocks as down.
- **Screen (/screen/)**: when live, every row carries the live price and move, so the table, filters, sort, the plain-English
  box and the CSV all use the displayed value. Headers read "Price (live HH:MM)" and "Today (live HH:MM)". CSV adds an `as_of`
  column. The URL state is unchanged.
- **Brief (/brief/)**: the read, the new "today" movers, the eyebrow and Copy as text all use `useDay()`. The Barometer keeps
  its own date. The weekly movers stay, labelled with the screen's date. A move beyond ±20% is shown with a "check" tag.
- **Stale quotes** (`lib/live.ts`): `inSession(snap, sym)`. `dayFromLive` leaves out any quote whose last trade is not in the
  snapshot's session and counts it in `DayFigures.stale`. `todayView` returns nothing for such a stock. Map, Brief and Screen
  say how many were left out (CCAVENUE on 15 Oct: +901% from a 12 Oct trade).
- Helpers: `src/lib/today.ts` (pure, tested) and `src/lib/useToday.ts` (hook over `useDay`). Day rules stay in live.ts.

## Checks (this session)
type-check clean · lint clean · tests 78/78 · build ok · audit.mjs passed (1010 pages) · axe light and dark 0 violations on
3 routes × 2 widths · sweep clean 16/16 · WebKit iPhone 3/3 PASS.

Accuracy: one /api/live snapshot was frozen and served to every page, then recomputed independently at 13:14 IST: 323 up,
660 down, 6 unchanged, 989 counted, 1 stale. Map and Brief match exactly. HDFCBANK, INFY and ICICIBANK tiles match the
recomputed values, all 150 labelled tiles match the table, and the Screen's top 3 by Today % match. The close path (with
/api/live failing) shows the 14 Oct close: 559 up, 408 down, 23 unchanged, the same figures as /api/summary.

Screenshots: docs/screenshots/agents/live-views-{map,screen}-{desktop,phone}.png, live-views-brief-desktop.png.
