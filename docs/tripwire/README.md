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

## Look and feel (26 Oct 2026)
The brief was a list of iPhone app details (SwiftUI, a Metal shader, Face ID, alternate icons, Dynamic Type). Tripwire is a web app, so each item is built as its web equivalent, and where the web cannot do it the app says so.
| Item | In Tripwire |
|---|---|
| Numbers that roll, about 0.2 s | `Roll`/`Tick` in `live.tsx`: a changed digit leaves upward or downward and the new one arrives, 200 ms, ease-out. At rest the text is plain characters. `rollDiff` in `roll.ts` is tested. |
| One big celebration | `celebrate.ts`: confetti in the theme's colours, once, the first time a trade is seen closed at +1R or better. Remembered in the browser so it never repeats; skipped under reduced motion. |
| Skeleton loader, not a spinner | Every loading state is the shimmering `.sk` placeholder. |
| Moving water from a shader, paused in Low Power Mode / Reduce Motion | `aurora.tsx`: a half-resolution canvas of slow waves behind the market-mood card, tinted by the Nifty's move and choppier when the VIX rises. Stops when the page is hidden or scrolled away, when motion is off or reduced or Save-Data is on, and steps itself down to 15 fps and then to a still frame if the device cannot keep up. A web page cannot read Low Power Mode; frame time and Save-Data are the nearest signals. |
| Haptics | `haptic.ts`: the Vibration API on Android; on iPhone Safari 17.4+ a hidden switch control gives the system's light tap. Fires on buttons, and a success or error pattern with each message. No support, no tap. Switch off in Profile. |
| Buttons shrink when pressed | `:active` scale 0.96 on controls and 0.985 on cards, 160 ms. |
| Face ID to open, one-tap privacy lock | `lock.ts`: WebAuthn with the phone's own unlock (Face ID, fingerprint or passcode). It is a screen lock, not encryption: the data stays in browser storage and anyone who can inspect the browser can read it. A failed unlock can only be passed by erasing the device's data. The eye button on Today (and a switch in Profile) blurs every amount of yours (`.amt`). |
| Launch screen with no white flash | Inline dark background and the mark in `index.html`, before any stylesheet. An iPhone splash image per screen size is not shipped. |
| Biggest text sizes | All type is rem. `dyntype.ts` scales the root from the phone's text-size setting on Safari. `a11y.mjs` renders seven screens at 150% and 200% and fails on sideways overflow or a control that clips its text. |
| Icons | `tools/icons.mjs` draws one mark for five colour themes and exports opaque full-bleed PNGs at 180, 192, 512 and 1024, a maskable and a single-colour icon. The same mark is in the app (`Mark`). |
| Alternate icons in Settings | Not possible for a web app: a phone takes the icon when the app is added to the home screen. Profile → Look changes the colour theme and the icon the page offers; to use another icon, remove the app from the home screen and add it again. iOS 18 dark and tinted icon variants exist only for native apps. |
Widgets on Today: market mood on live water, a ticker tape, index and commodity tiles tinted by direction, a ring for the auto book's 30 positions, and a sector heat map.
