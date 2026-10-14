# Design direction

## Direction (one, in five sentences)
Alpha is a research desk, so the interface is calm, precise and plain-spoken: warm off-white or ink surfaces, one periwinkle accent that only ever means "you are here / you can press this", and gain/loss/caution colours that are never used for decoration. Every screen leads with a sentence that says what matters, then the figures behind it, then one action. Typography does the work that gradients used to do: a serif display face for the headline and one italic clause, a tabular-figure sans for everything numeric. Surfaces are solid with one hairline and one soft shadow; blur, glow and drifting backgrounds were removed. Motion explains a change of state in 140–380 ms and never moves a number.

## Reference matrix
Browsed 2026-10-14 with a page scraper (content and extracted brand tokens), not a visual session. "Observed" is directly in the scraped page or its extracted styles; "Inference" is mine.

| Reference | Observed | Why it works | Inference | How Alpha adapts it |
|---|---|---|---|---|
| linear.app | Dark `#08090A`, Inter body, h1 64 px / body 15 px, 4 px base unit, pill buttons; product shown as real UI (an issue's activity log, a board), sections captioned "Fig 0.1…"; a dated changelog on the home page | Real artefacts, not illustrations, carry the claim; small body text with strict rhythm | Restraint in colour is what makes the one accent read | Alpha shows real signal cards and real figures; one accent; 4 px spacing scale already used |
| stripe.com | Light `#FFF`, ink `#061B31`, accent `#533AFD`, 8 px base, 4 px radius buttons; claims backed by exact stat blocks (135+ currencies, 99.999% uptime) with a link to a status page | Specific numbers with a source beat adjectives | Footnotes are how a financial brand stays credible | Alpha puts the data date and source beside every figure; claims stay measured |
| vercel.com | `#FAFAFA` ground, Geist, h1 64 px / body 14 px, 6 px radius; each section is one bold sentence, one proof line, then a short feature list | One idea per section | Disciplined repetition of one section pattern reads as quality | Today and News use one pattern: heading, one line, content |
| raycast.com | Dark `#07080A`, Inter 18 px body, ⌘K hints, small proof claims ("99.8% crash-free") | Keyboard-first search is the product's front door | Showing the shortcut teaches it | Alpha keeps ⌘K/`/` search and a visible search button |
| tradingview.com | White, blue `#2962FF`, 56 px headings; market summary rows each carry the unit (POINT, JPY) and a market open/closed state | Dense market data stays legible when every row says its unit and state | State-per-row prevents stale numbers being read as live | Alpha's quotes show "last trade 17 h ago" per row; units on every figure |
| Belivune screenshot (supplied by owner) | Warm cream ground, serif greeting, tinted soft tiles, one dominant action, floating pill tab bar | Calm space and one obvious action | The warmth comes from the neutral ground, not decoration | Light theme is warm off-white; mobile tab bar kept |
| 1% Club (read earlier from public pages) | One plain-language takeaway per screen, a few big jobs, sentence-case labels | Reduces decoding | – | Takeaway-first Today; four job tiles |

Not copied: branding, layouts, illustrations, copy. Apple and editorial hospitality sites were not inspected in this pass.

## Tokens (source of truth: `src/app/globals.css`)
- **Colour roles:** `--bg --bg-2 --panel --panel-2 --panel-3 --line --line-2 --text --muted --dim --control-line --accent --accent-2 --accent-ink --accent-soft --up --down --warn` plus `-soft` and `-fill` variants, defined separately for dark and light. Muted/dim text were raised earlier to measured 4.8–4.9:1; Today's text measured ≥5.48:1 (light) and ≥5.78:1 (dark).
- **Brand vs meaning:** the accent is never used for gain or loss. `--up/--down/--warn` carry meaning, and every gain/loss also carries ▲/▼ or text.
- **Type:** `Instrument Serif` (display, one italic clause) + `Inter Tight` (UI and numerals, tabular figures; measured identical digit widths). Self-hosted by `next/font`, `display: swap`. Reading width 62–70 ch for body; labels sentence case, 12.5–14 px.
- **Spacing/radius:** `--s-1…--s-9` (4–112 px), `--r-1…--r-4`, `--r-pill`; container `--maxw` 1280 px.
- **Layout:** content-sized grids (`.g2/.g3/.g4` use `auto-fit minmax(min(100%, N), 1fr)`; `.g-7-5` stacks under 1000 px). A card never gets narrower than its content needs.
- **Surfaces:** solid `--panel`, one hairline, one shadow (`--ring`). Blur kept only for the sticky header, the mobile tab bar and the menu scrim, where it keeps content legible underneath.
- **Motion tokens:** `--dur-fast 140ms`, `--dur-base 220ms`, `--dur-slow 380ms`, `--ease`. Transform/opacity only. `prefers-reduced-motion` zeroes durations.

## Component conventions
- **Card anatomy:** label → value → one line of meaning. Signal card: identity + price now → tags → plan ladder → distance line → facts → disclosures.
- **Lists over tables on phones** when the task is "which one?" (picks, engines, news); real tables, with a pinned first column and controlled sideways scroll, where comparison is the task (screen, funds).
- **Disclosure:** long method text sits in a `details` ("How to read these verdicts"), never above the content a person came for.
- **Honest states:** every empty state says why it is empty; a missing figure is a dash, never an estimate.
- **State in the URL:** engine and tab (`?engine=&tab=`), news filters (`?topic=&source=&view=&q=`).

## Banned in this system
Gradient backgrounds, glowing borders, drifting blobs, blur on content cards, identical pill rows used as decoration, uppercase labels, animated numbers.
