# Reproduce

- `npm run tripwire:types`
- `npm run tripwire:test`
- `node --experimental-strip-types --test apps/tripwire/tests/chartEvidence.test.ts`
- `npm run tripwire:build` (refresh published data first for a release)
- `node apps/tripwire/tests/charts.mjs <base-url>`
- `TRIPWIRE_BASE=<base-url> node apps/tripwire/tests/chart-workbench.mjs`

For isolated builds, set absolute `TRIPWIRE_DIST_DIR` and `TRIPWIRE_PUBLIC_DIR`; `TRIPWIRE_LEDGER_FILE` accepts the ledger object, not the API's `{ok,ledger}` envelope. The normal defaults and workflow remain intact. Never point the output directory at source files: the build recreates that directory.
