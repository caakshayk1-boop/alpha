# Tripwire design system (foundation, 1 Nov 2026)

North star: **a calm, dark evidence terminal. Fewer things, bigger, room to breathe.** Paper-only research; nothing here predicts or advises.
This is the foundation the Book/Record/ladder work and the screens work import. It changes no signal, engine, ledger or data shape.

## Where things live

| File | What it owns |
|---|---|
| `apps/tripwire/src/tokens.css` | Every colour, size, space, radius, shadow and duration. The ONLY file allowed to contain a hex colour. |
| `apps/tripwire/src/style.css` | The long-standing component rules. Reads tokens; defines no palette. |
| `apps/tripwire/src/foundation.css` | The shell (top bar, tab bar / rail) and the shared components' styles. Moves nothing. |
| `apps/tripwire/src/motion.css` | All motion. Every rule is under `html.fx`. |
| `apps/tripwire/src/app.css` | The bundle entry: `style.css` (which imports `tokens.css` first), then `foundation.css`, then `motion.css`. |
| `apps/tripwire/src/components/` | `layout.tsx`, `pills.tsx`, `gate.ts`, `tween.ts`, `index.ts` (one import for everything). |
| `apps/tripwire/tools/lint-tokens.mjs` | The build lint (`npm run tripwire:lint`; also run by `tripwire:build`). |
| `apps/tripwire/tests/design.test.ts`, `motion.mjs`, `comfort.mjs` | Pins for all of the above. |

## Tokens

Colour (contrast measured on the lightest surface, `--surface-3`, in parentheses):

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0A0A0B` | canvas |
| `--surface` / `--surface-2` / `--surface-3` | `#131315` / `#1B1B1E` / `#202023` | cards / fields and hover step / chips and wells |
| `--line` / `--line-2` | white at 8% / 16% | hairlines only; no heavy borders |
| `--ink` | `#F5F4EE` | primary text (14.5 : 1) |
| `--ink-2` | `#B9B9B4` | secondary text (8.1 : 1) |
| `--ink-3` | `#8A8A85` | timestamps and labels only, never body copy (4.6 : 1; 5.7 on the canvas) |
| `--accent` | `#CCFF43` | actions and highlights ONLY (13 : 1). `--on-accent` `#0A0A0B` is the text on it (16.9 : 1). |
| `--up` / `--down` | `#4ADE80` / `#F87171` | data semantics, never decoration (8.9 / 5.9) |
| `--amber` | `#FBBF24` | staleness and warnings only (9.3) |

Raised surfaces use `--surface-grad` (`#17171A` to `#101012`) and the single `--shadow-raised`. The primary button carries the one restrained glow, `--glow-cta`. No glass, no other glows.

Type: one family (`--font`, the system sans). Figures are set with `tabular-nums` (`.num`, forced with `!important` because an inline `font:` shorthand resets the longhand), not with a second face.

| Role | Size / line | Token |
|---|---|---|
| display | 40 / 48 | `--fs-display` |
| h1 (the page bar) | 32 / 40 from 700px, 24 / 32 on a phone | `--fs-h1` |
| h2 | 24 / 32 | `--fs-h2` |
| h3 | 19 / 26 | `--fs-h3` |
| body | 15 / 24 | `--fs-body` |
| data (minimum for anything read) | 13.5 | `--fs-data` |
| timestamps, labels | 12, in `--ink-3` | `--fs-label` |
| headline numbers in a summary | 20 to 28 | `--fs-num-s`, `--fs-num-l` |

Spacing: 4pt base, `--sp-1` (4) to `--sp-9` (64). `--section-gap` is 40 on a phone, 48 from 700px, 64 from 1100px. `--card-pad` is 20 on a phone, 24 above. `--gutter` is 24, 48 from 1100px. Max content width `--max` 1120; reading views `--max-read` 720 (class `.read`).
Radius: cards 20 (`--radius-card`), inputs 14 (`--radius-input`), pills full. Icons: 20px, 1.5px stroke (`Icon` in `ui.tsx`).

Old variable names (`--bg2 --s1 --s2 --s3 --tx --dim --mute --lime --peach --a2..a6 --sans --mono ...`) remain as **aliases** pointing at these tokens, so nothing that already worked broke. New work uses the new names. `--ink` used to mean "dark text on lime"; that is now `--on-accent`.

### Hex colours: before and after

| | css | tsx | ts (info) |
|---|---|---|---|
| before (`3b3c126^`) | 67 | 6 (3 of them the brand mark in `ui.tsx`) | 10 |
| after | 0 | 0 outside the allow-list (`ui.tsx` Mark: 3, must equal `static/icon.svg`) | 2 (`theme.ts` meta theme-color; a meta tag cannot read a custom property) |

`lint-tokens.mjs` fails the build on any new one. Allow-list entries live in the script with their reason.

## Shell

- **Top bar** (`StatusBar`, 52px): wordmark left, `SessionPill` beside it, on the right the NSE clock (from 700px) and `GatePill`. The gate pill reads the signals file the app already holds; with no gate in it nothing is drawn. Until the screen has loaded the pill slot holds its width (no layout shift).
- **Tab bar**: four tabs only (Today, Discover, My Desk, More). Flush bottom bar on a phone, 44px targets plus the safe-area inset, a 2px accent indicator on the selected tab, `aria-current="page"`. From 900px a 72px rail on the left with the indicator on its edge. Routes and tab memory are unchanged.
- Skip link and `<main id="main">` stay. One h1 per view (the page bar). Focus ring: 2px accent, offset 2px, on every interactive element, including fields that hide the browser outline.

## Components (import from `src/components/index.ts`)

| Component | Use |
|---|---|
| `SectionHeader` | title, one plain line, optional action. `level` 2 or 3, never the h1. |
| `EmptyState` | an icon, one honest sentence, at most one action. |
| `SkeletonBlock` | a reserved-size placeholder; shimmers only when motion is on. |
| `RecordStat` / `RecordStats` | one large numeral and its label. `value={null}` prints "Not yet", never a zero. |
| `TweenNumber`, `useTween` | a figure that glides to a new value (600 ms) with motion on, is the value with it off. |
| `Pill` | quiet: tier, sector, engine. |
| `StatusPill` | a state in words plus an icon, tinted up / down / amber / neutral. Never colour alone. |
| `SessionPill` | compact: the screen's age in the page's existing words from `freshness()` (Current / Build due / One session behind / Behind / Unknown); green when current, neutral while the build is due, amber when behind. `showDay` adds the close date. Named SessionPill because `screens/FreshnessPill.tsx` ("Data through … · built …", file-by-file detail, wording untouched) already exists; that one is only restyled (`.tag.fresh-pill` in `foundation.css`). |
| `GatePill`, `GateCard` | "Signals gate: OFF — 1/4 checks · holdout t −0.62 (needs +2.0)", read from the signals feed (`gateLine`, unit-tested). Hide when the data is absent; the holdout figure is parsed from the feed's own sentence and omitted if that sentence is not there. |
| `Card`, `CardRaised` | flat hairline surface / raised gradient and shadow. `interactive` adds the hover step. |
| `Button` | `primary` (accent; one per view), `secondary`, `quiet`. 44px tall, press state, `busy`. |
| `FilterSheet` | the existing `Sheet` (focus trap, Escape, keyboard-safe sizing). Not rebuilt. |

## Motion

Off by default (`prefs.motionV 2`). `html.fx` exists only when the person turns motion on and the device has not asked for reduced motion. Everything that moves is in `motion.css` under `html.fx`; with it absent nothing animates and every state change is instant (`foundation.css` also zeroes the older colour/opacity transitions in that case).

- Durations 160 / 240 / 360 ms, `cubic-bezier(0.22, 1, 0.36, 1)`, transform and opacity only.
- View: fade-rise 8px, 360 ms. Press: scale .98. Hover: an overlay fades in (opacity) to step the surface up one level. Skeleton: 8% shimmer. Stagger: 30 ms per item, capped at 8. Number tween: 600 ms ease-out-expo.
- Nothing bounces or loops; the old pulsing live dot is switched off.
- Pinned by `design.test.ts` (every motion rule is under `html.fx`, only transform/opacity, the three durations) and `motion.mjs` (off: no animation, no transform transition; on: the view fades and rises, press scales to .98, skeleton shimmers).

## Reading comfort decisions

- One family instead of proportional prose plus mono figures. The comfort test used to assert mono figures; it now asserts tabular figures in the one family. Alignment is what matters for reading numbers.
- Contrast floors in `comfort.mjs` were re-set for the new palette (they were written for the olive one): ink 14, ink-2 7.5, ink-3 4.5, accent 9, up 8, down 5.5. Nothing is below WCAG AA; body copy uses ink and ink-2 (both above AAA). The measured numbers are above and pinned again in `design.test.ts`.

## Deliberately not done

- Outgoing-view fade and the View Transitions API: the incoming fade-rise only. Remount-on-route is the existing mechanism and a second one would race it.
- Pull-to-refresh, the sticky-header hairline after 8px of scroll, and the ladder travel / booking sweep: they belong to the Book and screens work and need their components.
- Book and Record tabs: the owner kept four tabs. Signals, the book and the record live under their existing routes and More.
- Discover table internals, Company sections, Methodology text, capture module: owned by the next agents.
- `rgba()` and `color-mix()` literals in older rules are not hex and are not linted; they derive from the same palette values and are candidates to tokenise as those screens are rebuilt.
- Lighthouse was not run (needs the production build behind real headers).

## Process notes

- `static/critical-classes.json` drives the inlined critical CSS. After changing the first screen run `node apps/tripwire/tools/critical-classes.mjs <base url>` and commit the file (`tests/critical.mjs` fails otherwise). `npm run tripwire:budget` must stay green (initial JS <= 250 KB gzip, no render-blocking CSS).
- Before/after pictures: `node apps/tripwire/tests/foundationshots.mjs <base> docs/tripwire/design/foundation <prefix>` (Today, Discover, a Company page, More at 390 and 1280, on the frozen screen fixture). `before-*` and `after-*` are in `docs/tripwire/design/foundation/`.
- A phone has no room beside the two pills for the NSE clock; below 700px that text stays in the page for screen readers and the Today brief says it in words.

## Screens: Today, Discover, Company, Methodology, Help, Data (1 Nov 2026)

Styles in `src/screens.css` (tokens only). Pinned by `tests/screens.mjs` (browser) and `tests/capture.test.ts`. Before/after pictures: `docs/tripwire/design/screens/` (`node apps/tripwire/tests/screensshots.mjs <base> <dir> before|after`).

- **Today.** A hero leads (`data-hero`: the one-line definition, the file-by-file `FreshnessPill`, then `GateCard`). The gate card reads the signals feed the app already holds and draws nothing without a gate; its slot (`.t-gate`) is held only while that feed loads, so it arriving shifts nothing. The existing sections keep their `data-sec` names and order. With no picks at the last close the picks slot says so plainly (`EmptyState`).
- **Capture module (OFF).** `src/capture.ts` holds the flag and the endpoint; `screens/capture.tsx` is the component. Shipped as `CAPTURE_ENABLED = false`, `CAPTURE_ENDPOINT = ''`: it renders a hidden, empty placeholder, draws no field and makes no network call. **The one value needed from the owner is the Beehiiv subscribe endpoint askakshay.com already uses** (an https URL that accepts a POST of `{"email","source"}`). Set it, set the flag, and allow that host in `connect-src` in `static/_headers`. No popup, no modal, nothing on a timer; the address is sent only when the person presses Subscribe. The identity footer links askakshay.com only; the Margin Notes newsletter URL was not supplied.
- **Discover.** Below 700px the Table view is a stack of cards (symbol and company, compare and follow, then each figure with its label); the same table markup, so sort, count, list/table parity, URL state and keyboard use are untouched. The column headings (with their per-column funnels) are a desktop control; on a phone the same filters are in the Filters sheet and `+ Condition`. From 700px rows are 52px or more, hairlines only, a header that blurs what scrolls under it, and each heading's tooltip is the figure's label and its plain-language hint. The Filters and Columns sheets are `FilterSheet` (the existing `Sheet`).
- **Methodology and Help.** A 720px reading column (`.read`); eligibility steps are numbered cards; the target arithmetic is a code block on `--surface-2` with the same thresholds stated in words beside it, read from `exits.ts`. The capture slot and identity line close the page.
- **Data.** The per-file freshness table uses `StatusPill` (word plus icon, never colour alone); on a phone each file is a labelled card.
- **Company.** Sector and size are pills beside the price; rule checks read "Passes:" / "Fails:" / "Not measured:" to a screen reader as well as showing a mark.
