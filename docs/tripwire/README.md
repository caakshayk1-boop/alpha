# Tripwire

A separate, installable app that shows which public rules fired at the last close, the case and countercase for a name, and keeps your own decisions with review dates. Paper only. Not advice.

It is **not** a re-skin of the alpha website: its own design system (`apps/tripwire/src/style.css`), motion, routes and navigation (Today · Discover · Signals · My Desk · Profile), and no link to the site. It reads the same published data files.

## Run
```
npm run tripwire:build   # bundles the app and copies the data feeds into apps/tripwire/dist
npm run tripwire:dev     # serves it on http://localhost:8801
npm run tripwire:types && npm run tripwire:test
npm run tripwire:check   # starts the Worker, runs the browser journeys and the accessibility gate
```

## Data ("the same database")
`build.mjs` reads `public/c/*.json`, `public/universe.json` and `public/signals.json` (and `public/engines_v3.json` when it exists) and writes a compact `dist/data/screen.json` plus one small file per company. It is a snapshot: Tripwire is only as fresh as its last build, and every screen states the data date. Rebuild and redeploy after the website's data refresh, or schedule the build. There is no live data connection.

## Deploy (owner actions)
Nothing is deployed from here. `wrangler.tripwire.jsonc` is an assets-only Worker with no secrets and no route.
1. Choose the address (a custom domain or route in Cloudflare).
2. `npm run tripwire:build && npx wrangler deploy --config wrangler.tripwire.jsonc`, or run the `tripwire` workflow by hand with `deploy=true`.
3. Indexing stays off (`noindex`, `Disallow: /`) until you decide; change `robots.txt` in `build.mjs` and the meta tag in `static/index.html`.
4. Roll back by deleting the route or redeploying the previous Worker version.

## What is not here yet
Accounts and sync, notifications, billing, the AI assistant, portfolio import and share links all need a credential, a provider or a decision. See `docs/BUILD_STATUS.md` for each, with its exact dependency.
