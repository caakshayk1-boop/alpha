# Redesign validation

Environment: local production build (`npm run build`) served by `wrangler dev --local` on port 8799, Chromium (Playwright) on macOS, live data feeds as of 2026-10-14. **Lab results only. No field data, no real-device or Safari/Firefox testing.**

## Checks run, with results
| Check | Result |
|---|---|
| Unit tests (`npm test`) | 61 of 61 pass (was 55; +6 for NSE dates, price bands, news themes/time buckets/company matching/summary) |
| Type-check, lint | clean (`tsc --noEmit`, `next lint`) |
| Production build | passes, 21 static pages generated |
| Link audit (`scripts/audit.mjs`) | passed: 20 pages, 1,276 internal links, 13 feeds |
| Overflow and clipping sweep: 18 routes (company page for RELIANCE) at 320, 390, 768 px | 54 of 54 clean: no sideways overflow, no clipped text, no console errors or warnings, no text under 12 px |
| Same sweep at 360, 375, 600, 860, 1024, 1440 px | 102 of 108 clean. The 6 flagged are all `/map/` treemap tile labels (tiles too small for a 10 px label are hidden; the list under the map carries every name) |
| Same detector on the live build before the pass (390/760/860 px) | 57 combinations flagged (see audit) |
| Engines interactions at 390 and 1440 px (11 checks each) | pass: 5 cards, click and keyboard (Space) select, visible focus ring, detail follows selection, signal cards render, disclosures present |
| Engines URL state | `?engine=snapback&tab=record` set on click, restored after reload |
| News desk interactions at 390 and 1440 px (14 checks each) | pass: 18 stories render, time buckets, theme filter narrows 18→3, filter in URL and restored on reload, clear filters, search, save toggles, saved view, saved persists, no overflow, no console errors |
| Nav dropdown | reproduced the bug before the fix (menu still visible after click and after the pointer left); after the fix it is hidden after click and reopens on a fresh hover |
| `/magic/` | `HTTP 301 → /screen/` |
| Text contrast, approximate: every visible text node on 8 pages in light and dark at 390 px (script computes colour over the stacked background; AA 4.5:1, or 3:1 for large text) | 0 failing. Caveats: the script ignores text over images/SVG and treats semi-transparent layers approximately; it is not axe |
| Reduced motion and looping animation (Today, Engines, News) | no running or infinite animations in either preference (the ticker and aurora were removed) |
| Client bundle secret grep (`ANTHROPIC`, `sk-ant` in `out/_next`) | none found |
| Mutation test of the news matcher guard | removing the "name inside a longer name" guard makes a test fail; restored, all pass |

## Company quick look (added after the mockup review)
| Check | Result |
|---|---|
| Screen row opens a slide-over instead of navigating; filter and scroll position kept; symbol link still opens the full page; Escape and Close close it; focus moves in, is trapped, and returns without scrolling; News chips and rail open it | pass at 390 and 1440 px (66 checks) |
| Sideways overflow with the panel open at 390 px | was 422 px (locking scroll on `<body>` widened the phone viewport); fixed by locking `<html>`, re-measured 390 px |

## Visual flaws found by looking, and fixed (more than five)
1. "Evidence across checks" table became 200 px rows on phones → readable pick cards.
2. Engine comparison table hid the verdict columns on phones → engine cards.
3. Segmented tabs on phones: the sliding thumb drifted out of line with its label → selected tab filled itself, row scrolls.
4. IPO lifecycle arrows wrapped onto their own lines → hidden on phones.
5. Empty IPO books showed "0.00× subscribed" → "No bids reported yet".
6. Weekly Reads corrections rendered as a date with no text (feed field is `fix`, code read `what`) → fixed in code and type.
7. News false positive: "Reserve Bank of India" matched Bank of India; generic words ("Karnataka", "International") matched small companies → guard + large-cap rule, covered by tests.
8. Page intros cut with "…" → unclamped, six shortened.
9. Bottom-tab active label sat on a gradient (banned, and unmeasurable) → solid accent.
10. Every signal card repeated the engine's verdict line → shown once.

## Screenshots
`docs/screenshots/baseline/` (live site before) and `docs/screenshots/after/` (this build): home, engines, news, screen, company (TCS), ipo, each at 360, 390, 768, 1024, 1440 px, top 2,400 px, JPEG quality 45. The baseline's `news` page is the old list. Full-page captures of every route were reviewed during the work but not stored (size).

## Not done or not verifiable here
- **Lighthouse / Core Web Vitals:** not run. Neither Lighthouse nor axe is installed, and installing a tool is a separate decision. No LCP/INP/CLS numbers are claimed.
- **axe / WCAG 2.2 AA audit, screen reader, 200% zoom on a real device, Safari, Firefox, real phones:** not run. 200% zoom was approximated only by the 600 px width sweep.
- **Throttled network, killed API, offline, JavaScript disabled:** not tested. The pages are static shells that load data with JavaScript, so with scripts off the data areas stay empty.
- **Dark theme:** contrast measured, not every page reviewed by eye.
- **Auth, billing, pricing:** do not exist; nothing to test.
- **AI:** no feature is switched on (see `docs/ai-features.md`).
- **Deferred redesign:** Brief, Funds, Compare and a full Company restructure kept their layouts and received the shared grid, type and surface changes only.

## Known remaining issues
- News feed has 18 stories from the data repo, so "stocks in the news" is often 0–4 companies; matching favours precision over recall on purpose.
- Funds table still scrolls sideways on phones.
- Treemap tile labels under 10 px are hidden by design.
- `matchCompanies` and `rankPhrase` remain only because tests use them.
