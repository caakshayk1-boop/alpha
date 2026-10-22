# MISSING_DATA_AND_ACCESS: Blockers

List each item precisely. Do not work around missing data with simulated or fabricated inputs.

| # | Item | Why needed | Blocks (engine / gate) | Suggested source | Owner action | Status |
|---|---|---|---|---|---|---|
| 1 | Point-in-time earnings announcement timestamps | E6 entry timing | E6 / G04 | Exchange corporate-announcement archive or licensed vendor | Procure / approve | OPEN |
| 2 | Point-in-time quarterly financial statements | E6 seasonal surprise | E6 | Licensed fundamentals vendor | Procure / approve | OPEN |
| 3 | Historical index constituents incl. delisted names | Breadth denominator, survivorship | Regime, all engines / G04 | Index provider or vendor | Confirm | OPEN: every v3 result uses today's screen (890 symbols); momentum (E1) is the most flattered |
| 4 | Corporate actions history | Split/bonus adjustment | All / G05 | Exchange or vendor | Confirm | OPEN |
| 5 | Current brokerage and statutory charges | Net returns | All / G06 | Broker schedule and official regulator/exchange notices | Confirm broker | CLOSED: statutory items verified (NSE/FA/73061; NSE levies page, accessed 2026-10-22); owner dropped the broker question, so brokerage is 0 with a ₹20/order + ₹15.93 DP stress case |
| 6 | Circuit-limit and suspension history | Tradability | All | Exchange | Confirm | OPEN |
| 7 | India VIX history | Regime context | Regime | Exchange | Confirm | PARTIAL: Yahoo `^INDIAVIX` used (17 missing sessions in 2019–26, failing closed); not checked against NSE's own archive |

Claude: add, update or close rows with evidence.

| 8 | Snapshot artifacts reachable from the dev container | Re-running validation outside Actions | G23 (results re-run) | GitHub artifact host | Allow `productionresultssa1.blob.core.windows.net` in the environment's network policy, or re-run on Actions | OPEN |
