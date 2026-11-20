# Rulebook runbook (lockedfree.askakshay.com)

## Build production from a clean checkout
```
git clone <repo> && cd alpha/apps/lockedfree
npm ci
node tools/fetch-feed.mjs        # downloads and validates the owner's daily feed (refuses stale or partial data)
npm test                          # unit tests
npx astro build                   # writes dist/ (1,000+ pages)
node tools/assert-no-demo.mjs dist && node tools/copy-audit.mjs dist && node tools/assert-launch.mjs dist
```
Deploy is by CI only (`.github/workflows/lockedfree.yml`, on main): `npx wrangler deploy --config wrangler.lockedfree.jsonc`, then a live check. There is no separate staging site: pull requests run the same build and gates without deploying; to try a change on a real Worker, run `npx wrangler dev --config wrangler.lockedfree.jsonc` locally.

## Who is told when something breaks
- A failed deploy, nightly ledger, weekly screens run or live probe opens (or comments on) one GitHub issue titled `Rulebook: … failed`. GitHub emails the repository owner and watchers; the owner is the person paged. Make sure notifications for this repository are switched on for email or the GitHub mobile app.
- `lockedfree-uptime` probes the live site every 30 minutes (page, HSTS, CSP, API health, 404 status, data date no older than 4 days).
- A failed ledger night writes nothing: the site keeps serving the last good ledger. A failed deploy leaves the previous deployment live.

## Roll back the code
1. Cloudflare dashboard: Workers & Pages, `lockedfree`, Deployments, pick the previous version, Rollback. Or locally: `npx wrangler rollback --config wrangler.lockedfree.jsonc`.
2. Then `git revert <bad commit>` on main so the next scheduled build does not redeploy it.

## Roll back the data
The ledger is append-only in git (`apps/lockedfree/ledger/`, dated snapshots in `ledger/snapshots/`). To undo a bad night: `git revert <the "ledger: rulebook …" commit>`, push, and the deploy rebuilds. Never edit fills or runs by hand: the build refuses a history rewrite.

## Email list: backup, restore, delete
Needs the `ADMIN_TOKEN` secret on the Worker (`npx wrangler secret put ADMIN_TOKEN --config wrangler.lockedfree.jsonc`). Keep the exported file private: it holds personal data, so never commit it.
- Backup: `curl -H "Authorization: Bearer $TOKEN" https://lockedfree.askakshay.com/api/subscribers > subscribers-backup.json`
- Restore (adds missing rows, never overwrites): `curl -X PUT -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" --data @subscribers-backup.json https://lockedfree.askakshay.com/api/subscribers`
- Delete one person: `curl -X DELETE -H "Authorization: Bearer $TOKEN" "https://lockedfree.askakshay.com/api/subscribers?email=person@example.com"`
Test order after any change to this code: backup, restore into the same list (no change expected), delete a test address, confirm it is gone. Take a backup monthly; there is no automatic backup because the file contains personal data.

## If the data source fails
The daily feed download refuses stale or partial data and fails the build, so the site keeps the last good deploy. If Yahoo fails, quotes and charts show a plain failure message and the daily-feed prices remain; the nightly ledger goes red and writes nothing.

## Exit rules
Per-engine stops, targets and the one-month cap are in `src/lib/exitrules.ts` (ADR-017). Changing them changes how future calls leave; it does not rewrite past fills.

The origin robots.txt allows public pages, excludes /api/ and names the canonical sitemap. Cloudflare also adds a managed wildcard group and named crawler restrictions at the zone edge. Keep its search and model-training content signals and named-agent restrictions when reviewing the zone policy. Editing the origin file alone cannot consolidate the edge groups.

### Interface and audit checks (21 November 2026)

After the normal build, `node tools/check-routes.cjs` exercises the built pages offline, including unavailable quote responses, at four widths. Install Playwright Chromium first, or set `BROWSER_CHANNEL=chrome` to use installed Chrome. CI runs it before deploying. For subscriber lifecycle tests, start Wrangler with `dev --local --port 8884 --config wrangler.lockedfree.jsonc --persist-to <new temporary directory> --var ADMIN_TOKEN:local-test-only` at repository root. Run `node tools/check-subscriber-local.mjs` in this app. This test exclusively uses loopback and synthetic data.

The deployed robots policy combines a Cloudflare-managed wildcard group (search permitted; AI training restricted) with the origin group that excludes `/api/`. Removing the origin group would lose the API exclusion; removing the managed group would lose the content signals and named crawler rules. No zone-wide change is needed to serve the site. The account's actual operational-log retention, deletion turnaround and newsletter delivery cadence have not been established. No subscriber address was retrieved from production. Physical handset and human screen-reader review remain separate from automated checks.
