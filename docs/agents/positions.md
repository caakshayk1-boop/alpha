# Agent: positions (20-21 Oct 2026)

Worktree branch `worktree-agent-a804a8c064adf51d4`, fast-forwarded to 08b1419.

## What changed
- `src/lib/positions.ts` (pure, tested): `position()` marks one signal to a price under the engine's own exit rule and returns
  R and % (booked thirds + open part), R/% to the stop and the next target, levels booked and reached now, the plan state, the
  action the rules prescribe, the time-limit date and when the state last changed. `markSignal()` is the one price rule both
  pages use; `closeBasis()` dates the engines' close per stock; `noSessionDays()` finds holidays from the live snapshot;
  `summarise()` builds the book; `railOf()` scales the progress rail.
- `src/components/PaperPosition.tsx`: `PaperBlock` (card block: big R in `Flash`, % of entry value, since-close change, rail,
  distances, state + action, "Paper · live HH:MM IST" / "{date} close" label, last change) and `PaperBook` ("Paper book, live":
  open count, total and average marked R, near stop / near target within 0.25R, sortable table, the honest note).
- `src/app/engines/page.tsx`: book at the top; every signal card gets the block; prices from `useLive` + `usePx`. The tag no
  longer repeats the close-based `r_open` (the block shows the dated mark instead). Optional `conviction: 'high'` tag.
- `src/components/CompanyView.tsx`, engines view only: the same block per signal; its plan levels now use the current stop and
  the actual entry, like the Engines page; optional conviction tag.
- `src/lib/types.ts`: optional `conviction` and `conviction_why` on `EngineSignal`.
- CSS at the end of `globals.css` under `/* agent: positions */`.

## Exit rules reproduced (engines/common.py `walk`, shared by backtest and live tracker)
| Rule | Source |
|---|---|
| Entry = next session's open; void if open >= T1 or <= stop, or risk > 20% / < 0.4% of entry | common.py:78-89 |
| R = entry - original stop | common.py:87 |
| Stop first, incl. a gap through it (exit at the open) | common.py:97-103 |
| Targets in order, one third each, several per session; gap past fills at the open | common.py:104-110, SPLITS :21 |
| After T1 stop -> entry; after T2 stop -> T1 | common.py:111 |
| All three targets: closed | common.py:112-114 |
| Time limit: rest exits at the close of session `max_hold`, entry session = 1 | common.py:92, 115-119 |
| Mark: (realised + remaining x (price - entry)) / risk, before costs | registry.py:74 |

Tested on the real feed: every open signal marked at `last_close` reproduces its `r_open` within 0.005R.

## Findings
- **engines.json `last_close` is not dated `data_through`.** On 20 Oct the feed said data through 19 Oct, but for 26 of 31 open
  signals `last_close` equals Yahoo's *previous* close for 19 Oct (the 16 Oct close); 1 was the 19 Oct close; 4 match neither
  (older). The pending signals dated 16 Oct are still pending for the same reason (no next bar). Likely cause: the 19 Oct bars
  were missing for most stocks when the engines ran (ai_run_daily.py:135 takes the newest date across ALL stocks). Upstream fix
  needed in the engines run; this page now dates each close from the quote (`closeBasis`) instead of trusting `data_through`.
  Consequence today: ROLEXRINGS closed 19 Oct at 168.89, below its stop at entry (170.99) after T1, so its rules exit the last
  two thirds; the feed still shows it open. The page says "Stop reached".
- 20 Oct 2026 had no trades (newest trade in the whole snapshot: 19 Oct 15:30 IST, fetched 20 Oct 21:26 IST). The time limit
  skips it (`noSessionDays`). Weekdays only otherwise: an unseen holiday moves a time limit one session later.

## Checks (this session)
type-check clean · eslint clean (`--no-eslintrc -c .eslintrc.json`, see note) · tests 93/93 (81 before) · build ok ·
audit.mjs passed (1008 pages) · axe light 0 and dark 0 on /engines/, /company/INFY/, /company/ROLEXRINGS/#engines at phone
and desktop · sweep clean 12/12 · WebKit iPhone 3/3 PASS.
`npm run lint` inside this worktree fails with a plugin conflict because the worktree sits inside the main checkout, which has
its own `.eslintrc.json`; that is the location, not the code.

Accuracy (local Worker, 19 Oct session): STLTECH (887.25-850.10)/(850.10-825.74) = 1.5250 -> page +1.53R; MAXHEALTH
(830-853)/(853-792.66) = -0.3812 -> -0.38R; SHILPAMED (876.20-920)/(920-866.77) = -0.8228 -> -0.82R; CENTUM -0.3733 -> -0.37R.
ROLEXRINGS (hit 1): ((177.04-170.99)/3 + 2/3 x (168.89-170.99)) / 11.73 = +0.0526 -> page +0.05R, state "Stop reached" (price
168.89 <= stop at entry 170.99, common.py:97). Book: 31 open, total +0.43R, average +0.01R, 3 near the stop, recomputed by hand.

Layout shift on /engines/ (3 runs each): 1350 px 0.036, 412 px 0.0875. All of the 412 px figure and 0.029 of the 1350 px one is
the site-wide "Data check" banner (this worktree's rotation.json describes 16 Oct) pushing `main` down; production shows no
banner and 0 at 412. This work's own shift: 0.0015 at 1350 (the stamp text), 0 at 412. The book table has a fixed height and
fixed columns and sorts by symbol by default so a refresh never reorders rows.

Screenshots: docs/screenshots/agents/positions-{engines,card,company}-{phone,desk}[-dark].png
