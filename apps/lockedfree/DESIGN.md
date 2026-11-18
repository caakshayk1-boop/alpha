---
name: Rulebook — The Paper Ledger, Alive
colors:
  paper: "#FAF7F0"
  card: "#FFFDF8"
  ink: "#16211B"
  ink-muted: "#5C665E"
  hairline: "#E4DED0"
  brand: "#0E5E42"
  up: "#0F6B4A"
  down: "#C8481F"
  down-ink: "#A8321F"
  warn: "#C77F0A"
  warn-ink: "#8A5600"
  halo: "#0E5E42"
typography:
  display-xl:
    fontFamily: Fraunces
    fontSize: 3.5rem
    fontWeight: 560
    lineHeight: 1.04
  display-l:
    fontFamily: Fraunces
    fontSize: 2.25rem
    fontWeight: 560
    lineHeight: 1.1
  display-m:
    fontFamily: Fraunces
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
  body-s:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  lede:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.5
  display-xl-mobile:
    fontFamily: Fraunces
    fontSize: 2.375rem
    fontWeight: 560
    lineHeight: 1.04
  label:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 560
    lineHeight: 1.3
    letterSpacing: 0.04em
  figure:
    fontFamily: IBM Plex Mono
    fontSize: 0.9375rem
    fontWeight: 500
    lineHeight: 1.35
  figure-xl:
    fontFamily: IBM Plex Mono
    fontSize: 2rem
    fontWeight: 500
    lineHeight: 1.1
  stamp:
    fontFamily: IBM Plex Mono
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: 0.02em
rounded:
  control: 6px
  card: 10px
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

| Role | Face | Size / line | Notes |
|---|---|---|---|
| display-xl | Fraunces | 56 / 1.04 | home hero only |
| display-l | Fraunces | 36 / 1.1 | page titles |
| display-m | Fraunces | 24 / 1.2 | section titles. **Display never goes below 24px.** |
| body | Inter | 16 / 1.55 | `font-variant-numeric: tabular-nums` where numbers appear |
| body-s | Inter | 14 / 1.5 | table cells, captions |
| label | Inter | 12 / 1.3, +0.04em | small caps-style labels; never below 12px |
| figure | IBM Plex Mono | 15 / 1.35 | every number, date, and stamp |
| figure-xl | IBM Plex Mono | 32 / 1.1 | headline statistics |
| stamp | IBM Plex Mono | 12 / 1.3 | "as of 18 Nov 2026" stamps |

- Fraunces variable with optical-size, SOFT and WONK axes. Defaults: `opsz` auto, `SOFT` 30, `WONK` 0. WONK stays 0 in running headlines (it changes letter shapes distractingly); allowed only on the hero word.
- Mobile sizes: display-xl 38, display-l 28.
- Self-hosted via Fontsource variable packages. `fontaine` generates size-adjusted fallbacks so the swap produces no layout shift. No Google Fonts requests, ever.
- Measure: 68ch maximum for prose.

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
