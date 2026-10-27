"""The Tripwire factor study: which indicators actually separated winners from losers, on data the study had not looked at.

PREREGISTRATION (fixed before any result was seen; edit this block only in a new commit that says why)
  Universe   names in the published screen that are not micro caps, with a 20-session median traded value of at least Rs 10 crore on the
             day and 260 sessions of history. NOTE: the list is TODAY's constituents, so delisted names are missing. That is survivorship
             bias and it flatters every strategy that buys winners; a result here is an upper bound.
  Sample     every 5th session from the first date with 260 sessions of history. Entry is the NEXT session's open, exit the close 20
             sessions later, so no feature sees the price it is judged against. Costs: 0.45 percent round trip (0.25 costs + 0.2 slippage).
  Periods    train up to 2021-12-31, validation 2022-01-01 to 2023-12-31, holdout from 2024-01-01. The holdout is read once, at the end.
  Statistic  per date, the Spearman rank correlation (IC) between a feature and the forward return; averaged by calendar month (the
             windows overlap, so months are the independent unit); t = mean / (sd / sqrt(months)). Also the top-quintile return minus the
             universe mean, net of costs.
  Signs      every feature is signed in indicators.py so that higher should be better. A negative IC is a failure, not a discovery.
  ADOPT      a feature or modifier is adopted only if ALL hold: train IC > 0 and train t >= 2.5 (about 12 features were tried, so 2.0 would
             let one false positive through); validation IC > 0 and at least half the train IC, and validation top-quintile excess net of
             costs > 0; holdout IC > 0 and holdout top-quintile excess net of costs > 0. Common baselines are reported but cannot be 'new'.
  Controls   `noise` (seeded random) must not be adopted, and the harness must find a planted effect (test_research.py).
  Modifiers  among the top quintile of 12-1 momentum, the half of names that scores higher on a modifier against the half that scores
             lower; adopted on the same rule using the difference in mean forward return.
Everything tried is reported, including what failed."""
from __future__ import annotations
import json, sys, pathlib, datetime as dt
import numpy as np
import pandas as pd
from indicators import FEATURES, COMMON, CONTROL, MODIFIERS, Panel

COST = 0.0045
STEP, HORIZON, MIN_HIST = 5, 20, 260
SPLITS = {"train": (None, "2021-12-31"), "validation": ("2022-01-01", "2023-12-31"), "holdout": ("2024-01-01", None)}
MIN_VALUE = 1e8
ADOPT_T = 2.5


def period_of(d: np.datetime64) -> str | None:
    s = str(d)[:10]
    for name, (a, b) in SPLITS.items():
        if (a is None or s >= a) and (b is None or s <= b): return name
    return None


def rank_ic(x: np.ndarray, y: np.ndarray) -> float:
    ok = ~(np.isnan(x) | np.isnan(y))
    if ok.sum() < 30: return np.nan
    rx = pd.Series(x[ok]).rank().to_numpy(); ry = pd.Series(y[ok]).rank().to_numpy()
    return float(np.corrcoef(rx, ry)[0, 1])


def forward(p: Panel, i: int) -> np.ndarray:
    """Entry at the next open, exit at the close HORIZON sessions after the signal day."""
    if i + HORIZON >= len(p.dates): return np.full(p.C.shape[1], np.nan)
    return p.C[i + HORIZON] / p.O[i + 1] - 1


def eligible(p: Panel, i: int) -> np.ndarray:
    if i < MIN_HIST: return np.zeros(p.C.shape[1], bool)
    tv = np.nanmedian(p.C[i - 19: i + 1] * p.V[i - 19: i + 1], axis=0)
    return (tv >= MIN_VALUE) & (p.C[i] >= 50) & ~np.isnan(p.C[i - 252])


def monthly_t(rows: list[tuple[str, float]]) -> tuple[float, float, int]:
    """(mean, t, months) of a per-date statistic, averaged within calendar months."""
    if not rows: return (np.nan, np.nan, 0)
    s = pd.Series({}, dtype=float)
    df = pd.DataFrame(rows, columns=["d", "v"]).dropna(); 
    if df.empty: return (np.nan, np.nan, 0)
    m = df.groupby(df["d"].str[:7])["v"].mean(); n = len(m)
    if n < 6 or m.std(ddof=1) == 0: return (float(m.mean()), np.nan, n)
    return (float(m.mean()), float(m.mean() / (m.std(ddof=1) / np.sqrt(n))), n)


def run(p: Panel, fwd_override=None, features=FEATURES) -> dict:
    T = len(p.dates); idx = list(range(MIN_HIST, T - HORIZON - 1, STEP))
    ic = {f: {k: [] for k in SPLITS} for f in features}; q5 = {f: {k: [] for k in SPLITS} for f in features}
    mod = {f: {k: [] for k in SPLITS} for f in MODIFIERS}
    prof = {f: {k: {"win": [], "lose": [], "all": []} for k in SPLITS} for f in features}
    for i in idx:
        per = period_of(p.dates[i]); el = eligible(p, i)
        if per is None or el.sum() < 60: continue
        y = fwd_override(p, i) if fwd_override else forward(p, i)
        y = np.where(el, y, np.nan)
        if np.isnan(y).all(): continue
        d = str(p.dates[i])[:10]
        mu = np.nanmean(y)
        win = y >= np.nanpercentile(y, 95); lose = y <= np.nanpercentile(y, 5)
        vals = {}
        for name, fn in features.items():
            x = np.where(el, fn(p, i), np.nan); vals[name] = x
            ic[name][per].append((d, rank_ic(x, y)))
            ok = ~np.isnan(x) & ~np.isnan(y)
            if ok.sum() >= 60:
                top = x >= np.nanpercentile(x[ok], 80)
                q5[name][per].append((d, float(np.nanmean(y[top & ok]) - mu - COST)))
                pr = pd.Series(np.where(ok, x, np.nan)).rank(pct=True).to_numpy()
                prof[name][per]["win"].append(np.nanmean(pr[win & ok]) if (win & ok).any() else np.nan)
                prof[name][per]["lose"].append(np.nanmean(pr[lose & ok]) if (lose & ok).any() else np.nan)
        m = vals["mom12_1"]; okm = ~np.isnan(m) & ~np.isnan(y)
        if okm.sum() >= 100:
            top = okm & (m >= np.nanpercentile(m[okm], 80))
            for mf in MODIFIERS:
                z = vals[mf]; ok2 = top & ~np.isnan(z)
                if ok2.sum() >= 20:
                    hi = ok2 & (z >= np.nanmedian(z[ok2])); lo = ok2 & (z < np.nanmedian(z[ok2]))
                    mod[mf][per].append((d, float(np.nanmean(y[hi]) - np.nanmean(y[lo]))))
    out = {"features": {}, "modifiers": {}, "winner_profile": {}}
    for f in features:
        out["features"][f] = {}
        for k in SPLITS:
            mi, ti, n = monthly_t(ic[f][k]); mq, tq, _ = monthly_t(q5[f][k])
            out["features"][f][k] = {"ic": _r(mi), "t": _r(ti), "months": n, "top_quintile_excess_net": _r(mq, 4)}
        out["winner_profile"][f] = {k: _r(np.nanmean(prof[f][k]["win"]) - np.nanmean(prof[f][k]["lose"]), 3) if prof[f][k]["win"] else None for k in SPLITS}
    for mf in MODIFIERS:
        out["modifiers"][mf] = {}
        for k in SPLITS:
            mm, tt, n = monthly_t(mod[mf][k]); out["modifiers"][mf][k] = {"diff": _r(mm, 4), "t": _r(tt), "months": n}
    out["verdict"] = verdict(out)
    return out


def _r(v, n=3):
    return None if v is None or (isinstance(v, float) and np.isnan(v)) else round(float(v), n)


def verdict(out: dict) -> dict:
    v = {}
    for f, r in out["features"].items():
        tr, va, ho = r["train"], r["validation"], r["holdout"]
        steps = {
            "train IC > 0 and t >= 2.5": bool(tr["ic"] and tr["ic"] > 0 and tr["t"] and tr["t"] >= ADOPT_T),
            "validation IC > 0 and >= half of train": bool(va["ic"] and tr["ic"] and va["ic"] > 0 and va["ic"] >= 0.5 * tr["ic"]),
            "validation top quintile beats the universe net of costs": bool(va["top_quintile_excess_net"] and va["top_quintile_excess_net"] > 0),
            "holdout IC > 0": bool(ho["ic"] and ho["ic"] > 0),
            "holdout top quintile beats the universe net of costs": bool(ho["top_quintile_excess_net"] and ho["top_quintile_excess_net"] > 0)}
        kind = "common baseline" if f in COMMON else "control" if f in CONTROL else "candidate"
        v[f] = {"kind": kind, "steps": steps, "adopt": kind == "candidate" and all(steps.values())}
    for f, r in out["modifiers"].items():
        tr, va, ho = r["train"], r["validation"], r["holdout"]
        steps = {"train diff > 0 and t >= 2.5": bool(tr["diff"] and tr["diff"] > 0 and tr["t"] and tr["t"] >= ADOPT_T),
                 "validation diff > 0": bool(va["diff"] and va["diff"] > 0), "holdout diff > 0": bool(ho["diff"] and ho["diff"] > 0)}
        v["mod:" + f] = {"kind": "modifier", "steps": steps, "adopt": all(steps.values())}
    return v


def load_real(screen_path: str, years: int = 11) -> Panel:
    import yfinance as yf
    rows = json.loads(pathlib.Path(screen_path).read_text())["rows"]
    syms = [r["sym"] for r in rows if r.get("liquid") and r.get("tier") != "micro"]
    print(f"{len(syms)} symbols to fetch", flush=True)
    frames = {}
    tickers = [s + ".NS" for s in syms] + ["^NSEI"]
    for k in range(0, len(tickers), 40):
        chunk = tickers[k:k + 40]
        try:
            df = yf.download(chunk, period=f"{years}y", interval="1d", auto_adjust=True, group_by="column", progress=False, threads=True)
        except Exception as e:
            print(f"chunk {k // 40} failed: {e}", file=sys.stderr); continue
        for t in chunk:
            try: frames[t] = pd.DataFrame({f: df[(f, t)] for f in ("Open", "High", "Low", "Close", "Volume")}).dropna(subset=["Close"])
            except Exception: pass
    if "^NSEI" not in frames: raise SystemExit("FAIL: the Nifty could not be fetched")
    got = [t for t in frames if t != "^NSEI" and len(frames[t]) >= 400]
    print(f"{len(got)} of {len(syms)} symbols fetched with enough history", flush=True)
    if len(got) < len(syms) * 0.6: raise SystemExit("FAIL: fewer than 60 percent of the symbols could be fetched")
    idx = frames["^NSEI"].index
    def col(f): return np.column_stack([frames[t][f].reindex(idx).to_numpy(float) for t in got])
    O, H, L, C, V = col("Open"), col("High"), col("Low"), col("Close"), col("Volume")
    return Panel(idx.to_numpy("datetime64[D]"), [t[:-3] for t in got], O, H, L, C, V, frames["^NSEI"]["Close"].to_numpy(float))


def to_markdown(res: dict, meta: dict) -> str:
    L = [f"# Tripwire factor study", "", f"Run {meta['when']} on {meta['symbols']} symbols, {meta['dates'][0]} to {meta['dates'][1]}. Survivorship bias applies (today's constituents only): results are an upper bound.", "",
         "| Feature | kind | train IC (t) | validation IC | holdout IC | holdout Q5 net | adopt |", "|---|---|---|---|---|---|---|"]
    for f, r in res["features"].items():
        v = res["verdict"][f]; tr, va, ho = r["train"], r["validation"], r["holdout"]
        L.append(f"| {f} | {v['kind']} | {tr['ic']} ({tr['t']}) | {va['ic']} | {ho['ic']} | {ho['top_quintile_excess_net']} | {'**YES**' if v['adopt'] else 'no'} |")
    L += ["", "## Modifiers on top-quintile momentum (higher half minus lower half, mean 20-session return)", "", "| Modifier | train diff (t) | validation | holdout | adopt |", "|---|---|---|---|---|"]
    for f, r in res["modifiers"].items():
        v = res["verdict"]["mod:" + f]; L.append(f"| {f} | {r['train']['diff']} ({r['train']['t']}) | {r['validation']['diff']} | {r['holdout']['diff']} | {'**YES**' if v['adopt'] else 'no'} |")
    L += ["", "## What the winners looked like (mean percentile of winners minus losers, top 5 percent against bottom 5 percent of 20-session returns)", "", "| Feature | train | validation | holdout |", "|---|---|---|---|"]
    for f, r in res["winner_profile"].items(): L.append(f"| {f} | {r['train']} | {r['validation']} | {r['holdout']} |")
    L += ["", "Adoption rule and every threshold are in the PREREGISTRATION block of study.py. A feature that fails stays failed."]
    return "\n".join(L)


if __name__ == "__main__":
    screen = sys.argv[1]; outdir = pathlib.Path(sys.argv[2]); outdir.mkdir(parents=True, exist_ok=True)
    p = load_real(screen)
    res = run(p)
    meta = {"when": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "symbols": len(p.syms), "dates": [str(p.dates[0])[:10], str(p.dates[-1])[:10]]}
    import provenance; meta = provenance.stamp(meta, p, outdir / "factor_study.json", "factor_study", {'horizon': HORIZON, 'step': STEP, 'splits': SPLITS}, [__file__, pathlib.Path(__file__).with_name('indicators.py')])
    (outdir / "factor_study.json").write_text(json.dumps({"meta": meta, **res}, indent=1))
    (outdir / "factor_study.md").write_text(to_markdown(res, meta))
    print(to_markdown(res, meta))
