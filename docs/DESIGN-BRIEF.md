# Alpha relook: design brief and handoff

Date: 2026-10-13. Branch `relook-2026-10-13`. Screenshots: `docs/design/before` (the live site before this change) and `docs/design/after`.

## Who it is for, and the decision it supports
A person who wants a clear read of the Indian market and a way to look at one company, without having to decode a terminal.
The page should answer, in order: **what matters now, what changed, what deserves a closer look, what can I do next.**

## What was wrong (observed in the before screenshots)
- The home headline was a slogan ("India's market, measured."). The actual takeaway (Barometer 35 of 100, weak; Nifty 13.8% below its high) sat in a paragraph beside a decorative dial.
- Every number was set in a monospace font, including numbers inside sentences. That reads as a terminal, not an app.
- Section labels, tags and table headers were all capitals with wide letter spacing.
- The company header printed the same word twice ("Financial Services · Financial Services").
- The ticker's Pause control sat on top of the last quote. Rows that scroll sideways on a phone (tabs) gave no hint that they scroll.
- `/reads/` and `/rotation/` failed React hydration (a `<style>` text mismatch and a `<details>` inside a `<p>`), so the browser threw the server page away and re-rendered it.

## Direction
Principles taken from the 1% Club app (read from its public site and five App Store screenshots), not its layouts, copy or branding:
1. One plain-language takeaway per screen. The headline is the point.
2. A few big jobs on the home screen, each one tap away, with a live detail underneath.
3. Cards with one anatomy: label, value, one line of meaning.
4. One dominant action at each decision point.
5. Calm space, light backgrounds, one accent, sentence-case labels. Search is always one step away.

Kept from Alpha: the serif display face with one italic accent clause (its signature), the restrained palette and both themes, honest wording ("not a recommendation"), and every calculation, route and API.

**Reference gap, stated plainly:** the brief also names Linear, Stripe, Apple, Vercel and TradingView. They were not inspected in this pass.
"1club" was read as the 1% Club finance app; the gym-booking app of the same name was not used.

## Decisions implemented
| Area | Change | Evidence |
|---|---|---|
| Numerals | The numeric face is the UI face (Inter Tight) with tabular figures. The monospace font is no longer loaded. | Measured: "1111", "0000", "8888" are all 48.05px wide; three different rupee amounts are all 119.67px. |
| Labels | Eyebrows, tags, table headers and key/value labels are sentence case, 12.5-13px, normal tracking. Tags capitalise their first letter. | Screen and Engines before/after. |
| Today (home) | New top: takeaway headline and sentence built by `src/lib/takeaway.ts`, four facts, four job tiles, search tile. The dial and slogan hero were removed. | 4 unit tests; screenshots. |
| Freshness | A notice on every page when any dataset is behind the calendar (shipped earlier today). | See `src/lib/status.ts`. |
| Fixes | Duplicate sector label; ticker overlap; scroll hint on tab rows; the two hydration defects. | Console sweep: 0 errors. |

### The takeaway rule (so it never says more than the data does)
Headline: "A {band} market, {n}% below its high." using the Barometer's own band word (Strong, Firm, Mixed, Weak, Poor) and the Nifty's distance from its high; "close to its high" under 1%.
Sentence: Barometer score and change since the previous reading, India VIX with the Barometer source's own word, and the share of stocks above their 200-day average.
A missing figure drops its sentence and tile; it is never estimated. The Barometer's valuation stage ("Slightly cheaper") appears only as the Barometer's label, never as this page's advice. Nothing predicts, rates or recommends.

## Validation actually run (Chromium, desktop and emulated phones, local build)
- 53 unit tests, type-check, lint, production build, the CI link audit.
- 114 page-and-width combinations (the 18 sitemap routes plus the company page, each at 320, 375, 390, 768, 1024 and 1440px): 0 sideways overflow, 0 console errors or warnings. The company page was also loaded for four different companies (BSE, Reliance, TCS, HDFC Bank) at 320, 375 and 1440px: 0 overflow, 0 errors.
- Today: one `h1`; the search tile opens the palette and Escape closes it; all four tiles reachable by keyboard with a visible 2px focus ring.
- Contrast on Today's text, both themes: at least 5.48:1 (light), 5.78:1 (dark); the standard needs 4.5:1.
- 200% zoom equivalent (720px wide): no overflow. Reduced motion: hover motion off, no running animations.

## Not done, and known issues
- **Only Today is redesigned.** Brief, Markets, Screen, Company, Engines, Map and the rest keep their old layouts; they received the shared foundation (numbers, labels) and fixes only.
- Verdict tags ("LEANING POSITIVE") are still capitals because the data is uppercase; fixing it needs a display helper wherever they are rendered.
- Company score card: the "Value" row wraps to two lines on a 375px phone.
- Not measured: Lighthouse or real-device performance, Safari/Firefox, a screen reader, the dark theme of every page by eye, layout shift from font swap.
- Brand accents versus financial colours: unchanged and not re-audited.

## Release and rollback
Everything is plain code on one branch; deploys use the existing CI then deploy workflow. To roll back, revert the merge commit and let the workflow redeploy, or use the Cloudflare dashboard (Workers, `alpha`, Deployments) to return to the previous version.

## Worth doing next (in order)
1. Bring the same anatomy (takeaway headline, key facts, one action) to Company and Screen.
2. A display helper so verdict tags are sentence case everywhere.
3. A real-device and Lighthouse pass on a mobile profile.
4. Inspect the other named references and write down what, if anything, they change.
