# Rulebook — build plan

Status: **draft for approval (Step 1). No product code exists.** Working name Rulebook; target address `lockedfree.askakshay.com`. Sits in this repository beside Tripwire and follows its hosting and nightly-job pattern, but is a separate app with its own ledger, rules and brand. The master prompt overrides Tripwire wherever they differ.

## 0. Answers first

- **Stack: Astro 7 static site + one small Cloudflare Worker**, deployed from `wrangler.lockedfree.jsonc` exactly as Tripwire is. Not Next.js: nothing here needs server rendering, and Astro ships zero JS by default, which is what a content-and-data site with a strict CSP wants. Interactive rooms (Gate, Plan, charts) are Astro islands in vanilla TypeScript custom elements, not a UI framework, with base-ui used inside small React islands only where its headless primitives are needed (see ADR-002 — this is a real trade-off; decision requested).
- **One ledger, two scopes.** The *public* ledger is generated nightly from the four screens. A visitor's *own* Gate trades and Plan live in their browser. These cannot be one file: putting user trades in the public snapshot would mean accounts, a database and personal data. They share one accounting module and one schema family, so they cannot disagree on a formula. This is the main reinterpretation of "one ledger" in the prompt; check 2 is scoped accordingly (§4).
- **The hero on day one is empty by design.** A forward-only ledger has n = 0 at launch. §7 explains what the homepage shows until it has history, and why a backtest must never be mixed into it.
- **Biggest external risk is regulatory, not technical** (§9, R1).

## 1. Decisions I need from you at this stop

| # | Decision | My recommendation |
|---|---|---|
| D1 | Product name: "Rulebook" (prompt) vs something matching `lockedfree` | Keep Rulebook as working name; rename is one find-and-replace. "Locked free" says nothing about discipline. |
| D2 | How a screen pick becomes a paper trade: entry, exit, and the stop that defines R (§5) | Entry next session's open after publication; exit next open after the stock fails the screen; fixed 20% initial stop for R. |
| D3 | Rules-based public shortlists of named Indian stocks may fall under SEBI research-analyst rules (R1) | Get a one-hour opinion from an Indian securities lawyer before Step 5 ships anything public. |
| D4 | Gate / Plan user data stays in the browser (no accounts) | Yes for v1. Export and import as a file. |
| D5 | React islands for base-ui (+ GSAP, charts) vs framework-free | Small React islands only for Gate, Plan, dialogs. Everything else framework-free. |
| D6 | Benchmark | Nifty 500 **price** index (Yahoo `^CRSLDX`), labelled as excluding dividends. A total-return index has no reliable free feed. |
| D7 | Email capture: store only at launch, no sending | Yes. Durable Object (SQLite) in the Worker; no mail provider until you choose one. |

## 2. Framework and hosting

| Concern | Choice | Why |
|---|---|---|
| Framework | Astro 7 (static output, `trailingSlash: always`) | Real indexable URLs per stock and archive page; no runtime server; View Transitions supported natively. |
| Islands | Vanilla TS custom elements; React 18 only for base-ui islands | Keeps JS small. React is already in the repo, but this app gets its own `package.json` (below). |
| Hosting | Cloudflare Worker + static assets, custom domain `lockedfree.askakshay.com` | Same as Tripwire. Config in `wrangler.lockedfree.jsonc`. |
| Worker routes | `POST /api/subscribe` (email capture), `GET /api/health`. Everything else is static. | Prices are not served live; this is an end-of-day site. |
| Dependencies | `apps/lockedfree/package.json`, separate from the root Next.js manifest | Root is Next 14; mixing Astro 7 into it risks breaking Alpha and Tripwire builds. Cost: a second `npm ci` in CI. |
| Security | Strict CSP with script hashes, HSTS, COOP, `nosniff`, `frame-ancestors 'none'`, no third-party origins | Astro's inline island bootstrap needs hashes or an external file; confirm Astro's CSP support in the Step 2 spike, else emit external scripts only. |
| No CDN scripts | All libraries bundled | Required by the prompt. Verified by check 9 and a CSP test. |

**Alternatives rejected:** Next.js (heavier, no benefit here, the root app already is one); extending Tripwire's esbuild+React build (couples two products; Tripwire's rules explicitly say others are out of scope); a SaaS backend (accounts, data-protection duties, cost).

**Adopted/declined libraries** (see DESIGN.md §6): GSAP + ScrollTrigger + Flip (adopted), Lenis (reading pages only), auto-animate (adopted), lightweight-charts, uPlot, Lucide, pqoqubbw icons, Fontsource, fontaine, base-ui (adopted). **Anime.js: declined. swup: declined** (native View Transitions on a static site).

Budgets (to be enforced in CI by a `budget` script, as Tripwire does): home ≤ 90 KB JS gzip excluding charts; Gate ≤ 160 KB; no page > 250 KB total JS; LCP ≤ 2.5 s on a throttled mid-range phone; CLS < 0.02 on `/`.

## 3. Data pipeline

**Universe.** NSE equities with market cap ≥ ₹1,000 cr and ≥ 6 months of price history, taken from the same universe feed Tripwire reads (`/data/screen.json` on alpha.askakshay.com). Reusing it keeps the universe consistent across the owner's products; financials stocks are excluded from Magic Formula by rule (it does not work on them — see methodology).

**Sources and what they cannot do**
| Data | Source | Known limit |
|---|---|---|
| Daily OHLCV, split-adjusted ("exchange prices") | Yahoo Finance via `yfinance`, as Tripwire's `engines/data.py` does | Unofficial; can change or rate-limit; occasional wrong bars. |
| Fundamentals: net income, CFO, total assets, long-term debt, current ratio inputs, shares, gross margin, revenue, EBIT, capital employed | `yfinance` annual statements | Patchy for Indian small caps; often 3–4 years only. **Missing stays missing and the stock is marked "not scorable" for the affected rule, never silently passed or failed.** |
| Existing aggregated scores (e.g. a precomputed Piotroski integer) | Alpha's screen feed | **Not reused.** The product requires the pass/fail per rule with the underlying numbers; an aggregate cannot supply that. Components are recomputed from raw statements. A reconciliation test compares our total to the feed's and logs mismatches. |
| Exchange holidays, session calendar | A pure function with a committed holiday table, per Tripwire's `calendar.ts` pattern (copied, with attribution; not imported across apps) | Table must be refreshed each year. |
| Benchmark | `^CRSLDX` (Nifty 500) | Price index; no dividends. |

**Validation gates** (a night that fails them publishes nothing and goes red): ≥ 85% of universe has a fresh bar; no price change > 40% without a split flag unexplained; fundamentals coverage per rule reported; schema validates; yesterday's snapshot not overwritten.

**Cadence.** Prices and the ledger refresh every trading night; screens re-run **weekly** (Friday close, published Saturday); the near-miss table and refusal tracking update weekly with them. Every dataset carries `as_of` (the market date) and `built_on` (when we built it).

## 4. Ledger snapshot — schema `rulebook-ledger/1`

One JSON document is the only source of every number on the public pages. Pages read it at build time; the build fails if a page contains a performance figure that did not come from `ledger-view` selectors (a lint scans for hard-coded figures).

```
{
  schema: "rulebook-ledger/1",
  as_of: "2026-11-20",          // last market date included
  built_on: "2026-11-21T02:10:00Z",
  config: { charges_version, stop_pct, benchmark, universe_rules },
  screens:   [{ id, name, version, rules:[{id,label,threshold,source_fields}], started_on }],
  runs:      [{ screen_id, run_date, passed:[symbol], near_miss:[{symbol,failed_rule,gap}], refused:[symbol], universe_n, not_scorable_n }],
  picks:     [{ id, screen_id, symbol, first_listed_run, entry:{date,price}, status:"open|closed|voided", exit:{date,price,reason}|null, voided:{date,reason}|null }],
  trades:    [{ pick_id, fills:[{date,side,qty,price}], charges:[{kind,amount,fill_idx}], stop, risk_inr }],
  voids:     [{ pick_id, date, reason }],            // never deleted
  transitions:[{ screen_id, run_date, entered:[], exited:[], still_in:[] }],
  refusals:  [{ screen_id, symbol, refused_on, price_at_refusal, later:[{date,close}] }],
  book_days: [{ date, screen_id|"all", equity, realised, unrealised, open_n, benchmark_close }],  // append-only
  aggregates:[{ screen_id|"all", n_picks, n_open, n_closed, n_void, win_rate, expectancy_r, avg_win, avg_loss, max_drawdown, longest_losing_streak, as_of }]
}
```

**Append-only discipline.** The snapshot builder is a function `(previous snapshot, new inputs) → next snapshot`. A test asserts that every id and `book_days` row in the previous snapshot appears byte-identical in the next one. Corrections are new rows referencing the old, never edits. Daily snapshots of the full file are also kept in git history (the nightly job commits), so history cannot be rewritten silently without showing up in `git log`.

**Scope of "one ledger" for checks 2 and 7.** Public numbers: all from `rulebook-ledger/1`. A visitor's personal book uses `rulebook-book/1` (same trade/fill/charge shapes) stored in their browser; the same `accounting.ts` module computes both. The Gate journal's dual equity curves read the personal book, and the page says so ("your paper book — stored only in this browser"). Neither scope computes a figure with different code.

### Accounting module (`accounting.ts`, pure, no I/O)
- Realised = booked exit proceeds minus cost of the exited quantity (average-cost method), minus charges allocated to those fills.
- Unrealised = (mark − average cost) × remaining quantity, minus charges attributable to the remaining quantity's entry.
- Every charge is attached to exactly one fill and counted once; a test sums `charges` and asserts it equals the sum of allocations.
- Initial risk = original filled quantity × (entry − stop), **frozen at entry**; R-multiple = (realised + unrealised) ÷ initial risk, unchanged by partial exits.
- India charges (delivery): brokerage (configurable, default ₹0), STT 0.1% on both sides, exchange transaction charge, SEBI fee, stamp duty on buy, GST on the chargeable items, DP charge on sells. Rates live in a versioned config; changing them is an ADR because it changes history.

**Acceptance fixture** (must pass before any UI): buy 100 @ ₹100, stop ₹90, sell 50 @ ₹120, mark 50 @ ₹110 → realised ₹1,000; unrealised ₹500; total ₹1,500; initial risk ₹1,000; total 1.5R, before charges. Additional fixtures: a second partial exit, a full exit, a stop-out (−1R), a void, and a charge-allocation case. Logged in `BUILD-LOG.md` before Step 3.

## 5. The screens — rules to be frozen at approval

Exact thresholds are written in each methodology page and frozen by this step's approval; any later change is an ADR. Proposed:

1. **Piotroski F-Score.** All nine standard signals (positive ROA, positive CFO, ROA improving, CFO > net income, lower leverage, higher current ratio, no new shares, higher gross margin, higher asset turnover). Passes at **8–9**. Known weakness stated: designed for cheap, high book-to-market stocks, noisy on the full universe; needs two years of statements.
2. **Magic Formula ranking.** Rank by earnings yield (EBIT ÷ enterprise value) and return on capital (EBIT ÷ (net fixed assets + working capital)); combined rank; **top 15**. Excludes financials and utilities; market cap ≥ ₹1,000 cr. Known weakness: Greenblatt's results were US, 1988–2004; sustained underperformance of 3–5 years has occurred.
3. **Quality + momentum composite.** Pass: ROCE ≥ 15% *and* positive 3-year earnings growth *and* 12-1 month price momentum in the top quintile of the universe *and* price above its 200-day average. Known weakness: momentum crashes on sharp reversals.
4. **Conservative quality.** Pass: debt/equity ≤ 0.5, ROCE ≥ 15% in each of the last three years, positive operating cash flow in each of three years, promoter pledge disclosed as missing where not available. Known weakness: will often return few or no stocks, and can trail a rising market.

**Pick mechanics (D2).** A name first appearing on a published list opens a paper position of equal notional (₹1,00,000) at the **next session's open**. It exits at the **next session's open after the first run where it no longer passes**. Initial stop for R is **20% below entry** (declared on every methodology page) — a fundamental screen has no technical stop, so R is defined by a fixed risk unit; this is a convention, stated as one. No stop-outs are simulated unless the 20% level is breached on a daily low, in which case it exits at that stop, or at the open if it gapped through. Voids: a name delisted, suspended, or whose data later proves wrong is voided with a stated reason and stays listed.

**Sit-out state.** A run with zero passes writes a run row with `passed: []`; the page shows the designed state and the near-miss table ("one criterion away") built from rule-level results.

**Refusals.** Names that failed in a run are tracked at 4 / 12 / 26 weeks and shown as the counterfactual. Not-scorable names are listed separately so "refused" is not conflated with "could not be scored".

## 6. Features → implementation map

| Feature | Core modules | Notes |
|---|---|---|
| F1 Screens | `screens/*.ts` (pure rule functions → rule-level results), `shortlist` generator, methodology MDX, per-stock pages | Rule results, not just totals, are stored so checklists render without recomputation. |
| F2 The Gate | `gate-state.ts` (state machine), `position-size.ts`, `rules.ts`, custom element + base-ui form | Submit disabled until five values valid; quantity read-only; override requires reason; stop/target attach in the same transaction. Daily-loss/max-trades lock until next NSE session. Strict mode locks rule edits to a date. |
| F3 The Plan | `plan.ts` (wizard model, buckets, SIP schedule, drift), plan page | Paper SIP into a screen's basket in screen proportions; escalation toggle set at setup; opt-out is an explicit action recorded with date. Panic-card state from benchmark session fall ≥ threshold (default −3%) when the page loads and the ledger's benchmark is current; otherwise no card. |
| F4 Scoreboard | `ledger-view.ts` selectors → `/ledger/*` | n beside every statistic; honesty label under n = 30. |
| F5 Public face | Astro pages, OG generator (`sharp`, as the repo already uses), sitemap, JSON-LD | Share cards say "Paper-only · Simulated". |

**Honest limits of the Gate lock** (stated on the rules page): it is a self-commitment device in the browser. Clearing site data or using another device bypasses it. Stated plainly in the product; not claimed as enforcement.

**Micro-review skipped is counted and displayed.** Streaks/badges: only journal-completed, rules-followed, sat-out-a-locked-day.

## 7. Cold start and the homepage hero

Forward-only means: at launch there are **zero closed trades**. Weekly lists of ~5–15 names per screen, held for weeks to months, will produce fewer than 30 closed trades per screen for **roughly 6–12 months**, and the combined curve is meaningful sooner but still small-n. The hero therefore has three honest states, all designed:
1. **Day 0–30:** the curve shows open positions marked to market from `book_days`, with "n = 0 closed — too few to conclude anything" and the launch date stamp. This is the real thing, not a placeholder.
2. **n < 30 closed:** curve plus drawdown ribbon, honesty label on every stat.
3. **n ≥ 30:** labels drop.

**What must not happen:** backfilling a backtest into the Ledger so the curve looks mature. Backtests suffer look-ahead (fundamentals as restated, survivorship in the universe). If you want one at all it belongs on a methodology page, labelled "historical replay — not a track record" and kept out of every aggregate. Decision requested if you want it; default is none.

Daily book snapshots start the first night the job runs (Step 2) — before any UI exists — because mark-to-market history cannot be recovered afterwards from a feed that adjusts history.

## 8. Build order and gates

| Step | Deliverable | Gate to pass |
|---|---|---|
| 0 | Skills loaded (done; report below) | none |
| 1 | **This document and DESIGN.md** | **Your approval** |
| 2 | `accounting.ts` + fixtures; ledger builder; schema validator; nightly workflow `lockedfree_ledger.yml`; first `book_days` row | Fixture passes exactly; append-only test passes; logged in BUILD-LOG.md |
| 3 | Tokens, fonts (Fontsource + fontaine), icon system, motion primitives, base components on `/style/` | `impeccable` audit and `hallmark` second opinion; findings fixed; deuteranopia screenshots reviewed |
| 4 | F1 → F2 → F3 → F4, each demoed on real ledger data before the next | Mini-gate per feature: you see it working |
| 5 | Public face, methodology, About, capture form, OG cards, SEO, copy pass | Copy audit script clean; humanizing pass |
| 6 | Proof gate: the 12 checks on the production build | Evidence logged for each |

Branch and deploy: development on `claude/confident-gates-jamo32`; no pull request unless you ask; deploy workflow `lockedfree.yml` mirrors Tripwire's (PR checks; deploy on manual dispatch until you approve auto-deploy). Custom-domain attachment needs the Cloudflare zone already holding `askakshay.com`, which Tripwire's config shows it does.

Test strategy: `node --test` for pure modules (accounting, rules, ledger builder, plan maths, gate state machine); Playwright (Chromium + WebKit, mobile viewport with touch) for the Gate flow, lock, reduced motion, keyboard path, CLS; a banned-phrase grep over `dist/`; a CSP/CDN-request audit; `axe-core`. Existing repo tooling (Playwright, axe, sharp) is reused.

## 9. Risks

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R1 | **SEBI.** Publishing named stock lists with "Follow this screen" may be treated as research analysis or advice (SEBI Research Analysts and Investment Advisers regulations). I am not a lawyer and cannot say where the line falls for a rules-based, paper-only, educational site. | Medium / **high** — could force takedown or registration | Counsel review before public launch (D3). Design already avoids buy/sell language, targets, and personalisation. Keep the "paper-only" frame, but do not treat it as a legal shield. |
| R2 | Fundamentals from Yahoo are incomplete or wrong for Indian small caps; Piotroski needs nine clean inputs across two years. | High / high | Per-rule "not scorable" state; coverage reported per screen; screens refuse to publish if coverage < 70% of universe; fall back is **showing less, never guessing**. |
| R3 | Unofficial data sources break or block. | Medium / high | Validation gates stop publication; stale data labelled stale; the site stays up on the last good snapshot. |
| R4 | Small n makes every statistic noisy for a year; visitors over-read the curve. | Certain / medium | Honesty labels, sample sizes, drawdown beside return — all mandatory components. Do not promote the curve in marketing until n ≥ 30. |
| R5 | Price-index benchmark flatters the screens relative to a total-return index (dividends ignored on the benchmark only if picks' dividends are also excluded). | Medium / medium | Both ignore dividends consistently; labelled. Revisit if a TRI feed is found. |
| R6 | Look-ahead in fundamentals: a statement filed in May is not known on the March fiscal-year-end date. | High / high | Use statement **filing/available date** where the source gives it; otherwise lag fundamentals 90 days after period end; state the lag on every methodology page. |
| R7 | Library churn (Astro 7, base-ui 1.x, lightweight-charts 5). | Medium / medium | Versions pinned; lockfile committed; spike in Step 2/3 before depending on any. |
| R8 | Too many animation/tooling dependencies bloat a page that is mostly text and numbers. | Medium / medium | Budgets enforced in CI; Anime.js and swup declined; Lenis and GSAP loaded only where used. |
| R9 | Colour-only up/down. | Certain if unmanaged | Sign + icon rule, lint-enforced; measured in DESIGN.md §2. |
| R10 | User-data privacy for waitlist emails (India's DPDP Act). | Medium / medium | Store minimum (email, timestamp, consent text version), no tracking pixels, deletion on request, purpose stated beside the form. |
| R11 | Edge cases: market holidays, trading halts, bonus/splits changing prices mid-pick, symbol changes, delistings. | Certain / medium | Corporate-action handling via adjusted splits; void with reason on delisting; symbol-change map; each has a test case. |
| R12 | The prompt's "no changes to rules/accounting/gate after approval" combined with an empty ledger means a rules mistake found at month 3 invalidates months of record. | Medium / high | This is why Step 1 asks you to read §5 closely. A rule change after launch starts a new version of the screen with its own track record, never rewrites the old one. |

## 10. Step 0 report — skills

All cloned shallowly into the session scratchpad and read for relevance; they are references, not installed globally (none of them changes the repo).

| Skill / reference | Result |
|---|---|
| google-labs-code/design.md (spec) | Loaded — DESIGN.md follows its front-matter format |
| VoltAgent/awesome-design-md | Loaded (reference collection) |
| nextlevelbuilder/ui-ux-pro-max-skill | Loaded; the packaged `ui-ux-pro-max` skill is also available |
| Leonxlnx/taste-skill | Loaded |
| alchaincyf/huashu-design | Loaded |
| pbakaus/impeccable | Loaded (critique and audit for Step 3 onward) |
| Nutlope/hallmark | Loaded |
| emilkowalski/skills | Loaded — easing curves and durations adopted |
| greensock/gsap-skills | Loaded |
| lieflat-charts | Loaded — resolved to `larashero3-dotcom/lieflat-charts` (6,917★, matches the prompt's 6.9k) |
| pqoqubbw/icons, mui/base-ui | Cloned for source reference; npm packages to be installed at Step 3 |
| npm packages (Fontsource Fraunces/Inter/Plex Mono, fontaine, gsap, lenis, auto-animate, lightweight-charts, uPlot, swup, astro, lucide-static, animejs) | All resolve on the registry. base-ui's stable package is `@base-ui/react` (the older `@base-ui-components/react` is a release candidate). |

Failed: none. Unverified: that every skill's instructions can be applied non-interactively; `impeccable` and `hallmark` run is deferred to Step 3, when there is something to audit.
