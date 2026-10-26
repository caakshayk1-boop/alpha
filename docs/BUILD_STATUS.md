# Tripwire build status

Tripwire is a separate app in `apps/tripwire/`. It shares no UI code with the alpha website (own design system, own motion, own routes, no link to the site) and reads the same published data files. Rule logic is shared with the website only where it is a pure, tested function (`src/lib/rules.ts`, the ten public rules).

Status words: **PASS** (run, with evidence) · **FAIL** · **BLOCKED** (needs a credential, licence or decision that is not here) · **NOT BUILT** (no code yet) · **NOT RUN** (code exists, not exercised).

Starting state: branch `tripwire` from `main` at c8d15a8, with the website unchanged. No `docs/LAUNCH_BUILD_BOOK.md` exists in the repository; the engine and master-build briefs under `docs/engines` and `docs/master-build` were used instead.

## Requirement matrix

| # | Requirement | Status | Evidence / dependency |
|---|---|---|---|
| Design | Olive canvas, lime and peach, serif accent, tabular numerals, one icon set, five-destination navigation, sheets, motion with reduced-motion and a haptics toggle | PASS | `npm run tripwire:check`: journey 36 steps, axe on 28 page loads; screenshots viewed on a 390px viewport. Desktop layout (side rail) is NOT RUN visually; only axe and overflow ran at 1280px |
| Motion | Sliding tab and segment indicators, sheet and toast transitions, expandable evidence, skeletons, no animated numbers | PASS (code), NOT RUN (a recorded motion review) | Reduced motion collapses all animation (`prefers-reduced-motion` and the Profile switch) |
| 1 | Onboarding and guest mode | PASS | Welcome → guest → horizon choice or skip |
| 1 | Sign-up, login, recovery, session expiry, guest-to-account migration, account deletion | **BLOCKED** | No identity provider is configured. Profile says so. A device-level backup export, a merge-on-import (`mergeStates`, tested) and a delete-everything action exist; there is no account |
| 1 | Notification permission at the right moment | NOT BUILT | No delivery service exists; nothing is asked or promised |
| 2 | Today: session state and freshness, brief with sources, followed-name changes from stored snapshots, confirmed/estimated events, review tasks, at most three candidates with reason and risk, one next action | PASS | Journey; `changesSince` and `freshness` unit-tested. "Since you last looked" shows nothing on a first visit by design |
| 3 | Discover: search, sector/size/valuation/quality/momentum filters, chips, saved screens, reset, sorting with nulls last, follow, compare, loading/empty/failure states | PASS | Unit tests for filter and sort; journey. Quality filter excludes lenders. Only the Nifty 500 screen (988 names) is covered, and the page says so |
| 4 | Company research: identity, dated close, case and countercase, 52-week range with averages, statements, business-appropriate ratios, rules that fired, timeline, review checklist, thesis, four actions | PASS with gaps | Price history chart (daily or monthly, 1Y/3Y/5Y/10Y/Max, linear or log, scrub by touch, mouse or arrow keys): PASS with mocked data, **live Yahoo NOT RUN** (see below). No ownership or announcements/corporate actions timeline: NOT BUILT (no verified source in the data) |
| 5 | Compare up to three, six views, sticky headings, missing and non-comparable values named, saved comparisons, no winner | PASS | Journey; lender rule |
| 6 | Signals: three factor engines (Momentum, Quality at a fair price, Steady uptrend), picks with criteria and funnel, paper tracker | PASS (code and tests), NOT RUN (live Yahoo) | `docs/tripwire/ENGINES.md`. Replaced the E1-E6 lifecycle chooser and the market-gate message, which are gone. **No backtest on Indian prices exists**; the repository's earlier engines failed walk-forward. Nightly forward ledger of every pick (`tripwire_ledger.yml`, Record tab): built and unit-tested, **workflow not yet run against real Yahoo data** |
| 7 | Paper planner | PASS | `sizePlan` unit-tested (each cap, each refusal); journey. Versioned plan edits (`rev`), expiry, saved ≠ paper fill ≠ holding. Trailing-stop policy, time exit and three-target plans: NOT BUILT (two conditional targets at +2R and +4R) |
| 7b | Paper tracker with live prices | PASS with mocked bars; **live Yahoo NOT RUN** | Replays daily bars: next-open fill, gap and stop rules, time exit, costs, delayed live mark, forming bar. Worker route `/api/bars` |
| 8 | My Desk: following, journal with seven fields, versioned history, archive, search, review dates, weekly process review, saved comparisons and screens, export | PASS | Unit tests and journey. A "what changed since" note on an overdue review: NOT BUILT |
| 9 | Portfolio: manual holdings, CSV import, reconciliation | **NOT BUILT** | Next piece of work. Broker connection is BLOCKED (credentials and consent) |
| 10 | Notification centre, quiet hours, outbox delivery | **NOT BUILT / BLOCKED** | Needs a delivery service. The existing Python alert outbox has no sender. Profile states this |
| 11 | Grounded AI assistant | **NOT BUILT / BLOCKED** | Needs a server-side model credential and a Worker route. What exists is labelled deterministic: metric definitions and a rules-built review checklist, each marked "not generated by an AI model" |
| 12 | PDF report, CSV/JSON export, share cards | PARTIAL | Print-to-PDF report, journal CSV (formula-neutralised), full JSON backup: PASS. **Revocable share links: BLOCKED** (needs server storage and an access model) |
| 13 | Subscriptions | **BLOCKED** | No billing provider, product IDs or price. Profile shows Free and says paid features are not for sale |
| 14 | Data pipeline | PARTIAL | Reads the same published feeds as the website; build copies them. Per-observation source/currency/adjustment metadata, atomic snapshots and durable server storage of user records: NOT BUILT (user records are on-device) |
| 15 | PWA | PASS (build and desktop Chromium) | Manifest with PNG and maskable icons, service worker (shell cache, data network-first), offline reload rendered. **Installation on a real iOS or Android device: NOT RUN.** No native binary exists or is claimed |
| 16 | Security, accessibility, performance | PARTIAL | Strict CSP (`script-src 'self'`, no inline script) verified by the browser refusing inline injection; axe serious/critical clean on 14 routes × 2 widths; focus trap and Escape; JSON import is shape-checked and size-limited. **Not run:** dependency audit, screen-reader pass, cross-user authorization (no accounts exist), rate limits (no API), Lighthouse (no figures are claimed) |
| 17 | Public introduction site, sitemap, social previews | NOT BUILT | The app is `noindex` and `robots.txt` disallows all until the owner decides the address |
| 18 | Verification of journeys | PARTIAL | Guest → discover → follow → research → paper plan → journal → export: PASS. Compare → save → revisit: PASS. Delete my data: PASS. Offline: PASS. Signup/sync/login, alerts, subscription, account deletion with a server: BLOCKED (nothing to test) |
| 19 | Release and handoff | PARTIAL | This file, `docs/tripwire/README.md`, `wrangler.tripwire.jsonc`, CI workflow. No `.env` is needed: the app has no secrets. Deployment is manual and not done |

## What was actually run

- `npm run tripwire:types`: no errors.
- `npm run tripwire:test`: 35 checks (planner, filters, journal history, review dates, snapshots, weekly review, CSV/JSON, merge, freshness, copy, the three engines, the tracker, the Worker's bar parsing).
- `npm run tripwire:check`: serves the build on its own Worker config and runs `journey.mjs` (every step above marked PASS) and `a11y.mjs`.

## Defects found by running it, and fixed

- The planner's entry price was empty when the screen data arrived after the sheet opened; a plan with a stop above entry could not be refused because there was no entry. Fixed with a prefill effect.
- Compare used two segmented controls, both showing a selected thumb; and its sticky headings floated mid-table inside a scroll container. Replaced with one chip row and a non-scrolling table.
- Toasts covered the action bar; moved to the top.
- The dial's caption overlapped its end dots.
- Axe: `aria-prohibited-attr` on the lifecycle bar and a focusless scroll region on the statements table.

## Live P&L, Today, scrip intelligence, evidence (26 Oct 2026)
- **Live paper P&L** (`Tracker.tsx`, `book.ts`): the delayed live mark from a five-minute feed, today's P&L (from the entry on the entry day, from the previous close after), contribution by trade, a risk ladder (−1R to +3R), the day's five-minute line with previous close, entry and stop, and a what-if slider that uses the tracker's own arithmetic (tested equal). Refreshes every 30 seconds while the page is visible. **The Worker routes `/api/intraday` and `/api/pulse` are tested with mocked Yahoo responses; against the real feed: NOT RUN until deployed.**
- **Today** is a live market strip (Nifty, Bank Nifty, VIX), a session clock from the Indian time (exchange holidays are not modelled; live prints override the clock), the live paper book, swipeable engine picks, and a trend map by sector linking into Discover.
- **TradingView**: stocks and indices open `tradingview.com/chart` in a new tab (`rel=noopener`). `&` and `-` in an NSE symbol are written `_`; other oddities may exist.
- **Scrip intelligence**: ownership by quarter with changes, seasonality, PE against its own history, earnings quality, a peer ladder inside the sector, a risk map, and a fingerprint of unusual indicators, each with the study's verdict. All but the fingerprint use data already in the published screen.
- **Studies** (`apps/tripwire/research`, `docs/tripwire/ENGINE_SPECS.md`): 13 unusual indicators and 3 baselines tested with the rule fixed first: none passed. The engines back-tested as built: no historical support (Quality untestable). Both reports and the harness tests run in CI.
- **Evidence tab** states all of this inside the app.

## Trend tag
Every company carries an Uptrend, Downtrend or Mixed tag, taken from the Alpha site's own uptrend rule (price above its 50-day average and the 50-day above the 200-day, strict, at the latest close). **Alpha publishes no downtrend, so Downtrend here is the exact mirror** (price below the 50-day, the 50-day below the 200-day); everything else is Mixed, and a name missing an average is untagged, never Mixed. It appears on Discover rows (compact arrow), company pages (with the figures behind it), Compare and the picks; Discover can filter by it, and saved screens from before the tag still work. A descriptive label of where price sits against two averages, not a forecast; it feeds no engine score.

## Price chart
`/api/chart` (Worker) returns every daily close Yahoo holds for a symbol, split-adjusted and **not** dividend-adjusted; the page cuts the ranges and builds the monthly view (last close of each month) in the browser. Log scale shows percentage moves evenly. A range longer than the history says so and shows all of it. Pure maths (`src/chart.ts`) is unit-tested: windows, monthly, peak-preserving downsampling, return/CAGR, geometry, scrubbing. A 10-year window needs about 2,500 daily points, drawn as at most about 700. A Nifty comparison line (both indexed to 100, with the gap in points) is built. Not built: volume bars, dividend-adjusted returns.

## Known limits

- All user data is on one device. Clearing site data erases it; Profile says so and offers a backup.
- Freshness does not model exchange holidays, so it can overstate "behind" by a holiday.
- The earnings date is an estimate from the data provider and is labelled so.
- Everything is end-of-day. There is no live quote.
