"""Walk-forward test of the Momentum engine and its pre-declared family of alternatives.

WHY THIS EXISTS. engines_backtest.py judged MOM on three fixed periods and its holdout came back negative (excess -1.1 percent, t -0.95). The holdout has
now been read twice, so it can no longer test a NEW rule: any rule chosen after seeing it is fitted to it. This test therefore judges the PROCEDURE
"choose the best rule from what has already happened, then trade it on what comes next", over every year from 2019, so each year is out of sample for the
rule that traded it. It cannot rescue a rule by fitting.

PREREGISTRATION (fixed before the run; edit only in a new commit that says why)
  Family    eight variants of the Momentum engine, no others, ever tried here:
              lookback  126 sessions (6-1 month) or 252 sessions (12-1 month), skipping the latest 21;
              regime    off, or on (hold nothing, i.e. cash, when the Nifty closes under its own 200-day average);
              threshold the score must be at least 80 or at least 90 (percentile).
            Score is 0.7 x percentile of the lookback return + 0.3 x percentile of closeness to the 52-week high, as built. Everything else is the
            engine as built: top 5, at most 2 per sector, stop 2.5 ATR with the engine's cap, next-open entry, 20-session hold, costs 0.25 percent
            round trip and 0.1 percent slippage each side. AS BUILT is lookback 252, regime off, threshold 80.
  Procedure each calendar year Y from 2019 (so at least four years of history precede the first test year): choose the variant with the highest
            mean EXCESS over the equal-weight universe across the three years before Y, using only rebalances that ended before Y; a variant needs
            at least 20 active rebalances in that window to be chosen, otherwise the as-built rule is used. Trade it through Y. Join the years.
  Statistic mean excess per rebalance against the equal-weight universe, t by calendar month. Also the mean net return per rebalance with cash
            periods counted as zero, because a regime filter earns its keep by NOT trading, which the excess alone cannot see.
  Decision  the PROCEDURE is 'supported' only if its joined out-of-sample excess is above zero with t of at least 2.0 AND its mean net return per
            rebalance is above zero. A FIXED variant is 'supported' only at t of at least 2.7 (a Bonferroni allowance for eight variants). Anything
            else is 'not supported'. Nothing is promoted in the app by this run alone: a supported result moves an engine into the forward ledger
            as a candidate, and the ledger decides.
  Bias      today's constituents only (survivorship), so every number is an upper bound. Quality at a fair price cannot be tested this way: it needs
            point-in-time accounts. It is judged only on the forward ledger."""
from __future__ import annotations
import json, sys, pathlib, datetime as dt
import numpy as np, pandas as pd
import indicators as ind
from indicators import Panel
from study import MIN_HIST, MIN_VALUE, monthly_t, load_real, _r
from engines_backtest import trade, atr_pct, pct_rank, ENG, COSTS, SLIP

H = ENG["MOM"]["h"]
FAMILY = [dict(L=L, regime=rg, q=q) for L in (126, 252) for rg in (False, True) for q in (80, 90)]
BASE = dict(L=252, regime=False, q=80)
FIRST_TEST_YEAR = 2019
LOOKBACK_YEARS = 3
MIN_ACTIVE = 20
T_PROCEDURE, T_FIXED = 2.0, 2.7
vid = lambda v: f"L{v['L']}-{'R' if v['regime'] else 'x'}-q{v['q']}"


def variant_picks(p: Panel, i: int, v: dict, el: np.ndarray, sector: np.ndarray) -> list[tuple[int, float]]:
    """Up to five (index, stop percent) the variant would hold from the close of day i. Empty when the regime filter is on and the Nifty is under its 200-day."""
    if v["regime"] and not (p.M[i] > np.nanmean(p.M[i - 199: i + 1])): return []
    mom = p.C[i - 21] / p.C[i - v["L"]] - 1; nh = ind.near_high(p, i); ok0 = el & ~np.isnan(mom) & ~np.isnan(nh)
    above = p.C[i] > np.nanmean(p.C[i - 199: i + 1], axis=0); rs3m = (p.C[i] / p.C[i - 63] - 1) - (p.M[i] / p.M[i - 63] - 1)
    score = 0.7 * pct_rank(mom, ok0) + 0.3 * pct_rank(nh, ok0); a = atr_pct(p, i)
    passes = ok0 & above & (rs3m > 0) & (score >= v["q"]) & ~np.isnan(score) & ~np.isnan(a) & (a > 0)
    out, per = [], {}
    for j in [j for j in np.argsort(-np.where(passes, score, -1)) if passes[j]]:
        if ENG["MOM"]["atr"] * a[j] > ENG["MOM"]["cap"]: continue
        s = sector[j]
        if per.get(s, 0) >= 2: continue
        per[s] = per.get(s, 0) + 1; out.append((j, ENG["MOM"]["atr"] * a[j]))
        if len(out) >= 5: break
    return out


def series(p: Panel, sector: np.ndarray, family=FAMILY) -> dict[str, list[dict]]:
    """For every variant, one record per rebalance: date, net (mean of its trades, 0 when it held nothing), excess (None when it held nothing), active."""
    T = len(p.dates); res = {vid(v): [] for v in family}
    for i in range(MIN_HIST, T - H - 2, H):
        tv = np.nanmedian(p.C[i - 19: i + 1] * p.V[i - 19: i + 1], axis=0); el = (tv >= MIN_VALUE) & (p.C[i] >= 50) & ~np.isnan(p.C[i - 252])
        if el.sum() < 80: continue
        uni = p.C[i + H] / p.O[i + 1] - 1; uni_mean = np.nanmean(np.where(el, uni, np.nan)) - COSTS - SLIP; d = str(p.dates[i])[:10]
        for v in family:
            tr = [t for j, sp in variant_picks(p, i, v, el, sector) if (t := trade(p, i, j, sp, H)) is not None and not np.isnan(t[0])]
            net = float(np.mean([a for a, _ in tr])) if tr else 0.0
            res[vid(v)].append({"d": d, "year": int(d[:4]), "net": net, "excess": (net - uni_mean) if tr else None, "active": bool(tr)})
    return res


def choose(table: dict[str, list[dict]], year: int) -> str:
    """The variant for `year`, from rebalances that ended before it. Pure: nothing dated from `year` on is read."""
    cut = f"{year - 1}-11-30"; lo = f"{year - LOOKBACK_YEARS}-01-01"; best, best_v = vid(BASE), -np.inf
    for k, recs in table.items():
        w = [r["excess"] for r in recs if lo <= r["d"] <= cut and r["excess"] is not None]
        if len(w) >= MIN_ACTIVE and np.mean(w) > best_v: best, best_v = k, float(np.mean(w))
    return best


def stat(recs: list[dict]) -> dict:
    ex = [(r["d"], r["excess"]) for r in recs if r["excess"] is not None]; m, t, n = monthly_t(ex)
    return {"rebalances": len(recs), "active": len(ex), "mean_excess": _r(m, 4), "t": _r(t), "months": n,
            "mean_net_per_rebalance": _r(float(np.mean([r["net"] for r in recs])), 4) if recs else None}


def walk_forward(table: dict[str, list[dict]]) -> dict:
    years = sorted({r["year"] for recs in table.values() for r in recs}); test_years = [y for y in years if y >= FIRST_TEST_YEAR]
    chosen = {y: choose(table, y) for y in test_years}
    proc = [r for y in test_years for r in table[chosen[y]] if r["year"] == y]
    fixed = {k: stat([r for r in recs if r["year"] in test_years]) for k, recs in table.items()}
    ps = stat(proc); asbuilt = fixed[vid(BASE)]
    ok = lambda s, th: s["mean_excess"] is not None and s["t"] is not None and s["mean_excess"] > 0 and s["t"] >= th
    return {"test_years": test_years, "chosen": {str(y): c for y, c in chosen.items()}, "procedure": {**ps, "supported": bool(ok(ps, T_PROCEDURE) and (ps["mean_net_per_rebalance"] or 0) > 0)},
            "variants": {k: {**s, "supported": bool(ok(s, T_FIXED) and (s["mean_net_per_rebalance"] or 0) > 0)} for k, s in fixed.items()},
            "as_built": {**asbuilt, "id": vid(BASE)}}


def markdown(wf: dict, meta: dict) -> str:
    L = ["# Momentum, walk-forward", "", f"Run {meta['when']}, {meta['symbols']} symbols, {meta['dates'][0]} to {meta['dates'][1]}. Test years {wf['test_years'][0]} to {wf['test_years'][-1]}, each out of sample for the rule that traded it. Survivorship bias applies.", "",
         "| Rule | rebalances | active | mean excess | t | mean net per rebalance (cash = 0) | verdict |", "|---|---|---|---|---|---|---|"]
    p = wf["procedure"]; L.append(f"| **walk-forward procedure** | {p['rebalances']} | {p['active']} | {p['mean_excess']} | {p['t']} | {p['mean_net_per_rebalance']} | {'supported' if p['supported'] else 'not supported'} |")
    for k, s in wf["variants"].items(): L.append(f"| {k}{' (as built)' if k == wf['as_built']['id'] else ''} | {s['rebalances']} | {s['active']} | {s['mean_excess']} | {s['t']} | {s['mean_net_per_rebalance']} | {'supported' if s['supported'] else 'not supported'} |")
    L += ["", "Chosen each year: " + ", ".join(f"{y} {c}" for y, c in wf["chosen"].items()), "", f"The procedure needs t of at least {T_PROCEDURE}; a fixed variant needs {T_FIXED} (eight were tried)."]
    return "\n".join(L)


if __name__ == "__main__":
    screen = sys.argv[1]; outdir = pathlib.Path(sys.argv[2]); outdir.mkdir(parents=True, exist_ok=True)
    p = load_real(screen); rows = {r["sym"]: r.get("sector") or "unknown" for r in json.loads(pathlib.Path(screen).read_text())["rows"]}
    sector = np.array([rows.get(s, "unknown") for s in p.syms]); wf = walk_forward(series(p, sector))
    meta = {"when": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "symbols": len(p.syms), "dates": [str(p.dates[0])[:10], str(p.dates[-1])[:10]]}
    (outdir / "engines_walkforward.json").write_text(json.dumps({"meta": meta, "walk_forward": wf}, indent=1)); (outdir / "engines_walkforward.md").write_text(markdown(wf, meta)); print(markdown(wf, meta))
