"""Frozen configuration. Every load verifies configs/engines/FROZEN.sha256 and refuses (FrozenMismatch) when a frozen file was
edited without a new version: a result can only ever be attributed to the rules that were approved."""
from __future__ import annotations

import hashlib
import pathlib

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONF = ROOT / "configs" / "engines"
FROZEN = CONF / "FROZEN.sha256"
ENGINES = ("E1", "E2", "E3", "E4", "E5", "E6", "E7")


class FrozenMismatch(RuntimeError):
    pass


def frozen_hashes(path: pathlib.Path = FROZEN) -> dict[str, str]:
    out = {}
    for line in path.read_text().splitlines():
        if line.strip():
            h, name = line.split(None, 1)
            out[name.strip()] = h
    return out


def verify(path: pathlib.Path = FROZEN, root: pathlib.Path = ROOT) -> dict[str, str]:
    """Every frozen file must hash to its recorded value. Returns the hashes; raises FrozenMismatch otherwise."""
    want = frozen_hashes(path)
    bad = []
    for name, h in want.items():
        f = root / name
        got = hashlib.sha256(f.read_bytes()).hexdigest() if f.exists() else "MISSING"
        if got != h:
            bad.append(f"{name}: frozen {h[:12]}, now {got[:12]}")
    if bad:
        raise FrozenMismatch("frozen rules changed without a new version: " + "; ".join(bad))
    return want


def evidence_hash(hashes: dict[str, str]) -> str:
    """One hash for the whole frozen rule set, bound into every result and every published state."""
    return hashlib.sha256("".join(f"{k}={hashes[k]}\n" for k in sorted(hashes)).encode()).hexdigest()


def load(name: str) -> dict:
    return yaml.safe_load((CONF / f"{name}.yaml").read_text())


def all_configs(check: bool = True) -> dict:
    hashes = verify() if check else frozen_hashes()
    return {"hashes": hashes, "evidence": evidence_hash(hashes), "engines": {e: load(e) for e in ENGINES},
            "regime": load("regime"), "costs": load("costs"), "policy": load("promotion_policy")}
