# v6: what moved to #/info ("About and data")

Rule applied to every screen: it keeps (i) the data a decision needs, (ii) a state or warning when something is wrong, (iii) one-line labels.
Everything else is relocated, never deleted; the honesty statements are all still true and all still printed, under a heading with an anchor on `#/info`.
Anchors are opened with `#/info?s=<id>`: `data`, `pnl`, `book`, `markets`, `picks`, `method`, `legal`, `build`.

| Item | Was on | Now at |
|---|---|---|
| "Exit verification: complete through …" status | Book > Positions, scope row | Silent when healthy. A chip "Exit checks incomplete · N of M" appears only on a problem. Definition: `#/info?s=pnl` |
| "Quotes: Live · time · age" status row | Book > Positions, scope row | Silent when Live or Last traded. A chip "Quotes delayed" / "Quotes unavailable" only on a problem. Words defined at `#/info?s=pnl` |
| "Marks: N of N open positions measured", oldest print range | Book > Positions | Shown only when partial (a partial subtotal, no price, closed trades with no rupee figure), in one line. Healthy: silent. Definition at `#/info?s=pnl` |
| Snapshot id ("Snapshot snap-xxxx") | Book strip, under Total P&L | `#/info?s=pnl` (the id of the snapshot the Book last drew). Still in the table caption (screen readers), the strip's `data-snapshot` attribute and the export |
| "Realised is booked exits… Unrealised is the shares still held…" paragraph | Book strip | `#/info?s=pnl`. The strip keeps a link "How these are calculated" and, when there is one, the Open-trade P&L figure |
| "Paper only · not real money" pill | Book scope row (and the Paper P&L page) | Removed: the page header already says "Paper only. Not advice." Disclaimer text at `#/info?s=legal` |
| BIGGEST GAIN / BIGGEST LOSS / LARGEST WEIGHT / EXCEPTIONS tiles reading "none" or "not measured" | Book strip | Drawn only when they have content; the whole row is absent when all are empty |
| Big slot gauge ("0 of 50 slots") with no positions | Book strip | A compact line "No open positions yet" (with awaiting-entry and closed counts when non-zero). The gauge returns when positions exist |
| "Closed book positions … resolved observations are in the Record, a different count" | Book strip | Count only; the distinction is stated at `#/info?s=pnl` |
| "record unavailable" (closed figure), "Position record unavailable" empty state, "Your own paper trades are listed here…" | Book > Positions | One notice with Refresh (already at the top). No repeats |
| "Nearest its stop first, then nearest a target. Tap a row…" | Book > Positions | `#/info?s=book` |
| "How the paper book works" (entry, exits, costs, engine book limits, Book-1/Book-2) | Book > Positions, fold | `#/info?s=book`. The Book keeps a link and the "Open the position sizer" action |
| Table footnote "Shares left is what is still held…" | Book table | `#/info?s=pnl` |
| Definitions: one R, T2, awaiting entry, exit verification, rule versions | Book / Record / Picks | `#/info?s=pnl` |
| Headline sentence in display type and its caption "Index moves are against the previous close; breadth is the share of … Both are measured, neither is a forecast." | Markets | One normal-size line stays; the caption is at `#/info?s=markets` |
| "49% of the session shown · 5-minute closes · scale is today's range, not your entry or stop" | Markets day chart | Only while scrubbing; the standing statement is at `#/info?s=markets` |
| "Bar: today's low to high… Dot… Tick… A rising VIX shows red." | Markets index rows | `#/info?s=markets` |
| Sector heat "How this map is calculated" | Markets | `#/info?s=markets` |
| Trend map "How to read this" (rule text), "Trend split at the close…" captions | Markets | `#/info?s=markets` (a link "About these numbers" stays on the card). The five breadth figures stay, one tap under "Breadth figures" |
| "Provisional figures as published by NSE…" paragraph | Markets FII/DII card | Card header says "NSE provisional"; full statement at `#/info?s=markets` |
| Commodity tiles' "India link" paragraphs and "Dollar prices for metals, oil and Bitcoin" note | Markets | Each tile opens its own page, which keeps its India link; the source note is at `#/info?s=markets` |
| "Compare longer-term sector trends" | Markets | Kept as a collapsed disclosure under the sector map |
| Data status (as-of dates, build times, coverage, the Data Health table) | `#/data` | `#/info?s=data` (same component; `#/data` still answers as its own address) |
| Methodology and evidence | `#/methodology` | `#/info?s=method` (same component; `#/methodology` still answers) |
| "Experimental, closed research beta… No account, no tracking…" paragraph | Menu | One line stays on the Menu with a link; the full text is at `#/info?s=legal`, beside Privacy, Terms and Contact |
| Menu "About the data" group | Menu | A new first row "About and data" → `#/info`; Data, Methodology and Help rows remain |
| "Long only. A paper entry fills at the next session's open… the fill sets the booked ones." | Picks (Book > Picks) | `#/info?s=picks`; the page keeps a link "How to read these picks" |
| "How to read this" (R, T2, forward record, original and restated, rule by night, voided) | Record | Collapsed by default under the same heading (it needs the record's per-night data, so it was folded, not relocated) |
| "How to read these picks" fold | Today | Copied to `#/info?s=picks`. Today belongs to the v6-home lane and was not edited here: its fold can be replaced by the link once that lane merges |
| Build stamp | (none was shown) | `#/info?s=build` |

## Audited and left alone, with the reason

- **Settings**: "There is no sign-in…", the screen-lock caveat (it does not encrypt), the backup note and the text-size note are statements about the person's own data next to the control they explain; several are pinned by `journey.mjs` and `reliability.mjs`. They stay.
- **News**: the one-line "Headlines from outside India…" note is pinned by `newsgroupsv2.test.ts`; the per-cue "channel" text is the content of the item. They stay.
- **Company, Research (Discover), Desk**: no standing paragraph over 70 characters is visible on first load at 390 px (the long text is already in closed disclosures).
- **Today**: not edited here (owned by v6-home).
