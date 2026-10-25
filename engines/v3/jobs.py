"""Scheduling safety (brief: SCHEDULING AND OPERATIONS): an idempotent job key, a lock that a crashed job cannot hold forever,
bounded retries, a health check and structured logs. A job key is exchange / session / engine versions / data version: the same
key never does its work twice, and a change to any part is a different job. Nothing here lowers a threshold after a zero-signal
run: a run that finds nothing is a finished run."""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import time
from datetime import date


def job_key(exchange: str, session: str, engine_versions: dict[str, str], data_version: str) -> str:
    parts = f"{exchange}|{session}|{','.join(f'{e}={v}' for e, v in sorted(engine_versions.items()))}|{data_version}"
    return hashlib.sha256(parts.encode()).hexdigest()[:24]


def log(event: str, **fields) -> str:
    """One JSON line per event, to stdout (Actions keeps it)."""
    line = json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "event": event, **fields}, sort_keys=True, default=str)
    print(line)
    return line


def run_once(key: str, work, state_dir: pathlib.Path, retries: int = 3, backoff: tuple[float, ...] = (2, 4, 8), lock_ttl: float = 3600,
             sleep=time.sleep, clock=time.time) -> dict:
    """Run `work()` at most once per key. Returns {'status': 'done' | 'already_done' | 'locked' | 'failed', 'attempts': n, ...}.
    A finished key is never rerun; a held lock is respected until `lock_ttl` seconds old; a failure is retried up to `retries`
    times with the given back-off, then the lock is released so a later scheduled run can try again."""
    state_dir.mkdir(parents=True, exist_ok=True)
    done, lock = state_dir / f"{key}.done", state_dir / f"{key}.lock"
    if done.exists():
        log("job_skipped", key=key, why="already done")
        return {"status": "already_done", "attempts": 0}
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        if clock() - lock.stat().st_mtime < lock_ttl:
            log("job_skipped", key=key, why="locked by another run")
            return {"status": "locked", "attempts": 0}
        log("job_lock_stale", key=key, age_s=round(clock() - lock.stat().st_mtime))      # a crashed run: take it over
        lock.unlink()
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.write(fd, str(os.getpid()).encode())
    os.close(fd)
    err = None
    try:
        for attempt in range(1, retries + 1):
            try:
                log("job_start", key=key, attempt=attempt)
                result = work()
                done.write_text(json.dumps({"key": key, "finished": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "attempts": attempt}))
                log("job_done", key=key, attempts=attempt)
                return {"status": "done", "attempts": attempt, "result": result}
            except Exception as e:                                                  # noqa: BLE001: any failure is retried, then reported
                err = f"{type(e).__name__}: {e}"
                log("job_error", key=key, attempt=attempt, error=err)
                if attempt < retries:
                    sleep(backoff[min(attempt - 1, len(backoff) - 1)])
        return {"status": "failed", "attempts": retries, "error": err}
    finally:
        lock.unlink(missing_ok=True)


def health(watermark: str | None, expected_session: date | None) -> dict:
    """Is the published record current? `ok` when the watermark is the newest finished session, `stale` when behind it, `unknown`
    when either is missing. Stale is a state to show, never a reason to publish anyway or to hide."""
    if not watermark or not expected_session:
        return {"status": "unknown", "watermark": watermark, "expected": str(expected_session) if expected_session else None, "days_behind": None}
    behind = (expected_session - date.fromisoformat(watermark)).days
    return {"status": "ok" if behind <= 0 else "stale", "watermark": watermark, "expected": str(expected_session), "days_behind": max(behind, 0)}
