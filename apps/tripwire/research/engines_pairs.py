"""Pairs trading, tested the way the other engines are: pre-registered, out of sample, with its null result published.

WHY THIS EXISTS. A single hand-picked pair (HDFC Bank / ICICI Bank) was tested on one year and failed: 254 sessions, residual ADF t of -0.64, half-life near 200
sessions, 12 trades with 25 percent converging. One pair says nothing about the idea. The idea is a SCREEN: find pairs whose spread has behaved like a
stretched rope, trade only those, and re-screen. This file tests that screen honestly, and it can say 'not supported'.

TWO CORRECTIONS TO THE ONE-PAIR TEST. (1) The bar for cointegration is NOT the plain ADF -2.88. The residual of a fitted regression is built to look
stationary, so Engle-Granger needs the stricter MacKinnon value, -3.34 at 5 percent (two series, constant). (2) Screening every pair in a universe of
hundreds tests tens of thousands of pairs; at 5 percent a pure-noise universe hands over thousands of false pairs. A significant p-value alone is therefore
NOT the result. The result is what the selected pairs earn in the quarter AFTER they were selected.

PREREGISTRATION (fixed before the run; edit only in a new commit that says why)
  Universe   the liquid non-micro names of the published screen (survivorship: today's constituents, so every number is an upper bound).
  Candidates SAME SECTOR ONLY (an economic reason for a shared driver; this also cuts the number of tests by about thirty), with a correlation of daily
             log returns of at least 0.5 over the formation window.
  Formation  the 252 sessions before each quarter. Regress log price of A on log price of B (with a constant); the hedge ratio beta and the spread's mean and
             standard deviation are FROZEN at this point and never updated inside the quarter.
  Screen     residual ADF t (one lag, constant) at or below -3.34, AND half-life of the residual between 3 and 30 sessions. Rank by ADF t, keep the best 10 pairs,
             at most 2 per name.
  Trading    the next 63 sessions, then re-screen. z = (spread - frozen mean) / frozen sd. Signal at a close, fill at the NEXT close. Enter at |z| of at least 2
             (z above 0 shorts A and buys beta of B; below 0 the reverse). Exit when |z| is under 0.5, stop at |z| of 3, time stop after 20 sessions, and every
             open trade closes at the quarter's last close. Exits are signalled one close earlier and filled at the next, like entries.
  Costs      per trade, on gross notional (1 + |beta|) per unit of A: 0.25 percent round trip plus 0.1 percent slippage on each of the four fills.
  Statistic  net return per trade, t by calendar month of exit (the same monthly_t as every other test here).
  Decision   'supported' only if there are at least 30 trades, the mean net return is above zero and t is at least 2.0. Anything else is 'not supported'.
             The same rules are run on an UNFILTERED control (the same-sector, correlation-passing pairs ranked by correlation alone, no ADF and no half-life)
             so the report shows whether the cointegration screen adds anything over plain correlation.
  Also       the share of selected pairs that were still passing the ADF test after the quarter (persistence), and how trades ended (converged, stopped, timed
             out, forced). Nothing here is a signal: it is evidence only.
  NOT A BOOK. A pair needs a SHORT leg. Indian cash equities cannot be held short overnight; that needs single-stock futures (a lot size and an F&O list this
             screen does not hold). Tripwire is long-only paper, so a supported result would still not become a pick; it would only justify building a
             futures-based paper ledger. Say that wherever this result is shown."""
from __future__ import annotations
import json, sys, pathlib, datetime as dt
import numpy as np
from indicators import Panel
from study import monthly_t, load_real, _r

FORM, TRADE = 252, 63
ADF_5PCT = -3.34
HL_MIN, HL_MAX = 3.0, 30.0
CORR_MIN, KEEP, PER_NAME = 0.5, 10, 2
ENTRY, EXIT, STOP, TIMEOUT = 2.0, 0.5, 3.0, 20
COST = 0.0025 + 4 * 0.001
MIN_TRADES, T_BAR = 30, 2.0


def adf_t(e: np.ndarray) -> float:
    """Dickey-Fuller t on a residual series: de_t = a + g e_(t-1) + p de_(t-1) + u. NaN when it cannot be computed."""
    e = np.asarray(e, float)
    if len(e) < 40 or np.isnan(e).any(): return np.nan
    de = np.diff(e); y = de[1:]; X = np.column_stack([np.ones(len(y)), e[1:-1], de[:-1]])
    try: b, res, rank, _ = np.linalg.lstsq(X, y, rcond=None)
    except np.linalg.LinAlgError: return np.nan
    if rank < 3: return np.nan
    u = y - X @ b; dof = len(y) - 3
    if dof <= 0 or not u.any(): return np.nan
    cov = (u @ u / dof) * np.linalg.inv(X.T @ X); se = np.sqrt(cov[1, 1])
    return float(b[1] / se) if se > 0 else np.nan


def half_life(e: np.ndarray) -> float:
    """Sessions for a deviation to halve, from an AR(1) on the residual. Infinity when it does not revert."""
    e = np.asarray(e, float); x, y = e[:-1] - e[:-1].mean(), e[1:] - e[1:].mean(); d = float(x @ x)
    if d <= 0: return np.inf
    rho = float(x @ y) / d
    return float(-np.log(2) / np.log(rho)) if 0 < rho < 1 else np.inf


def fit(la: np.ndarray, lb: np.ndarray) -> tuple[float, float, float, np.ndarray]:
    """Hedge ratio, spread mean, spread sd, and the spread la - beta lb, all from the formation window."""
    X = np.column_stack([np.ones(len(lb)), lb]); b = np.linalg.lstsq(X, la, rcond=None)[0]
    beta = float(b[1]); s = la - beta * lb
    return beta, float(s.mean()), float(s.std(ddof=1)), s


def screen(C: np.ndarray, i: int, sector: np.ndarray, filtered: bool) -> list[dict]:
    """The pairs chosen at close i, reading only rows before i. filtered=False is the correlation-only control."""
    W = C[i - FORM: i]; ok = ~np.isnan(W).any(axis=0) & (W > 0).all(axis=0); L = np.log(np.where(ok, W, 1.0))
    R = np.diff(L, axis=0); out = []
    for s in sorted(set(sector[ok]) - {"unknown"}):
        idx = np.where(ok & (sector == s))[0]
        if len(idx) < 2: continue
        corr = np.corrcoef(R[:, idx].T)
        for a in range(len(idx)):
            for b in range(a + 1, len(idx)):
                if not corr[a, b] >= CORR_MIN: continue
                ja, jb = idx[a], idx[b]; beta, mu, sd, sp = fit(L[:, ja], L[:, jb])
                if not (sd > 0 and beta > 0): continue
                t, hl = adf_t(sp), half_life(sp)
                if filtered and not (t <= ADF_5PCT and HL_MIN <= hl <= HL_MAX): continue
                out.append(dict(a=int(ja), b=int(jb), beta=beta, mu=mu, sd=sd, t=float(t) if not np.isnan(t) else 0.0, hl=hl, corr=float(corr[a, b])))
    out.sort(key=lambda r: (r["t"] if filtered else -r["corr"]))
    keep, used = [], {}
    for r in out:
        if used.get(r["a"], 0) >= PER_NAME or used.get(r["b"], 0) >= PER_NAME: continue
        used[r["a"]] = used.get(r["a"], 0) + 1; used[r["b"]] = used.get(r["b"], 0) + 1; keep.append(r)
        if len(keep) >= KEEP: break
    return keep


def trade_pair(C: np.ndarray, i: int, pr: dict) -> list[dict]:
    """Every trade of one pair through the quarter [i, i+TRADE), with the formation figures frozen."""
    end = min(i + TRADE, len(C)) - 1
    la, lb = np.log(C[i - 1: end + 1, pr["a"]]), np.log(C[i - 1: end + 1, pr["b"]])
    if np.isnan(la).any() or np.isnan(lb).any(): return []
    sp = la - pr["beta"] * lb; z = (sp - pr["mu"]) / pr["sd"]               # index k is session i-1+k; k=0 is the formation close
    out, k = [], 1; gross = 1 + abs(pr["beta"])
    while k < len(z) - 1:
        if abs(z[k]) >= ENTRY:
            side = -1.0 if z[k] > 0 else 1.0                               # z above zero: the spread is rich, sell it
            e = k + 1; j, why = e, None
            while True:
                if j >= len(z) - 1: j, why = len(z) - 1, "forced"; break
                if abs(z[j]) < EXIT: j, why = j + 1, "converged"; break
                if abs(z[j]) >= STOP and np.sign(z[j]) == np.sign(z[k]): j, why = j + 1, "stopped"; break
                if j - e >= TIMEOUT: j, why = j + 1, "timeout"; break
                j += 1
            j = min(j, len(z) - 1)
            net = side * (sp[j] - sp[e]) / gross - COST
            out.append(dict(net=float(net), why=why, exit=i - 1 + j, sessions=j - e))
            k = j + 1
        else: k += 1
    return out


def run(p: Panel, sector: np.ndarray, filtered: bool = True) -> dict:
    T = len(p.dates); trades, quarters, kept, persisted = [], 0, 0, 0
    for i in range(FORM, T - 2, TRADE):
        pairs = screen(p.C, i, sector, filtered); quarters += 1; kept += len(pairs)
        for pr in pairs:
            ts = trade_pair(p.C, i, pr)
            for t in ts: t["d"] = str(p.dates[min(t["exit"], T - 1)])[:10]
            trades.extend(ts)
            if filtered:
                e = np.log(p.C[i - FORM: min(i + TRADE, T), pr["a"]]) - pr["beta"] * np.log(p.C[i - FORM: min(i + TRADE, T), pr["b"]])
                persisted += int(adf_t(e) <= ADF_5PCT)
    nets = [t["net"] for t in trades]; mean, t, months = monthly_t([(t["d"], t["net"]) for t in trades])
    ends = {w: sum(1 for x in trades if x["why"] == w) for w in ("converged", "stopped", "timeout", "forced")}
    ok = len(trades) >= MIN_TRADES and not np.isnan(t) and mean > 0 and t >= T_BAR
    return dict(quarters=quarters, pairs=kept, trades=len(trades), mean_net=_r(float(np.mean(nets)), 5) if nets else None, win=_r(float(np.mean([n > 0 for n in nets])), 3) if nets else None,
                monthly_mean=_r(mean, 5), t=_r(t, 2), months=months, ended=ends, persistence=_r(persisted / kept, 3) if filtered and kept else None, supported=bool(ok))


def markdown(res: dict, meta: dict) -> str:
    f, c = res["filtered"], res["control"]
    L = ["# Pairs: cointegration screen, out of sample", "", f"Run {meta['when']} on {meta['symbols']} symbols, {meta['dates'][0]} to {meta['dates'][1]}. Survivorship applies: an upper bound.",
         f"Verdict: **{'supported' if f['supported'] else 'not supported'}** (needs {MIN_TRADES}+ trades, mean net above zero, t of {T_BAR} or more).", "",
         "| Rule | quarters | pairs | trades | mean net / trade | win rate | t (monthly) | converged / stopped / timeout / forced | still cointegrated after |", "|---|---|---|---|---|---|---|---|---|"]
    for nm, r in (("ADF and half-life screen", f), ("Control: correlation only", c)):
        e = r["ended"]; L.append(f"| {nm} | {r['quarters']} | {r['pairs']} | {r['trades']} | {r['mean_net']} | {r['win']} | {r['t']} | {e['converged']} / {e['stopped']} / {e['timeout']} / {e['forced']} | {r['persistence'] if r['persistence'] is not None else 'n/a'} |")
    L += ["", f"Costs {COST * 100:.2f} percent of gross notional per trade. A pair needs a short leg: single-stock futures only, not cash equities. Nothing here is a signal."]
    return "\n".join(L)


if __name__ == "__main__":
    screen_path = sys.argv[1]; outdir = pathlib.Path(sys.argv[2]); outdir.mkdir(parents=True, exist_ok=True)
    p = load_real(screen_path); rows = {r["sym"]: r.get("sector") or "unknown" for r in json.loads(pathlib.Path(screen_path).read_text())["rows"]}
    sector = np.array([rows.get(s, "unknown") for s in p.syms]); res = dict(filtered=run(p, sector, True), control=run(p, sector, False))
    meta = {"when": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "symbols": len(p.syms), "dates": [str(p.dates[0])[:10], str(p.dates[-1])[:10]]}
    (outdir / "engines_pairs.json").write_text(json.dumps({"meta": meta, "pairs": res}, indent=1)); (outdir / "engines_pairs.md").write_text(markdown(res, meta)); print(markdown(res, meta))
