"""Integrity tests of CLAUDE_TASK Phase 3 on the live Swing v2 code, on synthetic bars. Offline. python tests/test_integrity.py

  truncation invariance   the gate and the candidates at session t are the same computed on data cut at t or on all of it
  future poison           garbage after t (prices x3, NaN volume) changes nothing at or before t
  determinism             two runs of the same book on the same data are byte-identical
  cost sanity             a round trip that exits at its entry price loses exactly the modelled cost
The bars are random walks with a planted trend so setups fire; they are fixtures, not evidence about any strategy.
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import swing as SW  # noqa: E402
from common import COST_PCT, Ctx  # noqa: E402

ok = fail = 0


def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  PASS  {name}")
    else:
        fail += 1
        print(f"  FAIL  {name}  {detail}")


rng = np.random.default_rng(7)
IDX = pd.bdate_range("2023-01-02", periods=520)


def walk_bars(drift: float) -> pd.DataFrame:
    c = 200 * np.exp(np.cumsum(rng.normal(drift, 0.017, len(IDX))))
    o = c * (1 + rng.normal(0, 0.004, len(IDX)))
    h = np.maximum(o, c) * (1 + np.abs(rng.normal(0, 0.009, len(IDX))))
    lo = np.minimum(o, c) * (1 - np.abs(rng.normal(0, 0.009, len(IDX))))
    v = rng.integers(400_000, 3_000_000, len(IDX)).astype(float)
    return pd.DataFrame({"Open": o, "High": h, "Low": lo, "Close": c, "Volume": v}, index=IDX)


BARS = {f"S{i:02d}": walk_bars(0.0012 if i % 2 else 0.0002) for i in range(30)}
UNI = [{"sym": s, "name": s, "sector": "ABC"[i % 3], "ind": None, "mcap_cr": 10_000} for i, s in enumerate(BARS)]
BENCH = pd.Series(18_000 * np.exp(np.cumsum(rng.normal(0.0008, 0.008, len(IDX)))), index=IDX)
VIX = pd.Series(rng.uniform(11, 19, len(IDX)), index=IDX)
SECTOR = {u["sym"]: u["sector"] for u in UNI}


def cands_upto(bars, bench, vix, t):
    """Candidates dated at or before t, computed on the data given."""
    ctx = Ctx(bars, bench, UNI, {})
    gate = SW.market_gate(bench, vix, bars)
    r63 = bench / bench.shift(63) - 1
    out = []
    for s, df in bars.items():
        out += SW.scan_stock(s, df, gate, ctx, r63, ctx.rs126[s] if s in ctx.rs126 else None, pd.Timestamp("2000-01-01"), t + pd.Timedelta(days=1))
    return sorted((c.sym, str(c.date.date()), c.setup, round(c.ref, 6), round(c.sl, 6), round(c.rank, 6)) for c in out if c.date <= t), gate


def cut(t):
    return {s: d.loc[:t] for s, d in BARS.items()}, BENCH.loc[:t], VIX.loc[:t]


def poison(t):
    bad = {}
    for s, d in BARS.items():
        d = d.copy()
        after = d.index > t
        d.loc[after, ["Open", "High", "Low", "Close"]] *= 3.0
        d.loc[after, "Volume"] = np.nan
        bad[s] = d
    b = BENCH.copy()
    b[b.index > t] *= 0.2
    v = VIX.copy()
    v[v.index > t] = 99.0
    return bad, b, v


full_c, full_g = cands_upto(BARS, BENCH, VIX, IDX[-1])
check("the fixture produces candidates to test against", len(full_c) >= 5, len(full_c))

GATE_COLS = ["trend", "intermediate", "breadth", "breadth_ok", "vix_ok", "on"]
for t in (IDX[300], IDX[400], IDX[480]):
    b, bn, vx = cut(t)
    c_t, g_t = cands_upto(b, bn, vx, t)
    want = [x for x in full_c if x[1] <= str(t.date())]
    check(f"truncation invariance · candidates up to {t.date()}", c_t == want, f"{len(c_t)} vs {len(want)}")
    same_gate = all((pd.isna(g_t.at[t, k]) and pd.isna(full_g.at[t, k])) or g_t.at[t, k] == full_g.at[t, k] for k in GATE_COLS)
    check(f"truncation invariance · market gate on {t.date()}", same_gate, {k: (g_t.at[t, k], full_g.at[t, k]) for k in GATE_COLS})
    pb, pbn, pvx = poison(t)
    c_p, g_p = cands_upto(pb, pbn, pvx, t)
    check(f"future poison · candidates up to {t.date()} unchanged", c_p == want, f"{len(c_p)} vs {len(want)}")
    hist = full_g.loc[:t, GATE_COLS].astype(str).equals(g_p.loc[:t, GATE_COLS].astype(str))
    check(f"future poison · gate history up to {t.date()} unchanged", hist)


def book_digest():
    cands = []
    ctx = Ctx(BARS, BENCH, UNI, {})
    gate = SW.market_gate(BENCH, VIX, BARS)
    r63 = BENCH / BENCH.shift(63) - 1
    for s, df in BARS.items():
        cands += SW.scan_stock(s, df, gate, ctx, r63, ctx.rs126[s] if s in ctx.rs126 else None, pd.Timestamp("2000-01-01"), pd.Timestamp("2100-01-01"))
    taken = SW.run_book(cands, BARS, SECTOR)
    rows = [{"sym": c.sym, "d": str(c.date.date()), "w": {k: v for k, v in w.items() if k != "events"}, "e": w.get("events")} for c, w in taken]
    return hashlib.sha256(json.dumps(rows, sort_keys=True, default=str).encode()).hexdigest(), len(rows)


d1, n1 = book_digest()
d2, n2 = book_digest()
check("determinism · two runs of the book are byte-identical", d1 == d2 and n1 == n2, (d1[:12], d2[:12]))

# cost sanity: a trade that exits at exactly its entry price (time exit on flat bars) loses the modelled cost and nothing else
flat = pd.DataFrame([(100.0, 100.5, 99.5, 100.0, 1e6)] * 80, columns=["Open", "High", "Low", "Close", "Volume"], index=pd.bdate_range("2026-01-01", periods=80))
w = SW.walk(flat, 20, 100.0, 95.0)
t = SW.to_trade("FLAT", "Test", flat.index[20], flat, w)
check("cost sanity · a flat round trip exits on the clock", w["closed"] and w["exit_reason"] == "time", w.get("exit_reason"))
check("cost sanity · gross R is exactly 0", abs(t.gross_r) < 1e-12, t.gross_r)
check("cost sanity · net R is exactly -cost x entry / risk", abs(t.r - (-COST_PCT * 100.0 / 5.0)) < 1e-12, (t.r, -COST_PCT * 100.0 / 5.0))

print(f"{ok} passed · {fail} failed")
sys.exit(1 if fail else 0)
