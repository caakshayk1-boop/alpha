# Design agent: Analyze, accents and neon (20–21 Oct 2026)

Branch `worktree-agent-a044caaf8fc3a380f`, based on `08b1419`.

## What changed

| Area | Change |
|---|---|
| Tools (`src/app/tools/`) | Rebuilt as a decision hub. First screen: 8 question cards, each with one line and one action. New `calc.tsx`: Position size, **Expected value of a plan (new)**, CAGR, Loss recovery, SIP. Each has stepper fields (−/+, arrow keys, unit in the box), a validation message under the field, one result block, and a "Working" list ("what = how = result"). Pure arithmetic sits in `math.ts`, tested in `tests/tools.test.ts` (6 tests, hand-worked values). Portfolio X-ray, Reverse DCF and Confluence come unchanged from `components/AiTools.tsx`. Sticky group nav. |
| Compare | First screen: four numbered slots (filled ones link to the company, ✕ removes), a picker with "Clear all", three steps (the current one lit), ready-made sets as cards. The table and score profiles are unchanged. |
| Shell | Every nav menu item shows a one-line description (`PAGES[].desc`). New accent control beside the theme switch: radiogroup popover, arrow keys, Escape, saves `alpha-accent` in localStorage (try/catch). |
| layout.tsx | Only the inline head script: applies a saved accent before first paint (no flash). |
| globals.css | Accent tokens per accent × theme; `--neon`, `--neon-ink`, `--neon-glow`, `--neon-faint`. Neon only on: focus halo, active nav pill glow, live-dot pulse, gauge arc, pointer light on hovered cards, scroll progress, the section-head underline (draws in as the head reveals, 380 ms, scaleX). Site-wide: designed `.notice` and skeletons, press feedback on chips/segments, accent-tinted table row hover. |

Not done (be explicit): a page-by-page redesign of markets, news, ipo, reads, funds, rotation, calendar, watchlist, journal, about, map and screen. Those pages receive the shared changes above (section heads, notices, skeletons, table hover, press feedback, accents) but no page-specific rework.

## Contrast (WCAG 2.x, computed by script, every surface: bg, bg-2, panel, panel-2, panel-3, accent-soft)

| Accent | Theme | --accent as text, lowest (on) | --accent-2 as text, lowest (on) | --accent-ink on fill | focus ring vs surfaces | --neon vs --bg (non-text only) | gauge arc on ink | Pass |
|---|---|---|---|---|---|---|---|---|
| violet | light | 4.99 (panel-3) | 6.28 (panel-3) | 6.04 | 4.99 | 3.48 | 8.62 | yes |
| violet | dark | 5.70 (accent-soft) | 7.44 (accent-soft) | 7.86 | 5.96 | 5.95 | 8.62 | yes |
| cyan | light | 5.28 (panel-3) | 6.45 (panel-3) | 6.40 | 5.28 | 1.56 | 11.76 | yes |
| cyan | dark | 7.67 (accent-soft) | 9.34 (accent-soft) | 11.25 | 8.54 | 12.41 | 11.76 | yes |
| lime | light | 5.77 (panel-3) | 7.17 (panel-3) | 7.00 | 5.77 | 1.42 | 14.41 | yes |
| lime | dark | 9.08 (accent-soft) | 10.01 (accent-soft) | 14.20 | 10.77 | 16.15 | 14.41 | yes |
| coral | light | 4.84 (panel-3) | 6.01 (panel-3) | 5.87 | 4.84 | 2.48 | 8.75 | yes |
| coral | dark | 6.73 (panel-3) | 8.41 (panel-3) | 8.87 | 6.73 | 7.43 | 8.75 | yes |

Neon fails as text on paper (cyan 1.56, lime 1.42, coral 2.48), so in light themes it is never text: the focus outline is `--accent` (≥ 3:1 non-text) and neon is only the halo around it. Pass rule: both text steps ≥ 4.5, ink on fill ≥ 4.5, focus ring ≥ 3, arc on ink ≥ 3.

Risk: coral (`#b23d1c` light) sits near `--down` (`#b4233a`). Gains and losses always carry a sign or arrow, so meaning never depends on colour, but a reader on coral sees accent and loss as similar hues.

## Checks (local, `wrangler dev --local --port 8831`)

- type-check, lint: clean. `npm test`: 87/87 (81 before + 6 new). build: ok. `node scripts/audit.mjs`: passed.
- axe (WCAG 2.2 AA), `/`, `/tools/`, `/compare/`, `/engines/`, phone + desktop, × 4 accents × light/dark: 0 violations.
- sweep (320/375/768/1440) on the same 4 routes: clean (first run found a 120 px overflow on /tools/ at 320: the Reverse DCF panel in a grid item without `min-width: 0`; fixed).
- WebKit iPhone 15 on the same 4 routes: 4/4 PASS.
- Not run: axe/sweep/WebKit on the other owned routes (they only got shared CSS), and a layout-shift measurement.
- Screenshots: `docs/screenshots/agents/design-{today,tools,compare}-{accent}-{phone,desk}-{light,dark}.png` (48).
