# Alpha redesign audit

Branch `redesign/alpha-v2`. Labels: **Observed** (seen in the repo or a browser), **Measured** (a number from a check run), **Inferred** (reasoned, not verified).

## 1. System map (Observed, from the repository)

| Area | What is there |
|---|---|
| Framework | Next.js 14 static export (`out/`), React 18, TypeScript. One runtime dependency besides React/Next: `gsap` (used for reveal/count-up motion). Dev: eslint, typescript, wrangler. |
| Hosting | Cloudflare Worker `alpha` (`worker/index.js`) serves `out/` as static assets; the Worker runs first only for `/data/*`, `/api/*`, `/c/*`. Custom domain `alpha.askakshay.com`. |
| Routes (17) | `/` Today, `/brief`, `/markets`, `/screen`, `/company`, `/map`, `/rotation`, `/engines`, `/reads`, `/ipo`, `/funds`, `/news`, `/tools`, `/compare`, `/calendar`, `/watchlist`, `/journal`, `/about`, plus `404`. `/magic` was removed in this pass and 301-redirects to `/screen/` (`public/_redirects`). |
| Worker routes | `/data/*.json` (proxy of the data repo's feeds), `/api/quotes`, `/api/px`, `/api/chart`, `/api/ipo-live` (NSE book), `/api/explain` (AI, off without a key), `/c/<SYM>.json` (per-company shards built at deploy). |
| Styling | One `src/app/globals.css` with CSS variables (colour, spacing, radius, motion), light and dark themes, `Instrument Serif` display + `Inter Tight` UI via `next/font` (self-hosted at build, `display: swap`). No Tailwind. |
| Data | Feeds are JSON files produced by Python jobs in the separate `trading-dashboard` repo and by `engines/` here. No database, no accounts. Browser storage only (watchlist, journal, saved news, last visit). |
| Auth / billing | **None.** There is no login, subscription, pricing page or payment flow. The brief's pricing, account and billing requirements are not applicable and were not invented. |
| AI | One model call: `/api/explain` (company Q&A, model `claude-haiku-5-5`, `max_tokens` 400), switched off until `ANTHROPIC_API_KEY` exists. See `docs/ai-features.md`. |
| SEO | Per-route `layout.tsx` metadata for all 17 routes, `sitemap.xml` (17 URLs after this pass), `robots.txt`. |
| Tests / CI | 61 unit tests (`npm test`), `next lint`, `tsc`, link audit (`scripts/audit.mjs`), post-deploy smoke test; workflows `ci`, `deploy`, `engines`, `smoke`. |

## 2. Baseline (live site before this pass)

Screenshots: `docs/screenshots/baseline/` (360, 390, 768, 1024, 1440 px; six representative routes; top 2,400 px). Full-page captures of all routes at 390/760/860 px were used for the checks below.

**Measured on the live build at 390/760/860 px (19 routes):** 57 route-and-width combinations flagged by an overflow/clipping detector. Real clipping, not detector noise: signal cards on Engines (text cut at the card edge), the Tools position-size panel (+118 px), fund-house and company names on Funds/Screen/Magic, treemap labels on Map, 10 px text on Map.

**Observed problems, by theme**
- *Layout:* two-column grids stayed two columns between 641 and 860 px, giving ~180 px cards; cards use `overflow:hidden`, so content was cut instead of wrapping.
- *Hierarchy:* Today repeated the same facts four times (headline, facts, brief card, breadth panel); a scrolling ticker duplicated the Board and covered its last quote.
- *Tables on phones:* the "Evidence across checks" table became 200 px-tall rows; the engine comparison table needed sideways scrolling to see the verdicts.
- *Copy:* page intros were cut with "…" by a line clamp; one typo ("One a sector"); verdicts in capitals; `Rs.` and `₹` mixed; dates in two formats on IPO.
- *Defects found by looking:* Weekly Reads correction notes rendered blank (the code read `what`, the data field is `fix`); nav dropdown stayed open after a click (reproduced in Chromium).
- *Decoration:* three drifting blurred "aurora" blobs, blurred glass panels, glowing hover halos, gradient buttons.

## 3. Capability status

| Capability | Status | Evidence |
|---|---|---|
| Market read, screen, company pages, map, rotation, calendar, tools, watchlist, journal | Real | pages load real feeds; 17 routes pass link audit |
| Five ML engines, signals, track record | Real (live record is empty: nothing closed yet, and the page says so) | `engines.json`, Scoreboard |
| Live quotes | Real (Yahoo via Worker; 17 h old after hours, labelled) | `/api/quotes` |
| IPO live book | Real (NSE; cached 15 min) | `/api/ipo-live` |
| Ask about this company (AI) | Incomplete: built, rate-limited, **off** (no key) | `worker/index.js:391` |
| Plain-English screen search | Real, rule-based (not AI) | `src/lib/nl.ts` |
| Accounts, pricing, payments | Does not exist | no code |

## 4. Who it serves (Inferred from content and data, not from analytics)
Self-directed Indian retail investors who want a plain read of the market, a screen, and an honest record of what a set of models picked. No analytics exist, so usage evidence is "no data".

## 5. Not verified in this pass
Lighthouse and axe were not run (neither is installed; adding them is a dependency decision). Real-device performance, Safari/Firefox and screen readers were not tested. See `docs/redesign-validation.md`.
