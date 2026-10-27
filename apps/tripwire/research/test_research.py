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

# ---- the engine back-test harness: nothing in a random walk, and a hand-checked trade ----
import engines_backtest as bt
sector = np.array([f"S{i % 9}" for i in range(w.C.shape[1])])
rb = bt.run(w, sector, engines=("MOM", "LVT"))
for eng, r in rb.items():
    ho = r["periods"]["holdout"]; assert abs((ho.get("excess_vs_universe") or 0)) < 0.03, (eng, ho)    # no large edge appears from noise
    assert r["periods"]["train"]["trades"] > 20, (eng, r["periods"]["train"])
# a hand-built trade: gap-free, rises 10 percent, exits on time with costs
C = np.full((100, 1), 100.0); C[11:, 0] = 110.0; O = C.copy(); H = C * 1.001; L = C * 0.999
pt = panel(C, O=O, H=H, L=L)
# the next open is already 110: a +10 percent gap, so the 2 percent rule SKIPS it
assert bt.trade(pt, 10, 0, 5.0, 20) is None
C2 = np.full((100, 1), 100.0); C2[12:, 0] = 108.0; O2 = C2.copy(); pt2 = panel(C2, O=O2, H=C2 * 1.001, L=C2 * 0.999)
net2, R2 = bt.trade(pt2, 10, 0, 5.0, 20)
exp = (108.0 / (100.0 * 1.001) - 1) - 0.0025 - 0.001 * 108.0 / (100.0 * 1.001)
assert abs(net2 - exp) < 1e-9 and R2 > 0, (net2, exp)
C3 = np.full((100, 1), 100.0); C3[13:, 0] = 90.0; O3 = C3.copy(); L3 = C3 * 0.999; pt3 = panel(C3, O=O3, H=C3 * 1.001, L=L3)
n3, R3 = bt.trade(pt3, 10, 0, 5.0, 20); assert n3 < -0.09 and R3 < -1.5, (n3, R3)   # a gap through the stop loses more than 1R
print("engines back-test: harness checks passed")

# ---- the factor sheet ----
import factors as fx
sh = fx.sheet(w, "2026-10-23", {"eff_ratio60": {"adopt": False, "kind": "candidate"}})
assert sh["schema"] == "tripwire-factors/1" and 100 < sh["universe"] <= w.C.shape[1] and len(sh["rows"]) <= sh["universe"]
vals = [v for r in sh["rows"].values() for v in r.values()]
assert vals and min(vals) >= 0 and max(vals) <= 100, (min(vals), max(vals))
assert sh["study"]["eff_ratio60"] == {"adopt": False, "kind": "candidate"} and "noise" not in sh["rows"][next(iter(sh["rows"]))]
assert fx.sheet(w, "x")["rows"] == sh["rows"], "the sheet is deterministic"
print("factor sheet: checks passed")

# ---- walk-forward: the choice never reads the year it is for, a random walk is never 'supported', a planted effect in one variant is chosen and found ----
import engines_walkforward as wfm
def fake(effect_for=None, seed=1, years=range(2016, 2027)):
    r = np.random.default_rng(seed); table = {}
    for v in wfm.FAMILY:
        k = wfm.vid(v); recs = []
        for y in years:
            for m in range(1, 13):
                for half in (5, 20):
                    ex = r.normal(0.0, 0.03) + (0.02 if effect_for == k else 0.0)
                    recs.append({"d": f"{y}-{m:02d}-{half:02d}", "year": y, "net": ex, "excess": ex, "active": True})
        table[k] = recs
    return table
t = fake()
c0 = wfm.choose(t, 2020)
for recs in t.values():
    for rr in recs:
        if rr["d"] >= "2019-12-01": rr["excess"] = 99.0; rr["net"] = 99.0                     # poison every record from December 2019 on
assert wfm.choose(t, 2020) == c0, "the choice for a year read data from that year"
nulls = [wfm.walk_forward(fake(seed=s)) for s in range(1, 9)]
assert not any(w["procedure"]["supported"] for w in nulls[:8]) or sum(w["procedure"]["supported"] for w in nulls) <= 1, "noise was 'supported' too often"
assert not any(v["supported"] for w in nulls for v in w["variants"].values() if v["t"] is not None and v["t"] < wfm.T_FIXED)
planted_key = wfm.vid(wfm.FAMILY[2]); pl = wfm.walk_forward(fake(effect_for=planted_key))
assert pl["variants"][planted_key]["supported"] and pl["procedure"]["supported"], pl["procedure"]
assert sum(pl["chosen"][str(y)] == planted_key for y in pl["test_years"]) >= len(pl["test_years"]) - 2, "the planted variant was not chosen"
print("walk-forward: choice reads no future data; noise not supported; a planted effect is chosen and found")

# ---- lab panel: the file round-trips exactly (to the paisa), a name is absent before it listed, a gap carries the last close, and the golden fixture the browser decodes is the one written here ----
import json
import lab_panel as lp
rg2 = np.random.default_rng(4); Tn, Nn = 300, 5
Cx = np.exp(np.cumsum(rg2.normal(0, 0.01, size=(Tn, Nn)), axis=0)) * 100; Cx[:40, 2] = np.nan; Cx[100:103, 1] = np.nan
dts = [str(np.datetime64("2020-01-01") + k) for k in range(Tn)]
meta, blob = lp.encode(dts, [f"S{k}" for k in range(Nn)], Cx); back = lp.decode(meta, blob)
assert meta["first"] == [0, 0, 40, 0, 0], meta["first"]
assert np.isnan(back[:40, 2]).all() and not np.isnan(back[40:, 2]).any(), "a name must be absent before it listed and present after"
assert np.allclose(back[~np.isnan(Cx)], np.round(Cx[~np.isnan(Cx)] * 100) / 100, atol=0.0051), "the round trip lost more than a paisa"
assert np.allclose(back[100:103, 1], back[99, 1]), "a gap must carry the last close, not read as a crash"
gold = pathlib.Path(__file__).parent.parent / "tests" / "fixtures"
tiny = np.array([[10.0, np.nan], [10.5, 20.25], [10.25, 20.5], [11.0, 20.5]]); tm, tb = lp.encode(["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06"], ["AAA", "BBB"], tiny)
tm["built"] = "fixture"; (gold / "lab_panel_golden.json").write_text(json.dumps(tm, separators=(",", ":"))); (gold / "lab_panel_golden.bin.gz").write_bytes(tb)
print("lab panel: round trip exact to the paisa; absent before listing; gaps carry; golden fixture written")
# ---- pairs: ADF has the right size, a planted cointegrated pair is found and earns, independent walks do not, nothing after the formation close is read ----
import engines_pairs as pr
rg = np.random.default_rng(11)
fp = [pr.adf_t(np.cumsum(rg.normal(size=252))) <= pr.ADF_5PCT for _ in range(400)]
assert np.mean(fp) < 0.12, f"a random walk residual passed the -3.34 bar {np.mean(fp):.2f} of the time"      # nominal 5 percent; the walk itself is not a fitted residual, so this is conservative on size
ou = np.zeros(252)
for k in range(1, 252): ou[k] = 0.85 * ou[k - 1] + rg.normal(scale=0.01)
assert pr.adf_t(ou) <= pr.ADF_5PCT and 3 <= pr.half_life(ou) <= 30, "a mean-reverting series was not recognised"
def pair_panel(seed, coint, T=1100, N=8):
    r = np.random.default_rng(seed); lx = np.cumsum(r.normal(0, 0.012, size=(T, N)), axis=0) + 4.0; ly = lx.copy()
    for j in range(0, N, 2):
        if coint:
            e = np.zeros(T)
            for k in range(1, T): e[k] = 0.85 * e[k - 1] + r.normal(0, 0.012)
            ly[:, j] = 1.1 * lx[:, j + 1] + e + 0.2
        else: ly[:, j] = np.cumsum(r.normal(0, 0.012, size=T)) + 4.0
    C = np.exp(np.where(np.arange(N) % 2 == 0, ly, lx).reshape(T, N)); dates = (np.datetime64("2018-01-01") + np.arange(T)).astype("datetime64[D]")
    return Panel(dates, [f"S{j}" for j in range(N)], C, C, C, C, np.ones_like(C), np.ones(T)), np.array(["Banks"] * N)
pp, sec = pair_panel(5, True)
# make the sibling in each pair move with the first so the correlation gate passes
chosen = pr.screen(pp.C, 600, sec, True); assert chosen, "the planted cointegrated pairs were not selected"
res_c = pr.run(pp, sec, True); assert res_c["trades"] >= 5 and res_c["mean_net"] is not None and res_c["mean_net"] > 0, res_c      # a real, strong effect must earn after costs
before = [(c["a"], c["b"], round(c["beta"], 9)) for c in pr.screen(pp.C, 600, sec, True)]
pp2 = Panel(pp.dates, pp.syms, pp.O, pp.H, pp.L, pp.C.copy(), pp.V, pp.M); pp2.C[600:] = 7e7
assert before == [(c["a"], c["b"], round(c["beta"], 9)) for c in pr.screen(pp2.C, 600, sec, True)], "the screen at close i read a price from i or later"
nulls = [pr.run(pair_panel(s, False)[0], pair_panel(s, False)[1], True) for s in range(20, 26)]
assert sum(n["supported"] for n in nulls) <= 1, "independent random walks were 'supported' too often"
print("pairs: ADF size sane, a planted pair is found, the screen reads no future price, noise is not supported")

# ---- provenance: a run says what it ran on and why it differs from the last run of the same study ----
import provenance as pv, tempfile, types
def fakep(T=300, N=4, shift=0.0, extra=0, seed=2):
    r = np.random.default_rng(seed); C = np.exp(np.cumsum(r.normal(0, 0.01, size=(T + extra, N)), axis=0)) * 100 + shift
    return types.SimpleNamespace(dates=np.array([np.datetime64("2020-01-01") + np.timedelta64(k, "D") for k in range(T + extra)]), syms=[f"S{k}" for k in range(N)], C=C)
tmp = pathlib.Path(tempfile.mkdtemp()); code = [pathlib.Path(__file__)]
m1 = pv.stamp({"when": "t1"}, fakep(), tmp / "x.json", "demo", {"cost": 0.25}, code)["run"]
assert m1["changes"][0].startswith("First recorded run") and m1["previous"] is None
same = pv.stamp({"when": "t2"}, fakep(), tmp / "x.json", "demo", {"cost": 0.25}, code)["run"]
assert same["id"] == m1["id"] and "No change" in same["changes"][0], same["changes"]
grown = pv.stamp({"when": "t3"}, fakep(extra=40), tmp / "x.json", "demo", {"cost": 0.25}, code)["run"]
assert grown["id"] != m1["id"] and any("History window moved" in c and "+40 sessions" in c for c in grown["changes"]), grown["changes"]
assert not any("restated" in c for c in grown["changes"]), "the same closes over a longer window must not read as restated"
rest = pv.stamp({"when": "t4"}, fakep(extra=40, shift=5.0), tmp / "x.json", "demo", {"cost": 0.25}, code)["run"]
assert any("restated old closes" in c for c in rest["changes"]), rest["changes"]
fewer = fakep(extra=40, shift=5.0); fewer.syms = fewer.syms[:3]; fewer.C = fewer.C[:, :3]
u = pv.stamp({"when": "t5"}, fewer, tmp / "x.json", "demo", {"cost": 0.25}, code)["run"]; assert any("Universe changed: 0 names added, 1 removed" in c for c in u["changes"]), u["changes"]
pm = pv.stamp({"when": "t6"}, fewer, tmp / "x.json", "demo", {"cost": 0.30}, code)["run"]; assert any("Parameters changed: cost 0.25 to 0.3" in c for c in pm["changes"]), pm["changes"]
other = tmp / "other.py"; other.write_text("a=1"); pv.stamp({"when": "t7"}, fewer, tmp / "x.json", "demo2", {}, [other]); other.write_text("a=2")
cc = pv.stamp({"when": "t8"}, fewer, tmp / "x.json", "demo2", {}, [other])["run"]; assert any("Study code changed: other.py" in c for c in cc["changes"]), cc["changes"]
print("provenance: first run, no change, history grown, closes restated, universe, parameters and code changes are each named")

# ---- RSI on three timeframes: same numbers as the app's chart code (shared golden vectors), partial periods count to date, a name with no last close has no figure ----
import json as _json, numpy as _np, pandas as _pd, pathlib as _pl
from rsi_multi import wilder as _wilder, sheet as _rsi_sheet
_G = _json.loads((_pl.Path(__file__).parent.parent / "tests" / "fixtures" / "rsi_golden.json").read_text())
for _k, _g in _G.items():
    for _a, _b in zip(_wilder(_g["closes"]), _g["rsi"]):
        assert (_a is None and _b is None) or abs(_a - _b) < 1e-4, (_k, _a, _b)
_d = _pd.bdate_range("2025-01-01", "2026-10-23"); _rng = _np.random.default_rng(3)
_C = _np.column_stack([100 * _np.cumprod(1 + _rng.normal(0.0004, 0.015, len(_d))) for _ in range(3)]); _C[-1, 2] = _np.nan
_s = _rsi_sheet(_d, ["A", "B", "C"], _C, "2026-10-23")
assert set(_s["rows"]) == {"A", "B"} and all(len(v) == 3 for v in _s["rows"].values()), "a name with no last close is absent, not stale"
assert all(0 <= x <= 100 for v in _s["rows"].values() for x in v if x is not None)
_up = _np.column_stack([_np.linspace(10, 50, len(_d))]); _u = _rsi_sheet(_d, ["U"], _up, "x")["rows"]["U"]; assert _u == [100.0, 100.0, 100.0], _u
_short = _rsi_sheet(_d[-30:], ["S"], _np.linspace(10, 20, 30).reshape(-1, 1) + _np.sin(_np.arange(30)).reshape(-1, 1), "x")["rows"]["S"]
assert _short[2] is None, "30 sessions hold about two months: no monthly RSI yet, and the sheet says null rather than guessing"
print("rsi sheet: matches the shared golden vectors; to-date periods; no last close means no figure; too little history is null")

_Cn = _np.vstack([_C, _np.full((1, 3), _np.nan)]); _dn = _pd.bdate_range("2025-01-01", periods=len(_Cn))
_sn = _rsi_sheet(_dn, ["A", "B", "C"], _Cn, "x"); assert set(_sn["rows"]) == {"A", "B"} and _sn["as_of"] == str(_dn[-2].date()), "a trailing row with no prices is not a session"
print("rsi sheet: an unfinished trailing session is ignored")
