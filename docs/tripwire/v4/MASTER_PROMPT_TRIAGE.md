# Tripwire 2.0 master prompt: triage against this repo (12 Nov 2026)

Source: "Tripwire 2.0: One Ledger, One Look" (the owner's file of 12 Nov 2026), written against the SHIPPED bundles of an earlier state.
This document is the ledger lane's reading of it against `revamp-v4` at `ce394a5`. Paths are under `apps/tripwire/`. Every status below was
checked in the code, not copied from the prompt. Lane: Phase 1, Phase 2, Phase 3.1 and 3.2, acceptance items 1 to 8, 10, 11.
Phase 3.3 (shopfront) and Phase 4 (glow, motion, §5 item 9) are not in this lane.

Status words: done (already true here), partial, missing, obsolete (the premise no longer holds), conflicts (an owner decision says otherwise).
"Decision" is what was decided before building. The final results are in the lane report and in the section "Outcome" at the foot of this file.

## Verified claims (the facts the decisions rest on)

| Claim in the prompt | What the code says | Evidence |
|---|---|---|
| Book strip "CLOSED 5" counts observations, not book closures | TRUE. The strip's "Closed N of 30" reads `figuresOf(ledger).closed`, which is `summarizeLedger(l).all.closed`: every non-voided, non-retired PICK whose replay closed with an R, whether or not the paper book took it. The book's own closures are a different count (`useAutoBook().rows` with status closed). The sentence under the strip ("N engine positions have closed") counts the book. Two populations, one label. | `src/screens/Positions.tsx:74,96-97,118`; `src/recordview.ts` `figuresOf`; `src/ledger.ts` `summarizeLedger` |
| `gt(e)` filters picks without restricting to `ledger.taken` | TRUE in substance for the current code. `closedItems()` (Record list, bars, curve, reading) filters `l.picks`, never `plan.taken`. The Record headline "N of 30 closed" is the same count. | `src/recordview.ts` `closedItems`; `src/screens/Record.tsx:71,75,82,84,98` |
| The attribution reducer assigns an open position's whole `pnl` to unrealised | TRUE. `attribute()` puts every `open` row's `pnl` in `unreal` and every `closed` row's in `real`. For a ladder position `v.pnl` is `booked + (mark-fill)*left - fees - slip` (booked partial profit INCLUDED), so a position that sold half at T1 shows that profit as "open"/"unrealised". The labels are wrong, the total is right. | `src/attribution.ts:33`; `src/tracker.ts:85-88`; `src/positionstate.ts:25` (`markOpen`, same formula) |
| "Open P&L" on the strip is not unrealised | TRUE. `unreal = auto.sum.openPnl + mineSum.openPnl` is the sum of `v.pnl` of open rows, i.e. open-trade P&L (booked partials + remaining mark). The strip labels it "Open P&L (paper)", the honest interim name, but the Paper P&L page and the attribution table call the same quantity "open"/"unrealised". | `src/screens/Positions.tsx:71,94`; `src/tracker.ts` `summarize` |
| T1/T2 levels are entry-based R everywhere | TRUE for any entered position. `ladderPrices(entry, stop, ...)` is the one definition; `targetPrices(.., entry)` returns basis `entry` once there is a fill and `signal` ("at signal close") only before one; the Picks view uses the signal close and says so. `definitionLines()` already states one R and one T2. Nothing to change except to pin it with a test. | `src/exits.ts` `ladderPrices`; `src/levels.ts:4-21`; `src/recordview.ts` `definitionLines`; `src/screens/signals.tsx` Picks |
| The Record mixes original, restated and as-filed rules | PARTLY. `provenance.ts` classifies every closed result (`resultBasis`) and `basisLine()` prints "Of N closed results: X as filed, Y restated..." plus the warning that the total R "mixes rules and is not like-for-like", inside the folded "What is counted". But the HEADLINE ("N of 30 closed", total R, win rate) is the combined total, shown first and unlabelled. | `src/provenance.ts:41-55`; `src/screens/Record.tsx:71-79` |
| What `taken`, `skipped`, `waiting` mean | `taken` (autobook): a pick the book ACCEPTED on its night (not refused). It is a selection, not an entry: `planAutoBook().taken` includes picks whose next open then gapped more than 2% (outcome `skipped`, no trade opened). `refused` = rejected at selection, with the reason. `skipped` = taken but never entered. `waiting` = tracker status with NO daily bars yet (waiting for data); `pending` = bars exist, entry is the next open. The strip's "waiting" and Live.tsx's "N waiting" merge pending and waiting. So "37 positions" (taken) = 35 that entered or await entry + 2 skipped; the tables hold 35. | `src/autobook.ts` `planAutoBook`; `src/tracker.ts` `Status`, `evaluatePaper`; `src/screens/Live.tsx:84`; `src/observations.ts` |
| A partial exit increments closed | NO, already. `evaluatePaper` returns `closed` only when the whole position has gone (stop, T2, time); T1 leaves `open` with `ladder.qtyLeft > 0`. No test asserted it. | `src/tracker.ts` `ladderRun`; `tests/paper.test.ts` |
| Costs are charged once | TRUE in the tracker: the round-trip cost is `cost% * fill * qty` for the WHOLE entry, slippage only on market exits. Nothing splits it between booked and remaining, so a realised/unrealised split has to allocate it (pro rata by shares). | `src/tracker.ts:85-88` |
| Freshness assertions | MOSTLY DONE. (a) stages agree, (b) no open mark older than the last finished session, (c) finals vs bars: `ledgerchecks.ts`, run in the ledger job. `check-data.mjs` asserts screen `as_of`, row `last_date`, sector and the files' `as_of` in the deploy job. | `src/ledgerchecks.ts`; `tools/check-data.mjs`; `.github/workflows/tripwire.yml:51` |
| Session calendar is one module | TRUE for the clocks (`calendar.ts` -> `freshness.ts` -> everything). | `src/calendar.ts`, `src/freshness.ts:14` |
| Universe definition is published | DONE. The Data page prints "N companies are screened; M pass the liquidity filter; the trend map counts K" from `universeReport`. Discover's own row count is not on that line. | `src/screens/Data.tsx:43,86-93`; `src/universe.ts` |
| Tier null on ~30% of rows | UNVERIFIABLE IN THIS SANDBOX: `screen.json` is fetched at build (`scripts/shard.mjs`) and is not in the repo. The code treats it as a published fact: `check-data.mjs` warns above zero and `assertScreen` fails above 35% without a size class. | `tools/check-data.mjs`, `src/freshness.ts` `assertScreen` |
| `signals.json` zeroed `record` block | DONE. `build.mjs` deletes `record` and writes `record_note`. | `build.mjs:62` |

## Item by item

### Phase 1: one ledger

| # | Item | Status | Decision |
|---|---|---|---|
| 1.1a | Five non-interchangeable selectors in one module | missing | NEW `src/ledgerview.ts` (pure): `bookClosedCount`, `bookOpenCount`, `resolvedObservationCount`, `userClosedCount`, `validationClosedCount`, all reading ONE `LedgerView` built once. Positions, Record, Picks and the observation note read through it. |
| 1.1b | Book hero "N closed book positions"; Record "M resolved observations · includes repeated/not-taken signals"; never call observations "closed trades" | missing | Change the strip, the Record headline, the per-engine rows, the Picks header and the reading sentences. `summarizeLedger` and the engine are NOT touched (it stays the observation counter; only the labels change). |
| 1.1c | Keep observations, no dedupe by symbol, stable lifecycle id linked to observation ids | partial | Pick ids (`asOf|engine|sym`) are already stable and immutable and the book holds a name once at a time, so the identity exists but is unnamed and unlinked. Lifecycle id = `lc:` + the position's pick id (engine) or paper id (yours); `Paper.lifecycleId?` is additive; observation ids are DERIVED (the held name's later picks until its exit), never written into `ledger.json`. Old payloads migrate on read; duplicate ids on import are re-keyed, never dropped. |
| 1.1d | Count invariants (taken / skipped / waiting / open / closed) | missing | `populations()` returns the partition and `invariants()` states it: selected = skipped + awaiting entry + open + closed; refused is separate; a partial exit never counts as closed; a view with shares remaining is never closed. The "37 vs 35" confusion becomes "37 selected = 35 positions + 2 skipped at the open". |
| 1.1e | Validation: lifecycle count + rule version, "a minimum is not proof", label original/restated/as-filed, no combined like-for-like total | partial | Validation gate = CLOSED BOOK LIFECYCLES filed as-filed under the current rule version; original and restated are counted and shown separately; the combined number is never the headline. The 30-bar and the withheld win-rate/average-R switch read this count (display only; the threshold stays 30). |
| 1.2 | Realised / unrealised / total / open-trade P&L, costs once, R keeps the original denominator, fix the reducer, interim label | missing | `pnlOf()` in `ledgerview.ts`, independent of `View.pnl`; convention stated: costs allocated pro rata by shares; realised = booked exits net of their share of costs; unrealised = remaining shares marked at the observed price against the same fill, net of their share of costs and of the exit slippage the tracker already assumes; total = realised + unrealised and equals the tracker's own `pnl` (asserted); R denominator = original risk x original quantity. `attribute()` takes the split. "Open-trade P&L, includes booked partials" is the label wherever the split is not shown. The §5.3 fixture is a test. |
| 1.3a | One snapshot id, invariants, round at the boundary, "Other" completes, gainers and losers separate | partial | `contribution.ts` already completes with "Other" and reconciles in whole paise; `attribute()` already checks both reconciliations. Missing: one id shared by Book, P&L page, insights and export; separate gainers and losers lists. NEW `buildSnapshot()` + `snapshotId`. |
| 1.3b | One published universe definition | done | On the Data page already. Leave it; test that the line carries total, liquid and counted from `universeReport`. Discover's own count belongs to the Discover agent; flagged. |
| 1.3c | Tier backfill or amend rule text; build assertion on null tier, null sector, stale last_date | partial | Sector and last_date are asserted (fatal). Tier null is a WARNING plus a 35% fatal ceiling. Decision: do NOT backfill a size class in the build (inventing a tier is what the product refuses); the null share is reported from the build and the published rule text is amended to say a size class is published for index-sized names only. The live null share cannot be measured here. |
| 1.3d | One R, one T2; signal-close levels only on the pick detail | done | Verified above. Add a test that pins `ladderPrices` as the only definition and that an entered position never gets basis `signal`. |
| 1.3e | `signals.json` zeroed record | done | Verified. |
| 1.4a | Why early builds land late | not diagnosable here | Needs the Actions run history, not reachable from this sandbox. The workflow shows the cause class: the deploy is dispatched by the screen publisher with 07:45 and 09:15 IST recovery crons; a missed dispatch is only caught at the next cron. Reported, not fixed. |
| 1.4b | Build assertions (outcome max mark vs pick as_of; file as_of vs last session; open mark vs last session) | done in the ledger job; partial in the deploy job | (a) and (b) exist (`ledgerchecks`). Missing: running them against the committed `ledger.json` in the deploy job and printing every failure into `$GITHUB_STEP_SUMMARY`. |
| 1.4c | Freshness labels from ONE calendar module | done | All labels derive from `calendar.ts` / `freshness.ts`. New ledger code calls them; nothing new computes a session. |
| 1.4d | Alert on a stale build, gated by `FRESHNESS_ALERT=1`, no new secret | missing | Reuse the Telegram step in `tripwire_ledger.yml` (the same two existing secrets) in `tripwire.yml`, behind the repository variable. No new channel. |

### Phase 2: truth labels

| # | Item | Status | Decision |
|---|---|---|---|
| 2.1a | Two statuses: "Quotes: ..." and "Exit verification: complete/incomplete", with measured/total coverage and last confirmed date | missing | `coverageOf()` in `ledgerview.ts`; strip row 1 prints both. The data-history warning prints once above the list; per-card repeats become an exception chip. |
| 2.1b | "0 waiting" -> "0 awaiting entry" | wording to change | "waiting" in Live.tsx and on the strip means pending-or-waiting-for-prices = awaiting entry. Renamed. |
| 2.1c | Coverage honesty (partial subtotal; all missing = unavailable) | partial | `lines()` already drops positions with no mark, so the total reads as complete. Make partial explicit. |
| 2.1d | Scope labels; Paper P&L as a Book subview; deep links | partial | The Live page heading "Your paper portfolio" is replaced. Book > Positions is the subview already and `#/paper`, `#/book` redirect to it (`app.tsx:195`). `#/live` stays a deep link and gets the same scope labels. |
| 2.2 | Quote != fill wording | partial | "At T1" comes from `nearWord()` (`toTarget <= 0`). Replace with "Quote above T1 · fill unconfirmed"; "T1 booked · <date>" is drawn by the ladder from the booked fill; "Near T1" within 3%. `markOpen` changes only mark and pnl; a test pins that a quote never changes status or stop. |
| 2.3a | Past estimated event dates never "next" | not mine | Company page = another agent. A helper `nextEventState` is theirs; checked when this item is reached, not duplicated. |
| 2.3b | Bar status confirmed/forming/stale/missing; forming excluded from completed-close views | partial | `Bar.forming` exists; `evaluatePaper` already ignores forming bars for time exits. Add the 4-state `barStatus()`, labels, and the §5.7 tests. No chart styling. |
| 2.4 | "What changed?" -> "What contributes to open-trade P&L?" | missing | Rename; the basis (since entry) is stated; each insight links to its rows. |

### Phase 3 (this lane: 3.1, 3.2)

| # | Item | Status | Decision |
|---|---|---|---|
| 3.1 | Book P&L hierarchy | missing | Positions strip rebuilt: row 1 scope and trust, row 2 Total P&L hero with Realised / Unrealised / Today, row 3 what moved; the PositionCard rows stay the expandable drill-down (they carry the existing detail data); history in its own populations. No performance percent (no capital base is defined). |
| 3.2a | Large Indian-format currency never wraps its last digit | missing | `ledger4.css`: container-aware size, no-wrap number, wrap the label; checked at 320/375/390/1265, 200% zoom, negative values. |
| 3.2b | Unavailable chart collapses | partial | The Paper P&L page's empty day chart is full width. Collapse to one compact line. No curve is drawn. |

### Not done, and why

| Item | Reason |
|---|---|
| 5-item rail with Signals in it (3.3) | Owner decision of 11 Nov 2026: four tabs (Today, Research, Book, Menu). Conflicts. |
| Beehiiv capture (3.3) | No subscribe endpoint exists in this repo; no form that posts anywhere is built. |
| Real-iPhone pass and Lighthouse numbers (3.3, §5.12) | Not possible in this sandbox. Layout is checked in headless Chromium at 320/375/390/1265 only. |
| Hero line and footer trust line (3.3) | Other agent's lane (shopfront). |
| Phase 4 and §5.9 | Effects agent. |
| Any engine, eligibility, exit, formula, threshold or cost (0.25%) change | Forbidden by the owner and the guardrails. |
| Watchdog "fires on a deliberately missed build" (§5.12) | A real workflow cannot be triggered from here; the assertion functions are unit-tested instead. |

### Outcome (end of the lane, 12 Nov 2026)

| Item | Result | Where |
|---|---|---|
| 1.1 | done | `src/ledgerview.ts`, `src/lifecycle.ts`; strip, Record, Picks, Evidence reworded; tests `ledgerview.test.ts` |
| 1.2 | done | `splitOpen/splitClosed/splitOfRow`, `attribute()` takes the split; tests `pnlsplit.test.ts` (§5.3 fixture, tracker agreement to the paisa) |
| 1.3a | done | `snapshotOf`, id on the strip, the P&L page and the table; gainers and losers listed apart; `snapshot.test.ts` |
| 1.3b, 1.3d, 1.3e | done (pinned) | `ledgerpin.test.ts` |
| 1.3c | no backfill, by decision | the rule text (`rules.ts`) already says a class is published for index-sized names only; the build warning text now says so; null share cannot be measured here |
| 1.4a | not diagnosable here | no Actions history in this sandbox |
| 1.4b, 1.4d | done | `check-data.mjs` `checkLedgerFile`; `tripwire.yml` summary + optional Telegram behind `FRESHNESS_ALERT=1`; `ledgerfresh.test.ts` |
| 2.1 | done | scope labels (Both / Engine paper book / My paper plans), two statuses, coverage, "awaiting entry" |
| 2.2 | done | `nearWord`: "Quote above T1 · fill unconfirmed", "Near T1 · x% away"; `barstatus.test.ts` |
| 2.3a | not done | the company page belongs to another agent; no `nextEventState` helper existed when this lane ended |
| 2.3b | done (data model and labels) | `barStatus`, `completedBars`, `barsCaption`, `provisionalOf`, `BookRow.provisional`; no chart styling touched. Finding: the tracker lets a forming bar's low stop a position and its high fill a target (an existing exit rule, left unchanged); the result is now LABELLED provisional |
| 2.4 | done | "What contributes to open-trade P&L?" with the basis stated |
| 3.1 | done | `src/screens/pnlstrip.tsx`, Positions strip; cards stay the expandable detail; table is the all-figures view |
| 3.2 | done | `src/ledger4.css`; `tests/ledger4.mjs` |
| contact | done, last commit | `src/contact.ts` |

### Contact (last task of this lane)

`SUPPORT_EMAIL` in `src/contact.ts` is set to `hello@askakshay.com` as the final commit of the lane, per the owner's file ("Set a real contact").
This PUBLISHES an address on Privacy, Terms and `/.well-known/security.txt`. The tests that pin "not set up yet" are updated with dated comments.
