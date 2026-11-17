# Tripwire personal Pro beta — 17 November 2026

## Changed
- Added separate browser-local Personal Pro paper book at `#/pro`, reachable from Book and Menu. Automatic book remains separate.
- Enforced combined 20% self-pick allocation, five slots including reservations, thesis-first long-only entries and five completed sessions before discretionary exits. Monthly execution-date allowances: two loss exits and one non-loss exit.
- Added per-name/sector and stop-risk budgets, frozen entry thesis, next-open simulation, gap checks, protective/time exits, cooldown, net costs, action history and backups. Rule details: RULEBOOK.md.
- Added responsive forms, allocation/risk meters, contextual company chart/RSI links, explicit eligibility reasons and existing hide-amounts support.
- Refreshed isolated build input from published upstream: 996 companies, screen date 16 November. Missing sectors stay Unclassified and cannot enter the sector-budgeted personal book.
- Build regenerated versioned JS/CSS and service-worker shell together: `tw-mwkclhro`.

## Verified
- 958 unit tests passed, including 13 personal-book accounting/calendar/backup tests.
- TypeScript, token lint, asset budgets and published screen freshness gate passed.
- Chromium and WebKit: personal setup, queue, duplicate prevention, reload persistence, next-session fill, early-exit lock and backup. 1440/390 layouts have no horizontal overflow and no tested axe violations.
- Existing reliability/storage/import and automatic Book browser suites passed.
- Initial JS 96.8 KB gzip, inline critical CSS 13.9 KB gzip, full CSS 54.7 KB gzip.

## Untouched and limits
- No scoring, automatic ledger history, automatic execution rules or ApexPro changes.
- No broker orders, background stop monitoring, server accounts, paid entitlements or cross-device quota enforcement. This is a personal paper beta, not a completed paid-service launch.
- Calendar covers 2026; unsupported sessions block entries. Signals remain 13 November (one session behind); HEG and ICICIPRULI have stale prices. 301 names have no published size class. Missing classifications are not guessed.
- No full old-service-worker-to-new-service-worker upgrade simulation was performed; versioned shell generation was inspected.

## Deployment
- Deployed to https://tripwire.askakshay.com/#/pro.
- Cloudflare version: `7b926cca-552d-47a7-80e9-01c0ffbb96c2`.
- Production shell, service-worker version and real screen date/count verified over HTTP.
- Personal-book browser suite passed again against production in Chromium and WebKit, with intercepted synthetic price fixtures for deterministic execution checks; no real user state was touched.
