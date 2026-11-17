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

## Not run in CI, and why
These wait for headings or controls from designs that were retired, so they fail on the live app for reasons that are not app bugs. They were left in place, not deleted, because deleting tests is the owner's call.

- `accessibility.mjs`, `browser.mjs`: wait for the heading "Your market workspace" (old shell).
- `studio.mjs`: waits for "Patterns worth investigating" (retired Studio).
- `cockpit.mjs`: waits for "Since your last visit" (retired Cockpit).
- `terminal.mjs`: clicks the Comfortable/Compact density buttons, which `.density-control{display:none}` hides since the Canvas rebuild.
- `production.mjs`: runs against the live site, not a local Worker.

## Fixed on 17 Nov 2026
- `session.mjs` waited for `.observatory-hero` to be visible; it now lives inside the collapsed "Advanced research" panel, so it waits for the element to be attached.
- `features.mjs` asserted four `.health-check` elements; the business-health panel was retired with the Canvas home (`healthPanel()` is imported in `app.js` and never rendered).

## Known, not fixable in code
- Cloudflare Web Analytics beacon is blocked by the CSP. It is injected by the zone, not by this repo; turn off Web Analytics auto-injection in the Cloudflare dashboard, or accept the console warning. The CSP header was not loosened.
- The sitemap lists only `/`: routes are hash-based (`#/company/TCS`) and crawlers do not index fragments.
