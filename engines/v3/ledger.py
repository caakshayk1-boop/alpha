"""Prospective paper ledger: append-only JSON lines, each carrying the SHA-256 of the line before it. A correction is a new line
that names the one it corrects; nothing is edited or deleted. Appending a record whose id is already present is a no-op, so a
duplicated nightly job writes nothing twice."""
from __future__ import annotations

import hashlib
import json
import pathlib

GENESIS = "0" * 64


def _h(prev: str, body: dict) -> str:
    return hashlib.sha256((prev + json.dumps(body, sort_keys=True, separators=(",", ":"))).encode()).hexdigest()


def read(path: pathlib.Path) -> list[dict]:
    return [json.loads(x) for x in path.read_text().splitlines() if x.strip()] if path.exists() else []


def append(path: pathlib.Path, body: dict) -> bool:
    """Append `body` (must carry a unique 'id'). Returns False when that id is already in the ledger."""
    rows = read(path)
    if any(r["body"]["id"] == body["id"] for r in rows):
        return False
    prev = rows[-1]["hash"] if rows else GENESIS
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps({"prev": prev, "hash": _h(prev, body), "body": body}, sort_keys=True) + "\n")
    return True


def verify(path: pathlib.Path) -> tuple[bool, str]:
    prev = GENESIS
    for k, r in enumerate(read(path)):
        if r["prev"] != prev or r["hash"] != _h(prev, r["body"]):
            return False, f"chain broken at line {k + 1}"
        prev = r["hash"]
    return True, "ok"
