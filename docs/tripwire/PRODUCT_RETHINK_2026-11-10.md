# Tripwire, rebuilt from scratch: what I would do differently

**Date:** 10 November 2026
**Status:** a proposal. Nothing here is built unless it is listed under "Implemented with this note".

## The answer in three lines

1. Today, Tripwire is a **research browser**: many good screens that a person reads. If I started again, I would make it a **decision system**: the unit is a *decision you made*, not a page you visited.
2. The name already says how it should work. Each decision carries **tripwires**: conditions a machine can check, such as "close below ₹2,400", "ROCE under 15% in the next annual report" or "results on 14 Jan". An on-device evaluator checks the latest downloaded snapshot when the app opens, and Today shows what tripped or is due. Unattended monitoring would require a separately designed opt-in service.
3. Over time, the product scores **your decisions**, not the market. It records what you expected and what happened, so you learn where your judgement is good and where it is not. Everything stays paper-only and stays on the device by default.

## What stays (it is already right)

- **Company-first and evidence-first.** Each claim travels with its figure, rule, date and limit. Every new feature keeps this.
- **Paper only, local-first, no accounts by default.** This is a trust advantage, not a gap.
- **Honest absence.** A missing figure is shown as missing, never as zero. "No flag" never means "no risk" (made stricter today; see the end of this note).
- **Deterministic reads before any AI persona.** Explanations are built from rules you can rerun.

## What I would build differently

### 1. One core object: the Decision

**Now:** the journal, paper plans, follows, saved screens and paper trades are five separate stores with five separate screens.
**Instead:** one versioned record:

| Field | Example | Why |
|---|---|---|
| Company and stance | TCS · watch / own (paper) / avoid | the thing being decided |
| Because | 2 to 3 evidence items, each linked to a fact card | why now |
| Unless | conditions that would prove it wrong | the countercase, made concrete |
| Tripwires | machine-checkable versions of the Unless list, plus a review date | so the app can watch for you |
| Confidence | 50 / 60 / 70 / 80 / 90% | for calibration later |
| Sizing (optional) | a paper position from the existing plan calculator | the risk, in rupees |

Follow, thesis and plan become **three depths of the same object**: a follow is a decision with no stance yet. This removes most of the "where did I put that?" navigation, and it is the root cause of why My Desk needed a guide at all.

### 2. Tripwires that actually trip

**Smart:** each Unless line is either typed free text or picked from a small grammar the on-device evaluator can evaluate:

- price: close below or above X, a fall of Y% from the entry, below the 200-day average for N sessions
- fundamentals: next reported ROCE, margin, debt-to-equity or cash conversion crossing a level
- ownership: promoter stake or pledge changes by more than N pp; an FII/DII change in the quarter
- calendar: results date, AGM, a review date you set

The nightly build already computes all of these figures for 988 companies. Evaluating price and calendar conditions on the device needs no new data source. Fundamental and ownership rules require reliable dated observations first. No local condition is monitored while the app is closed.
**Productive:** Today stops being a dashboard to scan and becomes a **queue**: *tripped*, *due for review*, *new evidence on a decision*. Each item has exactly one action (review, update, close) and is cleared when handled.

### 3. Calibration: score the decider, not the stock

When a decision closes, or on its review date, the app asks one question: did what you expected happen? Over 20 or more decisions it shows:

- the **Brier score**, and a calibration curve of stated confidence against how often you were right
- hit rate **by reason type**, for example "your valuation calls are 7 of 9, your momentum calls 2 of 8"
- how often an Unless condition fired and you **ignored** it

This is the most decision-improving feature a research tool can have, and almost no retail tool offers it. It needs no market data beyond what Tripwire already stores. It is only an honest mirror if the confidence is recorded **before** the outcome, so the field is locked once the decision is saved.

### 4. One provenance model under every card

The audit found five date strings on one company page and "filing publication date not supplied" on four cards. Today I added a single "Data as of" block and a per-claim publication label. The rebuild would go further, with one shared `Evidence` type:

`{ value, unit, period, source, document, published, retrieved, rule, limit, freshness }`

Every card, sentence, decision reference and CSV export would read from it, so freshness is computed once and cannot disagree between screens. **Missing piece:** an NSE announcements and filings feed, which gives real publication dates and corporate actions (splits, bonuses, dividends) that the chart and accounts currently lack.

### 5. A decision-aware chart

The chart should carry **your** context, not only the price:

- markers for your decision dates and versions ("v2: thesis revised"), results dates and filings
- your tripwire levels drawn as lines, with distance-to-trip shown on the axis
- a "since my decision" range next to 1Y/3Y/5Y, so the first question ("how has this gone since I decided?") is one tap
- relative-to-sector as a third comparison next to price and Nifty

### 6. Comparison is the default, not a separate screen

Every figure appears with **two anchors**: the company's own five-year range, and its sector percentile. "ROCE 66.6%" means little alone; "66.6%, 92nd percentile in IT, near the top of its own range" is a reading. The data for both anchors is already in the screen file.

### 7. A keyboard-first workspace for daily use

- a ⌘K command palette: jump to a company, open a decision, run a saved screen, add a tripwire
- `j/k` through the queue, `e` to edit a decision, `r` to mark reviewed
- a weekly review mode, timed at about 10 minutes: due items first, then tripped, then everything untouched for 30 days

### 8. Portfolio-level view of paper decisions

This answers what single-company pages cannot: sector concentration, the largest paper loss if every stop is hit, correlation between holdings, and how many decisions rest on the same reason. The plan calculator already has the inputs.

### 9. Optional, encrypted sync

Local-first stays the default. A person who wants two devices can opt into end-to-end-encrypted sync, so the server never sees the plaintext. Until then, export/import stays, and today's test suite verifies it round-trips exactly.

### 10. Screens that explain their own empty results

A saved screen should show *why* a name is in or out (the existing screen-feedback idea, made permanent) and *what changed since last run*: entered, left, and which condition moved. Today's empty-state fix is the first step.

## What I would deliberately not build

- buy/sell signals, target prices or "conviction scores" presented as advice
- a chat persona that speaks with more confidence than the evidence supports
- ticker strips, pulsing alerts, streaks or celebration animations: motion for attention, not information
- social feeds or copy-trading
- live-market framing for data that is end-of-day

## Order of work, each with a pass/fail check

| Phase | Build | Check (binary) |
|---|---|---|
| 1 | Decision object; journal, plans and follows migrated into it | old backups import into the new model with zero lost versions (round-trip test) |
| 1 | Tripwire grammar (price and calendar first) and an on-device evaluator | each condition type has a fixture that trips and one that does not |
| 1 | Today as a queue | each item has one action, and the queue empties when handled |
| 2 | Calibration, after 20 closed decisions | Brier score recomputed by hand on a fixture matches the app |
| 2 | Shared Evidence type and filings feed | no card shows a date that disagrees with the as-of block (browser test) |
| 2 | Decision-aware chart | markers fall on the right session (unit test on the date mapping) |
| 3 | Palette, keyboard and weekly review | every action reachable without a mouse (a11y suite) |
| 3 | Portfolio view; optional encrypted sync | the server stores ciphertext only (inspection test) |

## How to tell it is working

Do not measure time on site. Measure:

- the share of decisions saved with at least one machine-checkable Unless
- the share of tripped items reviewed within 2 sessions
- calibration gap: stated confidence minus realised hit rate, trending toward zero
- decisions closed with a written lesson

## Risks

- **Assumed:** rules on publishing research about Indian listed companies, including SEBI's research-analyst framework, apply differently to a personal paper-only tool than to a published one. If wrong, the calibration and decision features stay private-only and nothing is shared. This needs a qualified legal review before any public or paid launch; I have not verified the current regulation in this session.
- **Likely:** a filings feed is the hardest dependency. NSE pages change, and scraping them is brittle. This is based on the existing news and FII/DII jobs, whose cron has already been unreliable.
- Calibration needs volume. Under about 20 closed decisions the numbers are noise, and the app must say so instead of showing a score.

## Implemented with this note (10 Nov 2026)

These parts are implemented in this release; deployment status is reported separately:

- one **Data as of** block on every company page: quote, screen metrics, chart, accounts and filing, with "why these dates differ"
- a **countercase that leads with its limit**, with four distinct states (none detected, partly assessed, unavailable, stale) in neutral styling
- **provenance beside each research claim**: Source fact and Screen rule labels, and Method & limits with period, source, snapshot build and publication date
- a **Discover empty state** that names the search + filter intersection and offers Search only, Clear preset and Clear all
- a **rebuilt price chart**: the axis outside the plot so the line runs to the edge, up to five price levels (was four, with labels hidden near the high and low marks), a crosshair with price and date read-outs, 400px tall at full width on desktop
- a calmer, denser interface: one column header in Discover (rows about a third shorter: 107 px to 71 px at 1280 px wide), sentence-case labels, a slim sticky company header, a compact action bar on desktop, and 150 ms optional disclosure motion
- the askakshay.com link removed from the footer and the privacy page
