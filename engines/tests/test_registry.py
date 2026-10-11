"""Registry tests: one trade per stock, plans fixed at issue, nothing announced twice. Run: python tests/test_registry.py"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import pandas as pd
import registry as R

ok = fail = 0


def check(name, cond, detail=""):
    global ok, fail
    print(("  PASS  " if cond else "  FAIL  ") + name + ("" if cond else f"  {detail}"))
    ok, fail = ok + bool(cond), fail + (not cond)


idx = pd.bdate_range("2025-01-01", periods=14)
def frame(rows):
    return pd.DataFrame([(100, 100, 100, 100, 1e6)] + rows, columns=["Open", "High", "Low", "Close", "Volume"], index=idx[: len(rows) + 1])


def cand(engine, sym="X", date=None, sl=95.0):
    d = str((date or idx[0]).date())
    return {"engine": engine, "sym": sym, "date": d, "issued": d, "sl": sl, "targets": [105.0, 110.0, 120.0], "max_hold": 10}


# 1. dedupe across engines, ownership by priority
df = frame([(100, 106, 99, 105, 1e6), (105, 111, 104, 110, 1e6)] + [(110, 111, 109, 110, 1e6)] * 9)
reg = {"launched": None, "signals": {}}
R.update(reg, [cand("barrier"), cand("rank"), cand("snapback")], {"X": df}, "2025-01-20")
sigs = list(reg["signals"].values())
check("three engines on one stock make ONE trade", len(sigs) == 1, len(sigs))
check("the highest-evidence engine owns it", sigs[0]["engine"] == "snapback")
check("the others are recorded as confirmations", sorted(sigs[0]["also"]) == ["barrier", "rank"], sigs[0]["also"])

# 2. re-running never re-issues, even after the trade closes
R.update(reg, [cand("barrier"), cand("rank"), cand("snapback")], {"X": df}, "2025-01-21")
check("a second run adds nothing", len(reg["signals"]) == 1)
check("the trade closed by the rules", sigs[0]["status"] == "closed" and sigs[0]["hit"] == 2, sigs[0])
check("closed with a net R recorded", isinstance(sigs[0].get("r_net"), float))

# 3. a plan is fixed at issue
before = (sigs[0]["sl"], list(sigs[0]["targets"]))
R.update(reg, [], {"X": frame([(100, 100, 100, 100, 1e6)])}, "2025-01-22")
check("the plan never moves", (sigs[0]["sl"], sigs[0]["targets"]) == before)

# 4. pending then open
df2 = frame([(100, 101, 99, 100, 1e6)] * 2)
reg2 = {"launched": None, "signals": {}}
R.update(reg2, [cand("rank", "Y")], {"Y": frame([])} if False else {"Y": pd.DataFrame([(100, 100, 100, 100, 1e6)], columns=["Open", "High", "Low", "Close", "Volume"], index=idx[:1])}, "2025-01-02")
check("a signal on the last bar is pending", list(reg2["signals"].values())[0]["status"] == "pending")
R.update(reg2, [], {"Y": df2}, "2025-01-03")
e = list(reg2["signals"].values())[0]
check("the next bar's open makes it open at that price", e["status"] == "open" and e["entry"] == 100.0, e)
check("an open trade carries a mark-to-market R", "r_open" in e)

# 5. void when the open gaps past the first target
df3 = pd.DataFrame([(100, 100, 100, 100, 1e6), (107, 108, 106, 107, 1e6)], columns=["Open", "High", "Low", "Close", "Volume"], index=idx[:2])
reg3 = {"launched": None, "signals": {}}
R.update(reg3, [cand("rank", "Z")], {"Z": df3}, "2025-01-03")
check("an opening gap past T1 voids the plan", list(reg3["signals"].values())[0]["status"] == "void")

# 6. a closed stock can be selected again later (a NEW signal id)
reg4 = {"launched": None, "signals": {}}
R.update(reg4, [cand("rank")], {"X": df}, "2025-01-20")
later = cand("rank", date=idx[12])
R.update(reg4, [later], {"X": df}, "2025-01-21")
check("a stock whose trade has closed can be selected again", len(reg4["signals"]) == 2, len(reg4["signals"]))

# 7. the forward record counts only closed trades
rec = R.forward_record(reg)
check("forward record counts the closed trade", rec.get("snapback", {}).get("closed") == 1, rec)
print(f"\n{ok} passed · {fail} failed")
sys.exit(1 if fail else 0)
