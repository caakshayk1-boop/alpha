# Alpha — PRO EDITION: world-class product, design, motion, AI and production handoff

**Site:** https://alpha.askakshay.com/
**Edition:** Pro Edition v2.0 — 21 October 2026 (Malaysia date)
**Supersedes:** `Alpha_Claude_Handoff.txt` (audit + expanded implementation edition, sections 1–20)
**Companion files in this pack:** `docs/alpha/DESIGN.md` (canonical design tokens and component rules), `.claude/commands/alpha-pro.md` (Claude Code slash command), `README.md`, `CHANGELOG.md`

> **How this document is organised**
>
> - **Part A — Pro Edition (sections 0, 21–35):** new. Benchmarks the best research, data and product sites in the world and converts them into Alpha-specific requirements for typography, colour, layout, motion, AI, decision-making UX, features, writing, performance and quality gates. Ends with one consolidated Claude Code master command (section 34).
> - **Part B — Original audit and mandatory scope (sections 1–20):** preserved in full. Every defect (A01–A16), route plan, mobile matrix, production checklist, navigation, luxury presentation and signup/SEO requirement still applies. Part A builds on Part B; it never relaxes a Part B gate.
>
> **Order of precedence when instructions conflict:** correctness and safety (Part B §3, §10) → accessibility (§9, §30) → Part A design/motion/AI rules → aesthetic preference. A beautiful wrong number is a failure.

---

## 0. Pro Edition — executive summary

**Ambition:** make Alpha feel like the calm, trustworthy offspring of a research terminal and a premium editorial publication — *Koyfin's linked depth, Fiscal.ai's click-to-source auditability, Perplexity Finance's cited answers, Screener.in's data honesty, Linear's restraint and keyboard speed, and the typographic confidence of a great financial newspaper* — built specifically for Indian equities and a single, clear job:

> **"Help me decide what deserves my research time today, show me the evidence for and against, and remember what I concluded."**

**What "Pro" means here (and what it does not):**

| Pro means | Pro does not mean |
|---|---|
| Every number traceable to a dated source in one click | More widgets, more gradients, more glass |
| A decision journey: glance → understand → verify → record | Buy/sell calls, ratings, "multibagger" lists |
| Keyboard-first speed (⌘K, shortcuts) with full touch parity | Hover-only power features |
| Motion that explains *what changed* and *where you went* | Animated prices, count-ups, scroll hijacking |
| AI that answers only from typed, cited facts — and says "unknown" | A chatbot that sounds confident |
| A design system enforced by tokens and lint | One-off styling per page |

**The seven Pro pillars (each has its own section):**

1. **Decision UX** (§22) — the Decision Ladder, Case/Countercase, "what would change my mind", bias guards.
2. **Typography** (§23) — editorial serif + precise UI sans + tabular numerals + Indian number formatting.
3. **Colour & tokens** (§24) — OKLCH semantic tokens, brand ≠ market meaning, colour-blind market mode.
4. **Layout** (§25) — 12-column grid, density modes, six page families with wireframes.
5. **Motion v2** (§26) — motion tokens, native View Transitions for navigation, shared-element continuity, GSAP only where needed.
6. **AI layer** (§27) — "Ask Alpha": grounded, cited, constrained-claim architecture with an evaluation suite.
7. **Pro features** (§28) — command palette, linked views, financial explorer, source-to-filing links, curated screens, layouts, PWA.

Supporting sections: microcopy (§29), inclusive access (§30), performance budgets (§31), quality gates and Definition of Done (§32), execution waves 5–7 (§33), the consolidated Claude Code command (§34), references (§35).

---

## 21. World-class benchmark synthesis — what to borrow, adapt and reject

The references below were reviewed on 21 October 2026 from public product pages, help documentation and independent reviews. They are inspiration for patterns, **not** licence to copy proprietary assets, layouts pixel-for-pixel, fonts that require a licence, or data. Claude must re-check any detail before relying on it.

### 21.1 Benchmark matrix

| Reference | Pattern worth borrowing | Alpha adaptation | Reject / caution |
|---|---|---|---|
| **Koyfin** | Saved dashboards combining charts, tables, news; screener templates; jump from screen results to comparison/chart; "financial explorer" for spotting trend breaks | **Linked views** on Company/Compare; **curated screen templates** for Indian equities; click any financial line item to chart its history | Unlimited drag-and-drop dashboards — too much configuration for Alpha's audience; offer 3–4 opinionated layouts instead |
| **Fiscal.ai** | Click-through auditability from figure to source filing; Bulls Say vs Bears Say on company page; "What's happening" (recent material news); segment/KPI tabs | **Source-to-filing** link on every reported figure (NSE/BSE filing or provider page); **Case / Countercase** block above the fold; "What changed in 30 days" | Generated bull/bear text without citations; segment data Alpha cannot verify |
| **Perplexity Finance** | Answers with inline citations; natural-language screening covering Indian equities; watchlist briefings; earnings hub with releases/transcripts | **Ask Alpha** answers only from typed facts with citations; NL screener with **intent preview before results**; daily **watchlist "what changed" brief** | Independent reviewers note calculations and conclusions still need checking — Alpha must render numbers from data, never from model prose (A03) |
| **Screener.in** | Data density, long financial history, text-query screening, export-friendly tables, no-nonsense UI | Keep Alpha's **query clause chips** and add an **advanced text query** mode; 10-year tables with Excel/CSV export | Plain/utilitarian visual style — Alpha keeps its editorial warmth |
| **Tickertape** | Visual scorecards, curated screens, market-mood style indicator, corporate-events feed | Alpha's barometer and scorecards already exist — make each **explain its inputs** (§8B) and show corporate actions on Company/Calendar | Proprietary sentiment indices presented without method; forecast emphasis |
| **Robinhood Legend** | Layout templates by task; widgets linked into synced groups so changing the symbol updates every linked panel | **Symbol linking** across Company chart, financials and peer table; **layout presets** ("Quick look", "Deep dive", "Compare") | Trading/execution affordances — Alpha is paper-only research |
| **TradingView** | Compact chart legend whose controls appear on demand so they do not cover the chart | Chart legend: values always visible, controls revealed on hover **and focus**, pinned on touch | Hover-only discoverability on mobile |
| **Linear** | Single restrained accent used for function (focus, links, primary CTA), tight 4px spacing grid, small radius scale, subtle 1px borders over heavy shadows, tactile press feedback, keyboard-first ⌘K | Violet reserved for **function**, not decoration; 4/8 spacing scale; radius 6/10/16; **⌘K command palette** with actions; press feedback `scale(0.98)` ≤120ms | Dark-only, ultra-dense developer aesthetic — Alpha remains warm, light-first, editorial |
| **Vercel Geist** | Table guidance: sortable headers are buttons, `—` for unknown values, tabular numerals for numeric columns, relative-time conventions; Geist Mono under SIL OFL | Adopt these table rules verbatim as Alpha conventions (§23, §29); evaluate Geist Mono for tickers/codes only | Replacing Instrument Serif/Inter Tight wholesale |
| **Great financial newspapers** (editorial benchmark) | Confident serif headlines, disciplined columns, dated bylines, corrections culture | Weekly Reads in a true **reading layout**; dated, signed, review-status labelled; public **corrections log** | Paywall patterns, clickbait headlines |

### 21.2 The synthesis — Alpha's unique position

None of the benchmarks combines all of: **Indian-equity focus + editorial clarity + per-number provenance + honest experimental research + a personal decision record.** That combination is Alpha's moat. Every Pro feature must strengthen at least one of those five; anything that does not is out of scope.

### 21.3 Competitive "minimum bar" (Alpha must not be worse than this)

| Capability | Minimum bar for Alpha Pro |
|---|---|
| Company lookup | ≤2 keystrokes to results via `/` or ⌘K; fuzzy match on name, ticker, common alias |
| Financial history | Multi-year annual + recent quarterly; every period labelled; export |
| Screening | Clause chips + saved screens + shareable URL + templates + keyboard sort |
| Provenance | Source and as-of on every metric (popover) and on every exported artefact |
| Comparison | 2–4 companies, sector-aware metrics, differences highlighted, saved |
| Personal workflow | Watchlist, saved screens, research cards, journal — synced when signed in (§20) |
| Mobile | Every core journey completes one-handed on a 360px phone (§15) |

---

## 22. Decision-making UX — the core of the Pro edition

Alpha is a **decision-support** tool, not a recommendation engine. The UX must make good reasoning easy and poor reasoning visible.

### 22.1 The Decision Ladder (every data page must serve all four rungs)

| Rung | Time budget | User question | UI pattern |
|---|---|---|---|
| **1. Glance** | ~5 s | "Is anything here worth my attention?" | One-line takeaway + 3–4 key facts with as-of; change indicators |
| **2. Understand** | ~30 s | "Why does it look this way?" | Case / Countercase; "Why it ranks"; driver breakdown (price vs fundamentals vs data revision) |
| **3. Verify** | ~2 min | "Can I trust this?" | Evidence drawer: inputs, formula, source link, date, coverage, limitations |
| **4. Record** | ~1 min | "What did I decide and when will I revisit?" | Save research card with thesis, counter-thesis, review trigger/date; journal entry |

Acceptance: on Today, Company, Screen and Compare, a usability walkthrough can complete each rung without leaving the page (drawers/sheets allowed) and without hover.

### 22.2 Case / Countercase block (Company, Compare, Reads)

```
┌─ THE CASE ─────────────────────────┐ ┌─ THE COUNTERCASE ──────────────────┐
│ • ROE 24% (FY26, 3-yr avg 21%) [S] │ │ • P/E at 92nd pct of own 10-yr [S] │
│ • Debt/Equity 0.1 (Mar-26) [S]     │ │ • Revenue growth slowed to 6% [S]  │
│ • Promoter holding stable [S]      │ │ • Value checklist 2/6 [?]          │
└────────────────────────────────────┘ └────────────────────────────────────┘
  Evidence strength: 6 sourced facts · 1 unknown · Last data: 19 Oct 2026
  [S] = opens source & date   [?] = opens definition
```

Rules:
- Both columns are **equal width and equal visual weight**. The countercase is never collapsed by default.
- Each bullet is a deterministic rule over typed facts (thresholds documented in Method). AI may phrase, never invent (§27).
- If fewer than two countercase points exist, show "No strong counterpoint found by Alpha's rules — this is not evidence that none exists."
- No overall verdict, score or colour implying "buy".

### 22.3 "What would change my mind" (research cards)

Research cards gain four structured fields: **Thesis**, **Disconfirming evidence I'd watch**, **Unknowns**, **Review trigger** (date or explicit data condition, e.g. "next quarterly result"). My Desk's "Needs review" queue is driven only by these triggers and observed data changes (§18).

### 22.4 Bias guards built into the interface

| Bias | Guard |
|---|---|
| Anchoring on one price | Show 52-week range and own-history percentile beside the price |
| Recency | Default chart range ≥1Y; short ranges are one tap away, not default |
| Confirmation | Countercase is first-class (§22.2); saving a thesis prompts for one disconfirming point (skippable) |
| Survivorship | Screen/engine results state universe definition and exclusions |
| Overconfidence from backtests | Experimental label + holdout/forward split always adjacent to any performance figure |
| Base-rate neglect | Where a percentile/score appears, show "x of y companies" in plain words |
| Herding | No "most watched", "trending" or social-proof counters |

### 22.5 Comparison that aids judgement

- Highlight a metric only when the difference is **material** (documented threshold per metric, e.g. ≥5 pp for margins) — otherwise neutral.
- Show **"not comparable"** for sector-inapplicable metrics (e.g. EBITDA margin for banks) instead of a misleading value.
- No "winner" column. Offer "Strongest on…" per metric group with the data shown.

### 22.6 Scenario tools (Tools, Company valuation)

- DCF/SIP/position-size tools get **scenario presets** (Conservative / Base / Optimistic) the user can edit, with every assumption labelled *assumption* (violet-outline chip) vs *observed* (solid chip with source).
- A **sensitivity strip** (small 3×3 grid) replaces single-point outputs for valuation.
- Outputs carry "This is arithmetic on your assumptions, not a forecast."

---

## 23. Typography system — editorial confidence, numerical precision

### 23.1 Families (keep the identity, add precision)

| Role | Family | Notes |
|---|---|---|
| Display / editorial headlines | **Instrument Serif** (keep) | Single-weight display face with italic; never synthesise bold; use at ≥28px only |
| UI, body, data | **Inter Tight** (keep) | Variable if available; enable `tnum` and `lnum` for all numeric contexts |
| Tickers, codes, formulas (optional) | **Geist Mono** (evaluate) | SIL OFL. Use only if it measurably improves ticker/formula legibility; otherwise Inter Tight `tnum` |
| Long-form Reads (optional) | Evaluate an OFL reading serif (e.g. Newsreader or Source Serif 4) against Inter Tight at 18px | Adopt only if a side-by-side reading test is preferred; max one extra family |

Hard rules: maximum **3 families** shipped site-wide; self-host via `next/font` (no runtime third-party font requests); subset to Latin + ₹ and required punctuation; `font-display: swap` with metric-matched fallbacks to prevent CLS; preload only the above-the-fold display weight.

### 23.2 Type scale (fluid, verified on 360–1440px)

| Token | Size | Line height | Family / weight | Use |
|---|---|---|---|---|
| `--type-display-xl` | `clamp(2.5rem, 1.6rem + 3.2vw, 4.25rem)` | 1.02 | Instrument Serif 400 | One per page max (Today takeaway, Reads title) |
| `--type-display-l` | `clamp(2rem, 1.5rem + 1.8vw, 3rem)` | 1.05 | Instrument Serif 400 | Company name, hub titles |
| `--type-title` | `1.5rem` | 1.2 | Inter Tight 600 | Section titles |
| `--type-heading` | `1.125rem` | 1.3 | Inter Tight 600 | Card titles |
| `--type-body` | `1rem` | 1.55 | Inter Tight 400 | Default text |
| `--type-reading` | `1.125rem` | 1.65 | Reading face 400 | Reads body, 65–75ch measure |
| `--type-data` | `0.9375rem` | 1.35 | Inter Tight 500 `tnum` | Table cells, metrics |
| `--type-data-hero` | `clamp(1.75rem, 1.4rem + 1.2vw, 2.5rem)` | 1.0 | Inter Tight 600 `tnum` | Headline price/score |
| `--type-label` | `0.8125rem` | 1.3 | Inter Tight 500 | Labels, chips |
| `--type-meta` | `0.75rem` | 1.3 | Inter Tight 500, +0.02em | As-of, source — secondary only |

Phone inputs ≥16px (prevents iOS zoom). Eyebrows: uppercase only ≤3 words, `letter-spacing: 0.08em`.

### 23.3 Numerals and Indian formatting (single formatter module)

Create `src/lib/format.ts` as the **only** place numbers become strings. Lint/forbid ad-hoc `toFixed` in components.

| Kind | Format | Example |
|---|---|---|
| Price | `Intl.NumberFormat('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})` with ₹ | ₹1,23,456.70 |
| Large money | Crore/lakh with explicit unit | ₹12,345 Cr · ₹4.2 L Cr |
| Percent | 1 decimal unless <1 → 2 | 12.4% · 0.35% |
| Change in a percentage | **percentage points** | +1.2 pp |
| Basis points (yields) | integer bp — same unit on card and sheet (§5 Markets) | +7 bp |
| Ratios | 1 decimal + ×  | 24.6× |
| Unknown | em dash `—` with accessible label "not available" | — |
| Dates | `21 Oct 2026` ; with time `21 Oct 2026, 15:30 IST` | |
| Relative time | `2m ago`, `5h ago`, then absolute after 7 days | |
| Sign | Always show `+`/`−` (true minus U+2212) on changes | −3.1% |

Colour is never the only carrier of direction: sign + arrow glyph + colour.

---

## 24. Colour, surfaces and tokens v2

### 24.1 Principles

1. **Brand ≠ meaning.** Violet = brand and interaction (links, focus ring, primary action, active nav). Green/red = market direction only. Amber = data warning/staleness. Blue-grey = informational/neutral. Pastels = category/decoration only, never status.
2. **Semantic tokens only in components.** Components consume `--alpha-*` semantic tokens; raw hex/OKLCH appears only in `DESIGN.md`'s token layer. Add a lint rule to block raw colour literals in components.
3. **OKLCH authoring** for perceptual consistency across light/dark and accent variants; ship hex fallbacks if supported-browser analysis requires it.
4. **Contrast targets:** text ≥4.5:1, large text and UI boundaries ≥3:1, in **every** theme × accent combination (automated check in CI).
5. **Colour-blind market mode:** optional setting swapping green/red for blue/orange; direction still carried by sign and arrow.

### 24.2 Token layers

```
primitive  →  --violet-600, --sand-50, --ink-900 …           (DESIGN.md only)
semantic   →  --alpha-canvas, --alpha-surface-1/2/3, --alpha-text, --alpha-text-muted,
              --alpha-border, --alpha-accent, --alpha-accent-contrast, --alpha-focus,
              --alpha-up, --alpha-down, --alpha-flat, --alpha-warn, --alpha-info,
              --alpha-experimental, --alpha-assumption
component  →  --card-bg, --chip-bg-active, --table-row-hover, --sheet-scrim …
```

Full proposed values live in `DESIGN.md §2`; they are a **starting proposal** to be calibrated against Alpha's current palette — keep the recognisable warm off-white and violet.

### 24.3 Elevation and depth

- Light theme: depth from 1px hairline borders + at most two soft shadow levels (`--elev-1` cards, `--elev-2` sheets/popovers).
- Dark theme: depth from **surface lightness steps** (surface-1/2/3), not shadows.
- Blur/glass only on the sticky header and bottom nav, with an opaque fallback when `prefers-reduced-transparency` or low-end devices are detected.

### 24.4 Status chips (one visual language site-wide)

| Status | Style | Example label |
|---|---|---|
| Live | solid up-tint dot + text | `Live · 15:12 IST` |
| Last close | neutral outline | `Close · 19 Oct` |
| Stale | amber outline + clock icon | `Delayed 2h` |
| Experimental | dashed violet outline | `Experimental research` |
| Assumption | violet outline, italic label | `Your assumption` |
| Under review / corrected | amber solid | `Under review` / `Corrected 22 Oct` |
| Unknown | grey outline | `Not available` |

---

## 25. Layout, grid and page-family blueprints

### 25.1 Grid and spacing

- **Spacing scale (4px base):** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96. No other values in components.
- **Grid:** 12 columns desktop (≥1024px), 8 tablet (768–1023), 4 phone; gutters 24 / 16 / 16; outer margin 32 / 24 / 16.
- **Containers by task:** reading `68ch`; standard `1200px`; data workspace `1440px` (Screen, Map, Compare may go full-bleed with sticky first column).
- **Radius:** 6 (chips, inputs), 10 (cards), 16 (sheets, featured insight). Pills only for filter chips.
- **Density modes:** *Comfortable* (default) and *Compact* (row height 36 → 30px, card padding 24 → 16). Stored per browser/account; never changes data.

### 25.2 Page-family wireframes (implement these first, then apply to all routes)

**Today — desktop (≥1024px)**
```
┌ Header: Alpha  Today  Discover  Research  My Desk        [/ Search ⌘K]  ● Live 15:12 IST  ⚙ ┐
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ TODAY · 21 OCT 2026                                                                          │
│ "Broad selling: 7% of 988 stocks rose; IT the only sector green."   (display-xl serif)      │
│ Snapshot 15:12 IST · Fundamentals as of 19 Oct                       [Open market brief →]  │
├──────────────────────────────┬──────────────────────────────┬────────────────────────────────┤
│ BREADTH  72▲  916▼  0 flat   │ BAROMETER 27 · Cautious ⓘ    │ NIFTY 50  −1.4%  · Close 19 Oct│
│ ███░░░░░░░░░░░░░░░░ 7% / 93% │ ◔ arc  (same snapshot ID)    │ sparkline (1D)                 │
├──────────────────────────────┴──────────────────────────────┴────────────────────────────────┤
│ YOUR NAMES — what changed since your last visit (or first-use: "Add 3 companies →")         │
│ TICKER   PRICE      Δ DAY    WHY IT MOVED (source)            NEXT REVIEW                    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ WORTH A LOOK (Discover)        │ WEEKLY READ (reviewed)        │ NEWS THAT MENTIONS YOUR NAMES │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Today — phone (360–430px)**
```
┌ Alpha        🔍  ⚙ ┐
│ TODAY · 21 OCT      │
│ Broad selling: 7%   │
│ of 988 rose.        │
│ Live 15:12 · F 19Oct│
│ ┌breadth┐┌barom.┐   │  ← horizontally scrollable fact strip, snap points, visible edge fade
│ YOUR NAMES (3)      │
│ ...                 │
├─────────────────────┤
│Today Discover Research Desk More│  ← bottom nav, safe-area padded, 44px targets
└─────────────────────┘
```

**Company — desktop**
```
┌ ← Back to "cheap banks roe>14" (restores filters + scroll)                               ┐
│ TIPSMUSIC · Tips Music Ltd                    ₹612.40  −1.2%  Close 19 Oct · NSE          │
│ (display-l serif)                              [☆ Watch] [⇄ Compare] [⤴ Share card]        │
├──────────────────────────────────────────────┬────────────────────────────────────────────┤
│ THE CASE (3)                                 │ THE COUNTERCASE (3)                        │
├──────────────────────────────────────────────┴────────────────────────────────────────────┤
│ Chart [1M 6M 1Y● 3Y 5Y Max]   legend: values always visible, controls on hover/focus     │
│ ─────────────────────────────────────────────────────────────── linked ↔ financials table │
├─────────── Tabs: Overview · Financials · Valuation · Ownership · Seasonality · Filings ───┤
│ Financial explorer: click any line item → mini-chart of its history + source per period  │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```
Compact context bar (ticker, price, Watch) appears after scrolling past the header — 48px max height, no oversized sticky hero.

**Screen — desktop**
```
┌ DISCOVER / SCREEN                                                                         ┐
│ [ cheap banks roe above 14                                    ] [Templates ▾] [Advanced] │
│ Understood: Sector = Banks (exact) · P/E < sector median · ROE > 14%   Not understood: — │
│ 23 matches of 988 · data 19 Oct      [Save screen] [Share URL] [CSV] [Compare 0/4]      │
├───────────────────────────────────────────────────────────────────────────────────────────┤
│ ☐ │ COMPANY ⇅ │ PRICE ⇅ │ P/E ⇅ │ ROE ⇅ │ … (sticky first column, tabular nums)       │
│ row click → quick-look sheet (240ms) · Enter → company page                             │
└──────────────────────────────────────────── compare tray slides up when ≥1 selected ─────┘
```

**My Desk — desktop**
```
┌ MY DESK · Synced ✓ 2 min ago (or "Saved in this browser only")                            ┐
│ NEEDS REVIEW (from your triggers and real data changes only)                              │
│ WATCHLIST CHANGES │ SAVED SCREENS (new matches) │ RESEARCH CARDS │ JOURNAL               │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

### 25.3 Layout rules

- Above-the-fold on every data page: **takeaway + as-of + one primary action**. No decorative hero.
- One primary filled button per view. Secondary actions are quiet (text or outline).
- Cards only for things that are *objects* (a company, a study, a saved screen). Prose and lists sit directly on the canvas.
- Tables: sticky header and first column; right-aligned numerics; `—` for unknown; row height from density mode; zebra off, hover tint on.
- Long company names truncate with full name in an accessible tooltip and title attribute; never break the price column.

---

## 26. Motion system v2 — "motion explains change and place"

All Part B §7 rules remain (no animated numbers, React owns text, reduced-motion parity, no scroll hijacking). This section adds tokens, navigation continuity and modern native APIs.

### 26.1 Motion tokens (defined once in `DESIGN.md §6`, consumed everywhere)

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 80ms | Press feedback, checkbox |
| `--dur-fast` | 140ms | Hover/focus tint, chip add/remove |
| `--dur-base` | 200ms | Popovers, tabs, small panels |
| `--dur-slow` | 280ms | Sheets, route transitions, FLIP reorder |
| `--dur-flash` | 500ms | Real value-change tint |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Most transitions |
| `--ease-enter` | `cubic-bezier(0, 0, 0.2, 1)` | Elements arriving |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Elements leaving (exit ≈ 70% of enter duration) |
| `--distance-s` | 6px | Popover/sheet offset |
| `--distance-m` | 12px | Tray/editorial entrance |

GSAP timelines read these via a small `motionTokens` export so CSS and JS never drift.

### 26.2 Navigation continuity with native View Transitions (progressive enhancement)

- Same-document View Transitions (`document.startViewTransition`) are now broadly supported across major engines; cross-document transitions are not universal. Alpha is a client-routed Next static export, so use **same-document** transitions around client navigations via a small in-house wrapper. Verify Next 14 router compatibility in preview; if it is unreliable, ship without it — navigation must never wait on animation.
- **Shared elements:** `view-transition-name: ticker-<symbol>` on the ticker label in Screen rows, Watchlist rows and the Company header, so the ticker visibly "travels" into the company page (≤280ms). Names must be unique per page; generate them only for visible rows.
- Root transition: 140ms cross-fade; **no slide** for top-level areas (avoids implying hierarchy that does not exist). Child pages may use a 6px forward/back offset driven by navigation direction.
- `prefers-reduced-motion: reduce` → skip transition entirely (`transition.skipTransition()` or not starting one).
- Focus moves to the new page's `h1` after navigation; announce the page title via the route announcer.

### 26.3 Scroll-linked effects

- Replace decorative IntersectionObserver reveals with CSS scroll-driven animations (`animation-timeline: view()`) **where supported**, with no-animation fallback. Content must be fully visible without the animation.
- Allowed: below-fold editorial fades (≤12px), a reading-progress hairline on Reads, sticky context bar fade on Company.
- Not allowed: parallax on data, pinned scroll sequences, anything that changes scroll speed.

### 26.4 Micro-interaction catalogue (additions to §7 inventory)

| Interaction | Spec | Reduced motion |
|---|---|---|
| Button press | `scale(0.98)` for `--dur-instant`, release `--ease-standard` | Colour change only |
| Watch star | Fill + 1.0→1.12→1.0 scale in 200ms, toast "Saved to My Desk" (or "this browser") | Fill + toast |
| ⌘K palette | Scrim 120ms; panel 6px rise 160ms; results update without animation | Instant |
| Case/Countercase evidence link | Drawer slides 280ms from right (desktop) / bottom sheet (phone) | Instant |
| Tab switch | Underline indicator slides 200ms; content swaps instantly (no cross-fade of numbers) | Instant underline |
| Chart range | Old series fades to 30% while loading; new series draws stroke 240ms after data ready | Instant swap |
| Screen result count | Number updates instantly; a 500ms tint on the count chip | Static chip |
| Compare tray | 12px rise 200ms; reserves layout space to avoid CLS | Instant |
| Skeleton → content | Skeleton matches final dimensions; 140ms fade | Instant |
| Error/retry | Inline message appears with 140ms fade; no shake | Static |
| Sync status | Dot pulses **once** on successful sync (not continuously) | Static tick |

### 26.5 Motion budget and governance

- Max **two** simultaneous motions in the viewport; never animate >24 elements at once.
- Animate only `transform`, `opacity`, `clip-path`, colours. No layout properties.
- Every motion has an owner component, a token, a reduced-motion branch and a cleanup path — enforced in code review checklist (§32).
- Optional settings: Motion = System / Reduced / Off.

---

## 27. AI layer — "Ask Alpha": grounded, cited, humble

Part B A03 (claim validation) and A13 (global quota) are prerequisites. Do not ship any item below until they pass.

### 27.1 Architecture (constrained-claim pipeline)

```
User question + page context (entity, route, selected metrics)
        │
        ▼
1. Intent router (deterministic first): glossary? screen? compare? explain metric? → may answer with NO model call
        │
        ▼
2. Fact assembly: typed facts {id, entity, metric, period, value, unit, sign, source_url, as_of, snapshot_id}
        │
        ▼
3. Model call with JSON schema: returns claims[] = {text_template, fact_ids[], calc?: {fn, inputs[]}} + unknowns[]
        │
        ▼
4. Validator: fact_ids exist & match entity/metric/period; calc fn allow-listed; signs/units preserved;
   unsupported claims dropped; free prose without facts marked "unverified explanation"
        │
        ▼
5. Renderer: numbers/units rendered from facts (never model text); citations as chips → evidence drawer
```

### 27.2 Ask Alpha features (in priority order)

| # | Feature | Where | Grounding source | Gate |
|---|---|---|---|---|
| 1 | **Explain this number** | Any metric popover | That metric's facts + Method definition | A03 passes |
| 2 | **NL screener intent preview** | Screen | Deterministic parser; AI only suggests clause rewrites the user must accept | A04 passes |
| 3 | **Why did it move?** | Company, Your Names | Price change + dated news/filings explicitly mentioning the company (A05) | "No identified cause" is a valid answer |
| 4 | **Compare narrative** | Compare | Aligned-period facts for 2–4 companies | Sector applicability rules |
| 5 | **Watchlist brief** (daily, opt-in) | My Desk | Changes in user's names; filings; review triggers | Account + consent |
| 6 | **Filing digest** | Company → Filings | Text of the specific NSE/BSE announcement supplied to the model; quote ≤ short excerpt with link | Source text retrieved, not recalled |
| 7 | **Challenge my thesis** | Research card | User's thesis + company facts → returns disconfirming *questions* and missing data | Never returns buy/sell |

### 27.3 Response contract (what users see)

- Every sentence with a number has a citation chip; chip opens source, date and value.
- An **"Unknown / not in Alpha's data"** section lists what could not be answered.
- Footer: model-generated label, snapshot time, "Not investment advice — research aid."
- Refusals: personalised buy/sell/target-price requests get a short, polite refusal plus an offer to show the evidence instead.
- No streaming of numbers: stream prose skeleton, then render validated numeric claims at once.

### 27.4 Evaluation suite (CI-blocking for AI changes)

Create `evals/ask-alpha/` with a golden set (target ≥150 cases) covering: correct answers; the three A03 repros; unknown fact IDs; sign reversal; company/period swap; percentage vs percentage points; percentile vs average; banks vs financial services; Federal Reserve vs Federal Bank; buy/sell refusal; prompt-injection text inside a news headline or filing; unavailable model; timeout. Metrics: unsupported-claim rate (target 0 rendered), citation validity 100%, refusal correctness, p95 latency, cost per answer. Store results per model/version.

### 27.5 Operations

Kill switch; global atomic quota (A13); per-user limits when signed in; model availability health check at deploy; no question text in analytics; logs redact entities/notes; cost dashboard.

---

## 28. Pro feature catalogue — prioritised

Every feature needs: user job, navigation home, data/provenance contract, empty/loading/error states, keyboard + touch parity, performance budget, test, success metric (Part B §18 rule).

| Pri | Feature | Inspired by | User job | Build gate |
|---|---|---|---|---|
| P1 | **⌘K / `/` command palette** — companies, pages, saved screens, actions ("Compare TCS INFY", "Go to Heat Lab", "Toggle theme") | Linear | Get anywhere in 2 keystrokes | Shared route manifest (§17); accessible combobox |
| P1 | **Keyboard shortcuts** with `?` overlay: `g t` Today, `g s` Screen, `g d` Desk, `w` watch, `c` compare, `j/k` rows, `[`/`]` tabs | Linear | Speed for repeat users | No conflict with screen readers/browser; can be disabled |
| P1 | **Source-to-filing links** on reported figures | Fiscal.ai | Verify in one click | Provider/exchange link availability per metric |
| P1 | **Case / Countercase** | Fiscal.ai bulls/bears | Balanced first impression | Deterministic rules documented in Method |
| P1 | **Curated screen templates** for Indian equities (e.g. quality at fair value, cash-rich small caps, low-debt compounders, dividend consistency) | Koyfin, Tickertape | Start without a blank box | Each template shows its exact clauses and is editable |
| P1 | **Financial explorer** — click a line item → history chart + per-period source | Koyfin | Spot trend breaks | Period alignment, restatement labels |
| P2 | **Linked views / layout presets** on Company & Compare (Quick look · Deep dive · Compare) | Robinhood Legend | Keep context across panels | Symbol sync tested; reduced-motion |
| P2 | **What changed (30 days)** per company — results, filings, corporate actions, rank changes | Fiscal.ai "What's happening" | Catch up fast | Entity matching (A05) |
| P2 | **Corporate actions & results calendar** with watchlist filter and verified/estimated state | Tickertape, Perplexity earnings hub | Plan reviews | Per-event source + verification state (§5 Calendar) |
| P2 | **Ownership panel** (promoter holding & pledge, FII/DII trends) | Indian research norms | Governance check | Only if a reliable licensed source exists; otherwise omit |
| P2 | **Advanced text query** in Screen (`roe > 14 and debt_to_equity < 0.5`) | Screener.in | Power users | Same parser/validator as chips; errors explained |
| P2 | **Excel/CSV export** with as-of and source rows; formula-injection safe | Screener.in | Offline modelling | §10 CSV guard |
| P2 | **Evidence share cards** (1080×1350, 1200×630) | — | Distribution with context | §11 rules; preview exact fields |
| P2 | **PWA install + offline last snapshot** (read-only, clearly dated) | Native-app feel | Phone access, flaky networks | Cache policy (A12); stale labels |
| P3 | **Watchlist brief (email/digest)** | Perplexity watchlist briefings | Return loop | Consent, unsubscribe, deliverability (§20) |
| P3 | **Alerts on explicit data conditions** (not price targets) | Koyfin alerts | Monitoring | Engine alert safeguards (A15) remain |
| P3 | **Public Alpha data via MCP/API** | Fiscal.ai MCP | Power-user/AI-tool access | Licensing review; rate limits |

**Explicitly out of scope:** brokerage/execution, social feeds, leaderboards, price-target ratings, gamification, invented "AI scores".

---

## 29. Microcopy and voice

**Voice:** a calm senior analyst — precise, plain, never hyped. Short sentences. Verbs first on buttons.

| Situation | Write | Never write |
|---|---|---|
| Primary CTA | "Create your free desk" · "Save to My Desk" · "Compare" | "Unlock alpha now!" |
| Empty watchlist | "No companies yet. Add three you already follow to see what changes." [Add companies] | "0" |
| Signals gate closed | "Alerts are off: the current engine hasn't passed its holdout test. See the checks →" | "No signals today" |
| Loading | Skeleton only; if >3s: "Still loading market data…" | Spinner with no text forever |
| Refresh failed | "Couldn't refresh at 15:14. Showing data from 15:02. [Retry]" | "Error" |
| Unknown value | `—` + SR label "not available" | "N/A", "null", "0" |
| AI uncertainty | "Alpha's data doesn't cover this." | "I think…" |
| Experimental | "Experimental research — not a recommendation." | "Signal: BUY" |

**Forbidden words list (lint in content):** guaranteed, sure-shot, multibagger, can't lose, risk-free, profit lock, best stock, buy now, target price (unless quoting a cited third party).

Headings name the job: "What changed", "Why it ranks", "Main counterpoint", "Next review" (Part B §18).

---

## 30. Inclusive access — Pro additions

All WCAG 2.2 AA requirements in §9 stand. Add:

- **Chart text summaries:** every chart has an auto-generated, deterministic one-sentence summary ("Up 18% over 1 year; low ₹402 on 3 Mar; high ₹655 on 8 Aug") plus a data-table toggle.
- **Colour-blind market mode** (§24.1) and **high-contrast mode** honouring `prefers-contrast: more` and `forced-colors`.
- **Keyboard shortcuts** are discoverable (`?`), disable-able and never single-character in text inputs.
- **Targets:** primary actions ≥44px; dense tables keep ≥24px targets (WCAG 2.2 minimum) with a larger hit area via padding.
- **Language:** `lang="en-IN"`; numbers announced naturally (avoid reading "1,23,456" digit by digit — use `aria-label` with spelled grouping when needed).
- **Cognitive load:** Focus view; progressive disclosure; consistent placement of as-of and source; no auto-advancing content.

---

## 31. Performance budgets — Pro

Targets remain field p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 (§9). Pro adds enforceable budgets (calibrate after measuring baseline; tighten, never loosen silently):

| Budget | Proposed initial limit |
|---|---|
| Route JS (compressed) for Today/Company | Measured baseline −10% target; CI fails at +10% |
| Web fonts on first view | ≤3 files, preload only the display face used above the fold |
| Above-the-fold images on data routes | None required for first meaningful content |
| Long tasks during interaction | None >50ms on Screen sort/filter at 988 rows (mid-range Android profile) |
| Table rendering | Virtualise when >200 rows; `content-visibility: auto` for below-fold sections |
| Screen filtering | Move filtering/sorting of the full universe to a Web Worker if INP target is missed |
| GSAP | Load ScrollTrigger/Flip only on routes that use them |
| Field measurement | `web-vitals` RUM (privacy-safe, no PII), segmented by route and device class |

---

## 32. Quality gates and Definition of Done — Pro

### 32.1 Automated gates (CI)

| Gate | Tooling (use what the repo already has; add minimal) | Blocks merge when |
|---|---|---|
| Types, lint, unit, engine tests | Existing scripts | Any failure |
| **Design lint** | ESLint/Stylelint rules: no raw colours, no off-scale spacing, no ad-hoc `toFixed`, no forbidden words | Violation |
| **Visual regression** | Playwright screenshots: Today, Screen, Company, My Desk, Reads × {360, 768, 1440} × {light, dark} | Unapproved diff |
| **Accessibility** | axe on all route templates + scripted keyboard flows (dialog trap, sort, ⌘K) | Serious/critical issue |
| **Numeric integrity** | DOM text = aria-label = data; breadth sums; percent denominators (A01) | Mismatch |
| **Motion** | Reduced-motion run; unmount-during-tween; hidden-tab test | Error or stuck state |
| **AI evals** | §27.4 suite | Any rendered unsupported claim; citation validity <100% |
| **Route/universe parity** | Sitemap = validated symbol set; all manifest routes reachable (A11, §17) | Missing routes |
| **Bundle/perf** | Size budget + lab perf check on preview (lab only — never reported as field data) | Over budget |

### 32.2 Definition of Done (every PR touching UI)

- [ ] Uses only semantic tokens; light, dark and every accent checked
- [ ] Loading, empty, partial, stale, error states implemented
- [ ] Keyboard + touch parity; focus visible; no hover-only information
- [ ] Reduced-motion branch; cleanup on unmount
- [ ] Every number via `format.ts`, with provenance (entity, unit, period, snapshot)
- [ ] 360px and 1440px screenshots attached; no body overflow
- [ ] Copy follows §29; no forbidden words
- [ ] Tests added; `AUDIT_IMPLEMENTATION.md` updated with evidence

---

## 33. Execution plan — Pro waves (extends Part B §12 Waves 1–4)

| Wave | Name | Contents | Exit criteria |
|---|---|---|---|
| **0** | Baseline | Commit/deploy identity; route inventory; screenshots at 6 widths; bundle sizes; field/lab baselines; current tokens extracted | `docs/qa/baseline.md` committed |
| **1–4** | Part B waves | Correctness → coherence → product & motion → launch (Part B §12, §15–§20) | Part B gates recorded |
| **5** | Pro design system | `DESIGN.md` tokens in code; `format.ts`; type scale; status chips; table conventions; design lint; Storybook-style component gallery route **only in preview** (or existing tooling) | Design lint green; visual baselines approved |
| **6** | Pro decision UX & motion | Decision Ladder on Today/Company/Screen/Compare; Case/Countercase; research-card fields; ⌘K + shortcuts; View Transitions + shared ticker element; financial explorer; curated templates; source-to-filing links | Walkthrough evidence per rung; a11y + motion gates green |
| **7** | Pro AI & growth | Ask Alpha features 1–4 behind flag; eval suite; watchlist brief (opt-in); PWA; share cards; RUM | Eval thresholds met; kill switch tested; privacy review notes |

Do not start Wave 5 visual rollout across all routes before the four representative layouts (Today, Screen, Company, My Desk) are reviewed at phone and desktop widths (Part B §19).

---

## 34. CONSOLIDATED CLAUDE CODE MASTER COMMAND (use this one)

This supersedes the separate prompts in §13, §19 and §20 by combining them; those sections remain as detail. The same text ships as `.claude/commands/alpha-pro.md` so it can be run as `/alpha-pro <wave>`.

```text
ROLE
Act as principal product engineer, design-systems lead, financial-data QA lead, accessibility
reviewer, motion designer and AI-safety engineer for alpha.askakshay.com.

READ FIRST (do not edit code before finishing)
1. docs/alpha/ALPHA_PRO_HANDOFF.md — all of Part A (§0, §21–§35) and Part B (§1–§20).
2. docs/alpha/DESIGN.md — canonical tokens and component rules.
3. The repository's AGENTS.md / CLAUDE.md, package scripts, lockfile, CI workflows and any skills.
Establish the current commit and production baseline. The audit used commit 6024d45 and live
observations on 21 Oct 2026; re-verify every finding against current source and record
resolved/stale items rather than re-applying changes.

GOAL
Turn Alpha into a world-class, calm, trustworthy Indian-equity research desk: every number
traceable, every page serving Glance → Understand → Verify → Record, keyboard-fast and
touch-perfect, with motion that explains change and place, and AI that answers only from
typed, cited facts. Preserve the warm editorial identity (Instrument Serif + Inter Tight,
warm canvas, violet as functional accent), all URLs, local/exported data, transparent
methodology and paper-only engine boundaries.

NON-NEGOTIABLES
- Correctness before beauty: Part B P0 items (A01, A02, A03, A10, A11) ship before any Pro visual work.
- React owns text; never animate numeric values; final values render immediately.
- Every displayed metric carries entity, unit, period, source and snapshot; numbers only via src/lib/format.ts.
- Brand colour ≠ market meaning; semantic tokens only; contrast checked in every theme × accent.
- AI: constrained claims → validator → numbers rendered from facts; unsupported claims withheld;
  no buy/sell/target advice; kill switch and global quota before public exposure.
- No scroll hijacking, parallax on data, particle backgrounds, confetti, fake social proof,
  manufactured urgency, or a second animation framework without measured need.
- Never request or print secrets. Never deploy production without the owner's separate instruction.
- Never claim error-free, profitable, compliant, viral, or a performance score you did not measure.

EXECUTION (wave argument: $ARGUMENTS — if empty, run "status" then propose the next wave)
- status : summarise AUDIT_IMPLEMENTATION.md, open gates, blocked items; change nothing.
- 0 : baseline (§33 Wave 0).
- 1 : correctness — A01, A02 (+upstream trace), A03, A05, A10, A11, A14, A15, A16.
- 2 : coherence — A04, A06–A09, A12, A13; shared snapshot/provenance contract; dialog primitive; states.
- 3 : product & motion — §4–§7, §17–§18 route plan, IA, page families, motion contract.
- 4 : launch — §11, §15, §16, §20 (auth, sync, SEO, sharing, mobile matrix, infra verification).
- 5 : Pro design system — §23–§25, DESIGN.md in code, format.ts, design lint, visual baselines.
- 6 : Pro decision UX & motion — §22, §26, §28 P1 items (⌘K, shortcuts, Case/Countercase,
      financial explorer, templates, source-to-filing, View Transitions with shared ticker).
- 7 : Pro AI & growth — §27 (features 1–4 behind a flag + eval suite), §28 P2 items, RUM.
- all : run waves sequentially; stop at the first wave whose exit criteria fail and report.

METHOD FOR EACH WAVE
1. Plan: list findings/features, files, risks and tests in AUDIT_IMPLEMENTATION.md before coding.
2. Build on a working branch; small reviewable commits referencing IDs (A01, §26.2, …).
3. Design first for Today, Screen, Company, My Desk at 360px and 1440px; then roll out.
4. Verify with the repo's real scripts (typecheck, lint, unit, engine tests, build, audit) and the
   §32 gates; test the Worker-served build, not only next dev.
5. Record PASS / FAIL / BLOCKED / NOT RUN with evidence; separate physical devices from emulation,
   fixtures from live data, source review from live verification.

DELIVERABLES PER WAVE
Code + tests; updated AUDIT_IMPLEMENTATION.md; before/after screenshots (phone + desktop, both
themes); docs/qa/* and docs/operations/* updates as applicable; a short report:
Changed · Tested (actual results) · Blocked (smallest action to unblock) · Next wave recommendation ·
preview URL and artifact identity when prepared.
```

---

## 35. References consulted for the Pro edition (21 October 2026)

Pattern references only; re-verify before relying on any specific detail.

- Koyfin — stock screener and custom dashboards feature pages: https://www.koyfin.com/features/stock-screener/ · https://www.koyfin.com/features/custom-dashboards/
- Fiscal.ai — product overview (source-to-filing auditability) and user guide (Bulls Say vs Bears Say, What's Happening): https://fiscal.ai/ · https://fiscal.ai/blog/ultimate-guide-to-using-fiscal-AI/
- Perplexity Finance — product page and independent review noting calculations still need checking: https://www.perplexity.ai/finance · https://www.findmymoat.com/tools/perplexity-finance
- Tickertape screener and home: https://www.tickertape.in/screener/equity · https://www.tickertape.in/
- Screener.in vs Tickertape comparison (independent): https://stock360s.com/blogs/screener-vs-tickertape-vs-stock360s-stock-research.html
- Robinhood Legend — layouts and widget linking: https://robinhood.com/us/en/legend/
- TradingView — chart legend redesign: https://www.tradingview.com/blog/en/the-new-chart-legend-redesign-14700/
- Linear — UI redesign write-up: https://linear.app/now/how-we-redesigned-the-linear-ui ; third-party token analysis: https://designmd.cc/benchmarks/linear
- Vercel Geist — font (SIL OFL) and table guidance: https://github.com/vercel/geist-font · https://vercel.com/geist/table
- MDN — View Transition API: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- Part B references (§14, §20) remain applicable: GSAP matchMedia and accessibility, web.dev Web Vitals, WCAG 2.2, Cloudflare static-asset headers, Next.js static exports, Google SEO Starter Guide, OWASP Authentication Cheat Sheet.

---
---

# PART B — ORIGINAL AUDIT AND MANDATORY SCOPE (sections 1–20, preserved)

> Preserved from `Alpha_Claude_Handoff.txt` without weakening any requirement. Where Part A adds detail (tokens, motion tokens, AI pipeline, features), Part A governs the *how*; Part B still governs the *what must be true*. The prompts in §13, §19 and §20 are consolidated into §34.


**Original title:** Alpha — expert product, motion and production audit

**Site:** https://alpha.askakshay.com/  
**Reviewed:** 21 October 2026 (Malaysia date)  
**Source baseline:** supplied `alpha-askakshay-build(1).md`, identifying commit `6024d45`; 149 embedded source/config files extracted for inspection.  
**Deliverable:** findings and implementation brief, not a deployment or a claim that fixes have been applied.

**Expanded implementation edition:** mobile/device QA, production verification, reorganized navigation and luxury presentation requirements added at the owner’s request. Sections 15–20 are mandatory implementation scope, including launch-ready signup, persistent feature use, SEO and sharing. Pending verification remains pending until Claude records actual evidence.

## 1. Executive judgment

**Keep the visual identity. Repair the evidence system. Simplify the research journey. Add motion where it explains a change.**

Alpha already has a recognizable identity: warm off-white, Instrument Serif headlines, violet emphasis, pastel task cards, a dark market panel, compact market data, and a coherent dark theme. It is substantially beyond a generic template. It also already has GSAP, scroll reveals, a sliding navigation indicator, animated numbers, chart strokes, theme transitions and update flashes. More effects alone will not make this a better product.

The largest weakness is that independently developed features do not always agree. A number can be correct in React's accessibility label but wrong in its visible text. A current barometer badge can sit above an older market interpretation. Natural-language intent can be broadened silently. Machine-written research can contain elementary numerical and conceptual errors. These failures undermine the credibility of the entire interface.

Recommended positioning: **“Your daily Indian-equity research desk: what changed, what supports the view, and what still needs checking.”** Make the research workflow the product. Keep experimental signals clearly identified as research.

### Priority order

| Priority | Deliverable | Why it comes first |
|---|---|---|
| P0 | Correct rendered numbers, misleading research text, company matching, and release safety | A polished financial interface must not make incorrect information more convincing |
| P1 | One data/provenance contract; accessible dialogs and sorting; coherent page journeys | Removes contradictions and makes existing features usable |
| P2 | Refined layout, controlled motion, shareable evidence cards, stronger onboarding | Makes the product distinctive and easier to return to |
| P3 | Paid workflow features and broader AI assistance | Depends on reliable data, retention evidence and operational controls |

No audit can certify an “error-free” website. The practical target is a measured release gate, observable failures, and a tested rollback.

## 2. Scope and evidence boundaries

### What was inspected

Live browser content across 19 route templates: Today, Brief, Markets, Screen, Heat Lab, Rotation, Signals, Trades, one company page (TIPSMUSIC), Reads, IPO, Funds, News, Compare, Calendar, Tools, Watchlist, Journal and Method. Desktop screenshots were inspected for Today in both themes, Screen and the company page. The screener example query and instrument dialog were interacted with. Relevant data, motion, UI, AI, engine and deployment source was inspected from the attachment.

A local execution of the supplied `checkAnswer()` function reproduced three validation failures. Browser DOM inspection established a visible-number/accessibility-label mismatch. Keyboard interaction reproduced focus escaping an open modal.

### What is not claimed

- This is route-template coverage, not a click-by-click certification of every control, every historical study, or all 988 companies.
- No mobile device matrix, screen-reader session, Lighthouse run, field Core Web Vitals collection, load test, authenticated infrastructure inspection or penetration test was completed.
- The attachment omits the lockfile, generated feeds, images and some documentation. A reproducible full production build was not run.
- Direct HTTP header requests from the execution environment returned 403, although the browser could render the site. This is not proof of a site outage or a bot block; deployed header correctness remains unverified.
- Prices, IPOs, fund figures and dates were observed as site output, not independently certified against exchanges.
- Backend findings describe the supplied snapshot; deployment parity with that commit must be checked before editing.

Evidence labels below: **LIVE** = observed rendered behavior; **SOURCE** = supplied code; **REPRO** = locally reproduced pure-function behavior; **PROPOSAL** = recommended product change.

## 3. Verified defects and material source risks

### A01 — P0: animated breadth counts can remain wrong

**Evidence: LIVE + SOURCE.** The homepage displayed 152 rising and 819 falling alongside a 988-stock universe and approximately 7% rising / 93% falling. This persisted beyond the entrance animation. A later DOM inspection showed the rising count's visible text was `152` while its `aria-label` was `72`. At that point the declining value was 916. The displayed counts could therefore exceed the universe.

**Likely cause:** `src/components/ui.tsx`, `CountUp`, directly overwrites React-managed `textContent`; its effect cleanup writes an earlier captured value and `done.current` prevents a fresh animation. `src/app/page.tsx` uses it for breadth counts while percentage labels use current state.

**Fix:** remove count-up interpolation from market facts. Render the exact value declaratively and use the existing `Flash` treatment around it. If a decorative count-up is retained elsewhere, isolate it from React's authoritative text and cancel/reconcile it correctly on updates.

**Acceptance:** after initial data, a second dataset, rapid refresh, navigation, hidden-tab restoration and reduced-motion changes: visible count = accessible count = data count; up + down + flat = counted; percentage denominator matches counted. Never animate a price, return or breadth count through invented intermediate values.

### A02 — P0: weekly research contains objectively incorrect prose

**Evidence: LIVE, `/reads/`, SBI Funds study dated 17 October.** A 69.9% net margin is described as roughly seven paise retained from each rupee. Correct arithmetic is approximately 69.9 paise. The study also describes a 48th historical percentile as slightly above a historical average. A percentile does not establish the arithmetic average; 48th is below the median rank.

The study additionally blends asset-manager revenue, fund portfolio cash flows and capital employed in ways that require primary-filing review. Do not correct these business-model assertions with another free-form generation alone.

**Fix:** quarantine or mark affected studies as under review; preserve a correction log. Validate every generated quantitative statement against typed facts and deterministic unit conversion. Require primary sources for business-model statements. Add an explicit review status separate from “machine-written.” The upstream weekly-read generator is outside this repository: trace and fix it in the feed-producing project, then regenerate affected publications with versioned corrections.

**Acceptance:** corpus checks catch percent-to-paise errors, percentage/percentage-point confusion, percentile/average confusion, sign reversal, mismatched time periods and unsupported causal claims. If an assertion lacks evidence, omit it or label it unknown.

### A03 — P0: AI number validation does not establish factual correctness

**Evidence: SOURCE + REPRO, `worker/explain.js`.** Given facts ROE = 20% and Growth = −25%, all these answers returned an empty list of unverified numbers:

```text
ROE is 9% [F1].
Growth is 25% [F2].
Revenue grew 20% [F1].
```

The checker exempts small integers, permits an absolute-value match that loses signs, and matches numbers globally rather than against the cited fact and metric. A made-up citation is also not validated as a supporting relationship. The frontend currently displays answers with unmatched numbers and a warning.

**Fix:** have the model return a constrained claim structure referencing existing fact IDs. Render numeric values and units from the server's facts, not model prose. Validate entity, metric, period, sign, unit and citation membership. Calculations must use explicitly allowed deterministic functions with referenced inputs. Withhold unsupported claims. Treat free-form qualitative explanation as unverified unless its source supports it.

**Acceptance:** the three repros fail validation; unknown fact IDs fail; swapped companies/periods fail; valid percentages and currency formatting pass. Keep the static glossary usable when AI is unavailable. Validate the configured model against the provider's actual available models during setup; a secret's presence alone is not a health check.

### A04 — P1: “banks” means Financial Services in the screener

**Evidence: LIVE + SOURCE.** Clicking `cheap banks roe above 14` yielded a Financials clause and results including ANANDRATHI, BSE, GROWW and NAM-INDIA. `src/lib/nl.ts` groups banks, NBFCs, insurers and financials into the same sector rule.

**Fix:** separate industry/entity classes; use exact bank membership where supported. If the feed cannot identify banks reliably, show “Bank classification unavailable” and offer an explicitly labeled broader Financial Services search. Never broaden silently.

**Acceptance:** bank queries exclude exchanges, asset managers and wealth managers; “financial services” may include them. Explain recognized clauses and unresolved intent before showing results. Current clause chips and excluded-data notices are good foundations.

### A05 — P1: false company association in News

**Evidence: LIVE + SOURCE.** A gold/Federal Reserve story displayed FEDERALBNK. `src/lib/newsdesk.ts` permits a unique large company's first word to match; “Federal” is not excluded by its generic-word list.

**Fix:** use curated entity aliases with disambiguation, exact tickers and full legal/trading names. Require stronger evidence for ordinary words and institution names. Distinguish “company explicitly mentioned” from a proposed thematic connection. Display the matching phrase and confidence basis.

**Acceptance:** Federal Reserve does not resolve to Federal Bank; Reserve Bank of India does not resolve to Bank of India; ambiguous words produce no company attachment. Test headlines and summaries together, including negative examples.

### A06 — P1: freshness badges and market interpretations can refer to different snapshots

**Evidence: LIVE + SOURCE.** Today/Brief showed barometer 27 while Markets' stance showed 35. Markets also displayed a current 21 October barometer badge. The stance's footnote dated its screen inputs to 19 October, so the older figure is not necessarily wrong, but the visual grouping suggests one current reading. `MarketStance` in `AiTools.tsx` uses the published feed while live barometer consumers use `useBarometer`.

**Fix:** either use the same live snapshot everywhere or explicitly title the older panel “Last completed-session stance — 19 October.” Attach metadata to each value/panel, not a page-wide badge that implies all content shares a date. Maintain a clear split between live prices and closed-session fundamentals.

**Acceptance:** one snapshot ID produces identical values on Today, Brief, Markets and AI facts; deliberately different snapshots have prominent dates and labels.

### A07 — P1: modal keyboard focus escapes behind the overlay

**Evidence: LIVE + SOURCE.** Opened the Nifty 50 instrument dialog on Markets, then pressed Shift+Tab from Close. Focus moved to the background footer's Method & sources link. `InstrumentSheet.tsx` implements initial focus, Escape and restoration, but no containment or inert background.

**Fix:** use a shared accessible dialog primitive with portal, focus containment, background inertness, focus restoration, scroll locking and predictable nested-dialog behavior. Audit Search, quick-look sheets, mobile menu and chart popovers against the same contract.

**Acceptance:** Tab and Shift+Tab remain inside the modal; Escape closes only the active dialog; focus returns to its actual trigger; background content cannot be operated while modal.

### A08 — P1: screener sorting is mouse-only in source

**Evidence: SOURCE, `src/app/screen/page.tsx`.** Sort handlers are attached to `<th>` elements without a focusable button or keyboard handler. `aria-sort` alone does not make sorting operable.

**Fix:** put a real button inside each sortable heading; preserve table semantics and announce the new sort. Keep focus in the same header after sorting. Prefer stable rows and restrained transitions.

### A09 — P1: multi-select Watch risks losing selections

**Evidence: SOURCE.** Screen invokes `picked.forEach(addWatch)`. `useStoredList` in `src/lib/store.ts` calculates each update from the render's captured `list`, so batched additions can overwrite one another. This was not separately exercised live.

**Fix:** use the existing batch-add operation for the whole selection or a correctly designed store using functional state updates. Persist the complete final list, show storage failures and synchronize mounted consumers.

**Acceptance:** selecting three names adds all three once; rapid add/remove preserves unrelated names; two tabs reconcile predictably; storage-full errors do not show a misleading “saved” state.

### A10 — P0 release risk: scheduled deploy is not tied to the tested commit

**Evidence: SOURCE, `.github/workflows/deploy.yml`.** Scheduled deployment checks the newest completed CI conclusion, then checks out the scheduled event's SHA. A newer commit can be pending or untested while an older completed CI is green. Manual deployments also take a build-only path. The workflow-run path correctly uses the completed run's head SHA.

**Fix:** deploy an immutable artifact from the exact tested commit. If a data refresh rebuilds it, validate that exact build and its feed manifest before promotion. Separate code approval from validated data updates without trusting a previous commit's result. Run the link/schema audit on every deploy path. Block stale queued releases from rolling production backward.

**Acceptance:** pending/failed/unrelated CI cannot authorize a release. Record commit, data snapshot hashes, build ID, test run and asset digest. Rehearse rollback to a known artifact.

### A11 — P0 release risk: degraded sharding can erase company routes

**Evidence: SOURCE.** `scripts/shard.mjs` catches failed required feed retrieval and permits continuation. On a clean build, empty shards mean `generateStaticParams()` generates no company routes. CI checks fixed pages but does not enforce company-universe completeness. The script's fallback comment cannot restore a static route that was never emitted.

**Fix:** require a validated current snapshot or an explicitly bounded last-known-good snapshot. Build shards in a temporary directory, validate them, then replace atomically. Fail release if required company routes disappear unexpectedly. Do not treat a numerical minimum alone as correctness: compare symbol sets and validate known removals/additions.

**Acceptance:** upstream outage cannot publish an empty company universe. Sitemap and generated routes match the validated symbol set. Preserve the previous release on failure.

### A12 — P1: several caches have no lifecycle policy

**Evidence: SOURCE.** `src/lib/data.ts` memoizes successful fetch promises for the tab lifetime. Instrument detail memoization stores null after failure and does not evict it. Some live hooks refresh independently, creating a mixture of current and indefinitely retained state.

**Fix:** define endpoint-specific TTLs, cancellation, bounded timeouts, retry/backoff, stale-while-revalidate and visibility restoration. Retain last-good values with explicit age and failed-refresh state. Evict failed instrument requests so Retry actually retries.

**Acceptance:** a long-lived tab crosses the close and next session correctly; failed first requests recover; an older response cannot overwrite a newer response; route changes preserve useful cached data without keeping it forever.

### A13 — P1: AI daily ceiling is per isolate, not global

**Evidence: SOURCE.** `overDailyCeiling()` increments module-local state. Cloudflare's configured per-address rate limit and provider spend limit are useful, but this counter does not enforce a global daily application budget. The source comments acknowledge isolation; the build guide's summary is too broad.

**Fix:** if AI is enabled publicly, add an atomic shared quota/accounting mechanism and provider budget enforcement, bounded concurrency and a kill switch. Same-origin headers prevent some browser abuse, not direct-client spending. Keep secrets server-side and avoid storing private questions in routine logs.

### A14 — P1: “profit lock” copy overpromises execution

**Evidence: LIVE + SOURCE.** Method copy says reaching T1 prevents a winning trade from turning into a loss. Yet the engine correctly supports a gap through the stop exiting at the open. A sufficiently adverse gap can erase the partial realized gain.

**Fix:** say “The remaining stop is raised above entry; gaps and execution costs can still reduce or reverse the overall result.” Rename absolute “maximum loss” language in tools to “planned loss if filled at the stop.” Preserve the simulator's gap behavior.

### A15 — P1 research-control risk: results are not bound to the active engine

**Evidence: SOURCE, `engines/swing_run.py`.** Alert eligibility reads the research JSON's holdout t-statistic without checking that its version/parameters/data manifest match the running engine. This is a future false-eligibility risk, not a claim that current alerts are on.

**Fix:** bind eligibility to engine hash, parameters, universe definition, research protocol and approved result version. Reject non-finite statistics. New rules invalidate old eligibility. Keep alerts off while validation is incomplete.

### A16 — P1 research ambiguity: same-day stop changes need an explicit execution policy

**Evidence: SOURCE.** `walk()` checks the existing stop before T1, then raises the stop after T1 without checking the raised stop again on that bar. Daily OHLC cannot establish whether the low occurred before or after T1. This may be a reasonable next-session activation assumption, but the public wording does not make that clear.

**Fix:** declare stop activation timing explicitly. Use intraday evidence if immediate activation is intended; otherwise model a documented conservative ambiguity policy or next-session order activation consistently in live paper tracking and backtest. Add test cases for a bar crossing T1 and the new stop, and for gaps through both targets. Also check whether the 2–8% risk gate must be re-evaluated on actual entry rather than only signal close.

## 4. Visual direction and information architecture

### Preserve

- Serif headlines for editorial statements; Inter Tight for controls and data.
- Warm light canvas and restrained dark theme.
- Violet as brand/navigation accent; green/red reserved for market direction.
- Data dates, explicit missing values, transparent methodology and paper-trading disclosure.
- Search, saved screens, compare, research cards and local export/import already present.

### Improve

1. **Less repeated framing.** Headline, eyebrow, data badges and multiple onboarding cards currently consume considerable height. For repeat visitors, show the research surface sooner. Keep first-visit help collapsible.
2. **Replace decorative zeroes.** A prominent zero on Signals or Watchlist looks like an empty product. Use a meaningful state label and one useful next action: “Gate closed — see failed checks” or “Build your first watchlist.”
3. **Choose one primary task per page.** The homepage is a desk overview; Screen is a filtering tool; Company is an evidence brief. Avoid making all three equal-density dashboards.
4. **Readable hierarchy.** Aim for 14–16px data/controls and 16px reading text; reserve smaller labels for genuinely secondary metadata. Define measurable contrast targets in every theme and accent, rather than assuming pastel combinations work.
5. **Consolidate tokens.** One spacing scale, three card radii at most, restrained shadows, explicit semantic color tokens and component variants. Migrate high-change components to scoped styles; the 1,314-line global stylesheet already has documented collision history.
6. **Keep context with the number.** Put as-of period, source and definition in a compact popover adjacent to each metric. A long Method page is useful documentation, but should not be required to understand a score.
7. **Separate research confidence from attractiveness.** A high quality percentile, a passed checklist, and an experimentally validated signal are different concepts. Do not style them as interchangeable green endorsements.
8. **Clarify “Vetted.”** TIPSMUSIC showed “Vetted 9/9,” while its research summary showed 8/9 and weak value. These may be different checklists. Give each a specific name and explain its denominator; reserve “reviewed” for actual editorial review.

### Proposed navigation

Keep four main tasks but expose clear destinations: **Today / Discover / Research / My Desk**. Methods remains a utility link. Research should open a real overview or Company/Compare workflow; the current Analyze entry goes directly to an empty paper trade book. Put experimental Signals and Paper Trades beneath Research. Preserve all old URLs and redirects.

Returning-user loop: Today → meaningful change → company evidence → compare → saved research question → later change review. No forced account creation before value.

## 5. Route-by-route upgrade plan

| Route | Existing strength / observed state | Improvement to implement | Completion check |
|---|---|---|---|
| `/` Today | Clear editorial headline; live breadth and practical links | Fix A01; surface “What changed / Your names / Market context”; compact repeat-visit tiles; label live vs last close | All top facts reconcile; first useful action visible without scrolling at target mobile widths |
| `/brief/` | Copyable read, weekly movers and historical seasonality | Separate Today and Week sections; attach source dates to each paragraph; show rank-change causes; explicitly historical seasonal sample | Copy/share retains dates, sample sizes and limitations |
| `/markets/` | Multi-asset board with detailed instrument sheets | Fix A06/A07; group by session state; add pinned instruments; consistent yield basis-point units in both card and sheet | Closed markets are not implied stale solely by wall-clock age; card/detail units agree |
| `/screen/` | Rich filters, transparent parsed clauses, CSV and compare | Fix banks, bulk Watch and keyboard sort; collapse advanced controls; show pending rather than “0 matches” while loading; save all filter state in URL | Shared URL reproduces query, clauses, sort and columns; no query broadening without notice |
| `/company/<slug>/` | Strong chart, financial tabs and scorecards | Add compact thesis/evidence/risks row; reconcile checklist labels; show value weakness as a trade-off; make every metric's date obvious | Price, chart and snapshot labels explain differences; all tabs keyboard-operable |
| `/map/` | Multiple measures and accessible text alternative | Label selected 150-stock view vs full 988-stock universe; sticky legend; minimum readable tiles; drill-down breadcrumb; table toggle | Color/size/group each have explicit meaning and missing-data counts |
| `/rotation/` | Strong differentiator: quadrants, history and playback already exist | Separate NSE indices from synthetic groups; show constituents/coverage; label partial week next to slider; selective trail emphasis | No implication that relative strength measures capital inflows; playback is opt-in and pausable |
| `/engines/` | Negative holdout and disabled alerts disclosed | Lead with “Experimental research — alerts disabled”; separate development, holdout and forward record; show version-linked eligibility | Historical and forward results cannot be confused; no performance-based sales claim |
| `/trades/` | Paper-only accounting and rule explanation | Empty-book layout instead of empty chart/table; stronger Paper book title; explicit provisional/settled execution distinction | Intraday marked status is never presented as a broker fill |
| `/reads/` | Publication snapshot vs latest price is useful | Correct A02; add editorial validation gate, citations and corrections; stable article URLs; reading layout with 65–75 character lines | Every published study has review status and source manifest |
| `/ipo/` | Separates active books, closed issues and observed listings | Add per-issue official source link, lot/minimum amount only when verified; make return baseline visible beside each bar | No confusion between issue-price listing gain and first-close-to-latest return |
| `/funds/` | Shows drawdown and holdings, not just returns | Category benchmark, rolling periods and common as-of dates; verified expense ratio when available; distinguish stale NAV from fresh holdings | Ranking ties/missing periods explained; no “best fund” conclusion from one trailing return |
| `/news/` | Saved/unread filters and source attribution | Fix entities; cluster duplicate events; separate explicit mentions from context; optional Indian/watchlist relevance | Federal Reserve negative test passes; attributed summaries preserve original links |
| `/compare/` | Good ready-made sets and up-to-four layout | Highlight only meaningful metric differences; sector-aware applicability; aligned periods; one action to save a comparison | No universal “winner” for metrics that depend on sector or valuation context |
| `/calendar/` | Honest unverified-date label | Per-event verified/estimated/unverified state, official link and last check; watchlist filter; timezone-aware export | Unverified estimates never become confirmed reminders without clear labeling |
| `/tools/` | Useful working shown for position size, EV, DCF and SIP | One tool at a time with direct URLs; scenario presets; stress gaps/costs; validation and reset; separate assumptions from evidence | Invalid inputs cannot yield NaN/Infinity; calculated loss is not a guarantee |
| `/watchlist/` | Browser-private with export/import and research cards | One-tap add; change review; visible save status; deduplicated bulk add; optional future sync | Export/import round-trip preserves all cards; failure never silently discards data |
| `/journal/` | Captures took/skipped/watching decisions | Record planned time horizon and review date; preserve original thesis; make comparison groups descriptive | Different entry dates/holding periods do not masquerade as causal strategy evidence |
| `/about/` | Unusually extensive working and source explanations | Break into navigable concise modules; fix profit-lock claim; publish corrections/status; provider-by-metric links | Every linked anchor exists; outdated engine references are removed or versioned |

## 6. PromptMotion reference: what to borrow and what to reject

The exact requested site, https://promptmotion.com/, currently presents a premium domain acquisition landing page. Its “platform potential” is aspirational; it is not evidence of a functioning motion-generation product or a production component library. Its five sample prompts concern product reveals, scenic parallax, geometric motion intros, liquid-metal logo morphing and animated social stories.

| PromptMotion idea | Appropriate Alpha adaptation | Where not to use it |
|---|---|---|
| Cinematic product reveal | An optional short launch video showing Today → Screen → Company → saved research | Never a blocking website intro or a delay before prices |
| Layered parallax scene | Very restrained depth in an optional marketing illustration, with static fallback | Never tables, charts or scrolling financial text |
| Geometric shapes / professional typography | A brief brand-mark transition or section-divider treatment | Never continual movement in the research surface |
| Liquid-metal logo morph | At most an experimental promotional video asset | Avoid it in the app; it conflicts with Alpha's legible editorial character |
| Animated social story | A dated market evidence card with sequential reveal, final static state and source | Never implied predictive certainty, profit celebrations or invented live activity |

The motion specifications below are original recommendations for Alpha, informed by that reference and the actual code. They are not claimed to be downloadable PromptMotion presets.

## 7. Motion system: precise implementation specification

### Existing motion to improve, not duplicate

`src/lib/motion.ts` already registers GSAP, ScrollTrigger and Flip, checks visibility/reduced motion, provides pointer lighting and theme fading, and observes section reveals. `ui.tsx` has chart draw, bars, segmented controls, Flash, ChangeRing and CountUp. CSS provides sheet entrance and mobile-navigation motion. Rotation already has playback. Build one governed system from these components.

### Timing and behavior contract

- Feedback: 100–160ms; small control transitions: 160–220ms; panels/layout: 220–320ms.
- Below-fold editorial entrance: at most 8–12px, 240–320ms, once per view. Never hide critical above-fold content awaiting animation.
- One-time stagger: 25–40ms, capped so the whole group completes within about 450ms. Do not stagger 988 rows.
- Use transforms and opacity for movement; avoid layout thrash and permanent `will-change` on hundreds of elements.
- Final financial values appear immediately. Motion indicates that something changed, not the numerical path it supposedly took.
- React owns authoritative text. GSAP owns isolated visual transforms and must be cleaned up on unmount/navigation.
- Respect runtime changes to reduced motion, not just the initial setting. GSAP `matchMedia`/context cleanup is appropriate here.
- Hidden tabs stop decorative loops and pause polling where appropriate. Return to visibility reconciles the latest data first.
- Provide an optional “Motion: system / reduced” preference. Reduced motion retains all state information through text and icons.

### Motion inventory

| Motion | Place / trigger | Specification | Reduced-motion behavior | Priority |
|---|---|---|---|---|
| Navigation indicator | Route selected | Move existing indicator in ~180ms; content navigates immediately | Instant active state | P1 refinement |
| Search surface | Search/⌘K | Backdrop fade 120ms; panel opacity + 6px translation 180ms | Instant dialog | P1 with focus fix |
| Real quote update | New valid snapshot | Existing Flash: subtle tint for 400–600ms; stable tabular digits | Instant exact number, short static change cue | P0 correctness first |
| Breadth balance | New same-session snapshot | Counts update immediately; bar transform settles in 220ms | Instant bar and text | P0 |
| Barometer | New snapshot | Arc transitions 250–300ms, score text exact; date stays attached | Instant final arc | P2 |
| Filter chips | Add/remove recognized clause | 140ms opacity/scale 0.98→1; announce new result count once | Instant chip | P1 |
| Screen reordering | User explicitly sorts | FLIP only visible subset, ~220ms; keep keyboard focus; no live background reshuffle | Instant reorder | P2 |
| Compare tray | First company selected | Bottom tray enters 12px over 200ms; reserved safe-area space | Instant tray | P2 |
| Company quick look | Row activated | Existing portal sheet refined to ~240ms; reverse exit; focus containment | Instant accessible dialog | P1 |
| Chart range change | User selects range | Crossfade 120–180ms after new series ready; keep axes and loading state honest | Instant chart swap | P2 |
| Chart crosshair | Pointer/keyboard | Immediate tracking; no easing that lags behind data | Same | P1 |
| Score explanation | Metric opened | Small disclosure expands 180ms; source and definition first | Instant disclosure | P2 |
| Map drill-down | Sector selected | Stable-ID FLIP ~280ms only when manageable; breadcrumb updates immediately | Replace view, preserve focus | P2 |
| Map measure change | User chooses color metric | Color transition ~180ms with legend updated simultaneously | Instant colors | P2 |
| Rotation history | User presses existing Play | Optional one step per 600–900ms, visible date, Pause and keyboard step; no autoplay | Manual stepping | P2 refinement |
| Watch/save | Successful local persistence | Star fill/tick 120ms plus “Saved in this browser”; failure shows explicit error | Same confirmation without movement | P1 |
| Research card share | User requests export | 200ms preview entrance; reveal date/source/risk labels; final image is static | Instant preview | P2 |
| News filters | User selects source/theme | 120ms fade of results; avoid cards jumping as headlines refresh | Instant list | P2 |
| Calendar disclosure | Date selected | 180ms expansion; keep current day anchored | Instant expansion | P2 |
| Journal save | Successful persistence | Short checkmark and undo notification; no confetti | Static confirmation | P1 |
| Theme switch | Explicit toggle | Existing 180–250ms color transition; check contrast at endpoints | Instant theme | P2 refinement |
| Loading transition | Request pending | Dimension-matched skeleton; resolve without major shift; timeout → retry state | Static placeholder | P1 |
| Data failure | Refresh fails | Stable last-good data with age and error badge; no shake | Same | P1 |

### Effects to leave out

No cursor replacement, magnetic controls that move away from the pointer, scroll hijacking, autoplay ticker marquees, particle fields behind data, breathing “buy” buttons, confetti for returns, numerical slot-machine rolls, or 3D tilt on dense tables. These consume attention and often make mobile reading harder.

### Three ready-to-use motion prompts for Claude Code

**Research interaction:** “Use the existing GSAP system to refine the screener-to-company journey. Keep all numbers exact and immediately readable. Animate only visible row geometry on explicit sorting, and use a portal-based 240ms quick-look sheet with trapped focus, Escape, restoration and an inert background. Keep query state and scroll position. Reduced motion removes translation. Verify rapid open-close, refresh during animation and keyboard-only use.”

**Daily desk:** “Refactor Today so breadth, barometer and market badges consume a versioned shared snapshot. Remove imperative numeric text mutation. Use a subtle 500ms tint only when a valid new value arrives; render actual values without counting from zero. Animate the breadth bar with transform, not repeated layout writes. Initial HTML remains visible if animation never initializes.”

**Share card:** “Build an explicit preview/export flow for a company evidence card with company, question, dated facts, strongest counterpoint, source and Alpha attribution. Preview may reveal sections over 300ms total, but exported PNG is a final static image. Offer 1080×1350 and 1200×630 formats. Exclude private holdings and notes by default; preview the exact shared fields.”

## 8. Make the site smarter through evidence and workflow

### A. One snapshot contract

Every data-bearing component should receive values with `datasetId`, `snapshotId`, `schemaVersion`, `asOf`, `fetchedAt`, `source`, `coverage`, `status` and `adjustmentBasis`. A company metric also needs entity, unit and reporting period. Centralize authoritative selection rules rather than independently combining feeds in widgets.

Separate at least: live traded price, previous unadjusted close, adjusted historical series, fundamental reporting period, generated-at time and research publication time. Do not recalculate a ratio using live price unless the denominator and calculation basis are valid and labeled.

Do not infer an exchange holiday solely from a missing Yahoo bar. The current `sessionGaps()` inference can mistake an upstream omission for a closure. Use a maintained exchange calendar, exceptional-session support and explicit unknown-calendar behavior. Do not label the observed 19 October snapshot stale merely because the calendar says 21 October: market holidays and source cadence matter.

### B. Evidence drawer

Each headline or classification opens the precise inputs, formula, date and relevant limitations. Reuse the existing glossary and research cards. Example: “Quality at the 100th percentile” opens the current universe and score inputs, not a generic paragraph claiming safety.

### C. Explain changes

Use the existing since-last-visit feature as a starting point. Store a small versioned snapshot of user-selected metrics. Report what changed, when, and whether the change came from price, filings, revised data or methodology. Require a comparable baseline; do not invent a cause from correlation.

### D. Research questions

Upgrade saved cards to support a hypothesis, supporting evidence, disconfirming evidence, missing data and a review trigger. This is more valuable than another generic AI chatbot. The company page should make the strongest counterpoint visible before a user saves a thesis.

### E. Honest AI routing

Use deterministic calculations and rule parsing where suitable. AI can explain a verified fact bundle, summarize supplied filing excerpts, or formulate a research question. Do not call fixed-rule search “AI understanding.” Show recognized intent, unknown words and data limitations. Keep AI-generated research separate from human-reviewed publications.

## 9. Performance, mobile and accessibility

### Performance targets, not claimed measurements

Use field p75 targets of LCP ≤2.5s, INP ≤200ms and CLS ≤0.1, segmented by mobile/desktop. Establish actual current baselines before adding effects. Lab results diagnose regressions; they are not substitutes for field data.

- Keep sharding: small company payloads are a good architectural decision.
- Avoid letting the initial homepage wait on the whole universe when the summary can answer the first question.
- Instrument source request duration, payload size, render latency and freshness independently.
- Lazy-load expensive maps and historical tools by route/visibility. `LazyMount` currently has a 3.5-second fallback that mounts everything eventually; evaluate its cost rather than assuming it remains lazy.
- Defer expensive tooltip/chart work until needed. Analyze whether shared GSAP plugin imports burden every route.
- Freeze row order on polling unless the user opts into live ranking; update values in place.
- Add fetch timeouts and preserve useful cached content during refresh failures. The current `Async` pattern can replace content on any error; distinguish initial failure from refresh failure.
- Bundle budgets should be set from measured routes, with a proposed initial regression limit of +10% compressed JS per route until consciously revised.

### Mobile verification matrix

Test 360, 390, 430, 768, 1024 and 1440 CSS-pixel widths; Safari on an actual iPhone; Android Chrome; desktop keyboard use; 200% zoom; both themes; every selectable accent. These are pending tests, not completed audit results.

At phone widths: use a compact company summary above the chart; clear horizontal-table affordances; sticky first company column where practical; no body overflow; safe-area clearance for bottom navigation; dialogs above the keyboard; 44px preferred touch targets for important controls. Preserve table and textual alternatives for maps/charts. Hover must never be the only route to information.

Audit WCAG 2.2 AA across focus visibility, contrast, labels, errors, target sizing and reflow. Also adopt the reduced-motion principle in SC 2.3.3 (AAA) as a product requirement; do not mislabel that criterion as AA.

## 10. Production, security and data operations

### Deployment architecture

Retain Next static export plus the Worker unless a measured need justifies migration. Static export does not provide arbitrary request-time server rendering or dynamic OG generation by itself. Use build-time assets or explicit Worker endpoints where required.

Release sequence: exact code + immutable data manifest → validation → build → route/schema/accessibility/smoke checks in preview → promote same artifact → production smoke → monitor → rollback if necessary.

- Add company-universe parity and unexpected route-removal checks.
- Make endpoint discovery in `audit.mjs` reliable. Its hardcoded API set omits instrument/intraday and its regex can miss `${BASE}/api/...` strings. Generate an endpoint manifest from a shared contract instead of relying on incidental source text patterns.
- Include Journal and every public route in the release inventory; the CI fixed-page list currently omits Journal.
- Pin package resolution with the real lockfile; the supplied build book deliberately omits it. Do not reconstruct a production baseline using fresh unrestricted dependency resolution.
- Review framework/package advisories against the actual installed dependency graph. The package file alone is not a vulnerability scan. Align Next and eslint-config-next version policy.
- Limit GitHub and Cloudflare credentials to required capabilities; retain deployment records and restore instructions.
- Store engine results, snapshots and signal events durably. Git commits may provide history but should not be the only recovery story for evolving state.

### Security controls

CSP, HSTS, framing protection, nosniff and permissions restrictions already exist in source. Verify them on actual static, API, redirect and error responses; `_headers` does not substitute for headers on Worker-generated responses.

The CSP permits inline scripts. Tighten through compatible build-generated hashes or another validated approach; do not apply an SSR nonce recipe blindly to a static export. Test Next's inline payloads and theme bootstrap before enforcing. This is hardening, not evidence of an exploited vulnerability.

Use response schemas at feed boundaries, input length limits, bounded fan-out, URL allow-lists, request timeouts and structured error codes. Preserve plain-text rendering for untrusted AI output. Validate imported JSON size/version/fields; guard CSV export against spreadsheet-formula injection for user-controlled strings. Do not collect holdings, research notes or questions in analytics.

### Operational signals

Monitor last successful ingest, expected-session lag, symbol coverage, malformed records, corporate-action anomalies, API latency/error rates, quote staleness, failed local persistence, build failures, page 404s, AI rejection rate and spend. Alert on user-impact thresholds rather than every transient provider error.

Define an owner and response for each failure: keep last-good data with date; disable misleading derived panels; stop signals when inputs are inadequate; preserve archives; provide a status/corrections page. Avoid silently repairing invalid source data into plausible-looking numbers.

### Research-specific release gates

The live holdout showed 49 trades, average −0.06R, profit factor 0.90 and month-clustered t −0.91, with alerts off. These are site-displayed results, not independently rerun performance. Preserve them. Do not optimize the rules repeatedly against that same holdout and continue calling it untouched.

Record universe survivorship limitations, delistings, corporate actions, cost assumptions, exposure, overlapping positions and benchmark methodology. Separate development, previously inspected holdout and genuinely prospective forward results. A t threshold alone is not proof of a profitable deployable strategy. Keep research claims proportional to evidence.

## 11. SEO, trust, sharing and monetization

### Search and trust

Company-specific titles, canonicals and sitemap generation already exist. Improve them through reliable route generation, stable article URLs, relevant descriptions and genuine source-backed content. Test query-parameter canonical behavior and sitemap integrity. Avoid indexing private journal/watchlist state and parameter combinations that create thin duplicate pages.

Add explicit contact, corrections, privacy/data-use and terms surfaces. Clearly describe local storage, analytics, AI question transmission and source attribution. An all-company no-position declaration is a factual assertion that must remain current and maintainable; do not auto-renew its date without owner verification.

Before paid signals, data redistribution or personalized advice, get appropriate review of actual operations, licensing and applicable requirements. This audit does not determine regulatory status or claim that a disclaimer resolves it.

### Shareability that earns distribution

Create three recognizable evidence artifacts: **Market in 30 seconds**, **Company: case and countercase**, and **What changed since my last review**. Each includes an as-of date, source and a link back to the underlying research. Preview exactly what will be shared. Do not include private notes or holdings automatically.

Generate Open Graph images at build time for public company/article routes or through an explicit Worker service. Add Web Share with clipboard/download fallbacks. Keep critical context on the exported image so it survives cropping and reposting. Never use invented returns, countdowns, ratings or social proof to stimulate sharing.

### Retention and monetization hypotheses

Measure successful first company lookup, saved screen, saved research card, return-to-review behavior and D7/D30 retention before expanding features. Count a useful completed research action, not just page views.

Possible paid value later: multi-device sync, deeper historical change logs, versioned exports, richer comparison workspaces and monitored research conditions with explicit opt-in. Keep methodology, delayed-data labels, corrections and basic risk explanations available to everyone. Do not sell an unvalidated signal as an edge. Pricing requires user research; no revenue or virality forecast is justified by this audit.

## 12. Execution plan and release acceptance

### Wave 1 — correctness and release integrity

Address A01–A03, A05, A10–A11 and misleading profit-lock copy. Add regression cases tied to these observed failures. Bind research eligibility to versioned evidence. Publish corrections for affected studies, including upstream fixes.

### Wave 2 — interaction and shared data

Address A04, A06–A09, A12 and A13. Build one provenance component and one dialog primitive. Make keyboard sorting work. Define honest initial/loading/stale/error states across all routes.

### Wave 3 — visual and motion refinement

Apply the design system and route plan. Implement a small first set: exact-value flashes, accessible sheets, filter-chip feedback, compact navigation transition and evidence-card preview. Test this set on mobile before adding map/rotation polish.

### Wave 4 — growth and operational maturity

Add public evidence sharing, SEO improvements, correction/status pages, privacy-safe analytics and retention experiments. Introduce paid workflow features only when the core is dependable.

### Required test cases

| Area | Cases that must pass |
|---|---|
| Numeric UI | Multiple updates during/after animation; DOM text equals labels; sums/percentages reconcile |
| Data dates | Holidays, missing upstream bar, special sessions, previous-close/live tie, partial quote coverage |
| NLP/entities | Banks vs financials; Federal Reserve vs Federal Bank; unsupported query words |
| Research text | 69.9% = 69.9 paise; percentile ≠ average; signs/units/periods preserved |
| AI | Unknown citation, small fabricated number, sign reversal, metric swap, unavailable model, rate/cost rejection |
| Watchlist | Multi-add, duplicate symbols, two mounted consumers, two tabs, storage failure, export/import |
| Accessibility | Tab/Shift+Tab containment, Escape, restoration, sorting by keyboard, live announcements |
| Motion | Reduced-motion change mid-session, hidden tab, unmount during tween, rapid repeated actions |
| Engine | Gap stop, T1/new-stop ambiguity, actual-entry risk, version mismatch, missing/nonfinite research statistic |
| Deployment | Feed outage, zero shards, wrong CI SHA, stale queued release, malformed JSON, rollback |

Success means these gates pass with recorded evidence. It does not mean the code merely builds or the homepage looks attractive.

## 13. Copy-paste master prompt for Claude Code

> **Pro Edition note:** the consolidated command in §34 (and `.claude/commands/alpha-pro.md`) supersedes this prompt; keep this text as detail.


```text
Act as the principal product engineer, financial-data QA lead, accessibility reviewer and motion designer for alpha.askakshay.com.

Read this entire audit, including the mandatory expanded scope in sections 15–20, and the actual repository's AGENTS.md and applicable skills before changing code. Establish the current commit and deployment baseline. The audit used supplied commit 6024d45 plus live observations from 21 Oct 2026; verify each issue against current source. Record resolved/stale findings instead of blindly reintroducing changes.

Goal: make Alpha a reliable, polished daily Indian-equity research desk. Preserve its warm editorial identity, Instrument Serif/Inter Tight pairing, restrained violet accent, working routes, transparent methodology, local exports and paper-only engine boundaries. Keep current URLs. Do not replace the site with a generic animated landing page.

Create a working branch and AUDIT_IMPLEMENTATION.md with finding ID, reproduction, affected file, proposed fix, test and status. Preserve unrelated changes and private user data. Do not delete signal history or reset research to improve apparent results.

Execute in four waves, completing and validating each before proceeding:
1. Correctness: A01 numeric DOM corruption; A02 weekly research errors and upstream publication gate; A03 claim validation; A05 entity matching; A10 exact-commit deployment; A11 atomic validated sharding; A14 profit-lock wording; A15 version-bound eligibility; A16 execution ambiguity review.
2. Coherence: bank-specific filtering; shared snapshot/provenance contract; modal focus containment; keyboard table sorting; atomic bulk Watch; fetch cache/retry lifecycle; durable AI quota if enabled. Standardize loading, partial, stale, empty and failed states.
3. Product and motion: implement the route-by-route recommendations, compact returning-user layout and a shared motion contract. Reuse GSAP and CSS already present. Keep final financial values exact. Add no second animation framework without demonstrated need. Use 100–320ms interaction transitions, bounded visible-row FLIP, accessible portal sheets and reduced-motion support. No scroll hijacking, animated prices, particle backdrops or profit confetti.
4. Launch: evidence-card exports and public share previews, stable article metadata, source/correction pages, privacy-safe event measurement, dependency/header checks, preview smoke and rollback documentation.

Engineering requirements:
- React owns text; animations must not overwrite authoritative numeric content.
- Every displayed metric carries entity, unit, period and snapshot provenance.
- AI references typed facts; unsupported claims are withheld, not merely decorated with a warning.
- Live and closed-session data may coexist only with unmistakable labels.
- Inspect upstream repos for publication/data bugs; do not pretend a frontend patch fixes generated content upstream. Report access blockers specifically.
- Keep alerts disabled unless the active engine version has qualifying, compatible evidence. Never tune against a repeatedly inspected holdout and call it untouched.
- Deploy only the tested artifact for the exact commit and validated data manifest. Preserve previous production on invalid feeds.
- Use the real lockfile. Do not fabricate versions or regenerate dependencies merely to make the old build book install.

Verification:
Run the repository's type check, lint, unit tests, engine tests, build and audit. Test the Worker-served build, not Next dev alone; /api and /data are served by the Worker. Add meaningful regression tests from section 12. Verify key routes at 360/390/430/768/1024/1440px, both themes and reduced motion, plus real iPhone Safari when available. Check keyboard flows, long-lived tabs, retry behavior and export/import. Measure performance before/after; do not invent Lighthouse or field scores.

Deliver code, concise before/after evidence, actual test results, unresolved issues with reasons, deployment artifact identity and rollback instructions. Prepare a reviewable preview. This request authorizes implementation and preview preparation; production publishing requires the owner's separate deployment instruction. Never claim error-free, profitable, compliant or viral based solely on this work.
```

## 14. Sources and reproducibility notes

Primary project evidence: attached build reference, plus browser observations on the site's route list in section 2. Exact live examples and source paths are recorded with each finding. The three AI validation examples were executed locally against the supplied pure function; a complete test suite was not executed.

External references checked during this audit:

- PromptMotion's current domain concept page: https://promptmotion.com/ — reference limitation and five promotional motion ideas only.
- GSAP matchMedia: https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/ — responsive/reduced-motion setup and cleanup.
- GSAP accessible animation: https://gsap.com/resources/a11y/
- Web Vitals: https://web.dev/articles/vitals — current LCP, INP, CLS thresholds and p75 field framing.
- WCAG animation from interactions: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html — user control and reduced-motion principle; this criterion is AAA.
- Cloudflare static-asset headers: https://developers.cloudflare.com/workers/static-assets/headers/ — static-response header configuration; verify Worker responses separately.
- Next static exports: https://nextjs.org/docs/app/guides/static-exports — static build constraints; consult version-compatible documentation before changing the current Next 14 project.

**Recommended next action:** give Claude Code this entire file with the actual repository. Complete Wave 1 first, then implement the navigation/presentation specification and execute the mobile and production verification gates below.

## 15. Mandatory mobile-device testing work package

**Instruction to Claude:** complete these checks; do not copy the audit’s “outstanding” sentence into a delivery report without attempting the work. Use available local browser-testing skills and device tooling. Report physical-device coverage separately from viewport emulation. Missing physical hardware must not prevent completing automated responsive, touch-emulated and browser-engine testing.

### Test environment and evidence

Serve the built site through its Cloudflare Worker locally and in a private preview. Use deterministic fixtures to reproduce failure states, then test live-data integration separately. Do not count a fixture-only pass as production integration evidence. Record commit, build ID, date, browser/version, viewport, input mode and test-data mode with each result.

Create `docs/qa/mobile-matrix.md` with one result per route/device/theme combination, using **PASS / FAIL / BLOCKED / NOT RUN**. Include reproduction steps and evidence for failures. Capture before/after screenshots for changed layouts and short recordings for motion or keyboard defects. Redact personal data from evidence. A desktop screenshot resized to phone dimensions is not a device test.

### Required coverage

| Layer | Required checks | Evidence needed |
|---|---|---|
| Automated responsive | All 19 route templates at 360, 390, 430, 768, 1024 and 1440px; light/dark smoke checks | Route matrix, overflow findings, screenshots of representative layouts |
| Browser engines | Chromium, WebKit and Firefox on the core journeys where tooling is available | Actual engine/version and results; WebKit emulation is not labeled real Safari |
| Physical iPhone | Safari portrait/landscape, keyboard, browser toolbar resizing, safe areas, touch scrolling | Device/OS/browser and manual checklist or recorded session |
| Physical Android | Chrome, touch menus, keyboard, scrolling, back navigation | Device/browser and manual checklist |
| Accessibility | Keyboard, 200% zoom, reduced motion, screen-reader smoke on key flows | Actual test method; automated scan plus manual checks |
| Adverse conditions | Slow network, offline, one endpoint failed, stale quote, partial universe, blocked storage | Explicit expected and observed UI states |

If physical devices are unavailable, finish all other layers and provide a short owner-run device checklist with exact URLs and actions. Keep that gate BLOCKED until evidence is supplied; never mark it passed from emulation.

### Core journeys to execute

1. **Discover → company → Watch → My Desk:** search a company, inspect its current price and snapshot dates, save it, navigate back, reload, and confirm persistence. Repeat with a multi-selection and duplicate symbols.
2. **Natural-language screen → filters → comparison:** parse a bank query, inspect clauses, sort by keyboard, compare two to four companies, remove one, return to the same filtered screen and scroll position.
3. **Markets → instrument sheet:** open, scroll internally, navigate focus forward/backward, dismiss using Escape and close control, restore focus and page position. Test rapid open/close during refresh.
4. **Company research:** change chart range, inspect a data point, switch financial tabs, open a metric explanation and save a research card. Check portrait/landscape and a narrow viewport with long company names.
5. **Tools:** edit every input using the phone keyboard; test blank, zero, negative, decimal, very large and malformed input; confirm labels and results remain visible and valid. Distinguish user assumptions from observed data.
6. **Journal:** create a disposable preview entry, edit it, export/import, and verify fields. Test storage failure. Do not overwrite a real user’s records for testing.
7. **Navigation:** access every page through both desktop menus and mobile More; use browser Back/Forward; open a direct link in a new tab; reload nested routes; test unknown company/unknown route.
8. **Session lifecycle:** background and restore the tab, cross an exchange-session boundary using fixtures, fail and recover a refresh, and verify counts, labels and timestamps agree.

### Mobile acceptance rules

- No horizontal body overflow. Explicitly scrollable tables/charts have visible affordances and accessible labels.
- Sticky header, bottom navigation and floating trays do not overlap content, focused controls or the phone keyboard.
- Safe-area padding works at the bottom and in landscape. Test dynamic viewport height rather than relying on fixed `100vh` assumptions.
- Use at least 16px text in phone inputs; preserve user zoom. Important actions should have approximately 44px touch areas.
- Map/chart tooltips work by tap and keyboard, not only hover. Dense visuals have a table/text alternative.
- Tap a stock once to select/inspect and use an explicit action to navigate when gestures would otherwise conflict.
- Sheets preserve scrolling within the sheet and restore the page correctly after closing.
- Loading placeholders reserve realistic space; empty data is distinct from data still loading.
- Reduced motion keeps all controls and feedback usable. No essential content waits for an animation callback.
- Core actions work on a slow connection; failure offers a specific Retry action without erasing user input.

## 16. Mandatory production infrastructure verification work package

**Instruction to Claude:** inspect the actual deployment configuration and live responses. Source review alone does not complete this work package. Use existing authorized GitHub/Cloudflare access; do not request or expose secret values. When access is absent, complete public/read-only checks and identify precisely which private checks remain blocked.

### Verification checklist

| Area | What to inspect or test | Pass condition |
|---|---|---|
| Deployment identity | Current production Worker/assets release, code SHA, build artifact and feed manifest | Production can be traced to an exact tested artifact |
| CI authorization | Push, manual, scheduled and engine-triggered deploy paths | Each path validates the exact artifact; previous green CI cannot authorize unrelated code |
| Domain/TLS | Alpha DNS binding, certificate chain, HTTPS and canonical host behavior | Valid certificate and predictable canonical routing; no redirect loops |
| Legacy domains | signal/vision/gems redirects where currently configured | Permanent redirect to intended canonical destination; meaningful paths handled explicitly |
| Static routes | Home, all route templates, representative company pages including encoded symbols, unknown paths | Correct status/body/content type; real 404 for nonexistent routes |
| Security headers | HTML, JSON, errors, redirects and assets separately | Appropriate CSP, framing, nosniff, referrer and transport policies actually present |
| Cache behavior | Static assets, HTML, feed proxies, quotes, AI answers and fallback shards | Immutable caching only for versioned assets; stale data labeled; sensitive responses not shared-cached |
| Data schemas | Required keys, finite numbers, dates, symbol coverage, duplicate records | Invalid payloads do not become healthy-looking panels or overwrite last-good data |
| Dependencies | Actual lockfile and installed versions, official advisories, build tooling compatibility | Findings triaged by actual exposure; upgrades verified rather than blindly forced |
| Secrets/access | Secret names/bindings, token scope, environment separation and logs | Minimum necessary permissions; no secret values in source, client bundle or evidence |
| AI operation | Configured model availability, provider errors, quotas, timeout and kill switch | Meaningful readiness state; bounded costs; safe fallback and supported model |
| Scheduled data jobs | Recent run history, completion times, holiday handling, reruns and concurrent runs | Missing/late runs visible; reruns idempotent; state writes consistent |
| Monitoring | Frontend errors, API health, feed age/coverage, build failures, AI spend | Actionable alerts and named response procedure |
| Recovery | Previous artifact, source/data backups, state restoration | Documented rollback rehearsed in a safe environment |

### Runbook and release procedure

1. Record a baseline before changes: deployed revision, known-good data manifest, route inventory and current monitoring. Do not print tokens or secret values.
2. Test failure cases in preview: failed upstream fetch, malformed JSON, missing company shard, old snapshot, provider timeout and concurrent data generation. Do not run destructive fault injection or load testing against production.
3. Promote the **same tested artifact** when production deployment is authorized. Do not rebuild against changing feeds between test and promotion without repeating validation.
4. Run production smoke checks on real responses, not just status codes: parse JSON, validate key fields and dates, verify a company route and its underlying data, and check representative links.
5. If smoke fails, follow the approved rollback procedure and retain incident evidence. Distinguish a frontend artifact rollback from data or engine-state restoration.
6. Record release identity and unresolved limitations. No broad “production verified” claim when infrastructure access or a critical gate was missing.

Create `docs/qa/production-verification.md`, `docs/operations/release-runbook.md` and `docs/operations/rollback-runbook.md` in the project. Each checklist item must carry status, observed evidence and remediation. Set sensible SLOs after measuring the baseline; do not invent uptime or performance results.

## 17. Navigation: organize the site around user intent

This section refines the navigation proposal in section 4. Implement one consistent information architecture. Existing pages remain accessible; useful features should not disappear inside a redesign.

### Target structure and route mapping

| Primary area | Default destination | Secondary pages / capabilities | User question |
|---|---|---|---|
| Today | `/` | Brief, Markets, News | What changed and what matters today? |
| Discover | `/screen/` | Heat Lab, Rotation, IPOs, Funds, Calendar | What should I research further? |
| Research | New `/research/` overview | Company lookup, Compare, Weekly Reads, Signals, Paper Trades, Tools | What supports or weakens the case? |
| My Desk | New `/desk/` overview | Watchlist, Research Cards, Saved Screens, Journal | What am I tracking and what needs review? |
| Utility | Search and settings | Method, data status, corrections, contact, privacy/terms | How does this work and can I trust it? |

New hub routes are justified only if they connect real existing actions. Do not create empty “coming soon” dashboards. If a hub has insufficient content, use a compact overview with existing destinations and honest empty states. Preserve `/trades/`, `/watchlist/` and other current deep links. Add new routes to static generation, sitemap policy and CI inventory.

### Desktop behavior

Use a restrained header with the four primary areas, Search, compact market status and settings. Keep theme/accent/motion controls in a clean settings popover rather than giving each equal prominence with the main task. Menus open by click and keyboard; hover may enhance but must not be required. Separate a section's destination link from its submenu-toggle button so tap behavior is unambiguous.

Group menu destinations with a short task description. Mark the active page and parent area. Preserve keyboard focus and close menus predictably on Escape/navigation. Search results should distinguish Companies, Pages, Saved Screens and Tools; never upload private notes to a search service without an explicitly designed data policy.

### Mobile behavior

Bottom navigation: **Today / Discover / Research / My Desk / More**. Search is always reachable from the header and More. More exposes the complete route inventory, status/method links and settings in organized groups. Show concise text labels, not unexplained icons. Keep the active state obvious without relying only on color.

Avoid both a crowded top navigation and an equally crowded bottom bar. Support back navigation naturally. Child pages carry a compact breadcrumb/back-to-context action; returning from a company should restore the originating screen or watchlist, not always send users to the homepage.

### Navigation acceptance

Every existing route is reachable within two navigation actions from the shell, excluding selecting a specific company. Direct links and reloads work. Browser Back restores filters and scroll. All menus are operable by keyboard and touch. No dead-end empty page; each empty state has one relevant next action. Count navigation entries from a shared route manifest so desktop, mobile, search, footer and tests cannot drift apart.

## 18. Luxury presentation and smarter feature organization

**Design goal:** an elegant editorial research desk with precise data, generous but purposeful spacing, and clear hierarchy. Luxury should come from typography, alignment, thoughtful detail and dependable interaction. Preserve Alpha's existing recognizable palette while making its execution more disciplined.

### Define reusable page families

| Family | Pages | Required layout |
|---|---|---|
| Daily overview | Today, My Desk | One takeaway, three or four meaningful summary items, prioritized work queue, secondary context |
| Discovery workspace | Screen, News, Funds, IPO, Calendar | Compact title, single filter toolbar, results, saved state; secondary options progressively disclosed |
| Visual exploration | Map, Rotation, Markets | Controls immediately above visualization, persistent legend/time context, details on selection, text alternative |
| Evidence detail | Company, Weekly Read, Compare | Identity/context, concise case and countercase, primary evidence, deeper sections, sources |
| Decision tool | Tools, Journal, Paper Trades | Inputs/task on one side, outcome/working beside it; single-column phone layout; explicit empty/error states |
| Trust/reference | Method, status, corrections | Scannable index, concise definitions, version/date, deep links |

### Component and visual rules

- Establish tokens for canvas, surfaces, text, borders, brand accent, positive/negative/neutral and warning states. Separate brand pastels from financial meaning.
- Use a consistent spacing scale such as 4/8/12/16/24/32/48/64px. Set desktop content widths by task: reading columns narrower than tables.
- Keep serif display type for concise editorial statements, sans-serif for actions and numbers. Use tabular numerals so refreshed prices do not shift horizontally.
- Define headline/body/label sizes with responsive clamps and verify long names. Avoid oversized repeated hero sections above working tables.
- Use three card roles: featured insight, standard panel and compact list item. Do not put every sentence inside a separate rounded box.
- One primary filled action per section; secondary actions use quieter styling. Show disabled reasons, busy states and successful completion consistently.
- Use thin borders and restrained shadow depth. Limit glass/blur to small navigation overlays where contrast and performance remain acceptable.
- Place dates and source context consistently. Make critical uncertainty readable without forcing users into footnotes.
- Keep visible copy short; move formulas and methodology into accessible adjacent disclosures. Do not hide risk or missing-data warnings behind optional disclosure.
- Replace vague titles such as “smart insights” with the actual job: “What changed,” “Why it ranks,” “Main counterpoint,” “Next review.”

### Homepage composition

First screen: concise market takeaway + clearly labeled snapshot time + compact market context + one primary research action. Next: user's saved names and meaningful changes, with an actionable first-use state. Then: selected discovery surfaces, followed by supporting news/reads. Experimental signals remain accessible but should not dominate when there are no active paper positions.

Do not silently personalize an anonymous user. Label browser-local selections and let users reset/reorder modules. A proposed “Focus view” can reduce optional content while keeping the same authoritative data and routes.

### Company composition

Above the fold: company identity, exact price/date, Watch/Compare, short evidence summary and strongest counterpoint. Then chart and scorecard, followed by financials/valuation/ownership/seasonality. Keep the primary company context available while scrolling without adding an oversized sticky header. Explain disagreements between checklist systems; label any simplified cap classification explicitly.

### My Desk composition

Show “Needs review,” Watchlist changes, Saved Screens and Research Cards, then Journal. “Needs review” must follow explicit user review dates or observed data changes, not fabricated urgency. Show whether data is saved locally and when it was last exported. A desktop-to-phone sync feature requires a real authentication/storage/privacy design; do not imply sync when only localStorage exists.

### Feature priorities: integrate before expanding

| Proposed improvement | Reuse / extend | Why it earns a place | Build gate |
|---|---|---|---|
| Evidence drawer | Glossary, facts, source/date components | Lets users verify a claim without leaving their task | Correct metric/source mapping |
| Research hub | Compare, Reads, Tools and company search | Makes advanced features discoverable | Useful existing destinations and no duplicate data logic |
| My Desk hub | Watchlist, saved cards, screens and journal | Connects existing fragmented personal workflows | Storage integrity and explicit local-only status |
| Change review | Existing since-last-visit logic | Creates a concrete reason to return | Comparable snapshots and no invented causal explanations |
| Focus view | Existing modules and layout preferences | Reduces clutter for frequent users | Keyboard/mobile equivalence and reversible setting |
| Evidence card export | Existing research cards | Makes useful research shareable | Preview exact content; source/date retained; private data excluded |
| Optional review reminders | Journal/card review dates | Helps users follow through | Explicit opt-in and real scheduling support |
| Cross-device sync | New authenticated persistence | Potential paid workflow value | Security/privacy design, migration, recovery and proven demand |

Do not add features simply because they are trendy. Each feature needs a user task, navigation home, source/state contract, empty/error states, keyboard/touch behavior, performance budget, test and success metric. Prefer upgrading the existing feature when it serves the same purpose.

## 19. Additional execution instruction for Claude Code

> **Pro Edition note:** the consolidated command in §34 (and `.claude/commands/alpha-pro.md`) supersedes this prompt; keep this text as detail.


Append this to the master prompt in section 13, or simply give Claude the entire updated document:

```text
The owner explicitly requests that mobile-device testing and production infrastructure verification become executable work, and that navigation, page organization and presentation be upgraded to a crisp, clean, rich luxury experience.

Treat sections 15–18 as mandatory scope. Do not stop after fixing the initial defects or after writing another plan. Implement the route organization and shared page/component system, then verify the result using available tools.

Start with a shared route manifest and map every current page to Today, Discover, Research, My Desk or Utilities. Build useful Research/My Desk hubs from existing capabilities; preserve URLs, exports and saved data. Ensure every page is reachable, search is consistent, and Back restores context.

Design and review representative Today, Screen, Company and My Desk layouts first at desktop and phone widths. Establish tokens and reusable page families, then apply them across all routes. Retain the editorial identity but improve hierarchy, alignment, density, contrast, typography, empty states and actions. Do not mistake more gradients, glass or animation for better design.

Execute the mobile matrix and infrastructure checklist. Separate physical-device results from emulation, source review from live verification, and fixtures from real data. Record PASS/FAIL/BLOCKED/NOT RUN with evidence. Complete all accessible checks before asking for missing access or device evidence. Never request secret values in chat.

Produce an implementation log, route inventory, before/after previews, mobile QA matrix, production-verification report, performance comparison and rollback runbook. Give a precise list of any remaining blocked gates and the smallest action needed to complete them. Do not label blocked checks as passed.

Prepare a reviewable preview and release candidate. Production deployment remains a separately authorized step. The intended result is implemented, testable improvements with a clear release decision, not an assertion that the website is error-free.
```

## 20. Launch-ready signup, activation, SEO and growth — mandatory

**Outcome:** a visitor can discover Alpha, sign up, save useful research, return on another device and share a public insight. This is new implementation scope, not a claim that authentication, cloud sync or deployment verification already exists. This section promotes account sync from the future option in section 18 to launch scope. Keep all earlier evidence, mobile and production gates.

### A. Build the complete user journey

| Surface | Required behavior | Acceptance evidence |
|---|---|---|
| Public site | Browse useful research without signup; contextual **Save to my desk** CTA; one clear **Create your free desk** primary CTA | Anonymous browsing works; no dead-end gates |
| `/signup/`, `/login/` | Managed email magic-link authentication; Google sign-in only when configured; clear loading, sent, expired, retry and unavailable states | Fresh account, returning account, invalid/expired link, rate limit and sign-out tested |
| `/auth/callback/` | Validate provider response; allowlisted return destination; resume intended action | Direct refresh and new-tab links work; no open redirect or token logging |
| `/onboarding/` | Optional research interests, choose up to three watchlist companies or skip, land on `/desk/`; target under one minute | Keyboard/touch completion; skip and resume work; no financial-details form |
| `/desk/` | Watchlist, saved screens, research cards and journal; useful empty states; clear sync status | Save → refresh → second-device login retains data |
| `/account/` | Profile, preferences, sign-out, export and account deletion; separate optional email subscription | Export works; deletion requires confirmation and sensitive-action reauthentication |

Use the existing cream/ink/violet identity, restrained editorial typography, generous spacing and compact cards. Signup should have one focused form and a short value statement. No fake social proof, forced tour, decorative loading delay or unnecessary mandatory fields.

### B. Production architecture and feature access

The inspected build uses static export plus a Cloudflare Worker and browser-local storage. Add a real managed identity provider, durable database and authenticated API boundary compatible with that deployment. Record the selected architecture and migrations; do not assume Next.js server routes run on static hosting. Use supported provider SDKs and current official documentation before installing dependencies.

- Public: Today, Discover, company research, methodology and public tools. Account: durable watchlists, saved screens/cards, private journal and preferences. Optional later: paid tiers, collaboration and advanced alerts. Preserve the engine’s existing alert-eligibility safeguards.
- Verify identity and resource ownership server-side on every private read/write. Use supported secure session handling; where cookie sessions apply, use Secure/HttpOnly/SameSite settings and CSRF protection. Keep service credentials out of bundles. Rate-limit authentication and expensive APIs; use generic auth responses and redact tokens, email addresses and journal content from logs.
- Persist owner ID, timestamps and schema version; implement conflict handling and idempotent saves. Offer a preview before importing browser-local records into the account, deduplicate, and retain a recoverable copy. Never silently upload a private journal.
- Implement private-cache rules, session expiry recovery, retryable errors, backups and a tested restore. Verify that user A cannot read/write user B’s records, including altered IDs and expired sessions.
- Configure production callback URLs, secret bindings, email sender/domain authentication, delivery monitoring and environment separation. Record missing credentials as BLOCKED; never ship a fake success state.

### C. Search discovery and useful sharing

| Area | Implement |
|---|---|
| Search foundations | Unique descriptive titles, descriptions, canonical URLs, crawlable internal links, semantic headings and useful HTML on public pages. Sitemap includes only valid canonical public URLs; use accurate modification dates. |
| Content quality | Public company and research pages explain evidence, source dates, authorship/review and methodology. Avoid mass-generated thin stock pages or unsupported return claims. |
| Index control | Keep auth, onboarding and private account pages out of the sitemap and marked noindex. Protect data with authorization; robots/noindex are not security controls. Prevent private information in static exports or social previews. |
| Rich previews | Accurate Open Graph/social images, titles and descriptions. Add only structured data that matches visible content and applicable types; never invented ratings or guaranteed rich-result claims. |
| Distribution | Share a dated public research card with source link and concise takeaway; native Share where supported plus copy-link fallback. Preview exactly what is shared; exclude private notes and holdings by default. |
| Return loop | User-controlled watchlist change review; optional digest with unsubscribe and delivery controls. Publish useful original explainers linked to relevant tools. No unsolicited invitations or manufactured urgency. |
| Measurement | Track signup completion, first saved item, onboarding completion, seven-day return and share-to-visit conversion with documented definitions. Exclude sensitive research/journal content from analytics; configure consent where required. |

After authorized release, verify the owned property in Search Console, submit the sitemap and inspect representative public URLs. Measure real indexing, mobile performance and activation. These are discovery and retention mechanisms; virality and rankings are outcomes to test, not promises.

### D. Commands and Claude Code execution instruction

Run from the actual repository on the Mac, after reading its instructions:

```bash
git status --short
node --version
npm --version
npm run
```

Use the repository’s declared runtime/package manager. With an npm lockfile, run `npm ci`; execute the actual listed lint, typecheck, test and production-build scripts. Do not invent script names. Add a documented end-to-end test command covering signup → callback → onboarding → save → sign-out → sign-in → persistence, plus account isolation and failed-session cases. Supply exact working preview, migration, deployment, smoke-test and rollback commands in `docs/operations/launch.md` after confirming the real provider and configuration. Never put secrets in those commands.

**Paste into Claude Code with this file:**

```text
Implement section 20 alongside the mandatory audit fixes and sections 15–19. Build real signup/login, onboarding, authenticated persistent feature use, account controls, SEO and privacy-safe sharing. Keep anonymous research useful and the interface crisp, editorial and luxurious. Preserve existing URLs and local data. Inspect the current stack before choosing compatible managed auth/storage; wire real services, not placeholder buttons.

Work through implementation and preview testing. Deliver migrations, .env.example with variable names only, exact tested setup/release/rollback commands, and evidence for the complete new-user journey. Run the mobile and infrastructure matrices; distinguish physical devices from emulation and confirmed passes from blocked checks. Release gates include account isolation, session recovery, email delivery, data persistence, canonical/sitemap/private-page checks, core mobile flows and rollback readiness. Record errors and remaining blockers honestly. Prepare the release candidate; deploy production only when separately authorized. Finish with a short changed/tested/blocked summary and the preview URL.
```

**Reference checks:** [Google Search Central — SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide); [OWASP — Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), consulted 21 October 2026. Architecture and feature choices above are recommendations for Alpha, not verified current capabilities.
