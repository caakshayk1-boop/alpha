# Claude Code prompt — Tripwire: complete FIX + UPDATE + UPGRADE + DESIGN OVERHAUL

Paste this whole file into Claude Code in the Tripwire repo. It is the single master instruction for the next build cycle: correctness fixes first, then data updates, then product upgrades, then a full design/motion/layout overhaul. Work in the order given — Part 1 → Part 4 — and do not start the design work until the data layer is truthful (a beautiful UI on stale data is worse than an ugly one, because it lies more convincingly).

**Evidence base:** full site audit dated 30 Oct 2026 (`tripwire-site-audit-2026-10-30.md` — ask AK for it if any claim below needs the underlying numbers). Every fix item cites the observed evidence; verify each against the live code/data before changing anything.

**Hard guardrails (apply to every part):**
- Do NOT change any rule formula, engine logic (MOM / QLT / LVT), gate threshold, cost assumption (0.25%), or published methodology claim, except where a task explicitly instructs a fix + a Methodology disclosure.
- Preserve all existing data contracts (`/data/*.json` shapes, `/api/*` response shapes) unless a task says otherwise; if a shape must change, migrate every consumer in the same commit.
- Paper-only product. No real-money language anywhere. Keep "rules that fire, evidence you can check" as the product promise — the design must serve it, not decorate over it.
- After each numbered task: state what changed, how you verified it, and run the full build + any existing tests.

---

# PART 1 — FIX (correctness, P0)

## 1.1 Backfill T1/T2 targets for pre-cutover book positions (the Laurus Labs bug)
The targets cutover `fu = "2026-10-27"` makes `zt(pick)` return `null` for picks with `asOf < "2026-10-27"`, so the book evaluator `Ms()` never runs the T1/T2 ladder (`du()`: book half at T1, raise stop to entry, exit rest at T2) for those positions — their only exits are stop and time-exit — while the display layer (`Xa()` / `hf()`) still shows T1/T2 reference levels for them. Live victim: LAURUSLABS pick `2026-10-23|MOM|LAURUSLABS` (entry ₹1,961.96, stop ₹1,833.58) crossed T1 on 28 Oct and T2 on 30 Oct 2026 (high ₹2,385.8 vs T2 ref ₹2,379.26) with ₹0 booked. ~10 open positions are pre-cutover.
- Apply the standard horizon-based target ladder to ALL currently-open pre-cutover positions, effective next build.
- Re-evaluate those positions bar-by-bar from entry: any T1/T2 already crossed books at the correct historical bar and price (Laurus: half at T1 on 28 Oct, remainder at T2 on 30 Oct; stop raised to entry after T1, per existing ladder rules).
- Disclose the backfill on the Methodology page (dated note: targets applied retroactively to pre-27-Oct open positions; no formula changed).
- Any position whose targets are not yet live must label its displayed levels "reference only — predates target tracking".

## 1.2 Fix the ledger outcome-stage lag + add build assertions
In the 30 Oct 02:07Z run, picks were written asOf 29 Oct but every outcome was marked only through the 28 Oct close (all 31 open outcomes' `mark` = 28 Oct close; ten 28-Oct picks still "pending" though all entered at the 29 Oct open; three QLT ECLERX positions that stopped out on 29 Oct — stops ₹1,666.40 / ₹1,651.41 / ₹1,673.65 vs 29 Oct close ₹1,660.6 — still show "open").
- Find why the outcome stage evaluates one session behind the pick stage in the same run; fix so both stages use the same latest completed session.
- Add build-time assertions that fail the build loudly (non-zero exit + clear log line) when: (a) outcome stage max marked date ≠ pick stage max asOf date; (b) `/data/screen.json` `as_of` ≠ last completed NSE session date; (c) any open position's mark date < latest completed session.

## 1.3 Restore the screener build + one freshness source of truth
`/data/screen.json` is `built_on 2026-10-27`, `as_of 2026-10-26` (988 rows); all `/data/c/{SYM}.json` are from the same build; `/api/breadth` also as_of 2026-10-26; `/data/signals.json` claims `data_through 2026-10-27`. Find why the screen build stalled after 27 Oct, restore it, and derive every file's freshness label (screen, signals, breadth, ledger, company files) from ONE session-calendar module so no two surfaces can ever disagree about the last close.

## 1.4 Repair the empty data endpoints
- `/api/rsi` (as_of 2026-10-29) returns exactly one row (ARTEMISMED). ARTEMISMED is also the only sector-less row in screen.json — check the symbol onboarding/join upstream. Restore the full universe.
- `/api/factors` (as_of 2026-10-29) returns `universe: 0, rows: {}`. Restore it, or — if the feature is retired — remove the endpoint and every UI reference cleanly.

## 1.5 Headers + truthful 404s + sitemap
- Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` and `Cross-Origin-Opener-Policy: same-origin`. Keep the existing strict CSP unchanged.
- Unknown `/data/*` paths must return a real 404 with a JSON body, not the SPA shell with HTTP 200 (today even `/data/c/ZZZZNOTREAL.json` returns 200 text/html, so data failures masquerade as success).
- Ship a static `/sitemap.xml` (hash-routed app: list the canonical root URL plus any indexable static pages).

---

# PART 2 — UPDATE (data integrity + consistency, P1/P2)

## 2.1 One R, one T2 (product decision, default specified)
Today three definitions coexist: displayed levels off the *signal close* (R = ref − stop), book ladder off the *actual entry* (R = entry − stop), ledger `r` off entry. Example: LAURUSLABS 27 Oct pick — displayed T2 ₹2,593.44 vs ladder T2 ₹2,602.00.
- **Default (implement unless AK overrides): the book is the truth.** All displayed T1/T2 levels, progress indicators and `r` values use entry-based R (entry − stop). Signal-close reference levels may still be shown on the pick's detail view, clearly labelled "at signal close".
- Update the Methodology page to state the single definition in one sentence.

## 2.2 Reconcile universe counts
Screen says 988 names; `/api/breadth` says n=920 for the same as_of date; sector counts differ (Industrials 209 vs 192, Financial Services 132 vs 125). Either align the universes or publish the reason for the gap (e.g. liquidity filter) in the Data view and Methodology. Silence is the bug.

## 2.3 Screen row completeness
- `tier` is null for 293 of 988 rows (29.6%) although published rule elig-2 D1 requires a size class: backfill tier for every row or amend the rule text to match reality.
- Rows HEG and ICICIPRULI carry `last_date 2026-10-23` inside the 26 Oct file: add a build assertion — no row's `last_date` may be older than the file's `as_of` minus 1 session without an explicit `stale: true` flag rendered in the UI.
- ARTEMISMED has no sector: fix the upstream mapping; add a build assertion for null sector/tier.

## 2.4 Ledger hygiene
- Voided picks must not carry live outcomes in `/api/ledger` (today the voided LVT LAURUSLABS pick serves `"status":"open", r: 2.11`). Serve voided picks with `status: "void"` and no live outcome fields.
- Disclose the same-bar T1+T2 modelling choice in the ladder (`du()` defers T2 to a later bar when one bar's high crosses both but its open is below T2) on the Methodology page — one sentence.

## 2.5 One Record
The Signals view shows `record {closed: 0, wins: 0, total_r: 0}` while the ledger holds 31 open positions — two "records" a visitor cannot reconcile. Merge into ONE Record surface fed by the ledger, with the Signals gate state shown as a clearly-labelled section inside it (see also 3.4 and the Part 4 layout for the Record view).

---

# PART 3 — UPGRADE (product)

## 3.1 T1/T2 hit alerts for book positions
`signals.json` already has alerting machinery (`alertable`, `alert_why`, currently off because the Alpha gate is off). Reuse the pattern for the Paper Book: every morning build, flag positions where T1 or T2 was hit in the last session ("T1 hit — half booked", "T2 hit — position closed") and surface them at the top of Today and the Book (design in Part 4). This is the feature whose absence AK discovered by eyeballing a chart — it must never need eyeballing again.

## 3.2 Freshness as a visible product feature
Build a small freshness module (data from 1.3's single source of truth) rendered as: a status pill on Today ("Data through Thu 29 Oct · built 06:12 IST"), per-view "as of" labels (Book must show BOTH "picks through" and "outcomes through" until 1.2's fix makes them identical — then one label), and a full per-file table in the Data view. If any file is stale, the pill turns amber and says so in words. Honesty about freshness is a differentiator for this product — make it loud, not hidden.

## 3.3 Capture point + identity links
There is currently no email/waitlist/subscribe element anywhere in the app and no link to askakshay.com or the Margin Notes newsletter. Add ONE tasteful capture module (design in Part 4): on Today below the fold and at the end of Methodology — "One email a week. The rules that fired, the evidence, the record." — wired to the existing Beehiiv subscribe endpoint used by askakshay.com, plus a footer with askakshay.com + newsletter links. No popups, no modals, no exit intent. Ever.

## 3.4 Gate state on Today
Surface the Signals gate state (currently 1 of 4 checks, holdout t = −0.62 vs +2.0 needed) as a compact card on Today: "Signals gate: OFF — 1/4 checks · holdout t −0.62 (needs +2.0)". The product's credibility comes from showing the gate is off and why.

## 3.5 Performance budget (enforce in build)
Current initial load ≈ 344KB JS (137.9KB entry + 206.0KB main chunk) + one render-blocking 76.4KB stylesheet, and no `modulepreload` for the main chunk.
- Add `modulepreload` for the main chunk; split the Lab chunk pattern to other heavy views (Company, Sheets) if not already lazy.
- Inline critical CSS for the first viewport; defer the rest.
- Budgets: initial JS ≤ 250KB gzip-path equivalent, no render-blocking CSS beyond the inlined critical set, LCP < 2.0s on mid-tier Android over 4G. Report before/after numbers in the build summary.

---

# PART 4 — DESIGN OVERHAUL (CRED × 1% Club inspired)

**Design north star.** Take CRED's *premium dark restraint* — near-black canvas, one accent, oversized confident type, generous negative space, motion that feels expensive because it is slow, smooth and rare — and 1% Club's *friendly finance clarity* — simple cards, plain-language labels, one idea per screen, nothing that needs a legend. Tripwire's own translation: **a calm, dark, evidence terminal. Fewer things, bigger, with room to breathe.** If a screen feels dense, it is wrong; if an animation feels noticeable, it is too much.

Brand anchors to keep: dark theme (today `#0a0a0a`), lime accent (`#CCFF43` family — the product's existing spark), "rules that fire, evidence you can check". Everything else about the visual system is open to change per this spec.

## 4.1 Design tokens (implement as CSS variables; retire ad-hoc values)
- **Colour:**
  - `--bg: #0A0A0B` (canvas), `--surface: #131315`, `--surface-2: #1B1B1E`, `--line: rgba(255,255,255,0.08)` (hairlines only — no heavy borders)
  - `--ink: #F5F4EE` (primary text), `--ink-2: #B9B9B4`, `--ink-3: #8A8A85` (never below 4.5:1 on its background)
  - `--accent: #CCFF43` (lime — ACTIONS and highlights only; if everything is lime, nothing is)
  - `--up: #4ADE80`, `--down: #F87171` (data semantics only, never decorative)
  - `--amber: #FBBF24` (staleness/warnings only)
  - Depth via subtle vertical gradients on surfaces (`#17171A → #101012`) and one soft shadow scale; no glassmorphism, no glows except a single restrained accent glow on the primary CTA.
- **Type:** one family, two weights story. Display/headings: 600–700, tight tracking (−0.02em). Body/data: 400–500. Scale: display 40/48, h1 32/40, h2 24/32, h3 19/26, body 15/24, **data minimum 13.5px** (retire the current 12px `--fs-xs` for anything a user must read; 12px survives only for timestamps/labels in `--ink-3`), tabular-nums everywhere numbers appear. Numbers are the product — set them like headlines in summary contexts (position P&L, R values, prices at 20–28px, not 13px).
- **Spacing:** 4pt base, CRED-style generosity: section gaps 48–64px desktop / 32–40px mobile; card padding 24px (20px mobile); page gutters 24px mobile / 48px desktop; max content width 1120px, reading views (Methodology, Help) 720px. When in doubt, add space, remove a divider.
- **Radius & elevation:** cards 20px radius (CRED-large), chips/pills full-round, inputs 14px. Shadows: `0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px rgba(0,0,0,0.35)` for raised cards only; flat otherwise.
- **Iconography:** one stroke-icon set, 1.5px stroke, 20px default; no emoji in UI.

## 4.2 Layout per view (rebuild to this structure)
- **Global shell:** slim top bar (wordmark left, freshness pill centre-left, gate pill right), bottom tab bar on mobile (Today · Discover · Book · Record · More) replacing any hamburger; desktop left rail or top nav with the same five primaries; Methodology/Help/Data live under More + footer. `<main id="main">` with skip link already exists — keep. Every view gets ONE primary job; if a view has two, split it.
- **Today (the 5-second test):** (1) Hero block: one-line definition ("Tripwire fires published rules on NSE stocks — and shows you the evidence."), freshness pill, gate card (3.4). (2) "Fired at last close" strip: rules that fired, as 3–5 large cards, or an honest empty state ("No rules fired at the last close. The gate is doing its job."). (3) Book snapshot: open positions count, aggregate R, and any T1/T2 alerts (3.1) as the top card when present. (4) Capture module (3.3). Nothing else. Today is a briefing, not a dashboard.
- **Discover (screener):** keep the table on desktop but restyle: row height ≥ 52px, sticky header with blur surface, zebra striping REMOVED (hairlines only), numeric columns right-aligned tabular, tier/sector as quiet pills. On mobile the table becomes stacked cards (symbol + price + the 4 metrics the row is ranked by + chevron) — never a horizontally-scrolling 20-column table. Filters collapse into one "Refine" sheet. Every column header gets a one-line plain-language tooltip from the Methodology definitions.
- **Paper Book (the emotional core — spend the most design effort here):** positions as large cards, one per position, CRED-statement style: symbol + company (h1-size), entry → live price as a visual journey, and a **target ladder visualisation**: a horizontal track Stop — Entry — T1 — T2 with the live price marker on it, segments filling in accent as price progresses; booked portions shown as filled ticks ("½ booked at T1 · 28 Oct"). P&L in R and ₹, big. Closed positions collapse into the Record with the same ladder shown completed. This single component replaces any dense positions table.
- **Record:** one unified record (2.5): headline stats as three large numerals (closed trades, win rate, total R), then closed-position cards (same ladder component, completed state), then the Signals-gate section. Empty states written honestly ("Nothing has closed yet — the first positions are still open.").
- **Company view:** header block (name, price big, sector/tier pills, freshness of the file), evidence sections as spaced cards (statements summary, rule checks with pass/fail in words not just icons, price chart), TradingView link as a quiet secondary action.
- **Methodology / Help:** reading layout, 720px, h2 sections with generous top margins, rules presented as numbered cards with the formula set in a mono block on `--surface-2`, every threshold stated in words next to the formula. This page is the trust engine — design it like a CRED legal page that people actually enjoy reading.
- **Data view:** the per-file freshness table (3.2) as clean rows: file, as_of, built, rows, status pill. Plus universe note (2.2).

## 4.3 Motion & animation (the CRED layer — restraint is the spec)
- **Global rules:** durations 160ms (micro) / 240ms (standard) / 360ms (view transitions); easing `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-expo family) everywhere; NOTHING bounces, nothing loops, nothing auto-plays. Animate transform + opacity only. Every animation must have a purpose (state change, continuity, or feedback) — decoration is a defect.
- **View transitions:** incoming view fades + rises 8px; outgoing fades. Tab switches crossfade content, no slide carousels.
- **Numbers:** headline numbers (P&L, R, prices on Book cards) count/tween to new values on data refresh (600ms, ease-out); live ticks flash the price text colour (up/down) for 400ms then settle — subtle, once per change, never a background flash.
- **Ladder component:** on first render, the price marker travels from Entry to current position (600ms); when a booking event is new since last visit, the booked segment fills with a single accent sweep (400ms) — this is the one "moment" in the app; make it satisfying and rare.
- **Lists & cards:** stagger fade-rise by 30ms per item, capped at 8 items; skeletons (shimmer at 8% opacity) for every data-dependent region — no spinners except inside buttons.
- **Micro-interactions:** press states scale 0.98 (120ms); hover states lift surface one step (`--surface → --surface-2`), no shadows animating; pull-to-refresh on mobile Today/Book with the wordmark as the indicator; copy/share actions confirm with a 1.6s inline label change ("Copied"), no toasts.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables tweens, staggers and the ladder travel (states jump instantly). Non-negotiable.
- **Scroll:** momentum preserved; sticky headers gain their blur/line only after 8px of scroll (animate the hairline opacity, not the bar height).

## 4.4 Component inventory (build/rebuild these, delete the rest)
FreshnessPill · GateCard · RuleFiredCard · PositionCard (with TargetLadder) · RecordStat · DataTable (desktop) / EntityCard (mobile) · FilterSheet · CaptureModule · SectionHeader (title + one-line description + optional action) · EmptyState (icon, one honest sentence, one action) · SkeletonBlock. Any component not on this list needs a written justification in the PR description.

## 4.5 Accessibility & quality gates
- Contrast: all text ≥ 4.5:1 (large text ≥ 3:1) verified against the new tokens; focus rings visible (2px accent outline, offset 2px) on every interactive element; tap targets ≥ 44px; heading hierarchy one h1 per view; the `<main>` landmark + skip link stay.
- Lighthouse targets on production build (mobile): Performance ≥ 95, Accessibility ≥ 98, Best Practices 100, SEO 100 — the 28 Oct baseline was 97/98/92/100; Best Practices must reach 100 via 1.5's headers.

## 4.6 Acceptance criteria (all must pass before this is called done)
1. Laurus Labs position shows: T1 half booked 28 Oct, remainder exited at T2 30 Oct, correct prices, in both Book and Record.
2. Every data surface shows an as_of consistent with the single freshness source; screen = signals = breadth session; a deliberately staled build fails the assertion in 1.2.
3. `/api/rsi` returns the full universe; `/api/factors` returns rows or is gone with its UI.
4. Book a position card: ladder renders Stop/Entry/T1/T2 from ENTRY-based R (2.1); displayed levels match booked levels to the paisa.
5. ECLERX's three stopped positions show closed at their stops dated 29 Oct.
6. `curl -sI` shows HSTS + COOP; a bogus `/data/` path returns 404 JSON; `/sitemap.xml` returns XML.
7. Design: tokens implemented as variables with zero remaining ad-hoc hex in components; data text ≥ 13.5px; mobile Discover uses cards (no horizontal table scroll); `prefers-reduced-motion` verified; Lighthouse gates in 4.5 met.
8. Capture module live on Today + Methodology, submitting to Beehiiv; footer links askakshay.com + Margin Notes.

## Working order & reporting
Part 1 (1.1 → 1.5) as separate commits, each verified against its evidence numbers before moving on. Part 2 next, then Part 3, then Part 4 (tokens → shell → PositionCard/TargetLadder → views in the order Today, Book, Record, Discover, Company, Methodology, Data). Finish with a summary: what shipped per part, before/after bundle + Lighthouse numbers, screenshots (mobile + desktop) of Today, Book and one Company view, and anything from this file you did NOT do, with the reason.
