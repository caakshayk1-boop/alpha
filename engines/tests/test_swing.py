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

print(f"\n{ok} passed · {fail} failed")
sys.exit(1 if fail else 0)
