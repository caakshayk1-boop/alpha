# Why the morning build lands late (master prompt 1.4a), from the Actions history

Source: `tripwire.yml` run history read on 13 Nov 2026 (60 runs, 4 to 12 Nov). Times are UTC; IST is +5:30. Nothing here is a guess about the publisher: it is what the runs show.

## What the history shows

| Finding | Evidence |
|---|---|
| The two scheduled recovery slots (02:15 UTC = 07:45 IST and 03:45 UTC = 09:15 IST) never run on time. | Scheduled runs started at 09:04 to 09:43 UTC and 11:26 to 11:51 UTC (14:34 to 15:13 IST and 16:56 to 17:21 IST) on every weekday in the window: 6 to 9 hours late. GitHub cron is best effort; this repository has measured it before (`docs/tripwire/launch/RELIABILITY.md`). The schedule is a safety net that does not catch a missed dispatch in time. |
| The real trigger is the screen publisher's `repository_dispatch`, and it lands in the evening or night, not the morning. | Dispatch runs started 18:55, 20:52, 22:42 (10 Nov), 19:05, 23:53 (11 Nov), 19:12, 21:26, 23:07 (12 Nov): 00:25 to 04:37 IST the next day. So "the morning build" is the previous evening's build, and the site is as current as the publisher's last dispatch. |
| On 12 Nov the first nightly dispatches FAILED because of the ledger rule added that day. | Runs at 19:12 and 21:26 UTC failed in about 2 minutes on `ledger: CHECK B FAILED ... one session behind`; the ledger job records a few minutes AFTER the publisher dispatches the deploy, so the check always raced it. The data deploy slipped to 23:07 UTC, about four hours. **Fixed 13 Nov**: the deploy no longer reads the ledger; the ledger rules are a separate report-only step (`check-data.mjs --ledger-only`, `continue-on-error`) that turns red and writes a summary section without stopping the deploy. |
| Earlier dispatch failures (9 Nov 21:48, 23:20; 10 Nov 01:11 UTC) are a different cause. | The 10 Nov log shows an `ERR_ASSERTION` in the test step before the build. Not investigated further: the test it names no longer fails. |
| Scheduled runs on 5 and 6 Nov (4 runs) failed in under 2 minutes. | Logs not read; they predate the freshness work. |

## What was NOT established

- Why the publisher dispatches when it does (its schedule and runs are in another repository or service that this session cannot read). If the site should be current by 07:45 IST, the publisher's own timing is the thing to check.
- Whether the recovery crons would help if they ran on time: they cannot be made on time from this repository.

## What would shorten it (not done: each needs a decision)

1. A watchdog outside GitHub Actions cron (for example a Cloudflare cron trigger that dispatches the workflow when the served `as_of` is behind the last session). The signal site already runs one for itself.
2. Telling the publisher to dispatch after its own commit and not on a timer.
