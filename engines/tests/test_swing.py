"""Swing v2: the exit plan and the market gate on hand-built bars. Offline. python tests/test_swing.py"""
from __future__ import annotations

import pathlib
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import swing as SW  # noqa: E402

ok = fail = 0


def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  PASS  {name}")
    else:
        fail += 1
        print(f"  FAIL  {name}  {detail}")


idx = pd.bdate_range("2026-01-01", periods=60)


def bars(rows):
    """rows: (open, high, low, close); 20 flat bars at 100 come first so the trail has history."""
    base = [(100, 101, 99, 100)] * 20
    allr = base + rows
    return pd.DataFrame([(o, h, lo, c, 1e6) for o, h, lo, c in allr], columns=["Open", "High", "Low", "Close", "Volume"], index=idx[: len(allr)])


T = 19            # signal bar: the last flat bar; entry is bar 20's open
REF, SL = 100.0, 95.0

# 1. stop first
w = SW.walk(bars([(100, 101, 94, 96)]), T, REF, SL)
check("a session through the stop exits at the stop, -1R", w["closed"] and w["exit_reason"] == "stop" and abs(w["pnl"] / w["risk"] + 1) < 1e-9, w)

# 2. gap through the stop exits at the open
w = SW.walk(bars([(100, 101, 99, 100), (93, 94, 92, 93)]), T, REF, SL)
check("a gap through the stop exits at the open", w["events"][-1][2] == 93 and w["exit_reason"] == "stop", w["events"])

# 3. T1 sells half and locks entry + 0.5R, never break-even
w = SW.walk(bars([(100, 111, 99, 110), (110, 110, 102, 103)]), T, REF, SL)
check("T1 at +2R books half", w["half"] and w["events"][1][1] == "t1" and w["events"][1][2] == 110 and w["events"][1][3] == 0.5, w["events"])
check("after T1 the stop is entry + 0.5R, not the entry", w["stop"] == 102.5 and w["stop"] != w["entry"], w["stop"])
check("the locked half exits at 102.5: +1.25R in all", w["exit_reason"] == "lock" and abs(w["pnl"] / w["risk"] - 1.25) < 1e-9, (w["exit_reason"], w["pnl"] / w["risk"]))

# 4. trail rises with the 10-session low and never falls
rows = [(100, 111, 99, 110)] + [(110 + k * 0.5, 112 + k * 0.5, 108 + k * 0.5, 111 + k * 0.5) for k in range(12)] + [(115, 115, 100, 101)]
w = SW.walk(bars(rows), T, REF, SL)
check("the trail lifts the stop above the lock", w["exit_reason"] == "trail" and w["events"][-1][2] > 102.5, w["events"][-1])

# 5. T2 at +4R sells the rest
w = SW.walk(bars([(100, 111, 99, 110), (110, 121, 109, 120)]), T, REF, SL)
check("T2 at +4R closes the trade at +3R", w["exit_reason"] == "t2" and abs(w["pnl"] / w["risk"] - 3.0) < 1e-9, (w["exit_reason"], w["pnl"] / w["risk"]))

# 6. a session spanning stop and T1 counts the stop
w = SW.walk(bars([(100, 111, 94, 100)]), T, REF, SL)
check("stop and T1 in one session: the stop wins", w["exit_reason"] == "stop" and not w["half"], w)

# 7. gap above +2% is skipped
w = SW.walk(bars([(102.5, 103, 101, 102)]), T, REF, SL)
check("an open more than 2% above the signal close is skipped", w.get("void") is True, w)

# 8. targets re-based on the actual entry
w = SW.walk(bars([(101, 101.5, 100.5, 101)]), T, REF, SL)
check("T1 and T2 come from the actual entry", abs(w["t1"] - (101 + 2 * 6)) < 1e-9 and abs(w["t2"] - (101 + 4 * 6)) < 1e-9, (w["t1"], w["t2"]))

# 9. time limit
w = SW.walk(bars([(100, 101, 99, 100.5)] * 31), T, REF, SL)
check("whatever is left exits at the close of session 30", w["exit_reason"] == "time" and w["exit_i"] - w["entry_i"] + 1 == 30, (w["exit_reason"], w["exit_i"]))

# 10. pending: no next bar
check("no next session: pending (None)", SW.walk(bars([]), T, REF, SL) is None)

# 11. the market gate needs all four
n = 260
d = pd.bdate_range("2025-01-01", periods=n)
up = pd.Series(np.linspace(100, 200, n), index=d)
stock = {f"S{i}": pd.DataFrame({"Close": np.linspace(50, 80, n)}, index=d) for i in range(4)}
g = SW.market_gate(up, pd.Series(14.0, index=d), stock)
check("rising market, broad, calm VIX: gate on", bool(g["on"].iloc[-1]), g.iloc[-1].to_dict())
g = SW.market_gate(up, pd.Series(24.0, index=d), stock)
check("VIX above 20: gate off", not bool(g["on"].iloc[-1]))
g = SW.market_gate(up, None, stock)
check("VIX unknown: gate off (never assumed)", not bool(g["on"].iloc[-1]))
down = pd.Series(np.linspace(200, 100, n), index=d)
check("falling market: gate off", not bool(SW.market_gate(down, pd.Series(14.0, index=d), stock)["on"].iloc[-1]))

# 12. A16: execution policy on one daily bar. Orders are those of an end-of-day book: the stop and BOTH targets rest from
#     entry, so T1 and T2 can fill on one bar; the stop raised after T1 is placed once the T1 fill is known, so it works
#     from the NEXT session. A bar that crosses T1 and then trades below the new stop is not stopped that day.
w = SW.walk(bars([(100, 101, 99, 100), (100, 111, 101, 108), (108, 109, 102, 103)]), T, REF, SL)
ev = [(e[1], e[0] - w["entry_i"]) for e in w["events"]]
check("A16: the raised stop is not applied on the T1 bar itself", ("t1", 1) in ev and ("lock", 1) not in ev, ev)
check("A16: it works from the next session, at its own price", w["exit_reason"] == "lock" and ("lock", 2) in ev and abs(w["events"][-1][2] - 102.5) < 1e-9, w["events"])
w = SW.walk(bars([(100, 101, 99, 100), (125, 126, 124, 125)]), T, REF, SL)
check("A16: a gap through both targets fills both at the open", [e[1] for e in w["events"]] == ["entry", "t1", "t2"] and all(abs(e[2] - 125) < 1e-9 for e in w["events"][1:]), w["events"])
w = SW.walk(bars([(100, 121, 99.5, 120)]), T, REF, SL)
check("A16: T1 and T2 inside one bar both fill (both rest from entry)", w["exit_reason"] == "t2" and len({e[0] for e in w["events"]}) == 1, w["events"])
w = SW.walk(bars([(100, 101, 99, 100), (100, 111, 104, 108), (90, 91, 89, 90)]), T, REF, SL)
check("A16: after T1, a gap below the raised stop fills at the open, below it", w["exit_reason"] == "lock" and abs(w["events"][-1][2] - 90) < 1e-9 and w["pnl"] < 0.5 * 10 + 0.5 * 0, w["events"])

# 13. A15: eligibility is bound to the running rules
good = {"version": SW.VERSION, "params": dict(SW.P), "rules": {"holdout": {"clustered_t_clustered": 2.4}}}
check("A15: matching version, parameters and t >= 2 is eligible", SW.eligibility(good)[0] is True, SW.eligibility(good))
check("A15: a different version is not", SW.eligibility({**good, "version": "swing-1.9.0"})[0] is False)
check("A15: different parameters are not", SW.eligibility({**good, "params": {**SW.P, "max_hold": 40}})[0] is False)
check("A15: a stale fingerprint is not", SW.eligibility({**good, "fingerprint": "0" * 16})[0] is False)
for bad in (float("nan"), float("inf"), None, True, "2.4"):
    check(f"A15: a non-finite or non-numeric statistic ({bad!r}) is not", SW.eligibility({**good, "rules": {"holdout": {"clustered_t_clustered": bad}}})[0] is False)
check("A15: t below 2 is not", SW.eligibility({**good, "rules": {"holdout": {"clustered_t_clustered": 1.99}}})[0] is False)
check("A15: no research is not", SW.eligibility(None)[0] is False)
import json as _json
_live = _json.loads((pathlib.Path(__file__).resolve().parent.parent / "research" / "swing_results.json").read_text())
check("A15: the published research is bound to the running rules (and alerts stay off on its t)", SW.eligibility(_live) == (False, f"Alerts off: the holdout month-clustered t is {_live['rules']['holdout']['clustered_t_clustered']:+.2f}, needs +2.0."), SW.eligibility(_live))

print(f"\n{ok} passed · {fail} failed")
sys.exit(1 if fail else 0)
