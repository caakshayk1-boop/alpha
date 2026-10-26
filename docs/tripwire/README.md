# Tripwire

A separate, installable app that shows which public rules fired at the last close, the case and countercase for a name, and keeps your own decisions with review dates. Paper only. Not advice.

It is **not** a re-skin of the alpha website: its own design system (`apps/tripwire/src/style.css`), motion, routes and navigation (Today · Discover · Signals · My Desk · Profile), and no link to the site. It reads the same published data files.

## Run
```
node scripts/shard.mjs      # once, to fetch the published feeds into public/c (the website build does this too)
npm run tripwire:build   # bundles the app and copies the data feeds into apps/tripwire/dist
npm run tripwire:dev     # serves it on http://localhost:8801
npm run tripwire:types && npm run tripwire:test
npm run tripwire:check   # starts the Worker, runs the browser journeys and the accessibility gate
```

## Engines and the paper tracker
See `docs/tripwire/ENGINES.md`. The Worker has read-only routes `/api/intraday` (live prices for up to 30 symbols, which every list, the company page and the comparison use), `/api/macro` (gold, silver, Brent, WTI, USD/INR, MYR/INR, USD/MYR, Bitcoin), `/api/news` (cleaned Google News headlines, cached an hour) and `/api/pulse` (Nifty, Bank Nifty, VIX), plus the three below: `/api/bars` (daily bars and a delayed live price for the tracker) and `/api/chart` (full daily history and the Nifty, for the price chart), both from Yahoo Finance, and `/api/ledger` (the nightly forward record, read from the repository). It has no secrets and stores nothing.

## Data ("the same database")
`build.mjs` reads `public/c/*.json`, `public/universe.json` and `public/signals.json` (and `public/engines_v3.json` when it exists) and writes a compact `dist/data/screen.json` plus one small file per company. It is a snapshot: Tripwire is only as fresh as its last build, and every screen states the data date. Rebuild and redeploy after the website's data refresh, or schedule the build. There is no live data connection.

## Deploy (owner actions)
The `tripwire` workflow also redeploys on a schedule (23:45 and 04:15 IST, Monday to Saturday) so the data does not go stale; remove its `schedule` block for manual-only deploys.

Nothing is deployed from here. `wrangler.tripwire.jsonc` is an assets-only Worker with no secrets and no route.
1. Choose the address (a custom domain or route in Cloudflare).
2. `npm run tripwire:build && npx wrangler deploy --config wrangler.tripwire.jsonc`, or run the `tripwire` workflow by hand with `deploy=true`.
3. Indexing stays off (`noindex`, `Disallow: /`) until you decide; change `robots.txt` in `build.mjs` and the meta tag in `static/index.html`.
4. Roll back by deleting the route or redeploying the previous Worker version.

## What is not here yet
Accounts and sync, notifications, billing, the AI assistant, portfolio import and share links all need a credential, a provider or a decision. See `docs/BUILD_STATUS.md` for each, with its exact dependency.

## Round 2 (26 Oct 2026)
- **Live prices everywhere** (`quotes.ts`): the published screen is a closing snapshot, so a list used to show Friday's close beside Monday's market. One poller asks `/api/intraday` for the symbols on screen (25 a call, every minute while visible); a quote replaces the close only when it is from the same Indian day or later. The app no longer says "delayed": it shows the time of the last price instead, because the delay Yahoo applies to NSE is not stated by Yahoo and varies.
- **Comparison**: from a company page it asks for the second name (search or sector peers) instead of dead-ending; up to three names on one indexed chart (first shared day = 100) with the Nifty, and the table beneath. Names can be removed.
- **Commodities, currencies, Bitcoin** on Today and on their own page (`macro.ts`, `/m/<KEY>`): their own chart (1Y to Max, daily or monthly, linear or log), trend tag from their own 50 and 200-day averages, TradingView link. Gold, silver and oil are COMEX/ICE futures in dollars, not MCX.
- **News** (`news.ts`, Worker `parseNews`): English only, search-engine filler dropped, one story from many outlets folded into one line, keyword tags (Results, IPO, Deal, Order, Rating, Payout, Regulator, People), most material and newest first. Refreshes every hour and on demand. Tags describe the topic; nothing is read for sentiment.
- **Automatic paper book** (`autobook.ts`, Signals → Auto): every pick of the nightly record is taken the night it is written, best score first, at most 30 positions at a time and at most ₹1,00,000 in one (quantity = ticket ÷ signal close, rounded down). Refusals (already held, one share dearer than the ticket, book full, voided) are logged with the reason. It is a pure function of the append-only record, so every device shows the same book. Entry, stop, time exit and costs are the tracker's. Positions the record has finished come from it; the rest are followed live.
- **Trend**: the third state is now called Sideways (the price and the two averages are not in one order). It is the same rule as before, with a clearer name, and it is a Discover filter too.
