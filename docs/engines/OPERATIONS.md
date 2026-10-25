# OPERATIONS: running, checking, deploying and rolling back

## Schedules

| Workflow | When | What |
|---|---|---|
| `engines.yml` | 18:00, 20:00, 22:30 IST weekdays | Swing v2: gate, setups, open trades; commits `public/signals.json`, `engines.json` and the signal brief; dispatches a deploy |
| `engines_v3.yml` (nightly) | 19:15 IST weekdays | Paper record for the active engines; publishes `public/engines_v3.json` on main only (DECISIONS #14); dispatches a deploy |
| `brief.yml` | 07:30 IST weekdays, Sunday review | Builds the signal brief; sends only if the owner set the Telegram secrets |

A retry slot costs nothing: a session already recorded writes nothing (watermark and ledger-id no-op). A zero-signal run is a finished run; no threshold is ever lowered after one.

## Local commands

```bash
pip install -r engines/requirements.txt
sha256sum -c configs/engines/FROZEN.sha256        # the frozen rules are intact
cd engines
python tests/test_v3.py && python tests/test_ops.py && python tests/test_swing.py && python tests/test_integrity.py \
  && python tests/test_registry.py && python tests/test_sessions.py && python tests/test_ai.py
python -m v3.nightly                              # needs network; a dry run unless V3_PUBLISH=1
V3_SNAPSHOT=/tmp/v3_bars.pkl python -m v3.run     # the validation run; costs about an hour; see the caution below
cd .. && npm test && npm run build                # app: unit tests and static export
```

**Caution on `v3.run`.** The 2010–2019 segment is no longer unseen (DECISIONS #9) and the 2020–2026 history has been inspected many times. A re-run is a reproduction, not a new test. Changing a threshold to improve it is what the pre-registration forbids: a changed rule is a new version, forward-only, logged first in DECISIONS.md.

## On Actions

`gh workflow run engines_v3.yml -f mode=nightly` · `-f mode=validate` (validation) · `gh workflow run deploy.yml --ref main`. A commit message containing `[v3-run]`, `[v3-nightly]` or `[v3-decompose]` starts the matching job on a branch.

## Health and what to look at

- The feed's `health` block: `ok`, `stale` (days behind the last finished session) or `unknown`. The Signals page shows it in "Engine health and what was excluded".
- `engines/research/v3/nightly.json`: the last attempt, including `incomplete: N of M symbols have a bar`.
- Logs are JSON lines (`job_start`, `job_done`, `job_error`, `job_skipped`, `job_lock_stale`).
- `python -c "from v3 import ledger; print(ledger.verify(__import__('pathlib').Path('research/v3/paper_ledger.jsonl')))"` verifies the hash chain; the nightly job does it every night.

## Failure handling

| Symptom | Meaning | Action |
|---|---|---|
| `incomplete: N of M symbols have a bar` | Yahoo has not published the session | Nothing is recorded; the next slot retries. Persisting for days: check `sessions.py` and the hourly rebuild |
| `FrozenMismatch` | A frozen rule file changed without a new version | Restore the file, or make a new version and log it. Nothing is published meanwhile |
| `MissingProvenance` | A record lacks a provenance field | A bug in the writer; fix it. Nothing is published meanwhile |
| Job `locked` | Another run holds the lock (under an hour old) | Wait; a lock older than an hour is taken over automatically |
| Ledger chain broken | A line was edited | Stop. Restore from git history; never repair in place |

## Rollback

- **Site:** `gh run list --workflow deploy.yml`, then re-run the last good deploy, or revert the merge commit (`git revert -m 1 <merge sha>`) and push through a PR.
- **Feed:** delete `public/engines_v3.json`; the Signals page then shows "Not published" and the decision record. The ledger is append-only and is never rolled back.
- **Engine:** set the engine in `configs/engines/states.yaml` to `paused` (not frozen; log in DECISIONS.md). It stops recording; its past stays.
- **This change (impl 1.0.2):** revert the commit; rules and results are untouched, and old records stay valid because the new fields are additive.

## Turning things on (owner decisions, not done here)

- **Alerts:** need a VALIDATED engine, a bound evidence hash, `alerts_enabled`, a recipient list and a sender. None exists; gate G24.
- **E6:** configure an `EventSource` that returns exchange announcement timestamps and point-in-time quarterly statements, then add `setup` code for E6 against `v3/e6.py`, then a new pre-registration for E6 rules before any evaluation.
