# ApexPro tests: what CI runs, and what it does not (17 Nov 2026)

CI (`.github/workflows/apexpro.yml`) builds, requires the committed `apps/apexpro/public/` to equal the build, then runs:

| Suite | Engines | Covers |
|---|---|---|
| `model.test.mjs` | node | scores, ladder, vet rules (14 tests) |
| `session.mjs` | Chromium + WebKit | market cadence, stale state, failed refresh |
| `features.mjs` | Chromium + WebKit | company page, chart controls, updates |
| `canvas.mjs` | Chromium + WebKit | research canvas, matrix, export |
| `chart-intervals.mjs` | Chromium + WebKit | D/W/M, RSI, divergence |
| `resilience.mjs` | Chromium | offline reload, failed feeds, backup merge |
| `research-edition.mjs` | Chromium + WebKit | research tools, exports |
| `ultimatum.mjs` | Chromium + WebKit | navigation, motion, reduced motion |
| `ultimatum-accessibility.mjs` | Chromium | axe, seven routes, both widths and palettes |

## Deleted on 17 Nov 2026 (owner's decision)
`accessibility.mjs`, `browser.mjs`, `studio.mjs`, `cockpit.mjs` and `terminal.mjs` were removed. They waited for headings and controls from designs that no longer exist ("Your market workspace", "Patterns worth investigating", "Since your last visit", the Comfortable/Compact density buttons that `.density-control{display:none}` hides) and failed on the live app for reasons that were not app bugs. Accessibility is covered by `ultimatum-accessibility.mjs`. They stay in git history. `production.mjs` is kept: it targets the live site, not a local Worker, so CI does not run it.

## Fixed on 17 Nov 2026
- `session.mjs` waited for `.observatory-hero` to be visible; it now lives inside the collapsed "Advanced research" panel, so it waits for the element to be attached.
- `features.mjs` asserted four `.health-check` elements; the business-health panel was retired with the Canvas home (`healthPanel()` is imported in `app.js` and never rendered).

## Known, not fixable in code
- Cloudflare Web Analytics beacon is blocked by the CSP. It is injected by the zone, not by this repo; turn off Web Analytics auto-injection in the Cloudflare dashboard, or accept the console warning. The CSP header was not loosened.
- The sitemap lists only `/`: routes are hash-based (`#/company/TCS`) and crawlers do not index fragments.
