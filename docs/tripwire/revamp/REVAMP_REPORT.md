# Tripwire revamp: report for review (27 Oct 2026)

Branch `tripwire-revamp` (merge of `revamp-news`, `revamp-discover`, `revamp-ui`, `revamp-today`). The brief is `docs/tripwire/TRIPWIRE_Claude_Revamp_2026-10-27.md`. Skills used: `apple-design` and `animate` (via the Skill tool). There is no SwiftUI skill in this environment and nothing was rewritten in SwiftUI. Four agents (news, Discover, UI, Today) worked in isolated worktrees; the integration (merging, conflict resolution, test registration, the fixes below) was done by the integration owner. No signal rule, eligibility rule or trading assumption was changed; the paper-book rules of 27 Oct (book-2) are untouched.

## What changed
**Improved**
- *News*: one health model for Today, the News page, Profile and Data (fresh / partial / delayed / unavailable; never "live"). A shared, versioned, deterministic pipeline refuses evergreen quote and landing pages, technical commentary, previews, foreign markets and mixed-language filler; matches whole-word names and exchange-marked symbols; clusters syndicated copies into one event with "N more sources"; quarantines future dates; keeps an old event's date; no "wider match", no filler. Today shows "What matters now": one lead plus four, up to ten. Tabs All / Market / Following / Paper book. Following is only what the reader follows. Three separate times (published, last successful check, next check), all IST. "N new updates" without reordering. Refresh states Checking / Updated / No new stories / Failed. A full News page at `#/news`.
- *Scheduling*: `.github/workflows/tripwire_news.yml` runs the job from GitHub Actions with no browser involved, 15 minutes in session and 30 outside by the exchange calendar, and publishes a snapshot to the orphan branch `tripwire-data`; the Worker serves `/api/news/version`, `/api/news` and per-name live queries through the same pipeline.
- *Discover*: one URL-backed state (`src/discoverstate.ts`), one filter, sort, slice pipeline for List and Table, a toolbar of Search / Filters / Sort / Columns / List-Table, chips below, the rest under Advanced. Back, Forward, reload and shared links reproduce the screen; scroll, revealed rows and the opened company are restored. Table has Follow, Compare, `aria-sort`, a sticky header, a pinned company column and 44px filter buttons. Missing is separate from zero, with an explicit "include names with no figure". The calculation basis (screening at the close, live cells marked) is stated above the results.
- *Today*: a market brief (facts only, no cause or forecast), What matters now, "Since your last visit" (timestamped snapshots, named thresholds, reversible dismiss, "Tracking starts today" on a first visit, a link to a thesis only when the invalidation level is crossed), one paper-book card, top picks. The commodity grid, index cards and trend map moved to `#/markets`.
- *My Desk*: Desk tab with upcoming reviews, open questions, recent decisions, followed companies with their last change, saved theses.
- *Company*: a 30-second overview, one primary action by state, "Why this trend" behind a control, "Similar measured patterns" separated from same-sector peers, ownership nesting drawn only when the figures obey the nesting rules.
- *Chart*: the clipped last candle fixed (half-bar padding, price tag in a gutter), default range = longest available, radio semantics with arrow keys, one accessible value for animated prices, entry/stop/target toggle, table alternative, events only where a dated source exists (only the provider's next-earnings estimate does).
- *Design system*: spacing, type, radius, elevation and motion tokens; sentence-case labels; one disclaimer near decisions; motion rules from the `animate` skill; 44px primary targets.
- *Destinations*: Methodology & Evidence, Help, Data & Coverage, and an Operations page (see blockers).

**Relocated**: long method text to Methodology & Evidence; bindings, secrets metadata and probe timings from Profile to `#/ops`; trend map, commodity grid and index cards from Today to `#/markets`.

**Removed**: the "wider match" news path; the per-headline matching explanations; repeated disclaimers; the Today "show all picks" toggle (a link to Signals instead); the dedup bookkeeping text.

## Tested / unverified matrix
| Area | Result | How |
|---|---|---|
| Unit tests | 340 of 340 pass | `npm run tripwire:test` |
| Types | clean | `npm run tripwire:types` |
| Journey, beta, comfort, r3, ui, a11y suites | pass on the integrated build (a11y: 160 loads, axe serious/critical clean, no overflow, 200% text) | `tripwire:check` against `wrangler dev` |
| News, Today browser suites | pass after integration fixes (paper names in the News slot; hard-coded screen date removed from `today.mjs`; 200% overflow on `#/news`) | `news.mjs`, `today.mjs` |
| Discover browser suite | pass (back restore, parity on 8 fixtures, compare/follow parity, funnels, 6 widths) | `discover.mjs` |
| Vitals (throttled lab) | CLS 0.019 to 0.033; slowest interaction 136 to 264 ms across runs | `beta.mjs` |
| Interaction limit 200 ms | **not reliably met**: noisy on this machine (three agents measured 160 to 408 ms); no baseline measured | open |
| Live news sources | **not tested**: the sandbox cannot reach Google News, Bing, RBI, SEBI or raw.githubusercontent.com; fixtures are hand-written in the feeds' shape | pending |
| Scheduled run with no browser | **not observed**: GitHub cron is best-effort and can start minutes late; the workflow exists but has never run | pending first dispatch |
| Real iPhone Safari / PWA | not tested | pending |
| Screen readers, 200% zoom on device, haptics | not tested (haptics are described as unverified in Profile) | pending |
| Five-person acceptance test | not done | pending |
| Financial calculations and historical records | no engine, eligibility or ledger code changed; existing paper, ledger and basis tests pass | unit tests |

## Remaining blockers and dependencies
1. **First news snapshot.** The `tripwire-data` branch does not exist until `tripwire_news` runs once; until then the site reads "no check has succeeded yet". Needs a workflow dispatch after merge.
2. **Source licences and feeds.** The RBI and SEBI feed URLs and formats are unconfirmed; NSE/BSE filing feeds are not wired; licences and terms of Google News and Bing RSS are unreviewed. A licensed feed is the real fix for coverage.
3. **Operations page is not access-protected.** There is no authentication in the app and `/api/health` is public; the page says so. Real protection needs an identity layer (for example Cloudflare Access) and an owner decision.
4. **Interaction latency** (INP-style) not demonstrated under 200 ms on a real device.
5. **Real-device and real-user testing** (above).
6. **Indexing decision** from the previous round still stands: the landing page is indexable; revert is two lines.
7. The factor sheet (`ledger/factors.json`) has been empty since it began; unrelated to this branch, not fixed.

## Launch recommendation
Merge to `main` is reasonable once CI is green: the changes are additive, tested, and no signal rule moved. Deploying it does not change the earlier verdict: **closed, invite-only research beta only; no public or production-readiness claim.** Before inviting outsiders: dispatch the news job and watch two or three real scheduled runs, test on one iPhone and one mid-range Android, and run the five-person task test.
