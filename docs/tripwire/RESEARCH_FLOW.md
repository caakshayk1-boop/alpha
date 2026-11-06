# Research workflow, November 2026

Tripwire reuses its company page, thesis versions, Follow, screens and paper plans. There is no second notebook, execution account or new engine in this change.

## Evidence and interpretation

- Company reads pair each label with the figure, rule, reporting period, close date, source reference and limitation. Missing figures produce no rating. Financial-sector exclusions use the existing eligibility rules.
- Revenue growth is described by its sign. Quality uses the existing 15% median-ROCE research line. PE history uses the 20th and 80th percentiles. Ownership highlights changes of at least 0.25 percentage points in either FII or DII. These are descriptive rules, not recommendations.
- Source links open the provider reference, not an exact filing. Filing publication dates and some aggregation conventions are absent from the feed and are labelled unavailable. The quarterly ownership feed identifies its source as NSE corporate shareholding patterns (SEBI SHP XBRL).
- Questions name the triggering fact. Connecting a question appends the evidence to the existing thesis editor; saving adds a version. The counterview, invalidation, review trigger, decision and reason stay in that same version and export.

## Follow and decisions

Follow uses existing between-visit changes, showing both values and dates. The app only links a change to a thesis where the existing change detector supplies that entry ID. Strengthened/weakened/mixed is the user's assessment, never inferred from a price move. New, waiting for evidence, after results and reviewed are recorded review states. Results dates remain provider estimates to verify.

Watching, skipped and took it are paper research decisions. They do not execute an order, change engine positions or create real realised P&L. Every previous thesis version is retained; additive fields are optional when importing older backups.

## Comparison and screening

Comparison shows up to three measured spreads: ROCE or revenue growth at least 5 percentage points, debt/equity at least 0.5×, or PE at least 5×. Periods and companies are named; sector and reporting differences limit comparability. Highest is not automatically best. The existing comparison table remains available.

Screen feedback evaluates each selected condition with the same filter functions as Discover. It distinguishes measured passes, failures, unavailable figures, inapplicable ratios and an explicit missing-value exception. Search covers the entire loaded universe, including excluded companies. Saved-screen links restore the saved conditions.

## Paper snapshot

CSV accepts `symbol,quantity,entry,stop`, up to 100 plans and 100 KB. Symbols must exist in the loaded screen; quantities must be positive whole numbers and entry > stop > 0. A preview and explicit import create saved hypothetical plans. Identical plans are skipped. Imports never record fills or change existing positions.

Only explicitly recorded paper fills enter the snapshot. Value is quantity × close; entry basis is quantity × assumed entry. All positions need a valid, non-stale price on a common date at or after their fill date. Otherwise totals are unavailable, not zero. Daily movement uses the previous close inferred from the feed's daily return and is unavailable for same-day fills. Lots in a company are combined for allocation. Cash, costs, dividends and corporate-action adjustments are excluded. Questions explain this arithmetic locally; no AI request or invented causal explanation is used.

## Presentation and scope

The question circle has restrained motion and obeys reduced-motion and in-app motion preferences. Company heat-map tiles use equal sizes and full labels; sector sizes retain their traded-value basis. Back-to-top is in document flow and cannot cover a chart. Markets has one price-status label.

Today keeps its existing bounded brief and evidence links. New screen-membership histories, additional discovery dashboards, broker connections and unattended alerts are deferred. Follow checks occur during app use; this release does not promise closed-app monitoring.

Validation includes deterministic research/filter/accounting tests, backup and history preservation, CSV import, phone/desktop workflow checks, and the existing Tripwire build and browser gates. Engine qualification, exits, ledgers and real execution systems are outside this change.
