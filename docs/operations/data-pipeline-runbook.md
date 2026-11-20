# Data pipeline runbook (20 Nov 2026)

Who makes the data the hub and the three sites show, how to tell it is stale, and how to get it moving again. Written after the 19 Nov 2026 incident: the jobs were switched off by hand, the hub served the 18 Nov close for two days, and nobody noticed.

## What makes what

The hub (alpha.askakshay.com) does not build its feeds. Its Worker reads them from the **trading-dashboard** repository (`docs/*.json`, cached about 5 minutes at the edge). Each feed has one producing workflow in that repository.

| Hub feed | Produced by (trading-dashboard/.github/workflows/) | Normal schedule (IST) | Allowed to trail |
|---|---|---|---|
| `screen`, `screen-detail`, `swot` | `stock_screen.yml` | weekdays 16:47, retries 19:07 and 23:00 | 0 sessions |
| `regime` | `regime.yml` | weekdays 19:20 | 1 session |
| `barometer`, `pulse` | `barometer.yml`, `newspaper.yml` | weekdays 19:15; daily 03:30 | 1 session |
| `news`, `data-health` | `newspaper.yml` | daily 03:30 | not checked |
| `ipo`, `funds`, `weekly_reads`, `seasonality` | `ipo_tracker.yml`, `fund_screen.yml`, `weekly_reads.yml`, `seasonality.yml` | weekly (Saturday) or monthly | not checked |

Rulebook, Tripwire and ApexPro read the hub, so they are only as current as these files. ApexPro and the hub also show live prices on top (see BUILD-LOG, ApexPro v23), which hides one session of lag but not the scores.

## How you find out

`freshness.yml` (this repository) runs at 09:30 IST every day and fails when (a) a feed is behind the newest finished NSE session by more than its allowance, using the exchange calendar so holidays are not alarms, or (b) one of `stock_screen.yml`, `regime.yml`, `barometer.yml`, `newspaper.yml` is not `active`. A failure opens or comments on one issue, "Hub data is stale". Run it by hand: Actions, freshness, Run workflow.

## How to fix it (no command line needed)

1. Open github.com/caakshayk1-boop/trading-dashboard, Actions.
2. Click the workflow named in the issue in the left list.
3. If a banner says "This workflow was disabled manually", click **Enable workflow**.
4. Click **Run workflow** (branch `main`), then the green button. The screen build takes 12 to 35 minutes.
5. When it is green the hub shows the new data within about 5 minutes. For regime and barometer, run `stock_screen.yml` first, then regime, then barometer.
6. If the run fails, open it, copy the red step's log into the issue.

## Known weak points

- GitHub drops or delays scheduled runs (observed 18 Nov: slots started 6 to 8 hours late). The screen has three slots a day for that reason. A late build is not a failure; a missing one is.
- The screen job is not self-contained: it imports `newspaper.py`, which pulls in 35 other modules (the Telegram bot, the tracker, the scanner, the Upstox client), 49 modules and 2.4 MB in all. Moving the screen into another repository means first cutting that dependency (the screen uses only the database, the job-status record and the narrative call from `newspaper.py`).
- The holiday calendar (`apps/tripwire/src/calendar.ts`) covers 2026 only. Extend it before January 2027 or the check treats every weekday as a session.
- The check does not cover the weekly and monthly feeds.
- Three repositories hold producers or feeds the hub reads: trading-dashboard (public), signal (public, `institutional.json`), vision-engine (private; Signal V2, which must never be moved into a public repository).

## Open decisions

- Whether to move the screen's producer into this repository. Recommended only after the `newspaper.py` dependency above is cut inside trading-dashboard, where its 449-check test suite already runs.
- Whether Telegram alert workflows, the ledger maintenance jobs and the older scans stay disabled. They were switched off with the rest on 19 Nov and the owner has not said whether that was intended.
