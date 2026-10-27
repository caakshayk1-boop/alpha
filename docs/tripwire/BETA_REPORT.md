# Tripwire research beta: report and go / no-go (26 Oct 2026)

> Update 27 Oct: see [LAUNCH_HARDENING.md](LAUNCH_HARDENING.md) for the hardening pass, test evidence and the current go/no-go.

Branch `tripwire-beta`, based on `main` at 1ea9b05. **Not deployed.** Evidence below is from automated checks on a local build. None of it is real-user validation.

## Verdict
- **GO for a closed, invite-only research beta** with a small group who have been told it is experimental and paper-only, and who have read the data and evidence screens.
- **NO-GO for a public launch.** Blockers are listed below; the first four need the owner.

## What changed, against the brief
| Brief | Done | Evidence |
|---|---|---|
| P0.1 One eligibility layer; fix GCSL; dedupe reasons | `src/eligibility.ts` is the single answer to "may this figure be judged for this company". The company page, report, compare, Discover's ROCE filter, peer ladders, earnings quality, the review checklist and the engines' explanations all ask it. GCSL (financial sector) no longer shows ROCE and margins as strengths and flags beside a note saying they are not judged; its risk grade is not printed as a finding; the engine says "financial sector", not "lender". Six lines were about withheld figures: hidden and counted. Repeats (a risk flag and a weakness saying the same thing) fold to one. | `eligibility.test.ts` (10 tests, real GCSL and TCS payloads); `beta.mjs` GCSL checks on screen |
| P0.2 Reconcile 988 / Nifty 500 / 920 | New Data screen (`#/data`): 988 companies in the published screen, not the Nifty 500 index; size classes 99 / 148 / 240 / 208 / 293 unpublished; waterfall 988 to 753 engine-eligible, produced by the engines' own predicates; 960 liquid, 920 with a 200-day average (the trend map says so). Membership date: not published by the feed, and the page says that. | `universe.test.ts`, Data screen |
| P0.3 Neutral loading; evidence states | While the study loads, a skeleton, never a claim. Four states: untested, not supported, mixed, supported. Quality is "untested" (not "failed"); Momentum is "not supported by the back-test"; the benchmark is named: the equal-weighted average of the 660 stocks in the test, not the Nifty 50. | `logic.test.ts`, `beta.mjs` slow-load check |
| P0.4 Source, observed time, timezone, delay, stale/error | `stamp.ts`: age is measured from the exchange print, never from the last refresh. LIVE only within 5 min; "lagging" to 20 min; "No print since 13:51 IST" in a live session; "Last print" after hours. All times IST. Source and age in a tooltip. A failed update is said beside the last good time. | `stamp.test.ts`, `beta.mjs` (clock-controlled stale test) |
| P0.5 Paper accounting | Audit in `PAPER_ACCOUNTING.md`. Found and fixed: a split or bonus would have falsely stopped or skipped a trade (stop stored in old prices, bars re-quoted); the fill was unrounded so the slider and headline could differ; the planner assumed 0.4% costs and the tracker 0.25%. Four prices are separated on screen. | `paper.test.ts` (15 tests, hand-worked numbers) |
| P1 Decision summary, rank labels, planner, journey | Summary on every company page: why surfaced, strongest counterargument, evidence status, data quality, invalidation, next review. Ranks read "Rank 91 of 100 ... not a chance of winning". Planner states the entry-price assumption and shows the risk if the open is 2% higher. Follow, thesis, plan, review is a visible path on Today and a next-step button on each company. "Experimental" sits beside picks, the auto book and the planner. | `decision.test.ts`, `beta.mjs` journey |
| P2 Premium UX | Two-column research workspace from 1100 px (Today, company), five lenses side by side and a figure table per row in Discover. Base type 15 px; muted text now 5.2:1 or better on every surface. Sheets size to the visible viewport and sticky bars step aside for the keyboard. Motion is 160 to 240 ms; the looping backdrop, the confetti and the always-moving water are gone (water moves only for prices that are printing). Haptics are capability-tested and the Profile switch says when a device cannot. Chart has arrow-key reading and a table alternative. | `a11y.mjs`, `beta.mjs` |
| Launch | Backup round trip, merge, restore on a fresh device (reviews, snapshots and preferences were being dropped before: fixed), refusal of foreign files, and unreadable saved data is kept and flagged instead of overwritten. Private mode / full storage now says so. | `backup.test.ts`, `beta.mjs` |

## Test evidence (this build)
- Types: clean. Unit and financial regression: **131 tests, 0 failed** (logic, quant, r2, eligibility, universe, stamp, paper, decision, backup).
- Browser journey: all passed. Accessibility (axe, serious and critical) with no overflow and no placeholder text: **140 page loads** across 360, 320, 390, 430, 768 and 1440 px, four themes, and 150% and 200% text with a wide fallback font.
- Beta gate (`beta.mjs`), all passed: first-use and decision journey end to end, GCSL on screen, backup round trip through the real screens, keyboard and chart, slow loading, stale, offline, five widths, desktop workspace, vitals.
- Lab vitals on a 4x CPU slowdown, 1.6 Mbit/s, 150 ms RTT phone, Today: **LCP 2.0 s, CLS 0.06, slowest interaction 152 ms, 247 kB transferred.** These are lab numbers, not field data.
- Before and after screenshots: `beta/before`, `beta/after` (390 and 1440 for seven screens; 360, 430 and 768 after) and side-by-side `beta/compare`.

## Remaining blockers
1. **No real-user validation.** `ACCEPTANCE_SCRIPT.md` is ready; it has not been run.
2. **Engine rule decisions D1 to D3** (OPEN_ITEMS.md): unpublished size class passes (266 eligible names; 2 of 5 Momentum picks on 23 Oct); the liquid flag is not the written ₹10 crore test (145 names under it); no ₹50 floor. The code was left as it was; only the docs were corrected.
3. **No evidence the engines work.** Momentum is not supported by its back-test; Quality cannot be back-tested; the forward record has one night and no closed trade. The product says so everywhere. This is a research beta of a method, not of a signal.
4. **Data licensing and regulation need a person.** Prices, news and statements come from Yahoo Finance and Bing News through unofficial routes; whether that is permitted for a public product, and whether publishing ranked stock ideas needs SEBI research-analyst registration or different disclaimers, are questions for a lawyer. I have not assumed an answer.
5. **Capacity.** Every open tab calls the Worker every 8 s. On Cloudflare's free plan (100,000 requests a day) about 28 people leaving it open through a session would use the day's allowance. Move to the paid Workers plan before a beta larger than a couple of dozen daily users. The upstream calls are batched and cached for 6 s, so Yahoo load does not grow with users.
6. **No accounts, sync or notifications.** Clearing site data erases notes. The app says so and offers backup; there is no account recovery. `INTEGRATIONS.md` lists what each needs.
7. **Not tested on a real iPhone or Android phone:** haptics, Face ID or fingerprint lock, system text size, safe areas with a real notch, keyboard behaviour in sheets, water performance. The checks above use Chromium with emulated sizes.
8. **Owner items already open:** waitlist mail secrets, Cloudflare Browser Cache TTL, contact address, Telegram secrets, the G30 decision, pricing.

## Known limits of the checks
- axe finds about a third of accessibility problems. No screen reader (VoiceOver, TalkBack, NVDA) was run by a person.
- The size and stale-data checks use a controlled clock; real holidays are not modelled and the app says so.
- Core Web Vitals above are synthetic. INP in particular needs field data from real use.

## Momentum: tested forward through time (2026-10-26)
`engines_walkforward.py` (pre-registered in its docstring, run on GitHub Actions, results in `apps/tripwire/research/results/engines_walkforward.md`). The holdout of the fixed-period back-test had been read twice, so it could no longer test a new rule. Instead the **procedure** "choose the best of eight pre-declared rules from the three years before, then trade it" was tested over every year from 2019, each year out of sample for the rule that traded it.

| Rule | mean excess a rebalance | t | bar |
|---|---|---|---|
| Procedure (best of 8, chosen yearly) | +0.57% | 0.66 | 2.0 |
| As built (12-1, no regime filter, q80) | +0.38% | 0.56 | 2.7 |
| Best fixed variant (12-1, regime filter on, q80) | +0.94% | 1.14 | 2.7 |

**Nothing clears its bar, so no rule was changed.** Replacing the engine's rule with the variant that happened to look best in a sample already read would fit the past, not find an edge. The regime filter variant is the only one worth watching and it is not promoted: it enters no ledger until the owner decides. All numbers are upper bounds (survivorship). Quality at a fair price cannot be tested this way (no point-in-time accounts), so it is shown as "In forward test", with thirty closed trades needed before any verdict.
