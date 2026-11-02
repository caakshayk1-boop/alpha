# Privacy, Terms, Not found and the share image (2 Nov 2026)

**This is a plain-language summary, not legal advice; the owner should have it reviewed before a public launch.**

Routes: `#/privacy` and `#/terms` (lazy chunk `src/screens/legal.tsx`; shared `Fold`, `PageBar`, tokens only, one h1, print prints every section open). Linked from More, Settings, the footer of Today, Help and Methodology, and the first-use screen. A first-time visitor can read both before choosing anything. `src/legal.ts` holds the "Last updated" constant (`LEGAL_UPDATED`); change it when the text changes.

## What the Privacy page is written from (so it can be re-checked)

| Claim | Source in the code |
|---|---|
| Notes, plans, follows, paper trades and preferences are in local storage under `tripwire:v1`; small conveniences under other `tripwire:*` keys; one session-storage hand-off to the Lab | `src/app.tsx`, `persist.ts`, `discoverstate.ts`, `news.ts`, `bookingseen.ts`, `bannerslot.ts`, `backupstatus.ts`, `lab/store.ts`, `lock.ts`, `screens/discover.tsx` |
| No cookies, no IndexedDB, no analytics, no third-party script | no `document.cookie` or `indexedDB` in `src/`; `static/_headers` CSP (`script-src 'self'`, `connect-src 'self'`); pinned by `tests/legal.test.ts` |
| The browser only ever talks to its own origin; the Worker calls Yahoo Finance, Google News and Bing News (RSS search), the RBI and SEBI feeds, and raw.githubusercontent.com | `worker.js`, `news/config.js`, `news/nudge.js`; `tests/legal.test.ts` fails if the code gains a host the page does not name |
| Requests carry symbols, a company name for news, never notes or amounts | `src/quotes.ts` (`/api/tick?s=`), `data.ts`, `news.ts` |
| The Worker has no database or user storage; public answers cached for seconds to ~6 h; one IP-keyed marker (30 s) for "Refresh now" | `wrangler.tripwire.jsonc` (assets binding only), `worker.js` (`caches.default`, `forcedTooSoon`) |
| TradingView is a plain link, not an embed | `src/tv.ts`, `live.tsx`; CSP would block an embed |
| Backup contents | `store.ts#exportJson` (the whole saved state), `settings.tsx` |

## Not verified (said "not verified" on the page, or not claimed)

- **Cloudflare request logs.** `wrangler.tripwire.jsonc` has `"observability": { "enabled": true }`. Which fields Cloudflare records, whether the client IP is among them, and the retention are set by the Cloudflare account, not by this repo.
- **Cookies added by the host.** The app sets none; whether Cloudflare adds any in production was not checked against the live site.
- **Yahoo, Google, Bing, RBI and SEBI terms of use** for automated reads from a server were not reviewed.
- **Not affiliated with / not endorsed by** NSE, BSE, SEBI, Yahoo, Google, Microsoft, TradingView, GitHub, Cloudflare: stated in the Terms as fact about Tripwire; the owner should confirm.
- **No claim of SEBI registration status either way.** The Terms say Tripwire "does not give investment advice and does not hold itself out as an investment adviser or research analyst". Whether any registration is needed or held is for a lawyer.
- **No governing-law or jurisdiction clause**, no data-protection-statute citations, no age limit, no arbitration: left out on purpose because none can be supported from the code.

## Known gap found while writing this (not changed here)

Settings, Erase data, **Delete all my data** resets the saved state (`tripwire:v1`) and the kept unreadable copy. It does **not** remove the small `tripwire:*` convenience keys (last Discover search, news cache, last backup record, Lab settings, screen-lock id) or the offline cache. The Privacy page says exactly that and points to "clear this site's data" for the rest. If the owner wants the button to remove every `tripwire:*` key, that is a small change in `screens/settings.tsx` (and the lock id deserves a decision: removing it also removes the screen lock).

## What the owner must supply

1. **A support address.** Set `SUPPORT_EMAIL` in `src/contact.ts` (it ships empty; the pages say "Contact: not set up yet"). Rebuild: the pages then show a mailto link and the build writes `/.well-known/security.txt` (RFC 9116: Contact, Expires one year from the build, Canonical). Until then no `security.txt` is published. Not verified: that the asset host serves a dot-directory (`.well-known`); open the URL after the first deploy.
2. **A legal review** of both pages before a public launch.
3. A decision on the Erase-button gap above.

## Share image

`static/og.png`, 1200 x 630, about 51 KB, drawn by `tools/make-og.mjs` (Playwright screenshot of an HTML template; colours read from `src/tokens.css`, mark read from `static/icon.svg`, the bundled JetBrains Mono embedded). Re-run `node apps/tripwire/tools/make-og.mjs` when the tokens, the icon or the line change, and commit the PNG. `build.mjs` refuses to ship without it or over 120 KB. It is copied by the existing `.png` loop; it is not in the service worker's precache (a link-preview crawler is the only reader), so no precache count changed. `static/index.html` carries `og:image` (absolute), `og:image:width/height/type/alt`, `twitter:card=summary_large_image`, `twitter:title/description/image`.

## Crawler files

The app is hash-routed, so a crawler sees one page: `sitemap.xml` lists the site root only (a `#/privacy` fragment is not a separate URL and cannot be listed validly). `robots.txt` is unchanged (`Allow: /$`, `/api/` and `/data/` disallowed, sitemap named). `llms.txt` now names the two pages by their full addresses.

## Not found

`src/route.ts` lists every address the app routes (`KNOWN_HEADS`); any other first segment renders `screens/notfound.tsx` (h1 "Not found", the address as plain text, a search button, links to Today, Discover and More, document title "Not found · Tripwire") instead of silently showing Today. Addresses are lower case (`#/Today` is not a route). An unknown company (`#/c/ZZZZ`, which the Worker already answers with a JSON 404 for `/data/c/ZZZZ.json`) shows "We do not have this company" with the symbol and the size of the screen. An unknown address is never remembered as a tab's last place. `/data` and `/api` are unchanged.

## Tests

`tests/legal.test.ts` (11, in `tripwire:test`) and the browser suite `tests/legal.mjs` (registered in `tests/check.mjs`).
