# Tripwire: product review, 26 Oct 2026

Written after reading the whole app, running two pre-registered studies on ten years of prices, and watching it on a real phone.

## The one-line truth
Tripwire is a research desk that **tests its own ideas in public**. It is not a stock-picking edge. The ten-year back-test found no edge in any of its three engines or thirteen unusual indicators (`docs/tripwire/ENGINES.md`, Evidence tab). The product is strongest where it is honest and weakest where it implies otherwise. Everything below follows from that.

## What is genuinely good
| Strength | Why it matters |
|---|---|
| Paper trades fill at the next open with costs, gaps and stops-first, and are replayed from real bars | Most retail "paper trading" fills at the price you saw, which flatters every result |
| A forward ledger records every pick every night, taken or not | The only record that cannot be fitted to the past |
| Case and countercase, dated prices, "not a live quote", unmeasured is never zero | Builds the trust the rest depends on |
| Notes stay on the device, no account, no tracking | A real difference from the apps that sell your watchlist |
| The study, its rules and its failures are visible in the app | Nobody else shows a user that their indicators failed |

## What the review found wrong or weak (ranked by harm)
1. **The picks look more authoritative than the evidence allows.** A pick card with a score and a stop reads as advice. Fixed this round: every pick now carries "No back-test support", the Signals header says "experiments, not recommendations", and an Evidence tab shows the numbers. Still open: Steady uptrend underperformed the whole universe in all three periods (t = −2.2 early). My recommendation is to retire it, which is your call.
2. **A tracker you must open to learn a stop was hit.** A paper stop at 10:30 is found at 6 pm. Real fix: web push (needs your consent, a push key and a scheduled server job that holds the trade list, which breaks "notes never leave your device" unless the trade list is the only thing sent). Not built; decision needed.
3. **Data is end-of-day except the live P&L.** Discover, the engines and the trend map move once a night. Honest and labelled, but "dynamic" stops at the live strip and the tracker.
4. **No accounts, so no recovery.** Clearing site data erases your journal. A backup file exists; most people will not use it.
5. **The home page was a decorative dial.** Replaced with what changes minute to minute and day to day (below).
6. **Quality at a fair price cannot be judged historically** (no point-in-time accounts), so one of three engines rests on the forward record alone.

## What this round built, and why
| Addition | Why it earns its place |
|---|---|
| **Live P&L**: delayed live mark, today's P&L, contribution by trade, a risk ladder (−1R to +3R), the day's five-minute line, a what-if slider | Turns a list into something you can reason with: "where am I against my stop, and what if it gaps" |
| **Today**: session clock, live Nifty / Bank Nifty / VIX strip, live paper book, swipeable picks, trend map by sector linking into Discover | A home page that is different at 10 am and at 4 pm |
| **TradingView links** (stocks, indices) | Charting is solved; do not rebuild it. One tap to the tool people already use |
| **Scrip intelligence**: who owns it and how that changed, seasonality, valuation against its own history, earnings quality, peer ladder, risk map, indicator fingerprint | Uses data already published but unused. The fingerprint carries each indicator's study verdict, which no other app does |
| **Evidence tab** | The honest answer to "do these picks work", in the app itself |

## What to build next, ranked by value over effort
| # | Addition | Why | How | Effort |
|---|---|---|---|---|
| 1 | **"Who is buying" screens**: FII or DII accumulating for N quarters, promoter stake changes | Data is already in the files (`fii_streak`, `signal`); uncommon among free apps; ownership changes are a documented information channel | A Discover filter plus a Today card | Small |
| 2 | **Holdings import (CSV) with concentration and stop distance** | Turns the app from a paper game into a tool for real money, safely read-only | Validated import, sector and single-name concentration, per-holding ATR stop distance | Medium |
| 3 | **Stop and target alerts by web push** | The tracker's biggest gap (item 2 above) | Push subscription, a Worker cron that evaluates trades; needs your consent and a VAPID key | Medium, needs a decision |
| 4 | **Decision journal analytics**: how often you wrote an invalidation, how often you kept it, review delay | Process, not outcome; the part of investing a user controls | Local computation on existing entries | Small |
| 5 | **Result-day reactions**: what the stock did around its last results | Earnings events drive large moves; ownership, margin and cash data already shown | Needs reliable results dates; the screen has estimates only | Medium, data-dependent |
| 6 | **Point-in-time accounts and delivery data**, to make Quality testable and add a real volume signal | The only route to engines that can be tested properly | A licensed or scraped source; check terms first | Large |
| 7 | **Accounts and sync** (passkeys, a small database) | Recovery and a second device | Only if people actually ask | Large |

## What not to build
More engines (the study says the problem is evidence, not quantity); AI stock picks; tips, leaderboards or streaks; a bespoke charting library; anything that implies a probability of profit.

## Why this can be indispensable
Not because of a secret indicator: the study found none. Because it is the one place a retail investor sees their own decisions, the market's real state, and the **tested truth about the tools**, kept together and kept honest. The moat is accountability and trust, and it compounds with every night of the forward record.
