# Release runbook: alpha.askakshay.com

What ships, how it is checked, and what to look at after. Commands are the ones the workflows run; nothing here needs a
secret on a laptop.

## What a release is

One static export (`out/`) plus one Worker (`worker/index.js`), deployed together by `npx wrangler deploy`. Its identity is
`/build.json`: the commit, the CI run, the screen build date, the company count and content hashes of the data files.

## The paths that deploy, and what authorises each

| Path | Trigger | What it deploys | Gate |
|---|---|---|---|
| CI → deploy | push to `main`, CI green | the exact commit CI passed (`workflow_run.head_sha`) | CI: type-check, lint, design lint, unit tests and AI evals, build, artifact audit, engine tests, page inventory |
| Engines → deploy | weekday 18:00 / 20:00 / 22:30 IST | tip of `main` = last green code + engine data commits | "Tested code only": the diff from the newest green CI commit may touch only `public/{signals,engines,rotation}.json`, `engines/state/`, `engines/research/*.json` |
| Schedule | Mon–Sat 07:30 and 09:30 IST (after the overnight screen) | the same | the same |
| Manual | Actions → deploy → Run workflow | `ref` (default tip) | the same; `allow_rollback` for a deliberate older commit |

Every path then: `npm ci`, `npm run build` (prebuild shards and validates the company universe and fails on a bad
snapshot), `node scripts/audit.mjs` on the artifact (links, feeds, endpoints, shard/page/sitemap parity), prints
`out/build.json`, refuses to roll production back, deploys, and runs `scripts/smoke.mjs` against production.

## Before merging a change

```bash
npm ci
npm run type-check && npm run lint && npm run lint:design && npm test
npm run build && node scripts/audit.mjs
cd engines && python tests/test_swing.py && python tests/test_registry.py && python tests/test_ai.py && cd ..
npx wrangler dev --local --port 8799     # check the Worker-served build, not next dev
```

## After a deploy

1. `https://alpha.askakshay.com/build.json`: `commit` is the one you meant, `companies` is about 988.
2. The smoke step in the deploy log is green.
3. Spot checks: `/`, `/screen/`, one `/company/<SYM>/`, `/api/quotes` (`ok: true`, some `live`), `/api/instrument?id=nifty`.
4. `/api/explain` (GET): `configured` is `false` until the key is set; after the key is set it must be `true`, which also
   means the configured model exists at the provider.

## Data jobs

- The screen (trading-dashboard) builds about 02:40 IST; the 07:30 / 09:30 IST deploys pick it up.
- Engines run after the close; each run is idempotent through `engines/state/swing_registry.json`.
- A failed or late data job leaves the last good data in place; pages show their own dates (`DataStamp`).

## Known limits

- Physical-device checks and production header checks are owner-run (see `docs/qa/`).
- There are no accounts, so there is no user data on the server to back up.
