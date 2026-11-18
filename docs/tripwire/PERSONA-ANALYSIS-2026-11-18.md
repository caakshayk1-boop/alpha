# Tripwire for people who have money but no process — analysis and upgrade plan
18 Nov 2026. Read-only analysis of https://tripwire.askakshay.com (live build) and the repository. Each claim is tagged **Verified** (checked in code or on the live site this session) or **Likely** (reasoned, not tested with real people). Nothing here is advice to buy or sell anything; Tripwire is paper-only and every proposal below keeps that.

## 1. Who this is for, and what they actually need
The reader has savings or surplus income and one or more of these problems:
1. **No method.** They do not know how to grow money in a disciplined way.
2. **Method but no discipline.** They know a rule (a stop, a size) and break it: average down, move the stop, skip the review.
3. **Cannot find candidates.** They do not know which stocks deserve a look.

The jobs they hire a product for, in order: *find a short list I can understand* → *decide with written rules* → *size the position so one mistake cannot hurt* → *write down why, and what would prove me wrong* → *come back on the date I set and learn from what happened* → *notice my own habits*.

## 2. How the site reads to that person today
**How I see it (Verified, live):** a quiet, dark, research-first workspace. The front door says "Start with one company", with a search box, three example names and one line of public record ("15 nights recorded, 190 paper picks, swing gate off for 136 published days"). Four places: Today, Research, Book, Menu. Honest, calm, no promises.

What already serves the persona (all Verified in code):
| Job | What exists |
|---|---|
| Find a short list | Research with presets (quality, value, momentum, trend), "ask in words" filters, a Lab that tests the user's own rule against history, a sector heat map, movers |
| Decide with written rules | A thesis journal: thesis, support, counter-case, decision, **invalidation** ("what would prove me wrong"), trigger, review date, an open question; every edit is a new version, nothing rewritten |
| Size and protect | A position planner: risk budget as a percent of equity (refused above 5%), a maximum position size, stop, targets, next-open fill and slippage explained |
| Review | Review dates, a Desk "Upcoming reviews" list, and (since today) a calendar file of review dates |
| Trust | A public forward ledger with refusals and voids kept, an honest gate that is OFF, a Record screen that says what it cannot show |

So the **raw ingredients of a discipline system are there.** The weakness is that they are separate tools. Nothing connects "I wrote a rule" to "I followed it".

## 3. Gaps for this audience (what is missing or weak)
1. **No personal rulebook.** (Verified: no screen where a person writes 5 to 10 rules of their own and sees them at the moment of a decision. A per-company "Review checklist" exists on the company page, but it is generated from the data feed, not from the person's own rules.) Discipline fails at the moment of temptation; a rulebook that is only in the person's head is not read then.
2. **No pre-trade gate.** (Verified: the planner computes size; it does not ask "does this break any of my rules?" or "what is the worst case if the stop gaps?".) The planner is the one screen every real decision passes through, so it is the right place.
3. **No adherence record.** (Verified: no counter for "stops honoured", "reviews done on time", "plans followed".) The product measures the *engines'* discipline in public (the ledger) but not the *user's*. For people who break rules, a score of their own process is the missing feedback loop. It must measure process, never profit.
4. **No book-level risk view.** (Verified: single-name concentration appears on the paper snapshot; no sector concentration, no "if every stop hits, I lose X% of equity".) This is the number a disciplined investor watches and an undisciplined one never computes.
5. **No cooling-off or friction on impulsive plans.** (Verified: none.) A plan made at 09:20 on a big gap-up day and one made after a week of reading look identical.
6. **Finding candidates is powerful but expert-shaped.** (Likely: the filters speak in ROCE, RSI, PE.) A first-time person needs "start from a question" paths in plain words ("steady businesses that are not expensive", "stocks near a 52-week high with strong earnings") that open a pre-filled Research view. Some presets exist; the wording and the first-run path for this reader were not tested.
7. **Weak "so what" after a result.** (Likely.) The Record and Book show numbers well; they say less about what a *person* should do differently ("one stop-out is a normal outcome; here is how many you should expect in 20 trades"). Expectation-setting is the cheapest anti-panic tool.
8. **No money-level frame at all** (allocation, emergency fund, staggering entries). Verified absent. This is deliberately out of scope for a paper research product and is where regulation starts to bite; see section 6.

## 4. Proposed upgrades, in build order (each with an acceptance check)
Everything is local-first (nothing leaves the device), paper-only wording, no return claims.

**U1 — My rules (rulebook).** A short list the person writes (examples offered, never forced): maximum risk per idea, maximum names, "no averaging down", "stop is set before entry", "review on the date I set". Stored in the existing local state. *Accept:* a rule written once is shown above the planner and on a thesis; export/import keeps it; unit test for validation and a browser test that the rulebook appears in the planner.

**U2 — Pre-trade check inside the planner.** Before a plan is saved, show each of the user's rules as pass / fail / not measurable, plus "if the stop gaps 3% below, the loss is X% of equity" and "this sector would be Y% of the book". Never blocks; says plainly what it found and records the person's choice. *Accept:* a plan that breaks a written rule shows that rule in words and stores "saved with 1 rule broken" on the plan; no plan can be saved with a silently ignored rule.

**U3 — My process record.** Counts only: plans made with a stop; stops honoured when hit; reviews done by the date; theses with an invalidation; rules broken and saved anyway. Shown on the Desk, never as a grade, never in rupees. *Accept:* every figure traces to the plans and theses it counts (same trace pattern as the Glass Book); empty state says "nothing to count yet".

**U4 — Book risk view.** For the paper book: total risk if every stop hits (in % of equity), largest sector share, largest single name, number of open ideas against the user's own cap. *Accept:* totals recomputed in a test from the plan list; unmeasured (no stop) positions are listed, not guessed.

**U5 — A pause on impulse (optional).** A setting: "wait N minutes between opening a company and saving a plan for it". Off by default. *Accept:* a plan saved inside the window asks one question ("what changed since you opened it?") and stores the answer.

**U6 — Start from a question.** Six plain-word starting paths on Research and the front door, each opening a pre-filled, fully visible rule set. *Accept:* every path's filters are shown in words and can be edited; counts match the screen.

**U7 — What to expect.** Next to the Record and a planned trade: "with a hit rate like this, a run of N stops in a row is expected about once every M trades" computed from the user's own stop distance and the ledger's closed trades, with the sample size printed and the 30-trade withholding rule kept. *Accept:* the arithmetic is shown; below 30 closed trades the sentence says the sample is too small.

Recommended order: **U1, U2, U4** first (one connected feature: rulebook → check → book risk), then **U3**, then U6 and U7, then U5.

## 5. Fixes done today that this audience feels
- Sector heat map now has a **live 1-day view** during market hours (Tripwire and ApexPro): it re-reads the day's change from live quotes for the most traded names of each sector, states the time, how many names and what share of traded value they cover, leaves out names with no live print, and can be switched back to the close. Outside market hours it shows the close and says which day.
- Fonts on both sites are cached for a year (they were asked about again on repeat visits); ApexPro's list now shows 25, 50 or 100 companies a page (it showed 6, about 167 pages).
- Data files are compressed (862 KB to 173 KB), a calendar file for review dates, live-following reduced motion, copy-link in Research.

## 6. What not to build, and why
- **No "buy this" list, no target prices, no model portfolio, no return projections.** Naming securities with entry and exit guidance to people who are not sophisticated is investment advice in India (SEBI registration question). Tripwire's strength is that it teaches and records a process. **Likely, not legal advice:** get a securities-law opinion before any step that tells a person what to do with real money.
- **No broker connection or order buttons.** It would turn a research diary into an execution tool.
- **No gamified streaks.** For people who struggle with discipline, streaks reward activity; this audience needs the opposite (fewer, better-documented decisions).
- **No social feed or tips.**

## 7. Risks and what I could not check
- No real user has been observed using the site; sections 2 and 3 mark which statements are verified and which are reasoning.
- The live heat map covers a *sample* (the most traded names of each sector, 68 names or about 44% of liquid traded value on the published screen of 18 Nov), not every stock; it says so on screen.
- Compliance statements above are not legal advice.
