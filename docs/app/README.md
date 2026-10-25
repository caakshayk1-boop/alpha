# Alpha app edition

A lean public build of the same codebase. It keeps the daily decision loop and drops the research desk.

## What is in
Four tabs: **Today** (`/`), **Signals** (`/engines/`, the rule board), **Find** (`/screen/`, `/research/`, `/compare/`, `/company/<SYM>/`), **My Desk** (`/desk/`, `/watchlist/`, `/journal/`, `/tools/`). Also `/about/`, `/pro/`, `/privacy/`.

## What is out, and where it goes
Brief, Calendar, Funds, IPO, Map, Markets, News, Reads, Rotation, Trades. Each is sent by the app's host (302) to the same page on the full site, so no link dead-ends. The app ships no brief feed or company sitemap; it keeps `rotation.json`, which company pages read.

## How it is built
`NEXT_PUBLIC_EDITION=app` is fixed at build time (`src/lib/edition.ts`). The full build is unchanged: no runtime branch. `scripts/app-pack.mjs` copies `out-app-build` to `out-app`, drops pages outside the app, writes `_redirects`, the app manifest, sitemap and `app-report.json`.

```
npm run build:app      # build + pack into out-app/
npm run check:app      # static checks, local Worker, hand-offs, every page at 390px
npm run worker:dev:app # serve it on :8798
```

## Deploying (owner actions)
Nothing is deployed from CI automatically. The `app` workflow builds and checks on every PR; **deploy is manual** (`workflow_dispatch`, input `deploy=true`) and uses the existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
1. Choose the address (for example `app.askakshay.com`). `wrangler.app.jsonc` has no route on purpose; the first deploy lands on the account's `workers.dev` address, which is not indexed.
2. Add the route or custom domain in the Cloudflare dashboard.
3. Set repository variable `APP_URL` to that address. The next build then publishes a sitemap and lets search engines index it. Without it the app says `Disallow: /`.
4. Waitlist mail secrets, as on the full site, if `/pro/` should collect addresses on this host.

## Rollback
Delete the route in Cloudflare (or redeploy the previous Worker version). The full site is untouched by any of this.

## Known limits
- The app and the full site have separate Durable Object namespaces, so waitlist and quota counts are not shared.
- `app-check` runs the Worker locally; live `/api/*` calls fail in a sandbox with no network, so the check uses the `load` event, not network-idle.
