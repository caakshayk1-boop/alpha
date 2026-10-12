# Audit fixes, 12 October 2026

Source briefs: `Alpha_Launch_Audit_Claude_Code_2026-10-12.md` and `site-audit-claude-code-brief.md`.
Branch: `audit-fixes-2026-10-12`. Status: **built and tested locally; not deployed from this branch until reviewed.**

## P0

| Issue | Status | Fix | Evidence |
|---|---|---|---|
| Breadth 46% / 47% / 50% and mixed dates (8, 9, 12 Oct) | Fixed | One definition, `src/lib/breadth.ts` (above 200-day among stocks with a 200-day history, denominator shown). One status contract, `src/lib/status.ts`, separates market-session date (`as_of`), last refresh and render time. `DataStamp` on Today, Brief, Markets, Screen, Engines, Rotation, Map, Compare; "Data dates" table on About. | `tests/lib.test.ts` (freshness incl. the 8/9 Oct case, breadth) |
| Company page price vs chart (LCL ₹541.71 vs ~₹631) | Mitigated, source unverified | Page now states which price each sentence uses (screen close vs live quote) and shows an alert when they differ by more than 8%. Root cause (symbol mapping or corporate-action adjustment) needs checking against the upstream feed. | Manual route check |
| Partial history labelled "3Y median", "1Y return" | Fixed | `honestHistory()` rewrites to "median of the N years on file"; growth checks need ≥4 statement years; chart labels "since its first price on file (N months)". | `decide()` tests; manual LCL check |
| "Hit all targets" > "Reached T3" | Fixed | Exit categories are now `stop, breakeven, after_t2, all_targets, time` from one trade list; `all_targets` equals `hit_t3`. Past results are not rewritten; the same 2,611–2,756 trades are re-bucketed. | `engines/tests/test_ai.py` (41 checks), smoke check |
| Snapback "EDGE SHOWN" vs +0.02R, t = −0.05 | Fixed | Three verdicts per engine: ranking skill, net trading result, alert eligibility (needs both). Snapback and Barrier are break-even after costs and no longer alertable. Engines page, brief, Telegram and bot wording updated. | `ai_finalize.py`, `public/engines.json`, bot tests (42) |
| Confluence 4/4 vs 9/9, BUY labels | Fixed | Shows passed of applicable plus not-applicable count; needs ≥6 applicable checks; BUY replaced by "Screen class" research wording. | `decision.ts`, `AiTools.tsx` |
| Weekly Reads: Travel Food arithmetic | Fixed | 40% margin = 40 paise per revenue rupee; 65th percentile = higher than about 65% of its own history, not cheap against its past. | `news/test_reads_claims.py` |
| Weekly Reads: IKS | Fixed | Rewritten from company disclosures (ikshealth.com and the AQuity release): revenue cycle, coding and clinical documentation for US providers. EMR/LIS, NDHM and Indian-hospital claims removed. Sources listed. | Study text; `sources` field |
| Weekly Reads: Nippon fees, MMTC allegations | Fixed | Fees are accrued daily in NAV (AMFI), not billed to investors. MMTC allegations of manipulation and promoter funding removed; the inconsistent feed figures are stated as such. | Study text |
| Signature study: margins applied to "earnings" | Fixed (found during checks) | Restated as paise per revenue rupee. | `test_reads_claims.py` |

Each corrected study carries a visible `corrections` entry. New `claim_problems()` validator in `weekly_reads.py` blocks bad ordinals, percentile wording, fraction-vs-margin, allegation language and fee misstatements, with a rewrite-once-then-reject path.

## P1

| Area | Status |
|---|---|
| Engines / About | Contradiction removed (dynamic launch date and closed count); "Signal close" replaces "Buy zone"; target hit rates labelled historical frequency with n |
| Magic Formula | Renamed "Greenblatt-inspired ranking of eligible companies", ranked N of universe, minority-interest notice above the table |
| IPO | Per-part score explanation, GMP marked unofficial, listing date "Not announced", Chittorgarh link |
| Funds | Retitled; NAV date and AMFI code per fund; lump-sum not SIP XIRR |
| Rotation / Map | "How sector strength is changing"; no flow or fixed-order claims; official vs Alpha group indices tagged; text version of the map for screen readers |
| Screen / Compare | Data stamp; missing values excluded from best-value highlighting and read aloud as "better value"; CAGR period and financial-sector notes. TCS market cap shows "Not in the feed" |
| Tools / Watchlist | Reverse DCF labelled a teaching model; input validation; watchlist export/import as versioned Research Cards with preview; nothing is uploaded |
| Brief / Calendar | "Over the past week"; rotation link fixed; plurals; provisional results dates with NSE link |
| News / Reads | Timestamps, topic and source filters, clamp; Markdown tables render; "studied properly" replaced |
| Global | "82nd"-style ordinals via one helper; blanket LIVE badges replaced by market-open / last-close states; grouped navigation; unique titles and descriptions on 17 routes |
| Performance | Company data served per company (`/c/<SYM>.json`) with a static fallback; Confluence lazy-mounted. Lighthouse mobile: company 21→55, home 62→74, engines 76→86 |

## Verification this session

- `npx tsc --noEmit`, `npm run lint`: clean
- `npm test`: 15 pass
- `engines/tests/test_ai.py`: 41 pass; `test_registry.py`: 13 pass
- `npm run build`: 20 routes; `node scripts/audit.mjs`: 1316 links, passed
- news: `test_reads_claims.py`, `test_brief_fit.py` (16), `test_engine_alerts.py` (13) pass

## Found after the audit

- Infosys (INFY) statement history is about 90x too small in the published feed (rev_cr 2,016 against market cap ÷ P/E implying profit of about ₹29,800 cr); it looks like USD labelled as ₹ crore. Eighteen other large caps reconcile. This affects the company page's statement-based figures for INFY and anything derived from absolute statement values. A separate task has been raised; not fixed on this branch.
- TCS and Reliance have no market cap in the screen.

## Not verified / owner action

- Live site not re-tested after this branch (not deployed). Smoke test and a Lighthouse rerun are the first steps after deploy.
- LCL price mismatch root cause is upstream data; needs a look at the feed for that symbol.
- `public/engines.json` verdict fields were merged from the regenerated results; the next nightly run rebuilds the whole file.
- Weekly Reads corrections were applied by hand to the published edition. Other studies in older editions were not re-audited.
- Privacy, terms, FAQ and contact copy were not written; they need your wording.
- Cloudflare API token secrets, `SUPADATA_API_KEY` and a Vercel token for the bot are still pending on your side.
