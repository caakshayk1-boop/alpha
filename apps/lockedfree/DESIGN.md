# Rulebook design notes (23 Nov 2026)

The rules this site follows, so the next change does not undo them. Tokens live in `src/styles/tokens.css`; the type roles below are the last block of `src/styles/global.css`.

## Type roles
- **UI font** sets every sentence: page intros, captions, notes, hints and page-context lines.
- **Mono** sets figures and short labels only (`.num`, `.fig`, `.label`, `.pill`, `.kicker`). A sentence in mono reads as code and is hard to scan.
- Every figure uses tabular numerals; numeric table columns are right-aligned.
- Headings are sentence case.

## Numbers
- Account money uses `inr(x, 2)` from `src/lib/view.ts`: Indian grouping, two decimals, a real minus sign. Two local helpers used to print `₹55,86,258.6` beside `₹44,07,114.83`; they are gone. Whole-rupee display is for headline P&L only.
- Starting capital prints as whole rupees.
- Every price surface names its date and basis (ledger close, or delayed quote while the market is open).

## Honesty copy (do not weaken)
Paper-only, simulated, not advice, losses shown, observations not recommendations. A cleaner sentence is fine; a softer claim is not.

## Accessibility
- Axe: zero critical or serious violations on Today, Calls, Stocks, Gate, Plan, About, Method, Editions, an edition and a call page.
- Caption text is `--ink-muted` (about 7:1 on the card), not the older dimmer grey (4.1:1).
- A control's accessible name starts with, and here equals, its visible text (the search button: "Search 999 stocks ⌘K").
