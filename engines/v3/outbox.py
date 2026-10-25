"""Alert outbox (brief: SCHEDULING AND OPERATIONS). Nothing is delivered from here today: there is no sender, and `enqueue` refuses
unless the engine is VALIDATED, bound to the current evidence, and alerts are enabled by the owner. It exists so that when an
engine is one day qualified, delivery is already deduplicated per recipient, publication and channel, append-only, and auditable.
It reuses the hash-chained ledger: a duplicate key is a no-op by construction."""
from __future__ import annotations

import hashlib
import pathlib

from . import ledger as L


def dedupe_key(recipient: str, publication_id: str, channel: str) -> str:
    return hashlib.sha256(f"{recipient}|{publication_id}|{channel}".encode()).hexdigest()[:24]


def refusal(engine_state: str, bound_ok: bool, alerts_enabled: bool) -> str | None:
    """Why a publication may not be queued, or None. Unqualified engines never reach a recipient."""
    if engine_state != "VALIDATED":
        return f"engine is {engine_state}, not VALIDATED"
    if not bound_ok:
        return "qualification is bound to a different engine version or evidence hash"
    if not alerts_enabled:
        return "alerts are not enabled by the owner"
    return None


def enqueue(path: pathlib.Path, recipient: str, publication_id: str, channel: str, payload: dict, *, engine_state: str, bound_ok: bool, alerts_enabled: bool) -> str:
    why = refusal(engine_state, bound_ok, alerts_enabled)
    if why:
        return f"refused: {why}"
    key = dedupe_key(recipient, publication_id, channel)
    return "queued" if L.append(path, {"id": key, "kind": "queued", "recipient": recipient, "publication": publication_id, "channel": channel, "payload": payload}) else "duplicate"


def pending(path: pathlib.Path) -> list[dict]:
    rows = [r["body"] for r in L.read(path)]
    sent = {b["of"] for b in rows if b.get("kind") == "sent"}
    return [b for b in rows if b.get("kind") == "queued" and b["id"] not in sent]


def drain(path: pathlib.Path, send, enabled: bool = False) -> int:
    """Deliver pending messages through `send(body) -> bool`. With `enabled` false (the default) nothing is sent and `send` is
    never called. A failed send stays pending; a delivered one is recorded once."""
    if not enabled:
        return 0
    n = 0
    for b in pending(path):
        if send(b):
            L.append(path, {"id": f"{b['id']}:sent", "kind": "sent", "of": b["id"]})
            n += 1
    return n
