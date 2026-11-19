# Platform map (19 Nov 2026)

One hub, three product sites. Each product site does one job and reads shared data from the hub's published files; none reads another product site's pages.

## Sites

| Site | Address | Job | Reads |
|---|---|---|---|
| Hub (alpha, includes Vision) | alpha.askakshay.com | Publishes the shared dataset and the daily research desk (Today, Signals, Screen, company pages, Vision widgets) | Upstream feeds (two other repos), its own nightly build |
| Rulebook | lockedfree.askakshay.com | The public record: rules, nightly calls, its own ledger. Launching. | The hub's /data feeds at build (source repository as fallback); its own live quotes from Yahoo through its Worker |
| Tripwire | tripwire.askakshay.com | Personal cockpit: Desk, Book, watch conditions, live prices. Its public pages are the crawlable proof of its own ledger. | The repository's data files (the same ones the hub publishes) at build; its own live price service |
| ApexPro | apexpro.askakshay.com | Research lab: Time Machine, score spread and explorer, RSI divergence, sector heat, compare, level ladder | Hub (screen, company, signals), Tripwire's price service |

vision.askakshay.com, signal. and gems. redirect to alpha. There is no separate Vision host: the Vision widgets live on the hub's Today page.

## Hub sections (see /v1/manifest.json)

universe, screen, company/{SYM}, signals, engines, rotation, brief, build. Each has an address, a content version and a build time. Sections only gain fields; a removed field needs a new schema version.

## Decisions and why

1. **Hub host stays alpha.askakshay.com.** alphavision.askakshay.com does not resolve; main deploys the hub to alpha. The alphavision-merge branch is not merged. ApexPro's Worker tries alpha first and alphavision second.
2. **The live price service stays in Tripwire's Worker for now.** The hub's own /api/chart, /api/quotes and /data/pulse.json are different things, not drop-in replacements: Tripwire's /api/chart returns the full daily history (about 7,700 bars for INFY) and the hub's returns a range of about 250; Tripwire's /api/tick returns {quotes: {SYM: {px, prev, pt, live}}} and the hub's /api/quotes returns a list; Tripwire's /api/pulse and /api/macro have no hub equivalent. Moving ApexPro onto the hub would need new compatible routes in the hub Worker. Until then these four routes are the shared market-data API and their response shapes must not change without a version.
3. **Tripwire's record pages stay on Tripwire.** Tripwire and Rulebook keep different ledgers with different rules (Tripwire's nightly engines; Rulebook's own screen rules and calls). Publishing Tripwire's record under Rulebook's name would put one product's numbers under another's claim, and make Rulebook depend on Tripwire's data. Each site publishes its own record.
4. **No feature removals from ApexPro or Tripwire.** ApexPro's Desk (watchlist, notes, trail) and Tripwire's Desk and Book hold visitors' saved data in their browsers under existing keys; removing them would strand that data. Duplicates are reduced by linking, not deleting.
5. **No database yet.** The shared dataset is versioned files with a manifest. Add D1 or R2 behind the hub only when a feature needs queries the files cannot answer; accounts only after a security review.

## What would change these

- A hub route that matches Tripwire's four price routes (same shapes, or a versioned new shape) makes ApexPro's dependency on Tripwire removable.
- A written owner decision to publish Tripwire's record on Rulebook, with a plan for its ledger and redirects.

## Update, 19 Nov 2026 (evening)

- Rulebook now reads its daily feed from the hub (`/data/screen.json`, `screen-detail`, `swot`, `seasonality`, `pulse`, `regime`, `barometer`, `data-health`) and falls back to the source repository if the hub does not answer. The hub passes these through byte for byte (checked: identical hashes for all eight), so nothing in Rulebook's numbers changes. Before this, Rulebook and the hub both read the source repository directly.
- Tripwire still builds from the repository's data files rather than through the hub; that is the remaining direct read.
