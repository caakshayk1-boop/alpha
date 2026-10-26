"""Back-test of the Tripwire engines AS BUILT (price-based rules only), against the same universe, net of costs, in the three fixed periods.

PREREGISTRATION (fixed before the run)
  What      MOM (momentum) and LVT (steady uptrend) exactly as in apps/tripwire/src/quant.ts, minus what price history cannot reproduce: the
            screen's risk-grade filter on LVT. QLT (quality at a fair price) needs point-in-time company accounts, which are not available, so
            it CANNOT be back-tested here and is judged on the forward ledger alone. MOMR is a CHALLENGER (equal rank blend of 12-1 momentum,
            residual momentum and efficiency ratio, same filters as MOM); it is tested here and then only ever enters the forward ledger.
  Trades    each engine picks its top 5 (at most 2 per sector, stop no wider than its cap) at a rebalance every `horizon` sessions, so
            holdings never overlap. Entry the next open +0.1 percent; stop 2.5 / 2.0 ATR below the signal close, a gap exits at the open, a bar
            spanning the stop counts as stopped; otherwise exit at the close of session `horizon`. Costs 0.25 percent round trip plus 0.1 percent
            slippage on the exit. Same rules as the in-app tracker and the nightly ledger.
  Compared  to the equal-weight average of all eligible names over the same sessions (the engine's EXCESS), and shown against the Nifty.
  Statistic mean net return per trade, mean excess, hit rate, mean R; excess t-statistic by calendar month; per period.
  Decision  none of this changes the engines. An engine whose HOLDOUT excess is negative with t < 0 is labelled 'no historical support'
            in the app. The challenger is never promoted on this evidence, because the holdout has now been read twice.
  Bias      today's constituents only (survivorship), so every number is an upper bound.
"""
from __future__ import annotations
import json, sys, pathlib, datetime as dt
import numpy as np, pandas as pd
import indicators as ind
from indicators import Panel
from study import period_of, SPLITS, MIN_HIST, MIN_VALUE, monthly_t, load_real, _r

SLIP = 0.001; COSTS = 0.0025
ENG = {"MOM": dict(h=20, atr=2.5, cap=12), "MOMR": dict(h=20, atr=2.5, cap=12), "LVT": dict(h=40, atr=2.0, cap=10)}


def pct_rank(x, ok):
    out = np.full(x.shape, np.nan); out[ok] = pd.Series(x[ok]).rank(pct=True).to_numpy() * 100; return out


def atr_pct(p: Panel, i: int, n=14):
    tr = np.maximum(p.H[i - n + 1: i + 1] - p.L[i - n + 1: i + 1], np.maximum(np.abs(p.H[i - n + 1: i + 1] - p.C[i - n: i]), np.abs(p.L[i - n + 1: i + 1] - p.C[i - n: i])))
    return np.nanmean(tr, axis=0) / p.C[i] * 100


def picks(p: Panel, i: int, eng: str, el: np.ndarray, sector: np.ndarray):
    """Indices of the (up to) five names the engine would hold from the close of day i."""
    N = p.C.shape[1]; ok0 = el & ~np.isnan(ind.mom12_1(p, i))
    sma200 = np.nanmean(p.C[i - 199: i + 1], axis=0); above = p.C[i] > sma200
    rs3m = (p.C[i] / p.C[i - 63] - 1) - (p.M[i] / p.M[i - 63] - 1)
    r6 = p.C[i] / p.C[i - 126] - 1
    a = atr_pct(p, i)
    if eng == "MOM" or eng == "MOMR":
        mom = ind.mom12_1(p, i); nh = ind.near_high(p, i)
        if eng == "MOM":
            score = 0.7 * pct_rank(mom, ok0 & ~np.isnan(nh)) + 0.3 * pct_rank(nh, ok0 & ~np.isnan(nh))
        else:
            rm, er = ind.resid_mom(p, i), ind.eff_ratio60(p, i); okk = ok0 & ~np.isnan(rm) & ~np.isnan(er)
            score = (pct_rank(mom, okk) + pct_rank(rm, okk) + pct_rank(er, okk)) / 3
        passes = ok0 & above & (rs3m > 0) & (score >= 80)
    else:
        sd = np.nanstd(p.C[i - 251: i + 1] / p.C[i - 252: i] - 1, axis=0)
        okk = ok0 & ~np.isnan(sd) & ~np.isnan(r6)
        calm = 100 - pct_rank(sd, okk); score = 0.6 * calm + 0.4 * pct_rank(r6, okk)
        passes = okk & (calm >= 75) & above & (r6 > 0)
    passes &= ~np.isnan(score) & ~np.isnan(a) & (a > 0)
    order = [j for j in np.argsort(-np.where(passes, score, -1)) if passes[j]]
    cfg = ENG[eng]; out = []; per = {}
    for j in order:
        if cfg["atr"] * a[j] > cfg["cap"]: continue
        s = sector[j]
        if per.get(s, 0) >= 2: continue
        per[s] = per.get(s, 0) + 1; out.append((j, cfg["atr"] * a[j]))
        if len(out) >= 5: break
    return out


def trade(p: Panel, i: int, j: int, stop_pct: float, h: int):
    """Next-open entry, stop first, gap through the stop exits at the open, time exit at the close of session h. Returns (net return, R) or None if skipped."""
    ref = p.C[i, j]; stop = ref * (1 - stop_pct / 100)
    if i + 1 + h >= len(p.dates) or np.isnan(p.O[i + 1, j]): return None
    fill = p.O[i + 1, j] * (1 + SLIP)
    if p.O[i + 1, j] > ref * 1.02 or p.O[i + 1, j] <= stop: return None
    exit_px = None
    for k in range(i + 1, i + 1 + h):
        if k > i + 1 and p.O[k, j] <= stop: exit_px = p.O[k, j]; break
        if p.L[k, j] <= stop: exit_px = stop; break
    if exit_px is None: exit_px = p.C[i + h, j]
    net = (exit_px / fill - 1) - COSTS - SLIP * exit_px / fill
    risk = (fill - stop) / fill
    return net, (net / risk if risk > 0 else np.nan)


def run(p: Panel, sector: np.ndarray, engines=("MOM", "MOMR", "LVT")) -> dict:
    T = len(p.dates); res = {}
    for eng in engines:
        h = ENG[eng]["h"]; rows = {k: [] for k in SPLITS}; ex = {k: [] for k in SPLITS}; n_skip = 0; n_pick = 0
        for i in range(MIN_HIST, T - h - 2, h):
            per = period_of(p.dates[i])
            if per is None: continue
            tv = np.nanmedian(p.C[i - 19: i + 1] * p.V[i - 19: i + 1], axis=0); el = (tv >= MIN_VALUE) & (p.C[i] >= 50) & ~np.isnan(p.C[i - 252])
            if el.sum() < 80: continue
            uni = p.C[i + h] / p.O[i + 1] - 1; uni_mean = np.nanmean(np.where(el, uni, np.nan)) - COSTS - SLIP
            d = str(p.dates[i])[:10]
            tr = []
            for j, sp in picks(p, i, eng, el, sector):
                n_pick += 1; t = trade(p, i, j, sp, h)
                if t is None or np.isnan(t[0]): n_skip += 1; continue
                tr.append(t); rows[per].append((d, t[0], t[1]))
            if tr: ex[per].append((d, float(np.mean([a for a, _ in tr])) - uni_mean))
        out = {}
        for k in SPLITS:
            r = rows[k]
            if not r: out[k] = {"trades": 0}; continue
            nets = np.array([a for _, a, _ in r]); Rs = np.array([b for _, _, b in r if not np.isnan(b)])
            mx, tx, nm = monthly_t(ex[k])
            out[k] = {"trades": len(r), "mean_net": _r(nets.mean(), 4), "hit_rate": _r((nets > 0).mean(), 3), "mean_R": _r(Rs.mean(), 3) if len(Rs) else None,
                      "excess_vs_universe": _r(mx, 4), "excess_t": _r(tx), "months": nm}
        res[eng] = {"horizon": h, "picked": n_pick, "skipped": n_skip, "periods": out}
    for eng, r in res.items():
        ho = r["periods"]["holdout"]
        r["label"] = "no historical support" if (ho.get("excess_vs_universe") is not None and ho["excess_vs_universe"] < 0 and (ho.get("excess_t") or 0) < 0) else "not rejected"
    return res


def markdown(res: dict, meta: dict) -> str:
    L = ["# Tripwire engines, back-tested as built", "", f"Run {meta['when']}, {meta['symbols']} symbols, {meta['dates'][0]} to {meta['dates'][1]}. Survivorship bias applies. Quality at a fair price cannot be back-tested (no point-in-time accounts); it is judged on the forward ledger.", "",
         "| Engine | period | trades | mean net | hit rate | mean R | excess vs universe (t) |", "|---|---|---|---|---|---|---|"]
    for eng, r in res.items():
        for k, v in r["periods"].items():
            L.append(f"| {eng}{' (challenger)' if eng == 'MOMR' else ''} | {k} | {v.get('trades')} | {v.get('mean_net')} | {v.get('hit_rate')} | {v.get('mean_R')} | {v.get('excess_vs_universe')} ({v.get('excess_t')}) |")
    L += ["", "| Engine | label |", "|---|---|"] + [f"| {e} | {r['label']} |" for e, r in res.items()]
    L += ["", "The challenger is never promoted on this evidence: it enters the forward ledger and is judged there."]
    return "\n".join(L)


if __name__ == "__main__":
    screen = sys.argv[1]; outdir = pathlib.Path(sys.argv[2]); outdir.mkdir(parents=True, exist_ok=True)
    p = load_real(screen)
    rows = {r["sym"]: r.get("sector") or "unknown" for r in json.loads(pathlib.Path(screen).read_text())["rows"]}
    sector = np.array([rows.get(s, "unknown") for s in p.syms])
    res = run(p, sector)
    meta = {"when": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "symbols": len(p.syms), "dates": [str(p.dates[0])[:10], str(p.dates[-1])[:10]]}
    (outdir / "engines_backtest.json").write_text(json.dumps({"meta": meta, "engines": res}, indent=1))
    (outdir / "engines_backtest.md").write_text(markdown(res, meta)); print(markdown(res, meta))
