# Master build: requirement matrix (22 Oct 2026)

Branch `alpha-master-build`, starting at `83bfb57` (main after PR #12) with a clean working tree. Sources:
- *ALPHA — FINAL MASTER BUILD INSTRUCTIONS* (the brief);
- *Alpha Lane A Build Package* (22 Oct);
- *Alpha Pro Upgrade Blueprint*.

Status words used below:
- **Done**: implemented and tested.
- **Already correct**: reproduced; no change was needed.
- **Verified**: checked against code or data.
- **Blocked**: cannot be done here; the reason and owner are given.

## Gates (final run on this branch)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | 191 pass, 0 fail (13 suites, 4 new: waitlist, backup, plan, plus additions to lib/query/tools) |
| `npx next lint` | no warnings |
| `npm run lint:design` | passed (raw colours 9 of baseline 9, toFixed 0 of 0) |
| `node scripts/contrast.mjs` | 396 token pairs across 12 modes, all ≥ 4.5:1 |
| `node scripts/a11y.mjs` | axe: 0 serious/critical violations; 23 routes × phone, desktop light, desktop dark |
| `node scripts/integrity.mjs` | 45 of 45 (numeric, motion, ladder, back navigation, legibility) |
| `node scripts/budget.mjs` | passed. Every route except /company/ is 23–40 kB gz lighter than before: the 404 page had pulled the whole company page into every route's shared chunks. /company/ is +13 kB (192.6 → 205.7, within 10%). The baseline is tightened. |
| Engine tests | test_swing 33, test_registry 19, test_sessions 10 (new) |
| `scripts/visual.mjs` | **expected to fail.** Every page was redesigned, so the approved baselines must be re-recorded on CI (`visual-baseline.yml`, `[approve-visual]` flag) after review. |

Lab numbers only. No field Core Web Vitals are claimed; the RUM sample is too small.

## P0

| ID | Status | Evidence |
|---|---|---|
| A01 / E06 | Done | `newsdesk.ts`: a name followed by a word that continues a company name ("Capital", "Finance"…) is a longer entity, both in running text and in Title Case. The exact BusinessLine story of 21 Oct is a regression fixture. The weaker duplicate matcher was deleted. |
| A02 | Done | The chart's change now names its base ("vs the 20 Oct close"), so a missing bar or a different base is visible. The key-line trend is labelled short-term (C10). |
| A03 | Done | `decide()` defaults statement years to the row's `fy_count`. Every surface (Today, Tools, Peek, company, cards) counts the same check set, versioned `checks-1.2`. Covered by a test. |
| A04 / E01 / E03 | Done | `readcheck.ts` catches a percentage restated as the wrong number of paise and a percentile read against an average or median. A failing or under-review study is withheld by default: its figures are shown, and the original sits in a marked archive. The live feed's two flagged studies are caught, with no false positives across 42 studies. |

## Highest-priority P1s

| ID | Status | Evidence |
|---|---|---|
| A05 | Done | The Signals lag notice gives the last decision session, how many sessions behind, and the next run. **Root cause fixed (Lane A 0.2.1):** at 22:30 IST on 21 Oct, Yahoo had no daily 21 Oct bar for 940 of 941 stocks, so the book fell back to 19 Oct. A finished session is now rebuilt from its hourly bars (`engines/sessions.py`, `data.complete_from_hourly`) in Swing v2 and in the v3 nightly. This takes effect from the next scheduled run on main. |
| A06 | Done | Alerts stay off. The Method view shows holdout t, sample sizes, months, costs and forward evidence, all from the feed. |
| A07 | Done | v3 lifecycle per engine, kept separate from Swing v2. The record line is Lane A's text, verbatim. |
| A08 / T13 | Done | No account exists. `src/lib/account.ts` sets `ACCOUNTS_ENABLED = false`, so no sign-in UI shows. Backup and restore is a tested round trip instead. |

## Today (H)

| ID | Status | Evidence |
|---|---|---|
| H01 | Done | "the Nifty X% below its 52-week high" |
| H02 | Done | Factor breakdown with weights, plus changes since the previous published reading |
| H03 | Done | "Price stage: early drawdown"; it is stated nowhere as valuation |
| H04 | Done | Breadth block keeps the 988-priced and 920-with-history counts separate. The Barometer's own 200-day count is noted as differing. |
| H05 | Done | Signals card keeps four reasons apart: gate, inputs, validation, book |
| H06 / S08 | Done | An empty book leads with the reason and a research action; there are no performance calls to action |
| H07 | Done | NSE index vs Alpha basket labelled, with member counts |
| H08 | Done | Discovery cards and Screen rows show the data limitation (e.g. "Limited history: 2 fiscal years available") |
| H09 | Done | One authoritative session state: the masthead and the reading render once, after the live inputs settle (Lane A 0.2.3) |
| H10 | Done | Secondary text strengthened (`--muted #474c5f`); utility headers are compact |

## Company, Screen, Compare (C)

| ID | Status | Evidence |
|---|---|---|
| C01, C15, C18 | Already correct | Protected; integrity and tests still pass |
| C02 | Done | Chips, count and table come from one deferred value; "Updating…" shows with `aria-busy` |
| C03 | Done | Chips show the operator actually applied; boundary test at exactly 25 |
| C04 | Done | Every qualitative term has a definition with its boundary |
| C05 | Done | Column headers state their date basis |
| C06 | Verified | Size-class source and date stated; 15 companies have a class but no market cap |
| C07 | Done | `coverage.ts` names the data gate in words, kept apart from the research checks |
| C08 | Done | Growth is not called strong on fewer than 4 statement years |
| C09 | Done | Countercase includes thin history and a bottom-quartile technical score |
| C10 | Done | Key line labelled as short-term |
| C11 / C12 | Done | "latest intraday price"; the baseline is the last close before the window |
| C13 | Done | Previous-build rank move shown; longer history stated as not stored |
| C14 | Done | Every answer is labelled Rules, Glossary or AI-assisted |
| C16 / C17 | Done | "Average true range is X% of price"; "operating cash flow / net profit" |
| C19 | Verified, blocked upstream | Lenders' Quality rests on about 1 of 5 inputs (`q_conf` 0.2), and Piotroski is out of 7 with bank-inapplicable tests. Labelled "read with care" on Compare and never marked. The fix belongs in `trading-dashboard/stock_screen.py`. |
| C20 | Done | Visible "Source" and "Explain" buttons; 32 px on touch |
| New | Done | `rs3m` is a 3-month return gap in points, not a 0–100 score. Checks, case points, the momentum clause and labels are corrected (`checks-1.2`). |

## Signals (S)

S01–S10: Done.
- S06 is verified: TS marks are provisional and never execution events.
- S07 is tested in `tests/plan.test.ts`. The daily-bar fill rules live in the Python engine and its tests; the gap is documented.
- SEBI wording (Blueprint §6.1): "rulebook sandbox, not a model portfolio", "Rule match: N of N criteria met", "rule stop / rule T1/T2".

## Editorial and supporting pages (E)

| ID | Status | Evidence |
|---|---|---|
| E02 | Partly done | Business-model claims are labelled as model knowledge, not filing-sourced. A qualified reviewer is needed for a corrected study; the owner must decide. |
| E04 / E05 | Done | |
| E07 / E08 | Done | The seasonal worst year is not in the feed; the page says so |
| E09–E13 | Done | E13 bug fixed: the 7-day window covered 8 days |
| E14 + Lane A 0.2.2 | Done | Funds freshness strip and behind-schedule warning |
| E15 | Partly done | Blocked by the feed: it publishes 3 funds per category and no benchmark per category. A Nifty 50 index fund reference row is labelled as not the category benchmark. |
| E16 | Done | |
| E17 | Partly done | Labelled "as published by the source, not verified against exchange documents". Owner verification is still needed. |
| E18 | Done | Contract units added. Expiry is not in the feed, and the page says so. |

## Tools, retention, trust (T)

| ID | Status | Evidence |
|---|---|---|
| T01 | Done | |
| T02 / T03 | Already correct | |
| T04 | Done | 6 tests for edge cases; capital cap; check order fixed |
| T05 | Done | |
| T06 / T07 | Done | `backup.ts` round trip, 9 tests: twice-import idempotent, malformed file, newer version, markup |
| T08 | Done | |
| T09 | Blocked | No contact address can be published without the owner choosing one. The unsubscribe link deletes a waitlist address. |
| T10 | Done | |
| T11 | Verified | The holdings statement keeps its attested date (21 Oct) and is not rolled forward |
| T12 | Done | NSE 2026 holiday calendar (NSE/CMTR/71775) in `configs/nse_holidays.json`, shared by the site and the engines and held equal by a test |

## SEO, accessibility, security

- **SEO:**
  - Share image, 1200×630, plus a Twitter card.
  - Truthful WebPage/Corporation JSON-LD on company pages; no ratings.
  - Unknown companies return a real 404.
- **Accessibility:**
  - axe passes on every route.
  - Drawers use the one modal contract: focus trapped and restored, Escape closes.
  - Touch targets are 44 px.
  - Reduced motion removes transforms.
  - Pointer light, glow and springs are retired.
- **Security (waitlist):**
  - Same-origin and JSON-only POST, rate-limited, with a honeypot.
  - The same answer for known and unknown addresses.
  - Export and delete are owner-only, with a constant-time token compare.
  - CSV formula protection.
  - Unsubscribe deletes the address.

## Lane A Phase 0

| Item | Status | Evidence |
|---|---|---|
| 0.1 /pro/ copy | Done | The approved copy, verbatim. Homepage strip and footer link added. |
| 0.1 waitlist | Done, closed until configured | Durable Object list, double opt-in, unsubscribe deletes, owner CSV export, privacy rewritten in the same commit. It stays closed until the owner sets the mail secrets (below). |
| 0.2.1 Signals lag | Done | Root cause and fix described under A05 |
| 0.2.2 Fund job | Done | Failure state shown on /funds/ |
| 0.2.3 Flicker | Done | |
| 0.2.4 v3 empty boxes | Done | |

**One copy flag for the owner:** "Free Alpha runs one session behind." This is true today only because of the lag that this branch fixes. Free is not deliberately delayed until Phase 1 builds that.

## Blueprint (scope decision)

The Lane A package, decided on 22 Oct, sets this phase: waitlist only, no accounts, no payments, signals free. Built now:
- §2.1 earnings-quality checks, the measurable part. F1, F3 and F8 are computed from filed statements. F2 and F4–F7 are stated as not measured. There is no partial composite and no kill-switch.
- §4.2 journal market-at-entry matrix, facts only. Coaching advice text is omitted.
- §6.1 SEBI wording.
- The SEBI status line in the footer.

Deferred by Lane A, because each needs external accounts or data:
- §1.1 Vision domain;
- §1.2 licensed feeds and universe expansion;
- §3 Supabase auth and sync;
- §4.1 broker sync;
- §4.3 WhatsApp, Telegram and email alerts;
- §5 Razorpay and Stripe;
- §7.1 forensic share card (until all 8 pillars are measurable).

**Pricing conflict:** the Blueprint proposes ₹499/₹3,999. Lane A records ₹249/₹1,999 as settled on 13 Oct. Nothing on the site shows a price.

## Owner actions

1. **Waitlist mail:** verify askakshay.com in Zoho ZeptoMail, then set three Worker secrets: `MAIL_TOKEN`, `MAIL_FROM` and `WAITLIST_ADMIN_TOKEN` (`npx wrangler secret put …`). Until then /pro/ says the list is not open, and nothing is stored.
2. **Contact address** for corrections and data requests (T09).
3. Approve the new visual baselines after review.
4. Cloudflare zone Browser Cache TTL → "Respect Existing Headers". This is the open smoke-test failure on main.

## Deploy and rollback

- **Deploy:** merge to main. `ci.yml` runs, and `deploy.yml` builds and runs `wrangler deploy`.
  - The deploy adds one Durable Object class, `Waitlist` (migration `v3-waitlist`, SQLite, free plan) and one rate limiter.
  - The engines change takes effect at the next 18:00 IST run.
- **Rollback:** revert the merge commit and push; deploy runs again.
  - The `Waitlist` class and its migration may stay: they are unused when the code is reverted.
  - To remove the class, add a `deleted_classes` migration.
