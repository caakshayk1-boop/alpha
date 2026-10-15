# Consistency agent: dates, "today" and live prices

Branch `worktree-agent-ac0881b05e7c655d4`, based on `5b66fe7` (live-2026-10-15). Audited 15 Oct 2026, 10:30 IST, NSE open.
Production at that moment: screen `as_of` 14 Oct (built 15 Oct), quotes and `/api/px` live (15 Oct 10:26 IST),
`/api/live` not yet deployed (answers the HTML shell), IPO mirror built 15 Oct 00:17 (no timezone in the stamp).

## The rule now used for every stock price (src/lib/price.ts)

`priceView(sym, screenRow, liveSnap, quote)` is `pickDay` from lib/live.ts applied to one symbol:

1. Live snapshot (`/api/live`) when its session is newer than the screen row's `last_date`.
2. If that stock's own last trade is older than the live session (suspended, illiquid, unadjusted: CCAVENUE last traded
   12 Oct and showed +901%), it is `stale`: price shown as "last traded 12 Oct 2026", **no day move**.
3. Else the per-symbol quote (`/api/px`), under the same two checks.
4. Else the screen close, labelled "{date} close". A tie goes to the close (the vetted figure).

`priceLabel()` says "live 10:26 IST" only inside NSE hours with a trade in the last 15 minutes, "last trade HH:MM IST" for
a quiet same-day trade inside hours, otherwise "{date} close". `lib/live.ts` now also records each symbol's own trade time
(`LiveSnap.at`, additive). Tests: tests/lib.test.ts, two new cases.

`DataStamp` id `prices` (driven by `useLive`): "Prices · 10:26 IST live" or "Prices · 15 Oct 2026 close". Added to Markets,
Company, Watchlist, Compare.

## Audit table

Correct? Y = right and dated; N = wrong or undated (fixed unless the owner column says otherwise).

| Page | Element | Source feed | Shows | Correct before | Now |
|---|---|---|---|---|---|
| / (home) | Hero eyebrow "{weekday} · market close" | barometer `nifty_date` (23:40 IST) | Barometer session | N: sits beside the breadth card from the screen (02:40 IST); 23:40 to 02:40 IST they are different sessions, unlabelled | Other agent (page.tsx) |
| / | Breadth card "{as_of} · N stocks" | /api/summary | screen session | Y | Other agent |
| / | DataStamp barometer, screen, engines | status | each session | Y | Other agent; add `prices` at integration |
| / | Index cards `quoteState(at)` | /api/quotes | own last trade | Y | Other agent |
| / | "What changed" "data through {date}" | barometer + pulse | session | Y | Other agent |
| / | Open IPO "closes {date}" | ipo mirror | date | Y | Other agent |
| /brief/ | Eyebrow "Market data as of {screen as_of}" | screen | screen session | N: barometer line beneath can be a newer session | Other agent |
| /brief/ | Headline "On {as_of}, …; barometer reads N" | summary + barometer | two sessions in one sentence | N: unlabelled mix when barometer is ahead | Other agent |
| /brief/ | Quote cards, calendar "today/in N days" | quotes, screen | own time / IST date | Y | Other agent |
| /map/ | Metric "Today" (r1d) | screen | screen session | N: a previous session called "Today" | Other agent |
| /map/ | Tooltip 1D/1M/1Y | screen | undated in tooltip, DataStamp above | Y (stamped) | Other agent |
| /screen/ | Column "Today %" (r1d) | screen | screen session | N: previous session called "Today" | Other agent |
| /screen/ | Lens "at the latest close" | engines | dated by stamp | Y | Other agent |
| SectorBars | "median one-day move · {as_of}" | summary | screen session | Y | Other agent |
| Shell | MarketClock "NSE open · prices HH:MM IST" | /api/live | live | Y | unchanged |
| /markets/ | Quote cards | /api/quotes | loaded once, never refreshed | N: stale after the first minute | `useLiveQuotes` (60 s), price and % in `<Flash>`, each card keeps its own last-trade time |
| /markets/ | Stamp | status | barometer, screen | N: no time for prices | `prices` added |
| /markets/ | Lede "cached up to five minutes" | text | | partly: now also says it refreshes every minute | fixed |
| /markets/ | MarketStance "as of {bd.as_of}" | screen | raw ISO date | Y (dated, ISO format) | not changed (AiTools.tsx not owned) |
| /company/INFY/ | Header price, % | usePx else screen | live quote or "screen close {date}" | partly: quote label relative ("live · 3m ago"), and no live snapshot rule | `priceView` (live snap, then quote, then close), "live" tag + IST time or "{date} close", `<Flash>` |
| /company/ | Stamp | none | | N | `prices`, `screen` |
| /company/ | "Where it ranks today" | screen | screen session | N: previous session called "today" | "Scorecard · screen close {date}" |
| /company/ | Price panel range + 1D/1W/…/1Y | screen | screen session | N: undated, next to a live header move | "Price · to the {date} close" |
| /company/ | Key numbers (P/E, P/B, yield…) | screen | at screen close | N: undated | note "price-based ratios use the {date} close" |
| /company/ | Live vs close divergence notice | usePx | | Y | uses `priceView` |
| /company/ | Pre-rendered first paint | public/c at deploy | previous session before 02:40 IST build | N: shown as current | now labelled "{date} close"; morning redeploy added (below) |
| /company/ | Ownership "As of {period}" | institutional | quarter | Y | unchanged |
| /company/ | Results due / expected | screen | compared with UTC date | N: UTC is a day behind until 05:30 IST | IST date (CompanyTools.tsx) |
| /company/ | Engine card "Signal close", odds | engines | issue date in card | Y | unchanged |
| /company/ | RiskCone axis "today" | 1y chart | last bar of chart feed | Likely Y: chart last bar is the latest session | not changed |
| /watchlist/ | Price + "live" tag | usePx else screen | tag shown even when the quote was yesterday's | N | `priceView`, label under each price, `<Flash>` |
| /watchlist/ | 1D, 1M, 1Y | usePx pct / screen | two sessions side by side, unlabelled | N | "Day" follows the price; 1M/1Y headed "to {date}" |
| /watchlist/ | CSV export | screen | price, 1d undated | N | `close_date`, `close_price` columns |
| /watchlist/ | Stamp | none | | N | `prices`, `screen` |
| /compare/ | "Price" row | screen | close, undated | N | `priceView` + label |
| /compare/ | "Today" row (r1d) | screen | previous session called "Today" | N | "Day move" via `priceView` |
| /compare/ | Other rows, stamp | screen | | Y | note names the close date; stamp gains `prices` |
| /news/ | Name chips, story chips, rail moves (r1d) | screen | previous session; only the rail said so | N | `priceView` per symbol, rail note "Day move: {live HH:MM IST / date close}" |
| /news/ | "named most today", "today's stories" | news | stories span several days | N | "in these stories" |
| /news/ | Story time "{d Mon}, HH:MM IST", buckets | news | IST | Y | unchanged |
| /ipo/ | Open (mirror) "N days left / closes today" | ipo `days_left` | fixed when the mirror was built | N: wrong the day after | from `close_date` vs IST today; "Closed {date}" when past |
| /ipo/ | Mirror subscription "N× subscribed" | ipo | undated | N | "as of {built, IST}" |
| /ipo/ | "updated {ago(generated_at)}" | ipo | naive stamp read as local time | N: off by the reader's UTC offset | read as UTC (Likely: written by `datetime.now()` on a UTC GitHub runner) |
| /ipo/ | "How recent listings traded" | ipo | undated last close | N | "to the last close in the mirror built {IST}" |
| /ipo/ | Live NSE book "Fetched {ago}" | /api/ipo-live | | Y | unchanged |
| /engines/ | Signal card "Live / Last trade / Last close" | usePx / engines `last_close` | no time, no date | N | `priceView` against `data_through`; time or date under the price |
| /engines/ | "Live prices as of {ago(fetched_at)}" | /api/px | called live after the close | N | "Quotes fetched {ago}; each card says live, last trade or close" |
| /engines/ | "Prices through {data_through}", stamps, issue dates | engines | | Y | unchanged |
| /reads/ | "Latest · {last_date}" | shard | screen close | Y (dated) | now follows `priceView` and its label |
| /reads/ | "At publication · {date}", "Written …" | weekly_reads | | Y | unchanged |
| /rotation/ | "from the latest screen ({rotation last week})" | rotation dates | printed 16 Oct 2026 (a future Friday) as the screen's date | N | screen `as_of` |
| /rotation/ | "Above 200-day (today)", "as of today" | screen | screen session called today | N | "({screen date})" |
| /rotation/ | Week ending, week in progress | rotation + engines | | Y | unchanged |
| /journal/ | "Now" price, "today's screen price" | screen | close; date only in a tooltip | N | `priceView`, label under each price, wording "the price now" |
| /journal/ | Entry date default | browser date | user's own day | Y | unchanged |
| /funds/ | NAV on {date}, NAV dates range | funds | | Y | unchanged |
| /calendar/ | Days from today (IST) | screen | | Y | unchanged |
| /tools/ | No time-bound figures | | | Y | unchanged |
| /about/ | Data dates table, job status "last ran" | status, data-health | | Y | unchanged |

Labels checked: 59. Wrong, partly wrong or undated: 32. Fixed in owned files: 27. Left to the owners of home, brief, map
and screen: 5 (marked "Other agent").

## Deploy freshness (.github/workflows/deploy.yml)

Company pages are pre-rendered from `public/c/*.json` at build time. The deploy after the engines job runs about 18:50 IST,
before the data repo's overnight screen build (about 02:40 IST), so every company page's first paint showed the previous
session until the next deploy. Changes:

- `schedule`: `0 2 * * 1-6` (07:30 IST) and `0 4 * * 1-6` (09:30 IST catch-up; GitHub silently drops scheduled runs).
- The job `if:` also accepts `schedule`. A schedule always runs on the default branch, so checkout's
  `workflow_run.head_sha || github.sha` resolves to the tip of main; the build and `wrangler deploy` steps are the same.
- New step for scheduled runs only: the newest finished `ci` run on main must be `success`, else the run fails loudly.
  The tip of main can hold a commit CI rejected; data commits from the engines job are `[skip ci]` and are already deployed
  by that job's own dispatch. Needs `actions: read`, so the job now declares `permissions: contents: read, actions: read`.
- Unchanged: the `workflow_run` trigger after `ci`, `workflow_dispatch`, the Cloudflare-secret check, the smoke test,
  the `deploy` concurrency group without cancellation.

## Gaps

- `useLive()` has no shared subscription: each component that calls it (MarketClock, the prices stamp, the page) starts
  its own 60 s poll of both halves. Fix in lib/data.ts (module-level store, ref-counted) at integration.
- `dayFromLive()` (breadth, sector medians, owned elsewhere) still counts stocks whose last trade is older than the live
  session; use the new `LiveSnap.at` to drop them, as `priceView` does.
- Data repo (not changed): `ipo.json` `generated_at` has no timezone, and `days_left` is fixed at build time.
