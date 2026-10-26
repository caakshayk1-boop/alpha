"""python apps/tripwire/research/test_research.py : the indicator maths on hand-checkable series, and the study harness on a pure random
walk (nothing may be adopted) and on a planted effect (it must be found). No network."""
import sys, pathlib
import numpy as np, pandas as pd
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import indicators as ind
import study
from indicators import Panel

def panel(C, O=None, H=None, L=None, V=None, M=None, dates=None):
    C = np.asarray(C, float); T, N = C.shape
    O = C.copy() if O is None else O; H = C * 1.01 if H is None else H; L = C * 0.99 if L is None else L
    V = np.full_like(C, 1e6) if V is None else V; M = C[:, 0] if M is None else M
    dates = (np.datetime64("2016-01-01") + np.arange(T).astype("timedelta64[D]")) if dates is None else dates
    return Panel(dates, [f"S{i}" for i in range(N)], O, H, L, C, V, M)

# ---- hand-checkable indicators ----
line = np.column_stack([100 + np.arange(300) * 1.0, 100 + np.where(np.arange(300) % 2 == 0, 0.0, 1.0)])   # a straight line and a zig-zag
p = panel(line)
er = ind.eff_ratio60(p, 200)
assert abs(er[0] - 1.0) < 1e-9, er                       # a straight line has efficiency 1
assert er[1] < 0.05, er                                  # a zig-zag has almost none
assert abs(ind.mom12_1(p, 280)[0] - (p.C[259, 0] / p.C[28, 0] - 1)) < 1e-12   # skips the latest 21 sessions
assert np.isnan(ind.mom12_1(p, 100)).all() and np.isnan(ind.near_high(p, 100)).all()   # not enough history is NaN, never a number
assert abs(ind.near_high(p, 299)[0] - 1.0) < 1e-9        # a rising line closes at its own 52-week high
steady = np.cumprod(np.full(300, 1.001)); jumpy = np.ones(300); jumpy[100] = 1.28; jumpy[200] = 1.0                 # same-ish total, one by steady days, one by jumps
rets = np.zeros(300); rets[1:] = 0.0; rets[[50, 150, 250]] = 0.12; jc = np.cumprod(1 + rets)
pf = panel(np.column_stack([steady, jc]))
fip = ind.smooth_fip(pf, 280); assert fip[0] > 0.9 and fip[1] < 0.1, fip    # steady gains: nearly all days up; a few jumps: few days up
c = np.full((200, 1), 100.0); c[::7] = 103.0; pm = panel(c)
assert ind.max5(pm, 150)[0] < 0                          # the biggest gains are negated
hi = panel(np.full((120, 2), 100.0), H=np.column_stack([np.full(120, 110.0), np.full(120, 100.0)]), L=np.column_stack([np.full(120, 90.0), np.full(120, 100.0)]))
assert abs(ind.clv20(hi, 100)[0] - 0.0) < 1e-9           # the close is mid-range
H2 = np.full((120, 1), 110.0); L2 = np.full((120, 1), 90.0); C2 = np.full((120, 1), 110.0)
assert abs(ind.clv20(panel(C2, H=H2, L=L2), 100)[0] - 1.0) < 1e-9     # closing on the high is +1
o = np.full((100, 1), 101.0); cc = np.full((100, 1), 100.0)
assert abs(ind.overnight60(panel(cc, O=o), 90)[0] - 60 * 0.01) < 1e-9  # a 1 percent gap every night, 60 nights
assert ind.noise(p, 5).tolist() == ind.noise(p, 5).tolist() and ind.noise(p, 5).tolist() != ind.noise(p, 6).tolist()

# ---- a random walk: nothing may be adopted, the noise control must not pass ----
def walk(T=2500, N=260, seed=3):
    r = np.random.default_rng(seed)
    rets = r.normal(0.0003, 0.018, (T, N)); mkt = r.normal(0.0004, 0.009, T)
    C = 100 * np.cumprod(1 + rets + 0.6 * mkt[:, None], axis=0); M = 10000 * np.cumprod(1 + mkt)
    gap = r.normal(0, 0.004, (T, N)); O = np.vstack([C[:1], C[:-1]]) * (1 + gap)
    H = np.maximum(O, C) * (1 + np.abs(r.normal(0, 0.006, (T, N)))); L = np.minimum(O, C) * (1 - np.abs(r.normal(0, 0.006, (T, N))))
    V = np.exp(r.normal(np.log(2e6), 0.4, (T, N)))
    dates = pd.bdate_range("2016-01-01", periods=T).to_numpy("datetime64[D]")
    return Panel(dates, [f"W{i}" for i in range(N)], O, H, L, C, V, M)
w = walk()
null = study.run(w)
adopted = [k for k, v in null["verdict"].items() if v["adopt"]]
assert not adopted, f"a random walk produced adoptions: {adopted}"
assert not null["verdict"]["noise"]["adopt"]
ts = [abs(null["features"][f]["train"]["t"]) for f in null["features"] if null["features"][f]["train"]["t"] is not None]
assert max(ts) < 4.5, ts                                  # no wildly significant feature in noise
print("null: nothing adopted; largest |t| in train", round(max(ts), 2))

# ---- a planted effect must be found, and only it ----
def planted(p, i):
    base = study.forward(p, i)
    x = ind.eff_ratio60(p, i); ok = ~np.isnan(x)
    r = np.full_like(x, np.nan); r[ok] = pd.Series(x[ok]).rank(pct=True).to_numpy() - 0.5
    return base + 0.03 * np.where(np.isnan(r), 0, r)
hit = study.run(w, fwd_override=planted)
assert hit["verdict"]["eff_ratio60"]["adopt"], hit["features"]["eff_ratio60"]
others = [k for k, v in hit["verdict"].items() if v["adopt"] and k not in ("eff_ratio60", "mod:eff_ratio60")]   # the same effect also shows as a modifier of momentum: expected
assert not others, f"the planted effect leaked into: {others}"
print("planted: eff_ratio60 found", hit["features"]["eff_ratio60"]["train"], "| no other feature adopted")

# ---- the report renders ----
md = study.to_markdown(hit, {"when": "x", "symbols": 260, "dates": ["2016-01-01", "2025-06-01"]})
assert "eff_ratio60" in md and "**YES**" in md
print("research: all checks passed")
