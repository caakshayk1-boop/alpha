"""AI pipeline tests: no lookahead in features, labels that read only the stated future, a walk-forward embargo, and a trade layer
that prices stops below entry. Run: python tests/test_ai.py"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import numpy as np
import pandas as pd
import features as F
import labels as L
import walkfwd as W
import ai_trades as T
from ai_engines import ENGINES
from common import Ctx

ok = fail = 0


def check(name, cond, detail=""):
    global ok, fail
    print(("  PASS  " if cond else "  FAIL  ") + name + ("" if cond else f"  {detail}"))
    ok, fail = ok + bool(cond), fail + (not cond)


def make_bars(n=420, seed=1, drift=0.0004):
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range("2023-01-02", periods=n)
    c = 100 * np.cumprod(1 + rng.normal(drift, 0.015, n))
    o = c * (1 + rng.normal(0, 0.003, n))
    h = np.maximum(o, c) * (1 + np.abs(rng.normal(0, 0.006, n)))
    l = np.minimum(o, c) * (1 - np.abs(rng.normal(0, 0.006, n)))
    return pd.DataFrame({"Open": o, "High": h, "Low": l, "Close": c, "Volume": rng.integers(2e5, 5e5, n).astype(float)}, index=idx)


bars = {f"S{i}": make_bars(seed=i) for i in range(12)}
bench = pd.Series(make_bars(seed=99)["Close"].values, index=bars["S0"].index)
uni = [{"sym": s, "name": s, "sector": "Industrials", "ind": "Capital Goods"} for s in bars]
ctx = Ctx(bars, bench, uni, {})

# 1. features at date t do not change when the future is rewritten
t = 300
full = F.symbol_features(bars["S1"], "S1", ctx)
alt = {k: v.copy() for k, v in bars.items()}
alt["S1"].iloc[t + 1:, :4] *= 3.0
ctx2 = Ctx(alt, bench, uni, {})
cut = F.symbol_features(alt["S1"], "S1", ctx2)
cols = [c for c in full.columns if c in cut.columns]
same = np.allclose(full.iloc[: t + 1][cols].values.astype(float), cut.iloc[: t + 1][cols].values.astype(float), equal_nan=True, rtol=1e-6, atol=1e-9)
check("features up to t ignore everything after t", same)

# 2. forward return enters at the NEXT open and exits at the horizon close
df = bars["S2"]
fr = L.forward_returns(df, (5,))
i = 100
check("fwd_5 = close[t+5] / open[t+1] - 1", abs(float(fr["fwd_5"].iloc[i]) - (df["Close"].iloc[i + 5] / df["Open"].iloc[i + 1] - 1)) < 1e-5)
check("the last horizon rows have no label", fr["fwd_5"].iloc[-5:].isna().all())

# 3. barrier label: stop wins a tie, and is undecidable near the end
bl = L.barrier_label(df, 1.5, 3.0, 15)
check("barrier label is 0/1/NaN only", set(bl.dropna().unique()) <= {0.0, 1.0})
check("barrier label is NaN where the window is unfinished", bl.iloc[-16:].isna().all())
# a bar that touches both barriers resolves to the STOP
tie_df = df.copy()
tie_df.iloc[:, :4] = 100.0
tie_df.iloc[60:, tie_df.columns.get_loc("High")] = 100.0
k = 50
tie_df.iloc[k + 2, tie_df.columns.get_loc("High")] = 500.0
tie_df.iloc[k + 2, tie_df.columns.get_loc("Low")] = 1.0
tie_df.iloc[:k + 2, tie_df.columns.get_loc("High")] = 100.5
tie_df.iloc[:k + 2, tie_df.columns.get_loc("Low")] = 99.5
tl = L.barrier_label(tie_df, 1.5, 3.0, 15)
check("a bar that touches both barriers counts as a stop", float(tl.iloc[k]) == 0.0, tl.iloc[k])

# 4. walk-forward trains only on rows whose label is already known (embargo of H+1 sessions)
dates = pd.bdate_range("2023-01-02", periods=400)
panel = pd.DataFrame({"x": np.arange(400 * 3, dtype=float), "liquid": 1.0}, index=pd.MultiIndex.from_product([dates, ["A", "B", "C"]], names=["date", "sym"]))
lab = pd.DataFrame({"y": np.arange(400 * 3, dtype=float)}, index=panel.index)
H = 21
upto = 300 - (H + 1)
X, y = W.training_rows(panel, lab, "y", ["x"], dates, upto, 1)
check("training rows stop at the embargo", X.index.get_level_values("date").max() <= dates[upto])
check("stride thins the training rows", len(W.training_rows(panel, lab, "y", ["x"], dates, upto, 3)[0]) < len(X) * 0.4)

# 5. trade layer: stops below entry, targets ascending, and caps on risk
for key, eng in ENGINES.items():
    p = T.plan(eng, 100.0, 2.0)
    check(f"{key}: stop below entry, targets rise", p is not None and p[0] < 100 and p[1] == sorted(p[1]) and p[1][0] > 100, p)
    check(f"{key}: risk never exceeds its cap", p is None or (100 - p[0]) / 100 <= eng.max_risk_pct + 1e-9, p)
check("a stop tighter than 0.5% is refused", T.plan(ENGINES["rank"], 100.0, 0.05) is None)

# 6. at most picks_per_day signals a session, never the same stock inside the cooldown
atrs = T.atr_table(bars)
d = bars["S0"].index[300:340]
rng = np.random.default_rng(3)
sc = pd.Series(rng.normal(size=len(d) * len(bars)), index=pd.MultiIndex.from_product([d, list(bars)], names=["date", "sym"]))
eng = ENGINES["rank"]
sigs = T.signals_from_scores(eng, sc, bars, atrs, d[0], d[-1] + pd.Timedelta(days=1))
per_day = pd.Series([s.date for s in sigs]).value_counts()
check("no more than picks_per_day signals a session", per_day.max() <= eng.picks_per_day)
gaps = []
for sym in bars:
    ts = sorted(s.t for s in sigs if s.sym == sym)
    gaps += [b - a for a, b in zip(ts, ts[1:])]
check("cooldown respected per stock", not gaps or min(gaps) >= eng.cooldown, min(gaps) if gaps else None)

# ── published results must reconcile (audit 2026-10-12) ─────────────────────
# "Hit all targets" once exceeded "Reached T3" in every engine because they were
# computed on different populations. Both now come from one trade list.
import json
import ai_finalize as FIN
res = json.loads((pathlib.Path(__file__).resolve().parent.parent / "research" / "ai_results.json").read_text())["engines"]
for key, e in res.items():
    ex, n = e["exits"], e["exits_n"]
    check(f"{key}: exit categories sum to the trade count", sum(ex.values()) == n, (sum(ex.values()), n))
    check(f"{key}: n matches the metrics sample", n == e["trades"]["all"]["n"], (n, e["trades"]["all"]["n"]))
    check(f"{key}: 'all targets' equals 'reached T3'", abs(ex["all_targets"] / n * 100 - e["trades"]["all"]["hit_t3"]) <= 0.1, (ex["all_targets"] / n * 100, e["trades"]["all"]["hit_t3"]))
    check(f"{key}: alertable matches alert_verdict", e["alertable"] == FIN.alert_verdict(e["ranking_status"], e["trading_status"])[0])

print(f"\n{ok} passed · {fail} failed")
sys.exit(1 if fail else 0)
