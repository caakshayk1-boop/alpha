"""Publisher. DRY RUN by default, and it fails closed:
  - the frozen rules must verify (config.verify) or nothing is published;
  - every engine's state is bound to (rules version, evidence hash); a state computed under another evidence hash is RESEARCH;
  - only VALIDATED engines could ever reach an alert, and alerts additionally need owner authorisation (gate G24), which this
    code does not hold: there is no alert-sending code path here at all.
It writes the public feed for the four product views (Forming setups, Paper signals, Validated alerts, Closed record)."""
from __future__ import annotations

import json
import pathlib
import time

from . import config

STATES = ("BLOCKED_DATA", "RESEARCH", "PAPER", "VALIDATED", "PAUSED", "RETIRED")


def lifecycle() -> dict:
    """Retired and paused engines (configs/engines/states.yaml). Missing file: nothing retired."""
    import yaml
    f = config.CONF / "states.yaml"
    return yaml.safe_load(f.read_text()) if f.exists() else {"retired": {}, "paused": {}}


def bound_state(state: str, bound_evidence: str | None, current_evidence: str) -> str:
    if state not in STATES:
        return "RESEARCH"
    if state in ("BLOCKED_DATA", "RETIRED", "PAUSED"):
        return state
    return state if bound_evidence == current_evidence else "RESEARCH"


def build_feed(results: dict, forming: list[dict], paper: list[dict], closed: list[dict], data_watermark: str) -> dict:
    hashes = config.verify()                                   # raises FrozenMismatch: nothing is published
    ev = config.evidence_hash(hashes)
    engines = {}
    life = lifecycle()
    for e, r in results.get("engines", {}).items():
        state = bound_state(r.get("state", "RESEARCH"), r.get("evidence"), ev)
        why = r.get("why")
        if e in (life.get("retired") or {}):
            state, why = "RETIRED", f"retired {life['retired'][e]['date']}: {life['retired'][e]['why']}"
        engines[e] = {"state": state, "version": r.get("version"), "why": why, "evidence": ev}
    validated = [s for s in paper if engines.get(s["engine"], {}).get("state") == "VALIDATED"]
    return {"schema": "alpha-engines/3", "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "data_watermark": data_watermark,
            "evidence": ev, "engines": engines, "forming": forming, "paper": [s for s in paper if s not in validated],
            "validated": validated, "closed": closed, "alerts_enabled": False}


def publish(feed: dict, dest: pathlib.Path, dry_run: bool = True) -> str:
    body = json.dumps(feed, separators=(",", ":"), sort_keys=True)
    if dry_run:
        return f"DRY RUN: would write {len(body)} bytes to {dest}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    tmp.write_text(body)
    tmp.replace(dest)                                          # atomic publish
    return f"wrote {dest}"
