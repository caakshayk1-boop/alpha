# RESEARCH_REPORT: Alpha Signal Engines

> **Honest summary:** no engine qualified. Under the owner-approved, frozen pre-registration (rules v1.0.0, commit `af7c35a`),
> E1–E5 were evaluated on four walk-forward folds (2023–2024), active cohort only, net of itemised NSE costs. The figures are from
> **implementation 1.0.1**, which corrects the ten defects an independent review found (§10). The first run's figures (impl 1.0.0)
> are superseded.
> - **E1 (relative-strength continuation), +0.24R over 57 trades, does not beat chance.** Matched random entries with the same
>   60-session hold, trailing exit and book earn **+0.45R** over 68 trades. What made money in 2023–24 was holding liquid stocks
>   through a rising market with E1's exit, not E1's stock selection. Its confidence interval includes zero, DSR is 0.43 (N 10)
>   and PBO 0.25.
> - **E2 (compression breakout)** is +0.04R, below the exposure-matched Nifty, and −0.14R at 2× costs.
> - **E3 (orderly pullback)** is negative in every period.
> - **E4 (residual reversion)** is paper-only by its own definition (no event coverage). That cohort lost 0.11R a trade over 870 trades.
> - **E5 (range reclaim)** is −0.002R, the same as its random baseline.
> - **The combined active book** is +0.10R over 152 trades; its CI includes zero.
>
> All five stay **RESEARCH**; E6 stays **BLOCKED_DATA**. The 2010–2019 confirmation segment is no longer unseen (DECISIONS #9),
> and the parameter-neighbourhood test is partial (DECISIONS #11), so even a better result could not yet be promoted.

Run of record: `engines-v3` run 39712264699 (impl 1.0.1, commit 152750e), data through 2026-10-21, 890 symbols, bars hash `cfa0e433e76dd3eb…`, snapshot artifact `v3-snapshot` (SHA-256 in `engines/research/v3/snapshot.sha256`), evidence hash `99db61b581b0a09c…`. Superseded: run 39710136503 (impl 1.0.0).

## 1. Legacy audit summary
See LEGACY_AUDIT.md.
- **Reproduction:** Swing v2's displayed figures reproduce exactly, but two books are one trade off. That fails the exact-count rule,
  so the unpinned data path was STOPPED; v3 runs only on a hashed snapshot.
- **The 0% gate is the market:** Nifty closed below its 200-day average on all 136 sessions.
- **Lookahead found and fixed:** the group-benchmark lookahead was corrected in swing-2.0.1, whose corrected holdout (t −0.62) shows no edge.

## 2. Data and universe
- **Source:** Yahoo Finance daily bars via yfinance, with exchange (split-adjusted) prices for levels, fills and stops, and
  dividend-adjusted closes for returns, momentum and residuals. Nifty is `^NSEI` and India VIX is `^INDIAVIX`.
- **Universe:** today's screened companies (survivorship: delisted names are absent). 890 symbols had at least 260 bars.
- **Window:** `period=max` reaching 2010 for most names. No point-in-time constituents, corporate-action file, circuit or suspension
  history, or event timestamps exist (MISSING_DATA_AND_ACCESS rows 1–6).
- **Bar handling:** a run drops any bar dated today in IST before 18:00, so no intraday bar is read as a close. A bar with an
  unexplained overnight move beyond 40% is excluded as unclean.

## 3. Exclusion funnels
### Funnel (sessions 2019-10-21 to data end)
| Engine | Available | Clean | Liquid | Setup | Context-compatible | Active / paper-only candidates | Walk-forward trades (active book) |
|---|---|---|---|---|---|---|---|
| E1 | 1,300,816 | 1,300,709 | 769,998 | 1,292 | 1,058 | 1,058 / 0 | 57 |
| E2 | 1,300,816 | 1,300,709 | 769,998 | 4,152 | 3,862 | 3,862 / 0 | 151 |
| E3 | 1,300,816 | 1,300,709 | 769,998 | 225 | 172 | 121 / 51 | 45 |
| E4 | 1,300,816 | 1,300,709 | 521,195 | 9,497 | 6,908 | 0 / 6,908 | 0 |
| E5 | 1,300,816 | 1,300,709 | 769,998 | 3,300 | 1,631 | 913 / 718 | 70 |
| E6 | BLOCKED | — | — | — | — | — | — |

Active and paper-only candidates run in separate books (review finding 4). A placed order cancelled at the next open (gap, chase
limit, or a stop outside 1–10% of the price paid) keeps its slot that day.

## 4. Validation results (walk-forward OOS, net of costs, active cohort)
| Engine | N | Indep. months | Net exp. (R) | No-cost exp. (R) | 95% CI daily book return (%) | PF | Win % | Max DD, marked to market (% equity) | ES worst 5% (R) | Book % | Exposure % | Avg hold | DSR (N) | PBO (own configs) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E1 | 57 | 19 | +0.237 | +0.302 | [-0.00987, 0.02713] | 1.339 | 40.4 | -3.265 | -3.990 | 3.98 | 12.01 | 33.1 | 0.4261 (10) | 0.2528 |
| E2 | 151 | 22 | +0.040 | +0.102 | [-0.01092, 0.01945] | 1.128 | 29.1 | -2.577 | -1.035 | 1.897 | 13.23 | 13.4 | 0.517 (10) | 0.6925 |
| E3 | 45 | 16 | -0.228 | -0.119 | [-0.01692, 0.00485] | 0.667 | 35.6 | -3.672 | -1.174 | -2.668 | 3.33 | 5.7 | 0.0454 (10) | 0.3862 |
| E4 | 0 active (paper-only: 870 trades, -0.112R) | | | | | | | | | | | | — | — |
| E5 | 70 | 9 | -0.002 | +0.101 | [-0.01032, 0.00845] | 0.996 | 51.4 | -2.603 | -1.163 | -0.486 | 8.64 | 11.4 | 0.2746 (5) | 0.5138 |
| Combined (active) | 152 | 23 | +0.096 | +0.171 | [-0.01376, 0.03064] | 1.224 | 39.5 | -5.355 | -1.235 | 4.115 | 18.91 | 17.0 | — | — |
| E6 | BLOCKED | | | | | | | | | | | | | |

Daily book returns are marked to market every session, from trades signalled in the folds only. DSR's N is each engine's distinct
configurations (baseline, challenger, four neighbours); PBO is over the same configurations. Promotion needs every criterion in
`promotion_policy.yaml`; each engine's failures are listed in `results.json` (`engines.E*.why`).

## 5. Robustness
| Engine | Base | Broker stress | 2× (broker stress) | +1 session delay | Challenger exits | Neighbourhood (pad 0.20 / 0.30, time −20% / +20%) — PARTIAL |
|---|---|---|---|---|---|---|
| E1 | +0.237 | +0.212 | +0.170 | +0.796 | +0.128 | +0.245 / +0.363 / +0.291 / +0.862 |
| E2 | +0.040 | +0.015 | -0.137 | +0.004 | +0.036 | +0.042 / -0.021 / +0.002 / -0.014 |
| E3 | -0.228 | -0.252 | -0.376 | -0.417 | -0.139 | -0.211 / -0.179 / -0.196 / -0.249 |
| E4 | no active cohort | | | | | |
| E5 | -0.002 | -0.035 | -0.164 | +0.087 | n/a | +0.082 / +0.010 / +0.064 / -0.049 |

## 6. Baselines
| Engine | Strategy book % | Cash % | Exposure-matched Nifty % | Strategy exp. (R) | Matched random entry, same plan, same book (R, N) |
|---|---|---|---|---|---|
| E1 | 3.98 | 0.0 | 2.63 | +0.237 | +0.452 (68) |
| E2 | 1.897 | 0.0 | 2.916 | +0.040 | -0.011 (355) |
| E3 | -2.668 | 0.0 | 0.008 | -0.228 | -0.276 (44) |
| E4 | — | 0.0 | — | — | — |
| E5 | -0.486 | 0.0 | 2.468 | -0.002 | -0.001 (73) |

### Every segment (baseline exits, active cohort, net expectancy in R, N)
| Engine | Development 2019-22 | WF 2023H1 | 2023H2 | 2024H1 | 2024H2 | Inspected 2025-26 |
|---|---|---|---|---|---|---|
| E1 | +0.363 (76) | +1.161 (15) | +0.269 (17) | -0.046 (9) | -0.503 (16) | +0.042 (44) |
| E2 | +0.105 (197) | +0.063 (58) | +0.172 (47) | +0.061 (12) | -0.188 (34) | -0.104 (107) |
| E3 | -0.458 (43) | +0.450 (7) | -0.267 (12) | -0.351 (13) | -0.434 (13) | -0.543 (29) |
| E4 | — (0) | — (0) | — (0) | — (0) | — (0) | — (0) |
| E5 | +0.152 (81) | +0.085 (38) | +0.451 (6) | — (0) | -0.233 (26) | -0.288 (78) |

The unseen 2010–2019 segment is withheld from this run: it was computed once by the superseded run (DECISIONS #9).

## 7. Regime breakdown (walk-forward, active cohort)
| Engine | Trend-up | Trend-down | Range | Stress | Paper-only cohort (separate book) |
|---|---|---|---|---|---|
| E1 | -0.014 (39) | — (0) | +0.782 (18) | — (0) | — (0) |
| E2 | +0.010 (94) | — (0) | +0.090 (57) | — (0) | — (0) |
| E3 | -0.228 (45) | — (0) | — (0) | — (0) | -0.000 (13) |
| E4 | — (0) | — (0) | — (0) | — (0) | -0.112 (870) |
| E5 | — (0) | — (0) | -0.002 (70) | — (0) | — (0) |

No walk-forward session was classified stress or trend-down.

## 8. Overlap and incremental value
| | E1 | E2 | E3 | E4 | E5 | Incremental WF Sharpe |
|---|---|---|---|---|---|---|
| E1 | 1.0 | 0.0837 | 0.0 | 0.0 | 0.0 | +0.0580 |
| E2 | 0.0837 | 1.0 | 0.0 | 0.0001 | 0.0 | +0.0055 |
| E3 | 0.0 | 0.0 | 1.0 | 0.0035 | 0.0 | +0.0131 |
| E4 | 0.0 | 0.0001 | 0.0035 | 1.0 | 0.0068 | +0.0000 |
| E5 | 0.0 | 0.0 | 0.0 | 0.0068 | 1.0 | +0.0578 |

**Decided (owner delegated, DECISIONS #12–#15):**
- E2, E3 and E4 are retired.
- E1 and E5 stay in RESEARCH with a forward paper record.
- E6 stays blocked.
- E7 (E1 without its trailing exit, §8a) is added as a forward-only engine.

## 8a. Reverse-engineering E1 (diagnostic, inspected history: cannot promote)
`engines/v3/decompose.py` (research/v3/decompose_e1.json). The books share E1's signal days, plan builder, costs and portfolio. Random books
are the median of 20 seeded draws. Net expectancy (R):

| Book | 2019–22 | 2023–24 | 2025–26 |
|---|---|---|---|
| E1 | +0.363 | +0.237 | +0.042 |
| E1_NOTRAIL | +0.415 | +0.930 | +0.066 |
| RAND | +0.110 | +0.445 | -0.242 |
| RAND_TREND | +0.296 | +0.446 | -0.174 |
| RAND_MOM | +0.425 | +0.449 | -0.083 |

Reading:
- **The selection is real, but only outside the rally.** The trend filter and the momentum rank each add value in 2019–22 and
  2025–26; E1 beats every random draw in 2025–26. In 2023–24 any long position with a 60-session hold made money, which hid it.
- **The trailing exit is the weak part.** Exiting on a close below the 20-session low lowered E1's result in all three periods,
  by about 0.7R per trade in 2023–24.

**Result: E7** (configs/engines/E7.yaml, rules v1.1.0, DECISIONS #15) is E1 with the trailing exit removed. It was chosen after
seeing this history, so no historical figure counts for it: it is judged on the prospective paper ledger alone, recorded nightly
beside E1 as its control, under the same promotion policy.

## 9. Trial registry
`engines/research/trials.jsonl`: every evaluated configuration is appended (E1–E5 baseline, challenger and four neighbours each,
plus the legacy Swing runs). DSR uses each engine's registry count as N. Variants tested per engine: baseline exits; challenger
partials (E1–E3); stop pad 0.20/0.30 ATR; time stop ±20%.

## 10. Top 10 ways these results could still be wrong
An independent reviewer (a separate agent, read-only, no network) reviewed engines/v3 against the frozen configs on 22 Oct 2026.
Items marked **fixed** are corrected in impl 1.0.1 (DECISIONS #8) and the run is repeated; the 75bdfd7 figures above are superseded by it.

| # | Risk | Severity | Mitigation in place | Open action |
|---|---|---|---|---|
| 1 | Survivorship (today's universe; 452 symbols in 2010 vs 890 now), plus a filter that used a symbol's LAST bar to drop its whole history, and a price floor applied to split-adjusted prices | High | **fixed** per-date staleness; floor kept and listed (DECISIONS #10); survivorship stated on every result | Historical constituents (MISSING row 3); log and fail on dropped download chunks |
| 2 | Daily returns booked only on exit dates, so drawdown, the bootstrap CI, Sharpe, DSR and PBO read a lumpy series; segment trades and P&L were dated differently | High | **fixed** marked to market each session, built only from trades signalled in the segment | — |
| 3 | R denominator unchecked at the fill (a next open just above the stop inflates R), and partials anchored to the signal close | High | **fixed** 1–10% rule re-checked at the fill (`cancelled_risk`); partials priced from the executed entry | — |
| 4 | Paper-only regime cohorts pooled into the promotion book (E4: 633 of 881 trades), and E4 labelled active although its event coverage is missing | High | **fixed** separate active and paper-only books; only active is evidence; E4 paper-only throughout | — |
| 5 | PBO computed across five engines at once; DSR's SR0 from other engines' Sharpes; N counted rows, not distinct trials | Medium | **fixed** per-engine PBO and SR variance over its own configurations; N = distinct configurations | — |
| 6 | The neighbourhood perturbed only the stop pad and time stop, after sizing | Medium | **fixed** perturbs before sizing; scope reported PARTIAL and can never pass (DECISIONS #11) | v1.1: re-run every setup parameter ±20% |
| 7 | The random baseline was not matched (15-session hold for all, 5% chase, 10 cr floor, outside the book) | Medium | **fixed** each engine's own plan, floors and clean check, through the same book | — |
| 8 | The "unseen" 2010–19 segment was computed in the first run; no purge or embargo | Medium | Breach recorded (DECISIONS #9); the segment is withheld unless a one-shot flag is set and is labelled "seen once". The rules fit nothing, so folds are plain date splits and need no purge or embargo | A genuinely unseen confirmation set no longer exists for these rules |
| 9 | Leverage possible (6 × 20% = 120%), open risk counted by position, same-day substitution after a cancel | Medium-low | **fixed** cash ledger, actual open risk, a cancelled order keeps its slot | — |
| 10 | Smaller items: "gross" included impact; 2× stress doubled a zero brokerage; reward-to-risk filters ignored spread and slippage; a split could leak into E4's residual for 3 bars; nightly outcomes used revised bars | Low-medium | **fixed** no-cost R added; 2× doubles the broker-stress model; filters include impact; 3 bars after a jump unclean; outcomes from the ledger's recorded stop and chase | E4's residual mixes a price index (^NSEI) with dividend-inclusive stock returns: small drift, open |

## 11. Limitations
These are research results, not investment advice. Past backtests do not guarantee future results. Survivorship, the absence of
point-in-time constituents and corporate-action files, realised-basis daily returns and small walk-forward samples all limit what
any figure above can show.
