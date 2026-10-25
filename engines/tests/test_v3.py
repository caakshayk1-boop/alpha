"""Phase 3 fixtures and integrity tests for engines v3 (CLAUDE_TASK §Phase 3). Offline, synthetic bars, fixed seeds.
python tests/test_v3.py   ·   Must pass before any evaluation is run (engines_v3.yml runs it first)."""
from __future__ import annotations

import copy
import hashlib
import json
import pathlib
import shutil
import sys
import tempfile

import numpy as np
import pandas as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from v3 import config, costs as C, engines as EN, execsim as X, ledger as L, portfolio as P, provenance as PV, publish as PB, regime as R, setups as S, stats as ST  # noqa: E402

ok = fail = 0


def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  PASS  {name}")
    else:
        fail += 1
        print(f"  FAIL  {name}  {detail}")


CFG = config.all_configs()
COST = C.CostModel.from_config(CFG["costs"])
RT = COST.statutory_round_trip_pct() / 100
rng = np.random.default_rng(11)
IDX = pd.bdate_range("2021-01-04", periods=700)


def walk(drift, vol=0.018, n=len(IDX), seed=None):
    g = np.random.default_rng(seed) if seed is not None else rng
    c = 300 * np.exp(np.cumsum(g.normal(drift, vol, n)))
    o = c * (1 + g.normal(0, 0.004, n))
    h = np.maximum(o, c) * (1 + np.abs(g.normal(0, 0.01, n)))
    lo = np.minimum(o, c) * (1 - np.abs(g.normal(0, 0.01, n)))
    v = g.integers(600_000, 4_000_000, n).astype(float)
    v[g.random(n) < 0.08] *= 3                                # occasional volume spikes so E2 can fire
    return pd.DataFrame({"Open": o, "High": h, "Low": lo, "Close": c, "Volume": v}, index=IDX[:n])


BARS = {f"S{i:02d}": walk(0.0009 if i % 3 else -0.0002) for i in range(24)}
SECTOR = {s: "ABC"[i % 3] for i, s in enumerate(BARS)}
NIFTY = pd.Series(15000 * np.exp(np.cumsum(rng.normal(0.0005, 0.009, len(IDX)))), index=IDX)
VIX = pd.Series(rng.uniform(11, 18, len(IDX)), index=IDX)


def adj(bars):
    return pd.DataFrame({s: d["Close"] for s, d in bars.items()})


def frames(bars, nifty, engine):
    ctx = S.context(adj(bars), SECTOR)
    mret = nifty.pct_change(fill_method=None)
    return {s: EN.setup_frame(engine, s, d, ctx, CFG["engines"][engine], mret, RT) for s, d in bars.items()}


print("no lookahead: truncation invariance and future poison, every engine")
CUTS = (IDX[450], IDX[620])
for e in EN.ENGINES:
    full = frames(BARS, NIFTY, e)
    fired = sum(int(f["setup"].sum()) for f in full.values())
    check(f"{e} · the fixture fires setups to test against", fired > 0, fired)
    for t in CUTS:
        cut = {s: d.loc[:t] for s, d in BARS.items()}
        tr = frames(cut, NIFTY.loc[:t], e)
        same = all(tr[s].loc[:t, ["setup", "stop"]].fillna(-1).equals(full[s].loc[:t, ["setup", "stop"]].fillna(-1)) for s in BARS)
        check(f"{e} · truncation at {t.date()}: setup and stop identical", same)
        bad = {}
        for s, d in BARS.items():
            d = d.copy()
            m = d.index > t
            d.loc[m, ["Open", "High", "Low", "Close"]] *= 4.0
            d.loc[m, "Volume"] = 1.0
            bad[s] = d
        pn = NIFTY.copy()
        pn[pn.index > t] *= 0.1
        po = frames(bad, pn, e)
        same = all(po[s].loc[:t, ["setup", "stop"]].fillna(-1).equals(full[s].loc[:t, ["setup", "stop"]].fillna(-1)) for s in BARS)
        check(f"{e} · future poison after {t.date()}: nothing at or before it changes", same)

fr1 = frames(BARS, NIFTY, "E1")
fr7 = frames(BARS, NIFTY, "E7")
check("E7 fires exactly E1's setups", all(fr1[s_]["setup"].equals(fr7[s_]["setup"]) for s_ in BARS))
s0 = next(s_ for s_ in BARS if fr7[s_]["setup"].any())
t0 = int(np.flatnonzero(fr7[s0]["setup"].to_numpy())[0])
p7 = EN._plan("E7", "baseline", s0, BARS[s0], fr7[s0], t0, CFG["engines"]["E7"], 500.0, 10)
p1 = EN._plan("E1", "baseline", s0, BARS[s0], fr1[s0], t0, CFG["engines"]["E1"], 500.0, 10)
check("E7's plan has no trailing exit and E1's has one; same stop and time limit", p7.exit_on_close is None and p1.exit_on_close is not None and p7.stop == p1.stop and p7.time_stop == p1.time_stop == 60)
check("E7 is forward-only by its own config", CFG["engines"]["E7"]["evidence_basis"] == "forward_only")

print("regime: hysteresis, unknown, transitions")
raw = pd.Series(["range"] * 5 + ["trend_up"] + ["range"] * 3 + ["trend_up"] * 3 + ["unknown"] + ["range"], index=pd.bdate_range("2026-01-01", periods=14))
hy = R.with_hysteresis(raw, 3)
check("a one-session flip does not change the published state", hy.iloc[5] == "range")
check("three sessions in a new state change it on the third", hy.iloc[11] == "trend_up" and hy.iloc[10] == "range", list(hy))
check("a missing input is 'unknown' at once, never smoothed", hy.iloc[12] == "unknown")
rg = R.regime(NIFTY, VIX)
check("the first 200+ sessions are 'unknown' (no 200-day average yet), never bearish", (rg.iloc[:200] == "unknown").all())
check("regime uses completed sessions only (truncation invariant)", R.regime(NIFTY.loc[:IDX[500]], VIX.loc[:IDX[500]]).equals(rg.loc[:IDX[500]]))

print("execution: gap stop, same-bar ambiguity, partials against the original R, trailing next session, cancels")
FLAT = [(100.0, 100.5, 99.5, 100.0)] * 12


def b(rows, n=40):
    r = FLAT + rows
    r = r + [(r[-1][3],) * 4] * (n - len(r))
    return pd.DataFrame(r, columns=["Open", "High", "Low", "Close"], index=pd.bdate_range("2026-01-01", periods=len(r))).assign(Volume=1e6)


Z = C.CostModel(**{**COST.__dict__, "half_spread": {k: 0.0 for k in COST.half_spread}, "slippage": 0.0})
f = X.simulate(b([(100, 101, 99, 100), (92, 93, 91, 92)]), X.Plan("T", "S", 11, 95.0, 110, 20), Z)
check("a gap through the stop fills at the open (92), not the stop", f.reason == "stop_gap" and abs(f.exits[-1][1] - 92) < 1e-9, f.exits)
f = X.simulate(b([(100, 120, 94, 100)]), X.Plan("T", "S", 11, 95.0, 110, 20, targets=[(115, 1.0)]), Z)
check("stop and target in one bar: stop first, flagged", f.reason == "stop" and f.ambiguous_bar)
f = X.simulate(b([(100, 108, 99, 107), (107, 113, 106, 112), (112, 112, 94, 95)]), X.Plan("T", "S", 11, 95.0, 110, 20, targets=[(107.5, 0.3), (112.5, 0.3)]), Z)
want = (0.3 * 7.5 + 0.3 * 12.5 + 0.4 * -5) / 5                       # entry 100, risk 5, two partials then the stop
check("partials aggregate against the original risk", abs(f.r_gross - want) < 1e-9, (f.r_gross, want))
trail_rows = [(100, 106, 99, 105), (105, 110, 104, 109), (108, 108, 103, 104)]
pl = X.Plan("T", "S", 11, 95.0, 110, 20)
pl.trail = lambda i: 104.0 if i == 12 else None                     # set on the close of bar 12, live from bar 13
f = X.simulate(b(trail_rows), pl, Z)
# bar 12's own low (99) is under the new stop: it must not count; bar 13's low (104) is the first that can
check("a trail set on a completed bar acts from the next session, not the bar that set it", f.reason == "stop" and f.exit_i == 13 and abs(f.exits[-1][1] - 104) < 1e-9, (f.exit_i, f.exits))
check("open at or below the stop cancels the entry", X.simulate(b([(94, 96, 93, 95)]), X.Plan("T", "S", 11, 95.0, 110, 20), Z).status == "cancelled_gap")
check("open above the chase limit cancels the entry", X.simulate(b([(111, 112, 110, 111)]), X.Plan("T", "S", 11, 95.0, 110, 20), Z).status == "cancelled_chase")
check("no next session: nothing is filled or booked", X.simulate(b([], n=12), X.Plan("T", "S", 11, 95.0, 110, 20), Z).status == "no_next_session")

f = X.simulate(b([(95.5, 100, 95.2, 99)]), X.Plan("T", "S", 11, 95.0, 110, 20, stop_pct=(1.0, 10.0)), Z)
check("a fill too close to the stop (0.5%) is cancelled: the 1-10% rule is judged at the price paid", f.status == "cancelled_risk", f.status)
f = X.simulate(b([(102, 104, 101, 103), (103, 110, 102, 109)]), X.Plan("T", "S", 11, 95.0, 110, 20, partials_r=[(1.0, 1.0)]), Z)
check("partial targets are priced from the executed entry (102 + 1R = 109), not the signal close", f.reason == "target" and abs(f.exits[0][1] - 109.0) < 1e-9, f.exits)
check("no-cost R equals after-impact R when impact is zero", abs(f.r_ideal - f.r_gross) < 1e-12)

print("cost sanity")
v = 1e6
rt = (COST.side(v, True) + COST.side(v, False)) / v * 100
check("statutory round trip = 0.22248% (STT 0.2 + stamp 0.015 + NSE 0.00614 + SEBI 0.0002 + GST)", abs(rt - 0.222477) < 1e-5, rt)
f = X.simulate(b([]), X.Plan("T", "S", 11, 95.0, 110, 5, qty=100), Z)
check("a flat round trip loses exactly the modelled rupees", abs(f.r_gross) < 1e-12 and abs((f.r_net - f.r_gross) * 5 * 100 + f.cost_rs) < 1e-9 and abs(f.cost_rs - (COST.side(10000, True) + COST.side(10000, False))) < 1e-9, (f.r_gross, f.r_net, f.cost_rs))
SC = C.CostModel.from_config(CFG["costs"], stress=True)
check("the stress case costs more than the base case", SC.side(v, True) + SC.side(v, False) > COST.side(v, True) + COST.side(v, False))

print("data: stale symbols and corporate-action jumps")
jump = BARS["S01"].copy()
jump.iloc[400, :4] = jump.iloc[400, :4] * 0.5
check("an unexplained 50% overnight move marks the bar unclean", not EN.clean_mask(jump).iloc[400])
# staleness is judged per date (DECISIONS #8a): a history that ENDS early keeps its past; a bar after a suspension is unclean
gap = BARS["S02"].drop(BARS["S02"].index[500:512])                   # a 12-session hole (more than 8 calendar days)
check("the first bar back from a suspension is unclean", not EN.clean_mask(gap).loc[BARS["S02"].index[512]])
short = {**BARS, "ENDS": BARS["S04"].iloc[:-10]}
ctx_s = S.context(adj(short), {**SECTOR, "ENDS": "B"})
c_short = EN.candidates("E2", "baseline", short, ctx_s, CFG["engines"]["E2"], pd.Series("trend_up", index=IDX), {**SECTOR, "ENDS": "B"}, NIFTY.pct_change(), COST, IDX[0], IDX[-1] + pd.Timedelta(days=1))
c_full = EN.candidates("E2", "baseline", BARS, S.context(adj(BARS), SECTOR), CFG["engines"]["E2"], pd.Series("trend_up", index=IDX), SECTOR, NIFTY.pct_change(), COST, IDX[0], IDX[-1] + pd.Timedelta(days=1))
past = lambda cs, sym: sorted((c.date, round(c.stop, 6)) for c in cs if c.sym == sym and c.date <= BARS["S04"].index[-11])   # noqa: E731
check("a history that ends early keeps its past candidates (no lookahead selection)", past(c_short, "ENDS") == past(c_full, "S04"), (len(past(c_short, "ENDS")), len(past(c_full, "S04"))))
check("a symbol issues nothing after its last bar", all(c.date <= short["ENDS"].index[-1] for c in c_short if c.sym == "ENDS"))
print("portfolio: one position per symbol, limits")
def mk(e, sym, score):
    df = BARS[sym]
    return P.Cand(e, sym, IDX[300], 300, score, float(df["Close"].iloc[300]), float(df["Close"].iloc[300]) * 0.95, 5.0, 500.0, "A", "trend_up", "active",
                  lambda q, sym=sym: X.Plan(e, sym, 300, float(BARS[sym]["Close"].iloc[300]) * 0.95, 1e9, 10, qty=q))
pos, sk = P.run_book([mk("E1", "S01", 0.9), mk("E2", "S01", 0.8)], BARS, COST)
check("two engines on one symbol: one position, the other a supporting tag", len(pos) == 1 and pos[0].tags == ["E2"], [(p.cand.engine, p.tags) for p in pos])
pos, sk = P.run_book([mk("E1", f"S{i:02d}", 0.9 - i / 100) for i in range(10)], BARS, COST)
check("at most six positions, total open risk <= 1.5%", len(pos) == 6 and sk["limits"] == 4, (len(pos), sk))
check("sizing: shares = floor(0.25% of equity / stop distance), within the caps", all(p.qty <= 2500 // (p.cand.ref - p.cand.stop) for p in pos))

pos, _ = P.run_book([mk("E1", f"S{i:02d}", 0.9 - i / 100) for i in range(10)], BARS, COST)
spent = sum(p.qty * p.cand.ref for p in pos)
check("no leverage: the book never commits more than its equity", spent <= 1_000_000 + 1e-6, spent)
for p in pos[:3]:
    mtm = P.position_pnl(BARS[p.cand.sym], p, COST).sum()
    if p.fill.status == "filled":
        net = (p.fill.r_net) * (p.fill.entry - p.cand.stop) * p.qty
        check(f"marked to market, {p.cand.sym}'s daily P&L sums to its realised net", abs(mtm - net) < 1e-6 * max(1, abs(net)), (mtm, net))
def mkc(e, sym, score, chase):
    df = BARS[sym]
    return P.Cand(e, sym, IDX[300], 300, score, float(df["Close"].iloc[300]), float(df["Close"].iloc[300]) * 0.95, 5.0, 500.0, "A", "trend_up", "active",
                  lambda q, sym=sym, ch=chase: X.Plan(e, sym, 300, float(BARS[sym]["Close"].iloc[300]) * 0.95, ch, 10, qty=q))
lim = {**P.LIMITS, "max_positions": 1, "max_open_risk_pct": 0.25}
pos, sk = P.run_book([mkc("E1", "S01", 0.9, 0.0), mkc("E1", "S02", 0.8, 1e9)], BARS, COST, limits=lim)
check("a cancelled order's slot is not refilled the same day with knowledge of the open", len(pos) == 0 and sk["cancelled"] == 1, (len(pos), sk))

print("ledger: idempotent, append-only, hash-chained")
tmp = pathlib.Path(tempfile.mkdtemp())
lp = tmp / "ledger.jsonl"
check("first append writes", L.append(lp, {"id": "E1:S01:2026-10-22", "x": 1}))
check("a duplicated job writes nothing twice", not L.append(lp, {"id": "E1:S01:2026-10-22", "x": 1}) and len(L.read(lp)) == 1)
L.append(lp, {"id": "E2:S02:2026-10-22", "x": 2})
check("the chain verifies", L.verify(lp)[0])
rows = lp.read_text().splitlines()
rows[0] = rows[0].replace('"x": 1', '"x": 9')
lp.write_text("\n".join(rows) + "\n")
check("an edited line breaks the chain", not L.verify(lp)[0])

print("publisher: fails closed")
root = tmp / "repo"
shutil.copytree(config.CONF, root / "configs" / "engines")
shutil.copy(config.ROOT / "docs" / "engines" / "PREREGISTRATION.md", (root / "docs" / "engines").mkdir(parents=True) or root / "docs" / "engines" / "PREREGISTRATION.md")
config.verify(root / "configs" / "engines" / "FROZEN.sha256", root)
check("an untouched copy of the frozen rules verifies", True)
(root / "configs" / "engines" / "E1.yaml").write_text((root / "configs" / "engines" / "E1.yaml").read_text().replace("time_stop_sessions: 60", "time_stop_sessions: 61"))
try:
    config.verify(root / "configs" / "engines" / "FROZEN.sha256", root)
    check("a changed rule without a new version is refused", False)
except config.FrozenMismatch:
    check("a changed rule without a new version is refused", True)
check("a state bound to another evidence hash is RESEARCH", PB.bound_state("VALIDATED", "old", "new") == "RESEARCH")
check("BLOCKED_DATA stays blocked whatever the hash", PB.bound_state("BLOCKED_DATA", None, "x") == "BLOCKED_DATA")
feed = PB.build_feed({"engines": {"E1": {"state": "VALIDATED", "evidence": "stale", "version": "v1.0.0"}}}, [], [{"engine": "E1", "id": "a", "provenance": PV.provenance("2026-10-21", "2026-10-22T12:00:00Z", "d" * 16, "AAA")}], [], "2026-10-21")
check("a stale VALIDATED claim publishes nothing as validated, and alerts are off", feed["engines"]["E1"]["state"] == "RESEARCH" and not feed["validated"] and feed["alerts_enabled"] is False)
feed_r = PB.build_feed({"engines": {"E3": {"state": "RESEARCH", "evidence": feed["evidence"], "version": "v1.0.0"}}}, [], [], [], "2026-10-21")
check("an engine retired in states.yaml publishes as RETIRED with its reason", feed_r["engines"]["E3"]["state"] == "RETIRED" and "retired" in (feed_r["engines"]["E3"]["why"] or ""), feed_r["engines"]["E3"])
check("the publisher is a dry run unless told otherwise", PB.publish(feed, tmp / "x.json").startswith("DRY RUN") and not (tmp / "x.json").exists())

print("controls: a planted edge is found at its size; noise is not significant")
g = np.random.default_rng(5)
planted = g.normal(0.0008, 0.01, 1500)
lo, hi = ST.stationary_bootstrap_ci(planted, reps=2000)
check("positive control: planted mean 0.08%/day, CI excludes 0 and contains it", lo > 0 and lo <= 0.0008 <= hi, (lo, hi))
noise_hits = 0
for sd in range(10):
    x = np.random.default_rng(100 + sd).normal(0, 0.01, 1500)
    lo, hi = ST.stationary_bootstrap_ci(x, reps=1000, seed=sd)
    d = ST.dsr(x, 10, [0.0, 0.01, -0.01, 0.02, -0.02])
    noise_hits += int(lo > 0 and (d["dsr"] or 0) >= 0.95)
check("negative control: 10 noise books, none passes both the CI and DSR >= 0.95", noise_hits == 0, noise_hits)
perf = pd.DataFrame({f"c{k}": np.random.default_rng(200 + k).normal(0, 0.01, 800) for k in range(6)})
pb = ST.pbo_cscv(perf, blocks=8)
check("negative control: PBO on pure-noise configurations is near one half", pb["pbo"] is not None and 0.2 <= pb["pbo"] <= 0.8, pb)
perf["edge"] = np.random.default_rng(9).normal(0.002, 0.01, 800)
check("positive control: with one real edge among noise, PBO is low", ST.pbo_cscv(perf, blocks=8)["pbo"] < 0.2)

print("determinism")


def digest():
    ctx = S.context(adj(BARS), SECTOR)
    cs = EN.candidates("E2", "baseline", BARS, ctx, CFG["engines"]["E2"], pd.Series("trend_up", index=IDX), SECTOR, NIFTY.pct_change(), RT, IDX[0], IDX[-1] + pd.Timedelta(days=1))
    pos, _ = P.run_book(cs, BARS, COST)
    rows = [(p.cand.engine, p.cand.sym, str(p.cand.date.date()), p.qty, p.fill.status, p.fill.r_net) for p in pos]
    return hashlib.sha256(json.dumps(rows, default=str).encode()).hexdigest(), len(rows)


a, b2 = digest(), digest()
check("two runs are byte-identical", a == b2, (a[0][:12], b2[0][:12]))

shutil.rmtree(tmp, ignore_errors=True)
print(f"{ok} passed · {fail} failed")
sys.exit(1 if fail else 0)
