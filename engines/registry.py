"""registry.py — one record per issued signal, so nothing is announced twice and every plan stays as issued.

RULES
  * A signal's id is engine:symbol:signal-date. The plan (stop, targets, time limit) is written once, at issue,
    and never recomputed: a plan that quietly moves with the price is not a plan.
  * ONE ACTIVE TRADE PER STOCK. If a stock already has a pending or open trade from any engine, a later signal from
    another engine does not open a second trade: it is recorded on the first as a confirmation ('also selected by').
  * Each trade is walked through the same exit rule the backtest uses (common.walk): pending (issued, waiting for
    the next open), open, closed, or void (the opening gap already voided the plan).
  * The forward record counts only trades issued after launch, closed by the rules, net of the same costs.
"""
from __future__ import annotations

import json
import pathlib

import pandas as pd

from common import COST_PCT, walk

STATE = pathlib.Path(__file__).resolve().parent / "state" / "registry.json"
PRIORITY = ["snapback", "relative", "rank", "compounder", "barrier"]        # which engine owns a stock when several fire at once
ACTIVE = ("pending", "open")


def load() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"launched": None, "signals": {}}


def save(reg: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(reg, indent=1, sort_keys=True))


def sig_id(engine: str, sym: str, date: str) -> str:
    return f"{engine}:{sym}:{date}"


def _track(entry: dict, df: pd.DataFrame) -> None:
    """Refresh one trade's status from the bars. Pure function of the stored plan and the prices."""
    date = pd.Timestamp(entry["issued"])
    if date not in df.index:
        return
    t = df.index.get_loc(date)
    w = walk(df, t, entry["sl"], entry["targets"], entry["max_hold"])
    if w is None:
        entry["status"] = "pending"
        entry["events"], entry["hit"], entry["stop_now"] = [], 0, entry["sl"]
        return
    if w.get("void"):
        entry["status"] = "void"
        entry["entry"] = round(w["entry"], 2)
        entry["entry_date"] = str(df.index[w["entry_i"]].date())
        entry["events"] = []
        entry["void_reason"] = "the opening price was already past the first target or the stop"
        return
    entry["entry"] = round(w["entry"], 2)
    entry["entry_date"] = str(df.index[w["entry_i"]].date())
    entry["events"] = [{"date": str(df.index[i].date()), "kind": k, "price": round(p, 2), "fraction": round(fr, 3)} for i, k, p, fr in w["events"]]
    entry["hit"] = w["hit"]
    entry["stop_now"] = round(w["stop"], 2)
    last_close = float(df["Close"].iloc[-1])
    risk = w["risk"]
    if w["closed"]:
        entry["status"] = "closed"
        entry["closed_date"] = str(df.index[w["exit_i"]].date())
        entry["exit_reason"] = w["exit_reason"]
        entry["r_net"] = round(w["pnl"] / risk - (COST_PCT * w["entry"]) / risk, 3)
        entry.pop("r_open", None)
    else:
        entry["status"] = "open"
        entry["r_open"] = round((w["pnl"] + w["remaining"] * (last_close - w["entry"])) / risk, 2)   # realised plus marked to the last close
        entry["last_close"] = round(last_close, 2)


def update(reg: dict, candidates: list[dict], bars: dict, today: str) -> dict:
    """candidates: freshly scanned signals (plan fields included). Returns the registry, mutated."""
    if reg.get("launched") is None:
        reg["launched"] = today
    sigs = reg["signals"]
    seen = set(reg.setdefault("seen", []))        # every signal id ever processed, issued or absorbed
    order = {e: i for i, e in enumerate(PRIORITY)}
    for c in sorted(candidates, key=lambda x: (x["sym"], order.get(x["engine"], 9), x["date"])):
        sid = sig_id(c["engine"], c["sym"], c["date"])
        if sid in seen:
            continue
        seen.add(sid)
        active = next((e for e in sigs.values() if e["sym"] == c["sym"] and e["status"] in ACTIVE), None)
        if active is not None:
            if c["engine"] != active["engine"] and c["engine"] not in active.setdefault("also", []):
                active["also"].append(c["engine"])
            continue
        sigs[sid] = {**c, "id": sid, "first_seen": today, "status": "pending", "events": [], "hit": 0, "also": []}
    reg["seen"] = sorted(seen)
    for e in sigs.values():
        if e["status"] in ACTIVE:
            df = bars.get(e["sym"])
            if df is not None:
                _track(e, df)
    return reg


def forward_record(reg: dict) -> dict:
    """Per engine: trades issued since launch that the rules have closed, net R."""
    import numpy as np
    out: dict[str, dict] = {}
    for e in reg["signals"].values():
        if e["status"] != "closed" or "r_net" not in e:
            continue
        out.setdefault(e["engine"], []).append(e["r_net"])
    rec = {}
    for k, v in out.items():
        a = np.array(v)
        rec[k] = {"closed": int(len(a)), "win_rate": round(float((a > 0).mean() * 100), 1), "avg_r": round(float(a.mean()), 3), "total_r": round(float(a.sum()), 1)}
    return rec


def active_view(reg: dict, keep_closed_days: int, today: str) -> list[dict]:
    cutoff = pd.Timestamp(today) - pd.Timedelta(days=keep_closed_days)
    out = []
    for e in reg["signals"].values():
        if e["status"] in ACTIVE or e["status"] == "pending":
            out.append(e)
        elif e["status"] in ("closed", "void") and pd.Timestamp(e.get("closed_date") or e["issued"]) >= cutoff:
            out.append(e)
    return out
