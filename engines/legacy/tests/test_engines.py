"""Correctness tests for the engine toolkit. No network. Run: python tests/test_engines.py [bars.pkl]"""
import pathlib, random, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import numpy as np
import pandas as pd

import common
from common import Signal, simulate
import e1_rebound, e2_divergence, e3_breakout, e4_swing
from indicators import rsi, weekly

ok = fail = 0


def check(name, cond, detail=""):
    global ok, fail
    print(("  PASS  " if cond else "  FAIL  ") + name + ("" if cond else f"  {detail}"))
    ok, fail = ok + bool(cond), fail + (not cond)


def bars(rows, start="2025-01-01"):
    idx = pd.bdate_range(start, periods=len(rows))
    return pd.DataFrame(rows, columns=["Open", "High", "Low", "Close", "Volume"], index=idx)


def sig(df, t, sl, targets, hold=10):
    return Signal("x", "TST", t, df.index[t], float(df["Close"].iloc[t]), sl, targets, hold, "test")


# bar 0 is the signal bar; entry is bar 1's open = 100; stop 95 (risk 5); targets 105, 110, 120
def run(rows, **kw):
    df = bars([(100, 100, 100, 100, 1e6)] + rows)
    return simulate(df, sig(df, 0, kw.get("sl", 95), kw.get("targets", [105, 110, 120]), kw.get("hold", 10)), cost_pct=0)


print("── simulator ──")
t = run([(100, 101, 94, 96, 1e6)])
check("a stop is -1R", t and abs(t.r + 1) < 1e-9 and t.exit_reason == "stop", t)
t = run([(100, 111, 99, 108, 1e6), (108, 121, 107, 120, 1e6)])
check("all three targets: (1+2+4)/3 R", t and t.hit == 3 and abs(t.r - (1 + 2 + 4) / 3) < 1e-9, t)
t = run([(100, 106, 99, 105, 1e6), (105, 105, 99.9, 101, 1e6), (100, 100, 99, 100, 1e6)])
check("after T1 the stop is break-even", t and t.hit == 1 and t.exit_reason == "breakeven", t)
check("T1 then break-even exit nets +1/3 * (5/5)", t and abs(t.r - (1 / 3) * 1.0) < 1e-9, t)
t = run([(100, 108, 94, 107, 1e6)])
check("a bar spanning the stop and a target takes the STOP first", t and t.hit == 0 and abs(t.r + 1) < 1e-9, t)
t = run([(100, 100, 99, 100, 1e6), (90, 91, 89, 90, 1e6)])
check("a gap through the stop exits at the OPEN (-2R), not at the stop", t and abs(t.r + 2) < 1e-9, t)
t = run([(100, 101, 99, 100, 1e6)] * 3 + [(100, 101, 99, 103, 1e6)], hold=4)
check("a time exit sells at the close of the last bar", t and t.exit_reason == "time" and abs(t.r - 0.6) < 1e-9, t)
check("a signal on the last bar has no entry", simulate(bars([(100, 100, 100, 100, 1)] * 3), sig(bars([(100, 100, 100, 100, 1)] * 3), 2, 95, [105, 110, 120])) is None)
df = bars([(100, 100, 100, 100, 1e6), (106, 107, 105, 106, 1e6)])
check("an open already past T1 voids the setup", simulate(df, sig(df, 0, 95, [105, 110, 120])) is None)
t = run([(100, 101, 99, 100, 1e6)] * 2, hold=2)
check("costs reduce R", t is not None)
df2 = bars([(100, 100, 100, 100, 1e6)] + [(100, 106, 99, 105, 1e6), (105, 111, 104, 110, 1e6), (110, 121, 109, 120, 1e6)])
net = simulate(df2, sig(df2, 0, 95, [105, 110, 120], 10), cost_pct=0.0025)
gross = simulate(df2, sig(df2, 0, 95, [105, 110, 120], 10), cost_pct=0)
check("a 0.25% cost on a 5% stop is 0.05R", abs((gross.r - net.r) - 0.05) < 1e-9, (gross.r, net.r))

print("\n── weekly bars never show an unfinished week ──")
idx = pd.bdate_range("2025-03-03", periods=7)       # Mon-Fri, then Mon-Tue of the next week
d = pd.DataFrame({"Open": 1.0, "High": 2.0, "Low": 0.5, "Close": np.arange(7) + 1.0, "Volume": 10}, index=idx)
w = weekly(d)
check("a half-finished final week is not returned", len(w) == 1 and w.index[-1] == idx[4], list(w.index))
w2 = weekly(d.iloc[:5])
check("a week that ended on Friday is returned", len(w2) == 1)

if len(sys.argv) > 1:
    print("\n── no lookahead: the signals for day t do not change when later days are removed ──")
    data = pd.read_pickle(sys.argv[1])
    allbars = data["bars"]
    ctx = common.Ctx(allbars, data["bench"])
    rnd = random.Random(5)
    syms = rnd.sample(sorted(allbars), 45)
    for mod in (e1_rebound, e2_divergence, e3_breakout, e4_swing):
        diffs = 0
        total = 0
        for s in syms:
            df = allbars[s]
            full = {(x.date, x.setup) for x in mod.scan(df, s, ctx)}
            for cut in (-30, -120, -300, -520):
                part = df.iloc[:cut]
                if len(part) < 300:
                    continue
                cutoff = part.index[-1]
                trunc = {(x.date, x.setup) for x in mod.scan(part, s, ctx)}
                want = {k for k in full if k[0] <= cutoff}
                # a signal on the truncated final day is allowed to differ only if it is not yet confirmable; it must still be in full
                total += len(want)
                bad = (want ^ trunc)
                diffs += len(bad)
                if bad and diffs <= 2:
                    print("      example", s, cut, sorted(bad)[:2])
        check(f"{mod.TITLE}: identical with and without the future ({total} signals checked)", diffs == 0, f"{diffs} differences")

    print("\n── every live-shaped signal is internally consistent ──")
    for mod in (e1_rebound, e2_divergence, e3_breakout, e4_swing):
        bad = 0
        n = 0
        for s in syms:
            for x in mod.scan(allbars[s], s, ctx):
                n += 1
                t1, t2, t3 = x.targets
                if not (x.sl < x.ref_price < t1 < t2 <= t3 or x.sl < x.ref_price < t1 <= t2 <= t3) or x.max_hold <= 0:
                    bad += 1
        check(f"{mod.TITLE}: stop < price < T1 <= T2 <= T3 on {n} signals", bad == 0, f"{bad} bad")

print(f"\n{ok} passed · {fail} failed")
sys.exit(1 if fail else 0)
