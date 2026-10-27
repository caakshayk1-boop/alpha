# Tripwire launch hardening: evidence, blockers, go / no-go (27 Oct 2026)

Branch `tripwire-harden`. **Not merged, not deployed.** All evidence is from automated checks on a local build and CI. None of it is real-user or real-device validation, and none of it supports a production-readiness claim.

> Round 3 (27 Oct, later): see [ROUND3.md](ROUND3.md) for the changes made after this report (live overlay, book-2 rules, charts, RSI, PageSpeed) and the answers to the open questions.

## Verdict
- **GO** for a closed, invite-only research beta (small group, told it is paper-only and experimental, shown the Data and evidence screens).
- **NO-GO** for a public or production launch. Blockers below; the first group needs the owner.

## What was wrong, what changed

| Item | Finding | Change | Pinned by |
|---|---|---|---|
| Stale screen vs live quotes | Not a bug: the screen is the last close, quotes are live. The page never said which close, so the two read as one moment. | Picks are headed "Picks from the close of {day}", carry a freshness tag and "signal ₹X → y% since". Pipeline health compares every stage (screen, ledger night, overdue outcomes, quotes, Lab panel) with what the calendar says should exist. | `pipeline.test.ts` (7) |
| Session calendar | Weekday-only logic treated NSE holidays as sessions. | `calendar.ts`: official 2026 NSE equity holidays; years not listed are reported as unknown, never guessed. Every clock routes through it. Muhurat session (8 Nov) is listed but not modelled. | `calendar.test.ts`, cross-checked against the dates in `lab_panel.json` |
| Eligibility discrepancies D1–D3 | Written spec and code disagreed in three places (753 vs 459 names). | Explicit versions. `elig-1` = as built. `elig-2` = size class, turnover ≥ ₹10 cr, price ≥ ₹50 plus the base steps; effective from the 27 Oct data day. Ledger nights record `rules`; old nights read as `elig-1`; nothing rewritten. | `eligibility.test.ts`, `ledgerversion.test.ts`, `universe.test.ts` |
| GCSL price / from-high | Screen close 726.2 and from-high −3.1% printed beside live ₹746 (two bases on one card). | `basis.ts` `reprice()` recomputes everything that is a pure function of price (from-high, 52w, PE, PB, yield, new-high) from the live print; the rest is labelled "at close" or "statement". GCSL at 746.53 reads −0.4%, PE 48.8. | `basis.test.ts`; a test fails if a real-screen field has no declared basis |
| GCSL margin contradiction | Eligibility withheld margins for financials while company and compare pages still printed net margin. | Both gated by the same `meaningful()` predicate. | `eligibility.test.ts`, `journey.mjs` |
| Backtest versions | Results changed between runs with no record of why. | `provenance.py` stamps run id, code hashes, data window, universe, checkpoint closes, parameters, and lists in plain English what changed from the previous run. Data screen: "Back-test runs, and why a result changed". | `test_research.py` (first run, no change, history grown, closes restated, universe, params, code) |

## Reading comfort (P1)
Body is a proportional system font at 15 px / 1.55; mono stays on numbers, labels and controls. Muted text ≥ 6.9:1, down colour raised from 5.8 to ≥ 6:1. Secondary explanation sits in `details.more`. Layout unchanged. `comfort.mjs` checks fonts, contrast, disclosure, sticky bars with the keyboard open, reduced motion and 320/390/768 widths.

## Test evidence (local, 27 Oct)
| Suite | Result |
|---|---|
| TypeScript | clean |
| Unit (`tripwire:test`) | 222 / 222 pass |
| Research (`test_research.py`) | pass, incl. provenance and pairs |
| Browser: journey, a11y, beta, comfort | pass |
| Paper accounting | independent oracle, 600 random paths + invariants, agrees with the app's arithmetic |
| Persistence | restart keeps journal; export → import on a clean profile restores; storage failure shows a banner and keeps the unreadable data |
| Vitals (lab, throttled) | CLS 0.04–0.07 (limit 0.1); INP 120–232 ms, noisy |
| CI on branch | dispatched (`deploy=false`); see PR / Actions for the result |
| Research stamp run | `tripwire-research` on this branch; stamped files appear when it commits |

Lab numbers are a throttled headless browser. They are not field data.

## Services
Profile → Services lists each integration as configured, unavailable or not built, from the Worker's `/api/health` probe, not from wishful copy. Notifications are **not built**; the app says so.

## Remaining blockers
**Owner**
1. Waitlist / contact mail secrets and a real contact address.
2. Telegram or push secrets, if notifications are wanted.
3. Cloudflare Browser Cache TTL setting; pricing decision.
4. Data licensing: Yahoo and news sources are unofficial. Redistribution and SEBI research-analyst / advisory positioning need a professional opinion before any paid or public use.

**Engineering / evidence**
5. **Real devices not tested.** `DEVICE_TEST.md` is the script; it has not been run. Emulation does not cover iOS keyboard, Safari storage eviction or low-end Android.
6. **No real-user validation.** No one outside the build has used it.
7. **No evidence the engines work.** Momentum: not supported (t −1.94 net, −0.32 vs random picks). Quality: untestable on the available history. Pairs: not supported (t −6.45). Forward paper record is too small to say anything.
8. `elig-2` governs only picks from the 27 Oct data day; earlier nights stay `elig-1`, so the record is not comparable across the change.
9. The feed does not say whether turnover is mean or median; `elig-2` assumes the figure as published.
10. The nightly ledger's outcome evaluation has the same late-bar gap the Worker had (Yahoo's unfinished daily row); the Worker is fixed, the ledger job is not.
11. Capacity: Workers free plan is about 28 daily users at current request counts. No accounts, sync or backend journal: data lives in one browser.
12. Calendar covers 2026 only; it must be extended before January.

## What this does not show
Passing UI and unit tests shows the app does what the code says. It does not show the numbers are right against the exchange, that users understand them, that the strategies make money, or that it is legal to offer. Do not describe the result as production-ready.

## Recommended next actions
1. Review and merge (your call), then deploy with the existing dispatch.
2. Run `DEVICE_TEST.md` on one iPhone and one mid-range Android before inviting anyone.
3. Close owner items 1–4 before the first outside invite.
4. Invite 5–10 people for two weeks; the metric is whether they return and whether the Data screen answers their "why" questions.
5. Extend the 2027 holiday list when NSE publishes it.
