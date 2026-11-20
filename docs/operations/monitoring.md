# Monitoring, staging and rollback (19 Nov 2026)

## What watches the four sites

| Site | Probe | Every | On failure |
|---|---|---|---|
| Rulebook (lockedfree.askakshay.com) | `lockedfree_uptime.yml`: page, headers, API health, calls page, a stock page, 404, data no older than 4 days | 30 min | opens or comments on the issue "Rulebook: live site check failed" |
| Tripwire (tripwire.askakshay.com) | `uptime.yml`: home, `/data/screen.json`, `/api/pulse`, HSTS header | 30 min | opens or comments on "Live check failed: tripwire" |
| ApexPro (apexpro.askakshay.com) | `uptime.yml`: home, `/api/screen`, `/api/company`, `/api/market`, HSTS header | 30 min | "Live check failed: apexpro" |
| Hub (alpha.askakshay.com) | `uptime.yml`: home, `/build.json`, `/v1/manifest.json`, `/data/screen.json`; `smoke.yml` runs the fuller smoke test | 30 min | "Live check failed: hub" |

GitHub emails the repository owner when an issue is opened. If you want a phone alert as well, use the GitHub mobile app's notification setting for this repository.

## Data freshness (20 Nov 2026)

`freshness.yml` runs every morning at 09:30 IST and fails when the hub's data is behind the newest finished NSE session: the screen must be on that session, regime and barometer may trail it by one (they are built from the previous session's bars). The date comparison uses the exchange calendar (`apps/tripwire/src/calendar.ts`), so a market holiday is not an alarm. A failure opens or comments on one issue, "Hub data is stale", naming the producing workflow. The feeds are built in the trading-dashboard repository; on 19 Nov 2026 its workflows were switched off and nothing warned for two days, which is why this exists. Not covered: the other feeds (news, IPO, funds, weekly reads, seasonality), which have slower cadences; the calendar covers 2026 only, so the check needs the holiday table extended for 2027.

## Staging

There is none. Each site deploys from `main` after its checks pass (`apexpro.yml`, `tripwire.yml`, `deploy.yml` for the hub, `lockedfree.yml`). The safety net is the pull request run: the same build and browser suites run before merge. A staging environment is a separate decision, because it needs its own Cloudflare Workers and data copies.

## Rollback

`docs/operations/rollback-runbook.md` covers the hub (its deploy refuses to go backwards unless a rollback is chosen on purpose). For ApexPro, Tripwire and Rulebook: revert the merge commit on `main` with a pull request and let the deploy run, or, in a hurry, redeploy the previous good commit from the Cloudflare dashboard (Workers, the site, Deployments, Rollback). Check the live site and the probe afterwards.

## Not covered

Cloudflare account settings (DNS, redirects, the `legacy-redirect` Worker, analytics), which are not in this repository.
