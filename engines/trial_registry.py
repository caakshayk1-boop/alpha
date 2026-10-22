"""trial_registry.py — every backtest run, appended, never rewritten.

One JSON line per evaluation: engine, rules version, params fingerprint, data hash, period, the headline metrics, git SHA and a
UTC timestamp. The count of lines for an engine is the N that the Deflated Sharpe Ratio and PBO must be corrected for, so a run
that skips this file is a run that understates N. Nothing here is deleted: a mistaken run is followed by a correcting line.
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import subprocess
import time

import pandas as pd

REGISTRY = pathlib.Path(__file__).resolve().parent / "research" / "trials.jsonl"


def git_sha() -> str:
    env = os.environ.get("GITHUB_SHA")
    if env:
        return env
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True, cwd=REGISTRY.parent).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "UNKNOWN"


def bars_hash(bars: dict[str, pd.DataFrame], *series: pd.Series | None) -> str:
    """SHA-256 over every bar in symbol order, as fixed-precision CSV, so the same data always gives the same hash."""
    h = hashlib.sha256()
    for sym in sorted(bars):
        h.update(sym.encode())
        h.update(bars[sym].to_csv(float_format="%.6f").encode())
    for s in series:
        h.update(b"|series|")
        if s is not None:
            h.update(s.to_csv(float_format="%.6f").encode())
    return h.hexdigest()


def record(engine: str, version: str, params_fp: str, data_hash: str, period: dict, metrics: dict, purpose: str) -> dict:
    row = {"engine": engine, "version": version, "params": params_fp, "data_hash": data_hash, "period": period, "metrics": metrics,
           "purpose": purpose, "git_sha": git_sha(), "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    REGISTRY.parent.mkdir(parents=True, exist_ok=True)
    with REGISTRY.open("a") as f:
        f.write(json.dumps(row, sort_keys=True, default=str) + "\n")
    return row


def count(engine: str) -> int:
    if not REGISTRY.exists():
        return 0
    return sum(1 for line in REGISTRY.read_text().splitlines() if line.strip() and json.loads(line).get("engine") == engine)


def count_distinct(engine: str, version: str | None = None) -> int:
    """Distinct configurations tried for an engine (its parameter fingerprints), the N that multiple-testing corrections need.
    Re-running the same configuration does not add a trial."""
    if not REGISTRY.exists():
        return 0
    seen = set()
    for line in REGISTRY.read_text().splitlines():
        if line.strip():
            r = json.loads(line)
            if r.get("engine") == engine and (version is None or r.get("version") == version):
                seen.add(r.get("params"))
    return len(seen)
