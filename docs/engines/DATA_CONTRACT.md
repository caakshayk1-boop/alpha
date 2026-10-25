# DATA_CONTRACT: inputs, outputs and what a missing value means

## Provenance block (every ledger record, every published feed record)

| Field | Meaning |
|---|---|
| `source` | `Yahoo Finance daily bars via yfinance` (hourly bars rebuild a finished session the daily series still lacks) |
| `exchange`, `currency`, `timezone` | `NSE`, `INR`, `Asia/Kolkata` |
| `symbol` | The NSE symbol; `null` on the feed-level block |
| `session` | The session the bar describes (IST date) |
| `observed_at` | That session's close, `YYYY-MM-DDT15:30:00+05:30` |
| `ingested_at` | When this run read the data (UTC) |
| `adjustment_policy` | `levels`: split-adjusted exchange prices (entries, stops, targets, fills). `returns`: dividend- and split-adjusted closes (momentum, relative strength, residuals). `unexplained_gap`: a move beyond 40% is excluded, never traded |
| `dataset_version` | 16 hex characters: a hash of each symbol, its bar count, last session and last close. The same data gives the same version; a revision, a late bar or a different universe gives another |

`PB.build_feed` raises `MissingProvenance` when any forming, paper or closed record lacks one of these. Nothing is published with a gap.

## Sessions and time

- A bar dated today in IST before 18:00 is never read as a close. A finished session Yahoo's daily series lacks is rebuilt from hourly bars (first open, highest high, lowest low, last close, summed volume) only when the 15:15 IST hourly bar exists; otherwise the run reports the late symbols and, below 95% coverage, records nothing.
- The calendar is `configs/nse_holidays.json`, shared with the site. A year the calendar does not cover is not assumed to be all sessions.
- A signal formed on a close can first execute at the next session's open. The ledger id is `engine:symbol:session`.

## Missing and degraded data

| Case | Behaviour |
|---|---|
| Missing price, High < Low, non-positive close | Bar unclean; not traded |
| Overnight move beyond 40% | Bar and the 3 after it unclean (an unexplained adjustment is excluded, never traded) |
| Gap over 8 calendar days in the symbol's own history | First bar back is stale |
| Fewer than 95% of the universe has the newest session | The run records nothing and says so |
| A field a score needs is absent | Null; never zero. An engine's context becomes `unknown` |
| VIX missing | Regime falls back to the realised-volatility test |
| Event coverage missing (E4) | The engine is paper-only in every regime; E6 is BLOCKED_DATA |
| Provider outage | Bounded retries with back-off; then a failed job that a later run may repeat |
| Stale feed | Shown as stale; never recoloured or republished as current |

Synthetic data is used only in `engines/tests/` and never reaches production inputs.

## Feed `public/engines_v3.json` (`alpha-engines/3`, additive)

`schema, generated, data_watermark, evidence, engines{state, version, why, evidence}, forming[], paper[], validated[], closed[], alerts_enabled (false)`, plus (impl 1.0.2): `funnel{engine: {available, clean, liquid, setup, context, executable, portfolio_selected, candidates}}`, `health{status, watermark, expected, days_behind}`, `provenance{…}`, `job_key`.

- `executable` and `portfolio_selected` are `null` on the night. Whether an order can be filled is settled at the next open by the simulator, and portfolio limits apply to the whole book. They are not estimated.
- Each signal: `engine, version, state, symbol, exchange, as_of, earliest_entry, expiry, regime, regime_status, entry_rule, invalidation, chase, target_policy, initial_risk_pct, ref_close, rank_score, rank_components, data_watermark, sources, evidence, reason_codes, provenance`.
- Order intentions and paper fills are separate records: the signal is the intention; an `…:close` outcome record is written only after the same simulator walks it forward.

## Universe limits (stated on every result)

Today's screened companies. Delisted names are absent (survivorship). No point-in-time index membership. The 50-rupee floor is judged on split-adjusted closes (DECISIONS #10). Yahoo's adjustments are not verified against an independent corporate-action file.
