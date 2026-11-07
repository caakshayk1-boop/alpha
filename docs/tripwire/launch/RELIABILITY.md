# Tripwire reliability and honest status (27 Oct 2026)

Branch of the reliability and honest-status owner. Not merged, not deployed. Everything below was read from GitHub's run history and the repository on 27 Oct 2026 (about 18:00 UTC) unless marked **unverified**. The sample is small and says so.

## 1. What was measured

### 1.1 GitHub's scheduler starts every job hours late

| Job (repository) | Cron slot (UTC) | Actual start (UTC) | Late by |
|---|---|---|---|
| Stock screen, 21:00 IST slot (research repo) | 15:30 | 21 Oct 19:26, 22 Oct 19:19, 23 Oct 19:23, 24 Oct 18:15, 25 Oct 18:30, 26 Oct 20:38 | 3 h 56, 3 h 49, 3 h 53, 2 h 45, 3 h 00, 5 h 08 (median 3 h 51) |
| Stock screen, "retry" slot (research repo) | 17:30 | 20:44, 20:39, 20:32, 19:35, 19:48, 21:42 | 3 h 14, 3 h 09, 3 h 02, 2 h 05, 2 h 18, 4 h 12 (median 3 h 05) |
| tripwire-ledger (this repo) | 18:30 and 22:30 | 26 Oct 22:47, 27 Oct 01:35 | 4 h 17 and 3 h 05 if read as the two slots in order |
| tripwire (build and deploy) | 18:15 and 22:45 | 26 Oct 22:36, 27 Oct 01:37 | 4 h 22 and 2 h 52 |
| tripwire-news (this repo) | every 15 or 30 minutes | manual run 27 Oct 16:28; then **one** scheduled run, 20:54 UTC (run 40582238871), up to 23:48 UTC | **about 29 scheduled ticks were due in those 7 h 20 min and one started** (reported by the coordinator from the run list; I read the list earlier, at 18:01 UTC, and it held no scheduled run) |

Notes on how far these numbers go.
- The screen build has 12 runs in 6 days, all green; the two slots are about 80 minutes apart in practice although the cron lines are two hours apart, so both are being drained from one queue rather than starting on their own clock.
- GitHub does not record which cron line started a run. The ledger and build rows are the best fit of two runs to two slots; read the other way round, one run was only 17 minutes late and one slot was dropped. Either reading says the same thing: the runs bunched into the 22:36 to 01:37 UTC window.
- The news workflow was merged to `main` at about 16:2x UTC (PR #40) and run once by hand at 16:28:24 UTC (23 seconds, 250 events, 4 of 4 sources answered). At 18:01 UTC, 93 minutes later, the run list still held that one run, though at least three ticks of the 30-minute grid were due. The later count (1 of about 29) shows this is not a start-up delay: scheduled news is effectively hours stale, so the 15 and 30 minute cadence is a wish, not a service. Why GitHub drops most ticks (low-activity repository, load, the dense grid itself) is **unverified**. The page was already calling the news delayed in that window (allowed age 70 minutes outside the session, 40 in it).
- Sample sizes: 12 screen runs, 2 ledger runs, 2 build runs, 1 scheduled news run in 7 h 20 min. No percentile can be quoted for the last four.

### 1.2 The dependency chain was ordered by the clock, and the clock was wrong

`close 15:30 IST` then `screen build (research repo, written to the database)` then `newspaper job commits docs/screen.json` then `this repo: ledger, then build and deploy` (the news job is separate).

The step that matters is the third. The screen this app reads is `docs/screen.json` in the research repository, and it is committed by the **newspaper** job, not by the screen build. The last 12 commits to that file were at 00:05, 00:09 (17 Oct), 23:46, 23:55 (18 Oct), 00:55 (20 Oct), 00:23, 00:25, 00:22, 00:14, 23:58, 23:45 (25 Oct) and 01:05 UTC (27 Oct), that is 05:15 to 06:35 IST.

The ledger and deploy cron slots (18:15, 18:30, 22:30, 22:45 UTC) were all **earlier** than that commit. The comments in both workflows said "after the 21:00 IST screen build"; that build had reached the database, not `docs/`. Consequences, all read from the files:
- A job that ran on time saw yesterday's screen. The ledger recorded a new data day only when GitHub started it 3 hours or more late. `ledger.json` has two days: **23 Oct, recorded on 25 Oct 16:43 UTC by a manual dispatch**, and **26 Oct, recorded 27 Oct 01:36 UTC (07:06 IST)**, 31 minutes after the 01:05 UTC commit, by the slot that ran 3 hours late. The 22:47 UTC run on 26 Oct committed the ledger (outcomes only) and recorded no new day.
- The Monday-night deploy (run 50, 22:36 UTC) built from the commit of 25 Oct 23:45 UTC, which carries prices through Friday 23 Oct. The run that would have carried Monday's close (run 52, 01:37 UTC) failed.
- So the system worked only because it was late. Had GitHub been punctual, each picks night would have been written a day late, after the next session's open had printed, which is the thing the forward record must not allow.
- The second slot of each pair ("retry") never stood down: the screen build ran both slots on all 6 days, about 20 minutes each. That is double the compute for no extra data.

### 1.3 Why the 01:37 UTC deploy failed (run 40433652756)

The deploy is gated by the browser suites. The log shows `journey.mjs` dying with `page.waitForSelector: Timeout 15000ms exceeded ... .dot-live` and `beta.mjs` failing "invalidation is shown in the summary" (an immediate read, no wait). Unit tests, the build and the type check were green. Nothing was wrong with the data or the app.
- The same commit passed on a manual run 1 hour 40 minutes earlier (run 51). So it is timing, not code.
- It is also **clock-dependent**: on an untouched copy of the repository built at the start of this work, `journey.mjs` fails at 23:44 IST (market shut) on the same wait for a live price after a reload, because the page asks for quotes once per load and the test does not re-ask. The browser gate therefore passes or fails with the time of day and the speed of the runner, and a failed gate leaves the site on the previous build.
- Not fixed here: the test file belongs to another lane. Fix: wait for the visibility re-ask the way the picks check does. What is fixed: a scheduled run now gets one more attempt at the gate (section 3).

### 1.4 The news path, step by step, and where it can be late

1. The source publishes. Google News and Bing RSS add their own lag, and some items carry no time at all (shown as "Publication time unknown").
2. The job runs on GitHub's scheduler (section 1.1: hours late, sometimes not at all). Its own guard skips a tick that arrives less than 12 minutes after the last one, so a late tick followed by an on-time one can leave a gap of 20 minutes or more even when nothing is dropped.
3. It publishes by force-pushing the orphan branch `tripwire-data`. Both the job step and the publish step were `continue-on-error`, so a crash or a failed push left the run **green** with nothing published and no failure mail.
4. The Worker reads `raw.githubusercontent.com` and keeps it at the edge: status file 60 s, snapshot 5 min. GitHub's own raw cache adds up to about 5 minutes (documented behaviour, **not measured here**: the sandbox cannot reach it).
5. The browser asks the status file once a minute while the tab is visible.

So even when the job is punctual a reader can be up to roughly 10 minutes behind the published time; when GitHub is late the page says delayed after two cadences plus 10 minutes (40 minutes in session, 70 outside).

## 2. What the person sees when it happens

| Situation | What is on screen today |
|---|---|
| News check late | "Delayed", the time of the last successful check, how many minutes ago, the schedule, and, new in this change, the time of any on-demand refresh. Stories already held stay readable. Never "live", never "fresh". |
| News check failed | Delayed, with the failure named. The last good stories stay. |
| News never published | "Unavailable: no check has succeeded yet." Nothing in its place. |
| Screen one session behind | "Screen: close of Fri 23 Oct" with a "One session behind" tag on Today; the picks are headed with the close they were chosen on; a banner above one session; the Data page's pipeline table names each stage. |
| Ledger night missing | Data page, pipeline table: the stage reads late or behind against the exchange calendar. |
| Deploy failed | Nothing says so. The site serves the previous build and its data date shows the lag. The failure is visible only in GitHub, to the owner. |

## 3. Remedies, ranked by value for cost

| # | Remedy | Cost | State |
|---|---|---|---|
| 1 | **Put the ledger and the deploy after the data exists** (07:15 and 08:45 IST for the ledger, 07:45 and 09:15 IST for the deploy, Tuesday to Saturday), and make the retry slot a no-op when the data day is already done (the deploy compares the live site's data date with its own build; the ledger records a day once). | None. | **Done** (`tripwire_ledger.yml`, `tripwire.yml`; pinned by `workflows.test.ts`). Effect is a prediction from the commit times above, **unverified** until two real scheduled mornings have run. |
| 2 | **Worker-side catch-up for news: the PRIMARY news remedy**, given the 1-in-29 evidence.  If the published check is older than two cadences (30 minutes in session, 60 outside it; **at any hour since 3 Nov 2026, before that only while the NSE session was on**), `GET /api/news/catchup` runs the market-scope part of the same pipeline (RBI, SEBI and the four market searches, entity rules from the snapshot's own names), caches the answer at the edge for 15 minutes, and the page shows those stories with their own publication times under "Refreshed on demand HH:MM IST". The published snapshot is never changed or re-dated and the page stays "Delayed". | About 6 feed requests per 15 minutes at most, only while late and open. Free-plan CPU per request is the risk: it is more work than the one-feed live query that already runs. **Unverified on the deployed Worker**; a failure answers `ok:false` and the page behaves as before. Check with `wrangler tail` after the first late session. | **Done** (`news/catchup.js`, `worker.js`, `news.ts`; 5 + 3 offline tests and a browser check). Covers market stories only, not company stories for names outside the snapshot. |
| 3 | **A second, offset cron grid for the news job** (7, 22, 37, 52 minutes past) so each cadence has two chances to start on time, with the cadence guard making the spare a no-op. And **make a crash or a failed publish turn the run red** so GitHub's own failure mail works. | A few seconds of runner time per spare tick, free on a public repository. | **Done** (`tripwire_news.yml`). Benefit **doubtful** after the 1-in-29 result: it helps only if lateness is per cron line rather than per repository, and the evidence suggests the latter. Kept because it is free; do not rely on it. |
| 4 | **One more attempt at the browser gate on scheduled runs**, so a flaky gate does not leave the site on yesterday's data. Pull requests and manual runs still fail on the first failure. | Up to one extra gate run (7 to 20 minutes) on a night the first attempt fails. | **Done** (`tripwire.yml`). The real fix is in `journey.mjs` (section 1.3). |
| 5 | **An external trigger: a Cloudflare cron asks GitHub to start the news job** (workflow_dispatch, equivalent to repository_dispatch for this purpose). Dispatches are not throttled like scheduled runs. Needed for the news to be reliably on time. | One secret. | **Built and inert; BLOCKED on the owner.** Exact steps in section 4. |
| 6 | Run the whole news job in the Worker on a Cloudflare cron and publish to Workers KV, with no GitHub in the path. | A KV namespace (owner), a rewrite of the publish step, and a CPU limit on the scheduled handler to check. 96 writes a day against 1,000 free. | Not started. The cleanest fix if GitHub stays unreliable. |
| 7 | Make the screen build a no-op in its second slot, and trigger the newspaper job on completion of the screen build. | Changes in the research repository. | Not done: not this repository. Saves about 20 minutes a day of compute and removes the 5 hours between the build and the commit. |

## 4. Owner steps (the only things that need you)

**Scheduler nudge (remedy 5).** The Worker has a cron trigger (every 15 minutes, in `wrangler.tripwire.jsonc`) and a handler (`news/nudge.js`) that does **nothing** until a secret exists. To turn it on:
1. On GitHub: Settings, Developer settings, Fine-grained personal access tokens, new token. Resource owner `caakshayk1-boop`, repository `alpha` only, permission **Actions: Read and write**, nothing else, with an expiry you will remember.
2. In a terminal with Cloudflare access: `npx wrangler secret put GITHUB_DISPATCH_TOKEN --config wrangler.tripwire.jsonc` and paste the token.
3. Deploy the Worker. The first cron tick after that sends a `workflow_dispatch` with `force=false` (the job's own cadence guard still decides whether to do work) and logs "news nudge: sent". The Operations page lists "Scheduler nudge" as Not set up until then; it cannot detect the secret from the browser, so after setting it, change the service's kind in `services.ts` and `INTEGRATIONS.md` in the same commit.
4. Cost of doing it: a token to rotate, and this becomes the first secret the Worker holds (the Operations page and `/api/health` state that there are none today).

**Everything else** (the research repository, items 6 and 7) needs a decision, not a secret.

## 5. What this change did not do, and could not verify

- No scheduled run of any changed workflow has happened. The new slots, the retry skip and the offset grid are reasoned from timestamps, not observed.
- The news catch-up was exercised offline against recorded feeds and in a browser against mocks. It has not run against Google or Bing, and its CPU cost on the deployed Worker is unmeasured.
- Raw GitHub caching and Google News lag are documented behaviour, not measurements.
- A real iPhone was not used. Text size and the screen lock depend on the device and the pages say so; haptics remain "not verified" on the Settings screen.
- The Operations page is still public and unauthenticated; it prints counts and binding names, never values, and says so.
- `journey.mjs` still depends on the wall clock (section 1.3).


## 5. Update, 3 November 2026: why the news badge said "Delayed" almost all day

Measured from `gh run list --workflow tripwire_news.yml` on 3 Nov 2026: on 2 Nov (UTC) the scheduled job ran 9 times (00:11, 01:26, 05:27, 05:54, 10:35, 10:54, 20:30, 20:41 and 20:44), in bursts, against about 60 intended by the cron lines, with a longest gap of 9 hours 36 minutes (10:54 to 20:30). The page calls the news delayed after two cadences plus ten minutes (40 to 70 minutes), so it was delayed for most of the day, correctly. The cause is GitHub's best-effort cron, not the pipeline.

What changed in the code: the Worker catch-up now runs at any hour, not only in session, and when it has refreshed the market stories inside its own allowance the badge reads **Partial**, with the line "Market news refreshed HH:MM IST. Company stories are from the scheduled check at HH:MM IST, N hours ago, which is running late." The scheduled check keeps its own time and is still described as late. Company-scope stories are not refreshed by the catch-up, so the badge cannot say **Fresh** until the scheduled job runs.

What does not change by itself: the real cure is the scheduler nudge in section 4, which needs the Worker secret `GITHUB_DISPATCH_TOKEN`. As of 3 Nov 2026 `wrangler secret list --name tripwire` returns an empty list, so the nudge is still inert and the badge will read Partial or Delayed whenever GitHub's cron is late.


## Direct screen publication — 7 November 2026

The stock-screen workflow in trading-dashboard now publishes the validated screen,
its detail, lite and SWOT projections in the same git commit after its Turso write
is verified. It runs at 16:47, 19:07 and 23:00 IST on weekdays. Existing hourly
bar reconstruction supplies a missing daily close only after the complete final
intraday bar is present; no price or date is synthesized.

A `screen-published` repository event starts both Tripwire consumers immediately:
the checked website deployment and the idempotent position ledger refresh. The
website reads the ledger live, so these do not need to wait for each other. The
publisher uses the upstream repository's existing GH_PAT for this event. A failed
dispatch fails visibly; the existing morning schedules remain recovery paths.

This removes the newspaper-export and next-morning wait. It cannot guarantee an
exchange-time update when Yahoo or GitHub is late. Freshness checks still stop an
outdated release; original dates remain visible. Positions and trade history are
never reset to make a refresh succeed.
