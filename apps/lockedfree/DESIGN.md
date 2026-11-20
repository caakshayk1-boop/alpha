---
name: Rulebook — The Paper Ledger, Alive
colors:
  paper: "#08090A"
  card: "#101113"
  ink: "#F0F0F0"
  ink-muted: "#9EA3AB"
  hairline: "#26282B"
  brand: "#B8EF43"
  brand-ink: "#0A0C05"
  up: "#3DDC97"
  down: "#FF6B6B"
  down-ink: "#FF8F8F"
  warn: "#FFD166"
  warn-ink: "#FFD166"
  halo: "#B8EF43"
typography:
  display-xl:
    fontFamily: Fira Sans
    fontSize: 3.5rem
    fontWeight: 560
    lineHeight: 1.04
  display-l:
    fontFamily: Fira Sans
    fontSize: 2.25rem
    fontWeight: 560
    lineHeight: 1.1
  display-m:
    fontFamily: Fira Sans
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: Fira Sans
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
  body-s:
    fontFamily: Fira Sans
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  lede:
    fontFamily: Fira Sans
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.5
  display-xl-mobile:
    fontFamily: Fira Sans
    fontSize: 2.375rem
    fontWeight: 560
    lineHeight: 1.04
  label:
    fontFamily: Fira Sans
    fontSize: 0.75rem
    fontWeight: 560
    lineHeight: 1.3
    letterSpacing: 0.04em
  figure:
    fontFamily: JetBrains Mono
    fontSize: 0.9375rem
    fontWeight: 500
    lineHeight: 1.35
  figure-xl:
    fontFamily: JetBrains Mono
    fontSize: 2rem
    fontWeight: 500
    lineHeight: 1.1
  stamp:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: 0.02em
rounded:
  control: 6px
  card: 12px
  full: 999px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 24px
  6: 32px
  7: 48px
  8: 72px
components:
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: 24px
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    padding: 12px
  button-disabled:
    backgroundColor: "{colors.hairline}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.control}"
    padding: 12px
---

# Rulebook — design law

Status: **draft for approval (Step 1).** Once approved, this file is law for every later step. Tokens live in one file, `src/styles/tokens.css`, generated from the front matter above by a build script; no component defines a root token. Changes to this file after approval need an ADR in `DECISIONS.md`.

## 1. Overview

A printed ledger: ruled hairlines, honest ink, nothing erasable. Warm paper, one ink colour, one brand green, and numbers set in mono so columns align. Motion is modern but each movement explains a state change. Light theme only; there is no dark theme and no toggle. The site must never look like a trading terminal, a casino, or a template.

Three feelings it must produce: **calm** (nothing urgent), **accountable** (everything dated, nothing deleted), **plain** (a first-time investor understands every label).

## 2. Colour

| Token | Value | Use | Contrast on paper |
|---|---|---|---|
| paper | `#FAF7F0` | page background | — |
| card | `#FFFDF8` | cards, inputs | — |
| ink | `#16211B` | body, headings, rules | 15.5:1 |
| ink-muted | `#5C665E` | secondary text, captions | 5.6:1 |
| hairline | `#E4DED0` | rules, borders, table lines | decorative (1.25:1) |
| brand | `#0E5E42` | brand moments only: logo, primary CTA, focus ring, active nav | 7.3:1 |
| up | `#0F6B4A` | positive values: strokes, fills, text | 6.1:1 |
| down | `#C8481F` | negative values: strokes and fills only | 4.5:1 (graphic use) |
| down-ink | `#A8321F` | negative values as text | ≥ 5.5:1 |
| warn | `#C77F0A` | stale-data and caution marks (fills, icons) | 3.0:1 (graphic only) |
| warn-ink | `#8A5600` | warning text | 5.8:1 |

**Changes from the master prompt's starting shades, with reasons (measured, not guessed):**
- The prompt's Up `#1D7A4F` and Down `#BC3F2E` differ in relative luminance by 0.003. Under simulated deuteranopia their contrast is 1.19:1 — they are the same grey. Refined Up/Down raise that to about 1.65:1, which is still weak. **Rule: colour never carries direction alone.** Every signed number also carries a `+`/`−` sign, and every chart/table delta also carries a Lucide `arrow-up-right` / `arrow-down-right` icon. This is enforced by a lint test.
- `warn` `#C77F0A` is 3.0:1 on paper and fails as text. Text uses `warn-ink`.
- Brand racing green and Up green are close in hue. Accepted risk, managed by rule: brand green appears only on non-numeric brand elements; a number is never brand-coloured. Reviewed again at the Step 3 audit.
- The ink-halo used by the changed-since-last-visit animation is `brand` at low alpha.

Hairlines are 1px. Surfaces are never tinted with the semantic colours.

## 3. Typography

Two faces, self-hosted (Fontsource variable packages, `fontaine` size-adjusted fallbacks, no Google Fonts requests): **Fira Sans** for everything that is read, **JetBrains Mono** for everything that is counted (figures, dates, stamps, column labels). Long prose is never mono. (Realigned 20 Nov 2026: the earlier text of this section named Fraunces, Inter and IBM Plex Mono, which the owner replaced in ADR-011; the code and the front matter already used Fira Sans and JetBrains Mono.)

One scale, in `tokens.css`, and nothing is set below 12px:

| Token | Size | Role |
|---|---|---|
| `--fs-xs` | 12px | labels, stamps, column heads, captions (the floor) |
| `--fs-sm` | 14px | table cells, secondary text, controls |
| `--fs-md` | 16px | body and prose (68ch maximum) |
| `--fs-lg` | 18px | lede, emphasised lines |
| `--fs-xl` | 20px | card titles, large quotes |
| `--fs-2xl` | 24px | section titles (display never below 24px) |
| `--fs-fig` / `--fs-fig-xl` | 32px / 40px | headline figures, mono |
| display clamps | 36 to 92px | page titles and the home hero (documented clamps in `global.css`) |

- Figures are right-aligned in columns with `font-variant-numeric: tabular-nums`; a stamp always sits beside the figure it dates.
- Weights: 400 body, 500 figures, 560 labels and display, 600 to 700 headings.
- `tests/design.test.ts` fails if a size outside this scale, or any size under 12px, appears in the CSS.

## 4. Spacing, layout, shape

- 4px base unit. Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 72.
- Page gutter 16px (mobile) / 32px (desktop). Content column 1120px; prose column 680px.
- Cards: 10px radius, 1px hairline border, **no drop shadows**. Depth comes from rules and paper tone. Controls: 6px radius, 44px minimum touch height. The switch alone is fully round (999px).
- Ledger rules: tables use only horizontal hairlines, never zebra stripes or vertical lines. Totals sit under a double rule.
- Tables below 720px become stacked cards. **Every card keeps its as-of stamp.** Nothing is dropped to fit.

## 5. Iconography

- One family: **Lucide**, 1.5px stroke at 20px, 1.25px at 16px — a single stroke weight per size, set by CSS variable, applied everywhere.
- Interaction layer: icons from **pqoqubbw/icons** (Lucide-style, animated on hover or tap) used for nav, feature rows and empty states only. Static contexts such as table cells use plain Lucide.
- Icons are imported individually (tree-shaken). No emoji, no unicode glyph icons, no second family. Decorative icons are `aria-hidden`; meaningful ones carry text.

## 6. Motion

Durations: **120 / 200 / 320 / 420 ms.** Easing (from Emil Kowalski's skills): `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for entrances and responses; `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` for movement of elements already on screen. Never `ease-in`. Never animate `all`.

| Motion | Duration | Tool | Why it exists |
|---|---|---|---|
| Press feedback on controls (`scale 0.97`) | 120 | CSS | acknowledges input |
| Hover / focus colour and underline | 120 | CSS | shows what is interactive |
| List add / remove / reorder | 200 | auto-animate | shows what changed in a list |
| Popover / select entry | 200 | CSS, origin from trigger | anchors it to its trigger |
| Changed-since-last-visit ink halo | 500 once, then rest | GSAP | tells the returning visitor which numbers moved |
| Card → stock page header morph | 320 | View Transitions API | continuity: this card became this page |
| Equity-curve card persists across navigation | 320 | View Transitions API | the curve is the same object on every page |
| Hero equity curve draw-in | 420, once | lightweight-charts + GSAP | shows time passing left to right, first view only |
| Shortlist "entered / exited / still-in" reflow | 320 | GSAP Flip | shows which names moved between groups |
| Lock-screen entry | 320 | CSS | the lock is a state change, not an error |
| Scroll reveal | none | — | not used. No global fade-in on everything. |

- **Lenis** smooth scroll runs only on reading pages (home, methodology, About). It is not initialised on data tables, the Gate, or the Plan.
- **Anime.js is not adopted.** GSAP covers every sequence above. Adding a second timeline engine costs bytes for no capability. (Prompt permitted it; this design declines it. Recorded as ADR-004.)
- **swup is not adopted.** The site is static Astro using the native View Transitions API; swup is only for server-rendered stacks per the prompt.
- `prefers-reduced-motion: reduce`: no view-transition morph (instant navigation), no Lenis, no halo, no curve draw-in, no Flip. State changes still happen, but instantly. Essential motion only: focus ring and the pressed state.
- Nothing loops. No idle animation.

## 7. Data visualisation

Library: TradingView **lightweight-charts** (canvas) for equity curves and price charts; **uPlot** for sparklines and small multiples. Chart taste follows the lieflat-charts skill: annotate the one thing that matters, omit chart junk, no 3D, no dual axes, no truncated baselines on bars.

Every chart carries, without exception:
1. an **as-of stamp** (mono, top right of the chart card);
2. **n** when it summarises trades ("12 closed trades");
3. **drawdown shading** on any equity curve (brick-tinted ribbon beneath the line);
4. a text-equivalent table reachable by keyboard ("View as table").

A return is never drawn without its drawdown on the same card. Benchmark is a muted ink line, labelled "Nifty 500 (price index, no dividends)". Missing days are gaps, never interpolated. Stale data gets an amber "stale — last updated …" stamp.

## 8. Components

Headless primitives from **mui/base-ui** (the stable `@base-ui/react` package, to be confirmed at Step 3): Button, Input, Field, Checkbox, Switch, Tabs, Dialog, Popover, Tooltip, NumberField, Select. The look is entirely ours; no library CSS is imported.

Bespoke components: `StatBlock` (figure + label + n + as-of), `HonestyLabel` (shown when n < 30), `AsOf`, `Delta` (sign + icon + colour), `RuleRow` (pass/fail + rule + underlying number), `Shortlist`, `SitOut`, `NearMiss`, `GateChecklist`, `LockScreen`, `PlanCard`, `BucketCard`, `PanicCard`, `EquityCard`, `DataTable` (card fallback).

States, all defined for every interactive component: default, hover, focus-visible (3px brand ring, 2px offset), active, disabled (hairline fill, never opacity alone), loading, error, stale, missing. **Missing renders as "—" with the word "missing" available to assistive tech and a tooltip stating why.** It is never zero, never hidden.

## 9. Voice

Calm, plain, short sentences. Numbers carry dates. Rules are structure, never judgement ("The terminal is locked until 9:15 tomorrow. You wrote: …", not "You broke your rule"). No exclamation marks, no urgency, no streak language for trading activity. "Simulated — not real returns" sits adjacent to every performance figure, in `stamp` style, and is part of the `StatBlock` component so it cannot be forgotten.

## 10. Accessibility

- WCAG 2.2 AA minimum. Body ≥ 4.5:1, large text and graphics ≥ 3:1.
- Direction never by colour alone (see §2). Verified by simulated deuteranopia and protanopia screenshots at Step 3.
- Full keyboard path through the Gate; visible focus; the disabled submit explains what is missing via `aria-describedby`, not silence.
- Charts have table equivalents. Live regions announce lock state.
- Touch targets ≥ 44px. Verified on a real narrow viewport (Chromium mobile emulation with touch, plus a real device pass by the owner for check 12).

## 11. Page inventory

| Route | Purpose | Reading page (Lenis) |
|---|---|---|
| `/` | equity-curve hero → three problems → three rooms → Ledger highlights → methodology → email capture → About | yes |
| `/screens/` | the four screens, each with its track-record block | no |
| `/screens/[id]/` | the weekly shortlist, changes, sit-out state, track record | no |
| `/screens/[id]/methodology/` | permanent rules, thresholds, sources, weaknesses | yes |
| `/screens/[id]/archive/` | every past list | no |
| `/screens/[id]/[symbol]/` | per-stock: rule checklist on top, chart below | no |
| `/gate/` | paper terminal: entry flow, open book, lock screen | no |
| `/gate/journal/` | plan-adherence %, dual equity curves, Mistake Cost | no |
| `/gate/rules/` | account rules, strict mode | no |
| `/plan/` | wizard, then plan page: weights, drift, rebalance date | no |
| `/plan/buckets/` | goal buckets | no |
| `/ledger/` | scoreboard: per-screen and overall statistics, refusals | no |
| `/ledger/voids/` | every void with its reason | no |
| `/ledger/refusals/` | stocks the screens rejected, and what they did next | no |
| `/about/` | what this is and is not; who runs it | yes |
| `/methodology/` | the shared accounting and ledger methodology | yes |
| `/og/*.png` | build-time share cards, labelled paper-only / simulated | — |
| `/404`, `/offline` | honest failure states | — |

## 12. Banned (design level)

Top-gainers/most-active/most-bought rails under any name; return leaderboards; winners-only strips; confetti; trade-count or P&L badges; price-move notifications; dark theme or toggle; chatbot; social feed; urgency timers; drop shadows as hierarchy; gradient text; glassmorphism; decorative looping animation.

## 13. Terminal surfaces (ADR-010, unified with the site by ADR-012)
The terminal rooms (/terminal/, /screener/, /snapshot/, /brief/, /pnl/, /stock/*) are part of the same product and use the same tokens, fonts and header as the editorial site (§14): `#08090A`, lime `#B8EF43`, Fira Sans, JetBrains Mono, 12px cards, pill controls. The earlier graphite and amber palette, the icon rail, and the Fraunces, Inter and Plex fonts are removed. What stays terminal-specific is density only: 14px body, 13px tables, mono figures, numbered pane headers ("01 MARKET SNAPSHOT"), a sticky sub-bar with the rooms as tabs (keys 1 to 5), market state, IST clock, data date and the command palette (⌘K or /).
- **Flow**: site header, then the terminal sub-bar, then panes. A stock page has a breadcrumb back to the screener and its sector. On phones the rooms are one swipeable row and the status collapses to a dot.
- **Honesty rules carried over**: every number has one owner section per page (build fails otherwise); missing is a dash; quotes show their age and turn yellow when stale; the source's verdict and trade ladder are never shown.

## 14. Editorial surface re-themed to askakshay.com (ADR-011, owner decision)
The paper theme (§1–§12 above describe it) is superseded for the editorial site by the owner's own site theme, read from askakshay.com on 18 Nov 2026: background `#08090A`, text `#F0F0F0`, accent lime `#B8EF43` (text on lime `#0A0C05`), Fira Sans for headings and body, JetBrains Mono for figures and labels, 12px cards, pill (999px) buttons and inputs, numbered "§ 01 —" section markers, italic lime emphasis words in headlines. The tokens in the front matter above are the current values; §2's paper values and contrast table are historical. The Terminal rooms use the same theme (§13).
Contrast (measured): text 17.5:1, muted 7.9:1, lime 14.7:1, black on lime 14.5:1, up 11.3:1, down 7.2:1 on `#08090A`.
Motion on this surface is richer than §6 allowed: staggered headline reveal, scroll-reveal sections, pointer glow, magnetic buttons, card tilt, count-up figures, one slow marquee of facts, page-transition slide, scroll progress. Everything runs on CSS plus about 3 KB of script (no GSAP, no smooth-scroll library on these pages) and all of it turns off under `prefers-reduced-motion`.

## 15. The stock page: one answer first, details on demand
Replaces the earlier all-panes layout (17 panes, 116 numbers, 844 words visible on load). Order, top to bottom: identity and price with the 52-week range; **six headline numbers** (P/E, ROCE, 3-year revenue growth, debt to equity, dividend yield, one-year return against the Nifty); **the read** (the position sentence, at most three strengths or weaknesses against peers, and the single most serious data caution, with the four scores as thin bars); **one interactive chart**; then **five tabs** (Profile, Financials, All numbers, Trend, Peers) so only one detail section is open at a time. Each metric still has exactly one owner on the page; the three facts in the read are never repeated in the Profile tab (it holds only the remaining facts and cautions).
Chart: area line of daily closes with 50- and 200-day averages computed in the browser from those same closes, dotted 52-week high and low, range buttons 1M/3M/6M/1Y, average toggles, a hover legend, a skeleton while loading, and a plain message (nothing drawn in its place) if the price history cannot be loaded. Returns are a horizontal ladder with the value at each bar's end; revenue and profit are grouped bars with value labels in lakh crore (L) and thousand crore (k).
Without JavaScript all five sections are visible and the tab bar is hidden. On phones the tab bar swipes and the page is about 2,900 px tall (was 6,470).

## 16. Site shape and widgets (ADR-016)
Six nav items: Terminal, Calls, Screener, The Gate, The Plan, About. Terminal is a board of hideable widgets (`data-widget`); Calls has three tabs; Gate has three tabs (hash-addressable). No new page may be added without removing one. Stats appear once, in their owning widget or tab.
