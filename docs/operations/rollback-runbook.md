# Rollback runbook

A frontend or Worker rollback and a data rollback are different things. Do the smallest one that fixes the problem.

## 1. The new release is broken (pages, Worker, styling)

Fastest: Cloudflare keeps previous Worker versions.

```bash
npx wrangler deployments list          # find the last good version
npx wrangler rollback <version-id>     # needs CLOUDFLARE_API_TOKEN with Workers edit
```

Then make `main` agree, so the next scheduled deploy does not re-ship the bad commit:

```bash
git revert <bad-commit>                # a new commit; never force-push main
git push origin main                   # CI runs, then deploys the reverted code
```

Through GitHub only (no local token): Actions → deploy → Run workflow, `ref` = the last good commit, `allow_rollback` =
true. The "tested code only" step still requires that commit to have had green CI.

## 2. The data is wrong (a feed or the engine published something bad)

- Engine output (`public/signals.json` and the others): revert the `data: engines …` commit and push; the deploy that
  follows ships the previous data. Then fix the engine before the next scheduled run (18:00 IST), or disable the
  `engines` workflow in Actions until it is fixed.
- Screen and other feeds come from trading-dashboard: fix or revert there. Company pages are rebuilt from the screen at
  the next deploy; until then they show the build they were made from, with its date.
- A bad screen snapshot cannot empty the site: the build refuses it (A11) and production keeps the previous release.

## 3. The AI explainer misbehaves

Set the Worker variable `EXPLAIN_OFF=1` (Cloudflare dashboard → Workers → alpha → Settings → Variables, or
`npx wrangler secret put EXPLAIN_OFF`). It is off everywhere within about a minute; pages hide the Ask box. Removing
`ANTHROPIC_API_KEY` has the same effect.

## Rehearsal

Not yet rehearsed against production. Rehearse once on a quiet evening: deploy a harmless commit, roll back with step 1,
confirm `/build.json` shows the old commit, then roll forward.
