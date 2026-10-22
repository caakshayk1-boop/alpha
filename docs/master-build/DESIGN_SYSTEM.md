# Alpha design system v4 (master build, 22 Oct 2026)

`src/app/premium.css` is the last stylesheet loaded. It owns tokens, type, surfaces and motion. Older layers in
`globals.css` still style components that have not been rebuilt; where they disagree, premium.css wins by load order.

## Principles
- Luxury comes from type, spacing and precision. Borders come before shadows. One dominant accent area per viewport.
- Today and editorial reads may use the display serif (`--f-display`). Every utility page leads with a compact sans header
  (`PageHead`, 26–34 px, `font-family: var(--f-ui)`, weight 600). Section heads (`SectionHead`, `.sec-title`) are sans 22 px.
- Numbers are sans with tabular figures. Colour carries state (up, down, warning, selected), never decoration. No pastel tiles.
- One dominant action per page (`.act.primary`, ink on canvas). Secondary actions are `.act`; quiet ones are `.act.quiet`.
  Share, image and export go into the `Overflow` menu (`src/components/company/Parts.tsx`).
- Motion clarifies a change and stops. No cursor effects, glow, loops, springs, count-ups on prices, parallax or repeated
  scroll reveals. Drawers 220 ms, tabs/filters 160–200 ms, buttons 120 ms. Reduced motion removes transforms.
- Every empty, stale or error state is a `.state` block: a bold reason and a next action. Never a bare dash panel.

## Tokens
Canvas `--bg #f6f5f1`, surface `--panel #fff`, ink `--text #171a2b`, secondary `--muted #474c5f`, tertiary `--dim #5e6473`,
accent `--accent #6355d9`, accent text `--accent-2 #4a3cc4`. Dark mode has its own tuned values. Spacing `--sp-1..7` =
4/8/12/16/24/32/48. Radius `--r-card 14px`, `--r-ctl 10px`. Type `--fs-xs..3xl` = 12/13/14/16/18/22/28/36.

## Building blocks (class → use)
- `.card` (`.tight`, `.flush`), `.card-h` (h2/h3 + `.more` link), `.card-foot` – the standard surface.
- `.grid-lead` (7/5), `.grid-2`, `.grid-3` – responsive grids that collapse below 960 px.
- `.rows` > `li` > `.row` (`.row-t`, `.row-s`, `.row-r` + `small`) – list rows, 44 px minimum height. `.kvrow` for label/value.
- `.pill` (`.ok`, `.warn`, `.bad`, `.acc`, `.nodot`) – status in words with a mark.
- `.metrics` – a strip of label / value / basis tiles.
- `.secnav` – sticky section navigation (tabs with `role=tab` / `aria-selected`).
- `Drawer` (Parts.tsx) – side drawer / bottom sheet under the one modal contract (`useModal`).
- `.state` – designed empty / stale / error state with `.acts`.
- `.ideas` / `.idea` – one reason, one limitation, one link.
- `.fresh-pill` – the one global freshness indicator (header). Pages warn locally only where affected.

## Shared computations (never re-implement)
- Research checks: `decide()` in `src/lib/decision.ts` (versioned `CHECKS_VERSION`). Statement years default to `row.fy_count`.
- Ranking ideas: `rankIdeas()` in `src/lib/ideas.ts`. Upcoming results: `upcomingResults()`.
- Data eligibility in words: `eligibility()` in `src/lib/coverage.ts`.
- Upstream copy errors: `fixCopy()` in `src/lib/copyfix.ts`.
- Prices: `priceView()` / `priceLabel()` in `src/lib/price.ts`. Freshness: `useDatasetStatus()` in `DataStamp.tsx`.
- Review snapshots: `src/lib/review.ts` (key `alpha-reviewed`).
